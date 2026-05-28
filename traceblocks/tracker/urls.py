from django.urls import path
from . import views
 
urlpatterns = [
    path("",                              views.index,            name="index"),
    path("products/new/",                 views.create_product,   name="create_product"),
    path("products/<str:sku>/",           views.product_detail,   name="product_detail"),
    path("products/<str:sku>/events/",    views.add_event,        name="add_event"),
    path("events/<int:event_id>/status/", views.refresh_tx_status,name="refresh_tx_status"),
]
 