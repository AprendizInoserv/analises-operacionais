from django.apps import AppConfig


class ButantaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.butanta'
    verbose_name = 'Shopping Butantã - Quadro de Presenças'

    def ready(self):
        try:
            from . import database
            database.init_db()
        except Exception:
            pass
