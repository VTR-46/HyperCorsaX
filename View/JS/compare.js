const leftSelect = document.getElementById('leftSession');
const rightSelect = document.getElementById('rightSession');
const compareButton = document.getElementById('compareButton');
const compareStatus = document.getElementById('compareStatus');
const summary = document.getElementById('comparisonSummary');

const colors = ['#ff6b6b', '#4dabf7', '#00d084', '#ffb347'];
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
        x: {
            type: 'linear',
            title: { display: true, text: 'Tempo decorrido (s)', color: '#aaa' },
            ticks: { color: '#aaa' },
            grid: { color: '#333' },
        },
        y: { ticks: { color: '#aaa' }, grid: { color: '#333' } },
    },
    plugins: {
        legend: { labels: { color: '#fff' } },
        zoom: {
            pan: { enabled: true, mode: 'x' },
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
        },
    },
};

function makeChart(id, title, fields) {
    const chart = new Chart(document.getElementById(id), {
        type: 'line',
        data: { datasets: [] },
        options: { ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: false, text: title } } },
    });
    chart._fields = fields;
    return chart;
}

const charts = {
    speed: makeChart('speedChart', 'Velocidade', [{ key: 'speed', label: 'Velocidade' }]),
    rpm: makeChart('rpmChart', 'RPM', [{ key: 'rpm', label: 'RPM' }]),
    pedals: makeChart('pedalsChart', 'Pedais', [
        { key: 'gas', label: 'Acelerador' }, { key: 'brake', label: 'Freio' },
    ]),
    tyres: makeChart('tyreTempChart', 'Temperatura', [
        { key: 'tyre_fl_temp', label: 'FL' }, { key: 'tyre_fr_temp', label: 'FR' },
        { key: 'tyre_rl_temp', label: 'RL' }, { key: 'tyre_rr_temp', label: 'RR' },
    ]),
};

function points(rows, key) {
    return rows
        .filter((row) => Number.isFinite(Number(row.elapsed_ms)) && row[key] !== null && row[key] !== undefined)
        .map((row) => ({ x: Number(row.elapsed_ms) / 1000, y: Number(row[key]) }));
}

function sessionLabel(session) {
    return `${session.started_at || 'sessão'}${session.track ? ` - ${session.track}` : ''}`;
}

async function loadSessions() {
    let response;
    try {
        response = await fetch('/api/sessions');
    } catch (error) {
        throw new Error('Bridge offline. Execute tl.bat e tente novamente.');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const sessions = await response.json();
    if (!Array.isArray(sessions)) throw new Error('Resposta inválida da API');
    [leftSelect, rightSelect].forEach((select) => {
        sessions.forEach((session) => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = sessionLabel(session);
            select.appendChild(option);
        });
    });
    compareStatus.textContent = `${sessions.length} sessão(ões) disponível(is)`;
}

function renderComparison(left, right) {
    Object.values(charts).forEach((chart) => {
        chart.data.datasets = chart._fields.flatMap((field, fieldIndex) => [
            {
                label: `A - ${field.label}`,
                data: points(left, field.key),
                borderColor: colors[fieldIndex],
                borderWidth: 2,
                pointRadius: 0,
            },
            {
                label: `B - ${field.label}`,
                data: points(right, field.key),
                borderColor: colors[fieldIndex + 1] || '#ffffff',
                borderDash: [6, 4],
                borderWidth: 2,
                pointRadius: 0,
            },
        ]);
        chart.resetZoom();
        chart.update();
    });
    const leftDuration = left.length ? Number(left[left.length - 1].elapsed_ms) / 1000 : 0;
    const rightDuration = right.length ? Number(right[right.length - 1].elapsed_ms) / 1000 : 0;
    summary.textContent = `Volta A: ${left.length} pontos, ${leftDuration.toFixed(1)} s | Volta B: ${right.length} pontos, ${rightDuration.toFixed(1)} s`;
}

async function compareSessions() {
    const left = leftSelect.value;
    const right = rightSelect.value;
    if (!left || !right) {
        compareStatus.textContent = 'Selecione as duas sessões.';
        return;
    }
    if (left === right) {
        compareStatus.textContent = 'Escolha duas sessões diferentes.';
        return;
    }
    compareButton.disabled = true;
    compareStatus.textContent = 'Carregando dados...';
    try {
        const response = await fetch(`/api/compare?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}&limit=5000`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (!Array.isArray(result.left) || !Array.isArray(result.right) || !result.left.length || !result.right.length) {
            throw new Error('Uma das sessões não possui amostras.');
        }
        renderComparison(result.left, result.right);
        compareStatus.textContent = 'Comparação carregada.';
    } catch (error) {
        compareStatus.textContent = error.message;
        summary.textContent = 'Não foi possível carregar a comparação.';
    } finally {
        compareButton.disabled = false;
    }
}

compareButton.addEventListener('click', compareSessions);
loadSessions().catch((error) => { compareStatus.textContent = `Erro: ${error.message}`; });
