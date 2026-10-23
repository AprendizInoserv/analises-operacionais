import datetime
from django.contrib.auth.models import User, Group
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from usuarios.models import Aviso


class AvisosAPITests(TestCase):
    """
    Testes de cobertura completa para o módulo de Avisos corporativos e comunicados diários.
    """

    def setUp(self):
        self.hoje = timezone.localdate()
        self.ontem = self.hoje - datetime.timedelta(days=1)
        self.amanha = self.hoje + datetime.timedelta(days=1)

        # Usuário Administrador
        self.admin = User.objects.create_superuser(
            username="admin_avisos",
            password="password123",
            first_name="Carlos",
            last_name="Diretor"
        )
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)

        # Usuário Operador Comum (não admin)
        self.comum = User.objects.create_user(
            username="operador_comum",
            password="password123",
            first_name="Maria",
            last_name="Operacional"
        )
        self.client_comum = APIClient()
        self.client_comum.force_authenticate(user=self.comum)

        # Aviso de Hoje
        self.aviso_hoje = Aviso.objects.create(
            titulo="Manutenção no Sistema",
            conteudo="Hoje teremos manutenção às 22h.",
            data_inicio=self.hoje,
            data_fim=self.hoje,
            criado_por=self.admin,
            ativo=True
        )

        # Aviso Futuro (Agendado)
        self.aviso_futuro = Aviso.objects.create(
            titulo="Treinamento de Lojas",
            conteudo="Treinamento amanhã.",
            data_inicio=self.amanha,
            data_fim=self.amanha,
            criado_por=self.admin,
            ativo=True
        )

        # Aviso Passado (Expirado)
        self.aviso_passado = Aviso.objects.create(
            titulo="Boas-vindas Mês Passado",
            conteudo="Aviso já encerrado.",
            data_inicio=self.ontem - datetime.timedelta(days=5),
            data_fim=self.ontem,
            criado_por=self.admin,
            ativo=True
        )

    def test_avisos_hoje_disponivel_para_usuario_comum(self):
        """Usuário comum deve conseguir ver os avisos ativos para o dia de hoje."""
        response = self.client_comum.get("/usuarios/api/avisos/hoje/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        avisos = response.data.get("avisos", [])
        self.assertEqual(len(avisos), 1)
        self.assertEqual(avisos[0]["id"], self.aviso_hoje.id)
        self.assertEqual(avisos[0]["titulo"], "Manutenção no Sistema")
        self.assertEqual(avisos[0]["criado_por_nome"], "Carlos Diretor")

    def test_usuario_comum_bloqueado_de_gerenciar_avisos(self):
        """Usuário comum não pode cadastrar nem gerenciar avisos."""
        response = self.client_comum.get("/usuarios/api/avisos/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response_post = self.client_comum.post("/usuarios/api/avisos/", {
            "titulo": "Tentativa",
            "conteudo": "Teste",
            "data_inicio": str(self.hoje)
        })
        self.assertEqual(response_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cria_e_lista_avisos_com_filtros(self):
        """Administrador pode criar e listar avisos filtrando por status."""
        # Listar todos
        response = self.client_admin.get("/usuarios/api/avisos/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

        # Filtrar apenas ativos de hoje
        response_ativos = self.client_admin.get("/usuarios/api/avisos/", {"status": "ativo"})
        self.assertEqual(len(response_ativos.data), 1)
        self.assertEqual(response_ativos.data[0]["id"], self.aviso_hoje.id)

        # Filtrar agendados futuros
        response_agendados = self.client_admin.get("/usuarios/api/avisos/", {"status": "agendado"})
        self.assertEqual(len(response_agendados.data), 1)
        self.assertEqual(response_agendados.data[0]["id"], self.aviso_futuro.id)

        # Filtrar expirados
        response_expirados = self.client_admin.get("/usuarios/api/avisos/", {"status": "expirado"})
        self.assertEqual(len(response_expirados.data), 1)
        self.assertEqual(response_expirados.data[0]["id"], self.aviso_passado.id)

        # Criar novo aviso agendado
        data_futura = str(self.hoje + datetime.timedelta(days=7))
        response_create = self.client_admin.post("/usuarios/api/avisos/", {
            "titulo": "Novo Comunicado",
            "conteudo": "Atenção a todos",
            "data_inicio": data_futura,
            "data_fim": data_futura,
            "ativo": True
        })
        self.assertEqual(response_create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response_create.data["status"], "agendado")
        self.assertEqual(response_create.data["criado_por_nome"], "Carlos Diretor")

    def test_reenviar_aviso_passado_com_nova_data(self):
        """Testa se um aviso passado/expirado pode ser reenviado para uma nova data."""
        nova_data = str(self.hoje)
        response = self.client_admin.post(
            f"/usuarios/api/avisos/{self.aviso_passado.id}/reenviar/",
            {
                "data_inicio": nova_data,
                "data_fim": nova_data,
                "duplicar": False
            }
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.aviso_passado.refresh_from_db()
        self.assertEqual(str(self.aviso_passado.data_inicio), nova_data)
        self.assertEqual(self.aviso_passado.status_atual, "ativo")

        # Testar reenviar duplicando
        data_amanha = str(self.amanha)
        response_dup = self.client_admin.post(
            f"/usuarios/api/avisos/{self.aviso_passado.id}/reenviar/",
            {
                "data_inicio": data_amanha,
                "data_fim": data_amanha,
                "duplicar": True
            }
        )
        self.assertEqual(response_dup.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(response_dup.data["id"], self.aviso_passado.id)
        self.assertEqual(response_dup.data["status"], "agendado")
