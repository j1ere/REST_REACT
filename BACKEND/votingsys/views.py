from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RegisterSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from rest_framework.permissions import IsAuthenticated
from django.db import connection


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

class RegisterAspirantView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        #check if the user is already an aspirant
        with connection.cursor as cursor:
            cursor.execute("SELECT 1 FROM Aspirants WHERE id_number = %s", [user.username])

            if cursor.fetchone():
                return Response({"error": "user is already registered as an aspirant"}, status=status.HTTP_400_BAD_REQUEST)
            

            name = request.data.get("name")
            if not name:
                return Response({"error": "aspirant name is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            cursor.execute("INSERT INTO Aspirants (id_number, name) VALUES (%s, %s)", [user.username, name])
            return Response({"message": "aspirant registered successfully "}, status=status.HTTP_201_CREATED)