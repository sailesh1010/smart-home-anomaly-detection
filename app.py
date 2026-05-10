import os
from flask import Flask, render_template, jsonify, request
import model  # NEW: Import model module
import simulation # NEW: Import simulation module
import config # NEW: Import config module

app = Flask(__name__)

# --- API ROUTES ---

@app.route('/')
def index():
    """Serves the main index.html page."""
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    """
    Main API endpoint polled by the frontend.
    Updates the simulation state and returns the latest status.
    """
    simulation.update_learning_phase(config.LEARNING_PHASE_DURATION)
    
    # Simulate traffic for all devices
    for device_id in list(simulation.simulation_state['devices'].keys()):
        simulation.simulate_traffic(device_id)
    
    # Update device statuses based on phase
    simulation.update_all_device_statuses()
    
    # Check for anomalies and get the final state
    simulation.check_for_anomalies(model.model, model.scaler, config.DETECTION_THRESHOLD)
    
    return jsonify(simulation.simulation_state)

@app.route('/api/add_device', methods=['POST'])
def add_d_device():
    """Adds a new device to the simulation."""
    device_type = request.json['type']
    device_id = simulation.add_new_device(device_type)
    return jsonify({'status': 'ok', 'device_id': device_id})

@app.route('/api/compromise', methods=['POST'])
def compromise_device():
    """Marks a device as 'compromised'."""
    device_id = request.json['device_id']
    simulation.set_compromise(device_id)
    return jsonify({'status': 'ok'})

@app.route('/api/control', methods=['POST'])
def control_simulation():
    """Handles simulation controls like 'start_attack' and 'full_reset'."""
    action = request.json['action']
    attack_type = request.json.get('attack_type') # .get() is safer
    
    simulation.control_sim_action(action, attack_type)
    return jsonify({'status': 'ok'})

# --- NEW: Manual Attack Route ---
@app.route('/api/manual_attack', methods=['POST'])
def manual_attack():
    """Receives manual traffic values from the UI sliders."""
    data = request.json
    # Pass data to the simulation module
    simulation.set_manual_attack(data['device_id'], data['packets'], data['data'])
    # The main /api/status poll will handle checking and reporting
    return jsonify({'status': 'ok'})

# --- APP STARTUP ---

if __name__ == '__main__':
    # Load (or train) the ML model and scaler on startup
    model.model, model.scaler = model.load_model()
    
    # Run the Flask app
    app.run(debug=True)