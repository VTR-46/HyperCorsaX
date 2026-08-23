let autoScroll = true;
let liveMode = true;
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
    liveMode = true;
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
// Armazena o maior valor de "saúdo" do pneu lido até agora na sessão.
// Em "file://" alguns navegadores (Chrome/Edge recentes) tratam origens como
// "unique security origins" e lançam SecurityError no sessionStorage. Cair num
// try/catch garante que isso nunca derrube o restante do script (painel de voltas etc.).
const peakWear = { FL: 0, FR: 0, RL: 0, RR: 0 };
function loadPeakWearFromStorage() {
    try {
        const storedPeak = sessionStorage.getItem('ac_peak_wear');
        if (storedPeak) {
            const parsed = JSON.parse(storedPeak);
            if (parsed && typeof parsed === 'object') {
                peakWear.FL = Number(parsed.FL) || 0;
                peakWear.FR = Number(parsed.FR) || 0;
                peakWear.RL = Number(parsed.RL) || 0;
                peakWear.RR = Number(parsed.RR) || 0;
            }
        }
    } catch (e) {
        // sessionStorage indisponível (ex.: file://) ou JSON inválido — ignora
    }
}
function savePeakWearToStorage() {
    try {
        sessionStorage.setItem('ac_peak_wear', JSON.stringify(peakWear));
    } catch (e) {
        // idem: ignora silenciosamente
    }
}
loadPeakWearFromStorage();

// O delta de queda física. 
const WEAR_DROP_CLIFF = 22.5;
const GAMMA_WEAR = 5.0;

function getNormalizedWear(currentWear, tireKey) {
    if (currentWear > peakWear[tireKey]) {
        peakWear[tireKey] = currentWear;
        // 3. Salva imediatamente no cofre do navegador para sobreviver ao F5
        savePeakWearToStorage();
    }

    const currentPeak = peakWear[tireKey];

    if (currentPeak === 0) return 100.0;

    const cliff = currentPeak - WEAR_DROP_CLIFF;
    let t = (currentWear - cliff) / (currentPeak - cliff);
    t = Math.max(0, Math.min(1, t));

    return Math.pow(t, GAMMA_WEAR) * 100;
}

// ==========================================
// PAINEL DE TEMPOS DE VOLTA
// ==========================================
const SESSION_NAMES = {
    0: 'PRÁTICA',
    1: 'TREINO',
    2: 'CORRIDA',
    3: 'HOTLAP',
    4: 'TIME ATTACK',
    5: 'DRIFT',
    6: 'DRAG',
    7: 'HOT STINT',
    8: 'SUPER POLE'
};

// Guarda a última melhor volta para detectar quando uma nova melhor é estabelecida.
let lastKnownBest = '--:--.---';
let bestFlashTimer = null;

// Converte o tempo "m:ss.mmm" do AC para milissegundos, para comparação.
// Retorna -1 se não for um tempo válido.
const lapTimeToMs = (t) => {
    if (!t || t === '--:--.---' || t === '') return -1;
    const parts = String(t).split(':');
    if (parts.length !== 2) return -1;
    const min = parseInt(parts[0], 10);
    const sec = parseFloat(parts[1]);
    if (isNaN(min) || isNaN(sec)) return -1;
    return min * 60000 + sec * 1000;
};

const setTextSafe = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
};

function updateLapPanel(data) {
    const cur  = data.currentTime    ?? '--:--.---';
    const last = data.lastTime        ?? '--:--.---';
    const best = data.bestTime         ?? '--:--.---';
    const spl  = data.split            ?? '--:--.---';
    const laps = data.completedLaps   ?? 0;
    const numLaps = data.numberOfLaps ?? 0;
    const pos = data.position         ?? 0;
    const sector = data.currentSector ?? 0;
    const session = data.session      ?? 0;

    setTextSafe('lap-current', cur);
    setTextSafe('lap-last', last);
    setTextSafe('lap-split', spl);

    // Volta atual / total (se numberOfLaps for 0 mostra "livre")
    const lapsStr = (numLaps > 0) ? `${laps} / ${numLaps}` : `${laps} / Livre`;
    setTextSafe('lap-count', lapsStr);

    // Posição: AC usa 1..N; 0 significa sem grid.
    setTextSafe('lap-pos', (pos > 0) ? `P${pos}` : 'P--');

    // Nome da sessão
    setTextSafe('lap-session', SESSION_NAMES[session] ?? '--');

    // Setor (1-indexado para o usuário; AC reporta 0..N-1)
    setTextSafe('lap-sector', String(sector + 1));

    // Melhor volta + destaque quando é uma nova melhor
    const bestEl = document.getElementById('lap-best');
    if (bestEl) {
        const bestMs = lapTimeToMs(best);
        const lastKnownMs = lapTimeToMs(lastKnownBest);

        if (bestMs >= 0 && (lastKnownMs < 0 || bestMs < lastKnownMs)) {
            // Nova melhor volta detectada — pisca em verde
            lastKnownBest = best;
            bestEl.textContent = best;
            bestEl.classList.add('lap-best-flash');
            if (bestFlashTimer) clearTimeout(bestFlashTimer);
            bestFlashTimer = setTimeout(() => {
                bestEl.classList.remove('lap-best-flash');
            }, 1500);
        } else {
            bestEl.textContent = best;
        }
    }
}

// ==========================================
// WEBSOCKET
// ==========================================
const ws = new WebSocket('ws://localhost:8765');

const recordingStatus = document.getElementById('recordingStatus');
const startRecordingButton = document.getElementById('btnStartRecording');
const stopRecordingButton = document.getElementById('btnStopRecording');

function updateRecordingControls(isRecording, message) {
    if (recordingStatus) recordingStatus.textContent = message || (isRecording ? 'Gravando a cada segundo' : 'Gravação desligada');
    if (startRecordingButton) startRecordingButton.disabled = isRecording;
    if (stopRecordingButton) stopRecordingButton.disabled = !isRecording;
}

async function setRecording(path) {
    const response = await fetch(path);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    updateRecordingControls(Boolean(result.recording), result.recording ? 'Gravando a cada segundo' : 'Gravação desligada');
}

startRecordingButton?.addEventListener('click', async () => {
    updateRecordingControls(false, 'Iniciando gravação...');
    try { await setRecording('/api/recording/start'); }
    catch (error) { updateRecordingControls(false, `Erro: ${error.message}`); }
});

stopRecordingButton?.addEventListener('click', async () => {
    try { await setRecording('/api/recording/stop'); }
    catch (error) { updateRecordingControls(true, `Erro: ${error.message}`); }
});

fetch('/api/health').then((response) => response.json()).then((result) => {
    updateRecordingControls(Boolean(result.recording));
}).catch(() => updateRecordingControls(false));

ws.onmessage = function (event) {
    if (!liveMode) return;
    // console.log("WS MSG", event.data); // Desativado para melhor performance
    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
        console.error('JSON inválido do WebSocket:', e);
        return;
    }
    const t = data.elapsed_ms != null ? data.elapsed_ms / 1000 : (Date.now() - startTime) / 1000;

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

     updateOnlyValue('tyrePsiValueFL', data.tyreFL ?? 0, ' °C');
     updateOnlyValue('tyreTempValueFR', data.tyreFR ?? 0, ' °C');
     updateOnlyValue('tyreTempValueRL', data.tyreRL ?? 0, ' °C');
     updateOnlyValue('tyreTempValueRR', data.tyreRR ?? 0, ' °C');

    updateDamageMap(data);

    // 6. Painel de Tempos de Volta (isolate: numca pode travar o resto da telemetria)
    try {
        updateLapPanel(data);
    } catch (err) {
        console.error('updateLapPanel falhou:', err);
    }

    // 7. Scroll e Update dos Gráficos
    if (autoScroll) {
        const minX = Math.max(0, t - janelaTempo); // Mostra só os últimos 15 segundos

        speedChart.options.scales.x.min = minX;
        speedChart.options.scales.x.max = t;

        pedalsChart.options.scales.x.min = minX;
        pedalsChart.options.scales.x.max = t;
    }

    speedChart.update('none');
    pedalsChart.update('none');
};

ws.onopen = () => console.log("Conectado à telemetria!");
ws.onerror = (e) => console.error("Erro no WebSocket:", e);

async function loadSessionOptions() {
    try {
        const response = await fetch('/api/sessions');
        if (!response.ok) return;
        const sessions = await response.json();
        const selects = [document.getElementById('historySessionA'), document.getElementById('historySessionB')];
        sessions.forEach((session) => selects.forEach((select) => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = `${session.started_at} ${session.track || 'sessao'}`;
            select.appendChild(option);
        }));
    } catch (error) {
        console.warn('Historico indisponivel:', error);
    }
}

async function compareSessions() {
    const firstId = document.getElementById('historySessionA').value;
    const secondId = document.getElementById('historySessionB').value;
    if (!firstId || !secondId) return;
    const response = await fetch(`/api/compare?left=${encodeURIComponent(firstId)}&right=${encodeURIComponent(secondId)}`);
    if (!response.ok) {
        console.warn('Comparacao indisponivel:', await response.text());
        return;
    }
    const comparison = await response.json();
    if (!Array.isArray(comparison.left) || !Array.isArray(comparison.right)) return;
    const first = comparison.left;
    const second = comparison.right;
    const toPoints = (rows, signal) => rows.map((row) => ({ x: row.elapsed_ms / 1000, y: row[signal] }));
    liveMode = false;
    autoScroll = false;
    speedChart.data.datasets = [
        { label: 'Sessao A - velocidade', data: toPoints(first, 'speed'), borderColor: '#FF6B6B', borderWidth: 2 },
        { label: 'Sessao B - velocidade', data: toPoints(second, 'speed'), borderColor: '#4DABF7', borderWidth: 2 },
    ];
    pedalsChart.data.datasets = [
        { label: 'Sessao A - acelerador', data: toPoints(first, 'gas'), borderColor: '#00FF37', borderWidth: 2 },
        { label: 'Sessao A - freio', data: toPoints(first, 'brake'), borderColor: '#E74C3C', borderWidth: 2 },
        { label: 'Sessao B - acelerador', data: toPoints(second, 'gas'), borderColor: '#B6F36B', borderWidth: 2 },
        { label: 'Sessao B - freio', data: toPoints(second, 'brake'), borderColor: '#FF9F43', borderWidth: 2 },
    ];
    speedChart.options.scales.x.min = undefined;
    speedChart.options.scales.x.max = undefined;
    pedalsChart.options.scales.x.min = undefined;
    pedalsChart.options.scales.x.max = undefined;
    speedChart.update();
    pedalsChart.update();
}

document.getElementById('btnCompareSessions')?.addEventListener('click', compareSessions);
loadSessionOptions();