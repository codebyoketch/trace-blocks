from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        email = username or kwargs.get('email')
        if email:
            try:
                user = UserModel.objects.get(email__iexact=email)
            except UserModel.DoesNotExist:
                return None
        else:
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
