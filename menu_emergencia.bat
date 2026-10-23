@echo off
chcp 65001 >nul
title Menu de Emergencia - Analises Operacionais
color 0A

:MENU
cls
echo ===============================================================================
echo                 PAINEL DE CONTROLE E EMERGENCIA DO SISTEMA
echo                        SISTEMA DE ANALISES OPERACIONAIS
echo ===============================================================================
echo.
echo    [1] Iniciar Sistema (Backend + Frontend)
echo    [2] Parar Sistema (Encerrar todos os processos)
echo    [3] Reiniciar Sistema
echo    [4] Fazer Backup do Banco de Dados Agora
echo    [5] Restaurar Ultimo Backup Valido (Recuperacao)
echo    [6] Gerar Relatorio de Diagnostico do Sistema (diagnostico.txt)
echo    [7] Iniciar Supervisor de Auto-Recuperacao (Watchdog)
echo    [8] Sincronizar e Atualizar Codigo com GitHub
echo    [9] Sair
echo.
echo ===============================================================================
set /p OPCAO="Escolha uma opcao (1 a 9): "

if "%OPCAO%"=="1" goto INICIAR
if "%OPCAO%"=="2" goto PARAR
if "%OPCAO%"=="3" goto REINICIAR
if "%OPCAO%"=="4" goto BACKUP
if "%OPCAO%"=="5" goto RESTAURAR
if "%OPCAO%"=="6" goto DIAGNOSTICO
if "%OPCAO%"=="7" goto WATCHDOG
if "%OPCAO%"=="8" goto ATUALIZAR
if "%OPCAO%"=="9" exit /b
goto MENU

:INICIAR
cls
echo Iniciando o sistema...
cd /d "%~dp0."
call iniciar_sistema.bat
pause
goto MENU

:PARAR
cls
echo Encerrando processos do sistema...
taskkill /f /im python.exe /fi "WINDOWTITLE eq Django*" >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo.
echo Processos encerrados com sucesso!
pause
goto MENU

:REINICIAR
cls
echo Reiniciando o sistema...
taskkill /f /im python.exe /fi "WINDOWTITLE eq Django*" >nul 2>&1
ping -n 3 127.0.0.1 >nul 2>&1
cd /d "%~dp0."
call iniciar_sistema.bat
pause
goto MENU

:BACKUP
cls
echo Executando backup seguro do banco de dados...
cd /d "%~dp0."
call venv\Scripts\activate.bat
python manage.py backup_db
echo.
pause
goto MENU

:RESTAURAR
cls
call restaurar_backup.bat
goto MENU

:DIAGNOSTICO
cls
call diagnostico.bat
goto MENU

:WATCHDOG
cls
echo Iniciando supervisor de auto-recuperacao em segundo plano...
cd /d "%~dp0."
start "Watchdog Auto-Recovery" cmd /k "call venv\Scripts\activate.bat && python watchdog.py"
echo Supervisor iniciado! Uma janela com o monitoramento ficara aberta.
pause
goto MENU

:ATUALIZAR
cls
echo ===============================================================================
echo            ATUALIZACAO SEGURA DO SISTEMA VIA GITHUB
echo ===============================================================================
echo.
echo [1/4] Realizando copia de seguranca preventiva do banco de dados...
cd /d "%~dp0."
call venv\Scripts\activate.bat
python manage.py backup_db
echo.

echo [2/4] Verificando repositorio remoto Git...
for /f "delims=" %%u in ('git remote get-url origin 2^>nul') do set "REMOTE_URL=%%u"
if defined REMOTE_URL (
    echo %REMOTE_URL% | findstr /i "AprendizInoserv/analises-operacionais" >nul 2>&1
    if errorlevel 1 (
        echo [AVISO] Reconfigurando repositorio remoto para AprendizInoserv...
        git remote set-url origin https://github.com/AprendizInoserv/analises-operacionais.git
    )
)
echo.

echo [3/4] Baixando atualizacoes do GitHub (git pull origin main)...
git pull origin main
if errorlevel 1 (
    echo.
    echo ===============================================================================
    echo [AVISO] Nao foi possivel sincronizar com o GitHub no momento.
    echo Possiveis causas: sem conexao de internet ou credenciais pendentes.
    echo Seu sistema e o banco de dados permanecem intactos na versao atual.
    echo ===============================================================================
    echo.
    pause
    goto MENU
)
echo.

echo [4/4] Verificando e aplicando migracoes pendentes do banco...
python manage.py migrate --noinput
echo.

echo ===============================================================================
echo [SUCESSO] Sistema sincronizado com o GitHub!
echo Deseja reiniciar o sistema agora para aplicar as alteracoes? (S/N)
echo ===============================================================================
set /p REINICIAR_AGORA="Opcao (S/N): "
if /i "%REINICIAR_AGORA%"=="S" goto REINICIAR
echo.
pause
goto MENU
