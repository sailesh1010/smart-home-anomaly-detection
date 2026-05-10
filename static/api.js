/**
 * Fetches the current simulation state from the server.
 * @returns {Promise<object>} The server state.
 */
export async function fetchStatus() {
    const response = await fetch('/api/status');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

/**
 * Sends a request to add a new device.
 * @param {string} deviceType - The type of device to add.
 */
export async function addDevice(deviceType) {
    try {
        await fetch('/api/add_device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: deviceType })
        });
    } catch (error) {
        console.error('Error adding device:', error);
    }
}

/**
 * Sends a request to compromise a device.
 * @param {string} deviceId - The ID of the device to compromise.
 */
export async function compromiseDevice(deviceId) {
    if (!deviceId) return;
    try {
        await fetch('/api/compromise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: deviceId })
        });
    } catch (error) {
        console.error('Error compromising device:', error);
    }
}

/**
 * Sends a control action to the simulation (e.g., start attack, reset).
 * @param {string} action - The action to perform.
 * @param {object} [payload={}] - Additional data, like attack_type.
 */
export async function controlSimulation(action, payload = {}) {
    try {
        await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload })
        });
    } catch (error) {
        console.error(`Error sending control action '${action}':`, error);
    }
}

/**
 * NEW: Sends manual attack data from sliders to the server.
 * @param {string} deviceId - The ID of the compromised device.
 * @param {string|number} packets - The packets/sec value from the slider.
 * @param {string|number} data - The data MB/sec value from the slider.
 */
export async function manualAttack(deviceId, packets, data) {
    try {
        await fetch('/api/manual_attack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: deviceId, packets: packets, data: data })
        });
    } catch (error) {
        console.error('Error sending manual attack:', error);
    }
}