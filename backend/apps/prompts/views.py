from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Prompt, PromptVersion
from .serializers import PromptSerializer, PromptDetailSerializer, PromptVersionSerializer


class PromptViewSet(viewsets.ModelViewSet):
    queryset = Prompt.objects.all()

    def get_serializer_class(self):
        if self.action in ('retrieve', 'versions'):
            return PromptDetailSerializer
        return PromptSerializer

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        prompt = self.get_object()
        versions = prompt.versions.all()
        return Response(PromptVersionSerializer(versions, many=True).data)

    @action(detail=True, methods=['post'])
    def add_version(self, request, pk=None):
        prompt = self.get_object()
        serializer = PromptVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(prompt=prompt)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path=r'(?P<prompt_id>\d+)/diff/(?P<v1>\d+)/(?P<v2>\d+)')
    def diff(self, request, prompt_id=None, v1=None, v2=None):
        try:
            version1 = PromptVersion.objects.get(prompt_id=prompt_id, version_number=v1)
            version2 = PromptVersion.objects.get(prompt_id=prompt_id, version_number=v2)
        except PromptVersion.DoesNotExist:
            return Response({'error': 'Version not found'}, status=404)
        return Response({
            'v1': PromptVersionSerializer(version1).data,
            'v2': PromptVersionSerializer(version2).data,
        })
