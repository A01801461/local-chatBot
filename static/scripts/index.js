// funcion para mandar mensajes:
//   maneja los estilos como animaciones de pensamiento, etc
//   manda el mensaje al backend (python)
function sendMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    if (!message) return;

    // Mostrar mensaje del usuario
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML += `<div class="user-message">${message}</div>`;
    input.value = '';

    // Si es modo razonamiento, agregar loading de "Thinking..." con animación
    let loadingDiv = null;
    if (currentMode === 'razonamiento') {
        loadingDiv = thinkingAnimation(chatBox);
    } else {
        // Si no es modo razonamiento, muestra el spinner simple
       loadingDiv = normalLoadingAnimation(chatBox);
    }

    // Enviar al backend
    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
    })
    .then(response => response.json())
    .then(data => {
        // Remover loading si existe
        if (loadingDiv) {
            loadingDiv.remove();
        }

        if (data.mode === 'razonamiento') {
            // Mostrar thinking colapsable (sin animación, ya que es inmediato al llegar)
            typeThoughts(data.thinking, loadingDiv, chatBox);
            // Luego, mostrar la respuesta gradualmente
            typeResponse(data.response, chatBox);
        } else {
            // Modo normal: mostrar gradualmente
            typeResponse(data.response, chatBox);
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch(error => {
        console.error('Error:', error);
        // Opcional: remover loading en caso de error y mostrar mensaje de error
        if (loadingDiv) {
            loadingDiv.remove();
            chatBox.innerHTML += '<div class="bot-message error">Error al generar respuesta. Intenta de nuevo.</div>';
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
}

// funcion para animacion de penamiento
function thinkingAnimation(chatBox) {
    loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-thinking';
    loadingDiv.className = 'bot-message loading-thinking';
    loadingDiv.innerHTML = '<span class="thinking-dots">Thinking</span><span class="dots">...</span>';
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return loadingDiv;
}

// funcion para mostrar de pensamiento finalizado
function typeThoughts(text, loadingDiv, chatBox) {
    // Mostrar thinking colapsable (sin animación, ya que es inmediato al llegar)
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'bot-message';
    thinkingDiv.innerHTML = `
        <details>
            <summary>finished thinking</summary>
            <p>${text}</p>
        </details>
    `;
    chatBox.appendChild(thinkingDiv);
}

// Función para mostrar la respuesta gradualmente (sin cambios)
function typeResponse(text, chatBox) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'bot-message typing';
    chatBox.appendChild(msgDiv);
    
    let i = 0;
    function typeChar() {
        if (i < text.length) {
            msgDiv.innerHTML += text.charAt(i);
            i++;
            chatBox.scrollTop = chatBox.scrollHeight;
            setTimeout(typeChar, 20); // Velocidad ajustable
        } else {
            msgDiv.classList.remove('typing');
        }
    }
    typeChar();
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

// funcion para animacion de carga normal (círculo girando)
function normalLoadingAnimation(chatBox) {
    let loadingDiv = document.createElement('div');
    // Usamos 'bot-message' para la alineación y 'loading-normal' para el estilo
    loadingDiv.className = 'bot-message loading-normal'; 
    loadingDiv.innerHTML = '<div class="simple-spinner"></div>';
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return loadingDiv; // Devolvemos el div para poder eliminarlo después
}

// Enviar con Enter
document.getElementById('user-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
});