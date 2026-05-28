from django.db import models
from django.contrib.auth.models import AbstractUser


# Create your models here.

from django.db import models
from django.contrib.auth.models import AbstractUser

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
