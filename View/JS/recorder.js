// ==========================================
// RECORDER - Gravação de Telemetria (1 Hz)
// ==========================================

let isRecording = false;
let recordStartTime = 0;
let recordBuffer = [];
let lastRecordTime = 0;
let recordInterval = null;
let currentSessionData = null;

// ==========================================
// MODO GRAVAÇÃO POR VOLTAS
// ==========================================
let lapRecordMode  = false;   // true quando o modo por-voltas está ativo
let targetLaps     = 0;       // número de voltas escolhido pelo usuário
let lapRecordStartLap = -1;   // valor de completedLaps no momento que a gravação começou
let lapStandby     = false;   // true = aguardando cruzar a linha de chegada para iniciar

// Referência ao botão principal
const recordBtn = document.getElementById('btnLapRecord');

// Função chamada pelo WebSocket quando novos dados chegam
window.updateRecorderData = (data) => {
    currentSessionData = data;
};

// Inicia/para gravação manual (mantido para compatibilidade com F7)
window.toggleRecording = () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
};

// ==========================================
// FUNÇÕES DO MODAL
// ==========================================

window.openLapModal = () => {
    if (lapStandby || isRecording) return; // bloqueia reabrir se já ativo
    const modal = document.getElementById('lapRecordModal');
    const input = document.getElementById('lapCountInput');
    if (modal) modal.classList.remove('hidden');
    if (input) { input.value = 1; input.focus(); }
};

window.closeLapModal = () => {
    const modal = document.getElementById('lapRecordModal');
    if (modal) modal.classList.add('hidden');
};

window.handleModalOverlayClick = (event) => {
    // Fecha se clicar fora do modal-box
    if (event.target.id === 'lapRecordModal') {
        window.closeLapModal();
    }
};

window.confirmLapRecord = () => {
    const input = document.getElementById('lapCountInput');
    const n = parseInt(input?.value ?? '1', 10);

    if (isNaN(n) || n < 1 || n > 99) {
        input?.focus();
        input?.select();
        return;
    }

    targetLaps = n;
    lapRecordMode = true;
    lapStandby = true;
    lapRecordStartLap = currentSessionData?.completedLaps ?? -1;

    window.closeLapModal();
    updateLapRecordUI('standby');
    console.log(`[LapRecord] Modo standby: aguardando linha de chegada para gravar ${n} volta(s).`);
};



function startRecording() {
    isRecording = true;
    recordStartTime = Date.now();
    recordBuffer = [];
    lastRecordTime = 0;
    
    // Atualiza UI
    if (lapRecordMode) {
        updateLapRecordUI('recording', 0);
    } else {
        if (recordBtn) {
            recordBtn.innerHTML = '⏹️ PARAR';
            recordBtn.classList.add('recording');
            recordBtn.title = 'Clique para parar a gravação';
        }
    }
    
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
            
            // Feedback visual
            if (lapRecordMode) {
                const voltasFeitas = (currentSessionData?.completedLaps ?? lapRecordStartLap) - lapRecordStartLap;
                updateLapRecordUI('recording', voltasFeitas);
            } else if (recordBtn) {
                recordBtn.innerHTML = `⏹️ ${recordBuffer.length}s`;
            }
        }
    }, 100);
    
    console.log('[Recorder] Gravação iniciada');
}

function stopRecording() {
    isRecording = false;
    clearInterval(recordInterval);
    recordInterval = null;
    
    // Reseta estado do modo por voltas
    const wasLapMode = lapRecordMode;
    lapRecordMode  = false;
    lapStandby     = false;
    lapRecordStartLap = -1;
    targetLaps     = 0;

    // Atualiza UI
    if (wasLapMode) {
        updateLapRecordUI('idle');
    } else if (recordBtn) {
        recordBtn.innerHTML = '🎯 GRAVAR VOLTAS';
        recordBtn.classList.remove('recording');
        recordBtn.title = 'Gravar telemetria por número de voltas';
    }
    
    // Gera e baixa o JSON
    downloadJSON();
    
    console.log('[Recorder] Gravação finalizada:', recordBuffer.length, 'samples');
}

// ==========================================
// TRIGGER AUTOMÁTICO POR VOLTA
// ==========================================

/**
 * Chamada a cada mensagem do WebSocket.
 * Detecta cruzamento de linha de chegada via delta de completedLaps.
 */
window.checkLapRecordTrigger = (data) => {
    const currentLaps = data?.completedLaps ?? 0;

    // --- STANDBY: aguardando o carro cruzar a linha de chegada ---
    if (lapStandby && !isRecording) {
        if (currentLaps > lapRecordStartLap) {
            lapRecordStartLap = currentLaps;
            lapStandby = false;
            startRecording();
            console.log(`[LapRecord] Linha cruzada — gravação iniciada. Meta: ${targetLaps} volta(s).`);
        }
        return;
    }

    // --- GRAVANDO: verifica se atingiu o número de voltas ---
    if (isRecording && lapRecordMode) {
        const voltasGravadas = currentLaps - lapRecordStartLap;
        if (voltasGravadas >= targetLaps) {
            console.log(`[LapRecord] ${voltasGravadas}/${targetLaps} volta(s) completa(s) — encerrando gravação.`);
            stopRecording();
        }
    }
};

// ==========================================
// HELPER: ATUALIZAÇÃO DE UI DO MODO POR VOLTAS
// ==========================================

function updateLapRecordUI(state, voltasFeitas = 0) {
    const btn    = document.getElementById('btnLapRecord');
    const badge  = document.getElementById('lapRecordStatus');

    if (!btn) return;

    btn.classList.remove('recording', 'standby');
    if (badge) badge.classList.add('hidden');

    switch (state) {
        case 'standby':
            btn.innerHTML = '⏳ AGUARDANDO';
            btn.classList.add('standby');
            btn.title = `Aguardando linha de chegada para iniciar gravação de ${targetLaps} volta(s)`;
            if (badge) {
                badge.textContent = `⏳ Aguardando linha de chegada… (${targetLaps} volta${targetLaps > 1 ? 's' : ''})`;
                badge.className = 'lap-record-status standby';
            }
            break;

        case 'recording':
            btn.innerHTML = `🔴 ${voltasFeitas}/${targetLaps} volta${targetLaps > 1 ? 's' : ''}`;
            btn.classList.add('recording');
            btn.title = 'Gravando — aguarde completar as voltas';
            if (badge) {
                badge.textContent = `🔴 Gravando: volta ${voltasFeitas + 1} de ${targetLaps}`;
                badge.className = 'lap-record-status recording';
            }
            break;

        case 'idle':
        default:
            btn.innerHTML = '🎯 GRAVAR VOLTAS';
            btn.title = 'Gravar telemetria por número de voltas';
            if (badge) badge.className = 'lap-record-status hidden';
            break;
    }
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
        // Força G
        accG_x: data.accG_x ?? 0,
        accG_y: data.accG_y ?? 0,
        accG_z: data.accG_z ?? 0,
        // Suspensao (Travel)
        suspensionTravelFL: data.suspensionTravelFL ?? 0,
        suspensionTravelFR: data.suspensionTravelFR ?? 0,
        suspensionTravelRL: data.suspensionTravelRL ?? 0,
        suspensionTravelRR: data.suspensionTravelRR ?? 0,
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
// ==========================================
// ATALHO DE TECLADO: F7 = Iniciar/Parar gravacao
// ==========================================
document.addEventListener('keydown', (e) => {
    const target = e.target;
    const modalOpen = !document.getElementById('lapRecordModal')?.classList.contains('hidden');

    // ESC fecha o modal se estiver aberto
    if (e.key === 'Escape' && modalOpen) {
        e.preventDefault();
        window.closeLapModal();
        return;
    }

    // Enter confirma o modal se estiver aberto
    if (e.key === 'Enter' && modalOpen) {
        e.preventDefault();
        window.confirmLapRecord();
        return;
    }

    // F7 = atalho de gravação manual (não funciona se lapRecordMode estiver ativo)
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
    }
    if (e.key === 'F7') {
        e.preventDefault();
        if (!lapRecordMode && !lapStandby) {
            window.toggleRecording();
        }
    }
});

