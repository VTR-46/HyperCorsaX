// ==========================================
// COMPARE SCRIPT - Comparação de 2 Runs
// ==========================================

let runA = null;
let runB = null;
let charts = {};

// Cores para as runs
const COLORS = {
    runA: '#4ECDC4',
    runB: '#FF6B6B',
    delta: '#F9CA24',
    grid: '#333',
    text: '#888'
};

// Elementos DOM
const fileAInput = document.getElementById('fileA');
const fileBInput = document.getElementById('fileB');
const fileAInfo = document.getElementById('fileAInfo');
const fileBInfo = document.getElementById('fileBInfo');
const btnCompare = document.getElementById('btnCompare');
const metadataPanel = document.getElementById('metadataPanel');

// Manipula seleção de arquivo
async function handleFileSelect(runLabel, input) {
    console.log('[Compare] === handleFileSelect called ===', { runLabel, inputId: input.id });
    console.log('[Compare] window.Recorder exists?', typeof window.Recorder);
    console.log('[Compare] window.Recorder.parseFile?', typeof window.Recorder?.parseFile);
    console.log('[Compare] input.files length:', input.files.length);
    const file = input.files[0];
    console.log('[Compare] Selected file:', file ? { name: file.name, size: file.size, type: file.type } : 'null');
    if (!file) { console.log('[Compare] No file selected, returning'); return; }

    try {
        const data = await window.Recorder.parseFile(file);
        
        if (runLabel === 'A') {
            runA = data;
            fileAInfo.innerHTML = `✅ ${file.name} (${data.samples.length} samples, ${data.metadata.duration}s)`;
            fileAInfo.className = 'file-info success';
        } else {
            runB = data;
            fileBInfo.innerHTML = `✅ ${file.name} (${data.samples.length} samples, ${data.metadata.duration}s)`;
            fileBInfo.className = 'file-info success';
        }
        
        updateCompareButton();
    } catch (err) {
        alert(`Erro ao ler arquivo: ${err.message}`);
        if (runLabel === 'A') {
            fileAInfo.innerHTML = `❌ Erro: ${err.message}`;
            fileAInfo.className = 'file-info error';
            runA = null;
        } else {
            fileBInfo.innerHTML = `❌ Erro: ${err.message}`;
            fileBInfo.className = 'file-info error';
            runB = null;
        }
        updateCompareButton();
    }
}

function updateCompareButton() {
    btnCompare.disabled = !(runA && runB);
    btnCompare.style.opacity = (runA && runB) ? '1' : '0.5';
}

function clearComparison() {
    runA = null;
    runB = null;
    fileAInput.value = '';
    fileBInput.value = '';
    fileAInfo.innerHTML = 'Nenhum arquivo selecionado';
    fileAInfo.className = 'file-info';
    fileBInfo.innerHTML = 'Nenhum arquivo selecionado';
    fileBInfo.className = 'file-info';
    metadataPanel.style.display = 'none';
    updateCompareButton();
    destroyAllCharts();
}

// Gera a comparação completa
function generateComparison() {
    if (!runA || !runB) return;

    try {
        console.log('[Compare] Generating comparison...');
        console.log('[Compare] Run A samples:', runA.samples.length);
        console.log('[Compare] Run B samples:', runB.samples.length);

        destroyAllCharts();
        showMetadata();
        metadataPanel.style.display = 'block';

        const aligned = alignRunsByTime(runA, runB);
        console.log('[Compare] Aligned samples:', aligned.time.length);

        createSpeedChart(aligned);
        createRPMChart(aligned);
        createPedalsChart(aligned);
        createGearChart(aligned);
        createTyreTempChart(aligned);
        createTyrePressureChart(aligned);
        createBrakeTempChart(aligned);
        createDeltaSpeedChart(aligned);
        createFuelChart(aligned);
        createERSChart(aligned);
        createSteerChart(aligned);
        createTyreWearChart(aligned);

        console.log('[Compare] All charts created successfully');
    } catch (err) {
        console.error('[Compare] Error generating comparison:', err);
        alert("Erro ao gerar comparação: ");
    }
}
// Alinha duas runs pelo tempo (interpola runB no tempo de runA)
function alignRunsByTime(runA, runB) {
    const samplesA = runA.samples;
    const samplesB = runB.samples;
    
    const aligned = {
        time: [],
        speedA: [], speedB: [], deltaSpeed: [],
        rpmA: [], rpmB: [],
        gasA: [], gasB: [],
        brakeA: [], brakeB: [],
        gearA: [], gearB: [],
        tyreFL_A: [], tyreFL_B: [],
        tyreFR_A: [], tyreFR_B: [],
        tyreRL_A: [], tyreRL_B: [],
        tyreRR_A: [], tyreRR_B: [],
        tyrePressureFL_A: [], tyrePressureFL_B: [],
        tyrePressureFR_A: [], tyrePressureFR_B: [],
        tyrePressureRL_A: [], tyrePressureRL_B: [],
        tyrePressureRR_A: [], tyrePressureRR_B: [],
        brakeFL_A: [], brakeFL_B: [],
        brakeFR_A: [], brakeFR_B: [],
        brakeRL_A: [], brakeRL_B: [],
        brakeRR_A: [], brakeRR_B: [],
        fuelA: [], fuelB: [],
        ersA: [], ersB: [],
        steerA: [], steerB: [],
        tyreWFL_A: [], tyreWFL_B: [],
        tyreWFR_A: [], tyreWFR_B: [],
        tyreWRL_A: [], tyreWRL_B: [],
        tyreWRR_A: [], tyreWRR_B: []
    };
    
    samplesA.forEach(sampleA => {
        const t = sampleA.t;
        aligned.time.push(t);
        
        aligned.speedA.push(sampleA.speed);
        aligned.rpmA.push(sampleA.rpm);
        aligned.gasA.push(sampleA.gas);
        aligned.brakeA.push(sampleA.brake);
        aligned.gearA.push(sampleA.gear);
        aligned.tyreFL_A.push(sampleA.tyreFL);
        aligned.tyreFR_A.push(sampleA.tyreFR);
        aligned.tyreRL_A.push(sampleA.tyreRL);
        aligned.tyreRR_A.push(sampleA.tyreRR);
        aligned.tyrePressureFL_A.push(sampleA.tyrePressureFL);
        aligned.tyrePressureFR_A.push(sampleA.tyrePressureFR);
        aligned.tyrePressureRL_A.push(sampleA.tyrePressureRL);
        aligned.tyrePressureRR_A.push(sampleA.tyrePressureRR);
        aligned.brakeFL_A.push(sampleA.brakeFL);
        aligned.brakeFR_A.push(sampleA.brakeFR);
        aligned.brakeRL_A.push(sampleA.brakeRL);
        aligned.brakeRR_A.push(sampleA.brakeRR);
        aligned.fuelA.push(sampleA.fuel);
        aligned.ersA.push(sampleA.ersPower * 100);
        aligned.steerA.push(sampleA.steer);
        aligned.tyreWFL_A.push(sampleA.tyreWFL);
        aligned.tyreWFR_A.push(sampleA.tyreWFR);
        aligned.tyreWRL_A.push(sampleA.tyreWRL);
        aligned.tyreWRR_A.push(sampleA.tyreWRR);
        
        const sampleB = interpolateAtTime(samplesB, t);
        if (sampleB) {
            aligned.speedB.push(sampleB.speed);
            aligned.rpmB.push(sampleB.rpm);
            aligned.gasB.push(sampleB.gas);
            aligned.brakeB.push(sampleB.brake);
            aligned.gearB.push(sampleB.gear);
            aligned.tyreFL_B.push(sampleB.tyreFL);
            aligned.tyreFR_B.push(sampleB.tyreFR);
            aligned.tyreRL_B.push(sampleB.tyreRL);
            aligned.tyreRR_B.push(sampleB.tyreRR);
            aligned.tyrePressureFL_B.push(sampleB.tyrePressureFL);
            aligned.tyrePressureFR_B.push(sampleB.tyrePressureFR);
            aligned.tyrePressureRL_B.push(sampleB.tyrePressureRL);
            aligned.tyrePressureRR_B.push(sampleB.tyrePressureRR);
            aligned.brakeFL_B.push(sampleB.brakeFL);
            aligned.brakeFR_B.push(sampleB.brakeFR);
            aligned.brakeRL_B.push(sampleB.brakeRL);
            aligned.brakeRR_B.push(sampleB.brakeRR);
            aligned.fuelB.push(sampleB.fuel);
            aligned.ersB.push(sampleB.ersPower * 100);
            aligned.steerB.push(sampleB.steer);
            aligned.tyreWFL_B.push(sampleB.tyreWFL);
            aligned.tyreWFR_B.push(sampleB.tyreWFR);
            aligned.tyreWRL_B.push(sampleB.tyreWRL);
            aligned.tyreWRR_B.push(sampleB.tyreWRR);
            aligned.deltaSpeed.push(sampleB.speed - sampleA.speed);
        } else {
            aligned.speedB.push(null);
            aligned.rpmB.push(null);
            aligned.gasB.push(null);
            aligned.brakeB.push(null);
            aligned.gearB.push(null);
            aligned.tyreFL_B.push(null);
            aligned.tyreFR_B.push(null);
            aligned.tyreRL_B.push(null);
            aligned.tyreRR_B.push(null);
            aligned.tyrePressureFL_B.push(null);
            aligned.tyrePressureFR_B.push(null);
            aligned.tyrePressureRL_B.push(null);
            aligned.tyrePressureRR_B.push(null);
            aligned.brakeFL_B.push(null);
            aligned.brakeFR_B.push(null);
            aligned.brakeRL_B.push(null);
            aligned.brakeRR_B.push(null);
            aligned.fuelB.push(null);
            aligned.ersB.push(null);
            aligned.steerB.push(null);
            aligned.tyreWFL_B.push(null);
            aligned.tyreWFR_B.push(null);
            aligned.tyreWRL_B.push(null);
            aligned.tyreWRR_B.push(null);
            aligned.deltaSpeed.push(null);
        }
    });
    
    return aligned;
}

// Interpolação linear para encontrar valor no tempo t
function interpolateAtTime(samples, targetTime) {
    if (samples.length === 0) return null;
    if (samples.length === 1) return samples[0];
    
    let before = null;
    let after = null;
    
    for (let i = 0; i < samples.length - 1; i++) {
        if (samples[i].t <= targetTime && samples[i + 1].t >= targetTime) {
            before = samples[i];
            after = samples[i + 1];
            break;
        }
    }
    
    if (!before) {
        if (targetTime <= samples[0].t) return samples[0];
        return samples[samples.length - 1];
    }
    if (!after) return before;
    
    const t1 = before.t;
    const t2 = after.t;
    const ratio = (targetTime - t1) / (t2 - t1);
    
    const interpolated = { t: targetTime };
    const keys = Object.keys(before).filter(k => k !== 't' && typeof before[k] === 'number');
    
    keys.forEach(key => {
        interpolated[key] = before[key] + (after[key] - before[key]) * ratio;
    });
    
    Object.keys(before).forEach(key => {
        if (typeof before[key] !== 'number' && key !== 't') {
            interpolated[key] = before[key];
        }
    });
    
    return interpolated;
}

// Mostra metadados das runs
function showMetadata() {
    const metaA = document.getElementById('metaA');
    const metaB = document.getElementById('metaB');
    const metaDelta = document.getElementById('metaDelta');
    
    const formatDuration = (s) => {
        const m = Math.floor(s / 60);
        const sec = (s % 60).toFixed(1);
        return `${m}:${sec.padStart(4, '0')}`;
    };
    
    metaA.innerHTML = `
        <p>Início: ${new Date(runA.metadata.startTime).toLocaleTimeString()}</p>
        <p>Duração: ${formatDuration(runA.metadata.duration)}</p>
        <p>Samples: ${runA.metadata.samples}</p>
        <p>Voltas: ${getMaxLaps(runA)}</p>
        <p>Melhor volta: ${getBestLap(runA)}</p>
    `;
    
    metaB.innerHTML = `
        <p>Início: ${new Date(runB.metadata.startTime).toLocaleTimeString()}</p>
        <p>Duração: ${formatDuration(runB.metadata.duration)}</p>
        <p>Samples: ${runB.metadata.samples}</p>
        <p>Voltas: ${getMaxLaps(runB)}</p>
        <p>Melhor volta: ${getBestLap(runB)}</p>
    `;
    
    const durDiff = runB.metadata.duration - runA.metadata.duration;
    const lapsDiff = getMaxLaps(runB) - getMaxLaps(runA);
    metaDelta.innerHTML = `
        <p>Diferença duração: ${durDiff >= 0 ? '+' : ''}${durDiff.toFixed(1)}s</p>
        <p>Diferença voltas: ${lapsDiff >= 0 ? '+' : ''}${lapsDiff}</p>
        <p>Diferença samples: ${runB.metadata.samples - runA.metadata.samples}</p>
    `;
}

function getMaxLaps(run) {
    return Math.max(...run.samples.map(s => s.completedLaps || 0));
}

function getBestLap(run) {
    const laps = {};
    run.samples.forEach(s => {
        if (s.lastTime && s.lastTime !== '--:--.---' && s.completedLaps > 0) {
            if (!laps[s.completedLaps] || s.lastTime < laps[s.completedLaps]) {
                laps[s.completedLaps] = s.lastTime;
            }
        }
    });
    const times = Object.values(laps);
    return times.length > 0 ? times.sort()[0] : '--:--.---';
}

// Destroi todos os gráficos
function destroyAllCharts() {
    Object.values(charts).forEach(chart => {
        if (chart && chart.destroy) chart.destroy();
    });
    charts = {};
}

// ==========================================
// CRIAÇÃO DOS GRÁFICOS
// ==========================================

const commonChartOptions = {
    animation: false,
    parsing: false,
    // normalized: true,  // REMOVIDO no Chart.js v4 - causava erro silencioso impedindo renderização
    responsive: true,
    maintainAspectRatio: false,
    elements: { point: { radius: 0 } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: { labels: { color: '#ccc', font: { size: 11 } } },
        zoom: {
            pan: { enabled: true, mode: 'x' },
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
        }
    },
    scales: {
        x: {
            type: 'linear',
            title: { display: true, text: 'Tempo (s)', color: COLORS.text },
            ticks: { color: COLORS.text },
            grid: { color: COLORS.grid }
        },
        y: {
            grid: { color: COLORS.grid },
            ticks: { color: COLORS.text }
        }
    }
};

function createChart(canvasId, config) {
    console.log('[Compare] Creating chart:', canvasId);
    const ctx = document.getElementById(canvasId).getContext('2d');
    const chart = new Chart(ctx, config);
    charts[canvasId] = chart;
    return chart;
}

function createSpeedChart(data) {
    createChart('speedCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'Run A', data: data.time.map((t, i) => ({ x: t, y: data.speedA[i] })), borderColor: COLORS.runA, borderWidth: 2 },
                { label: 'Run B', data: data.time.map((t, i) => ({ x: t, y: data.speedB[i] })), borderColor: COLORS.runB, borderWidth: 2 }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, suggestedMin: 0, suggestedMax: 350 } } }
    });
}

function createRPMChart(data) {
    createChart('rpmCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'Run A', data: data.time.map((t, i) => ({ x: t, y: data.rpmA[i] })), borderColor: COLORS.runA, borderWidth: 2 },
                { label: 'Run B', data: data.time.map((t, i) => ({ x: t, y: data.rpmB[i] })), borderColor: COLORS.runB, borderWidth: 2 }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, suggestedMin: 0, suggestedMax: 10000 } } }
    });
}

function createPedalsChart(data) {
    createChart('pedalsCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'Acel. A', data: data.time.map((t, i) => ({ x: t, y: data.gasA[i] })), borderColor: '#00FF37', borderWidth: 2 },
                { label: 'Freio A', data: data.time.map((t, i) => ({ x: t, y: data.brakeA[i] })), borderColor: '#E74C3C', borderWidth: 2 },
                { label: 'Acel. B', data: data.time.map((t, i) => ({ x: t, y: data.gasB[i] })), borderColor: '#00FF37', borderWidth: 2, borderDash: [5, 5] },
                { label: 'Freio B', data: data.time.map((t, i) => ({ x: t, y: data.brakeB[i] })), borderColor: '#E74C3C', borderWidth: 2, borderDash: [5, 5] }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, min: -0.1, max: 1.1 } } }
    });
}

function createTyreTempChart(data) {
    createChart('tyreTempCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'FL A', data: data.time.map((t, i) => ({ x: t, y: data.tyreFL_A[i] })), borderColor: '#FF6B6B', borderWidth: 1.5 },
                { label: 'FR A', data: data.time.map((t, i) => ({ x: t, y: data.tyreFR_A[i] })), borderColor: '#4ECDC4', borderWidth: 1.5 },
                { label: 'RL A', data: data.time.map((t, i) => ({ x: t, y: data.tyreRL_A[i] })), borderColor: '#F9CA24', borderWidth: 1.5 },
                { label: 'RR A', data: data.time.map((t, i) => ({ x: t, y: data.tyreRR_A[i] })), borderColor: '#6C5CE7', borderWidth: 1.5 },
                { label: 'FL B', data: data.time.map((t, i) => ({ x: t, y: data.tyreFL_B[i] })), borderColor: '#FF6B6B', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'FR B', data: data.time.map((t, i) => ({ x: t, y: data.tyreFR_B[i] })), borderColor: '#4ECDC4', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'RL B', data: data.time.map((t, i) => ({ x: t, y: data.tyreRL_B[i] })), borderColor: '#F9CA24', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'RR B', data: data.time.map((t, i) => ({ x: t, y: data.tyreRR_B[i] })), borderColor: '#6C5CE7', borderWidth: 1.5, borderDash: [5, 5] }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, suggestedMin: 0, suggestedMax: 120 } } }
    });
}

function createTyrePressureChart(data) {
    createChart('tyrePressureCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'FL A', data: data.time.map((t, i) => ({ x: t, y: data.tyrePressureFL_A[i] })), borderColor: '#FF6B6B', borderWidth: 1.5 },
                { label: 'FR A', data: data.time.map((t, i) => ({ x: t, y: data.tyrePressureFR_A[i] })), borderColor: '#4ECDC4', borderWidth: 1.5 },
                { label: 'RL A', data: data.time.map((t, i) => ({ x: t, y: data.tyrePressureRL_A[i] })), borderColor: '#F9CA24', borderWidth: 1.5 },
                { label: 'RR A', data: data.time.map((t, i) => ({ x: t, y: data.tyrePressureRR_A[i] })), borderColor: '#6C5CE7', borderWidth: 1.5 },
                { label: 'FL B', data: data.time.map((t, i) => ({ x: t, y: data.tyrePressureFL_B[i] })), borderColor: '#FF6B6B', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'FR B', data: data.time.map((t, i) => ({ x: t, y: data.tyrePressureFR_B[i] })), borderColor: '#4ECDC4', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'RL B', data: data.time.map((t, i) => ({ x: t, y: data.tyrePressureRL_B[i] })), borderColor: '#F9CA24', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'RR B', data: data.time.map((t, i) => ({ x: t, y: data.tyrePressureRR_B[i] })), borderColor: '#6C5CE7', borderWidth: 1.5, borderDash: [5, 5] }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, suggestedMin: 0, suggestedMax: 50 } } }
    });
}

function createBrakeTempChart(data) {
    createChart('brakeTempCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'FL A', data: data.time.map((t, i) => ({ x: t, y: data.brakeFL_A[i] })), borderColor: '#FF6B6B', borderWidth: 1.5 },
                { label: 'FR A', data: data.time.map((t, i) => ({ x: t, y: data.brakeFR_A[i] })), borderColor: '#4ECDC4', borderWidth: 1.5 },
                { label: 'RL A', data: data.time.map((t, i) => ({ x: t, y: data.brakeRL_A[i] })), borderColor: '#F9CA24', borderWidth: 1.5 },
                { label: 'RR A', data: data.time.map((t, i) => ({ x: t, y: data.brakeRR_A[i] })), borderColor: '#6C5CE7', borderWidth: 1.5 },
                { label: 'FL B', data: data.time.map((t, i) => ({ x: t, y: data.brakeFL_B[i] })), borderColor: '#FF6B6B', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'FR B', data: data.time.map((t, i) => ({ x: t, y: data.brakeFR_B[i] })), borderColor: '#4ECDC4', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'RL B', data: data.time.map((t, i) => ({ x: t, y: data.brakeRL_B[i] })), borderColor: '#F9CA24', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'RR B', data: data.time.map((t, i) => ({ x: t, y: data.brakeRR_B[i] })), borderColor: '#6C5CE7', borderWidth: 1.5, borderDash: [5, 5] }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, suggestedMin: 0, suggestedMax: 1000 } } }
    });
}

function createDeltaSpeedChart(data) {
    createChart('deltaSpeedChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'Delta (B - A)', data: data.time.map((t, i) => ({ x: t, y: data.deltaSpeed[i] })), borderColor: COLORS.delta, borderWidth: 2, fill: true, backgroundColor: 'rgba(249, 202, 36, 0.1)' },
                { label: 'Zero', data: data.time.map((t, i) => ({ x: t, y: 0 })), borderColor: '#555', borderWidth: 1, borderDash: [3, 3], pointRadius: 0 }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, suggestedMin: -50, suggestedMax: 50 } } }
    });
}

function createFuelChart(data) {
    createChart('fuelCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'Run A', data: data.time.map((t, i) => ({ x: t, y: data.fuelA[i] })), borderColor: COLORS.runA, borderWidth: 2 },
                { label: 'Run B', data: data.time.map((t, i) => ({ x: t, y: data.fuelB[i] })), borderColor: COLORS.runB, borderWidth: 2, borderDash: [5, 5] }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, suggestedMin: 0, suggestedMax: 120 } } }
    });
}

function createERSChart(data) {
    createChart('ersCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'Run A', data: data.time.map((t, i) => ({ x: t, y: data.ersA[i] })), borderColor: COLORS.runA, borderWidth: 2 },
                { label: 'Run B', data: data.time.map((t, i) => ({ x: t, y: data.ersB[i] })), borderColor: COLORS.runB, borderWidth: 2, borderDash: [5, 5] }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, min: 0, max: 100 } } }
    });
}

function createSteerChart(data) {
    createChart('steerCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'Run A', data: data.time.map((t, i) => ({ x: t, y: data.steerA[i] })), borderColor: COLORS.runA, borderWidth: 2 },
                { label: 'Run B', data: data.time.map((t, i) => ({ x: t, y: data.steerB[i] })), borderColor: COLORS.runB, borderWidth: 2, borderDash: [5, 5] }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, suggestedMin: -540, suggestedMax: 540 } } }
    });
}

function createTyreWearChart(data) {
    createChart('tyreWearCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'FL A', data: data.time.map((t, i) => ({ x: t, y: data.tyreWFL_A[i] })), borderColor: '#FF6B6B', borderWidth: 1.5 },
                { label: 'FR A', data: data.time.map((t, i) => ({ x: t, y: data.tyreWFR_A[i] })), borderColor: '#4ECDC4', borderWidth: 1.5 },
                { label: 'RL A', data: data.time.map((t, i) => ({ x: t, y: data.tyreWRL_A[i] })), borderColor: '#F9CA24', borderWidth: 1.5 },
                { label: 'RR A', data: data.time.map((t, i) => ({ x: t, y: data.tyreWRR_A[i] })), borderColor: '#6C5CE7', borderWidth: 1.5 },
                { label: 'FL B', data: data.time.map((t, i) => ({ x: t, y: data.tyreWFL_B[i] })), borderColor: '#FF6B6B', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'FR B', data: data.time.map((t, i) => ({ x: t, y: data.tyreWFR_B[i] })), borderColor: '#4ECDC4', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'RL B', data: data.time.map((t, i) => ({ x: t, y: data.tyreWRL_B[i] })), borderColor: '#F9CA24', borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'RR B', data: data.time.map((t, i) => ({ x: t, y: data.tyreWRR_B[i] })), borderColor: '#6C5CE7', borderWidth: 1.5, borderDash: [5, 5] }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, min: 0, max: 100 } } }
    });
}

// Gear chart (re-added since it was replaced)
function createGearChart(data) {
    createChart('gearCompareChart', {
        type: 'line',
        data: {
            datasets: [
                { label: 'Run A', data: data.time.map((t, i) => ({ x: t, y: data.gearA[i] })), borderColor: COLORS.runA, borderWidth: 2, stepped: true },
                { label: 'Run B', data: data.time.map((t, i) => ({ x: t, y: data.gearB[i] })), borderColor: COLORS.runB, borderWidth: 2, stepped: true, borderDash: [5, 5] }
            ]
        },
        options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, min: 0, max: 8, stepSize: 1 } } }
    });
}