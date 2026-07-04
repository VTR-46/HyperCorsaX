@echo off
echo Iniciando o servidor de Telemetria (itWeb.py)...

start CorsaX.exe

start python .\Data\itWeb.py

timeout /t 2 /nobreak > nul

start .\View\graphics.html

echo Painel aberto!