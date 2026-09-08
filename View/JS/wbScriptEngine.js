let autoScroll = true;

// Quando o usuário interagir com o gráfico (arrastar/zoom) desliga o Auto-Scroll
const pausarAutoScroll = () => {
    if (autoScroll) {
        autoScroll = false;
        const btn = document.getElementById('btnAutoScroll');
        btn.innerText = "Auto-Scroll: DESLIGADO (Ver Histórico)";
        btn.classList.add('off');
    }
};

// Função do botão para voltar ao tempo real
window.toggleAutoScroll = () => {
    autoScroll = true;
    const btn = document.getElementById('btnAutoScroll');
    btn.innerText = "Auto-Scroll: LIGADO";
    btn.classList.remove('off');
};

// performance e zoom
const commonOptions = {
    animation: false,
    parsing: false, // ideal
    // normalized: true,  // REMOVIDO no Chart.js v4
    responsive: true,
    elements: { point: { radius: 0 } },
    scales: {
        x: {
            type: 'linear', // Eixo X (segundos)
            title: { display: true, text: 'Tempo de Sessão (s)', color: '#888' },
            ticks: { color: '#888' },
            grid: { color: '#333' }
        },
        y: { grid: { color: '#333' }, ticks: { color: '#888' } }
    },
    plugins: {
        zoom: {
            pan: {
                enabled: true,
                mode: 'x', // Permite arrastar apenas na horizontal
                onPanStart: pausarAutoScroll
            },
            zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: 'x', // Permite zoom apenas na horizontal
                onZoomStart: pausarAutoScroll
            }
        }
    }
};

// Gráfico de Velocidade
const ctxRpm = document.getElementById('rpmChart').getContext('2d');
const rpmChart = new Chart(ctxRpm, {
    type: 'line',
    data: {
        datasets: [{ label: 'RPM', data: [], borderColor: '#FF6B6B', borderWidth: 2 }]
    },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { suggestedMin: 0, suggestedMax: 14000, ...commonOptions.scales.y } } }
});

// Grafico de Pedais
const ctxPedals = document.getElementById('pedalsChart').getContext('2d');
const pedalsChart = new Chart(ctxPedals, {
    type: 'line',
    data: {
        datasets: [
            { label: 'Acelerador', data: [], borderColor: '#00FF37', borderWidth: 2 },
            { label: 'Freio', data: [], borderColor: '#E74C3C', borderWidth: 2 }
        ]
    },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { min: -0.1, max: 1.1, ...commonOptions.scales.y } } }
});

// Repopula gráficos do buffer na inicialização
function repopulateChartsFromBuffer() {
    const history = sharedTelemetryBuffer.getAll();
    if (history.length === 0) return;

    const speedData = rpmChart.data.datasets[0].data;
    const gasData = pedalsChart.data.datasets[0].data;
    const brakeData = pedalsChart.data.datasets[1].data;

    history.forEach(packet => {
        const t = packet.t;
        speedData.push({ x: t, y: packet.rpm });
        gasData.push({ x: t, y: packet.gas });
        brakeData.push({ x: t, y: packet.brake });
    });

    if (typeof syncChartAnnotations !== 'undefined') {
        rpmChart.annotVersion = syncChartAnnotations(rpmChart, -1);
        pedalsChart.annotVersion = syncChartAnnotations(pedalsChart, -1);
    }

    rpmChart.update();
    pedalsChart.update();
}


const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hexToRgb = (hex) => {
    const normalized = hex.replace('#', '');
    const size = normalized.length === 3 ? 1 : 2;
    const expand = size === 1 ? normalized.split('').map((part) => part + part).join('') : normalized;
    const number = parseInt(expand, 16);

    return {
        r: (number >> 16) & 255,
        g: (number >> 8) & 255,
        b: number & 255,
    };
};

const rgbToHex = (r, g, b) => {
    const toHex = (value) => value.toString(16).padStart(2, '0');
    return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}`;
};

const mixColor = (from, to, ratio) => {
    const start = hexToRgb(from);
    const end = hexToRgb(to);
    return rgbToHex(
        start.r + (end.r - start.r) * ratio,
        start.g + (end.g - start.g) * ratio,
        start.b + (end.b - start.b) * ratio
    );
};

const getMeterColor = (percent, lowColor, idealColor, highColor) => {
    if (percent <= 45) {
        return mixColor(lowColor, idealColor, percent / 45);
    }
    return mixColor(idealColor, highColor, (percent - 45) / 55);
};

const updateMeter = (fillId, valueId, value, min, max, suffix, lowColor, highColor) => {
    const normalized = ((value - min) / (max - min)) * 100;
    const percent = clamp(normalized, 0, 100);
    const fill = document.getElementById(fillId);
    const label = document.getElementById(valueId);
    if (!fill || !label) return;
    fill.style.height = percent + '%';
    fill.style.background = getMeterColor(percent, lowColor, '#33FF00', highColor);
    label.innerText = `${value.toFixed(1)}${suffix}`;
};

const updateMeterTyreWear = (fillId, valueId, value, min, max, suffix) => {
    const normalized = ((value - min) / (max - min)) * 100;
    const percent = clamp(normalized, 0, 100);
    const fill = document.getElementById(fillId);
    const label = document.getElementById(valueId);
    if (!fill || !label) return;

    fill.style.height = percent + '%';
    fill.style.background = getMeterColor(percent, "#F52727", '#F5CF27', '#33FF00'); // cores low, middle, high
    label.innerText = `${value.toFixed(1)}${suffix}`;
};

const updateOnlyValue = (valueId, value, suffix) => {
    const label = document.getElementById(valueId);
    label.innerText = `${value.toFixed(1)}${suffix}`;
};


// ==========================================
// WEBSOCKET
// ==========================================
const ws = new WebSocket('ws://localhost:8765');

ws.onmessage = function (event) {
    // console.log("WS MSG", event.data); // Desativado para melhor performance
    const data = JSON.parse(event.data);
    if (data.type) {
        if (window.consumeLapMessage) window.consumeLapMessage(data);
        return;
    }
    // Feed recorder for comparison feature
    if (window.updateRecorderData) window.updateRecorderData(data);
    if (window.checkLapRecordTrigger) window.checkLapRecordTrigger(data);
    
    const t = (Date.now() - sharedStartTime) / 1000;
    
    checkSessionRestart(t);
    data.t = t;
    sharedTelemetryBuffer.push(data);
    updateSectorBadge(data);

    // 1. Atualiza Arrays dos Gráficos
    const speedData = rpmChart.data.datasets[0].data;
    const gasData = pedalsChart.data.datasets[0].data;
    const brakeData = pedalsChart.data.datasets[1].data;

    speedData.push({ x: t, y: data.rpm });
    gasData.push({ x: t, y: data.gas });
    brakeData.push({ x: t, y: data.brake });

    // 2. Limpeza de Memória: usa MAX_HISTORICO
    const tempoLimite = t - MAX_HISTORICO; 
    while (speedData.length > 0 && speedData[0].x < tempoLimite) {
        speedData.shift();
        gasData.shift();
        brakeData.shift();
    }
    // 5. Scroll e Update dos Gráficos
    if (autoScroll) {
        const minX = Math.max(0, t - JANELA_VISIVEL);

        rpmChart.options.scales.x.min = minX;
        rpmChart.options.scales.x.max = t;

        pedalsChart.options.scales.x.min = minX;
        pedalsChart.options.scales.x.max = t;
    }

        updateMeter('fuelFill', 'fuelValue', data.fuel ?? 0, 40, 130, ' L', '#0004FF', '#FF0000');
    updateMeter('ersFill', 'ersValue', ((data.ersPower ?? 0) * 100), 0, 100, ' %', '#FF0000', '#0004FF');

    if (typeof syncChartAnnotations !== 'undefined') {
        rpmChart.annotVersion = syncChartAnnotations(rpmChart, rpmChart.annotVersion);
        pedalsChart.annotVersion = syncChartAnnotations(pedalsChart, pedalsChart.annotVersion);
    }

    rpmChart.update('none');
    pedalsChart.update('none');
};

ws.onopen = () => {
    console.log("Conectado à telemetria!");
    const el = document.getElementById('t-ws-status');
    if (el) { el.textContent = '● CONECTADO'; el.className = 'ws-status ws-ok'; }
};

ws.onclose = () => {
    const el = document.getElementById('t-ws-status');
    if (el) { el.textContent = '● DESCONECTADO'; el.className = 'ws-status ws-off'; }
};

ws.onerror = (e) => console.error("Erro no WebSocket:", e);

repopulateChartsFromBuffer();

