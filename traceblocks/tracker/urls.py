from django.urls import path
from . import views
from django.contrib.auth import views as auth_views

urlpatterns = [
    path("index",views.index,name="index"),
     path("login/",views.Login_view, name="login"),
    path("logout/",auth_views.LogoutView.as_view(next_page="index"), name="logout"),
    path("products/new/",views.create_product,name="create_product"),
    path("products/<str:sku>/",views.product_detail,name="product_detail"),
    path("products/<str:sku>/events/",views.add_event,name="add_event"),
    path("events/<int:event_id>/status/", views.refresh_tx_status,name="refresh_tx_status"),
    path("interface/",views.interface_view,   name="interface"),
    path("new/event/", views.events_view, name="events"),
    path("", views.CreateUser_view, name="createuser"),
    path("api/events/",views.add_event_api,name="add_event_api"),
    path("products/<str:sku>/handover/",views.add_handover,name="add_handover"),
    path('profile/', views.profile_view, name="profile")
]
