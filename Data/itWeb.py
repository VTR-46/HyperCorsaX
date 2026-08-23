import socket
import json
import asyncio
import os
import time
import mimetypes
import websockets
from urllib.parse import parse_qs, urlparse
from datetime import datetime, timezone
from pathlib import Path


def load_env_file():
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"'))


load_env_file()
from storage_mysql import MySQLStorage

#ASSETTO

HOST_AC = '127.0.0.1'
PORT_AC = 5000
HTTP_PORT = int(os.getenv("HYPERCORSA_HTTP_PORT", "8080"))
VIEW_ROOT = Path(__file__).resolve().parent.parent / "View"

clients = set()
storage = MySQLStorage()
sample_index = 0
started_monotonic = time.monotonic()
recording = False
bucket_second = None
pending_payload = None
pending_frame_monotonic = None

def conectar_socket():
    while True:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((HOST_AC, PORT_AC))
            sock.setblocking(False)
            print("Conectado ao CorsaX! Aguardando frontend...")
            return sock
        except ConnectionRefusedError:
            print("Aguardando o CorsaX.exe na porta 5000...")
            time.sleep(1)
        except OSError as erro:
            print(f"Falha ao conectar no CorsaX: {erro}")
            time.sleep(1)


def parse_telemetry(linha):
    valores = linha.strip().split(',')
    if len(valores) < 46:
        return None
    try:
        payload = {
            "speed": float(valores[0]), "rpm": float(valores[1]), "gear": int(valores[2]),
            "gas": float(valores[3]), "brake": float(valores[4]), "clutch": float(valores[35]),
            "fuel": float(valores[5]), "steer": float(valores[6]),
            "tyreFL": float(valores[11]), "tyreFR": float(valores[12]),
            "tyreRL": float(valores[13]), "tyreRR": float(valores[14]),
            "brakeFL": float(valores[15]), "brakeFR": float(valores[16]),
            "brakeRL": float(valores[17]), "brakeRR": float(valores[18]),
            "ersPower": float(valores[19]), "tyreWFL": float(valores[20]),
            "tyreWFR": float(valores[21]), "tyreWRL": float(valores[22]),
            "tyreWRR": float(valores[23]), "carDamageF": float(valores[24]),
            "carDamageD": float(valores[25]), "carDamageT": float(valores[26]),
            "carDamageE": float(valores[27]), "carDamageG": float(valores[28]),
            "tyrePressureFL": float(valores[29]), "tyrePressureFR": float(valores[30]),
            "tyrePressureRL": float(valores[31]), "tyrePressureRR": float(valores[32]),
            "abs": float(valores[33]), "tc": float(valores[34]), "drs": float(valores[7]),
            "currentTime": valores[36].strip() if len(valores) > 36 and valores[36].strip() else "--:--.---",
            "lastTime": valores[37].strip() if len(valores) > 37 and valores[37].strip() else "--:--.---",
            "bestTime": valores[38].strip() if len(valores) > 38 and valores[38].strip() else "--:--.---",
            "split": valores[39].strip() if len(valores) > 39 and valores[39].strip() else "--:--.---",
            "completedLaps": int(valores[40]) if len(valores) > 40 and valores[40].strip().lstrip('-').isdigit() else 0,
            "position": int(valores[41]) if len(valores) > 41 and valores[41].strip().lstrip('-').isdigit() else 0,
            "currentSector": int(valores[42]) if len(valores) > 42 and valores[42].strip().lstrip('-').isdigit() else 0,
            "numberOfLaps": int(valores[43]) if len(valores) > 43 and valores[43].strip().lstrip('-').isdigit() else 0,
            "status": int(valores[44]) if len(valores) > 44 and valores[44].strip().lstrip('-').isdigit() else 0,
            "session": int(valores[45]) if len(valores) > 45 and valores[45].strip().lstrip('-').isdigit() else 0,
        }
        return payload
    except (ValueError, IndexError):
        return None


def to_storage_sample(payload, frame_monotonic=None):
    global sample_index
    sample_index += 1
    result = dict(payload)
    result.update({
        "sample_index": sample_index,
        "recorded_at": datetime.now(timezone.utc),
        "elapsed_ms": int(((frame_monotonic or time.monotonic()) - started_monotonic) * 1000),
        "tyre_fl_temp": payload["tyreFL"], "tyre_fr_temp": payload["tyreFR"],
        "tyre_rl_temp": payload["tyreRL"], "tyre_rr_temp": payload["tyreRR"],
        "brake_fl_temp": payload["brakeFL"], "brake_fr_temp": payload["brakeFR"],
        "brake_rl_temp": payload["brakeRL"], "brake_rr_temp": payload["brakeRR"],
        "ers_power": payload["ersPower"], "tyre_fl_wear": payload["tyreWFL"],
        "tyre_fr_wear": payload["tyreWFR"], "tyre_rl_wear": payload["tyreWRL"],
        "tyre_rr_wear": payload["tyreWRR"], "damage_front": payload["carDamageF"],
        "damage_rear": payload["carDamageD"], "damage_left": payload["carDamageT"],
        "damage_right": payload["carDamageE"], "damage_general": payload["carDamageG"],
        "tyre_fl_pressure": payload["tyrePressureFL"], "tyre_fr_pressure": payload["tyrePressureFR"],
        "tyre_rl_pressure": payload["tyrePressureRL"], "tyre_rr_pressure": payload["tyrePressureRR"],
        "abs_value": payload["abs"], "tc_value": payload["tc"],
        "current_time": payload["currentTime"], "last_time": payload["lastTime"],
        "best_time": payload["bestTime"], "completed_laps": payload["completedLaps"],
        "current_sector": payload["currentSector"], "number_of_laps": payload["numberOfLaps"],
    })
    return result


sock = None

async def enviar_telemetria(websocket):
    buffer_recebido = ""
    while True:
        try:
            # Lê os dados do socket
            data = sock.recv(2048).decode(errors='ignore')
            if data:
                buffer_recebido += data
                
                # Processa linha por linha
                while '\n' in buffer_recebido:
                    linha, buffer_recebido = buffer_recebido.split('\n', 1)
                    linha = linha.strip()
                    
                    if not linha or not (linha[0].isdigit() or linha[0] == '-'):
                        continue

                    # Mantem a posicao original dos campos; remover vazios desloca os indices de lap timing.
                    valores = linha.split(',')

                    if len(valores) >= 36:
                        try:
                            # Empacota os dados essenciais em um JSON
                            payload = {
                                "speed": float(valores[0]),
                                "rpm": float(valores[1]),
                                "gear": int(valores[2]),
                                "gas": float(valores[3]),
                                "brake": float(valores[4]),
                                "clutch": float(valores[35]),
                                
                                #Combustivel
                                "fuel": float(valores[5]),
                                
                                "steer": float(valores[6]),
                                
                                # Temperaturas dos Pneus (Índices 11 ao 14)
                                "tyreFL": float(valores[11]),
                                "tyreFR": float(valores[12]),
                                "tyreRL": float(valores[13]),
                                "tyreRR": float(valores[14]),
                                
                                # Temperaturas dos Freios (Índices 15 ao 18)
                                "brakeFL": float(valores[15]), 
                                "brakeFR": float(valores[16]),
                                "brakeRL": float(valores[17]),
                                "brakeRR": float(valores[18]),
                                
                                # ERS (Energia)
                                
                                "ersPower": float(valores[19]),
                                
                                # Desgate dos Pneus
                                "tyreWFL": float(valores[20]),
                                "tyreWFR": float(valores[21]),
                                "tyreWRL": float(valores[22]),
                                "tyreWRR": float(valores[23]),

                                # Dano do carro
                                "carDamageF": float(valores[24]),
                                "carDamageD": float(valores[25]),
                                "carDamageT": float(valores[26]),
                                "carDamageE": float(valores[27]),
                                "carDamageG": float(valores[28]),
                                
                                #Pressao dos Pneus
                                "tyrePressureFL" :float(valores[29]),
                                "tyrePressureFR" :float(valores[30]),
                                "tyrePressureRL" :float(valores[31]),
                                "tyrePressureRR" :float(valores[32]),
                                
                                #Assistencia
                                "abs": float(valores[33]),
                                "tc": float(valores[34]),
                                
                                #DRS
                                "drs": float(valores[7]),

                                # ===== TEMPOS DE VOLTA (area graphics) =====
                                # Indices 36-45 sao adicionados pelo readT.c
                                "currentTime":     valores[36].strip() if len(valores) > 36 and valores[36].strip() else "--:--.---",
                                "lastTime":        valores[37].strip() if len(valores) > 37 and valores[37].strip() else "--:--.---",
                                "bestTime":        valores[38].strip() if len(valores) > 38 and valores[38].strip() else "--:--.---",
                                "split":           valores[39].strip() if len(valores) > 39 and valores[39].strip() else "--:--.---",
                                "completedLaps":   int(valores[40]) if len(valores) > 40 and valores[40].strip().isdigit() else 0,
                                "position":        int(valores[41]) if len(valores) > 41 and valores[41].strip().lstrip('-').isdigit() else 0,
                                "currentSector":   int(valores[42]) if len(valores) > 42 and valores[42].strip().isdigit() else 0,
                                "numberOfLaps":    int(valores[43]) if len(valores) > 43 and valores[43].strip().isdigit() else 0,
                                "status":           int(valores[44]) if len(valores) > 44 and valores[44].strip().isdigit() else 0,
                                "session":         int(valores[45]) if len(valores) > 45 and valores[45].strip().isdigit() else 0,
                    
                            }
                            
                            # Envia para o navegador
                            await websocket.send(json.dumps(payload))
                        except ValueError as ve:
                            print(f"Erro ao converter valor para float: {ve}")
                            # Se der erro de conversão, apenas ignora essa linha e continua
                            
        except BlockingIOError:
            pass # Sem dados novos no socket no momento
        except websockets.exceptions.ConnectionClosed:
            print("Navegador desconectou.")
            break # Único momento aceitável para usar o break
        except Exception as e:
            print(f"Erro inesperado: {e}")

        # Uma pequena pausa para não fritar a CPU (20 FPS = 0.05s)
        await asyncio.sleep(0.05)

async def ingest_telemetry():
    global sock, bucket_second, pending_payload, pending_frame_monotonic
    buffer_recebido = ""

    while True:
        try:
            data = await asyncio.get_running_loop().sock_recv(sock, 8192)
            if not data:
                sock = await conectar_socket_async()
                continue
            buffer_recebido += data.decode(errors='ignore')
            while '\n' in buffer_recebido:
                linha, buffer_recebido = buffer_recebido.split('\n', 1)
                if not linha.strip() or not (linha.strip()[0].isdigit() or linha.strip()[0] == '-'):
                    continue
                payload = parse_telemetry(linha)
                if payload is None:
                    continue
                frame_monotonic = time.monotonic()
                if recording:
                    current_bucket = int(frame_monotonic - started_monotonic)
                    if bucket_second is None:
                        bucket_second = current_bucket
                    elif current_bucket != bucket_second:
                        await flush_recording_bucket()
                        bucket_second = current_bucket
                    pending_payload = payload
                    pending_frame_monotonic = frame_monotonic
                if clients:
                    message = json.dumps(payload)
                    await asyncio.gather(*(client.send(message) for client in tuple(clients)), return_exceptions=True)
        except asyncio.CancelledError:
            await flush_recording_bucket()
            raise
        except (BlockingIOError, ConnectionResetError, OSError):
            await asyncio.sleep(0.01)


async def websocket_handler(websocket):
    clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)


async def start_recording():
    global recording, sample_index, started_monotonic, bucket_second, pending_payload, pending_frame_monotonic
    if recording:
        return storage._session_id
    await storage.start_session({
        "car": os.getenv("HYPERCORSA_CAR"),
        "track": os.getenv("HYPERCORSA_TRACK"),
        "mode": os.getenv("HYPERCORSA_MODE"),
    })
    sample_index = 0
    started_monotonic = time.monotonic()
    bucket_second = None
    pending_payload = None
    pending_frame_monotonic = None
    recording = True
    return storage._session_id


async def stop_recording():
    global recording, bucket_second, pending_payload, pending_frame_monotonic
    if recording:
        await flush_recording_bucket()
        recording = False
        await storage.close_session()


async def flush_recording_bucket():
    global pending_payload, pending_frame_monotonic
    if pending_payload is not None:
        await storage.add_sample(to_storage_sample(pending_payload, pending_frame_monotonic))
        pending_payload = None
        pending_frame_monotonic = None


async def conectar_socket_async():
    while True:
        try:
            new_socket = await asyncio.to_thread(socket.create_connection, (HOST_AC, PORT_AC), 2)
            new_socket.setblocking(False)
            print("Conectado ao CorsaX!")
            return new_socket
        except OSError as error:
            print(f"Aguardando o CorsaX.exe na porta 5000... ({error})")
            await asyncio.sleep(1)


async def http_handler(reader, writer):
    request = await reader.readline()
    parts = request.decode(errors='ignore').split()
    if len(parts) < 2 or parts[0] != 'GET':
        writer.close()
        return
    parsed_url = urlparse(parts[1])
    target = parsed_url.path
    query = parse_qs(parsed_url.query)
    try:
        sample_limit = min(max(int(query.get('limit', ['5000'])[0]), 100), 20000)
    except ValueError:
        sample_limit = 5000
    status = 200
    if target == '/api/health':
        body = json.dumps({"status": "ok", "recording": recording}).encode()
        content_type = 'application/json'
    elif target == '/api/recording/start':
        try:
            session_id = await start_recording()
            body = json.dumps({"recording": True, "session_id": session_id}).encode()
            content_type = 'application/json'
        except Exception as error:
            body = json.dumps({"error": str(error)}).encode()
            content_type = 'application/json'
            status = 503
    elif target == '/api/recording/stop':
        try:
            await stop_recording()
            body = b'{"recording":false}'
            content_type = 'application/json'
        except Exception as error:
            body = json.dumps({"error": str(error)}).encode()
            content_type = 'application/json'
            status = 503
    elif target == '/api/sessions':
        try:
            rows = await storage.list_sessions()
            body = json.dumps(rows, default=lambda value: value.isoformat()).encode()
            content_type = 'application/json'
        except Exception as error:
            body = json.dumps({"error": str(error)}).encode()
            content_type = 'application/json'
            status = 503
    elif target.startswith('/api/sessions/') and target.endswith('/samples'):
        session_id = target.split('/')[3]
        try:
            rows = await storage.get_samples(session_id, sample_limit)
            body = json.dumps(rows, default=lambda value: value.isoformat()).encode()
            content_type = 'application/json'
        except Exception as error:
            body = json.dumps({"error": str(error)}).encode()
            content_type = 'application/json'
            status = 503
    elif target == '/api/compare':
        try:
            first_id = query.get('left', [None])[0]
            second_id = query.get('right', [None])[0]
            if not first_id or not second_id:
                raise ValueError('Informe left e right')
            first, second = await asyncio.gather(
                storage.get_samples(first_id, sample_limit), storage.get_samples(second_id, sample_limit)
            )
            body = json.dumps({"left": first, "right": second}, default=lambda value: value.isoformat()).encode()
            content_type = 'application/json'
        except Exception as error:
            body = json.dumps({"error": str(error)}).encode()
            content_type = 'application/json'
            status = 503
    else:
        relative = target.lstrip('/') or 'graphics.html'
        if relative.startswith('View/'):
            relative = relative[5:]
        path = (VIEW_ROOT / relative).resolve()
        if VIEW_ROOT not in path.parents or not path.is_file():
            writer.write(b'HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
            await writer.drain()
            writer.close()
            return
        body = path.read_bytes()
        content_type = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    reason = 'OK' if status == 200 else 'Service Unavailable'
    headers = f'HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n'
    writer.write(headers.encode() + body)
    await writer.drain()
    writer.close()


async def main():
    global sock, sample_index, started_monotonic
    http_server = await asyncio.start_server(http_handler, 'localhost', HTTP_PORT)
    ws_server = await websockets.serve(websocket_handler, "localhost", 8765)
    print(f"Servidor HTTP rodando em http://localhost:{HTTP_PORT}")
    print("Servidor WebSocket rodando em ws://localhost:8765")
    try:
        sock = await conectar_socket_async()
        sample_index = 0
        started_monotonic = time.monotonic()
        await ingest_telemetry()
    finally:
        ws_server.close()
        await ws_server.wait_closed()
        http_server.close()
        await http_server.wait_closed()
        await storage.close_session()

if __name__ == "__main__":
    asyncio.run(main())