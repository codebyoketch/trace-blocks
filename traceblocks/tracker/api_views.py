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