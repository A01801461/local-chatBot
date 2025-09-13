// Sistema de chat para modo Heavy con múltiples agentes
let isProcessing = false;
let currentAgents = {};
let thinkingContainer = null;

// Función principal para enviar mensajes
function sendMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    if (!message || isProcessing) return;

    // Marcar como procesando
    isProcessing = true;

    // Mostrar mensaje del usuario
    const chatBox = document.getElementById('chat-box');
    const userDiv = document.createElement('div');
    userDiv.className = 'user-message';
    userDiv.textContent = message;
    chatBox.appendChild(userDiv);
    input.value = '';

    // Crear contenedor principal para el proceso de thinking
    thinkingContainer = document.createElement('div');
    thinkingContainer.className = 'thinking-container';
    thinkingContainer.innerHTML = `
        <div class="thinking-header">
            <div class="thinking-animation">
                <i class="fas fa-brain"></i>
                <span class="thinking-text">Procesando</span>
                <span class="dots">...</span>
            </div>
            <button class="expand-all-btn" onclick="toggleAllAgents()" style="display: none;">
                <i class="fas fa-expand"></i> Expandir todo
            </button>
        </div>
        <div class="agents-thinking-list"></div>
    `;
    chatBox.appendChild(thinkingContainer);
    
    // Resetear agentes actuales
    currentAgents = {};
    
    // Scroll al fondo
    chatBox.scrollTop = chatBox.scrollHeight;

    // Enviar al backend usando streaming
    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
    })
    .then(response => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        function readStream() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    // Procesamiento completado
                    finalizeProcesamiento();
                    return;
                }
                
                // Decodificar el chunk
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());
                
                lines.forEach(line => {
                    try {
                        const data = JSON.parse(line);
                        procesarRespuestaAgente(data);
                    } catch (e) {
                        console.error('Error parsing JSON:', e, line);
                    }
                });
                
                // Continuar leyendo
                readStream();
            });
        }
        
        readStream();
    })
    .catch(error => {
        console.error('Error:', error);
        mostrarError(chatBox);
        isProcessing = false;
    });
}

// Procesar respuesta de cada agente
function procesarRespuestaAgente(data) {
    const chatBox = document.getElementById('chat-box');
    const agentsList = thinkingContainer.querySelector('.agents-thinking-list');
    
    if (data.step === 'final') {
        // Respuesta final sintetizada
        mostrarRespuestaFinal(data.response, chatBox);
    } else {
        // Mostrar botón de expandir todo después del primer agente
        const expandBtn = thinkingContainer.querySelector('.expand-all-btn');
        if (expandBtn && data.step !== 'lider') {
            expandBtn.style.display = 'inline-block';
        }
        
        // Crear o actualizar elemento del agente
        let agentDiv = document.getElementById(`agent-${data.step}`);
        if (!agentDiv) {
            agentDiv = document.createElement('details');
            agentDiv.id = `agent-${data.step}`;
            agentDiv.className = 'agent-thinking';
            agentDiv.innerHTML = `
                <summary>
                    <span class="agent-icon">${getAgentIcon(data.step)}</span>
                    <span class="agent-name">${getAgentName(data.step)}</span>
                    <span class="agent-status processing">
                        <i class="fas fa-spinner fa-spin"></i> Procesando...
                    </span>
                </summary>
                <div class="agent-content">
                    <div class="thinking-section">
                        <h4><i class="fas fa-lightbulb"></i> Razonamiento:</h4>
                        <p class="thinking-text"></p>
                    </div>
                    <div class="response-section">
                        <h4><i class="fas fa-comment-dots"></i> Respuesta:</h4>
                        <p class="response-text"></p>
                    </div>
                </div>
            `;
            agentsList.appendChild(agentDiv);
        }
        
        // Actualizar contenido del agente
        const thinkingText = agentDiv.querySelector('.thinking-text');
        const responseText = agentDiv.querySelector('.response-text');
        const statusSpan = agentDiv.querySelector('.agent-status');
        
        // Animar el texto de thinking
        if (data.thinking) {
            typeText(thinkingText, data.thinking, 10);
        }
        
        // Animar el texto de respuesta
        if (data.response) {
            typeText(responseText, data.response, 15);
            // Cambiar estado a completado
            statusSpan.innerHTML = '<i class="fas fa-check-circle"></i> Completado';
            statusSpan.className = 'agent-status completed';
        }
        
        // Guardar agente en el estado actual
        currentAgents[data.step] = data;
        
        // Auto-scroll suave
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// Mostrar respuesta final sintetizada
function mostrarRespuestaFinal(response, chatBox) {
    // Cambiar animación de thinking a completado
    const thinkingHeader = thinkingContainer.querySelector('.thinking-header');
    const thinkingAnimation = thinkingHeader.querySelector('.thinking-animation');
    thinkingAnimation.innerHTML = `
        <i class="fas fa-check-circle" style="color: #4CAF50;"></i>
        <span class="thinking-text">Procesamiento completado</span>
    `;
    
    // Crear div para la respuesta final
    const finalDiv = document.createElement('div');
    finalDiv.className = 'bot-message final-response';
    finalDiv.innerHTML = `
        <div class="final-header">
            <i class="fas fa-robot"></i>
            <span>Respuesta Sintetizada</span>
        </div>
        <div class="final-content"></div>
    `;
    chatBox.appendChild(finalDiv);
    
    // Animar la respuesta final
    const finalContent = finalDiv.querySelector('.final-content');
    typeText(finalContent, response, 20);
    
    // Scroll al fondo
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Finalizar procesamiento
function finalizeProcesamiento() {
    isProcessing = false;
    
    // Cambiar todos los agentes pendientes a completados
    const processingAgents = thinkingContainer.querySelectorAll('.agent-status.processing');
    processingAgents.forEach(status => {
        status.innerHTML = '<i class="fas fa-check-circle"></i> Completado';
        status.className = 'agent-status completed';
    });
}

// Función para animar texto caracter por caracter
function typeText(element, text, speed = 20) {
    element.innerHTML = '';
    let i = 0;
    
    function addChar() {
        if (i < text.length) {
            // Manejar caracteres especiales HTML
            if (text.charAt(i) === '<') {
                // Buscar el cierre de la etiqueta
                const tagEnd = text.indexOf('>', i);
                if (tagEnd !== -1) {
                    element.innerHTML += text.substring(i, tagEnd + 1);
                    i = tagEnd + 1;
                } else {
                    element.innerHTML += text.charAt(i);
                    i++;
                }
            } else if (text.charAt(i) === '\n') {
                element.innerHTML += '<br>';
                i++;
            } else {
                element.innerHTML += text.charAt(i);
                i++;
            }
            
            // Continuar animación
            setTimeout(addChar, speed);
        }
    }
    
    addChar();
}

// Obtener icono según el tipo de agente
function getAgentIcon(step) {
    const icons = {
        'lider': '👑',
        'agente1': '🔧',
        'agente2': '🎯',
        'agente3': '📊',
        'agente4': '🔬',
        'agente5': '🎨',
        'sintesis': '🔮'
    };
    return icons[step] || '🤖';
}

// Obtener nombre legible del agente
function getAgentName(step) {
    const names = {
        'lider': 'Agente Líder',
        'agente1': 'Agente Especialista 1',
        'agente2': 'Agente Especialista 2',
        'agente3': 'Agente Especialista 3',
        'agente4': 'Agente Especialista 4',
        'agente5': 'Agente Especialista 5',
        'sintesis': 'Agente Sintetizador'
    };
    return names[step] || `Agente ${step}`;
}

// Toggle todos los agentes (expandir/colapsar)
function toggleAllAgents() {
    const details = thinkingContainer.querySelectorAll('details.agent-thinking');
    const btn = thinkingContainer.querySelector('.expand-all-btn');
    const allOpen = Array.from(details).every(d => d.open);
    
    details.forEach(detail => {
        detail.open = !allOpen;
    });
    
    // Cambiar texto e icono del botón
    if (allOpen) {
        btn.innerHTML = '<i class="fas fa-expand"></i> Expandir todo';
    } else {
        btn.innerHTML = '<i class="fas fa-compress"></i> Colapsar todo';
    }
}

// Mostrar mensaje de error
function mostrarError(chatBox) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bot-message error';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        Error al procesar la solicitud. Por favor, intenta de nuevo.
    `;
    chatBox.appendChild(errorDiv);
    
    // Limpiar contenedor de thinking si existe
    if (thinkingContainer) {
        thinkingContainer.remove();
        thinkingContainer = null;
    }
}

// Event listener para Enter en el input
document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('user-input');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Agregar indicador visual cuando está procesando
    setInterval(() => {
        if (isProcessing) {
            const dots = document.querySelectorAll('.dots');
            dots.forEach(dot => {
                const text = dot.textContent;
                if (text.length >= 3) {
                    dot.textContent = '.';
                } else {
                    dot.textContent = text + '.';
                }
            });
        }
    }, 500);
});