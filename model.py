import os
import numpy as np
import joblib
import csv
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import config # Import device profiles and config

# Module-level globals to hold the loaded model and scaler
model = None
scaler = None

# Defines the mapping from the model's output index to a string name
ATTACK_TYPE_MAP = {
    0: "Normal",
    1: "DDoS (UDP Flood)",
    2: "Internal Port Scan",
    3: "Data Exfiltration"
}

def generate_synthetic_data(device_type_name, num_samples, attack_type='normal'):
    """Generates synthetic training data for a given device and attack type."""
    profile = config.device_profiles[device_type_name]
    device_type_encoded = config.device_type_mapping[device_type_name]
    
    if attack_type == 'normal':
        packets = np.random.normal(profile['packets_per_sec'][0], profile['packets_per_sec'][1], num_samples)
        data = np.random.normal(profile['data_mb_per_sec'][0], profile['data_mb_per_sec'][1], num_samples)
        ips = np.ones(num_samples)
    
    # --- THIS BLOCK IS THE MAIN FIX ---
    elif attack_type == 'ddos':
        packets = np.random.uniform(5000, 10000, num_samples)
        # A DDoS (like a UDP flood) is high-packet, but not high-data *per packet*.
        # The old model was trained to expect high data (20-30), which was wrong.
        # This new, correct data range will match your slider.
        data = np.random.uniform(0.1, 0.5, num_samples) 
        ips = np.ones(num_samples)
    # -----------------------------------

    elif attack_type == 'scan':
        # Port scans are low-and-fast, not high-volume
        packets = np.random.uniform(20, 50, num_samples) 
        data = np.random.uniform(0.1, 0.2, num_samples)
        ips = np.random.randint(5, 20, num_samples)
    
    elif attack_type == 'exfiltrate':
        # Data exfiltration is low-and-slow, but high-data
        packets = np.random.uniform(5, 10, num_samples)
        data = np.random.uniform(0.5, 1.5, num_samples)
        ips = np.ones(num_samples)

    features = np.vstack([
        np.abs(packets), 
        np.abs(data), 
        ips, 
        np.full(num_samples, device_type_encoded)
    ]).T
    
    labels = np.full(num_samples, {'normal': 0, 'ddos': 1, 'scan': 2, 'exfiltrate': 3}[attack_type])
    return features, labels

def train_and_save_model():
    """Trains a new model and saves it to disk."""
    print("🤖 No pre-trained model found. Training a new model...")
    X_all, y_all = [], []
    attack_types = ['normal', 'ddos', 'scan', 'exfiltrate']
    
    for device_type in config.device_profiles:
        for attack in attack_types:
            # We must use the *new* generate_synthetic_data function
            features, labels = generate_synthetic_data(device_type, config.NUM_SAMPLES_PER_CLASS, attack)
            X_all.append(features)
            y_all.append(labels)
            
    X = np.vstack(X_all)
    y = np.hstack(y_all)
    
    try:
        header = ['packets_per_sec', 'data_mb_per_sec', 'target_ip_count', 'device_type_encoded', 'attack_type']
        data_to_save = np.column_stack((X, y))
        with open('training_dataset.csv', 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(header)
            writer.writerows(data_to_save)
        print("✅ Training dataset saved to training_dataset.csv")
    except Exception as e:
        print(f"❌ Error saving dataset: {e}")
    
    X_train, _, y_train, _ = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)

    model = MLPClassifier(hidden_layer_sizes=(50,), max_iter=500, activation='relu', solver='adam', random_state=1)
    model.fit(X_train_scaled, y_train)

    joblib.dump(model, 'model.joblib')
    joblib.dump(scaler, 'scaler.joblib')
    print("✅ Model and scaler trained and saved to disk.")
    return model, scaler

def load_model():
    """Loads the model and scaler from disk, or trains them if not found."""
    if os.path.exists('model.joblib') and os.path.exists('scaler.joblib'):
        print("✅ Pre-trained model and scaler found. Loading from disk.")
        model = joblib.load('model.joblib')
        scaler = joblib.load('scaler.joblib')
        return model, scaler
    else:
        return train_and_save_model()

def get_attack_prediction(model, scaler, features):
    """
    Given a model, scaler, and features, returns the
    probability of an anomaly (as a percentage) AND the
    name of the most likely attack type.
    
    Returns:
        (float) attack_probability: The chance (0-100) of it NOT being normal.
        (str) attack_type: The name of the most likely class (e.g., "Normal", "DDoS").
    """
    features_scaled = scaler.transform(features)
    prediction_proba = model.predict_proba(features_scaled)[0]
    
    # Probability of NOT being 'normal' (class 0)
    attack_probability = (1 - prediction_proba[0]) * 100
    
    # Find the index of the highest probability class
    predicted_class_index = np.argmax(prediction_proba)
    
    # Map that index to its name
    attack_type = ATTACK_TYPE_MAP.get(predicted_class_index, "Unknown")
    
    return attack_probability, attack_type