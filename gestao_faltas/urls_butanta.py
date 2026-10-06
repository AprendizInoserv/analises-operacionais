from django.urls import path
from . import views_butanta

urlpatterns = [
    path('shoppings/', views_butanta.shoppings_view, name='butanta_shoppings'),
    path('shoppings/<int:shopping_id>/', views_butanta.shopping_delete_view, name='butanta_shopping_delete'),
    path('parse/', views_butanta.parse_view, name='butanta_parse'),
    path('records/', views_butanta.records_view, name='butanta_records'),
    path('records/<int:record_id>/', views_butanta.record_detail_view, name='butanta_record_detail'),
    path('records/clear/', views_butanta.records_clear_view, name='butanta_records_clear'),
    path('summary/', views_butanta.summary_view, name='butanta_summary'),
    path('export/excel/', views_butanta.export_excel_view, name='butanta_export_excel'),
    path('export/csv/', views_butanta.export_csv_view, name='butanta_export_csv'),
]
