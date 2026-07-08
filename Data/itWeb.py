import socket
import json
import asyncio
import time
import websockets

#ASSETTO

HOST_AC = 'localhost'
PORT_AC = 5000

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


# Conecta ao servidor C do Assetto Corsa
sock = conectar_socket()

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

                    valores = [valor for valor in linha.split(',') if valor != '']

                    if len(valores) >= 29:
                        try:
                            # Empacota os dados essenciais em um JSON
                            payload = {
                                "speed": float(valores[0]),
                                "rpm": float(valores[1]),
                                "gas": float(valores[3]),
                                "brake": float(valores[4]),
                                
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
                                "carDamageG": float(valores[28])
                    
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

async def main():
    # Inicia o servidor WebSocket na porta 8765
    async with websockets.serve(enviar_telemetria, "localhost", 8765):
        print("Servidor WebSocket rodando em ws://localhost:8765")
        await asyncio.Future()  # Roda para sempre

if __name__ == "__main__":
    asyncio.run(main())