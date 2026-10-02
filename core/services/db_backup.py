import os
import shutil
import sqlite3
import logging
import threading
from datetime import datetime
from pathlib import Path
from decouple import config
from django.conf import settings

logger = logging.getLogger(__name__)

# Quantidade máxima de backups locais mantidos (rotação preventiva de disco)
MAX_LOCAL_BACKUPS_RETAINED = 14


def rotacionar_backups_antigos(pasta_backups: Path, max_copias: int = MAX_LOCAL_BACKUPS_RETAINED):
    """
    Garante que a pasta de backups não encha o disco da máquina ou da rede.
    Mantém apenas as últimas N cópias mais recentes, excluindo as mais antigas.
    """
    try:
        if not pasta_backups.exists():
            return
        
        arquivos = sorted(
            [f for f in pasta_backups.glob("db_backup_*.sqlite3") if f.is_file()],
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        )

        if len(arquivos) > max_copias:
            excedentes = arquivos[max_copias:]
            for arq in excedentes:
                try:
                    arq.unlink()
                    logger.info(f"[BACKUP DB] Rotação: backup antigo removido: {arq.name}")
                except Exception as e:
                    logger.warning(f"[BACKUP DB] Falha ao remover backup excedente {arq.name}: {e}")
    except Exception as e:
        logger.warning(f"[BACKUP DB] Erro na rotina de rotação de backups: {e}")


def executar_backup_sqlite():
    """
    Executa cópia de segurança segura, atômica e validada do banco de dados SQLite.
    
    Etapas:
    1. Cria pasta local 'backups/' na raiz do projeto.
    2. Força checkpoint do WAL para garantir que todas as transações em memória estejam no disco.
    3. Executa sqlite3.backup() nativo para cópia atômica não-bloqueante.
    4. Executa PRAGMA integrity_check no arquivo gerado para validar integridade.
    5. Se configurado SQLITE_BACKUP_PATH no .env e a rede estiver disponível, espelha a cópia para a rede.
    6. Executa rotação de backups para evitar acúmulo descontrolado de arquivos no disco.
    """
    db_engine = settings.DATABASES.get("default", {}).get("ENGINE", "")
    if "sqlite" not in db_engine:
        logger.info("[BACKUP DB] Ignorado: banco de dados não é SQLite.")
        return {"status": "skipped", "reason": "Not SQLite"}

    db_origin = settings.DATABASES["default"]["NAME"]
    if not db_origin or not os.path.exists(str(db_origin)):
        logger.warning(f"[BACKUP DB] Arquivo de banco original não encontrado: {db_origin}")
        return {"status": "error", "message": f"DB not found: {db_origin}"}

    # 1. Destino Local Seguro
    local_backup_dir = settings.BASE_DIR / "backups"
    local_backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp_str = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    local_dest_file = local_backup_dir / f"db_backup_{timestamp_str}.sqlite3"

    try:
        logger.info(f"[BACKUP DB] Iniciando backup atômico: {local_dest_file.name}")

        # Conexão de origem (leitura)
        src_conn = sqlite3.connect(str(db_origin), timeout=30.0)

        # 2. Força checkpoint do WAL para garantir integridade total dos dados
        try:
            src_conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        except Exception as wal_err:
            logger.warning(f"[BACKUP DB] Aviso durante wal_checkpoint: {wal_err}")

        # 3. Cópia segura em blocos via sqlite3.backup()
        dst_conn = sqlite3.connect(str(local_dest_file), timeout=60.0)
        with dst_conn:
            src_conn.backup(dst_conn, pages=200, sleep=0.01)
        dst_conn.close()
        src_conn.close()

        # 4. Validação do arquivo gerado
        check_conn = sqlite3.connect(str(local_dest_file), timeout=10.0)
        check_cursor = check_conn.cursor()
        check_cursor.execute("PRAGMA integrity_check;")
        check_res = check_cursor.fetchone()
        check_conn.close()

        if not check_res or check_res[0] != "ok":
            logger.error(f"[BACKUP DB] FALHA DE INTEGRIDADE no backup recém-criado: {check_res}")
            local_dest_file.unlink(missing_ok=True)
            return {"status": "corrupted", "message": "Integrity check failed"}

        tamanho_mb = round(local_dest_file.stat().st_size / (1024 * 1024), 2)
        logger.info(f"[BACKUP DB] Backup local concluído com sucesso ({tamanho_mb} MB): {local_dest_file.name}")

        # 5. Espelhamento opcional para o servidor de rede (se configurado e acessível)
        backup_path_network = config("SQLITE_BACKUP_PATH", default="").strip('\'"')
        network_dest_file = None
        if backup_path_network:
            try:
                dest_net_dir = Path(backup_path_network)
                if dest_net_dir.suffix.lower() == ".sqlite3":
                    # Se apontar para um arquivo direto, salva na pasta pai com timestamp e atualiza o arquivo fixo
                    pasta_pai = dest_net_dir.parent
                    pasta_pai.mkdir(parents=True, exist_ok=True)
                    network_dest_file = pasta_pai / f"db_backup_{timestamp_str}.sqlite3"
                    shutil.copy2(str(local_dest_file), str(network_dest_file))
                    # Atualiza também o arquivo fixo apontado
                    shutil.copy2(str(local_dest_file), str(dest_net_dir))
                    rotacionar_backups_antigos(pasta_pai, max_copias=MAX_LOCAL_BACKUPS_RETAINED)
                else:
                    dest_net_dir.mkdir(parents=True, exist_ok=True)
                    network_dest_file = dest_net_dir / f"db_backup_{timestamp_str}.sqlite3"
                    shutil.copy2(str(local_dest_file), str(network_dest_file))
                    rotacionar_backups_antigos(dest_net_dir, max_copias=MAX_LOCAL_BACKUPS_RETAINED)

                logger.info(f"[BACKUP DB] Backup espelhado com sucesso para a rede: {network_dest_file}")
            except Exception as net_err:
                logger.warning(f"[BACKUP DB] Rede indisponível para espelhamento do backup: {net_err}")

        # 6. Rotação preventiva no diretório local
        rotacionar_backups_antigos(local_backup_dir, max_copias=MAX_LOCAL_BACKUPS_RETAINED)

        return {
            "status": "success",
            "file": str(local_dest_file),
            "size_mb": tamanho_mb,
            "network_file": str(network_dest_file) if network_dest_file else None,
        }

    except Exception as e:
        logger.error(f"[BACKUP DB] Erro crítico ao realizar backup: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


def disparar_backup_sqlite_async():
    """
    Dispara o backup em uma thread em background separada para não travar respostas HTTP.
    """
    thread = threading.Thread(target=executar_backup_sqlite, daemon=True)
    thread.start()


def restaurar_ultimo_backup(caminho_backup_especifico=None):
    """
    Restaura o banco SQLite de forma segura:
    1. Se não informado caminho_backup_especifico, busca o backup válido mais recente na pasta local 'backups/'.
    2. Move o db.sqlite3 atual com problemas para db.sqlite3.pre_restore_[timestamp].
    3. Copia o arquivo de backup validado para db.sqlite3.
    4. Testa a integridade do banco restaurado.
    """
    db_origin = settings.DATABASES["default"]["NAME"]
    if not db_origin:
        raise ValueError("Caminho do banco de dados não configurado.")

    db_origin = Path(db_origin)
    local_backup_dir = settings.BASE_DIR / "backups"

    if caminho_backup_especifico:
        backup_file = Path(caminho_backup_especifico)
    else:
        if not local_backup_dir.exists():
            raise FileNotFoundError(f"Pasta de backups não encontrada: {local_backup_dir}")
        backups = sorted(
            [f for f in local_backup_dir.glob("db_backup_*.sqlite3") if f.is_file()],
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        )
        if not backups:
            raise FileNotFoundError("Nenhum backup encontrado na pasta local 'backups/'.")
        backup_file = backups[0]

    if not backup_file.exists():
        raise FileNotFoundError(f"Arquivo de backup não encontrado: {backup_file}")

    # Valida integridade do backup antes de restaurar
    conn = sqlite3.connect(str(backup_file), timeout=15.0)
    res = conn.execute("PRAGMA integrity_check;").fetchone()
    conn.close()
    if not res or res[0] != "ok":
        raise ValueError(f"O arquivo de backup {backup_file.name} está danificado e não pode ser restaurado.")

    # Move banco atual se existir
    timestamp_str = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    if db_origin.exists():
        backup_danificado = db_origin.parent / f"{db_origin.name}.pre_restore_{timestamp_str}"
        shutil.move(str(db_origin), str(backup_danificado))
        logger.info(f"[RESTORE DB] Banco anterior arquivado em: {backup_danificado.name}")

    # Remove arquivos residuais de WAL e SHM se existirem
    wal_file = Path(str(db_origin) + "-wal")
    shm_file = Path(str(db_origin) + "-shm")
    wal_file.unlink(missing_ok=True)
    shm_file.unlink(missing_ok=True)

    # Copia o backup restaurado
    shutil.copy2(str(backup_file), str(db_origin))
    logger.info(f"[RESTORE DB] Banco restaurado com sucesso a partir de: {backup_file.name}")

    return {
        "status": "success",
        "restored_from": str(backup_file),
        "target": str(db_origin),
    }
