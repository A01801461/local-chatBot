// Variable para mantener el modo actual
let currentMode = 'normal';

function toggleMode() {
    const modeButton = document.getElementById('mode-toggle');
    const modeText = document.getElementById('current-mode');
    
    // Alternar entre modos
    if (currentMode === 'normal') {
        currentMode = 'razonamiento';
        modeButton.textContent = '🧠';
        modeButton.classList.add('active');
    } else {
        currentMode = 'normal';
        modeButton.textContent = '🧠';
        modeButton.classList.remove('active');
    }
    
    // Enviar el cambio de modo al backend
    switchMode(currentMode);
}

function switchMode(mode) {
    fetch('/switch_mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            // El modo ya se actualizó localmente, pero puedes hacer algo adicional si es necesario
        }
    });
}

function sendMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    if (!message) return;

    // Mostrar mensaje del usuario
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML += `<div class="user-message">${message}</div>`;
    input.value = '';

    // Enviar al backend
    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
    })
    .then(response => response.json())
    .then(data => {
        chatBox.innerHTML += `<div class="bot-message">${data.response}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// Enviar con Enter
document.getElementById('user-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
});