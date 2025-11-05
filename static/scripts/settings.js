// (Añadir al DOMContentLoaded junto con el código del tema)

const promptEditor = document.getElementById('system-prompt-editor');
const savePromptBtn = document.getElementById('save-prompt-btn');
const saveStatus = document.getElementById('save-prompt-status');

// Cargar las instrucciones actuales al abrir settings
fetch('/api/instructions')
    .then(response => response.json())
    .then(data => {
        promptEditor.value = data.instructions;
    });

document.addEventListener('DOMContentLoaded', () => {
    checkSystemHardware();
});

function checkSystemHardware() {
    // Obtener los elementos de la UI
    const gpuSpan = document.getElementById('spec-gpu');
    const vramSpan = document.getElementById('spec-vram');
    const ramSpan = document.getElementById('spec-ram');
    
    const vramLi = document.getElementById('li-vram');
    const ramLi = document.getElementById('li-ram');
    
    const resultBox = document.getElementById('performance-result');
    const resultText = document.getElementById('performance-text');
    const resultDetails = document.getElementById('performance-details');

    // Llamar a la API del backend
    fetch('/api/system_check')
        .then(response => response.json())
        .then(data => {
            const specs = data.specs;
            const perf = data.performance;
            const gpuError = data.gpu_error; // NUEVO: Obtener el mensaje de error

            // 1. Llenar la lista de especificaciones (esto es universal)
            if (specs.gpu_type === 'nvidia') {
                gpuSpan.textContent = specs.gpu_name;
                vramSpan.textContent = `${specs.vram_gb} GB`;
                vramLi.style.display = 'block';
                ramLi.style.display = 'none';
            } else {
                // Esto se mostrará incluso si hay un error de GPU, lo cual es correcto (es el fallback)
                gpuSpan.textContent = 'CPU (Fallback)'; 
                ramSpan.textContent = `${specs.ram_gb} GB (Cores: ${specs.cpu_cores})`;
                vramLi.style.display = 'none';
                ramLi.style.display = 'block';
            }

            // 2. Revisar si hubo un error de GPU
            if (gpuError) {
                // ¡Hubo un error! Sobrescribimos la caja de rendimiento.
                resultBox.classList.remove('loading');
                resultBox.classList.add('bad'); // 'bad' es la clase para el color rojo
                resultText.textContent = 'Diagnostic Error';
                
                // ¡Mostramos el error real del backend!
                resultDetails.textContent = gpuError; 
            
            } else {
                // No hubo error, mostrar el rendimiento normal.
                resultText.textContent = perf.text;
                resultDetails.textContent = perf.details;
                resultBox.classList.remove('loading');
                resultBox.classList.add(perf.level);
            }

        })
        .catch(error => {
            console.error('Error checking the system:', error);
            gpuSpan.textContent = 'Error verifying.';
            resultText.textContent = 'The system could not be analyzed.';
            resultBox.classList.remove('loading');
            resultBox.classList.add('bad');
        });
}

// Guardar las nuevas instrucciones
savePromptBtn.addEventListener('click', () => {
    const newInstructions = promptEditor.value;
    saveStatus.textContent = 'Saving...';

    fetch('/api/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: newInstructions })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            saveStatus.textContent = '¡Saved!';
        } else {
            saveStatus.textContent = 'Error saving.';
        }
        // Ocultar mensaje después de 2 segundos
        setTimeout(() => { saveStatus.textContent = ''; }, 2000);
    });

});