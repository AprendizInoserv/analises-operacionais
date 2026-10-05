"""
Utilitários de rede para detecção dinâmica de IP e resolução automática da URL do frontend.

Por que existe:
Permite que o sistema identifique dinamicamente o endereço IP da máquina na rede local
(ex: quando o IP muda via DHCP de 10.1.1.93 para 10.1.1.111), garantindo que os links enviados
por e-mail (recuperação de senha, boas-vindas) e as origens de CORS/CSRF sempre utilizem o endereço
atual e funcional da rede, sem necessidade de alteração manual no arquivo .env.
"""

import ipaddress
import logging
import socket
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


def get_local_ip() -> str:
    """
    Detecta dinamicamente o endereço IPv4 ativo da máquina na rede local.

    Utiliza múltiplas estratégias seguras:
    1. Consulta à tabela de rotas do sistema operacional via conexão UDP sem envio real de pacotes.
    2. Resolução através dos IPs vinculados ao hostname da máquina (filtrando loopbacks e link-local).
    3. Fallback seguro para 127.0.0.1 em casos excepcionais.
    """
    # 1. Tenta identificar a interface de rede ativa que possui rota padrão
    for target in [("8.8.8.8", 80), ("1.1.1.1", 80), ("10.255.255.255", 1)]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.3)
            s.connect(target)
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
                return ip
        except Exception:
            pass

    # 2. Varredura dos IPs associados ao hostname da máquina
    try:
        hostname = socket.gethostname()
        _, _, ips = socket.gethostbyname_ex(hostname)
        for ip in ips:
            if not ip.startswith("127.") and not ip.startswith("169.254."):
                return ip
    except Exception:
        pass

    # 3. Fallback através do gethostbyname simples
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
            return ip
    except Exception:
        pass

    return "127.0.0.1"


def is_local_or_private_host(hostname: str) -> bool:
    """
    Determina se um host ou endereço IP pertence à rede local, loopback ou intranet.

    Retorna True se for 'localhost', '127.0.0.1', o próprio hostname da máquina,
    um hostname sem domínio qualificado (ex: NetBIOS) ou um IP privado (RFC 1918).
    Retorna False para domínios públicos válidos (ex: gestao.empresa.com.br).
    """
    if not hostname:
        return True

    h = hostname.strip().lower()

    # Loopback e mDNS
    if h in ("localhost", "127.0.0.1", "::1", "0.0.0.0") or h.endswith(".local"):
        return True

    # Nome da máquina local
    try:
        if h == socket.gethostname().lower():
            return True
    except Exception:
        pass

    # Hostnames intranet simples sem domínio (ex: 'inovacao-tmg64')
    if "." not in h:
        return True

    # Verifica se é um endereço IP privado ou de loopback
    try:
        ip = ipaddress.ip_address(h)
        return ip.is_private or ip.is_loopback
    except ValueError:
        # Se contiver pontos e não for IP, é um domínio (ex: app.empresa.com)
        return False


def resolve_frontend_url(raw_url: str = None, default_port: int = 5173) -> str:
    """
    Converte uma URL bruta (ex: lida do .env) para a URL com o IP ativo da rede local,
    caso a URL utilize localhost ou um IP de rede local desatualizado. Preserva domínios externos.
    """
    local_ip = get_local_ip()

    if not raw_url:
        return f"http://{local_ip}:{default_port}"

    try:
        parsed = urlparse(raw_url.strip())
        scheme = parsed.scheme or "http"
        host = parsed.hostname or local_ip
        is_local = is_local_or_private_host(host)

        if is_local:
            host = local_ip
            port = parsed.port or default_port
        else:
            port = parsed.port

        port_str = f":{port}" if port and port not in (80, 443) else ""
        return f"{scheme}://{host}{port_str}".rstrip("/")
    except Exception as e:
        logger.warning(f"Erro ao processar URL '{raw_url}': {e}. Usando IP local detectado.")
        return f"http://{local_ip}:{default_port}"


def get_frontend_base_url(request=None, default_port: int = None) -> str:
    """
    Obtém a URL base do frontend para envio em links por e-mail (recuperação de senha, boas-vindas).

    Estratégia:
    1. Se houver 'request', inspeciona o cabeçalho 'Origin' (enviado automaticamente pelos navegadores em POSTs).
       Se o host for local/loopback ou um IP de rede local, normaliza para o IP atual da rede da máquina,
       garantindo que qualquer outro dispositivo na rede (celulares, outros PCs) consiga acessar o link.
    2. Se não houver 'Origin', verifica o cabeçalho 'Referer'.
    3. Se não houver 'Referer', deduz a porta a partir de 'request.get_host()' (8001 -> 5174, 8000 -> 5173).
    4. Caso contrário, utiliza o FRONTEND_URL configurado nas settings com substituição dinâmica de IP.
    """
    from django.conf import settings

    # Define a porta padrão do ambiente (5174 para teste, 5173 para produção)
    if default_port is None:
        if getattr(settings, "FRONTEND_URL", None) and "5174" in settings.FRONTEND_URL:
            default_port = 5174
        elif "desktop" in str(settings.BASE_DIR).lower() and "ryanmont" in str(settings.BASE_DIR).lower():
            default_port = 5174
        else:
            default_port = 5173

    local_ip = get_local_ip()

    if request is not None:
        # 1. Tenta extrair a origem da requisição do navegador
        origin = request.META.get("HTTP_ORIGIN") or request.META.get("HTTP_REFERER")
        if origin:
            try:
                parsed = urlparse(origin)
                scheme = parsed.scheme or ("https" if request.is_secure() else "http")
                host = parsed.hostname
                is_local = is_local_or_private_host(host)

                # Se veio de localhost ou de um IP local, substitui pelo IP da rede ativo para
                # que o link funcione em qualquer celular ou dispositivo na mesma rede.
                if is_local:
                    host = local_ip
                    port = parsed.port or default_port
                else:
                    port = parsed.port

                port_part = f":{port}" if port and port not in (80, 443) else ""
                return f"{scheme}://{host}{port_part}".rstrip("/")
            except Exception:
                pass

        # 2. Tenta inferir pelo Host do backend chamado na requisição
        try:
            host_header = request.get_host()
            if host_header:
                parsed_host = host_header.split(":")[0]
                backend_port = host_header.split(":")[1] if ":" in host_header else ""
                
                # Mapeia portas do backend para o frontend
                port = 5174 if backend_port == "8001" else (5173 if backend_port == "8000" else default_port)
                scheme = "https" if request.is_secure() else "http"
                host = local_ip if is_local_or_private_host(parsed_host) else parsed_host

                port_part = f":{port}" if port and port not in (80, 443) else ""
                return f"{scheme}://{host}{port_part}".rstrip("/")
        except Exception:
            pass

    # 3. Fallback para settings.FRONTEND_URL
    configured_url = getattr(settings, "FRONTEND_URL", None)
    return resolve_frontend_url(configured_url, default_port=default_port)
