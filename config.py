# --- SIMULATION CONFIGURATION ---
NUM_SAMPLES_PER_CLASS = 2000
LEARNING_PHASE_DURATION = 20  # seconds
DETECTION_THRESHOLD = 3 # Number of consecutive anomalies to trigger detection

# --- DEVICE PROFILES ---
# Defines the 'normal' behavior for each device type.
# Format: { 'packets_per_sec': (mean, std_dev), 'data_mb_per_sec': (mean, std_dev), 'target_ips': [list]}
device_profiles = {
    'Smart Camera': {'packets_per_sec': (100, 10), 'data_mb_per_sec': (4, 0.5), 'target_ips': ['203.0.113.15']},
    'Thermostat': {'packets_per_sec': (1, 1), 'data_mb_per_sec': (0.01, 0.005), 'target_ips': ['203.0.113.16']},
    'Smart Plug': {'packets_per_sec': (1, 1), 'data_mb_per_sec': (0.01, 0.005), 'target_ips': ['203.0.113.17']},
    'Smart Lock': {'packets_per_sec': (2, 1), 'data_mb_per_sec': (0.02, 0.01), 'target_ips': ['203.0.113.18']},
    'Smart Lightbulb': {'packets_per_sec': (1, 1), 'data_mb_per_sec': (0.01, 0.005), 'target_ips': ['203.0.113.19']},
    'Smart Speaker': {'packets_per_sec': (5, 2), 'data_mb_per_sec': (0.1, 0.05), 'target_ips': ['203.0.113.20']}
}

# --- ENCODING MAPPING ---
# Used to convert device type names into numbers for the ML model.
device_type_mapping = {name: i for i, name in enumerate(device_profiles.keys())}