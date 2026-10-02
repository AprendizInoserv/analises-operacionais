import os
import sys
import time
import subprocess
import urllib.request
import json
import logging
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Configuração de Log do Watchdog
logging.basicConfig(
    level=logging.INFO,
    format="[{asctime}] {levelname} [Watchdog] {message}",
    style="{",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOGS_DIR / "watchdog.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("watchdog")

CHECK_INTERVAL_SECONDS = 30
MAX_CONSECUTIVE_FAILURES = 3
HEALTH_CHECK_URL = "http://127.0.0.1:8000/api/health/"
TIMEOUT_SECONDS = 5


def verificar_saude_backend() -> tuple[bool, str]:
    """
    Testa o endpoint de health check do backend.
    Retorna (is_ok, mensagem).
    """
    try:
        req = urllib.request.Request(HEALTH_CHECK_URL, headers={"User-Agent": "Watchdog/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                return (True, f"Healthy (Uptime: {data.get('uptime_human', 'N/A')})")
            else:
                return (False, f"HTTP {response.status}")
    except Exception as e:
        return (False, str(e))


def matar_processos_porta_8000():
    """
    Localiza e encerra processos travados que estejam escutando na porta 8000.
    """
    try:
        cmd = 'netstat -ano | findstr "LISTENING" | findstr ":8000"'
        output = subprocess.check_output(cmd, shell=True, text=True)
        pids = set()
        for line in output.strip().splitlines():
            parts = line.split()
            if len(parts) >= 5 and ":8000" in parts[1]:
                pids.add(parts[-1])

        for pid in pids:
            logger.info(f"Encerrando processo travado PID {pid} na porta 8000...")
            subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    except Exception:
        pass


def testar_e_reparar_banco():
    """
    Verifica se o SQLite está corrompido. Se estiver, restaura o último backup válido.
    """
    try:
        import sqlite3
        db_path = BASE_DIR / "db.sqlite3"
        if not db_path.exists():
            return

        conn = sqlite3.connect(str(db_path), timeout=5.0)
        res = conn.execute("PRAGMA quick_check;").fetchone()
        conn.close()

        if not res or res[0] != "ok":
            logger.error(f"[AUTO-RECOVERY] Banco de dados corrompido detectado: {res}. Acionando restauração...")
            python_exe = BASE_DIR / "venv" / "Scripts" / "python.exe"
            subprocess.run([str(python_exe), "manage.py", "restore_db"], cwd=str(BASE_DIR), capture_output=True)
            logger.info("[AUTO-RECOVERY] Restauração automática concluída.")
    except Exception as e:
        logger.error(f"[AUTO-RECOVERY] Erro na verificação do banco: {e}")


def iniciar_backend():
    """
    Inicia o servidor Waitress em segundo plano.
    """
    python_exe = BASE_DIR / "venv" / "Scripts" / "python.exe"
    if not python_exe.exists():
        logger.error(f"Executável do Python não encontrado em: {python_exe}")
        return

    logger.info("Iniciando Waitress na porta 8000 (12 threads)...")
    cmd = [
        str(python_exe),
        "-m",
        "waitress",
        "--listen=0.0.0.0:8000",
        "--threads=12",
        "core.wsgi:application",
    ]
    # Inicia sem criar janela bloqueante
    subprocess.Popen(
        cmd,
        cwd=str(BASE_DIR),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
        close_fds=True,
    )


def executar_loop_vigilancia():
    """
    Loop principal do Watchdog de Auto-recuperação.
    """
    logger.info("==================================================================")
    logger.info("    WATCHDOG DE AUTO-RECUPERAÇÃO ATIVADO (SISTEMA RESILIENTE)     ")
    logger.info(f"    Monitorando: {HEALTH_CHECK_URL} a cada {CHECK_INTERVAL_SECONDS}s")
    logger.info("==================================================================")

    falhas_consecutivas = 0

    while True:
        is_ok, msg = verificar_saude_backend()

        if is_ok:
            if falhas_consecutivas > 0:
                logger.info(f"[RECUPERADO] Backend restabelecido com sucesso após intervenção: {msg}")
            falhas_consecutivas = 0
        else:
            falhas_consecutivas += 1
            logger.warning(f"[ALERTA {falhas_consecutivas}/{MAX_CONSECUTIVE_FAILURES}] Falha no backend: {msg}")

            if falhas_consecutivas >= MAX_CONSECUTIVE_FAILURES:
                logger.error("[PROTOCOLO DE RECUPERAÇÃO] Limite de falhas atingido. Reiniciando o sistema...")
                matar_processos_porta_8000()
                time.sleep(2)
                testar_e_reparar_banco()
                iniciar_backend()
                falhas_consecutivas = 0
                time.sleep(10)  # Aguarda o startup antes da próxima checagem

        time.sleep(CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    executar_loop_vigilancia()
