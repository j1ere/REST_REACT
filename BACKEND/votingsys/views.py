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
        

from .permissions import HasNotVoted, IsAdminUser
class VoteView(APIView):
    permission_classes= [IsAuthenticated, HasNotVoted]

    def post(self, request):
        user = request.user

        aspirant_id = request.data.get("aspirant_id")

        if not aspirant_id:
            return Response({"error": "aspirant id required"}, status=status.HTTP_400_BAD_REQUEST)
        
        

        with connection.cursor() as cursor:
            # #check whether user has already voted
            # cursor.execute("SELECT 1 FROM Votes WHERE voter_id= %s", [user.username])
            # if cursor.fetchone():
            #     return Response({"error": "you have already voted"}, status=status.HTTP_400_BAD_REQUEST)

            #check if aspirant exists
            cursor.execute("SELECT 1 FROM Aspirants WHERE id_number=%s", [aspirant_id])
            if not cursor.fetchone():
                return Response({"error": "aspirant DOES NOT exist"}, status=status.HTTP_404_NOT_FOUND)
            #vote 
            cursor.execute("INSERT INTO Votes (voter_id, aspirant_id) VALUES (%s, %s)", [user.username, aspirant_id])
            return Response({"message": "voting successful"}, status=status.HTTP_201_CREATED)
                

class HasVotedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        with connection.cursor() as cursor:
            cursor.execute("SELECT aspirant_id FROM Votes WHERE voter_id=%s", [user.username])

            result = cursor.fetchone()
            
            if result:
                return Response({"has voted": True, "candidate voted for": result[0] })
            return Response({"has voted": False})
            


class VoteResultsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT a.full_name, COUNT(v.voter_id) as vote_count FROM Aspirants a 
                LEFT JOIN Votes v ON a.id_number=v.aspirant_id 
                GROUP BY a.full_name ORDER BY vote_count DESC  
            """)
            
            results = cursor.fetchall()

        response_data = [{"name": full_name, "votes": vote_count} for full_name, vote_count in results]
        return Response(response_data)