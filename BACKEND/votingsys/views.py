from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RegisterSerializer
from rest_framework_simplejwt.tokens import RefreshToken

class RegisterView(APIView):

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            #create JWT token manually
            refresh = RefreshToken.for_user(user)

            return Response({"message": "user registered ",
                             "refresh": str(refresh),
                             "access": str(refresh.access_token)},
                              status=status.HTTP_201_CREATED
                            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

"""
The logic for login is already handled by default by django rest)framework_simplejwt
"""