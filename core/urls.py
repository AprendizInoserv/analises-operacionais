from django.contrib import admin
from django.urls import path, include
from core.views_health import health_check

urlpatterns = [
    path("api/health/", health_check, name="api_health"),
    path("health/", health_check, name="health"),
    path("admin/", admin.site.urls),
    path("contas/", include("django.contrib.auth.urls")),
    path("usuarios/", include("usuarios.urls")),
    path("", include("plataforma.urls")),
    path("", include("lojas.urls")),
    path("colaboradores/", include("colaboradores.urls")),
]
