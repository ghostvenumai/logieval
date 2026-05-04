from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PromptViewSet

router = DefaultRouter()
router.register('', PromptViewSet, basename='prompt')

urlpatterns = [
    path('', include(router.urls)),
    path('<int:prompt_id>/diff/<int:v1>/<int:v2>/', PromptViewSet.as_view({'get': 'diff'})),
]
