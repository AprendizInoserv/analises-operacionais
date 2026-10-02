from django.core.management.base import BaseCommand, CommandError
from core.services.db_backup import restaurar_ultimo_backup


class Command(BaseCommand):
    help = "Restaura o banco SQLite a partir do backup mais recente ou de um arquivo específico."

    def add_arguments(self, parser):
        parser.add_argument(
            "--arquivo",
            type=str,
            default=None,
            help="Caminho completo do arquivo de backup específico a ser restaurado.",
        )

    def handle(self, *args, **options):
        arquivo = options.get("arquivo")
        self.stdout.write("Iniciando processo de restauração segura do banco de dados...")
        try:
            res = restaurar_ultimo_backup(arquivo)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Restauração concluída com sucesso!\n"
                    f"Origem do backup: {res.get('restored_from')}\n"
                    f"Destino: {res.get('target')}"
                )
            )
        except Exception as e:
            raise CommandError(f"Falha na restauração do banco: {e}")
