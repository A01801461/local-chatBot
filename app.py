from flask import Flask, render_template, request, jsonify, session
import ollama
import os
import webview
import threading
import time

# Configuración de Flask
app = Flask(__name__)
app.secret_key = 'super_secret_key'  # Para sesiones

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
    mode = session.get('mode', 'normal')  # Modo por defecto: normal

    # Seleccionar modelo basado en modo
    model = 'gemma3:4b' if mode == 'normal' else 'qwen3:4b'

    # Construir prompt con instrucciones, contexto y mensaje del usuario
    prompt = f"{SYSTEM_INSTRUCTIONS}\n\nContexto adicional:\n{GLOBAL_CONTEXT}\n\nUsuario: {user_message}\nAsistente:"

    # Generar respuesta con Ollama
    response = ollama.generate(model=model, prompt=prompt)
    bot_response = response['response']

    return jsonify({'response': bot_response})

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