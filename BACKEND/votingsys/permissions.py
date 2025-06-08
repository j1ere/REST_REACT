from rest_framework import permissions
from django.db import connection 


class IsAdminUser(permissions.BasePermission):
    """
    allows access to only admin (staff) users
    """
    def has_permission(self, request, view):
        #check is the user is authenticated and is admin
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)

class HasNotVoted(permissions.BasePermission):
    """
    ensure the user has not voted
    """ 
    def has_permission(self, request, view):
        user_id = request.username

        #if the user is not authenticated, deny access
        if not request.user.is_authenticated:
            return False
        
        #query the votes table to check whether the user has already voted
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM Votes WHERE voter_id = %s", [user_id])
            result = cursor.fetchone()

            #means if the result > 0 user has already voted and should be denied access to vote
            return result[0]==0


