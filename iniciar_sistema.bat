@echo off
chcp 65001 >nul
title Inicializador do Sistema - Analises Operacionais

echo ===============================================================================
echo                INICIALIZANDO SISTEMA DE ANALISES OPERACIONAIS
echo ===============================================================================
echo.

cd /d "%~dp0."

rem 1. Verificacao do Ambiente Virtual
if not exist "venv\Scripts\activate.bat" (
    echo [ERRO CRITICO] Ambiente virtual venv nao encontrado!
    echo Execute: python -m venv venv e instale os pacotes com: pip install -r requirements.txt
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

rem 2. Executa backup preventivo antes de iniciar o sistema
echo [1/4] Realizando copia de seguranca preventiva do banco de dados...
python manage.py backup_db
echo.

rem 3. Executa migracoes pendentes do banco
echo [2/4] Verificando e aplicando migracoes de dados...
python manage.py migrate --noinput
echo.

rem Detecta se e ambiente de TESTE (Desktop) ou PRODUCAO (Documents)
set AMBIENTE=PRODUCAO
set BACKEND_PORT=8000
set FRONTEND_PORT=5173

echo %CD% | findstr /i "Desktop ryanmont" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set AMBIENTE=TESTE
    set BACKEND_PORT=8001
    set FRONTEND_PORT=5174
)

rem 4. Checagem de porta
echo [3/4] Verificando se a porta %BACKEND_PORT% esta livre...
netstat -ano | findstr "LISTENING" | findstr ":%BACKEND_PORT%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [AVISO] Ja existe um processo escutando na porta %BACKEND_PORT%.
    echo Se o sistema ja estiver funcionando, voce pode fechar esta janela.
)

rem 5. Inicia o Backend Waitress
echo [4/4] Iniciando Servidor Web Backend (%AMBIENTE% - Porta %BACKEND_PORT%)...
start "Django - %AMBIENTE% - Porta %BACKEND_PORT%" /D "%CD%" cmd /k "call venv\Scripts\activate.bat && python -m waitress --listen=0.0.0.0:%BACKEND_PORT% --threads=12 core.wsgi:application || pause"

rem Aguarda 3 segundos
ping -n 4 127.0.0.1 >nul 2>&1

rem 6. Inicia o Frontend Vite
if exist "frontend\node_modules\.bin\vite.cmd" (
    start "Frontend - %AMBIENTE% - Porta %FRONTEND_PORT%" /D "%CD%\frontend" cmd /k "set VITE_PORT=%FRONTEND_PORT% && node_modules\.bin\vite.cmd --host --port %FRONTEND_PORT% || pause"
) else if exist "frontend\package.json" (
    start "Frontend - %AMBIENTE% - Porta %FRONTEND_PORT%" /D "%CD%\frontend" cmd /k "set VITE_PORT=%FRONTEND_PORT% && yarn dev --host --port %FRONTEND_PORT% || pause"
)

echo.
echo ===============================================================================
echo [SUCESSO] Sistema de %AMBIENTE% iniciado com sucesso!
echo Acesso local:    http://localhost:%FRONTEND_PORT%/
echo Acesso na rede:  http://%COMPUTERNAME%:%FRONTEND_PORT%/
echo.
echo Para monitoramento automatico e auto-recuperacao, execute:
echo menu_emergencia.bat (Opcao 7) ou python watchdog.py
echo ===============================================================================
echo.
ping -n 6 127.0.0.1 >nul 2>&1
