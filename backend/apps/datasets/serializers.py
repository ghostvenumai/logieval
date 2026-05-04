from rest_framework import serializers
from .models import Dataset, TestCase


class TestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = ['id', 'input_variables', 'expected_output', 'tags', 'created_at']
        read_only_fields = ['created_at']


class DatasetSerializer(serializers.ModelSerializer):
    test_case_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Dataset
        fields = ['id', 'name', 'description', 'test_case_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class DatasetDetailSerializer(serializers.ModelSerializer):
    test_cases = TestCaseSerializer(many=True, read_only=True)
    test_case_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Dataset
        fields = ['id', 'name', 'description', 'test_case_count', 'test_cases', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
