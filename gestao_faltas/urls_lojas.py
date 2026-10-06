from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_lojas import ClienteViewSet, RegiaoViewSet, LojaViewSet

router = DefaultRouter()
router.register(r'clientes', ClienteViewSet, basename='cliente-faltas')
router.register(r'regioes', RegiaoViewSet, basename='regiao-faltas')
router.register(r'lojas', LojaViewSet, basename='loja-faltas')

urlpatterns = [
    path('', include(router.urls)),
]
