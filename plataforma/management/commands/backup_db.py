from django.core.management.base import BaseCommand
from core.services.db_backup import executar_backup_sqlite


class Command(BaseCommand):
    help = "Executa backup atômico, verificado e rotacionado do banco de dados SQLite."

    def handle(self, *args, **options):
        self.stdout.write("Iniciando backup do banco de dados...")
        res = executar_backup_sqlite()
        if res.get("status") == "success":
            self.stdout.write(
                self.style.SUCCESS(
                    f"Backup realizado com sucesso!\n"
                    f"Arquivo: {res.get('file')}\n"
                    f"Tamanho: {res.get('size_mb')} MB"
                )
            )
            if res.get("network_file"):
                self.stdout.write(self.style.SUCCESS(f"Espelho na rede: {res.get('network_file')}"))
        elif res.get("status") == "skipped":
            self.stdout.write(self.style.WARNING(f"Backup ignorado: {res.get('reason')}"))
        else:
            self.stderr.write(self.style.ERROR(f"Erro no backup: {res}"))
