// Variable para mantener el modo actual
let currentMode = 'normal';

// funcion para cambiar el estilo css del modo del chat (razonamiento vs normal)
function toggleMode() {
    const modeButton = document.getElementById('mode-toggle');
    
    // Alternar entre modos
    if (currentMode === 'normal') {
        currentMode = 'razonamiento';
        modeButton.classList.add('active');
    } else {
        currentMode = 'normal';
        modeButton.classList.remove('active');
    }
    
    // Enviar el cambio de modo al backend
    switchMode(currentMode);
}

// funcion para avisar al backend (python) del cambio de modo (razonamiento vs normal)
function switchMode(mode) {
    return fetch('/switch_mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode })
    })
    .then(response => response.json())
}

// Comenzar nueva conversación desde cualquier página
function startNewConversation(event) {
    // 1. Previene que el <a> navegue a "#"
    event.preventDefault(); 
    
    // 2. Llama a switchMode para forzar el modo 'normal' en el backend
    switchMode('normal')
        .then(data => {
            // 3. CUANDO EL BACKEND RESPONDE (sea con éxito o error),
            //    ahora sí recargamos la página.
            window.location.href = '/';
        })
        .catch(error => {
            // 4. Si el fetch falla (ej. sin red), recargamos de todos modos
            console.error('Error al resetear modo, recargando de todos modos:', error);
            window.location.href = '/';
        });
}