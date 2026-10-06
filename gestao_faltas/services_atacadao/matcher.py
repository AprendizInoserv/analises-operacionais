"""Motor de cruzamento determinístico multinível vetorizado de alta performance.

Utiliza merges e indexação em Pandas (sem loops iterrows), processando centenas
de milhares de registros em frações de segundo, com detecção estrita de ambiguidade.
"""
from typing import Tuple, List, Dict, Any
import numpy as np
import pandas as pd


def match_ponto_marcas(
    df_ponto: pd.DataFrame, 
    df_marcas_daily: pd.DataFrame
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Executa o cruzamento multinível em cascata vetorizado entre ponto e marcas.

    Hierarquia:
      Nível 1: RE + CPF + Data + Loja
      Nível 2: RE + Data + Loja
      Nível 3: CPF + Data + Loja
      Nível 4: RE + Data

    Retorna:
      - df_matched: DataFrame enriquecido com colunas has_punch_report, punch_count,
                    matching_level, matching_status, matching_motivo.
      - df_inconsistencias: Casos de MATCH_AMBIGUO e MARCA_SEM_PONTO.
    """
    df_p = df_ponto.copy()
    if df_p.empty:
        df_p['has_punch_report'] = False
        df_p['punch_count'] = 0
        df_p['matching_level'] = 'SEM_MATCH'
        df_p['matching_status'] = 'SEM_MATCH'
        df_p['matching_motivo'] = 'Base de ponto vazia'
        orphan_records = []
        if not df_marcas_daily.empty:
            for r in df_marcas_daily.itertuples():
                orphan_records.append({
                    'tipo': 'MARCA_SEM_PONTO',
                    're': r.re_clean,
                    'cpf': r.cpf_clean,
                    'data': r.data_parsed,
                    'loja': r.loja_clean,
                    'nivel': 'SEM_MATCH',
                    'detalhe': 'Marca física presente no PunchReport sem escala no Controle de Ponto'
                })
        return df_p, pd.DataFrame(orphan_records)

    df_m = df_marcas_daily.copy()
    df_p['original_index'] = df_p.index

    # Inicialização de colunas
    df_p['has_punch_report'] = False
    df_p['punch_count'] = 0
    df_p['matching_level'] = 'SEM_MATCH'
    df_p['matching_status'] = 'SEM_MATCH'
    df_p['matching_motivo'] = 'Nenhuma marcação física correspondente encontrada'

    if df_m.empty:
        df_p.drop(columns=['original_index'], inplace=True, errors='ignore')
        return df_p, pd.DataFrame(columns=['tipo', 're', 'cpf', 'data', 'loja', 'nivel', 'detalhe'])

    # Preparação das tabelas agregadas de candidatos em df_m
    # Nível 1: (RE, CPF, Data, Loja)
    lvl1_cand = df_m.groupby(['re_clean', 'cpf_clean', 'data_parsed', 'loja_clean']).agg(
        punch_count_l1=('punch_count', 'sum'),
        cand_count_l1=('re_clean', 'count')
    ).reset_index()

    # Nível 2: (RE, Data, Loja) - ambíguo se múltiplos CPFs válidos distintos
    lvl2_cand = df_m[df_m['re_clean'] != ''].groupby(['re_clean', 'data_parsed', 'loja_clean']).agg(
        punch_count_l2=('punch_count', 'sum'),
        cand_count_l2=('cpf_clean', lambda s: len(set(x for x in s if x)))
    ).reset_index()

    # Nível 3: (CPF, Data, Loja) - ambíguo se múltiplos REs distintos
    valid_cpf_m = df_m[(df_m['cpf_clean'] != '') & (df_m['cpf_clean'].str.len() == 11)]
    lvl3_cand = valid_cpf_m.groupby(['cpf_clean', 'data_parsed', 'loja_clean']).agg(
        punch_count_l3=('punch_count', 'sum'),
        cand_count_l3=('re_clean', 'nunique')
    ).reset_index()

    # Nível 4: (RE, Data) - ambíguo se múltiplas lojas
    lvl4_cand = df_m[df_m['re_clean'] != ''].groupby(['re_clean', 'data_parsed']).agg(
        punch_count_l4=('punch_count', 'sum'),
        cand_count_l4=('loja_clean', 'nunique')
    ).reset_index()

    matched_re_data = set()
    inconsistencias: List[Dict[str, Any]] = []

    # --- Execução em cascata vetorizada ---
    # 1. Nível 1
    unmatched_mask = df_p['matching_status'] == 'SEM_MATCH'
    m1 = df_p[unmatched_mask].merge(
        lvl1_cand,
        on=['re_clean', 'cpf_clean', 'data_parsed', 'loja_clean'],
        how='inner'
    )
    if not m1.empty:
        for r in m1.itertuples():
            idx = r.original_index
            if r.cand_count_l1 > 1:
                df_p.at[idx, 'matching_level'] = 'NIVEL_1'
                df_p.at[idx, 'matching_status'] = 'MATCH_AMBIGUO'
                df_p.at[idx, 'matching_motivo'] = f'Múltiplos candidatos ({r.cand_count_l1}) no Nível 1'
                inconsistencias.append({
                    'tipo': 'MATCH_AMBIGUO',
                    're': r.re_clean,
                    'cpf': r.cpf_clean,
                    'data': r.data_parsed,
                    'loja': r.loja_clean,
                    'nivel': 'NIVEL_1',
                    'detalhe': 'Múltiplos candidatos no Nível 1'
                })
            else:
                df_p.at[idx, 'has_punch_report'] = True
                df_p.at[idx, 'punch_count'] = int(r.punch_count_l1)
                df_p.at[idx, 'matching_level'] = 'NIVEL_1'
                df_p.at[idx, 'matching_status'] = 'MATCH_CONFIRMADO'
                df_p.at[idx, 'matching_motivo'] = 'Correspondência exata: RE + CPF + Data + Loja'
                matched_re_data.add((r.re_clean, r.data_parsed))

    # 2. Nível 2
    unmatched_mask = df_p['matching_status'] == 'SEM_MATCH'
    m2 = df_p[unmatched_mask & (df_p['re_clean'] != '')].merge(
        lvl2_cand,
        on=['re_clean', 'data_parsed', 'loja_clean'],
        how='inner'
    )
    if not m2.empty:
        for r in m2.itertuples():
            idx = r.original_index
            if r.cand_count_l2 > 1:
                df_p.at[idx, 'matching_level'] = 'NIVEL_2'
                df_p.at[idx, 'matching_status'] = 'MATCH_AMBIGUO'
                df_p.at[idx, 'matching_motivo'] = f'Múltiplos CPFs distintos ({r.cand_count_l2}) no Nível 2'
                inconsistencias.append({
                    'tipo': 'MATCH_AMBIGUO',
                    're': r.re_clean,
                    'cpf': r.cpf_clean,
                    'data': r.data_parsed,
                    'loja': r.loja_clean,
                    'nivel': 'NIVEL_2',
                    'detalhe': 'Múltiplos CPFs distintos para mesmo RE no Nível 2'
                })
            else:
                df_p.at[idx, 'has_punch_report'] = True
                df_p.at[idx, 'punch_count'] = int(r.punch_count_l2)
                df_p.at[idx, 'matching_level'] = 'NIVEL_2'
                df_p.at[idx, 'matching_status'] = 'MATCH_CONFIRMADO'
                df_p.at[idx, 'matching_motivo'] = 'Correspondência: RE + Data + Loja'
                matched_re_data.add((r.re_clean, r.data_parsed))

    # 3. Nível 3
    unmatched_mask = df_p['matching_status'] == 'SEM_MATCH'
    valid_cpf_p = df_p[unmatched_mask & (df_p['cpf_clean'] != '') & (df_p['cpf_clean'].str.len() == 11)]
    m3 = valid_cpf_p.merge(
        lvl3_cand,
        on=['cpf_clean', 'data_parsed', 'loja_clean'],
        how='inner'
    )
    if not m3.empty:
        for r in m3.itertuples():
            idx = r.original_index
            if r.cand_count_l3 > 1:
                df_p.at[idx, 'matching_level'] = 'NIVEL_3'
                df_p.at[idx, 'matching_status'] = 'MATCH_AMBIGUO'
                df_p.at[idx, 'matching_motivo'] = f'Múltiplos REs distintos ({r.cand_count_l3}) no Nível 3'
                inconsistencias.append({
                    'tipo': 'MATCH_AMBIGUO',
                    're': r.re_clean,
                    'cpf': r.cpf_clean,
                    'data': r.data_parsed,
                    'loja': r.loja_clean,
                    'nivel': 'NIVEL_3',
                    'detalhe': 'Múltiplos REs distintos para mesmo CPF no Nível 3'
                })
            else:
                df_p.at[idx, 'has_punch_report'] = True
                df_p.at[idx, 'punch_count'] = int(r.punch_count_l3)
                df_p.at[idx, 'matching_level'] = 'NIVEL_3'
                df_p.at[idx, 'matching_status'] = 'MATCH_CONFIRMADO'
                df_p.at[idx, 'matching_motivo'] = 'Correspondência: CPF + Data + Loja'
                matched_re_data.add((r.re_clean, r.data_parsed))

    # 4. Nível 4
    unmatched_mask = df_p['matching_status'] == 'SEM_MATCH'
    m4 = df_p[unmatched_mask & (df_p['re_clean'] != '')].merge(
        lvl4_cand,
        on=['re_clean', 'data_parsed'],
        how='inner'
    )
    if not m4.empty:
        for r in m4.itertuples():
            idx = r.original_index
            if r.cand_count_l4 > 1:
                df_p.at[idx, 'matching_level'] = 'NIVEL_4'
                df_p.at[idx, 'matching_status'] = 'MATCH_AMBIGUO'
                df_p.at[idx, 'matching_motivo'] = f'Múltiplas lojas ({r.cand_count_l4}) encontradas no Nível 4'
                inconsistencias.append({
                    'tipo': 'MATCH_AMBIGUO',
                    're': r.re_clean,
                    'cpf': r.cpf_clean,
                    'data': r.data_parsed,
                    'loja': r.loja_clean,
                    'nivel': 'NIVEL_4',
                    'detalhe': 'Múltiplas lojas encontradas no Nível 4'
                })
            else:
                df_p.at[idx, 'has_punch_report'] = True
                df_p.at[idx, 'punch_count'] = int(r.punch_count_l4)
                df_p.at[idx, 'matching_level'] = 'NIVEL_4'
                df_p.at[idx, 'matching_status'] = 'MATCH_CONFIRMADO'
                df_p.at[idx, 'matching_motivo'] = 'Correspondência: RE + Data em outra unidade'
                matched_re_data.add((r.re_clean, r.data_parsed))

    # Identificar marcas órfãs (colaborador bateu ponto físico mas não consta no espelho)
    for r in df_m.itertuples():
        if (r.re_clean, r.data_parsed) not in matched_re_data and r.re_clean and r.data_parsed:
            inconsistencias.append({
                'tipo': 'MARCA_SEM_PONTO',
                're': r.re_clean,
                'cpf': r.cpf_clean,
                'data': r.data_parsed,
                'loja': r.loja_clean,
                'nivel': 'SEM_MATCH',
                'detalhe': 'Marca física presente no PunchReport sem escala correspondente no Controle de Ponto'
            })

    df_p.drop(columns=['original_index'], inplace=True, errors='ignore')
    df_inconsistencias = pd.DataFrame(inconsistencias) if inconsistencias else pd.DataFrame(
        columns=['tipo', 're', 'cpf', 'data', 'loja', 'nivel', 'detalhe']
    )

    return df_p, df_inconsistencias
