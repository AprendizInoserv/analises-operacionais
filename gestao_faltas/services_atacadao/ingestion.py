"""Serviço de ingestão segura de arquivos Excel do GeoVictoria.

Lê os arquivos brutos preservando-os integralmente e gerando DataFrames higienizados
e tipados para o pipeline de fechamento.
"""
from typing import Any, Tuple, Optional
import pandas as pd

from .normalizer import (
    normalize_re,
    normalize_cpf,
    normalize_store_name,
    is_excluded_store,
    parse_geovictoria_date,
    parse_duration_to_seconds,
)


def load_controle_ponto(file_path_or_buffer: Any) -> pd.DataFrame:
    """Lê e higieniza o arquivo de Controle de Ponto (`Controledeponto...xlsx`).

    Localiza dinamicamente a linha de cabeçalho na Linha 2, extrai colunas
    e cria campos normalizados sem sobrescrever os originais.
    """
    # Lê as primeiras linhas para identificar a linha do cabeçalho
    preview = pd.read_excel(file_path_or_buffer, nrows=5, header=None)
    header_idx = 1  # Padrão é linha 2 (índice 1)
    for idx, row in preview.iterrows():
        row_str = " ".join([str(v) for v in row.values if pd.notna(v)]).lower()
        if 'sobrenomes' in row_str and 'identificador' in row_str:
            header_idx = int(idx)
            break

    df = pd.read_excel(file_path_or_buffer, header=header_idx)

    # Padroniza nomes de colunas
    df.columns = [str(c).strip() for c in df.columns]

    # Garante colunas mínimas esperadas
    re_col = 'Sobrenomes' if 'Sobrenomes' in df.columns else df.columns[0]
    nome_col = 'Nome' if 'Nome' in df.columns else df.columns[1]
    cpf_col = 'Identificador' if 'Identificador' in df.columns else df.columns[2]
    grupo_col = 'Grupo' if 'Grupo' in df.columns else 'Grupo Usuario'
    data_col = 'Data' if 'Data' in df.columns else 'Fecha'
    permissao_col = 'Permissão' if 'Permissão' in df.columns else 'Permissao'
    turno_col = 'Turno' if 'Turno' in df.columns else 'Turno Programado'
    hec_col = 'HEC' if 'HEC' in df.columns else None
    ht_col = 'HT' if 'HT' in df.columns else None

    # Normalizações preservando original
    re_norm = [normalize_re(v) for v in df[re_col]]
    df['re_clean'] = [r[0] for r in re_norm]
    df['re_valid'] = [r[1] for r in re_norm]

    cpf_norm = [normalize_cpf(v) for v in df[cpf_col]]
    df['cpf_clean'] = [c[0] for c in cpf_norm]
    df['cpf_valid'] = [c[1] for c in cpf_norm]

    df['loja_original'] = df[grupo_col].astype(str)
    df['loja_clean'] = [normalize_store_name(v) for v in df['loja_original']]
    df['is_excluded'] = [is_excluded_store(v) for v in df['loja_clean']]

    df['data_parsed'] = [parse_geovictoria_date(v) for v in df[data_col]]

    # Batidas no espelho
    punch_cols = [c for c in ['Entrou', 'Saiu', 'Entrou.1', 'Saiu.1'] if c in df.columns]
    if punch_cols:
        df['has_punch_ponto'] = df[punch_cols].notna().any(axis=1) & (df[punch_cols] != '').any(axis=1)
    else:
        df['has_punch_ponto'] = False

    # Durações
    if hec_col and hec_col in df.columns:
        df['hec_seconds'] = [parse_duration_to_seconds(v) for v in df[hec_col]]
    else:
        df['hec_seconds'] = 0

    if ht_col and ht_col in df.columns:
        df['ht_seconds'] = [parse_duration_to_seconds(v) for v in df[ht_col]]
    else:
        df['ht_seconds'] = 0

    # Normaliza permissão e turno
    df['permissao_clean'] = df[permissao_col].fillna('Nenhum').astype(str).str.strip()
    df['turno_clean'] = df[turno_col].fillna('').astype(str).str.strip()

    return df


def load_punch_report(file_path_or_buffer: Any) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Lê e higieniza o arquivo de Marcas (`PunchReport_...xlsx`).

    Carrega a aba `Con Marcas` e gera visão agregada diária por colaborador.
    Retorna (df_punch_raw_clean, df_punch_daily).
    """
    df = pd.read_excel(file_path_or_buffer, sheet_name='Con Marcas', header=0)
    df.columns = [str(c).strip() for c in df.columns]

    re_col = 'Apellidos' if 'Apellidos' in df.columns else df.columns[0]
    nome_col = 'Nombre' if 'Nombre' in df.columns else df.columns[1]
    cpf_col = 'Rut' if 'Rut' in df.columns else df.columns[2]
    grupo_col = 'Grupo Usuario' if 'Grupo Usuario' in df.columns else df.columns[3]

    # Data e hora costumam ser colunas 4 e 5 ('Unnamed: 4', 'Unnamed: 5' ou 'Fecha', 'Hora')
    data_col = 'Fecha' if 'Fecha' in df.columns else ('Data' if 'Data' in df.columns else df.columns[4])
    hora_col = 'Hora' if 'Hora' in df.columns else df.columns[5]

    re_norm = [normalize_re(v) for v in df[re_col]]
    df['re_clean'] = [r[0] for r in re_norm]
    df['re_valid'] = [r[1] for r in re_norm]

    cpf_norm = [normalize_cpf(v) for v in df[cpf_col]]
    df['cpf_clean'] = [c[0] for c in cpf_norm]
    df['cpf_valid'] = [c[1] for c in cpf_norm]

    df['loja_original'] = df[grupo_col].astype(str)
    df['loja_clean'] = [normalize_store_name(v) for v in df['loja_original']]
    df['is_excluded'] = [is_excluded_store(v) for v in df['loja_clean']]

    df['data_parsed'] = [parse_geovictoria_date(v) for v in df[data_col]]

    # Agregação diária por colaborador para matching rápido
    # Cada colaborador que tem pelo menos 1 marca no dia
    valid_punches = df[df['re_valid'] & df['data_parsed'].notna()].copy()
    daily_punches = valid_punches.groupby(['re_clean', 'data_parsed']).agg(
        punch_count=('re_clean', 'count'),
        cpf_clean=('cpf_clean', 'first'),
        loja_clean=('loja_clean', 'first'),
    ).reset_index()
    daily_punches['has_punch_report'] = True

    return df, daily_punches
