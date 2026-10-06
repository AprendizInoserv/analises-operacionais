from django.urls import path
from . import views

urlpatterns = [
    path('shoppings/', views.shoppings_view, name='butanta_shoppings'),
    path('shoppings/<int:shopping_id>/', views.shopping_delete_view, name='butanta_shopping_delete'),
    path('parse/', views.parse_view, name='butanta_parse'),
    path('records/', views.records_view, name='butanta_records'),
    path('records/<int:record_id>/', views.record_detail_view, name='butanta_record_detail'),
    path('records/clear/', views.records_clear_view, name='butanta_records_clear'),
    path('summary/', views.summary_view, name='butanta_summary'),
    path('export/excel/', views.export_excel_view, name='butanta_export_excel'),
    path('export/csv/', views.export_csv_view, name='butanta_export_csv'),
]
