from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RegisterSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from rest_framework.permissions import IsAuthenticated
from django.db import connection
from django.db import transaction

class RegisterView(APIView):

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                user = serializer.save() #this uses the create() in serializer to save the user to the database

                try:
                    with connection.cursor() as cursor:
                        cursor.execute("INSERT INTO Users (id_number, email, full_name) VALUES (%s, %s, %s)", [user.username, user.email, user.first_name])
                except Exception as e:
                    return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM Aspirants WHERE id_number = %s", [user.username])

            if cursor.fetchone():
                return Response({"error": "user is already registered as an aspirant"}, status=status.HTTP_400_BAD_REQUEST)
            

            name = request.data.get("name")
            if not name:
                return Response({"error": "aspirant name is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            cursor.execute("INSERT INTO Aspirants (id_number, full_name) VALUES (%s, %s)", [user.username, name])
            return Response({"message": "aspirant registered successfully "}, status=status.HTTP_201_CREATED)