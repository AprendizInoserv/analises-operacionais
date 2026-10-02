import os
import shutil
import time
from datetime import datetime
from pathlib import Path
from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from decouple import config

START_TIME = time.time()


def health_check(request):
    """
    Endpoint de monitoramento e auditoria em tempo real do sistema (/api/health/).
    
    Verifica:
    - Conectividade e integridade do banco de dados (SQLite/Postgres).
    - Espaço livre em disco no servidor.
    - Acesso à unidade de rede / storage de anexos.
    - Tempo de atividade (uptime) do processo backend.
    """
    status_code = 200
    checks = {}
    is_healthy = True

    # 1. Checagem do Banco de Dados
    db_info = {
        "status": "ok",
        "engine": settings.DATABASES.get("default", {}).get("ENGINE", ""),
    }
    t0 = time.perf_counter()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            cursor.fetchone()

            # Se for SQLite, realiza checagem rápida de integridade B-Tree
            if "sqlite" in db_info["engine"].lower():
                cursor.execute("PRAGMA quick_check;")
                row = cursor.fetchone()
                quick_check_res = row[0] if row else "unknown"
                db_info["quick_check"] = quick_check_res
                if quick_check_res != "ok":
                    db_info["status"] = "corrupted"
                    is_healthy = False
                    status_code = 503

        db_path = settings.DATABASES.get("default", {}).get("NAME", "")
        if db_path and os.path.exists(str(db_path)):
            db_size_bytes = os.path.getsize(str(db_path))
            db_info["path"] = str(db_path)
            db_info["size_mb"] = round(db_size_bytes / (1024 * 1024), 2)

        db_info["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    except Exception as e:
        db_info["status"] = "error"
        db_info["error"] = str(e)
        is_healthy = False
        status_code = 503
    checks["database"] = db_info

    # 2. Checagem de Espaço em Disco
    try:
        root_path = settings.BASE_DIR
        total, used, free = shutil.disk_usage(str(root_path))
        checks["disk"] = {
            "status": "ok" if free > (5 * 1024 * 1024 * 1024) else "warning", # Alerta se < 5GB
            "free_gb": round(free / (1024**3), 2),
            "total_gb": round(total / (1024**3), 2),
            "used_percent": round((used / total) * 100, 1),
        }
    except Exception as e:
        checks["disk"] = {"status": "error", "error": str(e)}

    # 3. Checagem de Armazenamento de Rede / Backup
    backup_path = config("SQLITE_BACKUP_PATH", default="").strip('\'"')
    if backup_path:
        checks["network_backup_share"] = {
            "configured_path": backup_path,
            "accessible": os.path.exists(os.path.dirname(backup_path)) if backup_path else False,
        }

    # 4. Checagem de Integração GeoVictoria (credenciais)
    geo_user = config("GEOVICTORIA_USER", default="").strip()
    checks["geovictoria"] = {
        "configured": bool(geo_user),
    }

    # 5. Uptime e Metadados do Sistema
    uptime_seconds = int(time.time() - START_TIME)
    payload = {
        "status": "healthy" if is_healthy else "unhealthy",
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": uptime_seconds,
        "uptime_human": f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m {uptime_seconds % 60}s",
        "checks": checks,
    }

    return JsonResponse(payload, status=status_code)
