from django.db import models
from django.contrib.auth.models import AbstractUser

class Product(models.Model):
    name         = models.CharField(max_length=200)
    sku          = models.CharField(max_length=100, unique=True)
    description  = models.TextField(blank=True)
    manufacturer = models.CharField(max_length=200)
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.sku})"

    def current_status(self):
        event = self.events.order_by("-timestamp").first()
        return event.status if event else "unknown"


class TrackingEvent(models.Model):
    STATUS_CHOICES = [
        ("manufactured", "Manufactured"),
        ("shipped",      "Shipped"),
        ("in_transit",   "In Transit"),
        ("at_hub",       "At Hub"),
        ("out_for_delivery", "Out for Delivery"),
        ("delivered",    "Delivered"),
    ]

    product   = models.ForeignKey(Product, on_delete=models.CASCADE,
                                  related_name="events")
    status    = models.CharField(max_length=50, choices=STATUS_CHOICES)
    location  = models.CharField(max_length=200)
    notes     = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    # VeChain fields
    tx_id     = models.CharField(max_length=100, blank=True, db_index=True)
    tx_status = models.CharField(max_length=20, default="pending")
    # pending | confirmed | reverted | error

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.product.sku} — {self.status} @ {self.location}"

    @property
    def explorer_url(self):
        if self.tx_id:
            return (
                f"https://explore-testnet.vechain.org/transactions/{self.tx_id}"
            )
        return ""
