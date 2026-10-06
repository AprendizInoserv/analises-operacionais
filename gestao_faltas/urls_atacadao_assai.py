from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_atacadao_assai import (
    ProcessarFechamentoView,
    UltimoFechamentoView,
    ExportarExcelView,
    ExportarZipView,
    ExportarLojaPdfView,
    QuadroLojaViewSet,
    DiariaManualViewSet,
    HistoricoProcessamentoViewSet,
)

router = DefaultRouter()
router.register(r'quadros', QuadroLojaViewSet, basename='quadros')
router.register(r'diarias', DiariaManualViewSet, basename='diarias')
router.register(r'historico', HistoricoProcessamentoViewSet, basename='historico')

urlpatterns = [
    path('processar/', ProcessarFechamentoView.as_view(), name='processar-fechamento'),
    path('ultimo/', UltimoFechamentoView.as_view(), name='ultimo-fechamento'),
    path('exportar-excel/', ExportarExcelView.as_view(), name='exportar-excel'),
    path('exportar-zip/', ExportarZipView.as_view(), name='exportar-zip'),
    path('exportar-loja-pdf/', ExportarLojaPdfView.as_view(), name='exportar-loja-pdf'),
    path('', include(router.urls)),
]
