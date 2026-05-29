import logging
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Product, TrackingEvent
from .blockchain import VeChainService

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

    # Record the "manufactured" event on-chain immediately
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

    # Collect all extra fields from the TraceBlocks form if present
    event_data = {
        # Core fields always populated
        "event_name":        status,
        "origin_location":   location,
        "logistics_notes":   notes,

        # Identity
        "user_id":           request.POST.get("user_id", "").strip(),
        "full_name":         request.POST.get("full_name", "").strip(),

        # Event
        "event_id":              request.POST.get("event_id", "").strip(),
        "short_description":     request.POST.get("short_description", "").strip(),
        "detailed_explanation":  request.POST.get("detailed_explanation", "").strip(),
        "exceptions_noted":      request.POST.get("exceptions_noted"),
        "regulatory_flag":       request.POST.get("regulatory_flag"),
        "quality_check_passed":  request.POST.get("quality_check_passed"),
        "needs_detail":          request.POST.get("needs_detail"),

        # Goods
        "goods_name":       request.POST.get("goods_name", "").strip(),
        "goods_category":   request.POST.get("goods_category", "").strip(),
        "quantity":         request.POST.get("quantity", "").strip(),
        "unit_of_measure":  request.POST.get("unit_of_measure", "").strip(),
        "batch_number":     request.POST.get("batch_number", "").strip(),
        "goods_condition":  request.POST.get("goods_condition", "").strip(),
        "cold_chain":       request.POST.get("cold_chain"),
        "hazardous":        request.POST.get("hazardous"),

        # Dispatcher
        "dispatcher_name":       request.POST.get("dispatcher_name", "").strip(),
        "dispatcher_role":       request.POST.get("dispatcher_role", "").strip(),
        "dispatcher_signature":  request.POST.get("dispatcher_signature", "").strip(),
        "dispatcher_date":       request.POST.get("dispatcher_date", "").strip(),
        "dispatcher_confirmed":  request.POST.get("dispatcher_confirmed"),

        # Recipient
        "recipient_name":       request.POST.get("recipient_name", "").strip(),
        "recipient_role":       request.POST.get("recipient_role", "").strip(),
        "recipient_signature":  request.POST.get("recipient_signature", "").strip(),
        "recipient_date":       request.POST.get("recipient_date", "").strip(),
        "recipient_confirmed":  request.POST.get("recipient_confirmed"),

        # Logistics
        "carrier_name":       request.POST.get("carrier_name", "").strip(),
        "tracking_number":    request.POST.get("tracking_number", "").strip(),
        "transport_mode":     request.POST.get("transport_mode", "").strip(),
        "destination_location": request.POST.get("destination_location", "").strip(),
        "dispatch_datetime":  request.POST.get("dispatch_datetime", "").strip(),
        "estimated_delivery": request.POST.get("estimated_delivery", "").strip(),
        "vehicle_plate":      request.POST.get("vehicle_plate", "").strip(),
        "driver_name":        request.POST.get("driver_name", "").strip(),
        "insurance_covered":  request.POST.get("insurance_covered"),
        "customs_cleared":    request.POST.get("customs_cleared"),
    }

    event = _log_event(product, status, location, notes, event_data=event_data)
    if event.tx_status == "error":
        messages.warning(request, "Event saved locally but blockchain write failed.")
    else:
        messages.success(request, f"Event recorded. TX: {event.tx_id[:20]}…")

    return redirect("product_detail", sku=sku)


def _log_event(product, status, location, notes="", event_data=None):
    """Create a TrackingEvent and broadcast it to VeChain."""
    event = TrackingEvent(
        product=product,
        status=status,
        location=location,
        notes=notes,
    )

    # Build the event_data dict that blockchain.py expects.
    # Callers can pass a fully-populated dict (e.g. from add_event);
    # internal calls like create_product pass nothing and get sensible defaults.
    if event_data is None:
        event_data = {
            "event_name":      status,
            "origin_location": location,
            "logistics_notes": notes,
            "goods_name":      product.name,
            "goods_category":  getattr(product, "category", ""),
            "batch_number":    product.sku,
            "dispatcher_name": location,   # manufacturer/location acts as dispatcher
        }

    try:
        chain  = _get_chain()
        tx_id  = chain.record_tracking_event(event_data)   # ← single dict arg
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
            chain  = _get_chain()
            status = chain.get_tx_status(event.tx_id)
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

@csrf_exempt
@require_POST
def add_event_api(request):
    # Accept both JSON and form-encoded submissions
    if request.content_type and 'application/json' in request.content_type:
        import json
        try:
            event_data = json.loads(request.body)
        except json.JSONDecodeError as e:
            return JsonResponse({"error": "Invalid JSON body.", "detail": str(e)}, status=400)
    else:
        # Standard HTML form submission
        event_data = {key: request.POST.get(key, '') for key in request.POST}

    # Resolve the product by SKU or batch_number
    sku = event_data.get("batch_number", "").strip()
    if not sku:
        # Fall back to generating one from goods_name + event_id
        goods = event_data.get("goods_name", "GOODS").strip().replace(" ", "-").upper()
        event_id = event_data.get("event_id", "").strip().replace(" ", "-").upper()
        sku = f"{goods}-{event_id}"

    # Get or create the product
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