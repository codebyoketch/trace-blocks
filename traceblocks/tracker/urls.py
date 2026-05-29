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
 
urlpatterns = [
    path("",                              views.index,            name="index"),
    path("products/new/",                 views.create_product,   name="create_product"),
    path("products/<str:sku>/",           views.product_detail,   name="product_detail"),
    path("products/<str:sku>/events/",    views.add_event,        name="add_event"),
    path("events/<int:event_id>/status/", views.refresh_tx_status,name="refresh_tx_status"),
]
 
>>>>>>> origin/blockchain
