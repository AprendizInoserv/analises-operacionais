"""
Utilitários de rede para detecção dinâmica de IP e resolução automática da URL do frontend.

Por que existe:
Permite que o sistema identifique dinamicamente o endereço IP da máquina na rede local
(ex: quando o IP muda via DHCP de 10.1.1.93 para 10.1.1.111) e a porta exata em que o Vite está rodando,
garantindo que o link enviado por e-mail (recuperação de senha, boas-vindas) seja exatamente o mesmo
link 'Network: http://<ip>:<porta>/' que aparece na tela do Vite ao iniciar o sistema.
"""

import ipaddress
import logging
import socket
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


def get_local_ip() -> str:
    """
    Detecta dinamicamente o endereço IPv4 ativo da máquina na rede local,
    utilizando a mesma resolução de interface de rede que o Vite utiliza no Node.js.
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


def get_active_vite_port(preferred_port: int = None) -> int:
    """
    Detecta a porta exata em que o servidor Vite está escutando no momento (5173 ou 5174).
    Isso assegura que o link gerado corresponda com 100% de exatidão ao exibido na tela do Vite.
    """
    ports_to_check = []
    if preferred_port:
        ports_to_check.append(int(preferred_port))
    ports_to_check.extend([5173, 5174])

    seen = set()
    ordered_ports = [p for p in ports_to_check if not (p in seen or seen.add(p))]

    for port in ordered_ports:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.15)
                if s.connect_ex(("127.0.0.1", port)) == 0:
                    return port
        except Exception:
            pass

    return preferred_port or 5173


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


def resolve_frontend_url(raw_url: str = None, default_port: int = None) -> str:
    """
    Converte uma URL bruta para o link exato do Vite exibido na inicialização:
    IP ativo da rede local + porta ativa do Vite. Preserva domínios externos.
    """
    active_port = get_active_vite_port(default_port)
    local_ip = get_local_ip()

    if not raw_url:
        return f"http://{local_ip}:{active_port}"

    try:
        parsed = urlparse(raw_url.strip())
        scheme = parsed.scheme or "http"
        host = parsed.hostname or local_ip
        is_local = is_local_or_private_host(host)

        if is_local:
            host = local_ip
            port = parsed.port or active_port
        else:
            port = parsed.port

        port_str = f":{port}" if port and port not in (80, 443) else ""
        return f"{scheme}://{host}{port_str}".rstrip("/")
    except Exception as e:
        logger.warning(f"Erro ao processar URL '{raw_url}': {e}. Usando IP e porta ativos.")
        return f"http://{local_ip}:{active_port}"


def get_frontend_base_url(request=None, default_port: int = None) -> str:
    """
    Obtém a URL base do frontend para envio em links por e-mail (recuperação de senha, boas-vindas).
    Garante que o link gerado seja o mesmo link de rede que aparece na tela do Vite ao iniciar.
    """
    from django.conf import settings

    active_port = get_active_vite_port(default_port)
    local_ip = get_local_ip()

    if request is not None:
        # 1. Tenta extrair a origem do payload da requisição ou dos headers HTTP
        origin = None
        if hasattr(request, "data") and isinstance(request.data, dict):
            origin = request.data.get("origin")
        if not origin:
            origin = request.META.get("HTTP_ORIGIN") or request.META.get("HTTP_REFERER")

        if origin:
            try:
                parsed = urlparse(origin)
                scheme = parsed.scheme or ("https" if request.is_secure() else "http")
                host = parsed.hostname
                is_local = is_local_or_private_host(host)

                # Se veio de localhost ou IP da rede, resolve para o IP de rede ativo com a porta do Vite
                if is_local:
                    host = local_ip
                    port = parsed.port or active_port
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
                
                # Mapeia portas correspondentes caso o backend tenha sido acessado diretamente
                port = 5174 if backend_port == "8001" else (5173 if backend_port == "8000" else active_port)
                scheme = "https" if request.is_secure() else "http"
                host = local_ip if is_local_or_private_host(parsed_host) else parsed_host

                port_part = f":{port}" if port and port not in (80, 443) else ""
                return f"{scheme}://{host}{port_part}".rstrip("/")
        except Exception:
            pass

    # 3. Fallback para settings.FRONTEND_URL
    configured_url = getattr(settings, "FRONTEND_URL", None)
    return resolve_frontend_url(configured_url, default_port=active_port)
