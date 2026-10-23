from io import BytesIO
import pandas as pd
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from lojas.models import Loja, Coordenador, Supervisor, Premio


class PremiosExportarExcelTests(TestCase):
    """
    Testes para as funcionalidades de exportação do módulo de Prêmios:
    - Exportação completa para Excel (.xlsx) com todas as colunas esperadas.
    - Exportação com filtros aplicados (ex: por coordenador, status, etc.).
    """

    def setUp(self):
        self.user = User.objects.create_superuser(username="admin_test_premio", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.coordenador_sp = Coordenador.objects.create(nome="CARLOS SILVA", orcamento_premios=10000.0)
        self.coordenador_rj = Coordenador.objects.create(nome="MARIANA SOUZA", orcamento_premios=8000.0)

        self.supervisor_sp = Supervisor.objects.create(nome="ROBERTO ALVES")

        self.loja_sp = Loja.objects.create(
            nome_referencia="LOJA 01 SP",
            centro_de_custo="1001",
            quadro="OPERACIONAL",
            uf="SP",
            status="ATIVA",
            coordenador=self.coordenador_sp,
            supervisor=self.supervisor_sp,
        )

        self.loja_rj = Loja.objects.create(
            nome_referencia="LOJA 02 RJ",
            centro_de_custo="1002",
            quadro="OPERACIONAL",
            uf="RJ",
            status="ATIVA",
            coordenador=self.coordenador_rj,
        )

        self.premio_1 = Premio.objects.create(
            status="PAGO",
            cost_center_name="1001 - LOJA 01 SP",
            loja=self.loja_sp,
            coordenador=self.coordenador_sp,
            supervisor=self.supervisor_sp,
            uf="SP",
            verb_name="PREMIO OPERACIONAL",
            reward_value=250.00,
            period="202605",
            order_type="SISTEMA",
            roteiro="FOLHA",
        )

        self.premio_2 = Premio.objects.create(
            status="APROVADO",
            cost_center_name="1002 - LOJA 02 RJ",
            loja=self.loja_rj,
            coordenador=self.coordenador_rj,
            uf="RJ",
            verb_name="PREMIO DESTAQUE",
            reward_value=500.00,
            period="202605",
            order_type="MANUAL",
            roteiro="VEX",
        )

        self.premio_3 = Premio.objects.create(
            status="PENDENTE",
            cost_center_name="CENTRO SEM LOJA",
            verb_name="CAMPANHA EXTRA",
            reward_value=150.00,
            period="202606",
            order_type="MANUAL",
            roteiro="FOLHA",
        )

    def test_premios_exportar_excel(self):
        """Testa se a rota /premios/exportar/ gera arquivo Excel válido com colunas corretas."""
        response = self.client.get("/premios/exportar/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertIn("attachment; filename=", response["Content-Disposition"])

        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, sheet_name="Prêmios")

        expected_columns = [
            "ID",
            "Tipo de Prêmio",
            "Centro de Custo",
            "Loja",
            "Coordenador",
            "Supervisor",
            "UF",
            "Período",
            "Origem",
            "Roteiro",
            "Valor (R$)",
            "Status",
        ]
        self.assertEqual(list(df.columns), expected_columns)
        self.assertEqual(len(df), 3)

        # Checa formatação e conteúdo
        df_sp = df[df["ID"] == self.premio_1.id].iloc[0]
        self.assertEqual(df_sp["Tipo de Prêmio"], "PREMIO OPERACIONAL")
        self.assertEqual(df_sp["Loja"], "LOJA 01 SP")
        self.assertEqual(df_sp["Coordenador"], "CARLOS SILVA")
        self.assertEqual(df_sp["Supervisor"], "ROBERTO ALVES")
        self.assertEqual(df_sp["Período"], "05/2026")
        self.assertEqual(df_sp["Valor (R$)"], 250.0)

        # Sem loja vinculada
        df_sem = df[df["ID"] == self.premio_3.id].iloc[0]
        self.assertEqual(df_sem["Loja"], "Não vinculada")
        self.assertEqual(df_sem["Coordenador"], "-")
        self.assertEqual(df_sem["Supervisor"], "-")
        self.assertEqual(df_sem["Período"], "06/2026")

    def test_premios_exportar_excel_com_filtro(self):
        """Testa a exportação filtrando por coordenador."""
        response = self.client.get("/premios/exportar/", {"coordenador": "MARIANA SOUZA"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, sheet_name="Prêmios")
        self.assertEqual(len(df), 1)
        self.assertEqual(df.iloc[0]["ID"], self.premio_2.id)
        self.assertEqual(df.iloc[0]["Coordenador"], "MARIANA SOUZA")
        self.assertEqual(df.iloc[0]["Valor (R$)"], 500.0)
