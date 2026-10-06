from django.urls import path
from .views_relatorios import ExportarExcelFechamentoView, ExportarExcelAnoView, DashboardKPIsView

urlpatterns = [
    path('exportar-excel/<int:pk>/', ExportarExcelFechamentoView.as_view(), name='exportar-excel-fechamento'),
    path('exportar-ano/<int:ano>/', ExportarExcelAnoView.as_view(), name='exportar-excel-ano'),
    path('dashboard-kpis/', DashboardKPIsView.as_view(), name='dashboard-kpis'),
]
