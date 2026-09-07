import socket
import json
import asyncio
import time
import websockets

HOST_AC = 'localhost'
PORT_AC = 5000

connected_clients = set()
latest_telemetry_json = None

def to_float(val, default=0.0):
    try:
        s = str(val).strip()
        return float(s) if s else default
    except (ValueError, TypeError):
        return default

def to_int(val, default=0):
    try:
        s = str(val).strip()
        return int(float(s)) if s else default
    except (ValueError, TypeError):
        return default

def parse_telemetry_line(linha):
    valores = linha.split(',')
    if len(valores) < 52:
        return None

    return {
        "speed": to_float(valores[0]),
        "rpm": to_float(valores[1]),
        "gear": to_int(valores[2]),
        "gas": to_float(valores[3]),
        "brake": to_float(valores[4]),
        "clutch": to_float(valores[35]) if len(valores) > 35 else 0.0,
        
        "fuel": to_float(valores[5]),
        "steer": to_float(valores[6]),

        # Força G
        "accG_x": to_float(valores[8]) if len(valores) > 8 else 0.0,
        "accG_y": to_float(valores[9]) if len(valores) > 9 else 0.0,
        "accG_z": to_float(valores[10]) if len(valores) > 10 else 0.0,
        
        # Temperaturas dos Pneus (Índices 11 ao 14)
        "tyreFL": to_float(valores[11]) if len(valores) > 11 else 0.0,
        "tyreFR": to_float(valores[12]) if len(valores) > 12 else 0.0,
        "tyreRL": to_float(valores[13]) if len(valores) > 13 else 0.0,
        "tyreRR": to_float(valores[14]) if len(valores) > 14 else 0.0,
        
        # Temperaturas dos Freios (Índices 15 ao 18)
        "brakeFL": to_float(valores[15]) if len(valores) > 15 else 0.0,
        "brakeFR": to_float(valores[16]) if len(valores) > 16 else 0.0,
        "brakeRL": to_float(valores[17]) if len(valores) > 17 else 0.0,
        "brakeRR": to_float(valores[18]) if len(valores) > 18 else 0.0,
        
        # ERS (Energia)
        "ersPower": to_float(valores[19]) if len(valores) > 19 else 0.0,
        
        # Desgate dos Pneus
        "tyreWFL": to_float(valores[20]) if len(valores) > 20 else 0.0,
        "tyreWFR": to_float(valores[21]) if len(valores) > 21 else 0.0,
        "tyreWRL": to_float(valores[22]) if len(valores) > 22 else 0.0,
        "tyreWRR": to_float(valores[23]) if len(valores) > 23 else 0.0,

        # Dano do carro
        "carDamageF": to_float(valores[24]) if len(valores) > 24 else 0.0,
        "carDamageD": to_float(valores[25]) if len(valores) > 25 else 0.0,
        "carDamageT": to_float(valores[26]) if len(valores) > 26 else 0.0,
        "carDamageE": to_float(valores[27]) if len(valores) > 27 else 0.0,
        "carDamageG": to_float(valores[28]) if len(valores) > 28 else 0.0,
        
        # Pressao dos Pneus
        "tyrePressureFL": to_float(valores[29]) if len(valores) > 29 else 0.0,
        "tyrePressureFR": to_float(valores[30]) if len(valores) > 30 else 0.0,
        "tyrePressureRL": to_float(valores[31]) if len(valores) > 31 else 0.0,
        "tyrePressureRR": to_float(valores[32]) if len(valores) > 32 else 0.0,
        
        # Assistencia
        "abs": to_float(valores[33]) if len(valores) > 33 else 0.0,
        "tc": to_float(valores[34]) if len(valores) > 34 else 0.0,
        
        # DRS
        "drs": to_float(valores[7]) if len(valores) > 7 else 0.0,
        
        # Suspensao
        "suspensionTravelFL": to_float(valores[48]) if len(valores) > 48 else 0.0,
        "suspensionTravelFR": to_float(valores[49]) if len(valores) > 49 else 0.0,
        "suspensionTravelRL": to_float(valores[50]) if len(valores) > 50 else 0.0,
        "suspensionTravelRR": to_float(valores[51]) if len(valores) > 51 else 0.0,

        # Tempos de volta
        "currentTime":     valores[36].strip() if len(valores) > 36 and valores[36].strip() else "--:--.---",
        "lastTime":        valores[37].strip() if len(valores) > 37 and valores[37].strip() else "--:--.---",
        "bestTime":        valores[38].strip() if len(valores) > 38 and valores[38].strip() else "--:--.---",
        "split":           valores[39].strip() if len(valores) > 39 and valores[39].strip() else "--:--.---",
        "completedLaps":   to_int(valores[40]) if len(valores) > 40 else 0,
        "position":        to_int(valores[41]) if len(valores) > 41 else 0,
        "currentSector":   to_int(valores[42]) if len(valores) > 42 else 0,
        "numberOfLaps":    to_int(valores[43]) if len(valores) > 43 else 0,
        "status":          to_int(valores[44]) if len(valores) > 44 else 0,
        "session":         to_int(valores[45]) if len(valores) > 45 else 0,
        "iLastTime":       to_int(valores[46], -1) if len(valores) > 46 else -1,
        "lastSectorTime":  to_int(valores[47], -1) if len(valores) > 47 else -1,
        
        # tyreTempI, M, O (indices 52..63)
        "tyreTempIFL": to_float(valores[52]) if len(valores) > 52 else 0.0,
        "tyreTempIFR": to_float(valores[53]) if len(valores) > 53 else 0.0,
        "tyreTempIRL": to_float(valores[54]) if len(valores) > 54 else 0.0,
        "tyreTempIRR": to_float(valores[55]) if len(valores) > 55 else 0.0,
        
        "tyreTempMFL": to_float(valores[56]) if len(valores) > 56 else 0.0,
        "tyreTempMFR": to_float(valores[57]) if len(valores) > 57 else 0.0,
        "tyreTempMRL": to_float(valores[58]) if len(valores) > 58 else 0.0,
        "tyreTempMRR": to_float(valores[59]) if len(valores) > 59 else 0.0,
        
        "tyreTempOFL": to_float(valores[60]) if len(valores) > 60 else 0.0,
        "tyreTempOFR": to_float(valores[61]) if len(valores) > 61 else 0.0,
        "tyreTempORL": to_float(valores[62]) if len(valores) > 62 else 0.0,
        "tyreTempORR": to_float(valores[63]) if len(valores) > 63 else 0.0,

        # Dados estáticos do carro (indices 64..76)
        "carModel":         valores[64].strip() if len(valores) > 64 else "",
        "maxTorque":        to_float(valores[65]) if len(valores) > 65 else 0.0,
        "maxPower":         to_float(valores[66]) if len(valores) > 66 else 0.0,
        "maxRpm":           to_int(valores[67]) if len(valores) > 67 else 0,
        "maxFuel":          to_float(valores[68]) if len(valores) > 68 else 0.0,
        "suspMaxFL":        to_float(valores[69]) if len(valores) > 69 else 0.0,
        "suspMaxFR":        to_float(valores[70]) if len(valores) > 70 else 0.0,
        "suspMaxRL":        to_float(valores[71]) if len(valores) > 71 else 0.0,
        "suspMaxRR":        to_float(valores[72]) if len(valores) > 72 else 0.0,
        "maxTurboBoost":    to_float(valores[73]) if len(valores) > 73 else 0.0,
        "hasDRS":           to_int(valores[74]) if len(valores) > 74 else 0,
        "hasERS":           to_int(valores[75]) if len(valores) > 75 else 0,
        "hasKERS":          to_int(valores[76]) if len(valores) > 76 else 0,

        # Ambiente (indices 77..79)
        "surfaceGrip":      to_float(valores[77]) if len(valores) > 77 else 0.0,
        "windSpeed":        to_float(valores[78]) if len(valores) > 78 else 0.0,
        "windDirection":    to_float(valores[79]) if len(valores) > 79 else 0.0,
    }

async def socket_receiver_loop():
    global latest_telemetry_json
    while True:
        sock = None
        # Conexão / reconexão com readT.exe
        while sock is None:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.connect((HOST_AC, PORT_AC))
                sock.setblocking(False)
                print("[Socket] Conectado ao CorsaX (porta 5000)!")
            except (ConnectionRefusedError, OSError):
                sock = None
                await asyncio.sleep(1)

        buffer_recebido = ""
        while True:
            try:
                data = sock.recv(2048).decode(errors='ignore')
                if not data:
                    print("[Socket] Conexão com CorsaX perdida. Reconectando...")
                    sock.close()
                    break

                buffer_recebido += data
                while '\n' in buffer_recebido:
                    linha, buffer_recebido = buffer_recebido.split('\n', 1)
                    linha = linha.strip()

                    if not linha or not (linha[0].isdigit() or linha[0] == '-'):
                        continue

                    payload = parse_telemetry_line(linha)
                    if payload:
                        msg = json.dumps(payload)
                        latest_telemetry_json = msg
                        if connected_clients:
                            await asyncio.gather(*[client.send(msg) for client in list(connected_clients)], return_exceptions=True)

            except BlockingIOError:
                pass
            except Exception as e:
                print(f"[Socket] Erro no receiver: {e}")
                sock.close()
                break

            await asyncio.sleep(0.02)

async def ws_handler(websocket):
    connected_clients.add(websocket)
    print(f"[WebSocket] Cliente conectado! Total: {len(connected_clients)}")
    
    # Envia imediatamente o último dado disponível
    if latest_telemetry_json:
        try:
            await websocket.send(latest_telemetry_json)
        except Exception:
            pass

    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print(f"[WebSocket] Cliente desconectado. Restantes: {len(connected_clients)}")

async def main():
    asyncio.create_task(socket_receiver_loop())
    async with websockets.serve(ws_handler, "localhost", 8765):
        print("Servidor WebSocket rodando em ws://localhost:8765")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
