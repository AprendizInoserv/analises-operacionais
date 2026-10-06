from django.contrib import admin
from django.urls import path, include
from core.views_health import health_check

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("api/health/", health_check, name="api_health"),
    path("health/", health_check, name="health"),
    path("admin/", admin.site.urls),
    path("contas/", include("django.contrib.auth.urls")),
    path("usuarios/", include("usuarios.urls")),
    path("api/faltas/", include("gestao_faltas.urls_faltas")),
    path("api/faltas/lojas/", include("gestao_faltas.urls_lojas")),
    path("api/gestao-faltas/lojas/", include("gestao_faltas.urls_lojas")),
    path("api/gestao-faltas/colaboradores/", include("gestao_faltas.urls_colaboradores")),
    path("api/fechamento-atacadao-assai/", include("gestao_faltas.urls_atacadao_assai")),
    path("api/butanta/", include("gestao_faltas.urls_butanta")),
    path("api/relatorios/", include("gestao_faltas.urls_relatorios")),
    path("", include("plataforma.urls")),
    path("", include("lojas.urls")),
    path("colaboradores/", include("colaboradores.urls")),
]

if getattr(settings, "MEDIA_ROOT", None):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

