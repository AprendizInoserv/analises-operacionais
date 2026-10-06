"""
database.py - Camada de Persistência SQLite para o Quadro de Funcionários / Shopping Butantã.
Gerencia transações seguras, conexões, queries parametrizadas e localização do arquivo SQLite.
"""

import sqlite3
import json
import os
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager
from typing import List, Dict, Any, Optional

from django.conf import settings

# Resolução dinâmica do caminho do banco SQLite:
# Prioriza o banco existente na pasta BUTtan para manter 100% dos dados já gravados.
BASE_DIR = Path(settings.BASE_DIR)
WORKSPACE_ROOT = BASE_DIR.parent
BUTTAN_DB_PATH = WORKSPACE_ROOT / 'BUTtan' / 'quadro_presencas.db'
BACKEND_DB_PATH = BASE_DIR / 'quadro_presencas.db'

def get_db_path() -> str:
    """Retorna o caminho absoluto do banco de dados SQLite."""
    main_db = str(settings.DATABASES['default']['NAME'])
    if os.path.exists(main_db):
        return main_db
    alt_paths = [
        BASE_DIR / 'BUTtan' / 'BUTtan' / 'quadro_presencas.db',
        BASE_DIR / 'BUTtan' / 'quadro_presencas.db',
        WORKSPACE_ROOT / 'BUTtan' / 'quadro_presencas.db',
        BASE_DIR / 'quadro_presencas.db',
    ]
    for p in alt_paths:
        if p.exists():
            return str(p)
    return main_db


@contextmanager
def get_db():
    """Gerenciador de contexto que garante commit e fechamento da conexão SQLite."""
    db_file = get_db_path()
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Inicializa as tabelas e índices necessários no banco de dados SQLite."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Tabela de Shoppings
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shoppings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            );
        """)
        
        # Garantir ao menos um shopping inicial caso a tabela esteja vazia
        cursor.execute("SELECT COUNT(*) FROM shoppings")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO shoppings (nome, created_at) VALUES (?, datetime('now', 'localtime'))", ("Shopping Butantã",))

        # 2. Tabela principal de registros
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='quadro_registros'")
        table_exists = cursor.fetchone() is not None

        if not table_exists:
            cursor.execute("""
                CREATE TABLE quadro_registros (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data_iso TEXT NOT NULL,           -- 'YYYY-MM-DD' para ordenação confiável
                    data_formatada TEXT NOT NULL,     -- 'DD/MM/AAAA' para exibição amigável
                    turno TEXT NOT NULL,              -- 'Manhã', 'Tarde', 'Noite', etc.
                    shopping TEXT NOT NULL DEFAULT 'Shopping Butantã', -- Nome do shopping
                    presentes INTEGER NOT NULL DEFAULT 0,
                    folgas INTEGER NOT NULL DEFAULT 0,
                    faltas INTEGER NOT NULL DEFAULT 0,
                    atestados INTEGER NOT NULL DEFAULT 0,
                    apoio_noite INTEGER NOT NULL DEFAULT 0,
                    banheirista_apoio INTEGER NOT NULL DEFAULT 0,
                    outros TEXT NOT NULL DEFAULT '[]',-- JSON Array com outras ocorrências
                    observacoes TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now', 'localtime')),
                    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
                    UNIQUE(data_iso, turno, shopping)
                );
            """)
        else:
            # Verificar se a coluna shopping já existe na tabela quadro_registros
            cursor.execute("PRAGMA table_info(quadro_registros)")
            columns = [row[1] for row in cursor.fetchall()]
            if 'shopping' not in columns:
                cursor.execute("""
                    CREATE TABLE quadro_registros_migrated (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        data_iso TEXT NOT NULL,
                        data_formatada TEXT NOT NULL,
                        turno TEXT NOT NULL,
                        shopping TEXT NOT NULL DEFAULT 'Shopping Butantã',
                        presentes INTEGER NOT NULL DEFAULT 0,
                        folgas INTEGER NOT NULL DEFAULT 0,
                        faltas INTEGER NOT NULL DEFAULT 0,
                        atestados INTEGER NOT NULL DEFAULT 0,
                        apoio_noite INTEGER NOT NULL DEFAULT 0,
                        banheirista_apoio INTEGER NOT NULL DEFAULT 0,
                        outros TEXT NOT NULL DEFAULT '[]',
                        observacoes TEXT DEFAULT '',
                        created_at TEXT DEFAULT (datetime('now', 'localtime')),
                        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
                        UNIQUE(data_iso, turno, shopping)
                    );
                """)
                cursor.execute("""
                    INSERT INTO quadro_registros_migrated (
                        id, data_iso, data_formatada, turno, shopping,
                        presentes, folgas, faltas, atestados, apoio_noite,
                        banheirista_apoio, outros, observacoes, created_at, updated_at
                    )
                    SELECT 
                        id, data_iso, data_formatada, turno, 'Shopping Butantã',
                        presentes, folgas, faltas, atestados, apoio_noite,
                        banheirista_apoio, outros, observacoes, created_at, updated_at
                    FROM quadro_registros;
                """)
                cursor.execute("DROP TABLE quadro_registros;")
                cursor.execute("ALTER TABLE quadro_registros_migrated RENAME TO quadro_registros;")

        # Índices para buscas rápidas
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_data_iso 
            ON quadro_registros(data_iso);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_turno 
            ON quadro_registros(turno);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_shopping 
            ON quadro_registros(shopping);
        """)
        
        conn.commit()


def normalize_date_to_iso(date_str: str) -> tuple[str, str]:
    """
    Converte datas em formatos variados (DD/MM/AAAA, DD/MM/AA, YYYY-MM-DD)
    para tupla (data_iso 'YYYY-MM-DD', data_formatada 'DD/MM/AAAA').
    """
    date_str = (date_str or '').strip()
    if not date_str:
        now = datetime.now()
        return now.strftime('%Y-%m-%d'), now.strftime('%d/%m/%Y')
        
    if '-' in date_str and len(date_str.split('-')[0]) == 4:
        # Formato ISO: YYYY-MM-DD
        try:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            return dt.strftime('%Y-%m-%d'), dt.strftime('%d/%m/%Y')
        except ValueError:
            pass

    # Trata DD/MM/AAAA ou DD/MM/AA
    parts = date_str.replace('-', '/').split('/')
    if len(parts) >= 2:
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
            return dt.strftime('%Y-%m-%d'), dt.strftime('%d/%m/%Y')
        except ValueError:
            pass

    now = datetime.now()
    return now.strftime('%Y-%m-%d'), now.strftime('%d/%m/%Y')


def sanitize_int(val: Any) -> int:
    """Garante que o valor seja um inteiro não negativo."""
    try:
        n = int(val)
        return max(0, n)
    except (ValueError, TypeError):
        return 0


def serialize_outros(outros_data: Any) -> str:
    """Garante que a lista de outros itens seja serializada em JSON seguro."""
    if isinstance(outros_data, str):
        try:
            parsed = json.loads(outros_data)
            if isinstance(parsed, list):
                return json.dumps(parsed, ensure_ascii=False)
        except json.JSONDecodeError:
            if outros_data.strip():
                return json.dumps([outros_data.strip()], ensure_ascii=False)
            return "[]"
    elif isinstance(outros_data, (list, tuple)):
        clean_list = [str(item).strip() for item in outros_data if str(item).strip()]
        return json.dumps(clean_list, ensure_ascii=False)
    return "[]"


def deserialize_outros(outros_json: Optional[str]) -> List[str]:
    """Desserializa JSON de outros itens para lista de strings."""
    if not outros_json:
        return []
    try:
        data = json.loads(outros_json)
        if isinstance(data, list):
            return [str(x) for x in data]
        return [str(data)]
    except Exception:
        return [outros_json] if outros_json else []


def get_all_shoppings() -> List[Dict[str, Any]]:
    """Recupera todos os shoppings cadastrados e a contagem de registros de cada um."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, s.nome, s.created_at,
                   COUNT(q.id) AS total_registros
            FROM shoppings s
            LEFT JOIN quadro_registros q ON LOWER(TRIM(q.shopping)) = LOWER(TRIM(s.nome))
            GROUP BY s.id, s.nome, s.created_at
            ORDER BY s.nome ASC;
        """)
        return [dict(row) for row in cursor.fetchall()]


def add_shopping(nome: str) -> Dict[str, Any]:
    """Cadastra um novo shopping recebendo apenas o nome."""
    clean_nome = (nome or '').strip()
    if not clean_nome:
        raise ValueError("O nome do shopping não pode ser vazio.")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nome FROM shoppings WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?))", (clean_nome,))
        existing = cursor.fetchone()
        if existing:
            raise ValueError(f"O shopping '{existing['nome']}' já está cadastrado.")

        cursor.execute("INSERT INTO shoppings (nome, created_at) VALUES (?, datetime('now', 'localtime'))", (clean_nome,))
        conn.commit()
        return {"id": cursor.lastrowid, "nome": clean_nome}


def delete_shopping(shopping_id: int) -> Dict[str, Any]:
    """Retira/remove um shopping pelo ID e também remove os registros vinculados a ele."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nome FROM shoppings WHERE id = ?", (shopping_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError("Shopping não encontrado.")
        
        nome = row['nome']
        cursor.execute("DELETE FROM quadro_registros WHERE LOWER(TRIM(shopping)) = LOWER(TRIM(?))", (nome,))
        deleted_records = cursor.rowcount

        cursor.execute("DELETE FROM shoppings WHERE id = ?", (shopping_id,))
        conn.commit()
        return {
            "deleted": True,
            "id": shopping_id,
            "nome": nome,
            "deleted_records": deleted_records
        }


def get_all_records(month_filter: Optional[str] = None, 
                    search: Optional[str] = None, 
                    turno_filter: Optional[str] = None,
                    shopping_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Recupera todos os registros com filtros opcionais de mês, busca, turno e shopping."""
    query = "SELECT * FROM quadro_registros WHERE 1=1"
    params = []

    if shopping_filter and shopping_filter.strip() and shopping_filter != 'todos':
        query += " AND LOWER(TRIM(shopping)) = LOWER(TRIM(?))"
        params.append(shopping_filter.strip())

    if month_filter and month_filter.strip():
        query += " AND data_iso LIKE ?"
        params.append(f"{month_filter.strip()}%")

    if turno_filter and turno_filter.strip() and turno_filter != 'todos':
        query += " AND turno = ?"
        params.append(turno_filter.strip())

    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query += " AND (data_formatada LIKE ? OR turno LIKE ? OR shopping LIKE ? OR outros LIKE ? OR observacoes LIKE ?)"
        params.extend([search_term, search_term, search_term, search_term, search_term])

    query += " ORDER BY data_iso DESC, turno ASC"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            record = dict(row)
            record['outros'] = deserialize_outros(record.get('outros'))
            result.append(record)
        return result


def get_record_by_id(record_id: int) -> Optional[Dict[str, Any]]:
    """Obtém um registro específico pelo ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM quadro_registros WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        if row:
            record = dict(row)
            record['outros'] = deserialize_outros(record.get('outros'))
            return record
        return None


def insert_or_merge_record(data: Dict[str, Any], auto_merge: bool = True) -> Dict[str, Any]:
    """
    Insere um novo registro ou mescla (soma valores e anexa outros) caso já exista
    um registro com a mesma data, turno e shopping.
    """
    data_raw = data.get('data') or data.get('data_formatada') or data.get('date') or ''
    data_iso, data_formatada = normalize_date_to_iso(str(data_raw))
    turno = str(data.get('turno', 'Manhã')).strip() or 'Manhã'
    shopping = str(data.get('shopping') or 'Shopping Butantã').strip() or 'Shopping Butantã'
    
    presentes = sanitize_int(data.get('presentes', 0))
    folgas = sanitize_int(data.get('folgas', 0))
    faltas = sanitize_int(data.get('faltas', 0))
    atestados = sanitize_int(data.get('atestados', 0))
    apoio_noite = sanitize_int(data.get('apoio_noite') or data.get('apoioNoite', 0))
    banheirista_apoio = sanitize_int(data.get('banheirista_apoio') or data.get('banheiristaApoio', 0))
    
    novos_outros = data.get('outros', [])
    if isinstance(novos_outros, str):
        novos_outros = deserialize_outros(novos_outros)
    elif not isinstance(novos_outros, list):
        novos_outros = []
        
    observacoes = str(data.get('observacoes', '')).strip()

    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM quadro_registros WHERE data_iso = ? AND turno = ? AND LOWER(TRIM(shopping)) = LOWER(TRIM(?))",
            (data_iso, turno, shopping)
        )
        existing = cursor.fetchone()

        if existing and auto_merge:
            exist_dict = dict(existing)
            merged_presentes = exist_dict['presentes'] + presentes
            merged_folgas = exist_dict['folgas'] + folgas
            merged_faltas = exist_dict['faltas'] + faltas
            merged_atestados = exist_dict['atestados'] + atestados
            merged_apoio_noite = exist_dict['apoio_noite'] + apoio_noite
            merged_banheirista = exist_dict['banheirista_apoio'] + banheirista_apoio
            
            exist_outros = deserialize_outros(exist_dict['outros'])
            for item in novos_outros:
                if item and item not in exist_outros:
                    exist_outros.append(item)
            
            merged_obs = exist_dict['observacoes'] or ''
            if observacoes:
                merged_obs = f"{merged_obs}; {observacoes}".strip('; ')

            cursor.execute("""
                UPDATE quadro_registros SET
                    presentes = ?,
                    folgas = ?,
                    faltas = ?,
                    atestados = ?,
                    apoio_noite = ?,
                    banheirista_apoio = ?,
                    outros = ?,
                    observacoes = ?,
                    updated_at = datetime('now', 'localtime')
                WHERE id = ?
            """, (
                merged_presentes, merged_folgas, merged_faltas, merged_atestados,
                merged_apoio_noite, merged_banheirista, serialize_outros(exist_outros),
                merged_obs, exist_dict['id']
            ))
            conn.commit()
            return {
                "action": "merged",
                "id": exist_dict['id'],
                "data_iso": data_iso,
                "data_formatada": data_formatada,
                "turno": turno,
                "shopping": shopping
            }
        else:
            cursor.execute("""
                INSERT INTO quadro_registros (
                    data_iso, data_formatada, turno, shopping, presentes, folgas,
                    faltas, atestados, apoio_noite, banheirista_apoio,
                    outros, observacoes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(data_iso, turno, shopping) DO UPDATE SET
                    presentes = excluded.presentes,
                    folgas = excluded.folgas,
                    faltas = excluded.faltas,
                    atestados = excluded.atestados,
                    apoio_noite = excluded.apoio_noite,
                    banheirista_apoio = excluded.banheirista_apoio,
                    outros = excluded.outros,
                    observacoes = excluded.observacoes,
                    updated_at = datetime('now', 'localtime')
            """, (
                data_iso, data_formatada, turno, shopping, presentes, folgas,
                faltas, atestados, apoio_noite, banheirista_apoio,
                serialize_outros(novos_outros), observacoes
            ))
            conn.commit()
            record_id = cursor.lastrowid
            return {
                "action": "inserted",
                "id": record_id,
                "data_iso": data_iso,
                "data_formatada": data_formatada,
                "turno": turno,
                "shopping": shopping
            }


def update_record(record_id: int, data: Dict[str, Any]) -> bool:
    """Atualiza os campos de um registro existente com validação segura."""
    data_raw = data.get('data') or data.get('data_formatada') or data.get('date') or ''
    data_iso, data_formatada = normalize_date_to_iso(str(data_raw))
    turno = str(data.get('turno', 'Manhã')).strip() or 'Manhã'
    shopping = str(data.get('shopping') or 'Shopping Butantã').strip() or 'Shopping Butantã'
    
    presentes = sanitize_int(data.get('presentes', 0))
    folgas = sanitize_int(data.get('folgas', 0))
    faltas = sanitize_int(data.get('faltas', 0))
    atestados = sanitize_int(data.get('atestados', 0))
    apoio_noite = sanitize_int(data.get('apoio_noite') or data.get('apoioNoite', 0))
    banheirista_apoio = sanitize_int(data.get('banheirista_apoio') or data.get('banheiristaApoio', 0))
    outros = serialize_outros(data.get('outros', []))
    observacoes = str(data.get('observacoes', '')).strip()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE quadro_registros SET
                data_iso = ?,
                data_formatada = ?,
                turno = ?,
                shopping = ?,
                presentes = ?,
                folgas = ?,
                faltas = ?,
                atestados = ?,
                apoio_noite = ?,
                banheirista_apoio = ?,
                outros = ?,
                observacoes = ?,
                updated_at = datetime('now', 'localtime')
            WHERE id = ?
        """, (
            data_iso, data_formatada, turno, shopping, presentes, folgas,
            faltas, atestados, apoio_noite, banheirista_apoio,
            outros, observacoes, record_id
        ))
        conn.commit()
        return cursor.rowcount > 0


def delete_record(record_id: int) -> bool:
    """Exclui um registro pelo ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM quadro_registros WHERE id = ?", (record_id,))
        conn.commit()
        return cursor.rowcount > 0


def clear_all_records() -> int:
    """Remove todos os registros da tabela."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM quadro_registros")
        count = cursor.rowcount
        conn.commit()
        return count


def get_daily_summary(month_filter: Optional[str] = None, 
                      shopping_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Gera o Resumo Diário Consolidado somando todos os turnos de cada dia e shopping.
    """
    query = """
        SELECT 
            data_iso,
            data_formatada,
            shopping,
            'Dia Completo' AS turno,
            SUM(presentes) AS presentes,
            SUM(folgas) AS folgas,
            SUM(faltas) AS faltas,
            SUM(atestados) AS atestados,
            SUM(apoio_noite) AS apoio_noite,
            SUM(banheirista_apoio) AS banheirista_apoio,
            GROUP_CONCAT(outros, '|||') AS raw_outros_concat,
            GROUP_CONCAT(observacoes, ' | ') AS observacoes
        FROM quadro_registros
        WHERE 1=1
    """
    params = []
    if shopping_filter and shopping_filter.strip() and shopping_filter != 'todos':
        query += " AND LOWER(TRIM(shopping)) = LOWER(TRIM(?))"
        params.append(shopping_filter.strip())

    if month_filter and month_filter.strip():
        query += " AND data_iso LIKE ?"
        params.append(f"{month_filter.strip()}%")

    query += " GROUP BY data_iso, shopping ORDER BY data_iso ASC, shopping ASC"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            item = dict(row)
            combined_outros = []
            raw_concat = item.pop('raw_outros_concat', '') or ''
            if raw_concat:
                for chunk in raw_concat.split('|||'):
                    items = deserialize_outros(chunk)
                    for val in items:
                        if val and val not in combined_outros:
                            combined_outros.append(val)
            item['outros'] = combined_outros
            result.append(item)
            
        return result


def get_kpis(month_filter: Optional[str] = None, 
             shopping_filter: Optional[str] = None) -> Dict[str, Any]:
    """Calcula os totais e indicadores gerais para exibição nos cards KPI."""
    query = """
        SELECT 
            COUNT(id) AS total_registros,
            COUNT(DISTINCT data_iso) AS total_dias,
            COALESCE(SUM(presentes), 0) AS total_presentes,
            COALESCE(SUM(folgas), 0) AS total_folgas,
            COALESCE(SUM(faltas), 0) AS total_faltas,
            COALESCE(SUM(atestados), 0) AS total_atestados,
            COALESCE(SUM(apoio_noite), 0) AS total_apoio_noite,
            COALESCE(SUM(banheirista_apoio), 0) AS total_banheirista_apoio
        FROM quadro_registros
        WHERE 1=1
    """
    params = []
    if shopping_filter and shopping_filter.strip() and shopping_filter != 'todos':
        query += " AND LOWER(TRIM(shopping)) = LOWER(TRIM(?))"
        params.append(shopping_filter.strip())

    if month_filter and month_filter.strip():
        query += " AND data_iso LIKE ?"
        params.append(f"{month_filter.strip()}%")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        if row:
            res = dict(row)
            res['total_efetivo'] = (
                res['total_presentes'] + 
                res['total_folgas'] + 
                res['total_faltas'] + 
                res['total_atestados']
            )
            return res
        return {
            "total_registros": 0, "total_dias": 0, "total_presentes": 0,
            "total_folgas": 0, "total_faltas": 0, "total_atestados": 0,
            "total_apoio_noite": 0, "total_banheirista_apoio": 0, "total_efetivo": 0
        }
