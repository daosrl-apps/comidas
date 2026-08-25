import os
import json
import re
from flask import Flask, request, jsonify, send_from_directory
import google.generativeai as genai

# Initialize Flask app
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "Datos.json")

app = Flask(__name__)
app.secret_key = "comidas_familiares_secret_key_2026"

# Ensure data directory exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
    try:
        os.chmod(DATA_DIR, 0o777)
    except Exception as e:
        print(f"Advertencia al configurar permisos de directorio: {e}")

# Default application settings and database
DEFAULT_COMENSALES = ["Vito", "Rochi", "Berni", "Mamá", "Papá"]
DEFAULT_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
DEFAULT_COMIDAS_LIST = [
    {
        "id": "comida_1",
        "nombre": "Pata muslo al horno con puré",
        "receta": "1. Condimentar la pata muslo con sal, pimienta y limón.\n2. Hornear a 200°C por 45 minutos hasta que esté dorada.\n3. Hervir las papas peladas, pisar con manteca y leche hasta lograr el puré.",
        "ingredientes": [
            { "nombre": "pata muslo", "cantidad": 1.0, "unidad": "unidad" },
            { "nombre": "papas", "cantidad": 250.0, "unidad": "gramos" },
            { "nombre": "leche", "cantidad": 50.0, "unidad": "ml" },
            { "nombre": "manteca", "cantidad": 15.0, "unidad": "gramos" }
        ]
    },
    {
        "id": "comida_2",
        "nombre": "Fideos con crema",
        "receta": "1. Hervir agua con sal.\n2. Cocinar los fideos de 8 a 10 minutos.\n3. Colar y mezclar caliente con crema de leche y queso rallado.",
        "ingredientes": [
            { "nombre": "fideos", "cantidad": 100.0, "unidad": "gramos" },
            { "nombre": "crema de leche", "cantidad": 50.0, "unidad": "ml" },
            { "nombre": "queso rallado", "cantidad": 15.0, "unidad": "gramos" }
        ]
    },
    {
        "id": "comida_3",
        "nombre": "Panchos",
        "receta": "1. Hervir agua en una cacerola pequeña.\n2. Colocar las salchichas por 5 minutos.\n3. Calentar el pan y servir con aderezos a gusto.",
        "ingredientes": [
            { "nombre": "salchichas", "cantidad": 2.0, "unidad": "unidad" },
            { "nombre": "pan de pancho", "cantidad": 2.0, "unidad": "unidad" },
            { "nombre": "aderezos", "cantidad": 10.0, "unidad": "gramos" }
        ]
    }
]

def get_default_database():
    database = {
        "config": {
            "gemini_api_key": ""
        },
        "comidas": DEFAULT_COMIDAS_LIST.copy(),
        "programa": {}
    }
    # Initialize empty weekly program
    for dia in DEFAULT_DIAS:
        database["programa"][dia] = {
            "Almuerzo": {
                "comida_id": "",
                "comensales": {comensal: False for comensal in DEFAULT_COMENSALES}
            },
            "Cena": {
                "comida_id": "",
                "comensales": {comensal: False for comensal in DEFAULT_COMENSALES}
            }
        }
    return database

def load_data():
    """Loads all data from Datos.json, or creates it with defaults if it doesn't exist."""
    if not os.path.exists(DATA_FILE):
        data = get_default_database()
        save_data(data)
        return data
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            
            # Auto-repair schema if parts are missing
            updated = False
            if "config" not in data:
                data["config"] = {"gemini_api_key": ""}
                updated = True
            if "comidas" not in data or not isinstance(data["comidas"], list):
                data["comidas"] = DEFAULT_COMIDAS_LIST.copy()
                updated = True
            if "programa" not in data:
                data["programa"] = get_default_database()["programa"]
                updated = True
                
            # Verify and fill missing days in program
            for dia in DEFAULT_DIAS:
                if dia not in data["programa"]:
                    data["programa"][dia] = get_default_database()["programa"][dia]
                    updated = True
                else:
                    for comida_tipo in ["Almuerzo", "Cena"]:
                        if comida_tipo not in data["programa"][dia]:
                            data["programa"][dia][comida_tipo] = {
                                "comida_id": "",
                                "comensales": {comensal: False for comensal in DEFAULT_COMENSALES}
                            }
                            updated = True
                        else:
                            if "comida_id" not in data["programa"][dia][comida_tipo]:
                                data["programa"][dia][comida_tipo]["comida_id"] = ""
                                updated = True
                            if "comensales" not in data["programa"][dia][comida_tipo]:
                                data["programa"][dia][comida_tipo]["comensales"] = {comensal: False for comensal in DEFAULT_COMENSALES}
                                updated = True
                            else:
                                for comensal in DEFAULT_COMENSALES:
                                    if comensal not in data["programa"][dia][comida_tipo]["comensales"]:
                                        data["programa"][dia][comida_tipo]["comensales"][comensal] = False
                                        updated = True
            if updated:
                save_data(data)
            return data
    except Exception as e:
        print(f"Error al leer Datos.json: {e}")
        return get_default_database()

def save_data(data):
    """Saves data to Datos.json safely."""
    try:
        temp_file = DATA_FILE + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        if os.path.exists(DATA_FILE):
            os.remove(DATA_FILE)
        os.rename(temp_file, DATA_FILE)
    except Exception as e:
        print(f"Error al guardar Datos.json: {e}")

# --- API ENDPOINTS ---

@app.route('/api/config', methods=['GET'])
def get_config():
    data = load_data()
    return jsonify(data["config"])

@app.route('/api/config', methods=['POST'])
def update_config():
    try:
        new_config = request.json
        if not new_config:
            return jsonify({"error": "No se recibieron datos"}), 400
        
        data = load_data()
        if "gemini_api_key" in new_config:
            data["config"]["gemini_api_key"] = str(new_config["gemini_api_key"]).strip()
            
        save_data(data)
        return jsonify({"success": True, "config": data["config"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/comidas', methods=['GET'])
def get_comidas():
    data = load_data()
    return jsonify(data["comidas"])

@app.route('/api/comidas', methods=['POST'])
def add_comida():
    try:
        nueva_comida = request.json
        if not nueva_comida or "nombre" not in nueva_comida:
            return jsonify({"error": "El nombre es obligatorio"}), 400
        
        data = load_data()
        
        # Check uniqueness of name
        nombre = nueva_comida["nombre"].strip()
        for c in data["comidas"]:
            if c["nombre"].lower() == nombre.lower():
                return jsonify({"error": f"La comida '{nombre}' ya existe."}), 400

        # Create unique ID
        import uuid
        comida_id = f"comida_{uuid.uuid4().hex[:8]}"
        
        comida = {
            "id": comida_id,
            "nombre": nombre,
            "receta": nueva_comida.get("receta", "").strip(),
            "ingredientes": nueva_comida.get("ingredientes", [])
        }
        
        data["comidas"].append(comida)
        save_data(data)
        return jsonify({"success": True, "comida": comida})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/comidas/<comida_id>', methods=['PUT'])
def update_comida(comida_id):
    try:
        comida_editada = request.json
        if not comida_editada or "nombre" not in comida_editada:
            return jsonify({"error": "El nombre es obligatorio"}), 400
        
        data = load_data()
        found_idx = -1
        for idx, c in enumerate(data["comidas"]):
            if c["id"] == comida_id:
                found_idx = idx
                break
                
        if found_idx == -1:
            return jsonify({"error": "Comida no encontrada"}), 404
            
        nombre = comida_editada["nombre"].strip()
        # Verify unique name excluding current comida
        for c in data["comidas"]:
            if c["id"] != comida_id and c["nombre"].lower() == nombre.lower():
                return jsonify({"error": f"Otra comida ya se llama '{nombre}'."}), 400
                
        data["comidas"][found_idx]["nombre"] = nombre
        data["comidas"][found_idx]["receta"] = comida_editada.get("receta", "").strip()
        data["comidas"][found_idx]["ingredientes"] = comida_editada.get("ingredientes", [])
        
        save_data(data)
        return jsonify({"success": True, "comida": data["comidas"][found_idx]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/comidas/<comida_id>', methods=['DELETE'])
def delete_comida(comida_id):
    try:
        data = load_data()
        found_idx = -1
        for idx, c in enumerate(data["comidas"]):
            if c["id"] == comida_id:
                found_idx = idx
                break
                
        if found_idx == -1:
            return jsonify({"error": "Comida no encontrada"}), 404
            
        deleted_comida = data["comidas"].pop(found_idx)
        
        # Clean from weekly program if used
        program_updated = False
        for dia in DEFAULT_DIAS:
            for comida_tipo in ["Almuerzo", "Cena"]:
                if data["programa"][dia][comida_tipo]["comida_id"] == comida_id:
                    data["programa"][dia][comida_tipo]["comida_id"] = ""
                    program_updated = True
        
        save_data(data)
        return jsonify({"success": True, "deleted": deleted_comida, "program_cleaned": program_updated})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/programa', methods=['GET'])
def get_programa():
    data = load_data()
    return jsonify(data["programa"])

@app.route('/api/programa', methods=['POST'])
def update_programa():
    try:
        nuevo_programa = request.json
        if not nuevo_programa:
            return jsonify({"error": "No se recibieron datos"}), 400
            
        data = load_data()
        
        # Validar y actualizar
        for dia in DEFAULT_DIAS:
            if dia in nuevo_programa:
                for comida_tipo in ["Almuerzo", "Cena"]:
                    if comida_tipo in nuevo_programa[dia]:
                        entry = nuevo_programa[dia][comida_tipo]
                        data["programa"][dia][comida_tipo]["comida_id"] = entry.get("comida_id", "")
                        
                        # Actualizar comensales
                        if "comensales" in entry:
                            for comensal in DEFAULT_COMENSALES:
                                if comensal in entry["comensales"]:
                                    data["programa"][dia][comida_tipo]["comensales"][comensal] = bool(entry["comensales"][comensal])
                                    
        save_data(data)
        return jsonify({"success": True, "programa": data["programa"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/buscar-receta-ia', methods=['POST'])
def buscar_receta_ia():
    try:
        req_data = request.json
        if not req_data or "nombre" not in req_data:
            return jsonify({"error": "El nombre de la comida es obligatorio"}), 400
            
        nombre_comida = req_data["nombre"].strip()
        data = load_data()
        api_key = data["config"].get("gemini_api_key", "").strip()
        
        if not api_key:
            return jsonify({"error": "La API Key de Gemini no está configurada. Por favor, ve a la sección de Ajustes y agrégala."}), 400
            
        # Configure Gemini
        genai.configure(api_key=api_key)
        
        prompt = f"""
        Eres un chef y nutricionista profesional. Tu tarea es generar una receta estándar y los componentes/ingredientes específicos para la siguiente comida familiar: "{nombre_comida}".
        
        Es fundamental que los ingredientes y sus cantidades estén calculados exactamente para una porción individual (PARA UNA [1] PERSONA), de modo que podamos escalar las cantidades fácilmente multiplicándolas por la cantidad de comensales presentes. 
        Por favor, sé preciso en las unidades y cantidades de los ingredientes comunes (por ejemplo, usa 'gramos', 'ml', 'unidades', 'tazas' o 'cucharadas'). Evita términos imprecisos como 'cantidad necesaria'.
        
        Responde ÚNICAMENTE con un objeto JSON válido con el siguiente formato, no agregues explicaciones fuera del JSON, no utilices bloques de código de markdown como ```json o ```:
        {{
          "receta": "Instrucciones detalladas paso a paso para cocinar la comida...",
          "ingredientes": [
            {{
              "nombre": "nombre del ingrediente",
              "cantidad": 150.0,
              "unidad": "gramos"
            }},
            {{
              "nombre": "huevo",
              "cantidad": 1.0,
              "unidad": "unidad"
            }}
          ]
        }}
        """
        
        # Use a stable Gemini 1.5 Flash model
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
        resp_text = response.text.strip()
        
        # Strip markdown formatting if the model included it
        resp_text = re.sub(r"^```json\s*", "", resp_text, flags=re.IGNORECASE)
        resp_text = re.sub(r"\s*```$", "", resp_text)
        resp_text = resp_text.strip()
        
        try:
            receta_ia = json.loads(resp_text)
            
            # Simple validation of keys
            if "receta" not in receta_ia or "ingredientes" not in receta_ia:
                raise ValueError("JSON de respuesta incompleto")
                
            return jsonify({
                "success": True,
                "nombre": nombre_comida,
                "receta": receta_ia["receta"],
                "ingredientes": receta_ia["ingredientes"]
            })
        except Exception as e:
            print(f"Error al parsear respuesta JSON de Gemini: {e}. Respuesta cruda: {resp_text}")
            return jsonify({
                "error": "La IA devolvió un formato incorrecto. Se intentó obtener la receta pero la estructura no era válida. Intente de nuevo.",
                "raw_response": resp_text
            }), 500
            
    except Exception as e:
        return jsonify({"error": f"Error al consultar Gemini: {str(e)}"}), 500

@app.route('/api/lista-compra', methods=['GET'])
def get_lista_compra():
    try:
        data = load_data()
        comidas_dict = {c["id"]: c for c in data["comidas"]}
        
        consolidado = {}
        
        for dia in DEFAULT_DIAS:
            for comida_tipo in ["Almuerzo", "Cena"]:
                entry = data["programa"][dia][comida_tipo]
                comida_id = entry.get("comida_id")
                
                if comida_id and comida_id in comidas_dict:
                    # Count comensales
                    comensales_activos = [name for name, presente in entry.get("comensales", {}).items() if presente]
                    cant_comensales = len(comensales_activos)
                    
                    if cant_comensales > 0:
                        comida = comidas_dict[comida_id]
                        for ing in comida.get("ingredientes", []):
                            nombre = ing.get("nombre", "").strip().lower()
                            unidad = ing.get("unidad", "").strip().lower()
                            cantidad_base = float(ing.get("cantidad", 0))
                            
                            cantidad_total = cantidad_base * cant_comensales
                            
                            key = (nombre, unidad)
                            if key not in consolidado:
                                consolidado[key] = 0.0
                            consolidado[key] += cantidad_total
                            
        # Convert to list and sort alphabetically by ingredient name
        lista_final = []
        for (nombre, unidad), cantidad in consolidado.items():
            lista_final.append({
                "nombre": nombre.capitalize(),
                "cantidad": round(cantidad, 2),
                "unidad": unidad
            })
            
        lista_final.sort(key=lambda x: x["nombre"])
        
        return jsonify({
            "success": True,
            "lista_compra": lista_final
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Root static routing
@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

# Catch-all route to serve other frontend static files
@app.route('/<path:path>')
def send_static(path):
    if os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(BASE_DIR, path)

# Start development server
if __name__ == '__main__':
    # Listen on port 8086 as requested in the plan
    app.run(host='0.0.0.0', port=8086, debug=True)
