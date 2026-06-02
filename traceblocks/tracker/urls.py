from django.urls import path
from . import views
from . import api_views
from django.contrib.auth import views as auth_views

urlpatterns = [

    # ── Web UI ────────────────────────────────────────────────────────────────
    path("createuser/",                   views.CreateUser_view,   name="createuser"),
    path("",                              views.Login_view,        name="login"),
    path("logout/",                       auth_views.LogoutView.as_view(next_page="login"), name="logout"),
    path("interface/",                    views.interface_view,    name="interface"),
    path("new/event/",                    views.events_view,       name="events"),
    path("profile/",                      views.profile_view,      name="profile"),
    path("terms/",                        views.terms_view,        name="terms"),
    path("privacy/",                      views.privacy_view,      name="privacy"),

    # ── Products & events (web) ───────────────────────────────────────────────
    path("products/new/",                 views.create_product,    name="create_product"),
    path("products/<str:sku>/",           views.product_detail,    name="product_detail"),
    path("products/<str:sku>/events/",    views.add_event,         name="add_event"),
    path("products/<str:sku>/handover/",  views.add_handover,      name="add_handover"),
    path("events/<int:event_id>/status/", views.refresh_tx_status, name="refresh_tx_status"),

    # ── Legacy API ────────────────────────────────────────────────────────────
    path("api/events/",                   views.add_event_api,     name="add_event_api"),

    # ── Mobile companion API — auth & profile ─────────────────────────────────
    path("api/mobile/login/",                  api_views.mobile_login,           name="mobile_login"),
    path("api/mobile/auth/profile/",           api_views.mobile_get_profile,     name="mobile_get_profile"),
    path("api/mobile/auth/update-profile/",    api_views.mobile_update_profile,  name="mobile_update_profile"),
    path("api/mobile/auth/change-password/",   api_views.mobile_change_password, name="mobile_change_password"),
    path("api/mobile/auth/sessions/",          api_views.mobile_logout_all,      name="mobile_logout_all"),

    # ── Mobile companion API — products & events ──────────────────────────────
    path("api/mobile/products/",               api_views.mobile_products,        name="mobile_products"),
    path("api/mobile/products/create/",        api_views.mobile_create_product,  name="mobile_create_product"),
    path("api/mobile/qr/<str:qr_token>/",      api_views.mobile_qr_resolve,      name="mobile_qr_resolve"),
    path("api/mobile/log/",                    api_views.mobile_log_event,       name="mobile_log_event"),
    path("api/mobile/handover/",               api_views.mobile_log_handover,    name="mobile_log_handover"),
    path("api/mobile/events/<str:sku>/",       api_views.mobile_event_history,   name="mobile_event_history"),
]