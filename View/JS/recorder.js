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
    checkGForceWarning(data);
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

// ==========================================
// AVISO DE FORÇA G EXTREMA
// ==========================================
let lastGForceWarningTime = 0;

function checkGForceWarning(data) {
    if (!data) return;
    let gx = data.accG_x || 0;
    let gy = data.accG_y || 0;
    let gz = data.accG_z || 0;
    let gForce = Math.sqrt(gx*gx + gy*gy + gz*gz);

    if (gForce >= 15) {
        // Evitar spam de modal, abrir a cada 5 segundos no máximo
        const now = Date.now();
        if (now - lastGForceWarningTime > 5000) {
            showGForceModal(gForce);
            lastGForceWarningTime = now;
        }
    }
}

function showGForceModal(gForce) {
    let modal = document.getElementById('gforce-warning-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gforce-warning-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        modal.style.zIndex = '99999';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        let content = document.createElement('div');
        content.id = 'gforce-warning-content';
        content.style.backgroundColor = '#111';
        content.style.color = '#fff';
        content.style.padding = '40px';
        content.style.borderRadius = '15px';
        content.style.maxWidth = '600px';
        content.style.textAlign = 'center';
        content.style.border = '3px solid red';
        content.style.fontFamily = 'Arial, sans-serif';
        content.style.boxShadow = '0 0 30px rgba(255, 0, 0, 0.5)';
        
        modal.appendChild(content);
        document.body.appendChild(modal);
    }
    
    let title = "";
    let desc = "";
    let color = "";

    if (gForce >= 100) {
        title = "Extrema (" + gForce.toFixed(1) + "G)";
        desc = "Limite das forças suportadas pelo corpo e pela célula de sobrevivência. Impacto na célula de sobrevivência acima de [100G]. Bandeira vermelha imediata. Equipes médicas e de resgate enviadas.";
        color = "#ff0000"; // Red
    } else if (gForce >= 50) {
        title = "Alta (" + gForce.toFixed(1) + "G)";
        desc = "Impactos severos contra barreiras de proteção. O risco de concussão é alto.";
        color = "#ff4500"; // OrangeRed
    } else if (gForce >= 18) {
        title = "Moderada - Gatilho Médico (" + gForce.toFixed(1) + "G)";
        desc = "Visita ao Centro Médico da obrigatória no retorno aos boxes.";
        color = "#ff8c00"; // DarkOrange
    } else {
        title = "Baixa / Alerta (" + gForce.toFixed(1) + "G)";
        desc = "Verifique as condições do piloto via rádio.";
        color = "#ffd700"; // Gold
    }

    let content = document.getElementById('gforce-warning-content');
    content.style.borderColor = color;
    content.style.boxShadow = '0 0 30px ' + color;
    content.innerHTML = `
        <h1 style="color: ${color}; margin-top: 0; font-size: 2em; text-transform: uppercase;">⚠️ Alerta de Impacto ⚠️</h1>
        <h2 style="margin: 15px 0; font-size: 1.5em; color: #fff;">${title}</h2>
        <p style="font-size: 1.2em; line-height: 1.6; color: #ccc;">${desc}</p>
        <button id="gforce-btn-close" style="margin-top: 25px; padding: 12px 30px; background: ${color}; border: none; color: #000; font-weight: bold; font-size: 1.1em; cursor: pointer; border-radius: 8px; transition: 0.2s;">ENTENDIDO</button>
    `;
    
    let btn = document.getElementById('gforce-btn-close');
    btn.onmouseover = () => { btn.style.transform = 'scale(1.05)'; };
    btn.onmouseout = () => { btn.style.transform = 'scale(1)'; };
    btn.onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
}
