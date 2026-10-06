"""Motor de cálculo vetorizado de fechamento diário e mensal.

Executa a classificação individual de colaboradores, consolidação diária por loja,
agregação de grupos compartilhados, cálculo de horas trabalhadas e fechamento de KPIs.
"""
import calendar
from datetime import date
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd

from .settings_fechamento import (
    OUTRAS_FOLGAS_PERMISSIONS,
    AFASTAMENTOS_PERMISSIONS,
    SharedStoreGroup,
    DEFAULT_SHARED_GROUPS,
    DEFAULT_HEC_EQUIVALENCIA_MINUTOS,
)
from .normalizer import format_seconds_to_hhhmm


def calculate_business_days(ano: int, mes: int) -> int:
    """Calcula os dias úteis do mês (Segunda-feira a Sábado).

    Domingos são excluídos automaticamente. Feriados não são excluídos por padrão.
    """
    _, num_days = calendar.monthrange(ano, mes)
    business_days = 0
    for day in range(1, num_days + 1):
        d = date(ano, mes, day)
        # weekday(): 0=Segunda, 5=Sábado, 6=Domingo
        if d.weekday() < 6:
            business_days += 1
    return business_days


def classify_daily_records(df_matched: pd.DataFrame) -> pd.DataFrame:
    """Classifica cada registro de colaborador/dia na matriz de decisão formalizada de forma vetorizada."""
    df = df_matched.copy()
    if df.empty:
        df['final_status'] = []
        df['status_motivo'] = []
        return df

    import numpy as np

    # Identifica se houve marcação em qualquer das fontes
    has_p = df['has_punch_ponto'] | df['has_punch_report']
    is_atestado = df['permissao_clean'] == 'Atestado Médico'
    is_outras_folgas = df['permissao_clean'].isin(OUTRAS_FOLGAS_PERMISSIONS)
    is_afastamento = df['permissao_clean'].isin(AFASTAMENTOS_PERMISSIONS)
    is_descanso = (df['turno_clean'] == 'Descanso') & (df['permissao_clean'].isin(['Nenhum', '', 'None']))
    is_falta = df['permissao_clean'] == 'Falta'

    conditions = [
        is_atestado,
        is_outras_folgas,
        is_afastamento,
        has_p,
        ~has_p & is_descanso,
    ]
    status_choices = [
        'ATESTADO_MEDICO',
        'OUTRAS_FOLGAS',
        'AFASTAMENTO',
        'PRESENCA',
        'FOLGA_REGULAR',
    ]
    motivo_choices = [
        'Atestado Médico cadastrado no Controle de Ponto',
        'Folga especial regular / feriado cadastrado',
        'Afastamento legal / férias',
        'Presença confirmada por marcação válida de trabalho',
        'Turno Descanso com Permissão Nenhum e sem marcação',
    ]

    df['final_status'] = np.select(conditions, status_choices, default='FALTA_OPERACIONAL')
    df['status_motivo'] = np.select(conditions, motivo_choices, default='Colaborador escalado que não compareceu ao posto sem justificativa')

    return df


def apply_shared_groups(
    df: pd.DataFrame, 
    shared_groups: Optional[List[SharedStoreGroup]] = None
) -> pd.DataFrame:
    """Mapeia filiais de grupos compartilhados para o nome do grupo consolidado."""
    df_out = df.copy()
    if not shared_groups:
        shared_groups = DEFAULT_SHARED_GROUPS

    mapping: Dict[str, str] = {}
    for grp in shared_groups:
        if grp.ativo:
            for membro in grp.lojas_membros:
                mapping[membro] = grp.nome_grupo
                # Mapeia também versão tratada
                from .normalizer import normalize_store_name
                mapping[normalize_store_name(membro)] = grp.nome_grupo

    df_out['loja_fechamento'] = df_out['loja_clean'].apply(lambda x: mapping.get(x, x))
    return df_out


def aggregate_store_daily(
    df_classified: pd.DataFrame,
    shared_groups: Optional[List[SharedStoreGroup]] = None,
    diarias_map: Optional[Dict[Tuple[str, date], int]] = None,
    hec_minutos_limite: int = DEFAULT_HEC_EQUIVALENCIA_MINUTOS
) -> pd.DataFrame:
    """Agrega os registros diários por loja e data, calculando os indicadores diários.

    Aplica deduplicação: cada colaborador gera no máximo 1 presença no dia.
    """
    df = apply_shared_groups(df_classified, shared_groups)

    # Filtra lojas excluídas
    df = df[~df['is_excluded']].copy()
    df['loja_fechamento'] = df['loja_fechamento'].fillna('').astype(str).str.strip()
    df.loc[df['loja_fechamento'] == '', 'loja_fechamento'] = 'SEM FILIAL DEFINIDA'

    # Deduplicação diária por colaborador para presenças e folgas
    # Se colaborador tem múltiplos registros no mesmo dia com PRESENCA, conta 1 presença
    records = []
    grouped = df.groupby(['loja_fechamento', 'data_parsed'])

    for (loja, data_val), group in grouped:
        if not data_val:
            continue

        # Colaboradores únicos por status
        colabs_presenca = group[group['final_status'] == 'PRESENCA']['re_clean'].unique()
        colabs_folga = group[group['final_status'] == 'FOLGA_REGULAR']['re_clean'].unique()
        colabs_outras = group[group['final_status'] == 'OUTRAS_FOLGAS']['re_clean'].unique()
        colabs_atestado = group[group['final_status'] == 'ATESTADO_MEDICO']['re_clean'].unique()
        colabs_falta = group[group['final_status'] == 'FALTA_OPERACIONAL']['re_clean'].unique()

        presenca_count = len(colabs_presenca)
        folga_count = len(colabs_folga)
        outras_folgas_count = len(colabs_outras)
        atestado_count = len(colabs_atestado)
        falta_operacional_count = len(colabs_falta)

        # Diárias (sistema TOTVS + manuais complementares)
        diarias_count = 0
        if diarias_map:
            if (loja, data_val) in diarias_map:
                diarias_count = diarias_map[(loja, data_val)]
            else:
                l_clean = clean_store_text(loja)
                for (d_loja, d_date), cnt in diarias_map.items():
                    if d_date == data_val and clean_store_text(d_loja) == l_clean:
                        diarias_count += cnt


        # Horas
        ht_sec = int(group['ht_seconds'].sum())
        hec_sec = int(group['hec_seconds'].sum())
        hec_minutes = hec_sec // 60

        # Conversão HEC = DIA
        hec_dia = 0
        saldo_hec_min = hec_minutes
        if hec_minutos_limite > 0:
            hec_dia = hec_minutes // hec_minutos_limite
            saldo_hec_min = hec_minutes % hec_minutos_limite

        # Resultado do dia
        resultado_dia = presenca_count + outras_folgas_count + diarias_count + hec_dia

        records.append({
            'loja': loja,
            'data': data_val,
            'dia_semana': data_val.strftime('%a'),
            'presenca': presenca_count,
            'folga': folga_count,
            'outras_folgas': outras_folgas_count,
            'atestado': atestado_count,
            'diarias': diarias_count,
            'hec_dia': hec_dia,
            'resultado': resultado_dia,
            'falta_operacional': falta_operacional_count,
            'ht_seconds': ht_sec,
            'hec_seconds': hec_sec,
            'ht_formatted': format_seconds_to_hhhmm(ht_sec),
            'hec_formatted': format_seconds_to_hhhmm(hec_sec),
            'saldo_hec_minutos': saldo_hec_min,
        })

    df_daily = pd.DataFrame(records)
    if not df_daily.empty:
        df_daily.sort_values(by=['loja', 'data'], inplace=True)
    return df_daily


STORE_SYNONYMS = {
    'pres': 'presidente',
    'sjc': 'sao jose dos campos',
    'sjcampos': 'sao jose dos campos',
    'rib': 'ribeirao',
    'pato': 'patos',
    'cachoerinha': 'cachoeirinha',
    'cajamar': 'cajamar',
    'anhanguera': 'anhanguera',
}

GENERIC_STORE_WORDS = {
    'atacadao', 'assai', 'sendas', 'atacadista', 'loja', 'lj',
    'de', 'do', 'da', 'e', 'em', 'cd', 'vinicius', 'hiper', 'grupo'
}


def clean_store_text(s: str) -> str:
    import unicodedata
    import re
    s_norm = unicodedata.normalize('NFKD', str(s)).encode('ASCII', 'ignore').decode('utf-8').lower()
    return re.sub(r'[^a-z0-9]', ' ', s_norm)


def get_store_quadro(loja: str, quadros_map: Dict[str, int]) -> int:
    """Busca o quadro da loja com suporte a correspondência difusa, códigos de filial e sinônimos."""
    if not loja or not quadros_map:
        return 0

    # 1. Correspondência exata direta
    if loja in quadros_map:
        return quadros_map[loja]

    l_clean = clean_store_text(loja)

    # 2. Correspondência exata normalizada
    for k, v in quadros_map.items():
        if l_clean == clean_store_text(k):
            return v

    import re

    is_assai = 'assai' in l_clean or 'sendas' in l_clean
    is_atacadao = 'atacadao' in l_clean

    l_nums = set(re.findall(r'\b\d+\b', l_clean))
    raw_l_words = re.findall(r'\b[a-z]+\b', l_clean)
    expanded_l = []
    for w in raw_l_words:
        if w in STORE_SYNONYMS:
            expanded_l.extend(STORE_SYNONYMS[w].split())
        else:
            expanded_l.append(w)
    l_words = set(expanded_l) - GENERIC_STORE_WORDS

    best_cand = None
    best_score = 0.0

    for k, v in quadros_map.items():
        k_clean = clean_store_text(k)
        k_assai = 'assai' in k_clean or 'sendas' in k_clean
        k_atacadao = 'atacadao' in k_clean

        # Respeita bandeira da rede (não mistura Assaí com Atacadão)
        if is_assai and k_atacadao and not k_assai:
            continue
        if is_atacadao and k_assai and not k_atacadao:
            continue

        k_nums = set(re.findall(r'\b\d+\b', k_clean))
        raw_k_words = re.findall(r'\b[a-z]+\b', k_clean)
        expanded_k = []
        for w in raw_k_words:
            if w in STORE_SYNONYMS:
                expanded_k.extend(STORE_SYNONYMS[w].split())
            else:
                expanded_k.append(w)
        k_words = set(expanded_k) - GENERIC_STORE_WORDS

        if not l_words or not k_words:
            continue

        # Evita misturar números romanos de filiais (ex: I vs II vs III)
        romanos = {'i', 'ii', 'iii', 'iv', 'v'}
        l_rom = l_words & romanos
        k_rom = k_words & romanos
        if l_rom and k_rom and l_rom != k_rom:
            continue

        num_conflict = bool(l_nums and k_nums and not (l_nums & k_nums))
        inter = l_words & k_words
        if not inter:
            continue

        if not num_conflict and l_words == k_words:
            score = 1.0
        elif (l_nums & k_nums) and len(inter) >= 1:
            score = 0.95 + 0.05 * (len(inter) / max(len(l_words), len(k_words)))
        elif not num_conflict and (inter == l_words or inter == k_words):
            score = 0.85 + 0.1 * (len(inter) / max(len(l_words), len(k_words)))
        elif not num_conflict:
            jaccard = len(inter) / len(l_words | k_words)
            overlap = len(inter) / min(len(l_words), len(k_words))
            score = 0.5 * jaccard + 0.5 * overlap
        else:
            score = 0.0

        if score > best_score:
            best_score = score
            best_cand = (k, v, score)

    if best_cand and best_score >= 0.45:
        return best_cand[1]

    return 0


def calculate_monthly_summary(
    df_daily: pd.DataFrame,
    quadros_map: Dict[str, int],
    ano: int,
    mes: int,
    hec_minutos_limite: int = DEFAULT_HEC_EQUIVALENCIA_MINUTOS
) -> pd.DataFrame:
    """Calcula o resumo mensal por loja, incluindo Quadro, Esperado, Comparativo e Faltas Operacionais."""
    if df_daily.empty:
        return pd.DataFrame()

    dias_uteis = calculate_business_days(ano, mes)
    summary_records = []

    for loja, group in df_daily.groupby('loja'):
        quadro = get_store_quadro(loja, quadros_map)
        total_esperado = quadro * dias_uteis

        presencas = int(group['presenca'].sum())
        folgas = int(group['folga'].sum())
        outras_folgas = int(group['outras_folgas'].sum())
        atestados = int(group['atestado'].sum())
        diarias = int(group['diarias'].sum())
        hec_dias = int(group['hec_dia'].sum())
        resultado = int(group['resultado'].sum())
        faltas_op = int(group['falta_operacional'].sum())

        comparativo = total_esperado - resultado

        ht_sec = int(group['ht_seconds'].sum())
        hec_sec = int(group['hec_seconds'].sum())

        summary_records.append({
            'loja': loja,
            'quadro': quadro,
            'dias_uteis': dias_uteis,
            'total_esperado': total_esperado,
            'presencas': presencas,
            'folgas': folgas,
            'outras_folgas': outras_folgas,
            'atestados': atestados,
            'diarias': diarias,
            'hec_dia': hec_dias,
            'resultado': resultado,
            'comparativo': comparativo,
            'faltas_operacionais': faltas_op,
            'ht_seconds': ht_sec,
            'hec_seconds': hec_sec,
            'ht_formatted': format_seconds_to_hhhmm(ht_sec),
            'hec_formatted': format_seconds_to_hhhmm(hec_sec),
        })

    df_summary = pd.DataFrame(summary_records)
    if not df_summary.empty:
        df_summary.sort_values(by='loja', inplace=True)
    return df_summary
