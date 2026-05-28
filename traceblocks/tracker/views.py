import logging
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.views.decorators.http import require_POST
from django.http import JsonResponse

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

    event = _log_event(product, status, location, notes)
    if event.tx_status == "error":
        messages.warning(request, "Event saved locally but blockchain write failed.")
    else:
        messages.success(request, f"Event recorded. TX: {event.tx_id[:20]}…")

    return redirect("product_detail", sku=sku)


def _log_event(product, status, location, notes=""):
    """Create a TrackingEvent and broadcast it to VeChain."""
    event = TrackingEvent(
        product=product,
        status=status,
        location=location,
        notes=notes,
    )
    try:
        chain  = _get_chain()
        tx_id  = chain.record_tracking_event(product.sku, status, location, notes)
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
