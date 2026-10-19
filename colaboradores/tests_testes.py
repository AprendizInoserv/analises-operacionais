from datetime import date
from io import BytesIO
import pandas as pd
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from colaboradores.models import Colaborador, TestePromocao, HistoricoAcaoTeste
from lojas.models import Loja, Coordenador, Supervisor


class TestesPromocaoExportTests(TestCase):
    """
    Testes automatizados para a rota de exportação para Excel dos Testes de Promoção (/colaboradores/testes/exportar/).
    """

    def setUp(self):
        self.user = User.objects.create_superuser(username="admin_testes", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.coord = Coordenador.objects.create(nome="CARLOS COORD")
        self.superv = Supervisor.objects.create(nome="MARIANA SUPER")

        self.loja = Loja.objects.create(
            nome_referencia="LOJA MOEMA SP",
            centro_de_custo="0202",
            quadro="15",
            uf="SP",
            status="ATIVA",
            coordenador=self.coord,
            supervisor=self.superv,
        )

        self.colab1 = Colaborador.objects.create(
            re="20001",
            nome="ANA SILVA",
            cargo="AUXILIAR DE LOJA",
            centro_custo="0202",
            data_admissao=date(2025, 1, 10),
            loja=self.loja,
            status="ATIVO",
        )

        self.colab2 = Colaborador.objects.create(
            re="20002",
            nome="BRUNO SOUZA",
            cargo="OPERADOR DE CAIXA",
            centro_custo="0202",
            data_admissao=date(2025, 2, 1),
            loja=self.loja,
            status="ATIVO",
        )

        self.teste1 = TestePromocao.objects.create(
            colaborador=self.colab1,
            data_inicio=date(2026, 3, 1),
            cargo_teste="LÍDER DE SETOR",
            status="ativo",
            criado_por="Gestão",
        )

        self.teste2 = TestePromocao.objects.create(
            colaborador=self.colab2,
            data_inicio=date(2026, 4, 10),
            cargo_teste="ENCARREGADO DE LOJA",
            status="pendente",
            criado_por="Gestão",
        )

    def test_exportar_excel_retorna_200_e_arquivo_valido(self):
        url = "/colaboradores/testes/exportar/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertIn("attachment; filename=", response["Content-Disposition"])

        # Lê os bytes como Excel e valida o dataframe
        df = pd.read_excel(BytesIO(response.content))
        self.assertEqual(len(df), 2)

        colunas_esperadas = [
            "RE",
            "Colaborador",
            "Cargo Atual",
            "Cargo em Teste",
            "Loja",
            "Supervisor",
            "Coordenador",
            "Data Início",
            "Ciclo / Mês",
            "Status",
            "Cobrança",
            "Resposta Supervisor",
            "Folha do Teste",
            "Última Observação",
            "Criado Por",
            "Data Cadastro",
        ]
        for col in colunas_esperadas:
            self.assertIn(col, df.columns)

    def test_exportar_excel_com_filtro_busca_re(self):
        url = "/colaboradores/testes/exportar/?search=20001"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        df = pd.read_excel(BytesIO(response.content))
        self.assertEqual(len(df), 1)
        self.assertEqual(str(df.iloc[0]["RE"]), "20001")
        self.assertEqual(df.iloc[0]["Colaborador"], "ANA SILVA")

    def test_exportar_excel_com_filtro_status(self):
        url = "/colaboradores/testes/exportar/?status=pendente"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        df = pd.read_excel(BytesIO(response.content))
        self.assertEqual(len(df), 1)
        self.assertEqual(str(df.iloc[0]["RE"]), "20002")
        self.assertEqual(df.iloc[0]["Cargo em Teste"], "ENCARREGADO DE LOJA")

    def test_exportar_excel_com_filtro_ids(self):
        url = f"/colaboradores/testes/exportar/?ids={self.teste1.id}"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        df = pd.read_excel(BytesIO(response.content))
        self.assertEqual(len(df), 1)
        self.assertEqual(str(df.iloc[0]["RE"]), "20001")
