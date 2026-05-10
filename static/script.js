// Imports: We import functions from our new, separated modules.
import * as api from './api.js';
import * as ui from './ui.js';
import { initializeEventListeners } from './events.js';

document.addEventListener('DOMContentLoaded', function() {
    
    // --- STATE MANAGEMENT ---
    // This state is managed by the main controller.
    let appState = {
        selectedDeviceId: null,
        compromisedDeviceId: null,
        currentPhase: 'learning',
        lastKnownState: {}, // Store the last complete state from the server
        devices: {}
    };

    // --- ELEMENT REFERENCES ---
    // We gather all DOM elements here to pass to the modules that need them.
    const elements = {
        networkContainer: document.getElementById('network-container'),
        paletteDevices: document.querySelectorAll('.palette-device'),
        svg: document.getElementById('network-svg'),
        gateway: document.getElementById('gateway'),
        aiPanel: document.getElementById('ai-panel'),
        analysisContent: document.getElementById('analysis-content'),
        compromiseBtn: document.getElementById('compromise-btn'),
        attackSelect: document.getElementById('attack-select'),
        launchAttackBtn: document.getElementById('launch-attack-btn'),
        resetBtn: document.getElementById('reset-btn'),
        phaseIndicator: document.getElementById('phase-indicator'),
        learningProgressBar: document.getElementById('learning-progress'),
        
        // NEW: Manual attack elements
        manualAttackPanel: document.getElementById('manual-attack-panel'),
        packetsSlider: document.getElementById('packets-slider'),
        packetsValue: document.getElementById('packets-value'),
        dataSlider: document.getElementById('data-slider'),
        dataValue: document.getElementById('data-value'),
    };

    // --- MAIN APP LOGIC ---

    /**
     * Handles the selection of a device node.
     * @param {string} deviceId - The ID of the clicked device.
     */
    function handleDeviceSelection(deviceId) {
        appState.selectedDeviceId = (appState.selectedDeviceId === deviceId) ? null : deviceId;
        ui.updateSelectionVisuals(appState.selectedDeviceId, appState.currentPhase, appState.compromisedDeviceId, elements.compromiseBtn);
    }

    /**
     * Main status poller. Fetches state from server and updates UI.
     */
    async function fetchAndUpdateStatus() {
        try {
            const state = await api.fetchStatus();
            appState.lastKnownState = state;
            appState.devices = state.devices;
            appState.compromisedDeviceId = state.compromised_device;
            appState.currentPhase = state.phase;
            
            // Pass the full state and elements to the UI module to render
            ui.updateUI(state, elements, appState.selectedDeviceId);

        } catch (error) {
            console.error('Error fetching status:', error);
        }
    }

    // --- INITIALIZATION ---

    // Initialize all event listeners, passing in the app state,
    // API functions, and selection handler.
    initializeEventListeners(elements, appState, api, handleDeviceSelection);

    // Start the main polling loop
    setInterval(fetchAndUpdateStatus, 1500);

    // Set up a resize observer to redraw the UI on container resize
    const resizeObserver = new ResizeObserver(() => {
        if (Object.keys(appState.lastKnownState).length > 0) {
            ui.updateUI(appState.lastKnownState, elements, appState.selectedDeviceId);
        }
    });
    resizeObserver.observe(elements.networkContainer);
});