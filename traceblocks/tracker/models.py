from django.db import models
from django.contrib.auth.models import AbstractUser

# Create your models here.

class NormalUsers(AbstractUser):
    first_name = models.CharField(max_length=100, blank=False)
    last_name = models.CharField(max_length=100, blank=False)
    middle_name = models.CharField(max_length=100, blank=True)
    phonenumber = models.CharField(max_length=15)


