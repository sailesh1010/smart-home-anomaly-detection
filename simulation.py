import time
import numpy as np
import config # Import device profiles and config
import model # Import model functions

# --- SIMULATION STATE ---
# This dictionary holds the entire live state of the simulation.
simulation_state = {
    'devices': {},
    'compromised_device': None,
    'phase': 'learning', # learning -> testing
    'learning_progress': 0,
    'attack_analysis': None,
    'learned_baselines': {}
}

# --- STATE VARIABLES ---
learning_phase_start_time = 0
next_ip = 10

# --- SIMULATION LOGIC ---

def simulate_traffic(device_id):
    """Generates new traffic data for a single device based on its state."""
    device = simulation_state['devices'][device_id]
    
    # If in manual mode, don't simulate. Traffic is set by the API.
    if device.get('attack_mode') == 'manual':
        return

    attack_mode = device.get('attack_mode', 'normal')
    if attack_mode == 'normal':
        features, _ = model.generate_synthetic_data(device['type'], 1, 'normal')
    else:
        features, _ = model.generate_synthetic_data(device['type'], 1, attack_mode)
        
    device['traffic'] = {
        'packets_per_sec': int(features[0, 0]),
        'data_mb_per_sec': round(features[0, 1], 2),
        'target_ips': [f'ip_{i}' for i in range(int(features[0, 2]))]
    }
    
    # Record data during learning phase
    if simulation_state['phase'] == 'learning' and 'learning_data' in simulation_state:
        if device_id in simulation_state['learning_data']:
            simulation_state['learning_data'][device_id]['packets'].append(features[0, 0])
            simulation_state['learning_data'][device_id]['data'].append(features[0, 1])

def check_for_anomalies(ml_model, scaler, detection_threshold):
    """
    Iterates through devices, checks for anomalies using the ML model,
    and updates the 'attack_analysis' state if an attack is detected.
    """
    if simulation_state['phase'] != 'testing':
        simulation_state['attack_analysis'] = None
        return
        
    # Reset analysis at the start of each check
    simulation_state['attack_analysis'] = None

    for device_id, device in simulation_state['devices'].items():
        if not device['traffic']: continue
        
        # Ensure traffic values are valid before creating numpy array
        try:
            packets = int(device['traffic']['packets_per_sec'])
            data = float(device['traffic']['data_mb_per_sec'])
            ips = len(device['traffic']['target_ips'])
            dev_type = config.device_type_mapping[device['type']]
        except (KeyError, TypeError, ValueError) as e:
            print(f"Warning: Incomplete traffic data for {device_id}. Skipping anomaly check. Error: {e}")
            continue # Skip this device if traffic data is bad

        features = np.array([[packets, data, ips, dev_type]])
        
        # Call new model function
        attack_probability, attack_type = model.get_attack_prediction(ml_model, scaler, features)
        
        # "Three strikes" rule
        if attack_probability > 50:
            device['strikes'] = device.get('strikes', 0) + 1
        else:
            device['strikes'] = 0 # Reset on normal traffic

        # If threshold is met, trigger the detection
        if device.get('strikes', 0) >= detection_threshold:
            device['status'] = 'detected'
            baseline = simulation_state['learned_baselines'].get(device_id, {'packets_avg': 'N/A', 'data_avg': 'N/A'})
            
            simulation_state['attack_analysis'] = {
                'device_id': device_id,
                'device_type': device['type'],
                'probability': f"{attack_probability:.1f}",
                'attack_type': attack_type, # <-- ADDED
                'learned_baseline': baseline,
                'current_traffic': device['traffic']
            }
            return # Stop after the first confirmed detection
        
        # If in manual mode, ALWAYS show the AI panel
        if device.get('attack_mode') == 'manual':
             baseline = simulation_state['learned_baselines'].get(device_id, {'packets_avg': 'N/A', 'data_avg': 'N/A'})
             simulation_state['attack_analysis'] = {
                'device_id': device_id,
                'device_type': device['type'],
                'probability': f"{attack_probability:.1f}",
                'attack_type': attack_type, # <-- ADDED
                'learned_baseline': baseline,
                'current_traffic': device['traffic']
            }


# --- STATE MODIFICATION FUNCTIONS ---
# (No changes to update_learning_phase, update_all_device_statuses, add_new_device)

def update_learning_phase(learning_duration):
    """Checks and updates the simulation phase from 'learning' to 'testing'."""
    global learning_phase_start_time
    
    if any(simulation_state['devices']) and learning_phase_start_time == 0:
        learning_phase_start_time = time.time()
        simulation_state['learning_data'] = {id: {'packets': [], 'data': []} for id in simulation_state['devices']}
        
    if simulation_state['phase'] == 'learning' and learning_phase_start_time > 0:
        elapsed = time.time() - learning_phase_start_time
        simulation_state['learning_progress'] = min(100, (elapsed / learning_duration) * 100)
        
        if elapsed > learning_duration:
            simulation_state['phase'] = 'testing'
            simulation_state['learned_baselines'] = {}
            # Calculate and store baselines
            for id, data in simulation_state['learning_data'].items():
                if data.get('packets'): # More robust check
                    simulation_state['learned_baselines'][id] = {
                        'packets_avg': f"{np.mean(data['packets']):.1f}",
                        'data_avg': f"{np.mean(data['data']):.2f}",
                    }
            if 'learning_data' in simulation_state:
                del simulation_state['learning_data']

def update_all_device_statuses():
    """Updates the 'status' string for each device based on its state."""
    if simulation_state['phase'] != 'testing':
        return

    for device_id, device in simulation_state['devices'].items():
        if device['status'] == 'detected':
            continue
        
        if 'attack_mode' in device:
            device['status'] = 'attacking'
        elif device_id == simulation_state['compromised_device']:
            device['status'] = 'compromised'
        else:
            device['status'] = 'normal'

def add_new_device(device_type):
    """Adds a new device to the simulation state."""
    global next_ip
    device_id = f"dev_{int(time.time() * 1000)}"
    simulation_state['devices'][device_id] = {
        'id': device_id,
        'ip': f'192.168.1.{next_ip}',
        'type': device_type,
        'status': 'normal',
        'traffic': {},
        'strikes': 0
    }
    next_ip += 1
    
    # If we're still in learning phase, add it to the learning data dict
    if simulation_state['phase'] == 'learning' and 'learning_data' in simulation_state:
        simulation_state['learning_data'][device_id] = {'packets': [], 'data': []}
        
    return device_id

def set_compromise(device_id):
    """Sets the new compromised device, and resets the old one."""
    old_compromised_id = simulation_state.get('compromised_device')
    if old_compromised_id and old_compromised_id in simulation_state['devices']:
        # Clear attack mode from old device
        simulation_state['devices'][old_compromised_id].pop('attack_mode', None)
        simulation_state['devices'][old_compromised_id]['status'] = 'normal'

    simulation_state['compromised_device'] = device_id
    if device_id in simulation_state['devices']:
        # Clear any existing attack mode from the newly compromised device
        simulation_state['devices'][device_id].pop('attack_mode', None)
        simulation_state['devices'][device_id]['status'] = 'compromised'

def control_sim_action(action, attack_type=None):
    """Handles 'start_attack' and 'full_reset' actions."""
    global next_ip, learning_phase_start_time
    
    if action == 'start_attack':
        if simulation_state['compromised_device']:
            device_id = simulation_state['compromised_device']
            if device_id in simulation_state['devices']:
                simulation_state['devices'][device_id]['attack_mode'] = attack_type
    
    elif action == 'full_reset':
        simulation_state['devices'] = {}
        simulation_state['compromised_device'] = None
        simulation_state['phase'] = 'learning'
        simulation_state['learning_progress'] = 0
        simulation_state['attack_analysis'] = None
        simulation_state['learned_baselines'] = {}
        next_ip = 10
        learning_phase_start_time = 0

# --- MODIFIED: Manual Attack Function ---
def set_manual_attack(device_id, packets, data):
    """Sets a device's traffic to specific values from the UI sliders."""
    if device_id and device_id in simulation_state['devices']:
        device = simulation_state['devices'][device_id]
        device['attack_mode'] = 'manual'
        
        try:
            packets = int(packets)
            data = float(data)
        except ValueError:
            print(f"Error: Invalid manual attack data. Packets: {packets}, Data: {data}")
            return

        # --- THIS BLOCK IS THE SECOND MAIN FIX ---
        # Infer target_ips based on slider values to match the NEW training data.
        
        target_ip_count = 1 # Default (like normal, exfil, or ddos)
        
        # A Port Scan is trained on 20-50 packets.
        # We'll give it a slightly wider range for the demo.
        if 20 < packets <= 100:
            target_ip_count = 15 # This is a Port Scan
        
        # A DDoS is trained on > 5000 packets.
        # We don't need to force the data value anymore, because
        # the new model expects LOW data for a DDoS.
        
        # -------------------------------------------
        
        device['traffic'] = {
            'packets_per_sec': packets,
            'data_mb_per_sec': data,
            'target_ips': [f'ip_{i}' for i in range(target_ip_count)]
        }
        # Set status to attacking so it pulses red
        device['status'] = 'attacking'
        # Reset strikes to allow for real-time detection
        device['strikes'] = 0