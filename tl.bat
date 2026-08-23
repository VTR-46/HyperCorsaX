@echo off
cd /d "%~dp0"
echo Iniciando o servidor de Telemetria (itWeb.py)...

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'Data\\itWeb\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process CorsaX -ErrorAction SilentlyContinue | Stop-Process -Force"

start "HyperCorsaX - CorsaX" "%~dp0CorsaX.exe"

start "HyperCorsaX - Bridge" /d "%~dp0" cmd /k python Data\itWeb.py

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; 1..30 | ForEach-Object { try { $r = Invoke-WebRequest 'http://127.0.0.1:8080/api/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch {}; Start-Sleep -Milliseconds 250 }; if (-not $ready) { Write-Error 'Bridge HTTP nao iniciou na porta 8080'; exit 1 }"

start "" "http://localhost:8080/graphics.html"

echo Painel aberto!