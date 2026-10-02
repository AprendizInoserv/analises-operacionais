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

:: Detecta se é ambiente de TESTE (Desktop) ou PRODUÇÃO (Documents)
echo %~dp0 | findstr /i "Desktop ryanmont" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set AMBIENTE=TESTE
    set BACKEND_PORT=8001
    set FRONTEND_PORT=5174
) else (
    set AMBIENTE=PRODUCAO
    set BACKEND_PORT=8000
    set FRONTEND_PORT=5173
)

:: 4. Checagem de porta
echo [3/4] Verificando porta %BACKEND_PORT%...
netstat -ano | findstr "LISTENING" | findstr ":%BACKEND_PORT%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [AVISO] Já existe um processo escutando na porta %BACKEND_PORT%.
    echo Se o sistema já estiver funcionando, você pode fechar esta janela.
)

:: 5. Inicia o Backend Waitress
echo [4/4] Iniciando Servidor Web Backend (%AMBIENTE% - Porta %BACKEND_PORT%)...
start "Django (%AMBIENTE% - %BACKEND_PORT%)" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && python -m waitress --listen=0.0.0.0:%BACKEND_PORT% --threads=12 core.wsgi:application || pause"

:: Aguarda 3 segundos
timeout /t 3 /nobreak >nul

:: 6. Inicia o Frontend Vite (se necessário para ambiente de desenvolvimento)
if exist "frontend\package.json" (
    start "Frontend (%AMBIENTE% - %FRONTEND_PORT%)" cmd /k "cd /d %~dp0frontend && set VITE_PORT=%FRONTEND_PORT% && yarn dev --host --port %FRONTEND_PORT% || pause"
)

echo.
echo ===============================================================================
echo [SUCESSO] Sistema de %AMBIENTE% iniciado com sucesso!
echo Acesso local:    http://localhost:%FRONTEND_PORT%/
echo Acesso na rede:  http://%COMPUTERNAME%:%FRONTEND_PORT%/ (ou veja o IP com diagnostico.bat)
echo.
echo Para monitoramento automático e auto-recuperação, execute:
echo menu_emergencia.bat (Opção 7) ou python watchdog.py
echo ===============================================================================
echo.
timeout /t 5 >nul
