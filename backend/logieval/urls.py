from django.urls import path, include

urlpatterns = [
    path('api/prompts/', include('apps.prompts.urls')),
    path('api/datasets/', include('apps.datasets.urls')),
    path('api/evaluations/', include('apps.evaluations.urls')),
]
