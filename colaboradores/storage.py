import os
import time
import logging
from pathlib import Path
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils._os import safe_join

logger = logging.getLogger(__name__)


class ResilientFileSystemStorage(FileSystemStorage):
    r"""
    Storage de arquivos tolerante a falhas para caminhos de rede (SMB/unidades mapeadas como F:\).
    
    Por que existe: Evita erros 500 (ex.: OSError WinError 1326 / caminho offline) quando a unidade de
    rede cai ou as credenciais do Windows expiram, direcionando a gravação e leitura de forma segura
    e transparente para a pasta local de fallback (settings.MEDIA_ROOT / 'testes').
    """

    def __init__(self, location=None, base_url=None, fallback_location=None, **kwargs):
        self._primary_location = location
        self._fallback_location = fallback_location or str(Path(settings.MEDIA_ROOT) / "testes")
        self._primary_ok = None
        self._last_check = 0
        super().__init__(location=self._fallback_location, base_url=base_url, **kwargs)

    def _is_primary_available(self):
        if not self._primary_location:
            return False
        now = time.time()
        # Cache de 15 segundos para evitar latência de timeout do Windows SMB a cada requisição
        if self._primary_ok is not None and (now - self._last_check) < 15:
            return self._primary_ok
        self._last_check = now
        try:
            drive, _ = os.path.splitdrive(self._primary_location)
            if drive and not os.path.exists(drive + "\\"):
                self._primary_ok = False
                return False
            if os.path.exists(self._primary_location):
                self._primary_ok = True
                return True
            # Se a pasta final não existe mas a unidade/raiz existe, tenta criar
            os.makedirs(self._primary_location, exist_ok=True)
            self._primary_ok = True
            return True
        except (OSError, PermissionError) as e:
            logger.debug(f"[ResilientStorage] Unidade primária '{self._primary_location}' indisponível: {e}")
            self._primary_ok = False
            return False

    @property
    def location(self):
        if self._is_primary_available():
            return self._primary_location
        return self._fallback_location

    @location.setter
    def location(self, value):
        self._fallback_location = value

    def _save(self, name, content):
        if self._is_primary_available():
            try:
                return super()._save(name, content)
            except (OSError, PermissionError) as e:
                logger.warning(
                    f"[ResilientStorage] Falha ao gravar anexo no diretório principal '{self._primary_location}': {e}. "
                    f"Redirecionando gravação para fallback local '{self._fallback_location}'."
                )
                self._primary_ok = False
                self._last_check = time.time()

        # Garante a criação da pasta de fallback local
        os.makedirs(self._fallback_location, exist_ok=True)
        return super()._save(name, content)

    def path(self, name):
        # 1. Se o arquivo existir fisicamente no primário, retorna ele
        if self._is_primary_available():
            try:
                primary_path = safe_join(self._primary_location, name)
                if os.path.exists(primary_path):
                    return primary_path
            except OSError:
                pass

        # 2. Se existir fisicamente no fallback local, retorna o fallback
        fallback_path = safe_join(self._fallback_location, name)
        try:
            if os.path.exists(fallback_path):
                return fallback_path
        except OSError:
            pass

        # 3. Se nenhum existir fisicamente ainda (ex.: pre_save gerando caminho), usa o destino atual
        return safe_join(self.location, name)

    def exists(self, name):
        if self._is_primary_available():
            try:
                if os.path.exists(safe_join(self._primary_location, name)):
                    return True
            except OSError:
                pass
        try:
            return os.path.exists(safe_join(self._fallback_location, name))
        except OSError:
            return False

    def deconstruct(self):
        return ("django.core.files.storage.FileSystemStorage", (), {"location": self._primary_location})
