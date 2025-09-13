from flask import Flask, render_template, request, jsonify, session, Response
from ollama import Client
import os
import webview
import threading
import time
import json

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

# Cargar instrucciones iniciales para el primer "agente" del sistema
def load_instructions():
    instructions_file = 'heavyInstructions.txt'
    if os.path.exists(instructions_file):
        with open(instructions_file, 'r', encoding='utf-8') as f:
            return f.read().strip()
    return "Eres el agente líder. Analiza el problema del usuario y divídelo en sub-tareas separadas por '---'. El primer bloque es el contexto general, luego cada sub-tarea para un agente especialista."

# Contexto e instrucciones globales (se cargan al inicio)
GLOBAL_CONTEXT = load_context()
SYSTEM_INSTRUCTIONS = load_instructions()

def procesar_lider(texto):
    # Dividir el texto por los separadores '---'
    bloques = texto.strip().split('---')
    
    # Limpiar espacios innecesarios en cada bloque
    bloques = [bloque.strip() for bloque in bloques if bloque.strip()]
    
    # El primer bloque es el contexto del problema
    contexto_problema = bloques[0] if bloques else ''
    
    # Diccionario para almacenar los prompts para agentes (sub-tareas)
    agentes = {}
    
    # Iterar sobre los bloques restantes para crear los prompts de agentes
    for i, bloque in enumerate(bloques[1:], start=1):
        nombre_agente = f"agente{i}"
        # Cada prompt de agente es contexto + sub-tarea
        agentes[nombre_agente] = contexto_problema + "\n\nTu tarea específica: " + bloque
    
    return contexto_problema, agentes

@app.route('/heavy')
def heavy():
    return render_template('heavy.html')

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get('message')
    model = 'qwen3:8b'
    mode = session.get('mode', 'razonamiento')  # Asumir razonamiento para heavy

    def generate():
        # Diccionario para almacenar todas las respuestas
        todas_respuestas = {}
        
        # Paso 1: Agente Líder
        system_content = SYSTEM_INSTRUCTIONS
        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_message}
        ]
        response_lider = client.chat(
            model=model,
            messages=messages,
            think=True  # Siempre con thinking en heavy
        )
        bot_response_lider = response_lider['message']['content'].strip()
        thinking_lider = response_lider.get('message', {}).get('thinking', '')
        
        # Guardar respuesta del líder
        todas_respuestas['lider'] = bot_response_lider

        # Yield para líder
        yield json.dumps({
            'step': 'lider',
            'thinking': thinking_lider,
            'response': bot_response_lider
        }) + '\n'

        # Procesar output del líder
        contexto_problema, agentes = procesar_lider(bot_response_lider)

        # Acumular output previo para chaining
        output_previo = bot_response_lider

        # Paso 2: Procesar cada agente secuencialmente
        for nombre, prompt_agente in agentes.items():
            prompt_agente += "\n\nOutput previo del agente anterior: " + output_previo
            system_content_agente = "Eres un agente especialista. Usa el contexto y tu tarea para generar una respuesta detallada."
            messages_agente = [
                {"role": "system", "content": system_content_agente},
                {"role": "user", "content": prompt_agente}
            ]
            response_agente = client.chat(
                model=model,
                messages=messages_agente,
                think=True
            )
            bot_response_agente = response_agente['message']['content'].strip()
            thinking_agente = response_agente.get('message', {}).get('thinking', '')
            
            # Guardar respuesta del agente
            todas_respuestas[nombre] = bot_response_agente

            # Yield para este agente
            yield json.dumps({
                'step': nombre,
                'thinking': thinking_agente,
                'response': bot_response_agente
            }) + '\n'

            # Actualizar output previo para el siguiente
            output_previo = bot_response_agente

        # Paso 3: Síntesis final
        # Construir prompt de síntesis con todas las respuestas
        prompt_sintesis = f"""Pregunta original del usuario: {user_message}

Contexto del problema identificado: {contexto_problema}

Respuestas de los agentes especializados:
"""
        for nombre, respuesta in todas_respuestas.items():
            if nombre != 'lider':  # El líder ya dio el contexto
                prompt_sintesis += f"\n{nombre}:\n{respuesta}\n"
        
        prompt_sintesis += "\nBasándote en todas las respuestas anteriores, genera una síntesis completa y coherente que integre todos los puntos importantes de cada agente. La síntesis debe ser clara, estructurada y responder completamente a la pregunta original del usuario."
        
        system_content_sintesis = "Eres un agente sintetizador experto. Tu trabajo es tomar múltiples respuestas de diferentes agentes y crear una respuesta unificada, coherente y completa que integre lo mejor de cada contribución."
        
        messages_sintesis = [
            {"role": "system", "content": system_content_sintesis},
            {"role": "user", "content": prompt_sintesis}
        ]
        
        response_sintesis = client.chat(
            model=model,
            messages=messages_sintesis,
            think=True
        )
        bot_response_sintesis = response_sintesis['message']['content'].strip()
        thinking_sintesis = response_sintesis.get('message', {}).get('thinking', '')

        # Yield para síntesis
        yield json.dumps({
            'step': 'sintesis',
            'thinking': thinking_sintesis,
            'response': bot_response_sintesis
        }) + '\n'

        # Paso final: Respuesta final
        yield json.dumps({
            'step': 'final',
            'response': bot_response_sintesis,
            'all_responses': todas_respuestas  # Opcional: enviar todas las respuestas por si acaso
        }) + '\n'

    return Response(generate(), mimetype='application/x-ndjson')

@app.route('/switch_mode', methods=['POST'])
def switch_mode():
    new_mode = request.json.get('mode')
    if new_mode in ['normal', 'razonamiento', 'heavy']:
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
        'http://127.0.0.1:5000/heavy',  # Iniciar en heavy
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