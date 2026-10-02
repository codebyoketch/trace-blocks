from unittest.mock import patch

from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone

from .models import Product, TrackingEvent, User


def make_product(**kwargs):
    defaults = {
        "name": "Wireless Keyboard",
        "sku": "KB-001",
        "manufacturer": "Acme Corp",
        "description": "A keyboard",
    }
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def make_user(username="tester", email="tester@example.com", password="Testpass123!"):
    return User.objects.create_user(
        username=username,
        email=email,
        password=password,
        second_name="Tester",
    )


class ProductModelTests(TestCase):
    def test_create_product(self):
        product = make_product()
        self.assertEqual(product.name, "Wireless Keyboard")
        self.assertEqual(product.sku, "KB-001")
        self.assertIsNotNone(product.created_at)

    def test_str(self):
        self.assertEqual(str(make_product()), "Wireless Keyboard (KB-001)")

    def test_sku_is_unique(self):
        make_product()
        with self.assertRaises(Exception):
            make_product(name="Duplicate")

    def test_current_status_without_events(self):
        self.assertEqual(make_product().current_status(), "unknown")

    def test_current_status_returns_latest_event(self):
        product = make_product()
        TrackingEvent.objects.create(product=product, status="manufactured", location="Factory")
        TrackingEvent.objects.create(product=product, status="shipped", location="Port")

        self.assertEqual(product.current_status(), "shipped")

    def test_deleting_product_cascades_events(self):
        product = make_product()
        TrackingEvent.objects.create(product=product, status="manufactured", location="Factory")

        product.delete()

        self.assertEqual(TrackingEvent.objects.count(), 0)


class TrackingEventModelTests(TestCase):
    def setUp(self):
        self.product = make_product()

    def test_create_event(self):
        event = TrackingEvent.objects.create(
            product=self.product, status="shipped", location="Mombasa Port"
        )
        self.assertEqual(event.status, "shipped")
        self.assertEqual(event.tx_status, "pending")
        self.assertIsNotNone(event.timestamp)

    def test_str(self):
        event = TrackingEvent.objects.create(
            product=self.product, status="delivered", location="Nairobi"
        )
        self.assertEqual(str(event), "KB-001 — delivered @ Nairobi")

    def test_explorer_url_empty_without_tx(self):
        event = TrackingEvent.objects.create(
            product=self.product, status="shipped", location="Port"
        )
        self.assertEqual(event.explorer_url, "")

    def test_explorer_url_with_tx(self):
        event = TrackingEvent.objects.create(
            product=self.product, status="shipped", location="Port", tx_id="0xabc123"
        )
        self.assertIn("0xabc123", event.explorer_url)

    def test_default_ordering_is_newest_first(self):
        old = TrackingEvent.objects.create(
            product=self.product, status="manufactured", location="Factory"
        )
        new = TrackingEvent.objects.create(
            product=self.product, status="delivered", location="Nairobi"
        )
        old.timestamp = timezone.now() - timezone.timedelta(days=1)
        old.save(update_fields=["timestamp"])

        self.assertEqual(list(self.product.events.all()), [new, old])

    def test_boolean_fields_default_false(self):
        event = TrackingEvent.objects.create(
            product=self.product, status="shipped", location="Port"
        )
        self.assertFalse(event.cold_chain)
        self.assertFalse(event.hazardous)
        self.assertFalse(event.insurance_covered)
        self.assertFalse(event.customs_cleared)


class UserModelTests(TestCase):
    def test_create_user(self):
        user = make_user()
        self.assertEqual(user.user_type, User.TYPE_NORMAL)
        self.assertTrue(user.check_password("Testpass123!"))


class IndexViewTests(TestCase):
    def test_index_renders_with_products(self):
        make_product()
        response = self.client.get(reverse("index"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(response.context["products"]), list(Product.objects.all()))

    def test_index_empty(self):
        response = self.client.get(reverse("index"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["products"]), 0)

    def test_product_detail(self):
        make_product()
        response = self.client.get(reverse("product_detail", args=["KB-001"]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Wireless Keyboard")

    def test_product_detail_404(self):
        self.assertEqual(
            self.client.get(reverse("product_detail", args=["NOPE"])).status_code, 404
        )


class CreateProductViewTests(TestCase):
    @patch("tracker.views.VeChainService")
    def test_creates_product_and_initial_event(self, mock_chain):
        mock_chain.return_value.record_tracking_event.return_value = "0xtx1"

        response = self.client.post(
            reverse("create_product"),
            {
                "name": "Laptop",
                "sku": "LP-100",
                "manufacturer": "Dell",
                "description": "A laptop",
            },
        )

        self.assertRedirects(response, reverse("product_detail", args=["LP-100"]))
        product = Product.objects.get(sku="LP-100")
        self.assertEqual(product.events.count(), 1)
        self.assertEqual(product.current_status(), "manufactured")

    @patch("tracker.views.VeChainService")
    def test_missing_name_returns_to_index(self, mock_chain):
        response = self.client.post(reverse("create_product"), {"sku": "LP-200"})

        self.assertEqual(response.status_code, 302)
        self.assertFalse(Product.objects.filter(sku="LP-200").exists())

    @patch("tracker.views.VeChainService")
    def test_duplicate_sku_rejected(self, mock_chain):
        make_product()
        response = self.client.post(
            reverse("create_product"), {"name": "Copy", "sku": "KB-001"}
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(Product.objects.filter(sku="KB-001").count(), 1)

    def test_get_not_allowed(self):
        self.assertEqual(self.client.get(reverse("create_product")).status_code, 405)


class AddEventViewTests(TestCase):
    def setUp(self):
        self.product = make_product()

    @patch("tracker.views.VeChainService")
    def test_adds_event(self, mock_chain):
        mock_chain.return_value.record_tracking_event.return_value = "0xtx2"

        response = self.client.post(
            reverse("add_event", args=["KB-001"]),
            {"status": "shipped", "location": "Mombasa", "notes": "On the way"},
        )

        self.assertRedirects(response, reverse("product_detail", args=["KB-001"]))
        event = self.product.events.get()
        self.assertEqual(event.status, "shipped")
        self.assertEqual(event.tx_id, "0xtx2")
        self.assertEqual(event.tx_status, "pending")

    @patch("tracker.views.VeChainService")
    def test_gps_and_goods_fields_persist(self, mock_chain):
        mock_chain.return_value.record_tracking_event.return_value = "0xtx3"

        self.client.post(
            reverse("add_event", args=["KB-001"]),
            {
                "status": "in_transit",
                "location": "Nairobi",
                "latitude": "-1.2921",
                "longitude": "36.8219",
                "goods_name": "Wireless Keyboard",
                "quantity": "50",
                "cold_chain": "on",
            },
        )

        event = self.product.events.get()
        self.assertAlmostEqual(event.latitude, -1.2921, places=4)
        self.assertAlmostEqual(event.longitude, 36.8219, places=4)
        self.assertEqual(event.quantity, "50")
        self.assertTrue(event.cold_chain)

    @patch("tracker.views.VeChainService")
    def test_invalid_gps_falls_back_to_none(self, mock_chain):
        mock_chain.return_value.record_tracking_event.return_value = "0xtx4"

        self.client.post(
            reverse("add_event", args=["KB-001"]),
            {"status": "shipped", "location": "Port", "latitude": "not-a-number"},
        )

        self.assertIsNone(self.product.events.get().latitude)

    @patch("tracker.views.VeChainService")
    def test_event_saved_when_blockchain_fails(self, mock_chain):
        mock_chain.return_value.record_tracking_event.side_effect = RuntimeError("node down")

        response = self.client.post(
            reverse("add_event", args=["KB-001"]),
            {"status": "shipped", "location": "Port"},
        )

        self.assertEqual(response.status_code, 302)
        event = self.product.events.get()
        self.assertEqual(event.tx_status, "error")
        self.assertEqual(event.status, "shipped")

    @patch("tracker.views.VeChainService")
    def test_missing_required_fields_rejected(self, mock_chain):
        response = self.client.post(
            reverse("add_event", args=["KB-001"]), {"status": "shipped"}
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.product.events.count(), 0)


class HandoverViewTests(TestCase):
    def setUp(self):
        self.product = make_product()

    @patch("tracker.views.VeChainService")
    def test_handover_creates_event(self, mock_chain):
        mock_chain.return_value.record_tracking_event.return_value = "0xtx5"

        response = self.client.post(
            reverse("add_handover", args=["KB-001"]),
            {
                "outgoing_transporter": "TransCo",
                "incoming_transporter": "SwiftFreight",
                "handover_location": "Nairobi Hub",
                "qty_dispatched": "50",
                "qty_received": "48",
            },
        )

        self.assertRedirects(response, reverse("product_detail", args=["KB-001"]))
        event = self.product.events.get()
        self.assertEqual(event.status, "handover")
        self.assertEqual(event.outgoing_transporter, "TransCo")
        self.assertEqual(event.incoming_transporter, "SwiftFreight")
        self.assertEqual(event.qty_received, "48")

    @patch("tracker.views.VeChainService")
    def test_requires_both_transporters(self, mock_chain):
        response = self.client.post(
            reverse("add_handover", args=["KB-001"]),
            {"outgoing_transporter": "TransCo", "handover_location": "Hub"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.product.events.count(), 0)


class RefreshTxStatusTests(TestCase):
    def setUp(self):
        self.product = make_product()
        self.event = TrackingEvent.objects.create(
            product=self.product, status="shipped", location="Port", tx_id="0xtx6"
        )

    @patch("tracker.views.VeChainService")
    def test_confirmed_status_is_persisted(self, mock_chain):
        mock_chain.return_value.get_tx_status.return_value = "confirmed"

        response = self.client.get(reverse("refresh_tx_status", args=[self.event.id]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["tx_status"], "confirmed")
        self.event.refresh_from_db()
        self.assertEqual(self.event.tx_status, "confirmed")

    @patch("tracker.views.VeChainService")
    def test_keeps_pending_when_chain_raises(self, mock_chain):
        mock_chain.return_value.get_tx_status.side_effect = RuntimeError("unreachable")

        response = self.client.get(reverse("refresh_tx_status", args=[self.event.id]))

        self.assertEqual(response.json()["tx_status"], "pending")
        self.event.refresh_from_db()
        self.assertEqual(self.event.tx_status, "pending")

    def test_404_for_missing_event(self):
        self.assertEqual(
            self.client.get(reverse("refresh_tx_status", args=[9999])).status_code, 404
        )


class AuthViewTests(TestCase):
    def test_signup_page_renders(self):
        self.assertEqual(self.client.get(reverse("createuser")).status_code, 200)

    def test_login_page_renders(self):
        self.assertEqual(self.client.get(reverse("login")).status_code, 200)

    def test_create_normal_user(self):
        response = self.client.post(
            reverse("createuser"),
            {
                "username": "amina",
                "email": "amina@example.com",
                "password": "Strongpass123!",
                "user_type": "NORMAL",
                "firstname": "Amina",
                "lastname": "Yusuf",
            },
        )

        self.assertRedirects(response, reverse("login"))
        user = User.objects.get(email="amina@example.com")
        self.assertEqual(user.username, "amina")
        self.assertEqual(user.first_name, "Amina")
        self.assertEqual(user.second_name, "Yusuf")

    def test_create_organisation_user(self):
        self.client.post(
            reverse("createuser"),
            {
                "email": "info@acme.com",
                "password": "Strongpass123!",
                "user_type": "ORGANISATION",
                "organisation_name": "Acme Corp",
            },
        )

        user = User.objects.get(email="info@acme.com")
        self.assertEqual(user.user_type, User.TYPE_ORG)
        self.assertEqual(user.organisation_name, "Acme Corp")
        self.assertEqual(user.username, "acmecorp")

    def test_signup_rejects_duplicate_email(self):
        make_user()
        response = self.client.post(
            reverse("createuser"),
            {
                "username": "other",
                "email": "tester@example.com",
                "password": "Strongpass123!",
                "user_type": "ORGANISATION",
                "organisation_name": "Other Co",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.count(), 1)

    def test_signup_rejects_invalid_user_type(self):
        response = self.client.post(
            reverse("createuser"),
            {"email": "x@y.com", "password": "p", "user_type": "ADMIN"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.count(), 0)

    def test_login_with_email(self):
        make_user()
        response = self.client.post(
            reverse("login"),
            {"email": "tester@example.com", "password": "Testpass123!"},
        )

        self.assertRedirects(response, reverse("interface"))

    def test_login_with_wrong_password(self):
        make_user()
        response = self.client.post(
            reverse("login"), {"email": "tester@example.com", "password": "nope"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Invalid email or password")

    def test_interface_requires_login(self):
        response = self.client.get(reverse("interface"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response.url)

    def test_interface_when_logged_in(self):
        make_user()
        self.client.post(
            reverse("login"), {"email": "tester@example.com", "password": "Testpass123!"}
        )

        self.assertEqual(self.client.get(reverse("interface")).status_code, 200)


class PublicPageTests(TestCase):
    def test_events_page(self):
        self.assertEqual(self.client.get(reverse("events")).status_code, 200)

    def test_profile_page(self):
        self.assertEqual(self.client.get(reverse("profile")).status_code, 200)


class AddEventApiTests(TestCase):
    def setUp(self):
        self.url = reverse("add_event_api")
        self.payload = {
            "event_name": "shipped",
            "origin_location": "Mombasa Port",
            "logistics_notes": "Loaded",
            "goods_name": "Wireless Keyboard",
            "batch_number": "KB-001",
        }

    @patch("tracker.views.VeChainService")
    def test_json_post_creates_product_and_event(self, mock_chain):
        mock_chain.return_value.record_tracking_event.return_value = "0xtx7"

        response = self.client.post(
            self.url, data=self.payload, content_type="application/json"
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["tx_status"], "pending")
        self.assertTrue(Product.objects.filter(sku="KB-001").exists())

    @patch("tracker.views.VeChainService")
    def test_sku_derived_when_batch_number_missing(self, mock_chain):
        mock_chain.return_value.record_tracking_event.return_value = "0xtx8"

        payload = {"event_name": "shipped", "goods_name": "Wireless Keyboard", "event_id": "E9"}
        self.client.post(self.url, data=payload, content_type="application/json")

        self.assertTrue(Product.objects.filter(sku="WIRELESS-KEYBOARD-E9").exists())

    def test_invalid_json_returns_400(self):
        response = self.client.post(
            self.url, data="not-json", content_type="application/json"
        )

        self.assertEqual(response.status_code, 400)

    def test_get_not_allowed(self):
        self.assertEqual(self.client.get(self.url).status_code, 405)


class VeChainServiceTests(TestCase):
    def test_mock_mode_without_private_key(self):
        from .blockchain import VeChainService

        with self.settings(VECHAIN_PRIVATE_KEY=None):
            tx_id = VeChainService().record_tracking_event({"event_name": "shipped"})

        self.assertTrue(tx_id.startswith("mock_tx_hash_"))

    def test_mock_tx_status_is_confirmed(self):
        from .blockchain import VeChainService

        self.assertEqual(VeChainService().get_tx_status("mock_tx_hash_1"), "confirmed")

    def test_payload_strips_empty_values(self):
        from .blockchain import VeChainService

        payload = VeChainService()._build_payload(
            {"event_name": "shipped", "origin_location": "", "cold_chain": "no"}
        )

        self.assertEqual(payload["evt"], "shipped")
        self.assertNotIn("lgx", payload)
        self.assertNotIn("cold", payload)

    @patch("tracker.blockchain.requests.get")
    def test_tx_status_pending_on_404(self, mock_get):
        from .blockchain import VeChainService

        mock_get.return_value.status_code = 404

        self.assertEqual(VeChainService().get_tx_status("0xdead"), "pending")

    @patch("tracker.blockchain.requests.get")
    def test_tx_status_reverted(self, mock_get):
        from .blockchain import VeChainService

        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {"reverted": True}

        self.assertEqual(VeChainService().get_tx_status("0xdead"), "reverted")

    @patch("tracker.blockchain.requests.get")
    def test_block_ref_failure_raises(self, mock_get):
        from .blockchain import VeChainService

        mock_get.side_effect = OSError("no network")

        with self.assertRaises(RuntimeError):
            VeChainService()._get_block_ref()
