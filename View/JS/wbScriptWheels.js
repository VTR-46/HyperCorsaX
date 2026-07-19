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

// Gráfico de Desgaste
const ctxWear = document.getElementById('wearChart').getContext('2d');
const wearChart = new Chart(ctxWear, {
    type: 'line',
    data: {
        datasets: [
            { label: 'FL', data: [], borderColor: '#FF0000', borderWidth: 2 },
            { label: 'FR', data: [], borderColor: '#EBFF00', borderWidth: 2 },
            { label: 'RL', data: [], borderColor: '#2FFF00', borderWidth: 2 },
            { label: 'RR', data: [], borderColor: '#0090FF', borderWidth: 2 }
        ]
    },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { suggestedMin: 0, suggestedMax: 101, ...commonOptions.scales.y } } }
});

// Grafico de temperatura dos pneus
const ctxTyreTemp = document.getElementById('tempChart').getContext('2d');
const tempChart = new Chart(ctxTyreTemp, {
    type: 'line',
    data: {
        datasets: [
            { label: 'FL', data: [], borderColor: '#FF0000', borderWidth: 2 },
            { label: 'FR', data: [], borderColor: '#EBFF00', borderWidth: 2 },
            { label: 'RL', data: [], borderColor: '#2FFF00', borderWidth: 2 },
            { label: 'RR', data: [], borderColor: '#0090FF', borderWidth: 2 }
        ]
    },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { min: -0.1, max: 150, ...commonOptions.scales.y } } }
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

// ==========================================
// CALIBRAÇÃO DINÂMICA DE PNEUS (Escopo Global)
// ==========================================
// Armazena o maior valor de "saúde" do pneu lido até agora na sessão.
const storedPeak = sessionStorage.getItem('ac_peak_wear');
const peakWear = storedPeak ? JSON.parse(storedPeak) : { FL: 0, FR: 0, RL: 0, RR: 0 };

// O delta de queda física. 
const WEAR_DROP_CLIFF = 22.5;
const GAMMA_WEAR = 5.0;

function getNormalizedWear(currentWear, tireKey) {
    if (currentWear > peakWear[tireKey]) {
        peakWear[tireKey] = currentWear;
        // 3. Salva imediatamente no cofre do navegador para sobreviver ao F5
        sessionStorage.setItem('ac_peak_wear', JSON.stringify(peakWear));
    }

    const currentPeak = peakWear[tireKey];

    if (currentPeak === 0) return 100.0;

    const cliff = currentPeak - WEAR_DROP_CLIFF;
    let t = (currentWear - cliff) / (currentPeak - cliff);
    t = Math.max(0, Math.min(1, t));

    return Math.pow(t, GAMMA_WEAR) * 100;
}

// ==========================================
// WEBSOCKET
// ==========================================
const ws = new WebSocket('ws://localhost:8765');

ws.onmessage = function (event) {
    // console.log("WS MSG", event.data); // Desativado para melhor performance
    const data = JSON.parse(event.data);
    const t = (Date.now() - startTime) / 1000;



    // 3. Leituras de Pneu e Normalização
    const grip_w1 = data.tyreWFL ?? 0;
    const grip_w2 = data.tyreWFR ?? 0;
    const grip_w3 = data.tyreWRL ?? 0;
    const grip_w4 = data.tyreWRR ?? 0;

    const hud_w1 = getNormalizedWear(grip_w1, 'FL');
    const hud_w2 = getNormalizedWear(grip_w2, 'FR');
    const hud_w3 = getNormalizedWear(grip_w3, 'RL');
    const hud_w4 = getNormalizedWear(grip_w4, 'RR');

    // 4. Atualização de Interface
    updateMeter('brakeFLFill', 'brakeFLValue', data.brakeFL ?? 0, 0, 1200, '°C', '#0004FF', '#FF0000');
    updateMeter('brakeFRFill', 'brakeFRValue', data.brakeFR ?? 0, 0, 1200, '°C', '#0004FF', '#FF0000');
    updateMeter('brakeRLFIll', 'brakeRLValue', data.brakeRL ?? 0, 0, 1200, '°C', '#0004FF', '#FF0000');
    updateMeter('brakeRRFIll', 'brakeRRValue', data.brakeRR ?? 0, 0, 1200, '°C', '#0004FF', '#FF0000');

    updateMeterTyreWear('tyreFLFill', 'tyreFLValue', hud_w1, 0, 100, '%');
    updateMeterTyreWear('tyreFRFill', 'tyreFRValue', hud_w2, 0, 100, '%');
    updateMeterTyreWear('tyreRLFIll', 'tyreRLValue', hud_w3, 0, 100, '%');
    updateMeterTyreWear('tyreRRFIll', 'tyreRRValue', hud_w4, 0, 100, '%');

    updateMeter('fuelFill', 'fuelValue', data.fuel ?? 0, 40, 130, ' L', '#0004FF', '#FF0000');
    updateMeter('ersFill', 'ersValue', ((data.ersPower ?? 0) * 100), 0, 100, ' %', '#0004FF', '#FF0000');

    updateOnlyValue('tyrePsiValueFL', data.tyrePressureFL ?? 0, ' psi');
    updateOnlyValue('tyrePsiValueFR', data.tyrePressureFR ?? 0, ' psi');
    updateOnlyValue('tyrePsiValueRL', data.tyrePressureRL ?? 0, ' psi');
    updateOnlyValue('tyrePsiValueRR', data.tyrePressureRR ?? 0, ' psi');

    updateOnlyValue('tyreTempValueFL', data.tyreFL ?? 0, ' °C');
    updateOnlyValue('tyreTempValueFR', data.tyreFR ?? 0, ' °C');
    updateOnlyValue('tyreTempValueRL', data.tyreRL ?? 0, ' °C');
    updateOnlyValue('tyreTempValueRR', data.tyreRR ?? 0, ' °C');

    updateDamageMap(data);

    // 1. Atualiza Arrays dos Gráficos
    const FLWearData = wearChart.data.datasets[0].data;
    const FRWearData = wearChart.data.datasets[1].data;
    const RLWearData = wearChart.data.datasets[2].data;
    const RRWearData = wearChart.data.datasets[3].data;

    const FLData = tempChart.data.datasets[0].data;
    const FRData = tempChart.data.datasets[1].data;
    const RLData = tempChart.data.datasets[2].data;
    const RRData = tempChart.data.datasets[3].data;

    FLWearData.push({ x: t, y: getNormalizedWear(grip_w1, 'FL') });
    FRWearData.push({ x: t, y: getNormalizedWear(grip_w2, 'FR') });
    RLWearData.push({ x: t, y: getNormalizedWear(grip_w3, 'RL') });
    RRWearData.push({ x: t, y: getNormalizedWear(grip_w4, 'RR') });

    FRData.push({ x: t, y: data.tyreFL });
    FLData.push({ x: t, y: data.tyreFR });
    RLData.push({ x: t, y: data.tyreRL });
    RRData.push({ x: t, y: data.tyreRR });

    // 2. Limpeza de Memória (Mantém apenas os últimos ~20 segundos no array para não crashar o navegador)
    const tempoLimite = t - (janelaTempo + 5);
    while (FLWearData.length > 0 && FLWearData[0].x < tempoLimite) {
        FLWearData.shift();
        FRData.shift();
        FLData.shift();
        RLData.shift();
        RRData.shift();

    }

    // 5. Scroll e Update dos Gráficos
    if (autoScroll) {
        const minX = Math.max(0, t - janelaTempo); // Mostra só os últimos 15 segundos

        wearChart.options.scales.x.min = minX;
        wearChart.options.scales.x.max = t;

        tempChart.options.scales.x.min = minX;
        tempChart.options.scales.x.max = t;
    }

    wearChart.update('none');
    tempChart.update('none');
};

ws.onopen = () => console.log("Conectado à telemetria!");
ws.onerror = (e) => console.error("Erro no WebSocket:", e);