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
        ("manufactured",     "Manufactured"),
        ("shipped",          "Shipped"),
        ("in_transit",       "In Transit"),
        ("at_hub",           "At Hub"),
        ("out_for_delivery", "Out for Delivery"),
        ("delivered",        "Delivered"),
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

    # Goods
    goods_name      = models.CharField(max_length=200, blank=True)
    goods_category  = models.CharField(max_length=100, blank=True)
    quantity        = models.CharField(max_length=50,  blank=True)
    unit_of_measure = models.CharField(max_length=50,  blank=True)
    batch_number    = models.CharField(max_length=100, blank=True)
    goods_condition = models.CharField(max_length=50,  blank=True)
    cold_chain      = models.BooleanField(default=False)
    hazardous       = models.BooleanField(default=False)

    # Dispatcher
    dispatcher_name      = models.CharField(max_length=200, blank=True)
    dispatcher_role      = models.CharField(max_length=200, blank=True)
    dispatcher_signature = models.CharField(max_length=200, blank=True)
    dispatcher_date      = models.CharField(max_length=50,  blank=True)

    # Recipient
    recipient_name      = models.CharField(max_length=200, blank=True)
    recipient_role      = models.CharField(max_length=200, blank=True)
    recipient_signature = models.CharField(max_length=200, blank=True)
    recipient_date      = models.CharField(max_length=50,  blank=True)

    # Logistics
    carrier_name          = models.CharField(max_length=200, blank=True)
    transport_mode        = models.CharField(max_length=100, blank=True)
    tracking_number       = models.CharField(max_length=100, blank=True)
    destination_location  = models.CharField(max_length=200, blank=True)
    vehicle_plate         = models.CharField(max_length=50,  blank=True)
    driver_name           = models.CharField(max_length=200, blank=True)
    insurance_covered     = models.BooleanField(default=False)
    customs_cleared       = models.BooleanField(default=False)

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

class User(AbstractUser):
    TYPE_NORMAL = 'NORMAL'
    TYPE_ORG = 'ORGANISATION'
    
    USER_TYPE_CHOICES = [
        (TYPE_NORMAL, 'Normal User'),
        (TYPE_ORG, 'Organisation User'),
    ]

    user_type = models.CharField(
        max_length=20, 
        choices=USER_TYPE_CHOICES, 
        default=TYPE_NORMAL
    )
    
    #Fields for Normal users
    first_name = models.CharField(max_length=100, blank=True)
    second_name = models.CharField(max_length=100, blank=False) 
    middle_name = models.CharField(max_length=100, blank=True)
    phonenumber = models.CharField(max_length=15, blank=True, null=True)
    
    #Fields for Organisation users
    organisation_name = models.CharField(max_length=100, blank=False, null=True)
    
    def get_transaction_url(self):
        return f"https://explore-testnet.vechain.org/transactions/{self.tx_id}"
            
    
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
        ("manufactured",     "Manufactured"),
        ("shipped",          "Shipped"),
        ("in_transit",       "In Transit"),
        ("at_hub",           "At Hub"),
        ("out_for_delivery", "Out for Delivery"),
        ("delivered",        "Delivered"),
        ("handover",         "Handover"),
    ]

    product   = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="events")
    status    = models.CharField(max_length=50, choices=STATUS_CHOICES)
    location  = models.CharField(max_length=200)
    notes     = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    # VeChain
    tx_id     = models.CharField(max_length=100, blank=True, db_index=True)
    tx_status = models.CharField(max_length=20, default="pending")

    # Goods
    goods_name      = models.CharField(max_length=200, blank=True)
    goods_category  = models.CharField(max_length=100, blank=True)
    quantity        = models.CharField(max_length=50,  blank=True)
    unit_of_measure = models.CharField(max_length=50,  blank=True)
    batch_number    = models.CharField(max_length=100, blank=True)
    goods_condition = models.CharField(max_length=50,  blank=True)
    cold_chain      = models.BooleanField(default=False)
    hazardous       = models.BooleanField(default=False)

    # Dispatcher (outgoing transporter)
    dispatcher_name      = models.CharField(max_length=200, blank=True)
    dispatcher_role      = models.CharField(max_length=200, blank=True)
    dispatcher_signature = models.CharField(max_length=200, blank=True)
    dispatcher_date      = models.CharField(max_length=50,  blank=True)

    # Recipient (incoming transporter / receiver)
    recipient_name      = models.CharField(max_length=200, blank=True)
    recipient_role      = models.CharField(max_length=200, blank=True)
    recipient_signature = models.CharField(max_length=200, blank=True)
    recipient_date      = models.CharField(max_length=50,  blank=True)

    # Logistics
    carrier_name         = models.CharField(max_length=200, blank=True)
    transport_mode       = models.CharField(max_length=100, blank=True)
    tracking_number      = models.CharField(max_length=100, blank=True)
    destination_location = models.CharField(max_length=200, blank=True)
    vehicle_plate        = models.CharField(max_length=50,  blank=True)
    driver_name          = models.CharField(max_length=200, blank=True)
    insurance_covered    = models.BooleanField(default=False)
    customs_cleared      = models.BooleanField(default=False)

    # Handover-specific
    qty_dispatched       = models.CharField(max_length=50, blank=True)
    qty_received         = models.CharField(max_length=50, blank=True)
    qty_discrepancy_note = models.TextField(blank=True)
    outgoing_transporter = models.CharField(max_length=200, blank=True)
    incoming_transporter = models.CharField(max_length=200, blank=True)
    handover_location    = models.CharField(max_length=200, blank=True)
    handover_datetime    = models.CharField(max_length=50,  blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.product.sku} — {self.status} @ {self.location}"

    @property
    def explorer_url(self):
        if self.tx_id:
            return f"https://insight.vecha.in/#/test/txs/{self.tx_id}"
        return ""
