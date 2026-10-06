from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_faltas import FechamentoViewSet, ItemFechamentoViewSet

router = DefaultRouter()
router.register(r'fechamentos', FechamentoViewSet, basename='fechamento')
router.register(r'itens', ItemFechamentoViewSet, basename='item-fechamento')

urlpatterns = [
    path('', include(router.urls)),
]
