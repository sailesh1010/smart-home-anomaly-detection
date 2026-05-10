// --- Reverse Slider Scaling Functions ---

/**
 * Converts a real packet count back to a 0-100 slider value.
 * This is the inverse of scalePackets.
 * sliderVal = 100 * (packets / 10000)^(1/3)
 * @param {number} packets - Actual packet count
 * @returns {number} - Slider value (0-100)
 */
function unscalePackets(packets) {
    const fraction = Math.max(0, packets / 10000);
    const sliderVal = Math.floor(100 * Math.cbrt(fraction));
    return sliderVal;
}

/**
 * Converts a real data rate back to a 0-100 slider value.
 * This is the inverse of scaleData.
 * sliderVal = 100 * (data / 30)^(1/2)
 * @param {number} data - Actual data rate
 * @returns {number} - Slider value (0-100)
 */
function unscaleData(data) {
    const fraction = Math.max(0, data / 30);
    const sliderVal = Math.floor(100 * Math.sqrt(fraction));
    return sliderVal;
}


/**
 * Main function to update the entire UI based on the server state.
 * @param {object} state - The full state object from the server.
 * @param {object} elements - A collection of DOM elements.
 * @param {string} selectedDeviceId - The ID of the currently selected device.
 */
export function updateUI(state, elements, selectedDeviceId) {
    const { 
        networkContainer, gateway, svg, phaseIndicator, learningProgressBar, 
        launchAttackBtn, attackSelect, aiPanel, manualAttackPanel,
        packetsSlider, packetsValue, dataSlider, dataValue
    } = elements;
    
    const { devices, compromised_device, phase } = state;

    // Remove old device elements (but keep gateway)
    networkContainer.querySelectorAll('.network-node:not(#gateway)').forEach(node => node.remove());

    // Calculate positions
    const positions = calculateDevicePositions(Object.values(devices), gateway, networkContainer);

    // Create DOM elements for each device
    const deviceElements = {};
    positions.forEach(pos => {
        const device = devices[pos.id];
        const deviceDiv = document.createElement('div');
        deviceDiv.className = 'network-node ' + device.status;
        deviceDiv.id = device.id;
        deviceDiv.style.left = `${pos.x}px`;
        deviceDiv.style.top = `${pos.y}px`;
        
        let trafficInfo = 'Idle';
        if (device.traffic && typeof device.traffic.packets_per_sec !== 'undefined') { // Check property exists
            trafficInfo = `Packets: ${device.traffic.packets_per_sec}/s<br>Data: ${device.traffic.data_mb_per_sec} MB/s`;
        }
        deviceDiv.innerHTML = `<h3>${device.type}</h3><p><strong>IP:</strong> ${device.ip}</p><p>${trafficInfo}</p>`;
        networkContainer.appendChild(deviceDiv);
        deviceElements[device.id] = deviceDiv;
    });

    // Center the gateway
    gateway.style.left = `${(networkContainer.offsetWidth / 2) - (gateway.offsetWidth / 2)}px`;
    gateway.style.top = `${(networkContainer.offsetHeight / 2) - (gateway.offsetHeight / 2)}px`;

    // Draw wires/lines
    requestAnimationFrame(() => {
        drawConnections(gateway, deviceElements, svg, networkContainer);
    });
    
    // Update selection visuals
    updateSelectionVisuals(selectedDeviceId, phase, compromised_device, elements.compromiseBtn);

    // Update phase indicator
    const phaseTitle = phaseIndicator.querySelector('h2');
    const phaseDescription = phaseIndicator.querySelector('p');
    if (phase === 'learning') {
        phaseIndicator.style.display = 'block';
        phaseTitle.textContent = 'Learning Phase';
        phaseDescription.textContent = 'Establishing normal behavior baselines...';
        learningProgressBar.style.width = `${state.learning_progress}%`;
    } else {
        phaseTitle.textContent = 'Testing Phase';
        phaseDescription.textContent = 'Network monitored. Select a device to compromise and launch an attack.';
        learningProgressBar.style.width = '100%';
    }

    // Update control panel buttons
    launchAttackBtn.disabled = !compromised_device;
    attackSelect.disabled = !compromised_device;

    // Update Manual Attack Panel
    if (compromised_device && devices[compromised_device]) {
        manualAttackPanel.style.display = 'block';
        const device = devices[compromised_device];
        
        if (device.attack_mode !== 'manual') {
            const currentTraffic = device.traffic || {};
            const packets = currentTraffic.packets_per_sec || 0;
            const data = currentTraffic.data_mb_per_sec || 0;

            packetsSlider.value = unscalePackets(packets);
            packetsValue.textContent = packets;
            dataSlider.value = unscaleData(data);
            dataValue.textContent = data.toFixed(1);
        }
    } else {
        manualAttackPanel.style.display = 'none';
    }
    
    // Update AI panel
    if (state.attack_analysis) {
        aiPanel.classList.add('visible');
        populateAiPanel(state.attack_analysis, elements.analysisContent);
    } else {
        aiPanel.classList.remove('visible');
    }
}

/**
 * Updates the visual selection state of devices and control buttons.
 * @param {string} selectedDeviceId - The ID of the currently selected device.
 * @param {string} currentPhase - The current simulation phase ('learning' or 'testing').
 * @param {string} compromisedDeviceId - The ID of the compromised device.
 * @param {HTMLElement} compromiseBtn - The compromise button element.
 */
export function updateSelectionVisuals(selectedDeviceId, currentPhase, compromisedDeviceId, compromiseBtn) {
    document.querySelectorAll('.network-node').forEach(node => {
        node.classList.toggle('selected', node.id === selectedDeviceId);
    });
    compromiseBtn.disabled = !selectedDeviceId || currentPhase !== 'testing' || compromisedDeviceId === selectedDeviceId;
}

/**
 * --- MODIFIED: Populates the AI analysis panel with data ---
 * Now includes dynamic coloring and the predicted attack type.
 * @param {object} analysis - The attack analysis data.
 * @param {HTMLElement} analysisContent - The container element for AI content.
 */
function populateAiPanel(analysis, analysisContent) {
    const baseline = analysis.learned_baseline;
    const current = analysis.current_traffic;

    // Determine colors based on analysis
    const is_normal = analysis.attack_type === 'Normal';
    const probability_color = analysis.probability > 50 ? 'var(--attack-red)' : '#333';
    const attack_color = is_normal ? 'var(--normal-green)' : 'var(--attack-red)';
    const attack_bg = is_normal ? '#f0f9f4' : '#fcf3f2';

    analysisContent.innerHTML = `
        <div class="analysis-section">
            <h3>Device Under Scrutiny: ${analysis.device_type}</h3>
            
            <div class="probability">
                <div class="label">ANOMALY PROBABILITY</div>
                <div class="value" style="color: ${probability_color};">${analysis.probability}%</div>
            </div>
            
            <div class="attack-type-display">
                <div class="label">PREDICTED BEHAVIOR TYPE</div>
                <div class="value" style="color: ${attack_color}; background-color: ${attack_bg};">
                    ${analysis.attack_type}
                </div>
            </div>
        </div>
        <div class="analysis-section">
            <h3>Learned Baseline (Normal)</h3>
            <div class="metric"><span class="label">Avg. Packets/sec:</span><span class="value">${baseline.packets_avg}</span></div>
            <div class="metric"><span class="label">Avg. Data/sec (MB):</span><span class="value">${baseline.data_avg}</span></div>
        </div>
        <div class="analysis-section">
            <h3>Current Traffic (Anomalous)</h3>
            <div class="metric"><span class="label">Packets/sec:</span><span class="value">${current.packets_per_sec}</span></div>
            <div class="metric"><span class="label">Data/sec (MB):</span><span class="value">${current.data_mb_per_sec}</span></div>
            <div class="metric"><span class="label">Target IPs:</span><span class="value">${current.target_ips.length}</span></div>
        </div>
    `;
}


// --- No changes to layout or drawing functions ---
// calculateDevicePositions() and drawConnections() remain identical.

/**
 * Calculates non-overlapping positions for devices.
 * @param {Array<object>} devices - List of device objects.
 * @param {HTMLElement} gatewayEl - The gateway element.
 * @param {HTMLElement} networkContainer - The main container.
 * @returns {Array<object>} A list of position objects {id, x, y}.
 */
function calculateDevicePositions(devices, gatewayEl, networkContainer) {
    const positions = [];
    if (devices.length === 0) return positions;

    const containerWidth = networkContainer.offsetWidth;
    const containerHeight = networkContainer.offsetHeight;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    const NODE_WIDTH = 140;
    const NODE_HEIGHT = 100;
    const GAP = 50;
    const PADDING = 20;

    const gatewayRect = {
        x: centerX - NODE_WIDTH / 2,
        y: centerY - NODE_HEIGHT / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
    };

    function rectsOverlap(a, b, gap) {
        return !(
            a.x + a.width + gap <= b.x ||
            b.x + b.width + gap <= a.x ||
            a.y + a.height + gap <= b.y ||
            b.y + b.height + gap <= a.y
        );
    }

    let angle = -Math.PI / 2;
    let radius = Math.min(centerX, centerY) * 0.45;
    const ANGLE_INC = 0.45;
    const RADIUS_INC = 50;

    for (const device of devices) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 800) {
            const x = Math.round(centerX + radius * Math.cos(angle) - NODE_WIDTH / 2);
            const y = Math.round(centerY + radius * Math.sin(angle) - NODE_HEIGHT / 2);
            const newRect = { id: device.id, x, y, width: NODE_WIDTH, height: NODE_HEIGHT };

            const outOfBounds = (
                newRect.x < PADDING ||
                newRect.y < PADDING ||
                newRect.x + newRect.width > containerWidth - PADDING ||
                newRect.y + newRect.height > containerHeight - PADDING
            );

            let hasCollision = false;
            if (!outOfBounds) {
                const obstacles = [gatewayRect, ...positions];
                for (const obs of obstacles) {
                    if (rectsOverlap(newRect, obs, GAP)) {
                        hasCollision = true;
                        break;
                    }
                }
            } else {
                hasCollision = true;
            }

            if (!hasCollision) {
                positions.push(newRect);
                placed = true;
            } else {
                angle += ANGLE_INC;
                if (angle > Math.PI * 3.5) {
                    angle = -Math.PI / 2;
                    radius += RADIUS_INC;
                }
            }
            attempts++;
        }

        if (!placed) {
            const fallbackX = PADDING + (positions.length * (NODE_WIDTH + GAP)) % (containerWidth - NODE_WIDTH - PADDING);
            const fallbackY = PADDING + Math.floor((positions.length * (NODE_WIDTH + GAP)) / (containerWidth - NODE_WIDTH)) * (NODE_HEIGHT + GAP);
            positions.push({ id: device.id, x: fallbackX, y: fallbackY, width: NODE_WIDTH, height: NODE_HEIGHT });
        }
    }

    const MAX_ITERS = 200;
    for (let iter = 0; iter < MAX_ITERS; iter++) {
        let moved = false;
        for (let i = 0; i < positions.length; i++) {
            const a = positions[i];
            if (rectsOverlap(a, gatewayRect, GAP)) {
                const dx = (a.x + NODE_WIDTH / 2) - centerX;
                const dy = (a.y + NODE_HEIGHT / 2) - centerY;
                const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                a.x += (dx / dist) * 5;
                a.y += (dy / dist) * 5;
                moved = true;
            }
            for (let j = i + 1; j < positions.length; j++) {
                const b = positions[j];
                if (rectsOverlap(a, b, GAP)) {
                    const dx = (b.x + NODE_WIDTH / 2) - (a.x + NODE_WIDTH / 2);
                    const dy = (b.y + NODE_HEIGHT / 2) - (a.y + NODE_HEIGHT / 2);
                    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                    const push = (GAP - (dist - NODE_WIDTH)) / 2;
                    const offsetX = (dx / dist) * push;
                    const offsetY = (dy / dist) * push;
                    a.x -= offsetX;
                    a.y -= offsetY;
                    b.x += offsetX;
                    b.y += offsetY;
                    moved = true;
                }
            }
        }
        if (!moved) break;
    }

    positions.forEach(pos => {
        pos.x = Math.min(Math.max(pos.x, PADDING), containerWidth - NODE_WIDTH - PADDING);
        pos.y = Math.min(Math.max(pos.y, PADDING), containerHeight - NODE_HEIGHT - PADDING);
    });

    return positions;
}

/**
 * Draws SVG lines from the gateway to each device.
 * @param {HTMLElement} gatewayNode - The gateway element.
 * @param {object} deviceElements - A map of deviceId -> deviceElement.
 * @param {HTMLElement} svg - The SVG container.
 * @param {HTMLElement} networkContainer - The main container.
 */
function drawConnections(gatewayNode, deviceElements, svg, networkContainer) {
    svg.innerHTML = '';
    if (!gatewayNode || Object.keys(deviceElements).length === 0) return;

    const containerRect = networkContainer.getBoundingClientRect();
    const gatewayRect = gatewayNode.getBoundingClientRect();

    const gatewayX = gatewayRect.left - containerRect.left + gatewayRect.width / 2;
    const gatewayY = gatewayRect.top - containerRect.top + gatewayRect.height / 2;

    svg.setAttribute('width', networkContainer.offsetWidth);
    svg.setAttribute('height', networkContainer.offsetHeight);

    Object.values(deviceElements).forEach(node => {
        const nodeRect = node.getBoundingClientRect();
        if (nodeRect.width === 0 && nodeRect.height === 0) return;

        const nodeX = nodeRect.left - containerRect.left + nodeRect.width / 2;
        const nodeY = nodeRect.top - containerRect.top + nodeRect.height / 2;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', gatewayX); line.setAttribute('y1', gatewayY);
        line.setAttribute('x2', nodeX); line.setAttribute('y2', nodeY);
        line.setAttribute('stroke', '#aaa'); line.setAttribute('stroke-width', '2');
        svg.appendChild(line);

        const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circ.setAttribute('cx', nodeX); circ.setAttribute('cy', nodeY);
        circ.setAttribute('r', '3'); circ.setAttribute('fill', '#888');
        svg.appendChild(circ);
    });
}