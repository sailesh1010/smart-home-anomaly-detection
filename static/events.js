// --- NEW: Non-linear Slider Scaling Functions ---

/**
 * Converts a linear 0-100 slider value to a non-linear packet count.
 * This gives fine control at the low end and scales fast at the high end.
 * (sliderVal / 100)^3 * 10000
 * @param {number} v - Slider value 0-100
 * @returns {number} - Mapped packet count (0-10000)
 */
function scalePackets(v) {
    // Use a power of 3 for heavy skew towards the low end
    const fraction = v / 100;
    const packets = Math.floor(Math.pow(fraction, 3) * 10000);
    return packets;
}

/**
 * Converts a linear 0-100 slider value to a non-linear data rate.
 * (sliderVal / 100)^2 * 30
 * @param {number} v - Slider value 0-100
 * @returns {number} - Mapped data rate (0.0 - 30.0)
 */
function scaleData(v) {
    // Use a power of 2 for a moderate skew
    const fraction = v / 100;
    const data = Math.pow(fraction, 2) * 30;
    // Round to 1 decimal place for the display
    return data.toFixed(1);
}

/**
 * Initializes all user-facing event listeners.
 * @param {object} elements - A collection of DOM elements.
 * @param {object} appState - The main application state.
 * @param {object} api - The API module (for making server calls).
 *WELCOME
 * @param {Function} onDeviceSelect - Callback function for when a device is clicked.
 */
export function initializeEventListeners(elements, appState, api, onDeviceSelect) {

    // --- Drag & Drop Listeners ---
    elements.paletteDevices.forEach(device => {
        device.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', e.target.dataset.type));
    });

    elements.networkContainer.addEventListener('dragover', (e) => e.preventDefault());

    elements.networkContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        const deviceType = e.dataTransfer.getData('text/plain');
        await api.addDevice(deviceType);
    });
    
    // --- Device Selection Listener ---
    elements.networkContainer.addEventListener('click', (e) => {
        const clickedNode = e.target.closest('.network-node:not(#gateway)');
        if (clickedNode) {
            onDeviceSelect(clickedNode.id);
        }
    });

    // --- Control Panel Listeners ---
    elements.compromiseBtn.addEventListener('click', () => {
        api.compromiseDevice(appState.selectedDeviceId);
    });

    elements.launchAttackBtn.addEventListener('click', () => {
        const attackType = elements.attackSelect.value;
        api.controlSimulation('start_attack', { attack_type: attackType });
    });

    elements.resetBtn.addEventListener('click', () => {
        api.controlSimulation('full_reset');
    });

    // --- MODIFIED: Manual Attack Slider Listeners ---

    let debounceTimer;
    /**
     * Debounces the manual attack API call to prevent flooding the server
     * while the user is dragging the slider.
     */
    function debouncedManualAttack(deviceId, packets, data) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            // Check if a device is still compromised before sending
            if (appState.compromisedDeviceId) { 
                 api.manualAttack(appState.compromisedDeviceId, packets, data);
            }
        }, 250); // 250ms delay after user stops moving slider
    }

    elements.packetsSlider.addEventListener('input', (e) => {
        const sliderValue = e.target.value;
        // Map linear slider value to non-linear packet count
        const packets = scalePackets(sliderValue); 
        // Get the *other* slider's mapped value
        const data = scaleData(elements.dataSlider.value); 
        
        elements.packetsValue.textContent = packets; // Update label in real-time
        debouncedManualAttack(appState.compromisedDeviceId, packets, data);
    });

    elements.dataSlider.addEventListener('input', (e) => {
        const sliderValue = e.target.value;
        // Get the *other* slider's mapped value
        const packets = scalePackets(elements.packetsSlider.value); 
        // Map linear slider value to non-linear data rate
        const data = scaleData(sliderValue); 
        
        elements.dataValue.textContent = data; // Update label in real-time
        debouncedManualAttack(appState.compromisedDeviceId, packets, data);
    });
}