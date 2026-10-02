import os
from django.conf import settings
from django.http import HttpResponse, Http404


def spa_index(request):
    """
    Serve o arquivo compilado index.html do frontend React.
    Permite que o sistema funcione em porta única (8000) sem necessitar
    de um servidor de desenvolvimento Node.js/Vite rodando em produção.
    """
    index_path = settings.BASE_DIR / "frontend" / "dist" / "index.html"
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
        response = HttpResponse(content, content_type="text/html; charset=utf-8")
        # Garante que index.html não fique cacheado eternamente para refletir novas versões
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response
    else:
        # Se ainda não foi gerado o build do frontend, redireciona para instruções ou admin
        return HttpResponse(
            """
            <html>
                <head><title>Sistema de Análises Operacionais</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h2>Sistema de Análises Operacionais - Backend Ativo</h2>
                    <p>O backend Django está rodando com sucesso!</p>
                    <p>Para acessar o painel administrativo: <a href="/admin/">/admin/</a></p>
                    <p>Para verificar a integridade da API: <a href="/api/health/">/api/health/</a></p>
                    <hr style="max-width: 500px; margin: 20px auto;">
                    <small>Dica: O build estático do frontend ainda não foi compilado nesta pasta. Execute <code>yarn build</code> dentro de <code>frontend/</code>.</small>
                </body>
            </html>
            """,
            content_type="text/html; charset=utf-8",
        )
