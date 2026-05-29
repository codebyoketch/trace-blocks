from django.urls import path
from . import views
from django.contrib.auth import views as auth_views
 
urlpatterns = [
    path("index",                              views.index,            name="index"),
    path("login/",                        auth_views.LoginView.as_view(template_name="login.html"), name="login"),
    path("logout/",                       auth_views.LogoutView.as_view(next_page="index"), name="logout"),
    path("products/new/",                 views.create_product,   name="create_product"),
    path("products/<str:sku>/",           views.product_detail,   name="product_detail"),
    path("products/events/",    views.add_event,        name="add_event"),
    path("events/<int:event_id>/status/", views.refresh_tx_status,name="refresh_tx_status"),
    path("interface/",                    views.interface_view,   name="interface"),
    path("new/event/", views.events_view, name="events"),
    path("", views.CreateUser_view, name="createuser")
]
 
