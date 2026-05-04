import csv
import io
import json
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Dataset, TestCase
from .serializers import DatasetSerializer, DatasetDetailSerializer, TestCaseSerializer


class DatasetViewSet(viewsets.ModelViewSet):
    queryset = Dataset.objects.all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DatasetDetailSerializer
        return DatasetSerializer

    @action(detail=True, methods=['get', 'post'])
    def test_cases(self, request, pk=None):
        dataset = self.get_object()
        if request.method == 'GET':
            return Response(TestCaseSerializer(dataset.test_cases.all(), many=True).data)
        serializer = TestCaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(dataset=dataset)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='import_csv')
    def import_csv(self, request, pk=None):
        dataset = self.get_object()
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=400)
        try:
            content = file.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(content))
            created = 0
            for row in reader:
                input_vars = {k: v for k, v in row.items() if k not in ('expected_output', 'tags')}
                TestCase.objects.create(
                    dataset=dataset,
                    input_variables=input_vars,
                    expected_output=row.get('expected_output', ''),
                    tags=row.get('tags', '')
                )
                created += 1
            return Response({'created': created})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.all()
    serializer_class = TestCaseSerializer
