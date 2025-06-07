from django.contrib.auth.models import User
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2']
        extra_kwargs = { 'email': {'required': True} }

    def validate(self, attrs):
        if attrs['password'] == attrs['password2']:
            raise serializers.ValidationError({'password': 'passwords do not match'})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')#removing password2 from the validated_data dictionary since its only used to confirm correct password
        user = User.objects.create_user(**validated_data)# this line unpacks the dictionary into keyword arguments 
        return user
    #validated_data is a dictionary of cleaned and validated form data passed from a serializer
    """
    validated_data={
        'username': '12345',
        'email': 'john@example.com',
        'password': 'pass123',
        'password2': 'pass123'
    }

    user = User.objects.create_user(**validated_data) #this line is equivalent to : User.objects.create_user(
    username="john123",
    email="john@example.com",
    password="securepassword"
)


you use ** when: you have a dictionary whose data matches
 the expected parameter names of a function or method
 and you want to pass those key-value pairs as individual keyword arguments
    """
    