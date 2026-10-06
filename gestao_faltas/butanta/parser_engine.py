"""
parser_engine.py - Motor Inteligente de Análise Sintática de Mensagens de Quadro
Identifica datas, turnos, categorias de presenças e detecta linhas inesperadas ou não reconhecidas.
"""

import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple


def normalize_date_str(date_str: str) -> Optional[str]:
    """Valida e normaliza uma string de data para DD/MM/AAAA."""
    if not date_str:
        return None
    
    parts = re.split(r'[/.-]', date_str.strip())
    if len(parts) < 2:
        return None
        
    day = parts[0].zfill(2)
    month = parts[1].zfill(2)
    
    if len(parts) >= 3 and parts[2]:
        year = parts[2]
        if len(year) == 2:
            year = f"20{year}"
    else:
        year = str(datetime.now().year)
        
    try:
        dt = datetime.strptime(f"{day}/{month}/{year}", "%d/%m/%Y")
        return dt.strftime("%d/%m/%Y")
    except ValueError:
        return None


def extract_date_from_text(text: str) -> Optional[str]:
    """Extrai a primeira data válida encontrada no texto."""
    patterns = [
        r'\b(\d{1,2})[/\.-](\d{1,2})(?:[/\.-](\d{2,4}))?\b',
        r'(?:dia|data)[:\s]*(\d{1,2})[/\.-](\d{1,2})(?:[/\.-](\d{2,4}))?'
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            day = match.group(1)
            month = match.group(2)
            year = match.group(3) if len(match.groups()) >= 3 and match.group(3) else str(datetime.now().year)
            date_cand = f"{day}/{month}/{year}"
            norm = normalize_date_str(date_cand)
            if norm:
                return norm
    return None


def detect_turno(text: str) -> Optional[str]:
    """Identifica o turno mencionado em uma linha ou bloco de texto."""
    lower = text.lower()
    # Linhas de contagem como '2 apoio noite' não devem mudar o turno corrente
    if RE_APOIO_NOITE.search(lower):
        return None
    if re.search(r'\b(manh[aã]|matutino|t1)\b', lower):
        return 'Manhã'
    if re.search(r'\b(tarde|vespertino|t2)\b', lower):
        return 'Tarde'
    if re.search(r'\b(noite|noturno|madrugada|t3)\b', lower):
        return 'Noite'
    return None


def extract_first_number(text: str) -> Optional[int]:
    """Extrai o primeiro número inteiro relevante da linha."""
    match = re.search(r'\b(\d+)\b', text)
    if match:
        return int(match.group(1))
    return None


# Expressões regulares para categorias conhecidas
RE_BANHEIRISTA = re.compile(r'banheirist[ao]', re.IGNORECASE)
RE_APOIO_NOITE = re.compile(r'apoio.*noite|apoio.*noturn|noite.*apoio', re.IGNORECASE)
RE_PRESENTE = re.compile(r'\b(presentes?|pres\b|trabalhand[oa]|operand[oa]|no\s*posto)\b', re.IGNORECASE)
RE_FOLGA = re.compile(r'\b(folgas?|folga\s*escala|folga\s*feriado|folga\s*domingo|dsr|folguista)\b', re.IGNORECASE)
RE_FALTA = re.compile(r'\b(faltas?|faltou|aus[eê]ncia|injustificad[ao]|sem\s*justificativa)\b', re.IGNORECASE)
RE_ATESTADO = re.compile(r'\b(atestados?|m[eé]dic[ao]|licen[çc]a\s*m[eé]dica|cid|consulta)\b', re.IGNORECASE)
RE_OUTROS_CONHECIDOS = re.compile(
    r'\b(f[eé]rias|licen[çc]a|maternidade|paternidade|dispensa|abono|demiss[aã]o|demitid[ao]|'
    r't[eé]rmino|desligamento|afastament[oa]|treinamento|curso|banco\s*de\s*horas|suspens[aã]o)\b', 
    re.IGNORECASE
)

# Expressões para linhas informativas/saudações descartáveis
RE_GREETING_OR_HEADER = re.compile(
    r'(bom\s*dia|boa\s*tarde|boa\s*noite|ol[aá]|prezad[ao]s?|segue\s*o\s*quadro|'
    r'quadro\s*de\s*hoje|quadro\s*da\s*turma|escala\s*do\s*dia|turma\s*da|'
    r'total\s*:?\s*\d+|resumo\s*:?|att|grato|obrigad[ao]|escala\s*operacional)',
    re.IGNORECASE
)


def extract_category_count(clean_line: str, pattern: re.Pattern) -> Tuple[bool, int]:
    """
    Verifica se a linha corresponde à categoria e extrai a contagem verificando o número primeiro.
    
    Regras:
    1. Se houver número imediatamente antes da palavra (ex: '0 faltas', '2 atestados', '0 - falta'):
       Se for 0, quantidade é 0 (não detectar/contabilizar). Se for N > 0, quantidade é N.
    2. Se houver número imediatamente após a palavra (ex: 'faltas: 0', 'faltas = 2'):
       Se for 0, quantidade é 0. Se for N > 0, quantidade é N.
    3. Se houver qualquer outro número na linha, utiliza-o (0 não contabiliza).
    4. Se não houver número na linha:
       - Se for apenas a palavra pura ou com pontuação (ex: 'Faltas:', 'Atestados'), retorna 0.
       - Se contiver texto com nomes (ex: 'Falta: Fulano de Tal'), retorna 1.
    """
    m = pattern.search(clean_line)
    if not m:
        return False, 0
    
    start, end = m.span()
    before = clean_line[:start]
    after = clean_line[end:]
    
    # 1. Verifica número imediatamente antes do termo
    m_before = re.findall(r'(\d+)\s*[-:–]?\s*$', before)
    if m_before:
        return True, int(m_before[-1])
        
    # 2. Verifica número imediatamente após o termo
    m_after = re.match(r'^\s*[-:–=]?\s*(\d+)', after)
    if m_after:
        return True, int(m_after.group(1))
        
    # 3. Qualquer número na linha inteira
    m_any = re.search(r'\b(\d+)\b', clean_line)
    if m_any:
        return True, int(m_any.group(1))
        
    # 4. Sem número: verifica se há nomes ou detalhes
    rest = (before + ' ' + after).strip()
    if re.search(r'[a-zA-Z]{3,}', rest):
        return True, 1
        
    return True, 0


def categorize_line(line: str) -> Tuple[str, int, bool]:
    """
    Analisa uma linha individual e retorna:
    (categoria, quantidade, is_unexpected)
    
    Verifica sempre o número primeiro. Se houver 0 antes de uma palavra como
    atestado ou faltas (ou qualquer categoria), a quantidade é 0 e não contabiliza.
    """
    clean_line = line.strip()
    if not clean_line:
        return ('header_or_empty', 0, False)
        
    # 1. Saudações ou cabeçalhos informativos
    if RE_GREETING_OR_HEADER.search(clean_line):
        return ('header_or_empty', 0, False)
        
    # 2. Se a linha só tem a data ou nome do turno (cabeçalho de bloco)
    if extract_date_from_text(clean_line) or detect_turno(clean_line):
        return ('header_or_empty', 0, False)

    # 3. Banheirista Apoio (prioridade antes de apoio e presente)
    matched, num = extract_category_count(clean_line, RE_BANHEIRISTA)
    if matched:
        return ('banheirista_apoio', num, False)
        
    # 4. Apoio Noite
    matched, num = extract_category_count(clean_line, RE_APOIO_NOITE)
    if matched:
        return ('apoio_noite', num, False)
        
    # 5. Presentes
    matched, num = extract_category_count(clean_line, RE_PRESENTE)
    if matched:
        return ('presentes', num, False)
        
    # 6. Folgas
    matched, num = extract_category_count(clean_line, RE_FOLGA)
    if matched:
        return ('folgas', num, False)
        
    # 7. Faltas (sempre verificando o número primeiro; 0 não contabiliza)
    matched, num = extract_category_count(clean_line, RE_FALTA)
    if matched:
        return ('faltas', num, False)
        
    # 8. Atestados (sempre verificando o número primeiro; 0 não contabiliza)
    matched, num = extract_category_count(clean_line, RE_ATESTADO)
    if matched:
        return ('atestados', num, False)
        
    # 9. Outros conhecidos
    matched, num = extract_category_count(clean_line, RE_OUTROS_CONHECIDOS)
    if matched:
        return ('outros', num, False)

    # 10. Linha inesperada / não reconhecida
    num_fallback = extract_first_number(clean_line) or 0
    return ('desconhecido', num_fallback, True)



def parse_raw_text(raw_text: str, auto_split: bool = True, auto_date: bool = True, default_shopping: Optional[str] = None) -> Dict[str, Any]:
    """
    Motor completo de parsing de texto de mensagens.
    Divide em turnos, extrai contadores, detecta linhas inesperadas e prepara dados para inserção ou revisão.
    """
    lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
    effective_shopping = (default_shopping or 'Shopping Butantã').strip() or 'Shopping Butantã'
    if not lines:
        return {
            "success": False,
            "error": "O texto informado está vazio.",
            "records": [],
            "unexpected_items": [],
            "has_warnings": False,
            "warnings": []
        }

    records_dict: Dict[str, Dict[str, Any]] = {}
    unexpected_items: List[Dict[str, Any]] = []
    warnings: List[str] = []

    # 1. Primeira passada: tentar detectar se há data global no texto
    global_date = None
    for line in lines:
        d = extract_date_from_text(line)
        if d:
            global_date = d
            break

    if not global_date:
        if auto_date:
            global_date = datetime.now().strftime("%d/%m/%Y")
            warnings.append(f"Nenhuma data encontrada explicitamente. Foi atribuída a data atual: {global_date}")
        else:
            warnings.append("Nenhuma data encontrada no texto.")

    current_date = global_date
    current_turno = None

    # 2. Processar linha por linha
    for idx, line in enumerate(lines):
        line_date = extract_date_from_text(line)
        if line_date:
            current_date = line_date

        line_turno = detect_turno(line)
        if line_turno:
            current_turno = line_turno

        effective_turno = current_turno or 'Manhã'
        effective_date = current_date or (datetime.now().strftime("%d/%m/%Y"))

        key = f"{effective_date}|{effective_turno}"
        if key not in records_dict:
            records_dict[key] = {
                "date": effective_date,
                "turno": effective_turno,
                "shopping": effective_shopping,
                "presentes": 0,
                "folgas": 0,
                "faltas": 0,
                "atestados": 0,
                "apoio_noite": 0,
                "banheirista_apoio": 0,
                "outros": [],
                "observacoes": "",
                "linhas_processadas": []
            }

        cat, num, is_unexpected = categorize_line(line)

        if is_unexpected:
            item_info = {
                "line_index": idx + 1,
                "raw_text": line,
                "detected_number": num,
                "suggested_category": "outros" if num == 0 else "presentes",
                "date": effective_date,
                "turno": effective_turno,
                "shopping": effective_shopping,
                "reason": "Texto não reconhecido nos padrões convencionais"
            }
            unexpected_items.append(item_info)
            records_dict[key]["outros"].append(line)
            records_dict[key]["linhas_processadas"].append({"line": line, "cat": "inesperado", "num": num})

        elif cat == 'header_or_empty':
            records_dict[key]["linhas_processadas"].append({"line": line, "cat": "cabecalho", "num": 0})

        elif cat == 'presentes':
            records_dict[key]["presentes"] += num
            records_dict[key]["linhas_processadas"].append({"line": line, "cat": "presentes", "num": num})

        elif cat == 'folgas':
            records_dict[key]["folgas"] += num
            records_dict[key]["linhas_processadas"].append({"line": line, "cat": "folgas", "num": num})

        elif cat == 'faltas':
            records_dict[key]["faltas"] += num
            records_dict[key]["linhas_processadas"].append({"line": line, "cat": "faltas", "num": num})

        elif cat == 'atestados':
            records_dict[key]["atestados"] += num
            records_dict[key]["linhas_processadas"].append({"line": line, "cat": "atestados", "num": num})

        elif cat == 'apoio_noite':
            records_dict[key]["apoio_noite"] += num
            records_dict[key]["linhas_processadas"].append({"line": line, "cat": "apoio_noite", "num": num})

        elif cat == 'banheirista_apoio':
            records_dict[key]["banheirista_apoio"] += num
            records_dict[key]["linhas_processadas"].append({"line": line, "cat": "banheirista_apoio", "num": num})

        elif cat == 'outros':
            records_dict[key]["outros"].append(line)
            records_dict[key]["linhas_processadas"].append({"line": line, "cat": "outros", "num": num})

    parsed_records = list(records_dict.values())

    if not any(detect_turno(l) for l in lines):
        warnings.append("Nenhum turno (Manhã/Tarde/Noite) foi explicitado no texto; os dados foram agrupados como 'Manhã'.")

    return {
        "success": True,
        "records": parsed_records,
        "unexpected_items": unexpected_items,
        "has_warnings": len(unexpected_items) > 0 or len(warnings) > 0,
        "warnings": warnings,
        "total_turnos": len(parsed_records)
    }
