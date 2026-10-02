@echo off
chcp 65001 >nul
title Restaurar Backup do Banco de Dados
color 0E

echo ===============================================================================
echo                RESTAURAÇÃO SEGURA DO BANCO DE DADOS (1-CLIQUE)
echo ===============================================================================
echo.
echo ATENÇÃO:
echo Este procedimento irá substituir o banco atual pelo backup mais recente.
echo O banco atual será preservado com o sufixo '.pre_restore' por segurança.
echo.
set /p CONFIRMA="Deseja continuar com a restauração? (S/N): "
if /i not "%CONFIRMA%"=="S" (
    echo.
    echo Operação cancelada pelo usuário.
    pause
    exit /b
)

echo.
echo [1/3] Encerrando processos do sistema para liberar o arquivo...
taskkill /f /im python.exe /fi "WINDOWTITLE eq Django*" >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Localizando e restaurando último backup válido...
cd /d "%~dp0"
call venv\Scripts\activate.bat
python manage.py restore_db

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===============================================================================
    echo [SUCESSO] Banco restaurado com sucesso!
    echo Você já pode iniciar o sistema normalmente pelo 'iniciar_sistema.bat'.
    echo ===============================================================================
) else (
    echo.
    echo [ERRO] Ocorreu uma falha na restauração. Verifique o arquivo logs\app.log.
)

echo.
pause
