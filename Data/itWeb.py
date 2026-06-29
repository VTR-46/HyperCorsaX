import socket
import json
import asyncio
import websockets

#ASSETTO

HOST_AC = 'localhost'
PORT_AC = 5000

# Conecta ao servidor C do Assetto Corsa
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect((HOST_AC, PORT_AC))
sock.setblocking(False)
print("Conectado ao CorsaX! Aguardando frontend...")

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

                    valores = linha.split(',')
                    if len(valores) == 15:
                        # Empacota os dados essenciais em um JSON
                        payload = {
                            "speed": float(valores[0]),
                            "rpm": float(valores[1]),
                            "gas": float(valores[3]),
                            "brake": float(valores[4]),
                            "steer": float(valores[6])
                        }
                        
                        # Envia para o navegador
                        await websocket.send(json.dumps(payload))
                        
        except BlockingIOError:
            pass # Sem dados novos no socket no momento
        except websockets.exceptions.ConnectionClosed:
            break # Navegador desconectou
        except Exception as e:
            print(f"Erro: {e}")
            break
            
        # Uma pequena pausa para não fritar a CPU (20 FPS = 0.05s)
        await asyncio.sleep(0.05) 

async def main():
    # Inicia o servidor WebSocket na porta 8765
    async with websockets.serve(enviar_telemetria, "localhost", 8765):
        print("Servidor WebSocket rodando em ws://localhost:8765")
        await asyncio.Future()  # Roda para sempre

if __name__ == "__main__":
    asyncio.run(main())