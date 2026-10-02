@echo off
chcp 65001 >nul
title Diagnóstico Completo do Sistema
color 0B

echo ===============================================================================
echo                GERADOR DE DIAGNÓSTICO DO SISTEMA (1-CLIQUE)
echo ===============================================================================
echo.
echo Coletando dados do ambiente, rede, banco e processos...
echo Por favor, aguarde alguns segundos.
echo.

set LOGFILE=%~dp0diagnostico.txt

echo =============================================================================== > "%LOGFILE%"
echo                 RELATÓRIO DE DIAGNÓSTICO - ANÁLISES OPERACIONAIS                >> "%LOGFILE%"
echo                 Gerado em: %DATE% às %TIME%                                    >> "%LOGFILE%"
echo =============================================================================== >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo [1. IDENTIFICAÇÃO DA MÁQUINA E USUÁRIO] >> "%LOGFILE%"
echo Nome do Computador: %COMPUTERNAME% >> "%LOGFILE%"
echo Usuário Windows:    %USERNAME% >> "%LOGFILE%"
echo Pasta do Sistema:   %~dp0 >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo [2. CONFIGURAÇÃO DE REDE LOCAL (IP)] >> "%LOGFILE%"
ipconfig | findstr /i "IPv4 Endereço" >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo [3. STATUS DAS PORTAS DO SISTEMA (8000 e 5173)] >> "%LOGFILE%"
netstat -ano | findstr "8000 5173" >> "%LOGFILE%"
if %ERRORLEVEL% NEQ 0 (
    echo AVISO: Nenhuma porta do sistema (8000 ou 5173) está aberta no momento. >> "%LOGFILE%"
)
echo. >> "%LOGFILE%"

echo [4. STATUS DO BANCO DE DADOS E BACKUPS] >> "%LOGFILE%"
if exist "%~dp0db.sqlite3" (
    echo Arquivo db.sqlite3: PRESENTE >> "%LOGFILE%"
    dir "%~dp0db.sqlite3" | findstr "db.sqlite3" >> "%LOGFILE%"
) else (
    echo Arquivo db.sqlite3: NÃO ENCONTRADO NA PASTA RAIZ! >> "%LOGFILE%"
)

if exist "%~dp0backups" (
    echo Pasta backups/: PRESENTE >> "%LOGFILE%"
    dir "%~dp0backups" | findstr "db_backup" >> "%LOGFILE%"
) else (
    echo Pasta backups/: NÃO ENCONTRADA! >> "%LOGFILE%"
)
echo. >> "%LOGFILE%"

echo [5. STATUS DA UNIDADE DE REDE F:\] >> "%LOGFILE%"
if exist "F:\" (
    echo Unidade F:\: CONECTADA E ACESSÍVEL >> "%LOGFILE%"
) else (
    echo Unidade F:\: DESCONECTADA OU INACESSÍVEL! >> "%LOGFILE%"
)
echo. >> "%LOGFILE%"

echo [6. INTEGRIDADE DO PYTHON E VENV] >> "%LOGFILE%"
if exist "%~dp0venv\Scripts\python.exe" (
    "%~dp0venv\Scripts\python.exe" --version >> "%LOGFILE%" 2>&1
    "%~dp0venv\Scripts\python.exe" -c "import sqlite3; c=sqlite3.connect('db.sqlite3'); print('Integridade SQLite:', c.execute('PRAGMA quick_check;').fetchall())" >> "%LOGFILE%" 2>&1
) else (
    echo Python no VENV: NÃO ENCONTRADO! >> "%LOGFILE%"
)
echo. >> "%LOGFILE%"

echo [7. ÚLTIMOS ERROS REGISTRADOS EM LOGS] >> "%LOGFILE%"
if exist "%~dp0logs\errors.log" (
    echo --- Últimas linhas de logs\errors.log --- >> "%LOGFILE%"
    powershell -NoProfile -Command "Get-Content '%~dp0logs\errors.log' -Tail 15" >> "%LOGFILE%" 2>&1
) else (
    echo Nenhum arquivo de erro registrado (logs\errors.log). >> "%LOGFILE%"
)
echo. >> "%LOGFILE%"

echo =============================================================================== >> "%LOGFILE%"
echo FIM DO DIAGNÓSTICO >> "%LOGFILE%"

echo Relatório gerado com sucesso em:
echo %LOGFILE%
echo.
echo Abrindo o arquivo no Bloco de Notas para visualização...
start notepad.exe "%LOGFILE%"

pause
