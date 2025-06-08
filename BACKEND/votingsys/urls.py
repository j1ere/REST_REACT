from django.urls import path
from rest_framework_simplejwt.views import (TokenObtainPairView, TokenRefreshView)
from .views import RegisterView, RegisterAspirantView, VoteView, HasVotedView

urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='register_view'),
    path('register-aspirant/', RegisterAspirantView.as_view(), name='register-aspirant'),
    path('vote/', VoteView.as_view(), name='vote-view'),
    path('has-voted/', HasVotedView.as_view(), name='has-voted'),

]

