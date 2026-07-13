let autoScroll = true;
const janelaTempo = 15; // Quantos segundos mostrar na tela por padrão
const startTime = Date.now();

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
    normalized: true,
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
const ctxSpeed = document.getElementById('speedChart').getContext('2d');
const speedChart = new Chart(ctxSpeed, {
    type: 'line',
    data: {
        datasets: [{ label: 'KM/H', data: [], borderColor: '#FF6B6B', borderWidth: 2 }]
    },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { suggestedMin: 0, suggestedMax: 400, ...commonOptions.scales.y } } }
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


const updateOnlyValue = (valueId, value, suffix) => {
    const label = document.getElementById(valueId);
    label.innerText = `${value.toFixed(1)}${suffix}`;
};

const updateOnlyValueTcAbs = (valueId, value, id) => {
    const label = document.getElementById(valueId);
    const block = document.getElementById(id);

    let tv;
    if (value == 5) {
        block.style.backgroundColor = '#5CF700';
        tv = 11;
    }else if(value == 6){
        block.style.backgroundColor = '#51DB00';
        tv = 10;
    }else if(value > 7 && value< 8){
        block.style.backgroundColor = '#46BF00';
        tv = 9;
    }else if(value == 8){
        block.style.backgroundColor = '#3FAD00';
        tv = 8;
    }else if(value == 9){
        block.style.backgroundColor = '#389C00';
        tv = 7;
    }else if(value == 10){
        block.style.backgroundColor = '#328C00';
        tv = 6;
    }else if(value == 11){
        block.style.backgroundColor = '#2D8000';
        tv = 5;
    }else if(value == 12){
        block.style.backgroundColor = '#246900';
        tv = 4;
    }else if(value == 13){
        block.style.backgroundColor = '#1C5200';
        tv = 3;
    }else if(value > 14 && value < 15){
        block.style.backgroundColor = '#154000';
        tv = 2;
    }else if(value == 15){
        block.style.backgroundColor = '#0D2E00';
        tv = 1;
    }else if(value == 0){
        block.style.backgroundColor = '#071A00';
        tv = 0;
    }

    label.innerText = tv;
};

const updateSteeringWheel = (steerValue) => {
    const wheel = document.getElementById('steeringWheel');
    if (!wheel) return;

    const maxRotation = 180;
    const rotation = clamp(steerValue ?? 0, -1, 1) * maxRotation;
    wheel.style.transform = `rotate(${rotation}deg)`;
};

const updateColorBlock = (value, id) => {
    const block = document.getElementById(id);

    if(value > 0){
        block.style.backgroundColor = '#0F8200';
    }

};


// ==========================================
// WEBSOCKET
// ==========================================
const ws = new WebSocket('ws://localhost:8765');

ws.onmessage = function (event) {
    // console.log("WS MSG", event.data); // Desativado para melhor performance
    const data = JSON.parse(event.data);
    const t = (Date.now() - startTime) / 1000;

    // 1. Atualiza Arrays dos Gráficos
    const speedData = speedChart.data.datasets[0].data;
    const gasData = pedalsChart.data.datasets[0].data;
    const brakeData = pedalsChart.data.datasets[1].data;

    speedData.push({ x: t, y: data.speed });
    gasData.push({ x: t, y: data.gas });
    brakeData.push({ x: t, y: data.brake });

    // 2. Limpeza de Memória (Mantém apenas os últimos ~20 segundos no array para não crashar o navegador)
    const tempoLimite = t - (janelaTempo + 5); 
    while (speedData.length > 0 && speedData[0].x < tempoLimite) {
        speedData.shift();
        gasData.shift();
        brakeData.shift();
    }
    // 5. Scroll e Update dos Gráficos
    if (autoScroll) {
        const minX = Math.max(0, t - janelaTempo); // Mostra só os últimos 15 segundos

        speedChart.options.scales.x.min = minX;
        speedChart.options.scales.x.max = t;

        pedalsChart.options.scales.x.min = minX;
        pedalsChart.options.scales.x.max = t;
    }

    updateMeter('fuelFill', 'fuelValue', data.fuel ?? 0, 0, 130, ' L', '#0004FF', '#FF0000');
    updateMeter('ersFill', 'ersValue', ((data.ersPower ?? 0) * 100), 0, 100, ' %', '#0004FF', '#FF0000');
    updateSteeringWheel(data.steer);
    updateOnlyValue('abs-label', data.abs, ' ');
    updateOnlyValueTcAbs('tc-label', data.tc * 100, 'tc');
    updateOnlyValueTcAbs('abs-label', data.abs * 100, 'abs');
    //updateColorBlock(data.tc, 'tc');

    speedChart.update('none');
    pedalsChart.update('none');
};

ws.onopen = () => console.log("Conectado à telemetria!");
ws.onerror = (e) => console.error("Erro no WebSocket:", e);