@echo off
chcp 65001 >nul
title Menu de Emergência - Análises Operacionais
color 1F

:MENU
cls
echo ===============================================================================
echo                 PAINEL DE CONTROLE E EMERGÊNCIA DO SISTEMA
echo                        SISTEMA DE ANÁLISES OPERACIONAIS
echo ===============================================================================
echo.
echo    [1] Iniciar Sistema (Backend + Frontend)
echo    [2] Parar Sistema (Encerrar todos os processos)
echo    [3] Reiniciar Sistema
echo    [4] Fazer Backup do Banco de Dados Agora
echo    [5] Restaurar Último Backup Válido (Recuperação)
echo    [6] Gerar Relatório de Diagnóstico do Sistema (diagnostico.txt)
echo    [7] Iniciar Supervisor de Auto-Recuperação (Watchdog)
echo    [8] Sair
echo.
echo ===============================================================================
set /p OPCAO="Escolha uma opção (1 a 8): "

if "%OPCAO%"=="1" goto INICIAR
if "%OPCAO%"=="2" goto PARAR
if "%OPCAO%"=="3" goto REINICIAR
if "%OPCAO%"=="4" goto BACKUP
if "%OPCAO%"=="5" goto RESTAURAR
if "%OPCAO%"=="6" goto DIAGNOSTICO
if "%OPCAO%"=="7" goto WATCHDOG
if "%OPCAO%"=="8" exit /b
goto MENU

:INICIAR
cls
echo Iniciando o sistema...
cd /d "%~dp0"
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
timeout /t 2 /nobreak >nul
cd /d "%~dp0"
call iniciar_sistema.bat
pause
goto MENU

:BACKUP
cls
echo Executando backup seguro do banco de dados...
cd /d "%~dp0"
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
echo Iniciando supervisor de auto-recuperação em segundo plano...
cd /d "%~dp0"
start "Watchdog Auto-Recovery" cmd /k "call venv\Scripts\activate.bat && python watchdog.py"
echo Supervisor iniciado! Uma janela com o monitoramento ficará aberta.
pause
goto MENU
