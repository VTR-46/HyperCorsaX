@echo off
echo Iniciando o servidor de Telemetria (itWeb.py)...

:: 1. Inicia o script Python em segundo plano
start python .\Data\itWeb.py

:: 2. Aguarda 2 segundos para dar tempo do WebSocket subir
timeout /t 2 /nobreak > nul

:: 3. Abre o arquivo HTML no seu navegador padrão
start .\View\graphics.html

echo Painel aberto!