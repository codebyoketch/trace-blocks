import logging
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.views.decorators.http import require_POST
from django.http import JsonResponse
import random
from django.contrib.auth import authenticate, login

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

from django.shortcuts import render, redirect
from django.contrib import messages
from .models import User 

from django.shortcuts import render, redirect
from django.contrib import messages
from .models import User 

import random
from django.shortcuts import render, redirect
from django.contrib import messages
from .models import User 

def CreateUser_view(request):
    if request.method == "POST":
        u_n = request.POST.get('username', '').strip()
        e = request.POST.get('email', '').strip()
        p = request.POST.get('password')
        ph = request.POST.get('phonenumber')
        u_type = request.POST.get('user_type')

        f_n, s_n, m_n = "", "", ""
        org_name = None

        if u_type == 'NORMAL':
            f_n = request.POST.get('firstname', '')
            s_n = request.POST.get('lastname', '') 
            m_n = request.POST.get('middlename', '')
            
            if not s_n:
                messages.error(request, "Last name is required.")
                return render(request, 'user_creation_form_v2.html')
                
        elif u_type == 'ORGANISATION':
            org_name = request.POST.get('organisation_name', '').strip()
            if not org_name:
                messages.error(request, "Organisation name is required.")
                return render(request, 'user_creation_form_v2.html')
            
            # Auto-generate username from org name if field was left blank
            if not u_n:
                u_n = org_name.replace(" ", "").lower()

        # FIX 1: If it's an organization and username exists, make it unique dynamically
        if u_type == 'ORGANISATION' and User.objects.filter(username=u_n).exists():
            u_n = f"{u_n}{random.randint(100, 999)}"

        # FIX 2: If a normal user manually picks an existing username, reject it safely
        if User.objects.filter(username=u_n).exists():
            messages.error(request, f"The username '{u_n}' is already taken. Please choose another one.")
            return render(request, 'index.html')

        # FIX 3: Check for duplicate emails while we are here
        if User.objects.filter(email=e).exists():
            messages.error(request, "A user with this email address already exists.")
            return render(request, 'index.html')
            # Inside your CreateUser_view registration endpoint:
        
        if not e:
            messages.error(request, "An email address is required.")
            return render(request, 'user_creation_form_v2.html')

        if User.objects.filter(email__iexact=e).exists():
            messages.error(request, "A user with this email address already exists.")
            return render(request, 'user_creation_form_v2.html')


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

        # Pass email into the username parameter—our backend handles the rest
        user = authenticate(request, username=email_input, password=password_input)

        if user is not None:
            login(request, user)
            messages.success(request, "Logged in successfully!")
            return redirect('dashboard')  # Redirect to your landing dashboard page
        else:
            messages.error(request, "Invalid email or password.")
            return render(request, 'login.html')

    return render(request, 'login.html')