from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DatasetViewSet, TestCaseViewSet

router = DefaultRouter()
router.register('', DatasetViewSet, basename='dataset')
router.register('test-cases', TestCaseViewSet, basename='testcase')

urlpatterns = [path('', include(router.urls))]
