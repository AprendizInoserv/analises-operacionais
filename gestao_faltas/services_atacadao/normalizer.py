"""Serviço de normalização e higienização de dados.

Garante que REs, CPFs, nomes de lojas, datas e durações sejam padronizados
de forma determinística, sem sobrescrever os dados originais.
"""
import re
from datetime import date, datetime, timedelta
from typing import Any, Tuple, Optional, List
import pandas as pd

from .settings_fechamento import (
    EXCLUDED_STORE_PATTERNS,
    STORE_NAME_MAPPING,
)


def normalize_re(val: Any) -> Tuple[str, bool]:
    """Normaliza matrícula (RE).

    Converte 'APX' para 'RE', extrai dígitos via regex e valida o formato.
    Retorna (re_normalizado, is_valid).
    """
    if pd.isna(val) or val is None:
        return "", False
    s = str(val).strip()
    s = re.sub(r'(?i)apx', 'RE', s)
    digits = re.findall(r'\d+', s)
    if digits:
        re_clean = "".join(digits)
        return re_clean, True
    return s, False


def normalize_cpf(val: Any) -> Tuple[str, bool]:
    """Normaliza CPF para exatamente 11 dígitos numéricos.

    Remove sufixos flutuantes '.0', caracteres não numéricos e preenche com zeros à esquerda
    caso tenha entre 9 e 10 dígitos.
    Retorna (cpf_11d, is_valid).
    """
    if pd.isna(val) or val is None:
        return "", False
    s = str(val).strip()
    if s.endswith('.0'):
        s = s[:-2]
    clean_digits = re.sub(r'\D', '', s)
    if 9 <= len(clean_digits) <= 10:
        clean_digits = clean_digits.zfill(11)
    is_valid = len(clean_digits) == 11
    return clean_digits, is_valid


def normalize_store_name(store_name: Any) -> str:
    """Normaliza o nome da loja.

    Remove prefixo do supervisor ('Vinicius - '), aplica mapeamentos de nomes longos
    e remove espaços excedentes.
    """
    if pd.isna(store_name) or store_name is None:
        return ""
    s = str(store_name).strip()
    s = re.sub(r'^Vinicius\s*-\s*', '', s, flags=re.IGNORECASE)
    # Verifica mapeamento direto
    if s in STORE_NAME_MAPPING:
        s = STORE_NAME_MAPPING[s]
    # Remove espaços múltiplos
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def is_excluded_store(store_name: Any) -> bool:
    """Verifica se a loja pertence à lista de excluídas (Lapdarte, APS, Dia, Fort, Protege)."""
    if pd.isna(store_name) or store_name is None:
        return False
    s_lower = str(store_name).lower()
    for pattern in EXCLUDED_STORE_PATTERNS:
        if pattern in s_lower:
            return True
    return False


def parse_geovictoria_date(val: Any) -> Optional[date]:
    """Converte valores de data do GeoVictoria (datetime ou texto 'Sáb 01-08-2026') em date."""
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.date()
    if isinstance(val, date):
        return val

    s = str(val).strip()
    # Tenta padrão 'Sáb 01-08-2026' ou '01-08-2026'
    match = re.search(r'(\d{2})[-/](\d{2})[-/](\d{4})', s)
    if match:
        day, month, year = match.groups()
        try:
            return date(int(year), int(month), int(day))
        except ValueError:
            pass

    # Tenta padrão ISO '2026-08-01'
    match_iso = re.search(r'(\d{4})[-/](\d{2})[-/](\d{2})', s)
    if match_iso:
        year, month, day = match_iso.groups()
        try:
            return date(int(year), int(month), int(day))
        except ValueError:
            pass

    return None


def parse_duration_to_seconds(val: Any) -> int:
    """Converte duração (timedelta ou string 'HH:MM:SS'/'HH:MM') em total de segundos inteiros."""
    if pd.isna(val) or val is None:
        return 0
    if isinstance(val, (pd.Timedelta, timedelta)):
        return int(val.total_seconds())

    s = str(val).strip()
    if not s or s.lower() in ('nan', 'none', '-'):
        return 0

    parts = s.split(':')
    try:
        if len(parts) == 3:
            h, m, sec = parts
            return int(h) * 3600 + int(m) * 60 + int(float(sec))
        elif len(parts) == 2:
            h, m = parts
            return int(h) * 3600 + int(m) * 60
    except (ValueError, TypeError):
        pass

    return 0


def format_seconds_to_hhhmm(total_seconds: int) -> str:
    """Formata total de segundos acumulados em formato corporativo [HHH...]:MM."""
    if total_seconds < 0:
        total_seconds = 0
    total_minutes = total_seconds // 60
    hours = total_minutes // 60
    mins = total_minutes % 60
    return f"{hours}:{mins:02d}"


def parse_quadros_text(texto: str) -> List[Tuple[str, int]]:
    """Extrai pares (nome_loja, quadro_previsto) a partir de texto contendo tuplas Python, CSV ou TSV.

    Suporta formatos como:
        ("ASSAI APARECIDA DE GOIANIA 348", 18),
        ("ATACADAO ANCHIETA 269", 14)
        ASSAI BAURU 61, 16
    """
    if not texto:
        return []

    results = []
    # 1. Tuplas com aspas: ("LOJA", 18) ou ('LOJA', 18)
    tuple_pattern = re.compile(r'\(\s*["\']([^"\'\n]+)["\']\s*,\s*(\d+)\s*\)')
    matches = tuple_pattern.findall(texto)
    if matches:
        for nome, q in matches:
            nome_clean = nome.strip()
            if nome_clean:
                results.append((nome_clean, int(q)))
        return results

    # 2. Formato linha a linha (CSV / TSV / separadores)
    for line in texto.splitlines():
        line = line.strip().rstrip(',').rstrip(';')
        if not line:
            continue
        m = re.match(r'^["\']?([^"\'\t;,]+)["\']?\s*[,;\t]\s*(\d+)\s*$', line)
        if m:
            nome_clean = m.group(1).strip()
            results.append((nome_clean, int(m.group(2))))

    return results
