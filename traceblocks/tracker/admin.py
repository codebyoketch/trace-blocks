from django.contrib import admin

from .models import Product, TrackingEvent
 
 
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display  = ("sku", "name", "manufacturer", "current_status", "created_at")
    search_fields = ("sku", "name", "manufacturer")
 
 
@admin.register(TrackingEvent)
class TrackingEventAdmin(admin.ModelAdmin):
    list_display  = ("product", "status", "location", "tx_status", "tx_id", "timestamp")
    list_filter   = ("status", "tx_status")
    search_fields = ("product__sku", "location", "tx_id")
    readonly_fields = ("tx_id", "tx_status", "timestamp")
