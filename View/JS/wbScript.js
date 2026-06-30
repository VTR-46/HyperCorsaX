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

const updateMeter = (fillId, valueId, value, min, max, suffix, lowColor, highColor) => {
    const normalized = ((value - min) / (max - min)) * 100;
    const percent = clamp(normalized, 0, 100);
    const fill = document.getElementById(fillId);
    const label = document.getElementById(valueId);
    if (!fill || !label) return;
    fill.style.height = percent + '%';
    fill.style.background = `linear-gradient(180deg, ${lowColor}, ${highColor})`;
    label.innerText = `${value.toFixed(1)}${suffix}`;
};

// conecta ao servidor Python via WebSocket
const ws = new WebSocket('ws://localhost:8765');


ws.onmessage = function (event) {
    const data = JSON.parse(event.data);

    // calcula o tempo atual em segundos desde o início da conexão
    const t = (Date.now() - startTime) / 1000;

    // adiciona os dados no formato que estou enviando {x, y}
    speedChart.data.datasets[0].data.push({ x: t, y: data.speed });

    pedalsChart.data.datasets[0].data.push({ x: t, y: data.gas });
    pedalsChart.data.datasets[1].data.push({ x: t, y: data.brake });

    const updateMeter = (fillId, valueId, value, min, max, suffix, color1, color2, color3 = null) => {  // CORES DOS FREIOS
        const normalized = ((value - min) / (max - min)) * 100;
        const percent = clamp(normalized, 0, 100);
        const fill = document.getElementById(fillId);
        const label = document.getElementById(valueId);
        if (!fill || !label) return;

        fill.style.height = percent + '%';

        // Se você mandar 3 cores, ele usa as 3. Se mandar 2, ele usa 2.
        if (color3) {
            fill.style.background = `linear-gradient(180deg, ${color1}, ${color2}, ${color3})`;
        } else {
            fill.style.background = `linear-gradient(180deg, ${color1}, ${color2})`;
        }

        label.innerText = `${value.toFixed(1)}${suffix}`;
    };

    // Alterado de (0, 1, '%') para (0, 600, '°C')
    updateMeter('brakeFLFill', 'brakeFLValue', data.brakeFL ?? 0, 0, 1200, '°C', '#FF0000', '#33FF00', '#0004FF');  //manter por hora
    updateMeter('brakeFRFill', 'brakeFRValue', data.brakeFR ?? 0, 0, 1200, '°C', '#FF0000', '#33FF00', '#0004FF');
    updateMeter('brakeRLFIll', 'brakeRLValue', data.brakeRL ?? 0, 0, 1200, '°C', '#FF0000', '#33FF00', '#0004FF');
    updateMeter('brakeRRFIll', 'brakeRRValue', data.brakeRR ?? 0, 0, 1200, '°C', '#FF0000', '#33FF00', '#0004FF');
    updateMeter('tyreFLFill', 'tyreFLValue', data.tyreFL ?? 0, 40, 120, '°C', '#ffeaa7', '#f9ca24');
    updateMeter('tyreFRFill', 'tyreFRValue', data.tyreFR ?? 0, 40, 120, '°C', '#c7b9ff', '#6c5ce7');
    updateMeter('tyreRLFIll', 'tyreRLValue', data.tyreRL ?? 0, 40, 120, '°C', '#ffb86b', '#ff6b6b');
    updateMeter('tyreRRFIll', 'tyreRRValue', data.tyreRR ?? 0, 40, 120, '°C', '#a7f3ff', '#4ecdc4');

    // se o auto-Scroll estiver ligado, move a câmera (escala X) junto com os dados
    if (autoScroll) {
        const minX = Math.max(0, t - janelaTempo); // Mostra só os últimos 15 segundos

        speedChart.options.scales.x.min = minX;
        speedChart.options.scales.x.max = t;

        pedalsChart.options.scales.x.min = minX;
        pedalsChart.options.scales.x.max = t;
    }

    // Atualiza os gráficos de forma mais leve (o 'none' var evitar recálculos desnecessários de layout)
    speedChart.update('none');
    pedalsChart.update('none');



};



ws.onopen = () => console.log("Conectado à telemetria!");
ws.onerror = (e) => console.error("Erro no WebSocket:", e);