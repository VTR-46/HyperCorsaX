(function () {
    const config = window.telemetryHistoryConfig;
    if (!config) return;

    window.telemetryHistoryMode = false;
    const liveDatasets = Object.fromEntries(Object.entries(config.charts).map(([name, chart]) => [name, chart.data.datasets]));
    const panel = document.createElement('section');
    panel.className = 'history-controls';
    panel.innerHTML = '<label for="historyA">Sessao A</label><select id="historyA"><option value="">Selecione</option></select>'
        + '<label for="historyB">Sessao B</label><select id="historyB"><option value="">Selecione</option></select>'
        + '<button id="compareHistory" type="button">Comparar</button>'
        + '<button id="liveHistory" type="button">Voltar ao live</button>';
    document.body.insertBefore(panel, document.body.firstChild);

    const firstSelect = panel.querySelector('#historyA');
    const secondSelect = panel.querySelector('#historyB');

    async function loadSessions() {
        const response = await fetch('/api/sessions');
        if (!response.ok) return;
        const sessions = await response.json();
        if (!Array.isArray(sessions)) return;
        sessions.forEach((session) => [firstSelect, secondSelect].forEach((select) => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = `${session.started_at} ${session.track || 'sessao'}`;
            select.appendChild(option);
        }));
    }

    function points(rows, field) {
        return rows.map((row) => ({ x: row.elapsed_ms / 1000, y: row[field] }));
    }

    function clearCharts() {
        Object.entries(config.charts).forEach(([name, chart]) => {
            chart.data.datasets = liveDatasets[name];
            chart.data.datasets.forEach((dataset) => { dataset.data.length = 0; });
            chart.update('none');
        });
    }

    function setHistory(left, right) {
        window.telemetryHistoryMode = true;
        Object.entries(config.charts).forEach(([chartName, chart]) => {
            const fields = config.fields[chartName];
            chart.data.datasets = fields.flatMap((field, index) => [
                { label: `A - ${field.label}`, data: points(left, field.key), borderColor: field.color, borderWidth: 2 },
                { label: `B - ${field.label}`, data: points(right, field.key), borderColor: field.altColor || '#FFFFFF', borderWidth: 2 },
            ]);
            chart.options.scales.x.min = undefined;
            chart.options.scales.x.max = undefined;
            chart.update();
        });
    }

    async function compare() {
        const left = firstSelect.value;
        const right = secondSelect.value;
        if (!left || !right) return;
        const response = await fetch(`/api/compare?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}&limit=5000`);
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result.left) && Array.isArray(result.right)) setHistory(result.left, result.right);
    }

    function returnToLive() {
        window.telemetryHistoryMode = false;
        clearCharts();
        if (typeof window.toggleAutoScroll === 'function') window.toggleAutoScroll();
    }

    panel.querySelector('#compareHistory').addEventListener('click', compare);
    panel.querySelector('#liveHistory').addEventListener('click', returnToLive);
    loadSessions().catch((error) => console.warn('Historico indisponivel:', error));
})();
