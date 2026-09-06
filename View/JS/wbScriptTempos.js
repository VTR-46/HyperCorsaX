// ============================================================
//  wbScriptTempos.js — HyperCorsaX
//  Registra e armazena tempos de volta com 3 setores.
//
//  PERSISTÊNCIA: sessionStorage — dados sobrevivem à navegação
//  entre páginas no mesmo tab, mas são apagados ao fechar a aba.
//
//  DETECÇÃO DE RESET: se completedLaps cair abaixo do valor
//  salvo, exibe modal perguntando ao usuário o que fazer.
// ============================================================

const SESSION_NAMES_T = {
    0: 'PRÁTICA', 1: 'TREINO', 2: 'CORRIDA', 3: 'HOTLAP',
    4: 'TIME ATTACK', 5: 'DRIFT', 6: 'DRAG', 7: 'HOT STINT', 8: 'SUPER POLE'
};

// Chave do sessionStorage
const STORAGE_KEY = 'hcx_tempos_session_v1';

// ─── Formata ms → "m:ss.mmm" ───
function msToLapStr(ms) {
    if (ms === null || ms === undefined || ms < 0) return '--:--.---';
    const m = Math.floor(ms / 60000);
    const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
    return `${m}:${s}`;
}

// ─── Converte string "m:ss.mmm" → ms (-1 se inválido) ───
function lapStrToMs(t) {
    if (!t || t === '--:--.---' || t === '') return -1;
    const parts = String(t).split(':');
    if (parts.length !== 2) return -1;
    const min = parseInt(parts[0], 10);
    const sec = parseFloat(parts[1]);
    if (isNaN(min) || isNaN(sec)) return -1;
    return min * 60000 + Math.round(sec * 1000);
}

// ────────────────────────────────────────────────────────────
//  Estado da sessão (runtime)
// ────────────────────────────────────────────────────────────
const lapHistory = [];
const bestAbsMs  = { s1: -1, s2: -1, s3: -1, total: -1 };

let prevSector        = -1;
let prevCompletedLaps = -1;
let prevILastTime     = -1;

let capturedS1Ms  = -1;
let capturedS2Ms  = -1;
let splitAtS1Ms   = -1;

// Flag para não mostrar o modal de reset mais de uma vez por sessão
let sessionResetAsked = false;

// ────────────────────────────────────────────────────────────
//  Persistência — sessionStorage
// ────────────────────────────────────────────────────────────

/** Salva o estado atual no sessionStorage. */
function saveLapData() {
    try {
        const snapshot = {
            lapHistory:    lapHistory,
            bestAbsMs:     bestAbsMs,
            completedLaps: prevCompletedLaps  // último valor visto
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
        // sessionStorage indisponível — ignora silenciosamente
    }
}

/** Carrega o estado do sessionStorage, popula lapHistory/bestAbsMs e renderiza. */
function loadLapData() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const snapshot = JSON.parse(raw);
        if (!Array.isArray(snapshot.lapHistory) || !snapshot.lapHistory.length) return;

        // Restaura estado
        lapHistory.push(...snapshot.lapHistory);
        Object.assign(bestAbsMs, snapshot.bestAbsMs);
        prevCompletedLaps = typeof snapshot.completedLaps === 'number' ? snapshot.completedLaps : -1;

        renderTable();
        showRestoredBanner();
    } catch (e) {
        // JSON corrompido ou inválido — ignora
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }
}

/** Exibe banner informando que dados foram restaurados. */
function showRestoredBanner() {
    const banner = document.getElementById('t-restored-banner');
    if (banner) {
        banner.style.display = 'flex';
        // Auto-esconde em 5 segundos
        setTimeout(() => { banner.style.display = 'none'; }, 5000);
    }
}

// ────────────────────────────────────────────────────────────
//  Detecção de reset de sessão de jogo
// ────────────────────────────────────────────────────────────

/**
 * Chamado quando detectamos que completedLaps caiu para 0 (ou ficou
 * muito abaixo do valor salvo), indicando que o jogo foi reiniciado.
 * Exibe modal perguntando ao usuário o que deseja fazer.
 */
function promptSessionReset() {
    if (sessionResetAsked) return;
    sessionResetAsked = true;

    const modal = document.getElementById('t-reset-modal');
    if (modal) modal.style.display = 'flex';
}

/** Ação: manter dados anteriores e continuar acumulando. */
window.keepPreviousData = function () {
    const modal = document.getElementById('t-reset-modal');
    if (modal) modal.style.display = 'none';
    // Zera o prevCompletedLaps para que o próximo incremento seja detectado corretamente
    prevCompletedLaps = 0;
    prevILastTime     = -1;
    sessionResetAsked = false; // permite detectar um próximo reset
};

/** Ação: limpar tudo e começar nova sessão. */
window.startNewSession = function () {
    const modal = document.getElementById('t-reset-modal');
    if (modal) modal.style.display = 'none';
    clearSession();
};

// ────────────────────────────────────────────────────────────
//  Lógica principal — chamada a cada mensagem WebSocket
// ────────────────────────────────────────────────────────────
function processData(data) {
    const sector        = typeof data.currentSector  === 'number' ? data.currentSector  : 0;
    const completedLaps = typeof data.completedLaps  === 'number' ? data.completedLaps  : 0;
    const iLastTime     = typeof data.iLastTime      === 'number' ? data.iLastTime      : -1;
    const lastSectorMs  = typeof data.lastSectorTime === 'number' ? data.lastSectorTime : -1;
    const splitMs       = lapStrToMs(data.split ?? '');

    // ── Inicialização na primeira mensagem ──
    if (prevSector === -1) {
        prevSector = sector;

        // Se não havia dados salvos, inicializa prevCompletedLaps aqui
        if (prevCompletedLaps === -1) {
            prevCompletedLaps = completedLaps;
        } else {
            // Havia dados salvos — verifica se o jogo foi reiniciado
            // Reset detectado: completedLaps é 0 e havia voltas registradas
            if (completedLaps === 0 && lapHistory.length > 0 && !sessionResetAsked) {
                promptSessionReset();
            }
            // Se completedLaps já é maior que o salvo, sessão continua normalmente
            if (completedLaps >= prevCompletedLaps) {
                prevCompletedLaps = completedLaps;
            }
        }

        prevILastTime = iLastTime;
        updateCurrentPanel(data);
        return;
    }

    // ─── Detecção de reset enquanto rodando (se já inicializou) ───
    // Se completedLaps cai para 0 durante a sessão e havia voltas registradas
    if (completedLaps === 0 && prevCompletedLaps > 0 && lapHistory.length > 0 && !sessionResetAsked) {
        promptSessionReset();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  1. DETECÇÃO DE MUDANÇA DE SETOR
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (sector !== prevSector) {
        if (prevSector === 0 && sector === 1) {
            capturedS1Ms = lastSectorMs > 0 ? lastSectorMs : (splitMs > 0 ? splitMs : -1);
            splitAtS1Ms  = splitMs;
        }
        if (prevSector === 1 && sector === 2) {
            if (lastSectorMs > 0) {
                capturedS2Ms = lastSectorMs;
            } else if (splitMs > 0 && splitAtS1Ms > 0) {
                capturedS2Ms = splitMs - splitAtS1Ms;
            }
        }
        prevSector = sector;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  2. DETECÇÃO DE VOLTA COMPLETADA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const lapCompleted =
        (iLastTime > 0 && iLastTime !== prevILastTime) ||
        (completedLaps > prevCompletedLaps && prevCompletedLaps >= 0);

    if (lapCompleted) {
        const totalMs = iLastTime > 0 ? iLastTime : lapStrToMs(data.lastTime ?? '');

        let s3Ms = -1;
        if (totalMs > 0 && capturedS1Ms > 0 && capturedS2Ms > 0) {
            s3Ms = totalMs - capturedS1Ms - capturedS2Ms;
            if (s3Ms < 0) s3Ms = -1;
        } else if (lastSectorMs > 0) {
            s3Ms = lastSectorMs;
        }

        const lapNum = completedLaps > 0 ? completedLaps : (lapHistory.length + 1);

        lapHistory.push({
            lap:     lapNum,
            s1Ms:    capturedS1Ms,
            s2Ms:    capturedS2Ms,
            s3Ms:    s3Ms,
            totalMs: totalMs
        });

        // Atualiza melhores absolutos
        if (capturedS1Ms > 0 && (bestAbsMs.s1 < 0 || capturedS1Ms < bestAbsMs.s1)) bestAbsMs.s1 = capturedS1Ms;
        if (capturedS2Ms > 0 && (bestAbsMs.s2 < 0 || capturedS2Ms < bestAbsMs.s2)) bestAbsMs.s2 = capturedS2Ms;
        if (s3Ms         > 0 && (bestAbsMs.s3 < 0 || s3Ms         < bestAbsMs.s3)) bestAbsMs.s3 = s3Ms;
        if (totalMs      > 0 && (bestAbsMs.total < 0 || totalMs   < bestAbsMs.total)) bestAbsMs.total = totalMs;

        // Reseta captura
        capturedS1Ms = -1;
        capturedS2Ms = -1;
        splitAtS1Ms  = -1;

        renderTable();
        flashNewLap(lapHistory.length - 1);

        // ── Persiste no sessionStorage ──
        saveLapData();
    }

    prevILastTime     = iLastTime;
    prevCompletedLaps = completedLaps;

    updateCurrentPanel(data);
}

// ────────────────────────────────────────────────────────────
//  Painel Volta Atual
// ────────────────────────────────────────────────────────────
function updateCurrentPanel(data) {
    const sector  = data.currentSector ?? 0;
    const laps    = data.completedLaps ?? 0;
    const numLaps = data.numberOfLaps  ?? 0;
    const pos     = data.position      ?? 0;
    const session = data.session       ?? 0;

    setText('t-cur-time',  data.currentTime ?? '--:--.---');
    setText('t-split',     data.split       ?? '--:--.---');
    setText('t-lap-count', numLaps > 0 ? `${laps + 1} / ${numLaps}` : `${laps + 1} / Livre`);
    setText('t-pos',       pos > 0 ? `P${pos}` : 'P--');
    setText('t-session',   SESSION_NAMES_T[session] ?? '--');
    setText('t-best',      data.bestTime ?? '--:--.---');

    for (let i = 0; i < 3; i++) {
        const dot = document.getElementById(`t-sector-dot-${i}`);
        if (!dot) continue;
        if      (i < sector)  dot.className = 'sector-dot sector-dot-done';
        else if (i === sector) dot.className = 'sector-dot sector-dot-active';
        else                   dot.className = 'sector-dot sector-dot-pending';
    }
    setText('t-cur-sector', `S${sector + 1}`);
}

// ────────────────────────────────────────────────────────────
//  Renderização da tabela
// ────────────────────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('t-lap-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    lapHistory.forEach((entry, idx) => {
        const personalAtRow = calcPersonalBestUpTo(idx);

        const tr = document.createElement('tr');
        tr.id = `lap-row-idx-${idx}`;

        const tdLap = document.createElement('td');
        tdLap.className   = 'td-lap-num';
        tdLap.textContent = entry.lap;
        tr.appendChild(tdLap);

        [
            { ms: entry.s1Ms,    bestAbs: bestAbsMs.s1,    bestPer: personalAtRow.s1,    isTotal: false },
            { ms: entry.s2Ms,    bestAbs: bestAbsMs.s2,    bestPer: personalAtRow.s2,    isTotal: false },
            { ms: entry.s3Ms,    bestAbs: bestAbsMs.s3,    bestPer: personalAtRow.s3,    isTotal: false },
            { ms: entry.totalMs, bestAbs: bestAbsMs.total, bestPer: personalAtRow.total, isTotal: true  },
        ].forEach(({ ms, bestAbs, bestPer, isTotal }) => {
            const td = document.createElement('td');
            td.textContent = msToLapStr(ms);
            td.className   = buildCellClass(ms, bestAbs, bestPer, isTotal);
            tr.appendChild(td);
        });

        tbody.insertBefore(tr, tbody.firstChild);
    });
}

function buildCellClass(ms, bestAbs, bestPer, isTotal) {
    const base = isTotal ? 'td-sector td-total' : 'td-sector';
    if (ms <= 0)                        return `${base} td-unknown`;
    if (bestAbs > 0 && ms === bestAbs)  return `${base} sector-purple`;
    if (bestPer > 0 && ms === bestPer)  return `${base} sector-green`;
    return `${base} sector-yellow`;
}

function calcPersonalBestUpTo(untilIdx) {
    const best = { s1: -1, s2: -1, s3: -1, total: -1 };
    for (let i = 0; i < untilIdx; i++) {
        const e = lapHistory[i];
        if (e.s1Ms    > 0 && (best.s1    < 0 || e.s1Ms    < best.s1))    best.s1    = e.s1Ms;
        if (e.s2Ms    > 0 && (best.s2    < 0 || e.s2Ms    < best.s2))    best.s2    = e.s2Ms;
        if (e.s3Ms    > 0 && (best.s3    < 0 || e.s3Ms    < best.s3))    best.s3    = e.s3Ms;
        if (e.totalMs > 0 && (best.total < 0 || e.totalMs < best.total)) best.total = e.totalMs;
    }
    return best;
}

function flashNewLap(idx) {
    const tr = document.getElementById(`lap-row-idx-${idx}`);
    if (!tr) return;
    tr.classList.add('lap-row-flash');
    setTimeout(() => tr.classList.remove('lap-row-flash'), 1500);
}

// ────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/** Limpar sessão completa (botão + opção do modal de reset). */
window.clearSession = function () {
    lapHistory.length = 0;
    bestAbsMs.s1 = bestAbsMs.s2 = bestAbsMs.s3 = bestAbsMs.total = -1;
    prevSector        = -1;
    prevCompletedLaps = -1;
    prevILastTime     = -1;
    capturedS1Ms      = -1;
    capturedS2Ms      = -1;
    splitAtS1Ms       = -1;
    sessionResetAsked = false;

    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}

    const tbody = document.getElementById('t-lap-tbody');
    if (tbody) tbody.innerHTML = '';

    const banner = document.getElementById('t-restored-banner');
    if (banner) banner.style.display = 'none';

    setText('t-best', '--:--.---');
};

// ────────────────────────────────────────────────────────────
//  Inicialização: carrega dados salvos antes de conectar o WS
// ────────────────────────────────────────────────────────────
loadLapData();

// ────────────────────────────────────────────────────────────
//  WebSocket (com reconexão automática)
// ────────────────────────────────────────────────────────────
(function connectWS() {
    const ws = new WebSocket('ws://localhost:8765');

    ws.onopen = () => {
        console.log('[Tempos] WebSocket conectado.');
        const el = document.getElementById('t-ws-status');
        if (el) { el.textContent = '● CONECTADO'; el.className = 'ws-status ws-ok'; }
    };

    ws.onclose = () => {
        const el = document.getElementById('t-ws-status');
        if (el) { el.textContent = '● DESCONECTADO'; el.className = 'ws-status ws-off'; }
        setTimeout(connectWS, 3000);
    };

    ws.onerror = (e) => console.error('[Tempos] Erro WS:', e);

    ws.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); }
        catch (e) { console.error('[Tempos] JSON inválido:', e); return; }
        try { processData(data); }
        catch (err) { console.error('[Tempos] Erro processData:', err); }
    };
})();
