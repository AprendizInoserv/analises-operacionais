@echo off
chcp 65001 >nul
title Inicializador do Sistema - Análises Operacionais
color 0A

echo ===============================================================================
echo                INICIALIZANDO SISTEMA DE ANÁLISES OPERACIONAIS
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. Verificação do Ambiente Virtual (VENV)
if not exist "venv\Scripts\activate.bat" (
    echo [ERRO CRÍTICO] Ambiente virtual (venv) não encontrado!
    echo Execute: python -m venv venv e instale os pacotes com: pip install -r requirements.txt
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

:: 2. Executa backup preventivo antes de iniciar o sistema
echo [1/4] Realizando cópia de segurança preventiva do banco de dados...
python manage.py backup_db
echo.

:: 3. Executa migrações pendentes do banco
echo [2/4] Verificando e aplicando migrações de dados...
python manage.py migrate --noinput
echo.

:: 4. Checagem de porta 8000
echo [3/4] Verificando portas de rede...
netstat -ano | findstr "LISTENING" | findstr ":8000" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [AVISO] Já existe um processo escutando na porta 8000.
    echo Se o sistema já estiver funcionando, você pode fechar esta janela.
)

:: 5. Inicia o Backend Waitress
echo [4/4] Iniciando Servidor Web Backend (Waitress - 12 Threads)...
start "Django (Backend - Waitress)" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && python -m waitress --listen=0.0.0.0:8000 --threads=12 core.wsgi:application || pause"

:: Aguarda 3 segundos
timeout /t 3 /nobreak >nul

:: 6. Inicia o Frontend Vite (se necessário para ambiente de desenvolvimento)
if exist "frontend\package.json" (
    start "Frontend (Vite)" cmd /k "cd /d %~dp0frontend && yarn dev --host || pause"
)

echo.
echo ===============================================================================
echo [SUCESSO] Sistema iniciado!
echo Acesso local:    http://localhost:8000/ ou http://localhost:5173/
echo.
echo Para monitoramento automático e auto-recuperação, execute:
echo menu_emergencia.bat (Opção 7) ou python watchdog.py
echo ===============================================================================
echo.
timeout /t 5 >nul
