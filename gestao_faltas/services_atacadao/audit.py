"""Serviço de auditoria detalhada e consolidação de inconsistências.

Gera a trilha de auditoria completa por colaborador/dia e cataloga todas as divergências
para o painel de conferência e aba INCONSISTÊNCIAS do Excel.
"""
from typing import List, Dict, Any
import pandas as pd


def build_colaborador_audit_trail(df_classified: pd.DataFrame) -> pd.DataFrame:
    """Estrutura a visão analítica completa de auditoria por colaborador/dia."""
    columns_map = {
        're_clean': 'RE',
        'cpf_clean': 'CPF',
        'Nome': 'Nome',
        'loja_clean': 'Loja',
        'data_parsed': 'Data',
        'permissao_clean': 'Permissão',
        'turno_clean': 'Turno',
        'has_punch_ponto': 'Marca no Ponto',
        'has_punch_report': 'Marca no PunchReport',
        'punch_count': 'Qtd Marcas Físicas',
        'matching_level': 'Nível do Matching',
        'matching_status': 'Status do Matching',
        'final_status': 'Classificação Final',
        'status_motivo': 'Motivo da Classificação',
        'ht_seconds': 'HT (segundos)',
        'hec_seconds': 'HEC (segundos)',
    }

    # Seleciona apenas colunas existentes
    existing_cols = [c for c in columns_map.keys() if c in df_classified.columns]
    audit_df = df_classified[existing_cols].copy()
    audit_df.rename(columns=columns_map, inplace=True)
    return audit_df


def catalog_all_inconsistencies(
    df_ponto: pd.DataFrame,
    df_matched: pd.DataFrame,
    df_matcher_inconsistencias: pd.DataFrame
) -> pd.DataFrame:
    """Consolida todas as divergências operacionais detectadas no processamento."""
    records: List[Dict[str, Any]] = []

    # 1. Herda as inconsistências do matcher (MATCH_AMBIGUO, MARCA_SEM_PONTO)
    if not df_matcher_inconsistencias.empty:
        for _, r in df_matcher_inconsistencias.iterrows():
            records.append({
                'tipo': r.get('tipo', 'INCONSISTENCIA'),
                're': r.get('re', ''),
                'cpf': r.get('cpf', ''),
                'data': r.get('data', ''),
                'loja': r.get('loja', ''),
                'detalhe': r.get('detalhe', ''),
            })

    # 2. CPFs inválidos no ponto
    cpfs_invalidos = df_ponto[~df_ponto['cpf_valid'] & df_ponto['cpf_clean'].notna() & (df_ponto['cpf_clean'] != '')]
    for _, r in cpfs_invalidos.iterrows():
        records.append({
            'tipo': 'CPF_INVALIDO',
            're': r.get('re_clean', ''),
            'cpf': str(r.get('Identificador', '')),
            'data': r.get('data_parsed', ''),
            'loja': r.get('loja_clean', ''),
            'detalhe': f"CPF não possui 11 dígitos numéricos: '{r.get('Identificador', '')}'",
        })

    # 3. REs inválidos no ponto
    res_invalidos = df_ponto[~df_ponto['re_valid']]
    for _, r in res_invalidos.iterrows():
        records.append({
            'tipo': 'RE_INVALIDO',
            're': str(r.get('Sobrenomes', '')),
            'cpf': r.get('cpf_clean', ''),
            'data': r.get('data_parsed', ''),
            'loja': r.get('loja_clean', ''),
            'detalhe': f"Matrícula/RE sem dígitos numéricos válidos: '{r.get('Sobrenomes', '')}'",
        })

    # 4. Batida durante afastamento/férias
    afastamento_com_marca = df_matched[
        df_matched['final_status'].isin(['AFASTAMENTO']) & 
        (df_matched['has_punch_ponto'] | df_matched['has_punch_report'])
    ]
    for _, r in afastamento_com_marca.iterrows():
        records.append({
            'tipo': 'MARCA_DURANTE_AFASTAMENTO',
            're': r.get('re_clean', ''),
            'cpf': r.get('cpf_clean', ''),
            'data': r.get('data_parsed', ''),
            'loja': r.get('loja_clean', ''),
            'detalhe': f"Marcação de ponto detectada durante período de afastamento/férias ({r.get('permissao_clean')})",
        })

    if not records:
        return pd.DataFrame(columns=['tipo', 're', 'cpf', 'data', 'loja', 'detalhe'])

    df_inc = pd.DataFrame(records)
    # Remove duplicados idênticos
    df_inc.drop_duplicates(inplace=True)
    return df_inc
