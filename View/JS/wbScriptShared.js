const JANELA_VISIVEL = 20; // 20 segundos visíveis na tela
const MAX_HISTORICO = 600; // 10 minutos de histórico

class TelemetryBuffer {
    constructor() {
        this.buffer = [];
        this.annotations = [];
        this.lastSave = 0;
        this.annotVersion = 0;
        this.loadFromStorage();
    }

    push(packet) {
        if (this.buffer.length > 0) {
            const last = this.buffer[this.buffer.length - 1];
            if (packet.completedLaps !== last.completedLaps && packet.completedLaps !== undefined) {
                this.annotations.push({
                    t: packet.t,
                    type: 'lap',
                    text: `Volta ${packet.completedLaps + 1}`
                });
                this.annotVersion++;
            } else if (packet.currentSector !== last.currentSector && packet.currentSector !== undefined) {
                this.annotations.push({
                    t: packet.t,
                    type: 'sector',
                    text: `S${packet.currentSector + 1}`
                });
                this.annotVersion++;
            }
        }

        this.buffer.push(packet);
        // Limita o histórico ao MAX_HISTORICO
        const maxTime = this.buffer[this.buffer.length - 1].t;
        const limitTime = maxTime - MAX_HISTORICO;
        
        while (this.buffer.length > 0 && this.buffer[0].t < limitTime) {
            this.buffer.shift();
        }
        
        // Limpa anotações velhas
        let oldAnnLen = this.annotations.length;
        while (this.annotations.length > 0 && this.annotations[0].t < limitTime) {
            this.annotations.shift();
        }
        if (this.annotations.length !== oldAnnLen) {
            this.annotVersion++;
        }
        
        this.saveToStorage();
    }

    getAll() {
        return this.buffer;
    }

    loadFromStorage() {
        try {
            const data = sessionStorage.getItem('hcx_telemetry_buffer');
            if (data) {
                const parsed = JSON.parse(data);
                this.buffer = parsed.buffer || [];
                this.annotations = parsed.annotations || [];
                console.log(`[TelemetryBuffer] Loaded ${this.buffer.length} packets from history.`);
            }
        } catch (e) {
            console.error('[TelemetryBuffer] Erro ao carregar buffer:', e);
            this.buffer = [];
            this.annotations = [];
        }
    }

    saveToStorage() {
        try {
            const now = Date.now();
            if (now - this.lastSave > 500) {
                const data = {
                    buffer: this.buffer,
                    annotations: this.annotations
                };
                sessionStorage.setItem('hcx_telemetry_buffer', JSON.stringify(data));
                this.lastSave = now;
            }
        } catch (e) {
            // Em caso de cota excedida (embora 600s raramente exceda 5MB se compactado)
            console.error('[TelemetryBuffer] Erro ao salvar buffer (quota?):', e);
        }
    }
    
    clear() {
        this.buffer = [];
        this.annotations = [];
        this.annotVersion++;
        sessionStorage.removeItem('hcx_telemetry_buffer');
    }
}

const sharedTelemetryBuffer = new TelemetryBuffer();

function updateSectorBadge(data) {
    const badgeLap = document.getElementById('badge-lap');
    const badgeSector = document.getElementById('badge-sector');
    
    if (badgeLap && badgeSector) {
        const lap = data.completedLaps !== undefined ? data.completedLaps : '--';
        const sector = data.currentSector !== undefined ? data.currentSector + 1 : '--';
        
        badgeLap.textContent = `Volta ${lap}`;
        badgeSector.textContent = `S${sector}`;
        
        badgeSector.classList.remove('s1', 's2', 's3');
        if (sector >= 1 && sector <= 3) {
            badgeSector.classList.add(`s${sector}`);
        }
    }
}

function getStartTime() {
    let st = sessionStorage.getItem('hcx_start_time');
    if (!st) {
        st = Date.now();
        sessionStorage.setItem('hcx_start_time', st);
    }
    return parseInt(st, 10);
}

const sharedStartTime = getStartTime();

const LAP_REGISTRY_KEY = 'hcx_lap_registry_v1';
let lapRegistry = loadLapRegistry();

function loadLapRegistry() {
    try {
        const parsed = JSON.parse(localStorage.getItem(LAP_REGISTRY_KEY) || '{}');
        return {
            sessionId: parsed.sessionId || 0,
            history: Array.isArray(parsed.history) ? parsed.history : [],
            ids: new Set(Array.isArray(parsed.ids) ? parsed.ids : [])
        };
    } catch (_) {
        return { sessionId: 0, history: [], ids: new Set() };
    }
}

function saveLapRegistry() {
    try {
        localStorage.setItem(LAP_REGISTRY_KEY, JSON.stringify({
            sessionId: lapRegistry.sessionId,
            history: lapRegistry.history,
            ids: Array.from(lapRegistry.ids)
        }));
    } catch (_) {
        // O servidor continua sendo a fonte principal se o armazenamento local falhar.
    }
}

window.consumeLapMessage = function (message) {
    if (!message || !message.type) return false;

    if (message.type === 'lap_state') {
        if (message.sessionId !== lapRegistry.sessionId) {
            lapRegistry = {
                sessionId: message.sessionId,
                history: Array.isArray(message.history) ? message.history : [],
                ids: new Set((message.history || []).map((entry) => `${message.sessionId}:${entry.lap}:${entry.totalMs}`))
            };
            saveLapRegistry();
        }
    } else if (message.type === 'lap_completed' && message.lapId && !lapRegistry.ids.has(message.lapId)) {
        if (message.sessionId !== lapRegistry.sessionId) {
            lapRegistry = { sessionId: message.sessionId, history: [], ids: new Set() };
        }
        lapRegistry.history.push(message.lap);
        lapRegistry.ids.add(message.lapId);
        saveLapRegistry();
    } else {
        return false;
    }

    window.dispatchEvent(new CustomEvent('hcx:lap-message', { detail: message }));
    return true;
};

window.getLapRegistry = function () {
    return {
        sessionId: lapRegistry.sessionId,
        history: lapRegistry.history.slice()
    };
};

function checkSessionRestart(currentTime) {
    if (sharedTelemetryBuffer.buffer.length > 0) {
        const lastTime = sharedTelemetryBuffer.buffer[sharedTelemetryBuffer.buffer.length - 1].t;
        // Se o tempo atual for menor que o último tempo gravado (com margem), a sessão reiniciou
        if (currentTime < lastTime - 5) {
            sharedTelemetryBuffer.clear();
            sessionStorage.setItem('hcx_start_time', Date.now());
            location.reload(); // Recarrega para resetar tudo
        }
    }
}

function syncChartAnnotations(chart, chartAnnotVersion) {
    if (chartAnnotVersion === sharedTelemetryBuffer.annotVersion) return chartAnnotVersion;

    if (!chart.options.plugins.annotation) {
        chart.options.plugins.annotation = { annotations: {} };
    }

    const newAnnots = {};
    sharedTelemetryBuffer.annotations.forEach((ann, index) => {
        const isLap = ann.type === 'lap';
        let color = isLap ? 'rgba(255, 255, 255, 0.6)' : (ann.text === 'S2' ? 'rgba(255, 215, 0, 0.4)' : (ann.text === 'S3' ? 'rgba(0, 255, 136, 0.4)' : 'rgba(255, 255, 255, 0.4)'));
        newAnnots['ann_' + index] = {
            type: 'line',
            xMin: ann.t,
            xMax: ann.t,
            borderColor: color,
            borderWidth: isLap ? 2 : 1,
            borderDash: isLap ? [] : [5, 5],
            label: {
                display: true,
                content: ann.text,
                position: 'start',
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: isLap ? '#fff' : '#ccc',
                font: { size: 10 }
            }
        };
    });

    chart.options.plugins.annotation.annotations = newAnnots;
    return sharedTelemetryBuffer.annotVersion;
}

