from django.db import models

class Batch(models.Model):
    """A product batch entering the supply chain."""
    name        = models.CharField(max_length=255)  # e.g. "Tilapia - Lake Victoria, 50kg"
    origin      = models.CharField(max_length=255)  # farm/village name
    producer    = models.CharField(max_length=255)
    created_at  = models.DateTimeField(auto_now_add=True)
    tx_id       = models.CharField(max_length=66, blank=True)
    on_chain    = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class Checkpoint(models.Model):
    """Each step in the chain: processing, transport, retail."""
    STAGES = [
        ("harvest",   "Harvest"),
        ("process",   "Processing"),
        ("transport", "Transport"),
        ("retail",    "Retail"),
    ]
    batch      = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="checkpoints")
    stage      = models.CharField(max_length=20, choices=STAGES)
    location   = models.CharField(max_length=255)
    handler    = models.CharField(max_length=255)
    notes      = models.TextField(blank=True)
    timestamp  = models.DateTimeField(auto_now_add=True)
    tx_id      = models.CharField(max_length=66, blank=True)
    on_chain   = models.BooleanField(default=False)