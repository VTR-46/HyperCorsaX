# Hyper Corsa X

![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Assetto Corsa](https://img.shields.io/badge/Assetto_Corsa-Telemetry-red.svg)
![Python](https://img.shields.io/badge/Python-3.x-blue.svg)
![C](https://img.shields.io/badge/C-Shared_Memory-lightgrey.svg)

**Hyper Corsa X** é um sistema de telemetria avançado e em tempo real para o simulador Assetto Corsa. Ele captura dados físicos e gráficos do jogo diretamente da memória compartilhada (Shared Memory) e os transmite, de maneira tratada e padronizada, para um painel web interativo, fornecendo análises precisas de desempenho de pilotagem.

---

## 🚀 Como Funciona

A arquitetura do projeto é dividida em três camadas que operam em conjunto:

1. **Leitor de Memória (C):** O executável `CorsaX.exe` acessa diretamente a *Shared Memory* do Assetto Corsa. Ele extrai dezenas de parâmetros (velocidade, RPM, pedais, curso da suspensão, temperaturas e desgaste de pneus) em alta frequência e os transmite via socket TCP (porta 5000).
2. **Servidor e Tratamento de Dados (Python):** O script `itWeb.py` atua como o motor de tratamento. Ele se conecta ao leitor C, converte os dados brutos em objetos JSON devidamente estruturados e padronizados. Ele também conta com um `LapTracker` inteligente para gerenciar sessões e voltas. Os dados formatados são então transmitidos via WebSocket (`ws://localhost:8765`).
3. **Painel de Visualização (Web):** A interface frontend (HTML/JS/CSS) no arquivo `graphics.html` consome esses pacotes via WebSocket e renderiza os gráficos e painéis em tempo real para o usuário direto no navegador.

---

## 💻 Tecnologias Utilizadas

- **C & Windows API:** Para acessar rapidamente a estrutura de *Shared Memory* do jogo (`windows.h`, manipulação de sockets nativos).
- **Python 3:** Como middleware assíncrono para conversão dos pacotes, controle lógico de voltas e difusão de dados (`asyncio`, `websockets`, `json`, `socket`).
- **HTML5 / CSS / JavaScript vanilla:** Construção da interface gráfica de telemetria rápida e reativa no navegador web.
- **Batch Script:** Script de automação (`tl.bat`) para a execução simultânea dos microsserviços.

---

## 🛠️ Como Usar (Passo a Passo)

### Pré-requisitos
- **Assetto Corsa** rodando no PC.
- **Python 3** instalado na máquina.
- Instalar a biblioteca Python `websockets`. No terminal, rode:
  ```bash
  pip install websockets
  ```

### Execução

1. Abra o **Assetto Corsa** e inicie uma sessão (vá para a pista com um carro).
2. Navegue até a pasta do projeto **Hyper Corsa X**.
3. Dê um duplo-clique no arquivo `tl.bat`.
4. O script automatizará o processo de inicialização:
   - O servidor TCP `CorsaX.exe` iniciará.
   - O servidor Python `itWeb.py` conectará e criará o servidor WebSocket.
   - O seu navegador padrão se abrirá exibindo o painel `graphics.html`.
5. Pilote no simulador e acompanhe seus dados de telemetria saltando na tela em tempo real!

*(Para fechar, basta fechar o navegador e as janelas do terminal abertas pelo script).*

---

## 🗺️ Próximos Passos (Roadmap)

O Hyper Corsa X continuará evoluindo para se tornar uma ferramenta imprescindível para engenheiros e pilotos virtuais. As próximas atualizações focarão em:

- **2º Passo: Sistema Inteligente de Feedback 📊**
  Criar um sistema de feedback baseado na telemetria atual. A ferramenta irá indicar e sugerir ativamente ao engenheiro e ao usuário o que deve ser modificado no *setup* do carro para melhorar o desempenho, além de sugerir técnicas de como o piloto deve abordar o traçado.
  
- **3º Passo: Integração com Machine Learning 🤖**
  Em seguida, a inteligência da ferramenta será expandida implementando modelos de Machine Learning no projeto. Isso permitirá prever comportamentos do veículo e padrões de desgaste, trazendo um nível de análise preditiva de classe mundial para o simulador.

---

<div align="center">
  Desenvolvido para extrair cada milésimo de segundo de performance no asfalto virtual. 🏁
</div>

---

<p align="center">
  <img src="https://media1.tenor.com/m/37FWvD8KpA8AAAAC/ayrton-senna.gif" width="300" alt="Ayrton Senna" />
  <br>
  <em>"Não tem como você saber o seu limite. Você tem que ir até o limite, e o limite é onde você se encontra." — Ayrton Senna 🇧🇷</em>
</p>

---


<p align="center">
  <sub><a href="https://github.com/VTR-46">VTR-46</a> | Última atualização: Setembro 2026</sub>
</p>
