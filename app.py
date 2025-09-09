from flask import Flask, render_template, request, jsonify, session, Response
from ollama import Client
import os
import webview
import threading
import time

# Configuración de Flask
app = Flask(__name__)
app.secret_key = 'super_secret_key'  # Para sesiones

# Cliente de Ollama
client = Client()

# Cargar contexto de la carpeta 'context'
def load_context():
    context_dir = 'context'
    context = ""
    if os.path.exists(context_dir):
        for filename in os.listdir(context_dir):
            if filename.endswith('.txt'):
                with open(os.path.join(context_dir, filename), 'r', encoding='utf-8') as f:
                    context += f.read() + "\n\n"
    return context.strip()

# Cargar instrucciones del sistema
def load_instructions():
    instructions_file = 'instructions.txt'
    if os.path.exists(instructions_file):
        with open(instructions_file, 'r', encoding='utf-8') as f:
            return f.read().strip()
    return "Eres un asistente útil."

# Contexto e instrucciones globales (se cargan al inicio)
GLOBAL_CONTEXT = load_context()
SYSTEM_INSTRUCTIONS = load_instructions()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get('message')
    mode = session.get('mode', 'normal')

    # Determinar si usar thinking mode y seleccionar modelo
    use_thinking = (mode == 'razonamiento')
    model = 'qwen3:4b' if use_thinking else 'gemma3:4b'

    # Mensaje del sistema unificado (sin dependencias de prompts para thinking)
    system_content = f"{SYSTEM_INSTRUCTIONS}\nContexto que puede, o no ser útil: {GLOBAL_CONTEXT}"

    # Construir mensajes para chat
    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_message}
    ]

    # Generar respuesta con Ollama chat
    response = client.chat(
        model=model,
        messages=messages,
        think=use_thinking
    )

    # Extraer contenido de la respuesta
    bot_response = response['message']['content'].strip()

    if use_thinking:
        thinking = response['message']['thinking']
        return jsonify({
            'mode': 'razonamiento',
            'thinking': thinking,
            'response': bot_response
        })
    else:
        return jsonify({'response': bot_response})

@app.route('/settings')
def settings():
    return render_template('settings.html', title='Settings')

@app.route('/switch_mode', methods=['POST'])
def switch_mode():
    new_mode = request.json.get('mode')
    if new_mode in ['normal', 'razonamiento']:
        session['mode'] = new_mode
        return jsonify({'status': 'ok', 'mode': new_mode})
    return jsonify({'status': 'error'}), 400

# Función para iniciar el servidor Flask en un hilo separado
def start_server():
    # Solo accesible localmente
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False, threaded=True)

# Función para crear y mostrar la ventana de la aplicación
def create_app_window():
    # Esperar un momento para que el servidor se inicie
    time.sleep(2)
    
    # Crear la ventana de la aplicación
    webview.create_window(
        'Chat con IA',
        'http://127.0.0.1:5000',
        width=1200,
        height=800,
        resizable=True,
        min_size=(800, 600)
    )
    
    # Iniciar el bucle de eventos de PyWebView
    webview.start()

if __name__ == '__main__':
    # Iniciar el servidor Flask en un hilo separado
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    
    # Crear y mostrar la ventana de la aplicación
    create_app_window()