import socket
import threading
import time
from collections import deque
import pyqtgraph as pg
from pyqtgraph.Qt import QtCore, QtWidgets

HOST = 'localhost'
PORT = 5000
MAX_PONTOS = 200

# Buffer circular
dados = {
    'speed': deque(maxlen=MAX_PONTOS),
    'rpm': deque(maxlen=MAX_PONTOS),
    'gas': deque(maxlen=MAX_PONTOS),
    'brake': deque(maxlen=MAX_PONTOS),
    'fuel': deque(maxlen=MAX_PONTOS),
    'steer': deque(maxlen=MAX_PONTOS),
    'accG_x': deque(maxlen=MAX_PONTOS),
    'accG_y': deque(maxlen=MAX_PONTOS),
    'tyre_FL': deque(maxlen=MAX_PONTOS),
    'tyre_FR': deque(maxlen=MAX_PONTOS),
    'tyre_RL': deque(maxlen=MAX_PONTOS),
    'tyre_RR': deque(maxlen=MAX_PONTOS),
    'tempo': deque(maxlen=MAX_PONTOS)
}

# Conectar ao C
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect((HOST, PORT))
sock.setblocking(False)
print("Conectado ao CorsaX!")

inicio = time.time()

# ---------------------------------------------------------
# THREAD DE LEITURA (Rodando em background)
# ---------------------------------------------------------
def atualizar_dados():
    buffer_recebido = ""
    while True:
        try:
            data = sock.recv(2048).decode()
            if data:
                buffer_recebido += data
                
                while '\n' in buffer_recebido:
                    linha, buffer_recebido = buffer_recebido.split('\n', 1)
                    linha = linha.strip()
                    
                    if not linha or not (linha[0].isdigit() or linha[0] == '-'):
                        continue
                    
                    valores = linha.split(',')
                    if len(valores) == 15:
                        (speed, rpm, gear, gas, brake, fuel, steer, drs,
                         gx, gy, gz, tyre_rl, tyre_rr, tyre_fl, tyre_fr) = map(float, valores)
                        
                        agora = time.time() - inicio
                        
                        dados['speed'].append(speed)
                        dados['rpm'].append(rpm)
                        dados['gas'].append(gas)
                        dados['brake'].append(brake)
                        dados['fuel'].append(fuel)
                        dados['steer'].append(steer)
                        dados['accG_x'].append(gx)
                        dados['accG_y'].append(gy)
                        dados['tyre_FL'].append(tyre_fl)
                        dados['tyre_FR'].append(tyre_fr)
                        dados['tyre_RL'].append(tyre_rl)
                        dados['tyre_RR'].append(tyre_rr)
                        dados['tempo'].append(agora)
                        
        except BlockingIOError:
            pass
        except Exception as e:
            print(f"Conexão encerrada ou erro: {e}")
            break
        time.sleep(0.01)

# Inicia a thread de coleta
thread = threading.Thread(target=atualizar_dados, daemon=True)
thread.start()

# ---------------------------------------------------------
# CONFIGURAÇÃO DA INTERFACE (PyQtGraph)
# ---------------------------------------------------------
# Configurações globais (Fundo escuro por padrão)
pg.setConfigOptions(antialias=True)
app = QtWidgets.QApplication([])

# Janela principal
win = pg.GraphicsLayoutWidget(show=True, title="HyperCorsaX - Assetto Corsa")
win.resize(1200, 800)

# Função auxiliar para criar gráficos padrão
def criar_grafico(titulo):
    p = win.addPlot(title=titulo)
    p.showGrid(x=True, y=True, alpha=0.3)
    p.addLegend(offset=(10, 10))
    return p

# --- LINHA 1 ---
p_vel = criar_grafico("Velocidade e RPM")
curva_vel = p_vel.plot(pen=pg.mkPen('#FF6B6B', width=2), name='Velocidade')


p_rpm = criar_grafico("Velocidade e RPM")
curva_rpm = p_rpm.plot(pen=pg.mkPen('#4ECDC4', width=2), name='RPM/100')

p_pedais = criar_grafico("Pedais")
p_pedais.setYRange(-0.1, 1.1) # Pedais vão de 0 a 1
curva_gas = p_pedais.plot(pen=pg.mkPen("#00FF37", width=2), name='Acelerador')
curva_freio = p_pedais.plot(pen=pg.mkPen('#E74C3C', width=2), name='Freio')

win.nextRow()

# --- LINHA 2 ---
p_gforce = criar_grafico("Força G")
curva_gx = p_gforce.plot(pen=pg.mkPen('#00D2D3', width=2), name='G Lateral')
curva_gy = p_gforce.plot(pen=pg.mkPen('#F9CA24', width=2), name='G Longitudinal')

p_pneus = criar_grafico("Temperatura Pneus")
curva_tfl = p_pneus.plot(pen=pg.mkPen('#F9CA24', width=2), name='TE')
curva_tfr = p_pneus.plot(pen=pg.mkPen('#6C5CE7', width=2), name='TD')
curva_trl = p_pneus.plot(pen=pg.mkPen('#FF6B6B', width=2), name='DE')
curva_trr = p_pneus.plot(pen=pg.mkPen('#4ECDC4', width=2), name='DD')

win.nextRow()

# --- LINHA 3 ---
p_comb = criar_grafico("Combustível (L)")
curva_comb = p_comb.plot(pen=pg.mkPen('#00B894', width=2), name='Combustível')

p_volante = criar_grafico("Ângulo do Volante")
curva_volante = p_volante.plot(pen=pg.mkPen('#FD79A8', width=2), name='Volante')

# ---------------------------------------------------------
# ATUALIZAÇÃO DOS GRÁFICOS (QTimer)
# ---------------------------------------------------------
def atualizar_graficos():
    t = list(dados['tempo'])
    if not t: return

    # Atualiza dados das curvas
    curva_vel.setData(t, list(dados['speed']))
    curva_rpm.setData(t, list(dados['rpm']))
    
    curva_gas.setData(t, list(dados['gas']))
    curva_freio.setData(t, list(dados['brake']))
    
    curva_gx.setData(t, list(dados['accG_x']))
    curva_gy.setData(t, list(dados['accG_y']))
    
    curva_tfl.setData(t, list(dados['tyre_FL']))
    curva_tfr.setData(t, list(dados['tyre_FR']))
    curva_trl.setData(t, list(dados['tyre_RL']))
    curva_trr.setData(t, list(dados['tyre_RR']))
    
    curva_comb.setData(t, list(dados['fuel']))
    curva_volante.setData(t, list(dados['steer']))

# Timer que chama a função de atualização a cada 50ms (20 FPS)
timer = QtCore.QTimer()
timer.timeout.connect(atualizar_graficos)
timer.start(50)

# Inicia o Loop da Interface Gráfica
try:
    QtWidgets.QApplication.instance().exec()
except KeyboardInterrupt:
    print("\nEncerrando...")
finally:
    sock.close()