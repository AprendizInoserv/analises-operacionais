@echo off
echo Iniciando Analises Operacionais...

rem === Django Backend (Waitress - Multi-thread de alta performance) ==
start "Django (backend - Waitress)" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && python -m waitress --listen=0.0.0.0:8001 --threads=12 core.wsgi:application || pause"

rem Aguarda backend iniciar
timeout /t 5 /nobreak >nul

rem === Frontend Vite ==
start "Frontend (Vite)" cmd /k "cd /d %~dp0frontend && set VITE_PORT=5174 && yarn dev --host || pause"