from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_colaboradores import ColaboradorViewSet

router = DefaultRouter()
router.register(r'colaboradores', ColaboradorViewSet, basename='colaborador-faltas')

urlpatterns = [
    path('', include(router.urls)),
]
