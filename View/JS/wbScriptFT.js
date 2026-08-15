// Variáveis globais que afetam o cálculo de desgaste
let activeCompound = 'soft';

function openModal() {
    document.getElementById('tyreModal').classList.remove('hidden');
    document.getElementById('tyreModal').classList.add('flex');
}

function closeModal() {
    document.getElementById('tyreModal').classList.add('hidden');
    document.getElementById('tyreModal').classList.remove('flex');
}

function setCompound(compound) {
    activeCompound = compound;

    const params = {

        soft: { dropCliff: 18.0, gamma: 6.0, label: 'Macio' },
        medium: { dropCliff: 22.5, gamma: 5.0, label: 'Médio' },
        hard: { dropCliff: 28.0, gamma: 3.5, label: 'Duro' },
        intermediate: { dropCliff: 30.0, gamma: 4.0, label: 'Intermediário' },
        wet: { dropCliff: 35.0, gamma: 3.0, label: 'Chuva' },
    };

    const p = params[compound];

    // Atualiza as variáveis globais no escopo do wbScriptWheels.js
    window.WEAR_DROP_CLIFF = p.dropCliff;
    window.GAMMA_WEAR = p.gamma;

    document.querySelector('#compoundStatus span').textContent = p.label;
    closeModal();
}