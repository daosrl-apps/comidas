import unittest
import json
import os
import sys

# Add directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import server

class TestComidasPlanificador(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        server.app.config['TESTING'] = True
        self.client = server.app.test_client()
        
        # Backup existing config path if it exists
        self.original_data_file = server.DATA_FILE
        server.DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Datos_test.json")
        
        # Initialize default database for tests
        data = {
            "config": {
                "gemini_api_key": "test-key"
            },
            "comidas": [
                {
                    "id": "comida_test_1",
                    "nombre": "Milanesa con puré",
                    "receta": "Pasos de milanesa",
                    "ingredientes": [
                        { "nombre": "carne", "cantidad": 150.0, "unidad": "gramos" },
                        { "nombre": "papas", "cantidad": 200.0, "unidad": "gramos" }
                    ]
                },
                {
                    "id": "comida_test_2",
                    "nombre": "Fideos con crema",
                    "receta": "Pasos de fideos",
                    "ingredientes": [
                        { "nombre": "fideos", "cantidad": 100.0, "unidad": "gramos" },
                        { "nombre": "crema de leche", "cantidad": 50.0, "unidad": "ml" },
                        { "nombre": "papas", "cantidad": 10.0, "unidad": "gramos" } # ingrediente común de prueba
                    ]
                }
            ],
            "programa": {}
        }
        
        # Populate empty program
        for dia in server.DEFAULT_DIAS:
            data["programa"][dia] = {
                "Almuerzo": {
                    "comida_id": "",
                    "comensales": {comensal: False for comensal in server.DEFAULT_COMENSALES}
                },
                "Cena": {
                    "comida_id": "",
                    "comensales": {comensal: False for comensal in server.DEFAULT_COMENSALES}
                }
            }
            
        server.save_data(data)

    def tearDown(self):
        # Restore config path and remove test file
        if os.path.exists(server.DATA_FILE):
            os.remove(server.DATA_FILE)
        server.DATA_FILE = self.original_data_file

    def test_get_config(self):
        response = self.client.get('/api/config')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["gemini_api_key"], "test-key")

    def test_update_config(self):
        update_data = {
            "gemini_api_key": "updated-key"
        }
        response = self.client.post('/api/config', json=update_data)
        self.assertEqual(response.status_code, 200)
        
        # Read back config
        response2 = self.client.get('/api/config')
        data = json.loads(response2.data)
        self.assertEqual(data["gemini_api_key"], "updated-key")

    def test_get_comidas(self):
        response = self.client.get('/api/comidas')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["nombre"], "Milanesa con puré")

    def test_add_comida(self):
        nueva = {
            "nombre": "Pollo al horno",
            "receta": "Hacer pollo",
            "ingredientes": [
                { "nombre": "pollo", "cantidad": 0.25, "unidad": "unidad" }
            ]
        }
        response = self.client.post('/api/comidas', json=nueva)
        self.assertEqual(response.status_code, 200)
        
        # Verify it was added
        response2 = self.client.get('/api/comidas')
        data = json.loads(response2.data)
        self.assertEqual(len(data), 3)
        self.assertEqual(data[2]["nombre"], "Pollo al horno")

    def test_mrp_calculation(self):
        # Configure program for test:
        # Lunes Almuerzo -> "Milanesa con puré" (comida_test_1), comensales: Vito (true), Rochi (true), Berni (false), Mamá (true), Papá (true) = 4 comensales.
        # Martes Cena -> "Fideos con crema" (comida_test_2), comensales: Vito (true), Rochi (true), Berni (false), Mamá (false), Papá (false) = 2 comensales.
        #
        # Expected Consolidated Requirements:
        # - carne: 150g * 4 = 600g
        # - papas: (200g * 4) + (10g * 2) = 800g + 20g = 820g
        # - fideos: 100g * 2 = 200g
        # - crema de leche: 50ml * 2 = 100ml
        
        data = server.load_data()
        data["programa"]["Lunes"]["Almuerzo"]["comida_id"] = "comida_test_1"
        data["programa"]["Lunes"]["Almuerzo"]["comensales"] = {
            "Vito": True, "Rochi": True, "Berni": False, "Mamá": True, "Papá": True
        }
        data["programa"]["Martes"]["Cena"]["comida_id"] = "comida_test_2"
        data["programa"]["Martes"]["Cena"]["comensales"] = {
            "Vito": True, "Rochi": True, "Berni": False, "Mamá": False, "Papá": False
        }
        server.save_data(data)
        
        response = self.client.get('/api/lista-compra')
        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)
        
        lista = result["lista_compra"]
        self.assertEqual(len(lista), 4)
        
        # Check quantities
        ingredients_map = {item["nombre"].lower(): item for item in lista}
        
        self.assertEqual(ingredients_map["carne"]["cantidad"], 600.0)
        self.assertEqual(ingredients_map["carne"]["unidad"], "gramos")
        
        self.assertEqual(ingredients_map["papas"]["cantidad"], 820.0)
        self.assertEqual(ingredients_map["papas"]["unidad"], "gramos")
        
        self.assertEqual(ingredients_map["fideos"]["cantidad"], 200.0)
        self.assertEqual(ingredients_map["fideos"]["unidad"], "gramos")
        
        self.assertEqual(ingredients_map["crema de leche"]["cantidad"], 100.0)
        self.assertEqual(ingredients_map["crema de leche"]["unidad"], "ml")

if __name__ == '__main__':
    unittest.main()
