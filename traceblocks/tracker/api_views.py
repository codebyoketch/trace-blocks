"""
tracker/api_views.py

Mobile companion API — all endpoints consumed by the Expo React Native app.

Endpoints:
    POST /api/mobile/login/              — email + password → auth token
    GET  /api/mobile/products/           — list all products
    GET  /api/mobile/qr/<qr_token>/      — resolve a scanned QR token
    POST /api/mobile/log/                — log a quick event from the app
    GET  /api/mobile/events/<sku>/       — get event history for a product
"""

import logging
from django.contrib.auth import authenticate
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from rest_framework.authtoken.models import Token
import json

from .models import Product, TrackingEvent, User
from .views import _log_event                  # reuse the existing core helper

logger = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _json(request):
    """Parse JSON body safely. Returns dict or None."""
    try:
        return json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return None


def _auth(request):
    """
    Validate Bearer token from Authorization header.
    Returns the User if valid, None otherwise.
    """
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith("Bearer "):
        return None
    token_key = header.split(" ", 1)[1].strip()
    try:
        token = Token.objects.select_related("user").get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return None


def _require_auth(request):
    """Return (user, error_response). error_response is None when auth is OK."""
    user = _auth(request)
    if user is None:
        return None, JsonResponse(
            {"ok": False, "error": "Authentication required. Pass a valid Bearer token."},
            status=401,
        )
    return user, None


# ── POST /api/mobile/login/ ───────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def mobile_login(request):
    """
    Authenticate a user and return a DRF token.

    Request body (JSON):
        { "email": "...", "password": "..." }

    Response:
        { "ok": true, "token": "...", "username": "..." }
    """
    data = _json(request)
    if not data:
        return JsonResponse({"ok": False, "error": "Invalid JSON body."}, status=400)

    email    = data.get("email",    "").strip()
    password = data.get("password", "")

    if not email or not password:
        return JsonResponse({"ok": False, "error": "Email and password are required."}, status=400)

    # EmailBackend authenticates by email using the username field
    user = authenticate(request, username=email, password=password)
    if user is None:
        return JsonResponse({"ok": False, "error": "Invalid email or password."}, status=401)

    token, _ = Token.objects.get_or_create(user=user)

    return JsonResponse({
        "ok":       True,
        "token":    token.key,
        "username": user.username,
        "email":    user.email,
    })


# ── GET /api/mobile/products/ ────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET"])
def mobile_products(request):
    """
    Return all products with their latest status and event count.
    Requires Bearer token.

    Response:
        {
          "ok": true,
          "products": [
            {
              "sku": "...",
              "name": "...",
              "manufacturer": "...",
              "current_status": "...",
              "event_count": 3,
              "created_at": "..."
            },
            ...
          ]
        }
    """
    user, err = _require_auth(request)
    if err:
        return err

    products = Product.objects.prefetch_related("events").order_by("-created_at")

    return JsonResponse({
        "ok": True,
        "products": [
            {
                "sku":            p.sku,
                "name":           p.name,
                "manufacturer":   p.manufacturer,
                "description":    p.description,
                "current_status": p.current_status(),
                "event_count":    p.events.count(),
                "created_at":     p.created_at.isoformat(),
            }
            for p in products
        ],
    })


# ── GET /api/mobile/qr/<qr_token>/ ───────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET"])
def mobile_qr_resolve(request, qr_token):
    """
    Resolve a scanned QR token into the event and product context.
    The app calls this immediately after scanning a QR code.
    No auth required — scanning should be frictionless.

    Response:
        {
          "ok": true,
          "product": { "sku": "...", "name": "..." },
          "last_event": { "status": "...", "location": "...", "timestamp": "..." },
          "status_choices": [["shipped", "Shipped"], ...],
          "qr_token": "..."
        }
    """
    try:
        event = TrackingEvent.objects.select_related("product").get(qr_token=qr_token)
    except TrackingEvent.DoesNotExist:
        return JsonResponse({"ok": False, "error": "QR code not recognised."}, status=404)

    product = event.product

    return JsonResponse({
        "ok": True,
        "qr_token": qr_token,
        "product": {
            "sku":          product.sku,
            "name":         product.name,
            "manufacturer": product.manufacturer,
        },
        "last_event": {
            "status":    event.status,
            "location":  event.location,
            "timestamp": event.timestamp.isoformat(),
            "tx_id":     event.tx_id,
            "tx_status": event.tx_status,
        },
        "status_choices": TrackingEvent.STATUS_CHOICES,
    })


# ── POST /api/mobile/log/ ─────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def mobile_log_event(request):
    """
    Log a quick event from the mobile app.
    Called after the user scans a QR, picks a status, and hits submit.
    Requires Bearer token.

    Request body (JSON):
        {
          "sku":       "PROD-001",       -- product to log against
          "status":    "in_transit",     -- must be a valid STATUS_CHOICE
          "location":  "Kisumu Hub",     -- human-readable location label
          "latitude":  -0.1022,          -- GPS from device
          "longitude": 34.7617,
          "notes":     "..."             -- optional
        }

    Response:
        {
          "ok": true,
          "event_id": 42,
          "tx_id": "0x...",
          "tx_status": "pending"
        }
    """
    user, err = _require_auth(request)
    if err:
        return err

    data = _json(request)
    if not data:
        return JsonResponse({"ok": False, "error": "Invalid JSON body."}, status=400)

    sku      = data.get("sku",      "").strip()
    status   = data.get("status",   "").strip()
    location = data.get("location", "").strip()
    notes    = data.get("notes",    "").strip()

    # Validate required fields
    if not sku:
        return JsonResponse({"ok": False, "error": "sku is required."}, status=400)
    if not status:
        return JsonResponse({"ok": False, "error": "status is required."}, status=400)
    if not location:
        return JsonResponse({"ok": False, "error": "location is required."}, status=400)

    # Validate status is a known choice
    valid_statuses = [s[0] for s in TrackingEvent.STATUS_CHOICES]
    if status not in valid_statuses:
        return JsonResponse({
            "ok":    False,
            "error": f"Invalid status '{status}'. Must be one of: {valid_statuses}",
        }, status=400)

    # Look up the product
    try:
        product = Product.objects.get(sku=sku)
    except Product.DoesNotExist:
        return JsonResponse({"ok": False, "error": f"Product '{sku}' not found."}, status=404)

    # Parse GPS — both fields required for a valid GPS fix
    try:
        latitude  = float(data["latitude"])  if data.get("latitude")  is not None else None
        longitude = float(data["longitude"]) if data.get("longitude") is not None else None
    except (TypeError, ValueError):
        latitude  = None
        longitude = None

    event_data = {
        "event_name":      status,
        "origin_location": location,
        "logistics_notes": notes,
        "goods_name":      product.name,
        "batch_number":    product.sku,
        "latitude":        latitude,
        "longitude":       longitude,
        # Tag the event as coming from the mobile app
        "full_name":       user.username,
        "user_id":         str(user.id),
    }

    event = _log_event(product, status, location, notes, event_data=event_data)

    return JsonResponse({
        "ok":        True,
        "event_id":  event.id,
        "tx_id":     event.tx_id,
        "tx_status": event.tx_status,
        "qr_token":  event.qr_token,
    }, status=201)


# ── GET /api/mobile/events/<sku>/ ────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET"])
def mobile_event_history(request, sku):
    """
    Return the full event history for a product.
    Requires Bearer token.

    Response:
        {
          "ok": true,
          "sku": "...",
          "events": [
            {
              "id": 1,
              "status": "shipped",
              "status_display": "Shipped",
              "location": "...",
              "latitude": -0.1022,
              "longitude": 34.7617,
              "timestamp": "...",
              "tx_id": "0x...",
              "tx_status": "confirmed",
              "qr_token": "..."
            },
            ...
          ]
        }
    """
    user, err = _require_auth(request)
    if err:
        return err

    try:
        product = Product.objects.get(sku=sku)
    except Product.DoesNotExist:
        return JsonResponse({"ok": False, "error": f"Product '{sku}' not found."}, status=404)

    events = product.events.order_by("-timestamp")

    return JsonResponse({
        "ok":  True,
        "sku": sku,
        "events": [
            {
                "id":             e.id,
                "status":         e.status,
                "status_display": e.get_status_display(),
                "location":       e.location,
                "latitude":       e.latitude,
                "longitude":      e.longitude,
                "notes":          e.notes,
                "timestamp":      e.timestamp.isoformat(),
                "tx_id":          e.tx_id,
                "tx_status":      e.tx_status,
                "qr_token":       e.qr_token,
            }
            for e in events
        ],
    })


# ── POST /api/mobile/products/create/ ────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def mobile_create_product(request):
    """
    Create a new product and log its first 'manufactured' event.
    Requires Bearer token.

    Request body (JSON):
        {
          "name":         "Fish Consignment",
          "sku":          "FISH-001",
          "manufacturer": "Rouwel Farms",
          "description":  "...",   -- optional
          "location":     "Kisumu Factory",
          "latitude":     -0.1022,  -- optional
          "longitude":    34.7617   -- optional
        }
    """
    user, err = _require_auth(request)
    if err:
        return err

    data = _json(request)
    if not data:
        return JsonResponse({"ok": False, "error": "Invalid JSON body."}, status=400)

    name         = data.get("name",         "").strip()
    sku          = data.get("sku",          "").strip()
    manufacturer = data.get("manufacturer", "").strip()
    description  = data.get("description",  "").strip()
    location     = data.get("location",     "").strip() or manufacturer or "Factory"

    if not name:
        return JsonResponse({"ok": False, "error": "name is required."}, status=400)
    if not sku:
        return JsonResponse({"ok": False, "error": "sku is required."}, status=400)

    if Product.objects.filter(sku=sku).exists():
        return JsonResponse({"ok": False, "error": f"SKU '{sku}' already exists."}, status=409)

    try:
        latitude  = float(data["latitude"])  if data.get("latitude")  is not None else None
        longitude = float(data["longitude"]) if data.get("longitude") is not None else None
    except (TypeError, ValueError):
        latitude = longitude = None

    product = Product.objects.create(
        name=name, sku=sku,
        manufacturer=manufacturer,
        description=description,
    )

    event_data = {
        "event_name":      "manufactured",
        "origin_location": location,
        "goods_name":      name,
        "batch_number":    sku,
        "latitude":        latitude,
        "longitude":       longitude,
        "full_name":       user.username,
        "user_id":         str(user.id),
    }
    event = _log_event(product, "manufactured", location, "Product created via mobile app", event_data=event_data)

    return JsonResponse({
        "ok":       True,
        "sku":      product.sku,
        "name":     product.name,
        "event_id": event.id,
        "tx_id":    event.tx_id,
        "tx_status": event.tx_status,
    }, status=201)


# ── POST /api/mobile/handover/ ────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def mobile_log_handover(request):
    """
    Record a custody handover from the mobile app.
    Requires Bearer token.

    Request body (JSON):
        {
          "sku":                  "FISH-001",
          "handover_location":    "Kisumu Hub Gate 3",
          "handover_datetime":    "2026-06-01T08:00",
          "qty_dispatched":       "50",
          "qty_received":         "48",
          "unit_of_measure":      "kg",
          "qty_discrepancy_note": "2kg damaged in transit",
          "outgoing_transporter": "John Otieno",
          "outgoing_role":        "Driver",
          "outgoing_signature":   "John Otieno",
          "incoming_transporter": "Mary Auma",
          "incoming_role":        "Warehouse Manager",
          "incoming_signature":   "Mary Auma",
          "carrier_name":         "Siginon",      -- optional
          "vehicle_plate":        "KDA 123B",     -- optional
          "transport_mode":       "road",         -- optional
          "latitude":             -0.1022,        -- optional
          "longitude":            34.7617         -- optional
        }
    """
    user, err = _require_auth(request)
    if err:
        return err

    data = _json(request)
    if not data:
        return JsonResponse({"ok": False, "error": "Invalid JSON body."}, status=400)

    sku      = data.get("sku",      "").strip()
    outgoing = data.get("outgoing_transporter", "").strip()
    incoming = data.get("incoming_transporter", "").strip()
    location = data.get("handover_location",    "").strip() or "Unknown"

    if not sku:
        return JsonResponse({"ok": False, "error": "sku is required."}, status=400)
    if not outgoing:
        return JsonResponse({"ok": False, "error": "outgoing_transporter is required."}, status=400)
    if not incoming:
        return JsonResponse({"ok": False, "error": "incoming_transporter is required."}, status=400)

    try:
        product = Product.objects.get(sku=sku)
    except Product.DoesNotExist:
        return JsonResponse({"ok": False, "error": f"Product '{sku}' not found."}, status=404)

    try:
        latitude  = float(data["latitude"])  if data.get("latitude")  is not None else None
        longitude = float(data["longitude"]) if data.get("longitude") is not None else None
    except (TypeError, ValueError):
        latitude = longitude = None

    notes = data.get("qty_discrepancy_note", "").strip()
    dt    = data.get("handover_datetime", "").strip()

    event_data = {
        "event_name":           "handover",
        "origin_location":      location,
        "logistics_notes":      notes,
        "goods_name":           product.name,
        "batch_number":         product.sku,
        "latitude":             latitude,
        "longitude":            longitude,
        "qty_dispatched":       data.get("qty_dispatched",  ""),
        "qty_received":         data.get("qty_received",    ""),
        "qty_discrepancy_note": notes,
        "unit_of_measure":      data.get("unit_of_measure", ""),
        "handover_location":    location,
        "handover_datetime":    dt,
        "outgoing_transporter": outgoing,
        "incoming_transporter": incoming,
        "dispatcher_name":      outgoing,
        "dispatcher_role":      data.get("outgoing_role",      ""),
        "dispatcher_signature": data.get("outgoing_signature", ""),
        "dispatcher_date":      dt,
        "recipient_name":       incoming,
        "recipient_role":       data.get("incoming_role",      ""),
        "recipient_signature":  data.get("incoming_signature", ""),
        "recipient_date":       dt,
        "carrier_name":         data.get("carrier_name",   ""),
        "vehicle_plate":        data.get("vehicle_plate",  ""),
        "transport_mode":       data.get("transport_mode", ""),
        "full_name":            user.username,
        "user_id":              str(user.id),
    }

    event = _log_event(product, "handover", location, notes, event_data=event_data)

    return JsonResponse({
        "ok":        True,
        "event_id":  event.id,
        "tx_id":     event.tx_id,
        "tx_status": event.tx_status,
        "qr_token":  event.qr_token,
    }, status=201)


# ── PATCH /api/mobile/auth/profile/ ──────────────────────────────────────────

@csrf_exempt
@require_http_methods(["PATCH"])
def mobile_update_profile(request):
    """
    Update the authenticated user's profile fields.
    Requires Bearer token.

    Request body (JSON) — all fields optional:
        {
          "first_name":  "Brian",
          "second_name": "Oketch",
          "phonenumber": "+254712345678"
        }
    """
    user, err = _require_auth(request)
    if err:
        return err

    data = _json(request)
    if not data:
        return JsonResponse({"ok": False, "error": "Invalid JSON body."}, status=400)

    changed = False
    for field in ("first_name", "second_name", "middle_name", "phonenumber"):
        if field in data:
            setattr(user, field, data[field].strip() if isinstance(data[field], str) else data[field])
            changed = True

    if changed:
        user.save(update_fields=[f for f in ("first_name", "second_name", "middle_name", "phonenumber") if f in data])

    return JsonResponse({
        "ok":          True,
        "username":    user.username,
        "email":       user.email,
        "first_name":  user.first_name,
        "second_name": user.second_name,
        "phonenumber": user.phonenumber,
    })


# ── POST /api/mobile/auth/change-password/ ───────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def mobile_change_password(request):
    """
    Change the authenticated user's password.
    Requires Bearer token.

    Request body (JSON):
        { "current_password": "...", "new_password": "..." }
    """
    user, err = _require_auth(request)
    if err:
        return err

    data = _json(request)
    if not data:
        return JsonResponse({"ok": False, "error": "Invalid JSON body."}, status=400)

    current = data.get("current_password", "")
    new_pw  = data.get("new_password",     "")

    if not current or not new_pw:
        return JsonResponse({"ok": False, "error": "current_password and new_password are required."}, status=400)

    if not user.check_password(current):
        return JsonResponse({"ok": False, "error": "Current password is incorrect."}, status=400)

    if len(new_pw) < 6:
        return JsonResponse({"ok": False, "error": "New password must be at least 6 characters."}, status=400)

    user.set_password(new_pw)
    user.save(update_fields=["password"])

    # Invalidate all existing tokens so the user must log in again
    from rest_framework.authtoken.models import Token as DRFToken
    DRFToken.objects.filter(user=user).delete()

    return JsonResponse({"ok": True, "message": "Password changed. Please log in again."})


# ── DELETE /api/mobile/auth/sessions/ ────────────────────────────────────────

@csrf_exempt
@require_http_methods(["DELETE"])
def mobile_logout_all(request):
    """
    Logout from all devices by deleting all auth tokens for this user.
    Requires Bearer token.
    """
    user, err = _require_auth(request)
    if err:
        return err

    from rest_framework.authtoken.models import Token as DRFToken
    count = DRFToken.objects.filter(user=user).count()
    DRFToken.objects.filter(user=user).delete()

    return JsonResponse({"ok": True, "sessions_cleared": count})


# ── GET /api/mobile/auth/profile/ ────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET"])
def mobile_get_profile(request):
    """
    Get the authenticated user's profile.
    Requires Bearer token.
    """
    user, err = _require_auth(request)
    if err:
        return err

    return JsonResponse({
        "ok":               True,
        "username":         user.username,
        "email":            user.email,
        "first_name":       user.first_name,
        "second_name":      getattr(user, "second_name", ""),
        "middle_name":      getattr(user, "middle_name", ""),
        "phonenumber":      getattr(user, "phonenumber", ""),
        "organisation_name": getattr(user, "organisation_name", ""),
        "user_type":        getattr(user, "user_type", "NORMAL"),
    })