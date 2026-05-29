import logging
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.views.decorators.http import require_POST
from django.http import JsonResponse
import random
from django.contrib.auth import authenticate, login
from django.views.decorators.csrf import csrf_exempt
from .models import Product, TrackingEvent
from .blockchain import VeChainService
from .models import User 


logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_chain():
    return VeChainService()


# ── Product views ─────────────────────────────────────────────────────────────

def index(request):
    products = Product.objects.prefetch_related("events").order_by("-created_at")
    return render(request, "index.html", {"products": products})


def product_detail(request, sku):
    product = get_object_or_404(Product, sku=sku)
    events  = product.events.order_by("-timestamp")
    return render(request, "product_detail.html", {
        "product": product,
        "events":  events,
        "status_choices": TrackingEvent.STATUS_CHOICES,
    })


@require_POST
def create_product(request):
    name         = request.POST.get("name", "").strip()
    sku          = request.POST.get("sku", "").strip()
    description  = request.POST.get("description", "").strip()
    manufacturer = request.POST.get("manufacturer", "").strip()

    if not name or not sku:
        messages.error(request, "Name and SKU are required.")
        return redirect("index")

    if Product.objects.filter(sku=sku).exists():
        messages.error(request, f"SKU '{sku}' already exists.")
        return redirect("index")

    product = Product.objects.create(
        name=name, sku=sku,
        description=description,
        manufacturer=manufacturer,
    )

    _log_event(product, "manufactured", manufacturer or "Factory", "Product created")
    messages.success(request, f"Product '{name}' created and recorded on VeChain.")
    return redirect("product_detail", sku=product.sku)


# ── Tracking event views ──────────────────────────────────────────────────────

@require_POST
def add_event(request, sku):
    product  = get_object_or_404(Product, sku=sku)
    status   = request.POST.get("status", "").strip()
    location = request.POST.get("location", "").strip()
    notes    = request.POST.get("notes", "").strip()

    if not status or not location:
        messages.error(request, "Status and location are required.")
        return redirect("product_detail", sku=sku)

    event_data = {
        "event_name":            status,
        "origin_location":       location,
        "logistics_notes":       notes,
        "user_id":               request.POST.get("user_id", "").strip(),
        "full_name":             request.POST.get("full_name", "").strip(),
        "event_id":              request.POST.get("event_id", "").strip(),
        "short_description":     request.POST.get("short_description", "").strip(),
        "detailed_explanation":  request.POST.get("detailed_explanation", "").strip(),
        "exceptions_noted":      request.POST.get("exceptions_noted"),
        "regulatory_flag":       request.POST.get("regulatory_flag"),
        "quality_check_passed":  request.POST.get("quality_check_passed"),
        "needs_detail":          request.POST.get("needs_detail"),
        "goods_name":            request.POST.get("goods_name", "").strip(),
        "goods_category":        request.POST.get("goods_category", "").strip(),
        "quantity":              request.POST.get("quantity", "").strip(),
        "unit_of_measure":       request.POST.get("unit_of_measure", "").strip(),
        "batch_number":          request.POST.get("batch_number", "").strip(),
        "goods_condition":       request.POST.get("goods_condition", "").strip(),
        "cold_chain":            request.POST.get("cold_chain"),
        "hazardous":             request.POST.get("hazardous"),
        "dispatcher_name":       request.POST.get("dispatcher_name", "").strip(),
        "dispatcher_role":       request.POST.get("dispatcher_role", "").strip(),
        "dispatcher_signature":  request.POST.get("dispatcher_signature", "").strip(),
        "dispatcher_date":       request.POST.get("dispatcher_date", "").strip(),
        "dispatcher_confirmed":  request.POST.get("dispatcher_confirmed"),
        "recipient_name":        request.POST.get("recipient_name", "").strip(),
        "recipient_role":        request.POST.get("recipient_role", "").strip(),
        "recipient_signature":   request.POST.get("recipient_signature", "").strip(),
        "recipient_date":        request.POST.get("recipient_date", "").strip(),
        "recipient_confirmed":   request.POST.get("recipient_confirmed"),
        "carrier_name":          request.POST.get("carrier_name", "").strip(),
        "tracking_number":       request.POST.get("tracking_number", "").strip(),
        "transport_mode":        request.POST.get("transport_mode", "").strip(),
        "destination_location":  request.POST.get("destination_location", "").strip(),
        "dispatch_datetime":     request.POST.get("dispatch_datetime", "").strip(),
        "estimated_delivery":    request.POST.get("estimated_delivery", "").strip(),
        "vehicle_plate":         request.POST.get("vehicle_plate", "").strip(),
        "driver_name":           request.POST.get("driver_name", "").strip(),
        "insurance_covered":     request.POST.get("insurance_covered"),
        "customs_cleared":       request.POST.get("customs_cleared"),
    }

    event = _log_event(product, status, location, notes, event_data=event_data)
    if event.tx_status == "error":
        messages.warning(request, "Event saved locally but blockchain write failed.")
    else:
        messages.success(request, f"Event recorded. TX: {event.tx_id[:20]}…")

    return redirect("product_detail", sku=sku)


@require_POST
def add_handover(request, sku):
    product = get_object_or_404(Product, sku=sku)

    outgoing = request.POST.get("outgoing_transporter", "").strip()
    incoming = request.POST.get("incoming_transporter", "").strip()
    location = request.POST.get("handover_location", "").strip() or "Unknown"
    notes    = request.POST.get("qty_discrepancy_note", "").strip()

    if not outgoing or not incoming:
        messages.error(request, "Both outgoing and incoming transporter names are required.")
        return redirect("product_detail", sku=sku)

    event_data = {
        # Core
        "event_name":      "handover",
        "origin_location": location,
        "logistics_notes": notes,
        "goods_name":      product.name,
        "batch_number":    product.sku,

        # Handover-specific
        "qty_dispatched":       request.POST.get("qty_dispatched", "").strip(),
        "qty_received":         request.POST.get("qty_received", "").strip(),
        "qty_discrepancy_note": notes,
        "unit_of_measure":      request.POST.get("unit_of_measure", "").strip(),
        "handover_location":    location,
        "handover_datetime":    request.POST.get("handover_datetime", "").strip(),
        "outgoing_transporter": outgoing,
        "incoming_transporter": incoming,

        # Outgoing transporter → dispatcher fields
        "dispatcher_name":      outgoing,
        "dispatcher_role":      request.POST.get("outgoing_role", "").strip(),
        "dispatcher_signature": request.POST.get("outgoing_signature", "").strip(),
        "dispatcher_date":      request.POST.get("handover_datetime", "").strip(),

        # Incoming transporter → recipient fields
        "recipient_name":       incoming,
        "recipient_role":       request.POST.get("incoming_role", "").strip(),
        "recipient_signature":  request.POST.get("incoming_signature", "").strip(),
        "recipient_date":       request.POST.get("handover_datetime", "").strip(),

        # Logistics
        "carrier_name":    request.POST.get("carrier_name", "").strip(),
        "vehicle_plate":   request.POST.get("vehicle_plate", "").strip(),
        "driver_name":     request.POST.get("driver_name", "").strip(),
        "transport_mode":  request.POST.get("transport_mode", "").strip(),
    }

    event = _log_event(product, "handover", location, notes, event_data=event_data)

    if event.tx_status == "error":
        messages.warning(request, "Handover saved locally but blockchain write failed.")
    else:
        messages.success(request, f"Handover recorded on VeChain. TX: {event.tx_id[:20]}…")

    return redirect("product_detail", sku=sku)


def _log_event(product, status, location, notes="", event_data=None):
    if event_data is None:
        event_data = {}

    def b(key):
        return event_data.get(key) in ("yes", True, "true", "on")

    event = TrackingEvent(
        product          = product,
        status           = status,
        location         = location,
        notes            = notes,
        # Goods
        goods_name       = event_data.get("goods_name",      product.name),
        goods_category   = event_data.get("goods_category",  ""),
        quantity         = event_data.get("quantity",         ""),
        unit_of_measure  = event_data.get("unit_of_measure",  ""),
        batch_number     = event_data.get("batch_number",     product.sku),
        goods_condition  = event_data.get("goods_condition",  ""),
        cold_chain       = b("cold_chain"),
        hazardous        = b("hazardous"),
        # Dispatcher
        dispatcher_name      = event_data.get("dispatcher_name",      ""),
        dispatcher_role      = event_data.get("dispatcher_role",      ""),
        dispatcher_signature = event_data.get("dispatcher_signature", ""),
        dispatcher_date      = event_data.get("dispatcher_date",      ""),
        # Recipient
        recipient_name      = event_data.get("recipient_name",      ""),
        recipient_role      = event_data.get("recipient_role",      ""),
        recipient_signature = event_data.get("recipient_signature", ""),
        recipient_date      = event_data.get("recipient_date",      ""),
        # Logistics
        carrier_name         = event_data.get("carrier_name",         ""),
        transport_mode       = event_data.get("transport_mode",       ""),
        tracking_number      = event_data.get("tracking_number",      ""),
        destination_location = event_data.get("destination_location", ""),
        vehicle_plate        = event_data.get("vehicle_plate",        ""),
        driver_name          = event_data.get("driver_name",          ""),
        insurance_covered    = b("insurance_covered"),
        customs_cleared      = b("customs_cleared"),
        # Handover
        qty_dispatched       = event_data.get("qty_dispatched",       ""),
        qty_received         = event_data.get("qty_received",         ""),
        qty_discrepancy_note = event_data.get("qty_discrepancy_note", ""),
        outgoing_transporter = event_data.get("outgoing_transporter", ""),
        incoming_transporter = event_data.get("incoming_transporter", ""),
        handover_location    = event_data.get("handover_location",    ""),
        handover_datetime    = event_data.get("handover_datetime",    ""),
    )

    try:
        chain           = _get_chain()
        tx_id           = chain.record_tracking_event(event_data)
        event.tx_id     = tx_id
        event.tx_status = "pending"
    except Exception as exc:
        logger.error("VeChain write failed: %s", exc)
        event.tx_status = "error"

    event.save()
    return event


# ── TX status refresh (AJAX / polling) ───────────────────────────────────────

def refresh_tx_status(request, event_id):
    event = get_object_or_404(TrackingEvent, id=event_id)
    if event.tx_id and event.tx_status == "pending":
        try:
            chain       = _get_chain()
            status      = chain.get_tx_status(event.tx_id)
            event.tx_status = status
            event.save(update_fields=["tx_status"])
        except Exception as exc:
            logger.error("TX status check failed: %s", exc)
    return JsonResponse({
        "tx_id":     event.tx_id,
        "tx_status": event.tx_status,
    })


def interface_view(request):
    return render(request, "interface.html")

def events_view(request):
    return render(request, "events.html")
from django.shortcuts import render
from django.contrib.auth.decorators import login_required


# Create your views here.

@login_required
def profile_view(request):
    return render(request, 'interface.html')

def CreateUser_view(request):
    if request.method != "POST":
        return render(request, 'index.html')
        
    u_n = request.POST.get('username', '').strip()
    e = request.POST.get('email', '').strip()
    p = request.POST.get('password')
    ph = request.POST.get('phonenumber')
    u_type = request.POST.get('user_type')
    
    f_n, s_n, m_n = "", "", ""
    org_name = None

    if not e:
        messages.error(request, "An email address is required.")
        return render(request, 'index.html')
        
    if User.objects.filter(email__iexact=e).exists():
        messages.error(request, "A user with this email address already exists.")
        return render(request, 'index.html')

    if u_type == 'NORMAL':
        f_n = request.POST.get('firstname', '')
        s_n = request.POST.get('lastname', '')
        m_n = request.POST.get('middlename', '')
        if not s_n:
            messages.error(request, "Last name is required.")
            return render(request, 'index.html')
            
    elif u_type == 'ORGANISATION':
        org_name = request.POST.get('organisation_name', '').strip()
        if not org_name:
            messages.error(request, "Organisation name is required.")
            return render(request, 'index.html')
        
        if not u_n:
            u_n = org_name.replace(" ", "").lower()
            
        # Loop guarantees uniqueness if the first random number choice clashes
        while User.objects.filter(username=u_n).exists():
            u_n = f"{org_name.replace(' ', '').lower()}{random.randint(100, 999)}"

    # Check manual usernames picked by normal users or fallback org names
    if User.objects.filter(username=u_n).exists():
        messages.error(request, f"The username '{u_n}' is already taken. Please choose another one.")
        return render(request, 'index.html')

    try:
        User.objects.create_user(
            username=u_n,
            email=e,
            password=p,
            user_type=u_type,
            first_name=f_n,
            second_name=s_n,
            middle_name=m_n,
            phonenumber=ph,
            organisation_name=org_name
        )
        return redirect('login')
    except Exception as error:
        messages.error(request, f"Database registration failed: {error}")
        return render(request, 'index.html')


def Login_view(request):
    if request.method == "POST":
        email_input = request.POST.get('email', '').strip()
        password_input = request.POST.get('password')
        
        user = authenticate(request, username=email_input, password=password_input)
        if user is not None:
            login(request, user)
            messages.success(request, "Logged in successfully!")
            return redirect('interface')
        else:
            messages.error(request, "Invalid email or password.")
            return render(request, 'login.html', {'error': 'Invalid email or password.'})
            
    return render(request, 'login.html')

def interface_view(request):
    products = Product.objects.prefetch_related("events").order_by("-created_at")
    recent_events = TrackingEvent.objects.select_related("product").order_by("-timestamp")[:20]
    return render(request, "interface.html", {
        "products":      products,
        "recent_events": recent_events,
        "total_products": products.count(),
        "total_events":   TrackingEvent.objects.count(),
        "pending_tx":     TrackingEvent.objects.filter(tx_status="pending").count(),
        "confirmed_tx":   TrackingEvent.objects.filter(tx_status="confirmed").count(),
    })

def events_view(request):
    return render(request, "events.html")


@csrf_exempt
@require_POST
def add_event_api(request):
    if request.content_type and 'application/json' in request.content_type:
        import json
        try:
            event_data = json.loads(request.body)
        except json.JSONDecodeError as e:
            return JsonResponse({"error": "Invalid JSON body.", "detail": str(e)}, status=400)
    else:
        event_data = {key: request.POST.get(key, '') for key in request.POST}

    sku = event_data.get("batch_number", "").strip()
    if not sku:
        goods    = event_data.get("goods_name", "GOODS").strip().replace(" ", "-").upper()
        event_id = event_data.get("event_id", "").strip().replace(" ", "-").upper()
        sku      = f"{goods}-{event_id}"

    product, created = Product.objects.get_or_create(
        sku=sku,
        defaults={
            "name":         event_data.get("goods_name", sku),
            "description":  event_data.get("short_description", ""),
            "manufacturer": event_data.get("dispatcher_name", ""),
        }
    )

    status   = event_data.get("event_name", "unknown")
    location = event_data.get("origin_location", "")
    notes    = event_data.get("logistics_notes", "")

    event = _log_event(product, status, location, notes, event_data=event_data)

    return JsonResponse({
        "ok":        True,
        "event_id":  event.id,
        "tx_id":     event.tx_id,
        "tx_status": event.tx_status,
    }, status=201)
