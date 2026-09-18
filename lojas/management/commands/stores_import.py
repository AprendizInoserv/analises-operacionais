import pandas as pd
from django.core.management.base import BaseCommand
from lojas.models import Loja


class Command(BaseCommand):
    help = "Importa lojas de uma planilha Excel"

    def add_arguments(self, parser):
        parser.add_argument("arquivo", type=str, help="Caminho para o arquivo .xlsx")

    def _clean_text(self, value):
        """
        Converte valores vazios/NaN para string vazia.
        Evita salvar 'nan' como texto no banco.
        """
        if pd.isna(value):
            return ""
        return str(value).strip()

    def _clean_int(self, value):
        """
        Converte para inteiro quando possível.
        Se vier vazio/NaN, retorna None.
        """
        if pd.isna(value):
            return None

        text = str(value).strip()
        if text == "":
            return None

        try:
            # Suporta casos como "123.0" vindos do Excel
            return int(float(text))
        except ValueError:
            return None

    def _clean_status(self, value):
        """
        Garante status válido para o campo choices do Django.
        """
        status = self._clean_text(value).upper()
        if status in ["ATIVA", "INATIVA"]:
            return status
        return "ATIVA"

    def handle(self, *args, **options):
        caminho_arquivo = options["arquivo"]

        try:
            # Lê tudo como texto para preservar identificadores
            df = pd.read_excel(caminho_arquivo, dtype=str)

            lojas_criadas = 0
            lojas_atualizadas = 0
            linhas_ignoradas = 0

            for _, row in df.iterrows():
                nome_referencia = self._clean_text(row.get("NOME REFERENCIA"))
                centro_de_custo = self._clean_text(row.get("CENTRO DE CUSTO"))
                quadro = self._clean_text(row.get("QUADROS"))

                # Campos obrigatórios no seu model
                if not nome_referencia or not centro_de_custo or not quadro:
                    linhas_ignoradas += 1
                    continue

                dados_loja = {
                    "nome_referencia": nome_referencia,
                    "nome_geovictoria": self._clean_text(row.get("NOME GEOVICTORIA")),
                    "nome_totvs": self._clean_text(row.get("NOME TOTVS")),
                    "centro_de_custo": centro_de_custo,
                    "cnpj": self._clean_text(row.get("CNPJ")),
                    "nome_financeiro": self._clean_text(row.get("NOME FINANCEIRO")),
                    "nome_findme": self._clean_text(row.get("NOME FINDME")),
                    "cliente": self._clean_text(row.get("CLIENTE")),
                    "uf": self._clean_text(row.get("UF"))[:2],  # garante tamanho max 2
                    "sub_regiao": self._clean_text(row.get("SUB-REGIÃO")),
                    "quadro": quadro,
                    "status": self._clean_status(row.get("STATUS")),
                    "nome_metricas": self._clean_text(row.get("NOME MÉTRICAS")),
                    "codigo_loja": self._clean_int(row.get("COD. LOJA")),
                }

                _, created = Loja.objects.update_or_create(
                    nome_referencia=dados_loja["nome_referencia"],
                    defaults=dados_loja,
                )

                if created:
                    lojas_criadas += 1
                else:
                    lojas_atualizadas += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Importação concluída! "
                    f"Criadas: {lojas_criadas} | "
                    f"Atualizadas: {lojas_atualizadas} | "
                    f"Ignoradas: {linhas_ignoradas}"
                )
            )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Erro ao importar: {e}"))