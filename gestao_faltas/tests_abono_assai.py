from datetime import date
from django.test import TestCase
import pandas as pd
from gestao_faltas.services_atacadao.calculator import (
    classify_daily_records,
    aggregate_store_daily,
    calculate_monthly_summary,
    is_assai_store,
)


class AssaiAtestadoAbonoTestCase(TestCase):
    def test_abono_exclusivo_assai(self):
        """
        Regra:
        - Cada colaborador do ASSAI tem direito a 1 abono de atestado por mês.
        - Se tiver 2 dias de atestado: 1 conta para presença e o outro não.
        - No Atacadão: nenhum atestado é abonado.
        - No relatório: os atestados continuam sendo exibidos.
        """
        records = [
            # Colab 1 (Assaí): 2 atestados (dia 1 e dia 2)
            {
                're_clean': '101', 'cpf_clean': '111', 'Nome': 'João Assaí',
                'loja_clean': 'ASSAI BRASILIA SUL 51', 'data_parsed': date(2026, 8, 1),
                'permissao_clean': 'Atestado Médico', 'turno_clean': 'Manhã',
                'has_punch_ponto': False, 'has_punch_report': False,
                'is_excluded': False, 'ht_seconds': 0, 'hec_seconds': 0
            },
            {
                're_clean': '101', 'cpf_clean': '111', 'Nome': 'João Assaí',
                'loja_clean': 'ASSAI BRASILIA SUL 51', 'data_parsed': date(2026, 8, 2),
                'permissao_clean': 'Atestado Médico', 'turno_clean': 'Manhã',
                'has_punch_ponto': False, 'has_punch_report': False,
                'is_excluded': False, 'ht_seconds': 0, 'hec_seconds': 0
            },
            # Colab 2 (Assaí): 1 atestado (dia 2)
            {
                're_clean': '102', 'cpf_clean': '222', 'Nome': 'Maria Assaí',
                'loja_clean': 'ASSAI BRASILIA SUL 51', 'data_parsed': date(2026, 8, 2),
                'permissao_clean': 'Atestado Médico', 'turno_clean': 'Manhã',
                'has_punch_ponto': False, 'has_punch_report': False,
                'is_excluded': False, 'ht_seconds': 0, 'hec_seconds': 0
            },
            # Colab 3 (Atacadão): 2 atestados (dia 1 e dia 2)
            {
                're_clean': '103', 'cpf_clean': '333', 'Nome': 'Carlos Atacadão',
                'loja_clean': 'ATACADAO ANCHIETA 269', 'data_parsed': date(2026, 8, 1),
                'permissao_clean': 'Atestado Médico', 'turno_clean': 'Manhã',
                'has_punch_ponto': False, 'has_punch_report': False,
                'is_excluded': False, 'ht_seconds': 0, 'hec_seconds': 0
            },
            {
                're_clean': '103', 'cpf_clean': '333', 'Nome': 'Carlos Atacadão',
                'loja_clean': 'ATACADAO ANCHIETA 269', 'data_parsed': date(2026, 8, 2),
                'permissao_clean': 'Atestado Médico', 'turno_clean': 'Manhã',
                'has_punch_ponto': False, 'has_punch_report': False,
                'is_excluded': False, 'ht_seconds': 0, 'hec_seconds': 0
            },
        ]
        df_matched = pd.DataFrame(records)

        # 1. Classificação
        df_classified = classify_daily_records(df_matched)

        # Verifica marcação individual de abono
        joao_d1 = df_classified[(df_classified['re_clean'] == '101') & (df_classified['data_parsed'] == date(2026, 8, 1))].iloc[0]
        joao_d2 = df_classified[(df_classified['re_clean'] == '101') & (df_classified['data_parsed'] == date(2026, 8, 2))].iloc[0]
        maria_d2 = df_classified[(df_classified['re_clean'] == '102') & (df_classified['data_parsed'] == date(2026, 8, 2))].iloc[0]
        carlos_d1 = df_classified[(df_classified['re_clean'] == '103') & (df_classified['data_parsed'] == date(2026, 8, 1))].iloc[0]

        self.assertTrue(joao_d1['atestado_abonado'], "Primeiro dia de atestado de João no Assaí deve ser abonado")
        self.assertFalse(joao_d2['atestado_abonado'], "Segundo dia de atestado de João no Assaí NÃO deve ser abonado")
        self.assertTrue(maria_d2['atestado_abonado'], "Único dia de atestado de Maria no Assaí deve ser abonado")
        self.assertFalse(carlos_d1['atestado_abonado'], "Atestados no Atacadão NÃO devem ser abonados")

        # 2. Agregação Diária
        df_daily = aggregate_store_daily(df_classified)

        # Assaí dia 1: João abonado -> presenca=1, atestado=1, resultado=1
        assai_d1 = df_daily[(df_daily['loja'] == 'ASSAI BRASILIA SUL 51') & (df_daily['data'] == date(2026, 8, 1))].iloc[0]
        self.assertEqual(assai_d1['presenca'], 1)
        self.assertEqual(assai_d1['atestado'], 1)
        self.assertEqual(assai_d1['resultado'], 1)
        self.assertEqual(assai_d1['atestados_abonados'], 1)

        # Assaí dia 2: João não abonado + Maria abonada -> presenca=1, atestado=2, resultado=1
        assai_d2 = df_daily[(df_daily['loja'] == 'ASSAI BRASILIA SUL 51') & (df_daily['data'] == date(2026, 8, 2))].iloc[0]
        self.assertEqual(assai_d2['presenca'], 1)
        self.assertEqual(assai_d2['atestado'], 2)  # Ambos continuam aparecendo no relatório!
        self.assertEqual(assai_d2['resultado'], 1)
        self.assertEqual(assai_d2['atestados_abonados'], 1)

        # Atacadão dia 1: Carlos não abonado -> presenca=0, atestado=1, resultado=0
        atacadao_d1 = df_daily[(df_daily['loja'] == 'ATACADAO ANCHIETA 269') & (df_daily['data'] == date(2026, 8, 1))].iloc[0]
        self.assertEqual(atacadao_d1['presenca'], 0)
        self.assertEqual(atacadao_d1['atestado'], 1)
        self.assertEqual(atacadao_d1['resultado'], 0)
        self.assertEqual(atacadao_d1['atestados_abonados'], 0)

        # 3. Resumo Mensal
        quadros_map = {'ASSAI BRASILIA SUL 51': 19, 'ATACADAO ANCHIETA 269': 14}
        df_summary = calculate_monthly_summary(df_daily, quadros_map=quadros_map, ano=2026, mes=8)

        assai_sum = df_summary[df_summary['loja'] == 'ASSAI BRASILIA SUL 51'].iloc[0]
        self.assertEqual(assai_sum['presencas'], 2)
        self.assertEqual(assai_sum['atestados'], 3)  # Todos os 3 atestados continuam visíveis no relatório
        self.assertEqual(assai_sum['resultado'], 2)
        self.assertEqual(assai_sum['atestados_abonados'], 2)

        atacadao_sum = df_summary[df_summary['loja'] == 'ATACADAO ANCHIETA 269'].iloc[0]
        self.assertEqual(atacadao_sum['presencas'], 0)
        self.assertEqual(atacadao_sum['atestados'], 2)
        self.assertEqual(atacadao_sum['resultado'], 0)
        self.assertEqual(atacadao_sum['atestados_abonados'], 0)
