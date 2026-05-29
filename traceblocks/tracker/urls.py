from django.urls import path
<<<<<<< HEAD
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path('login/', auth_views.LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('account/', views.profile_view, name ='profile')
]
=======
from . import views
from django.contrib.auth import views as auth_views

urlpatterns = [
<<<<<<< HEAD
    path("",                              views.index,            name="index"),
    path("products/new/",                 views.create_product,   name="create_product"),
    path("products/<str:sku>/",           views.product_detail,   name="product_detail"),
    path("products/<str:sku>/events/",    views.add_event,        name="add_event"),
    path("events/<int:event_id>/status/", views.refresh_tx_status,name="refresh_tx_status"),
]
 
>>>>>>> origin/blockchain
=======
    path("index",                                views.index,            name="index"),
    path("",                                     auth_views.LoginView.as_view(template_name="login.html"), name="login"),
    path("logout/",                              auth_views.LogoutView.as_view(next_page="index"), name="logout"),
    path("products/new/",                        views.create_product,   name="create_product"),
    path("products/<str:sku>/",                  views.product_detail,   name="product_detail"),
    path("products/<str:sku>/events/",           views.add_event,        name="add_event"),
    path("events/<int:event_id>/status/",        views.refresh_tx_status,name="refresh_tx_status"),
    path("interface/",                           views.interface_view,   name="interface"),
    path("new/events/",                          views.events_view,      name="events"),
    path("api/events/",                          views.add_event_api,    name="add_event_api"),
    path("products/<str:sku>/handover/",         views.add_handover,     name="add_handover"),
]
>>>>>>> origin/blockchain
