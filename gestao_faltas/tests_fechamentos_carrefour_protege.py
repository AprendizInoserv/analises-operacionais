from datetime import date
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from gestao_faltas.models import Cliente, Regiao, LojaTarifa, Fechamento, ItemFechamento
from lojas.models import Loja, Coordenador, Supervisor


class FechamentosCarrefourProtegeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='operador', password='password123')
        self.client.force_authenticate(user=self.user)

        # Clientes
        self.cliente_carrefour, _ = Cliente.objects.get_or_create(
            codigo='carrefour',
            defaults={'nome': 'Carrefour', 'ativo': True}
        )
        self.cliente_protege, _ = Cliente.objects.get_or_create(
            codigo='protege',
            defaults={'nome': 'Grupo Protege', 'ativo': True}
        )

        # Regiões
        self.regiao_carrefour, _ = Regiao.objects.get_or_create(
            cliente=self.cliente_carrefour,
            nome='SP CAPITAL',
            defaults={'ordem': 1}
        )
        self.regiao_protege, _ = Regiao.objects.get_or_create(
            cliente=self.cliente_protege,
            nome='PROTEGE OPERACIONAL',
            defaults={'ordem': 1}
        )

        # Coordenador e Supervisor oficiais
        self.coordenador = Coordenador.objects.create(nome='Coord Teste')
        self.supervisor = Supervisor.objects.create(nome='Superv Teste', coordenador=self.coordenador)

        # Lojas oficiais
        self.loja_oficial_ativa = Loja.objects.create(
            nome_referencia='CARREFOUR OSASCO',
            centro_de_custo='CC-001',
            quadro='10',
            cliente='CARREFOUR',
            status='ATIVA',
            coordenador=self.coordenador,
            supervisor=self.supervisor
        )

        self.loja_oficial_inativa = Loja.objects.create(
            nome_referencia='CARREFOUR FECHADA',
            centro_de_custo='CC-002',
            quadro='5',
            cliente='CARREFOUR',
            status='INATIVA',
            coordenador=self.coordenador,
            supervisor=self.supervisor
        )

        self.loja_oficial_protege = Loja.objects.create(
            nome_referencia='PROTEGE CAMPINAS',
            centro_de_custo='CC-PROT-1',
            quadro='8',
            cliente='PROTEGE',
            status='ATIVA',
            coordenador=self.coordenador,
            supervisor=self.supervisor
        )

        self.loja_oficial_assai = Loja.objects.create(
            nome_referencia='ASSAÍ SÃO PAULO',
            centro_de_custo='CC-ASSAI-1',
            quadro='20',
            cliente='ASSAÍ',
            status='ATIVA'
        )

    def test_mes_vigente_na_abertura_e_navegacao_competencias(self):
        """Ao abrir sem mês/ano especificado, inicializa dinamicamente no mês/ano vigentes do sistema."""
        hoje = date.today()
        res = self.client.post('/api/faltas/fechamentos/inicializar/', {
            'cliente_codigo': 'carrefour'
        })
        self.assertIn(res.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        data = res.json()
        self.assertEqual(data['mes_referencia'], hoje.month)
        self.assertEqual(data['ano_referencia'], hoje.year)

        # Navegação manual para competência diferente
        res_anterior = self.client.post('/api/faltas/fechamentos/inicializar/', {
            'cliente_codigo': 'carrefour',
            'ano': 2025,
            'mes': 5
        })
        self.assertIn(res_anterior.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        data_anterior = res_anterior.json()
        self.assertEqual(data_anterior['mes_referencia'], 5)
        self.assertEqual(data_anterior['ano_referencia'], 2025)

        # Garante que registros do mês vigente e de competência anterior coexistem
        fechamentos = Fechamento.objects.filter(cliente=self.cliente_carrefour)
        self.assertTrue(fechamentos.filter(ano_referencia=hoje.year, mes_referencia=hoje.month).exists())
        self.assertTrue(fechamentos.filter(ano_referencia=2025, mes_referencia=5).exists())

    def test_adicionar_loja_ativa_da_base_oficial(self):
        """Adiciona loja ativa da base oficial com sucesso ao fechamento."""
        payload = {
            'loja_base_id': self.loja_oficial_ativa.id,
            'cliente_codigo': 'carrefour',
            'desconto_por_falta': 160.50,
            'regiao_id': self.regiao_carrefour.id
        }
        res = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        
        # Verifica criação correta
        lt = LojaTarifa.objects.get(loja_base=self.loja_oficial_ativa, cliente=self.cliente_carrefour)
        self.assertTrue(lt.ativo)
        self.assertEqual(lt.desconto_por_falta, Decimal('160.50'))
        self.assertEqual(lt.nome, self.loja_oficial_ativa.nome_referencia)
        self.assertEqual(lt.supervisor, self.supervisor.nome)

    def test_bloquear_loja_inativa_na_base_oficial(self):
        """Bloqueia com 400 tentativa de adicionar loja com status INATIVA na base oficial."""
        payload = {
            'loja_base_id': self.loja_oficial_inativa.id,
            'cliente_codigo': 'carrefour',
            'desconto_por_falta': 150.00
        }
        res = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('INATIVA na base oficial', res.json().get('error', ''))
        self.assertFalse(LojaTarifa.objects.filter(loja_base=self.loja_oficial_inativa).exists())

    def test_bloquear_duplicidade_e_oferecer_reativacao(self):
        """Bloqueia duplicidade de loja ativa e oferece reativação se estiver inativa."""
        # 1. Cria a primeira vez ativa
        self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_ativa.id,
            'cliente_codigo': 'carrefour',
            'desconto_por_falta': 150.00
        })

        # 2. Tenta duplicar loja ativa -> deve bloquear com 400
        res_dup = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_ativa.id,
            'cliente_codigo': 'carrefour',
            'desconto_por_falta': 150.00
        })
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('já está vinculada e ATIVA', res_dup.json().get('error', ''))

        # 3. Inativa a loja
        lt = LojaTarifa.objects.get(loja_base=self.loja_oficial_ativa, cliente=self.cliente_carrefour)
        lt.ativo = False
        lt.save()

        # 4. Tenta adicionar novamente sem reativar -> deve retornar 409 com flag pode_reativar
        res_inativa = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_ativa.id,
            'cliente_codigo': 'carrefour',
            'desconto_por_falta': 150.00,
            'reativar': False
        })
        self.assertEqual(res_inativa.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(res_inativa.json().get('pode_reativar'))

        # 5. Adiciona com reativar=True -> deve reativar com sucesso (200 OK)
        res_reativar = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_ativa.id,
            'cliente_codigo': 'carrefour',
            'desconto_por_falta': 175.00,
            'reativar': True
        })
        self.assertEqual(res_reativar.status_code, status.HTTP_200_OK)
        lt.refresh_from_db()
        self.assertTrue(lt.ativo)
        self.assertEqual(lt.desconto_por_falta, Decimal('175.00'))

    def test_inativar_no_carrefour_nao_altera_protege_nem_base_oficial(self):
        """Inativar uma loja no Carrefour afeta somente o Carrefour: Protege e base oficial permanecem intactos."""
        # Vincula a mesma loja da base oficial em ambos os clientes
        lt_carrefour = LojaTarifa.objects.create(
            cliente=self.cliente_carrefour,
            regiao=self.regiao_carrefour,
            loja_base=self.loja_oficial_ativa,
            nome=self.loja_oficial_ativa.nome_referencia,
            desconto_por_falta=Decimal('150.00'),
            ativo=True
        )

        lt_protege = LojaTarifa.objects.create(
            cliente=self.cliente_protege,
            regiao=self.regiao_protege,
            loja_base=self.loja_oficial_ativa,
            nome=self.loja_oficial_ativa.nome_referencia,
            desconto_por_falta=Decimal('180.00'),
            ativo=True
        )

        # Inativa via endpoint no Carrefour
        res = self.client.post(f'/api/faltas/lojas/lojas/{lt_carrefour.id}/inativar/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        lt_carrefour.refresh_from_db()
        lt_protege.refresh_from_db()
        self.loja_oficial_ativa.refresh_from_db()

        # Validações estritas de independência
        self.assertFalse(lt_carrefour.ativo, "Loja no Carrefour deve estar inativa")
        self.assertTrue(lt_protege.ativo, "Loja na Protege DEVE permanecer ativa")
        self.assertEqual(self.loja_oficial_ativa.status, 'ATIVA', "Status na base oficial corporativa DEVE permanecer ATIVA")

    def test_historico_fechamento_preservado(self):
        """Inativação não exclui nada: preserva itens de fechamento históricos, tarifas e totais calculados."""
        lt = LojaTarifa.objects.create(
            cliente=self.cliente_carrefour,
            regiao=self.regiao_carrefour,
            loja_base=self.loja_oficial_ativa,
            nome=self.loja_oficial_ativa.nome_referencia,
            desconto_por_falta=Decimal('150.00'),
            ativo=True
        )

        fechamento = Fechamento.objects.create(
            cliente=self.cliente_carrefour,
            ano_referencia=2026,
            mes_referencia=8,
            titulo='Fechamento Teste',
            data_inicio=date(2026, 7, 20),
            data_fim=date(2026, 8, 19),
            status='CONCLUIDO'
        )

        item = ItemFechamento.objects.create(
            fechamento=fechamento,
            loja=lt,
            regiao_nome='SP CAPITAL',
            valor_falta_aplicado=Decimal('150.00'),
            faltas_computadas=4,
            desconto_total=Decimal('600.00')
        )
        fechamento.recalcular_totais()

        # Inativa a loja
        self.client.post(f'/api/faltas/lojas/lojas/{lt.id}/inativar/')
        lt.refresh_from_db()
        self.assertFalse(lt.ativo)

        # Item de fechamento histórico deve estar 100% preservado
        item.refresh_from_db()
        self.assertEqual(item.faltas_computadas, 4)
        self.assertEqual(item.desconto_total, Decimal('600.00'))
        self.assertEqual(item.valor_falta_aplicado, Decimal('150.00'))
        fechamento.refresh_from_db()
        self.assertEqual(fechamento.total_faltas, 4)
        self.assertEqual(fechamento.total_desconto, Decimal('600.00'))

    def test_acesso_sem_permissao_bloqueado_na_api(self):
        """Operações de escrita sem autenticação devem ser bloqueadas diretamente pela API com 401/403."""
        anon_client = APIClient()

        # Tenta adicionar loja sem autenticação
        res_add = anon_client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_ativa.id,
            'cliente_codigo': 'carrefour'
        })
        self.assertIn(res_add.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # Tenta inativar loja sem autenticação
        lt = LojaTarifa.objects.create(
            cliente=self.cliente_carrefour,
            regiao=self.regiao_carrefour,
            loja_base=self.loja_oficial_ativa,
            nome='LOJA TESTE ANON',
            desconto_por_falta=Decimal('100.00')
        )
        res_toggle = anon_client.post(f'/api/faltas/lojas/lojas/{lt.id}/toggle-ativo/')
        self.assertIn(res_toggle.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_somente_lojas_carrefour_permitidas(self):
        """No fechamento Carrefour, somente lojas pertencentes ao Carrefour devem ser listadas e permitidas."""
        # 1. Candidatas para Carrefour só devem trazer lojas do Carrefour
        res_cand = self.client.get('/api/faltas/lojas/lojas/candidatas-base/?cliente_codigo=carrefour')
        self.assertEqual(res_cand.status_code, status.HTTP_200_OK)
        nomes_cand = [c['nome_referencia'] for c in res_cand.json()]
        self.assertIn('CARREFOUR OSASCO', nomes_cand)
        self.assertIn('CARREFOUR FECHADA', nomes_cand)
        self.assertNotIn('PROTEGE CAMPINAS', nomes_cand)
        self.assertNotIn('ASSAÍ SÃO PAULO', nomes_cand)

        # 2. Tentativa de adicionar loja do Protege no Carrefour deve ser bloqueada com 400
        res_add_invalida = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_protege.id,
            'cliente_codigo': 'carrefour',
            'desconto_por_falta': 150.0
        })
        self.assertEqual(res_add_invalida.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('não pertence ao cliente Carrefour', res_add_invalida.json()['error'])

        # 3. Tentativa de adicionar loja do Assaí no Carrefour deve ser bloqueada com 400
        res_add_assai = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_assai.id,
            'cliente_codigo': 'carrefour',
            'desconto_por_falta': 150.0
        })
        self.assertEqual(res_add_assai.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('não pertence ao cliente Carrefour', res_add_assai.json()['error'])

        # 4. Adicionar loja válida do Carrefour deve funcionar com sucesso
        res_add_valida = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_ativa.id,
            'cliente_codigo': 'carrefour',
            'desconto_por_falta': 150.0
        })
        self.assertEqual(res_add_valida.status_code, status.HTTP_201_CREATED)

    def test_somente_lojas_protege_permitidas(self):
        """No fechamento Protege, somente lojas pertencentes ao Protege devem ser listadas e permitidas."""
        # 1. Candidatas para Protege só devem trazer lojas do Protege
        res_cand = self.client.get('/api/faltas/lojas/lojas/candidatas-base/?cliente_codigo=protege')
        self.assertEqual(res_cand.status_code, status.HTTP_200_OK)
        nomes_cand = [c['nome_referencia'] for c in res_cand.json()]
        self.assertIn('PROTEGE CAMPINAS', nomes_cand)
        self.assertNotIn('CARREFOUR OSASCO', nomes_cand)
        self.assertNotIn('ASSAÍ SÃO PAULO', nomes_cand)

        # 2. Tentativa de adicionar loja do Carrefour no Protege deve ser bloqueada com 400
        res_add_invalida = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_ativa.id,
            'cliente_codigo': 'protege',
            'desconto_por_falta': 120.0
        })
        self.assertEqual(res_add_invalida.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('não pertence ao cliente Protege', res_add_invalida.json()['error'])

        # 3. Adicionar loja válida do Protege deve funcionar com sucesso
        res_add_valida = self.client.post('/api/faltas/lojas/lojas/adicionar-da-base/', {
            'loja_base_id': self.loja_oficial_protege.id,
            'cliente_codigo': 'protege',
            'desconto_por_falta': 120.0
        })
        self.assertEqual(res_add_valida.status_code, status.HTTP_201_CREATED)

