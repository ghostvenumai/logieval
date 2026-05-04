from rest_framework import serializers
from .models import Prompt, PromptVersion


class PromptVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromptVersion
        fields = ['id', 'version_number', 'system_prompt', 'user_template', 'notes', 'is_active', 'created_at']
        read_only_fields = ['version_number', 'created_at']


class PromptSerializer(serializers.ModelSerializer):
    latest_version = PromptVersionSerializer(read_only=True)
    version_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Prompt
        fields = ['id', 'name', 'description', 'version_count', 'latest_version', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class PromptDetailSerializer(serializers.ModelSerializer):
    versions = PromptVersionSerializer(many=True, read_only=True)
    version_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Prompt
        fields = ['id', 'name', 'description', 'version_count', 'versions', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
