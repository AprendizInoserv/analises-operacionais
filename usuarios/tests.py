from django.contrib.auth.models import AnonymousUser, Group, User
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from .models import RolePermission
from .permissions import IsAdministrador, IsGestaoOrAdministrador


class PermissoesDinamicasTests(TestCase):
    """Garante que os dois nomes de permissão apliquem a mesma regra dinâmica."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = object()

    def _request(self, method, user):
        request = getattr(self.factory, method.lower())("/lojas/")
        request.user = user
        return request

    def _assert_permissions_equal(self, request):
        self.assertEqual(
            IsAdministrador().has_permission(request, self.view),
            IsGestaoOrAdministrador().has_permission(request, self.view),
        )

    def test_usuarios_anonimos_sao_bloqueados(self):
        request = self._request("GET", AnonymousUser())

        self._assert_permissions_equal(request)
        self.assertFalse(IsGestaoOrAdministrador().has_permission(request, self.view))

    def test_superusuarios_possuem_acesso_total(self):
        user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="senha-segura",
        )
        request = self._request("DELETE", user)

        self._assert_permissions_equal(request)
        self.assertTrue(IsGestaoOrAdministrador().has_permission(request, self.view))

    def test_permissoes_do_grupo_respeitam_o_metodo_http(self):
        group = Group.objects.create(name="Gestão")
        user = User.objects.create_user(username="gestao", password="senha-segura")
        user.groups.add(group)
        RolePermission.objects.create(
            group=group,
            module="lojas",
            can_view=True,
            can_create=False,
            can_edit=True,
            can_delete=False,
        )

        expectativas = {
            "GET": True,
            "POST": False,
            "PUT": True,
            "PATCH": True,
            "DELETE": False,
        }
        for method, esperado in expectativas.items():
            with self.subTest(method=method):
                request = self._request(method, user)
                self._assert_permissions_equal(request)
                self.assertEqual(
                    IsGestaoOrAdministrador().has_permission(request, self.view),
                    esperado,
                )


class NetworkUtilsTests(TestCase):
    """Testa os utilitários de detecção dinâmica de rede e resolução de URLs."""

    def test_get_local_ip_retorna_ipv4_valido(self):
        from core.network_utils import get_local_ip
        import ipaddress

        ip = get_local_ip()
        self.assertIsInstance(ip, str)
        # Deve ser um IPv4 válido
        parsed_ip = ipaddress.ip_address(ip)
        self.assertEqual(parsed_ip.version, 4)

    def test_classificacao_de_hosts_locais_e_publicos(self):
        from core.network_utils import is_local_or_private_host

        self.assertTrue(is_local_or_private_host("localhost"))
        self.assertTrue(is_local_or_private_host("127.0.0.1"))
        self.assertTrue(is_local_or_private_host("10.1.1.93"))
        self.assertTrue(is_local_or_private_host("10.1.1.111"))
        self.assertTrue(is_local_or_private_host("192.168.1.100"))
        self.assertTrue(is_local_or_private_host("172.16.0.5"))
        self.assertTrue(is_local_or_private_host("computador-local"))

        # Domínios públicos não devem ser classificados como locais
        self.assertFalse(is_local_or_private_host("sistema.empresa.com.br"))
        self.assertFalse(is_local_or_private_host("google.com"))

    def test_resolve_frontend_url_atualiza_ip_antigo_para_ip_atual(self):
        from core.network_utils import get_local_ip, resolve_frontend_url

        local_ip = get_local_ip()
        # Se receber o IP antigo (.93) na 5173, deve atualizar para o IP atual na 5173
        resolved = resolve_frontend_url("http://10.1.1.93:5173", default_port=5173)
        self.assertEqual(resolved, f"http://{local_ip}:5173")

        # Se receber localhost, deve atualizar para o IP atual
        resolved_local = resolve_frontend_url("http://localhost:5173", default_port=5173)
        self.assertEqual(resolved_local, f"http://{local_ip}:5173")

        # Preserva domínios públicos
        resolved_domain = resolve_frontend_url("https://sistema.minhaempresa.com.br")
        self.assertEqual(resolved_domain, "https://sistema.minhaempresa.com.br")

    def test_get_frontend_base_url_com_request(self):
        from core.network_utils import get_local_ip, get_frontend_base_url

        local_ip = get_local_ip()
        factory = APIRequestFactory()

        # Requisição com Origin contendo IP antigo .93 na porta 5173
        req1 = factory.post("/usuarios/api/recuperar-senha/", HTTP_ORIGIN="http://10.1.1.93:5173")
        self.assertEqual(get_frontend_base_url(req1), f"http://{local_ip}:5173")

        # Requisição com payload 'origin' enviado pelo frontend Vite
        req2 = factory.post(
            "/usuarios/api/recuperar-senha/",
            {"origin": f"http://{local_ip}:5173"},
            format="json"
        )
        self.assertEqual(get_frontend_base_url(req2), f"http://{local_ip}:5173")

        # Requisição com Origin contendo localhost
        req3 = factory.post("/usuarios/api/recuperar-senha/", HTTP_ORIGIN="http://localhost:5173")
        self.assertEqual(get_frontend_base_url(req3), f"http://{local_ip}:5173")

        # Requisição com Referer contendo IP antigo
        req4 = factory.post("/usuarios/api/recuperar-senha/", HTTP_REFERER="http://10.1.1.93:5173/recuperar-senha")
        self.assertEqual(get_frontend_base_url(req4), f"http://{local_ip}:5173")


class RecuperarSenhaDinamicaTests(TestCase):
    """Testa se a API de recuperação de senha envia o link com o IP atual da rede."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username="usuario_teste",
            email="usuario_teste@empresa.com",
            password="SenhaForte123!@#"
        )

    def test_api_recuperar_senha_envia_link_com_ip_atual(self):
        from django.core import mail
        from core.network_utils import get_local_ip
        from .views import api_recuperar_senha

        local_ip = get_local_ip()

        # Simula requisição vinda do frontend Vite na porta 5173 com o IP antigo 10.1.1.93
        request = self.factory.post(
            "/usuarios/api/recuperar-senha/",
            {
                "email": "usuario_teste@empresa.com",
                "origin": "http://10.1.1.93:5173"
            },
            format="json",
            HTTP_ORIGIN="http://10.1.1.93:5173"
        )
        response = api_recuperar_senha(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("success"))

        # Verifica se o e-mail foi gerado
        self.assertEqual(len(mail.outbox), 1)
        email_enviado = mail.outbox[0]

        # O link no e-mail NÃO deve conter o IP antigo 10.1.1.93
        self.assertNotIn("http://10.1.1.93", email_enviado.body)

        # O link DEVE conter exatamente o link exibido pelo Vite (http://10.1.1.111:5173/...)
        esperado = f"http://{local_ip}:5173/redefinir-senha?uidb64="
        self.assertIn(esperado, email_enviado.body)


