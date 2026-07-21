@echo off
title Perfil de Lote - Servidor local
cd /d "%~dp0"
echo.
echo  Perfil de Lote - iniciando servidor em http://localhost:8080
echo  Feche esta janela para parar o servidor.
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:8080"
  py -m http.server 8080
  goto :fim
)

where python >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:8080"
  python -m http.server 8080
  goto :fim
)

where npx >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:8080"
  npx --yes serve -l 8080
  goto :fim
)

echo ERRO: Instale Python (python.org) ou Node.js (nodejs.org)
echo Depois execute este arquivo novamente.
pause

:fim
