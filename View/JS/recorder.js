// ==========================================
// RECORDER - Gravação de Telemetria (1 Hz)
// ==========================================

let isRecording = false;
let recordStartTime = 0;
let recordBuffer = [];
let lastRecordTime = 0;
let recordInterval = null;
let currentSessionData = null;

// Referência ao botão de gravação
const recordBtn = document.getElementById('btnRecord');

// Função chamada pelo WebSocket quando novos dados chegam
window.updateRecorderData = (data) => {
    currentSessionData = data;
};

// Inicia/para gravação
window.toggleRecording = () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
};

function startRecording() {
    isRecording = true;
    recordStartTime = Date.now();
    recordBuffer = [];
    lastRecordTime = 0;
    
    // Atualiza UI
    recordBtn.innerHTML = '⏹️ PARAR';
    recordBtn.classList.add('recording');
    recordBtn.title = 'Clique para parar a gravação';
    
    // Loop de gravação a cada 100ms (verifica se passou 1s)
    recordInterval = setInterval(() => {
        if (!currentSessionData) return;
        
        const now = Date.now();
        const elapsed = (now - recordStartTime) / 1000;
        
        // Salva apenas 1 sample por segundo (1 Hz)
        if (elapsed - lastRecordTime >= 1.0) {
            const sample = createSample(currentSessionData, elapsed);
            recordBuffer.push(sample);
            lastRecordTime = Math.floor(elapsed);
            
            // Feedback visual no botão (contador)
            recordBtn.innerHTML = `⏹️ ${recordBuffer.length}s`;
        }
    }, 100);
    
    console.log('[Recorder] Gravação iniciada');
}
function stopRecording() {
    isRecording = false;
    clearInterval(recordInterval);
    recordInterval = null;
    
    // Atualiza UI
    recordBtn.innerHTML = '🔴 GRAVAR';
    recordBtn.classList.remove('recording');
    recordBtn.title = 'Clique para iniciar gravação';
    
    // Gera e baixa o JSON
    downloadJSON();
    
    console.log('[Recorder] Gravação finalizada:', recordBuffer.length, 'samples');
}

function createSample(data, t) {
    return {
        t: Math.round(t * 1000) / 1000,
        // Powertrain
        speed: data.speed ?? 0,
        rpm: data.rpm ?? 0,
        gear: data.gear ?? 0,
        gas: data.gas ?? 0,
        brake: data.brake ?? 0,
        clutch: data.clutch ?? 0,
        fuel: data.fuel ?? 0,
        steer: data.steer ?? 0,
        drs: data.drs ?? 0,
        // Temperaturas dos Pneus
        tyreFL: data.tyreFL ?? 0,
        tyreFR: data.tyreFR ?? 0,
        tyreRL: data.tyreRL ?? 0,
        tyreRR: data.tyreRR ?? 0,
        // Temperaturas dos Freios
        brakeFL: data.brakeFL ?? 0,
        brakeFR: data.brakeFR ?? 0,
        brakeRL: data.brakeRL ?? 0,
        brakeRR: data.brakeRR ?? 0,
        // ERS
        ersPower: data.ersPower ?? 0,
        // Desgaste dos Pneus
        tyreWFL: data.tyreWFL ?? 0,
        tyreWFR: data.tyreWFR ?? 0,
        tyreWRL: data.tyreWRL ?? 0,
        tyreWRR: data.tyreWRR ?? 0,
        // Pressão dos Pneus
        tyrePressureFL: data.tyrePressureFL ?? 0,
        tyrePressureFR: data.tyrePressureFR ?? 0,
        tyrePressureRL: data.tyrePressureRL ?? 0,
        tyrePressureRR: data.tyrePressureRR ?? 0,
        // Assistências
        abs: data.abs ?? 0,
        tc: data.tc ?? 0,
        // Danos
        carDamageF: data.carDamageF ?? 0,
        carDamageR: data.carDamageR ?? 0,
        carDamageL: data.carDamageL ?? 0,
        carDamageD: data.carDamageD ?? 0,
        carDamageT: data.carDamageT ?? 0,
        carDamageE: data.carDamageE ?? 0,
        carDamageG: data.carDamageG ?? 0,
        // Tempos de Volta
        currentTime: data.currentTime ?? '--:--.---',
        lastTime: data.lastTime ?? '--:--.---',
        bestTime: data.bestTime ?? '--:--.---',
        split: data.split ?? '--:--.---',
        completedLaps: data.completedLaps ?? 0,
        position: data.position ?? 0,
        currentSector: data.currentSector ?? 0,
        numberOfLaps: data.numberOfLaps ?? 0,
        status: data.status ?? 0,
        session: data.session ?? 0,
    };
}

function downloadJSON() {
    if (recordBuffer.length === 0) {
        alert('Nenhum dado gravado!');
        return;
    }
    
    const endTime = Date.now();
    const duration = (endTime - recordStartTime) / 1000;
    
    const jsonData = {
        metadata: {
            version: '1.0',
            startTime: new Date(recordStartTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            duration: Math.round(duration * 1000) / 1000,
            samples: recordBuffer.length,
            sampleRate: 1,
            app: 'HyperCorsaX'
        },
        samples: recordBuffer
    };
    
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date(recordStartTime).toISOString().replace(/[:.]/g, '-');
    a.download = `hypercorsax_telemetry_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('[Recorder] Arquivo salvo:', a.download);
}

// Exporta para uso em outras páginas (compare.html)
window.Recorder = {
    parseFile: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.samples || !Array.isArray(data.samples)) {
                        throw new Error('Formato JSON inválido: array "samples" não encontrado');
                    }
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    // Alinha duas runs pelo tempo de volta (opcional - para uso futuro)
    alignByLap: (runA, runB, lapNumber) => {
        // TODO: implementar alinhamento por volta
        return { runA, runB };
    }
};