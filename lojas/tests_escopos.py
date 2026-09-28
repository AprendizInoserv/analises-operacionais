from datetime import date
from io import BytesIO

from django.contrib.auth.models import User
from django.test import TestCase
import pandas as pd
from rest_framework import status
from rest_framework.test import APIClient

from lojas.models import Cargo, EscopoMensal, ItemEscopoMensal, Loja


class EscopoExportarExcelTests(TestCase):
    """
    Testa a rota de exportação para Excel na aba de Escopos (/escopos/exportar/).
    Garante que a planilha gerada contém exatamente as colunas solicitadas:
    centro_custo, nome_referencia, cargo, turno, quantidade.
    """

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="admin_escopos",
            password="password123",
            email="admin@empresa.com",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.loja_a = Loja.objects.create(
            nome_referencia="LOJA ALFA SP",
            centro_de_custo="111222333001",
            uf="SP",
            status="ATIVA",
        )
        self.loja_b = Loja.objects.create(
            nome_referencia="LOJA BETA RJ",
            centro_de_custo="111222333002",
            uf="RJ",
            status="ATIVA",
        )

        self.cargo_aux = Cargo.objects.create(nome="AUXILIAR DE LIMPEZA")
        self.cargo_enc = Cargo.objects.create(nome="ENCARREGADO")

        # Escopo da Loja Alfa (2026/03)
        self.escopo_alfa = EscopoMensal.objects.create(
            loja=self.loja_a,
            ano=2026,
            mes=3,
        )
        self.item_alfa_1 = ItemEscopoMensal.objects.create(
            escopo_mensal=self.escopo_alfa,
            cargo=self.cargo_aux,
            turno="DIURNO",
            quantidade=4,
        )
        self.item_alfa_2 = ItemEscopoMensal.objects.create(
            escopo_mensal=self.escopo_alfa,
            cargo=self.cargo_enc,
            turno="NOTURNO",
            quantidade=1,
        )

        # Escopo da Loja Beta (2026/04)
        self.escopo_beta = EscopoMensal.objects.create(
            loja=self.loja_b,
            ano=2026,
            mes=4,
        )
        self.item_beta_1 = ItemEscopoMensal.objects.create(
            escopo_mensal=self.escopo_beta,
            cargo=self.cargo_aux,
            turno="NOTURNO",
            quantidade=2,
        )

    def test_exportar_excel_colunas_e_dados(self):
        """Verifica se o Excel gerado contém as 5 colunas corretas e os registros correspondentes."""
        response = self.client.get("/escopos/exportar/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertIn("attachment; filename=", response["Content-Disposition"])

        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, sheet_name="Escopos")

        expected_columns = [
            "centro_custo",
            "nome_referencia",
            "cargo",
            "turno",
            "quantidade",
        ]
        self.assertEqual(list(df.columns), expected_columns)
        self.assertEqual(len(df), 3)

        # Verifica conteúdo das linhas da Loja Alfa
        df_alfa = df[df["nome_referencia"] == "LOJA ALFA SP"]
        self.assertEqual(len(df_alfa), 2)
        row_aux = df_alfa[df_alfa["cargo"] == "AUXILIAR DE LIMPEZA"].iloc[0]
        self.assertEqual(str(row_aux["centro_custo"]), "111222333001")
        self.assertEqual(row_aux["turno"], "DIURNO")
        self.assertEqual(row_aux["quantidade"], 4)

        row_enc = df_alfa[df_alfa["cargo"] == "ENCARREGADO"].iloc[0]
        self.assertEqual(str(row_enc["centro_custo"]), "111222333001")
        self.assertEqual(row_enc["turno"], "NOTURNO")
        self.assertEqual(row_enc["quantidade"], 1)

        # Verifica conteúdo da Loja Beta
        df_beta = df[df["nome_referencia"] == "LOJA BETA RJ"]
        self.assertEqual(len(df_beta), 1)
        row_beta = df_beta.iloc[0]
        self.assertEqual(str(row_beta["centro_custo"]), "111222333002")
        self.assertEqual(row_beta["cargo"], "AUXILIAR DE LIMPEZA")
        self.assertEqual(row_beta["turno"], "NOTURNO")
        self.assertEqual(row_beta["quantidade"], 2)

    def test_exportar_excel_com_filtro_loja(self):
        """Verifica a exportação filtrando por ID de loja."""
        response = self.client.get("/escopos/exportar/", {"loja": str(self.loja_b.id)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, sheet_name="Escopos")
        self.assertEqual(len(df), 1)
        self.assertEqual(df.iloc[0]["nome_referencia"], "LOJA BETA RJ")

    def test_exportar_excel_com_filtro_competencia(self):
        """Verifica a exportação filtrando por mês e ano."""
        response = self.client.get("/escopos/exportar/", {"ano": "2026", "mes": "3"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, sheet_name="Escopos")
        self.assertEqual(len(df), 2)
        self.assertTrue(all(df["nome_referencia"] == "LOJA ALFA SP"))

    def test_exportar_excel_com_busca_textual(self):
        """Verifica a exportação filtrando por busca textual de nome da loja."""
        response = self.client.get("/escopos/exportar/", {"busca_loja": "BETA"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, sheet_name="Escopos")
        self.assertEqual(len(df), 1)
        self.assertEqual(df.iloc[0]["nome_referencia"], "LOJA BETA RJ")

    def test_exportar_excel_apenas_escopo_mais_recente(self):
        """
        Garante que quando há múltiplos escopos históricos cadastrados para as lojas,
        apenas o escopo mais recente de cada loja é incluído no arquivo exportado,
        ignorando escopos de meses anteriores.
        """
        # Cria escopo antigo para Loja Alfa (2025/10) com quantidade diferente
        escopo_antigo_alfa = EscopoMensal.objects.create(
            loja=self.loja_a,
            ano=2025,
            mes=10,
        )
        ItemEscopoMensal.objects.create(
            escopo_mensal=escopo_antigo_alfa,
            cargo=self.cargo_aux,
            turno="DIURNO",
            quantidade=99,
        )

        # Cria escopo antigo para Loja Beta (2025/11)
        escopo_antigo_beta = EscopoMensal.objects.create(
            loja=self.loja_b,
            ano=2025,
            mes=11,
        )
        ItemEscopoMensal.objects.create(
            escopo_mensal=escopo_antigo_beta,
            cargo=self.cargo_enc,
            turno="NOTURNO",
            quantidade=50,
        )

        response = self.client.get("/escopos/exportar/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, sheet_name="Escopos")

        # Não deve conter os itens dos escopos antigos (99 e 50)
        self.assertNotIn(99, df["quantidade"].values)
        self.assertNotIn(50, df["quantidade"].values)

        # Deve conter apenas os itens dos escopos mais recentes (Loja Alfa 2026/03: 4 e 1; Loja Beta 2026/04: 2)
        self.assertEqual(len(df), 3)
        quantidades = sorted(df["quantidade"].tolist())
        self.assertEqual(quantidades, [1, 2, 4])


class EscopoCreateTests(TestCase):
    """
    Testes para as APIs de criação de escopo (/escopos/create/)
    e salvamento inline de itens de escopo.
    """

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="admin_create",
            password="password123",
            email="admin_create@empresa.com",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.loja = Loja.objects.create(
            nome_referencia="LOJA GAMA TESTE",
            centro_de_custo="999000111222",
            uf="SP",
            status="ATIVA",
        )
        self.cargo_aux = Cargo.objects.create(nome="AUXILIAR DE LIMPEZA")
        self.cargo_enc = Cargo.objects.create(nome="ENCARREGADO")

    def test_escopo_create_sucesso(self):
        """Garante a criação completa de um escopo mensal com itens."""
        payload = {
            "loja": str(self.loja.id),
            "ano": 2026,
            "mes": 6,
            "itens": [
                {"cargo": str(self.cargo_aux.id), "turno": "DIURNO", "quantidade": 5},
                {"cargo": str(self.cargo_enc.id), "turno": "NOTURNO", "quantidade": 2},
            ],
        }
        response = self.client.post("/escopos/novo/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get("success"))
        self.assertIn("escopo", response.data)
        self.assertIn("id", response.data["escopo"])

        # Verifica persistência
        escopo = EscopoMensal.objects.get(loja=self.loja, ano=2026, mes=6)
        self.assertEqual(escopo.itens.count(), 2)

    def test_escopo_create_loja_ano_mes_duplicado(self):
        """Garante que tentar criar escopo duplicado retorna 400 amigável."""
        EscopoMensal.objects.create(loja=self.loja, ano=2026, mes=6)
        payload = {
            "loja": str(self.loja.id),
            "ano": 2026,
            "mes": 6,
            "itens": [
                {"cargo": str(self.cargo_aux.id), "turno": "DIURNO", "quantidade": 1},
            ],
        }
        response = self.client.post("/escopos/novo/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cadastrado para a loja", response.data.get("error", ""))

    def test_escopo_create_itens_duplicados_mesmo_cargo_e_turno(self):
        """Garante que cargos duplicados no mesmo turno retornam 400 com nome do cargo."""
        payload = {
            "loja": str(self.loja.id),
            "ano": 2026,
            "mes": 7,
            "itens": [
                {"cargo": str(self.cargo_aux.id), "turno": "DIURNO", "quantidade": 3},
                {"cargo": str(self.cargo_aux.id), "turno": "DIURNO", "quantidade": 2},
            ],
        }
        response = self.client.post("/escopos/novo/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mais de uma vez", response.data.get("error", ""))
        self.assertIn("AUXILIAR DE LIMPEZA", response.data.get("error", ""))

    def test_escopo_create_quantidade_invalida(self):
        """Garante validação quando quantidade é menor que 1."""
        payload = {
            "loja": str(self.loja.id),
            "ano": 2026,
            "mes": 8,
            "itens": [
                {"cargo": str(self.cargo_aux.id), "turno": "DIURNO", "quantidade": 0},
            ],
        }
        response = self.client.post("/escopos/novo/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("quantidade", response.data.get("error", "").lower())

    def test_item_escopo_save_api_duplicado(self):
        """Testa o endpoint api_item_escopo_save impedindo duplicidade no mesmo escopo."""
        escopo = EscopoMensal.objects.create(loja=self.loja, ano=2026, mes=9)
        ItemEscopoMensal.objects.create(
            escopo_mensal=escopo,
            cargo=self.cargo_aux,
            turno="DIURNO",
            quantidade=1,
        )

        # Tentativa de criar outro item com mesmo cargo e turno no mesmo escopo
        payload = {
            "escopo_id": str(escopo.id),
            "cargo_id": str(self.cargo_aux.id),
            "turno": "DIURNO",
            "quantidade": 4,
        }
        response = self.client.post("/escopos/api/item/save/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Já existe", response.data.get("error", ""))

