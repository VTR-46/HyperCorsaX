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
        datasets: [{ label: 'Velocidade (km/h)', data: [], borderColor: '#FF6B6B', borderWidth: 2 }]
    },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { suggestedMin: 0, suggestedMax: 300, ...commonOptions.scales.y } } }
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

const damageSlots = {
    frente: 'frente-dano',
    esquerda: 'esquerda-dano',
    direita: 'direita-dano',
    frenteBaixa: 'traseira-dano',
    geral: 'geral-dano',
};

const updateDamageZone = (zoneId, value) => {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    const valueNode = zoneId === 'geral-dano'
        ? zone.querySelector('.damage-value-general')
        : zone.querySelector('.damage-value');
    const percent = clamp(Number(value ?? 0), 0, 100);
    zone.style.color = getMeterColor(percent, '#33FF00', '#F5CF27', '#FF3B30');
    zone.style.borderColor = getMeterColor(percent, '#1F7A1F', '#B48A10', '#B3261E');

    if (valueNode) {
        valueNode.innerText = `${percent.toFixed(0)}%`;
    }
};

const updateDamageMap = (data) => {
    const damageValues = [
        data.carDamageF ?? data.damage0 ?? 0,
        data.carDamageT ?? data.damage1 ?? 0,
        data.carDamageE ?? data.damage2 ?? 0,
        data.carDamageD ?? data.damage3 ?? 0,
        data.carDamageG ?? data.damage4 ?? 0,
    ];

    Object.values(damageSlots).forEach((zoneId, index) => {
        updateDamageZone(zoneId, damageValues[index]);
    });
};

// conecta ao servidor Python via WebSocket
const ws = new WebSocket('ws://localhost:8765');


ws.onmessage = function (event) {
    console.log("WS MSG", event.data);
    const data = JSON.parse(event.data);


    // calcula o tempo atual em segundos desde o início da conexão
    const t = (Date.now() - startTime) / 1000;

    // adiciona os dados no formato que estou enviando {x, y}
    speedChart.data.datasets[0].data.push({ x: t, y: data.speed });

    pedalsChart.data.datasets[0].data.push({ x: t, y: data.gas });
    pedalsChart.data.datasets[1].data.push({ x: t, y: data.brake });

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

        fill.style.background = getMeterColor(percent, "#F52727", '#F5CF27', '#33FF00');     //cores low, middle, high

        label.innerText = `${value.toFixed(1)}${suffix}`;
    };

    const min_wear_limit = 83.0;    //ajustar (por enquanto F1 de pneus médios) atualmente 2% de direrença do CMRT
    const max_wear_limit = 100.0;

    const grip_w1 = data.tyreWFL;
    const grip_w2 = data.tyreWFR;
    const grip_w3 = data.tyreWRL;
    const grip_w4 = data.tyreWRR;

    const delta_escala = max_wear_limit - min_wear_limit;

    let hud_w1, hud_w2, hud_w3, hud_w4;

    if (delta_escala <= 0) {
        hud_w1 = hud_w2 = hud_w3 = hud_w4 = 100;
    } else {

        const gamma = 1.5; // ajustar (por enquanto F1 de pneus médios) atualmente 2% de direrença do CMRT

        function convertWear(rawWear) {

            let t = (rawWear - min_wear_limit) / (100 - min_wear_limit);

            t = Math.max(0, Math.min(1, t));

            return Math.pow(t, gamma) * 100;
        }



        hud_w1 = convertWear(grip_w1);
        hud_w2 = convertWear(grip_w2);
        hud_w3 = convertWear(grip_w3);
        hud_w4 = convertWear(grip_w4);
    }

    updateMeter('brakeFLFill', 'brakeFLValue', data.brakeFL ?? 0, 0, 1200, '°C', '#0004FF', '#FF0000');
    updateMeter('brakeFRFill', 'brakeFRValue', data.brakeFR ?? 0, 0, 1200, '°C', '#0004FF', '#FF0000');
    updateMeter('brakeRLFIll', 'brakeRLValue', data.brakeRL ?? 0, 0, 1200, '°C', '#0004FF', '#FF0000');
    updateMeter('brakeRRFIll', 'brakeRRValue', data.brakeRR ?? 0, 0, 1200, '°C', '#0004FF', '#FF0000');
    updateMeterTyreWear('tyreFLFill', 'tyreFLValue', hud_w1 ?? 0, 0, 100, '° %');
    updateMeterTyreWear('tyreFRFill', 'tyreFRValue', hud_w2 ?? 0, 0, 100, ' %');
    updateMeterTyreWear('tyreRLFIll', 'tyreRLValue', hud_w3 ?? 0, 0, 100, ' %');
    updateMeterTyreWear('tyreRRFIll', 'tyreRRValue', hud_w4 ?? 0, 0, 100, ' %');
    updateMeter('fuelFill', 'fuelValue', data.fuel ?? 0, 40, 130, ' L', '#0004FF', '#FF0000');
    updateMeter('ersFill', 'ersValue', ((data.ersPower ?? 0) * 100), 0, 100, ' %', '#0004FF', '#FF0000');
    updateDamageMap(data);

    // se o auto-Scroll estiver ligado, move a câmera (escala X) junto com os dados
    if (autoScroll) {
        const minX = Math.max(0, t - janelaTempo); // Mostra só os últimos 15 segundos

        speedChart.options.scales.x.min = minX;
        speedChart.options.scales.x.max = t;

        pedalsChart.options.scales.x.min = minX;
        pedalsChart.options.scales.x.max = t;
    }

    // Atualiza os gráficos de forma mais leve (o 'none' var evitar recálculos desnecessários de layout)
    speedChart.update('none');
    pedalsChart.update('none');



};



ws.onopen = () => console.log("Conectado à telemetria!");
ws.onerror = (e) => console.error("Erro no WebSocket:", e);