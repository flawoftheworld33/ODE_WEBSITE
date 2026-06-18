// ==========================================
// 1. LOGIN CONTROLLER (Runs on index.html)
// ==========================================
function checkLogin(event) {
    event.preventDefault(); // Stop page reload

    var typedUsername = document.getElementById("username").value;
    var typedPassword = document.getElementById("password").value;
    var errorMsg = document.getElementById("login-error-msg");

    var correctUsername = "prof@pup.edu.ph";
    var correctPassword = "7years";

    if (typedUsername === correctUsername && typedPassword === correctPassword) {
        if (errorMsg) errorMsg.style.display = "none"; 
        
        // Redirect perfectly from index.html to dashboard.html
        window.location.href = "dashboard.html";
    } else {
        if (errorMsg) {
            errorMsg.style.display = "block";
            errorMsg.style.color = "red";
            errorMsg.innerText = "Invalid credentials. Please try again.";
        }
    }
}



// ==========================================
// 2. DASHBOARD CONTROLLER (Runs on dashboard.html)
// ==========================================
const cameraIP = "http://192.168.100.31"; 

// ==========================================
// 4. MANUAL DOWNLOAD CONTROLLER
// ==========================================
function downloadCurrentPhoto() {
    const img = document.getElementById('details-camera-frame');
    
    // Safety check to ensure there's actually an image loaded
    if (!img || img.style.display === "none" || !img.src) {
        alert("No photo available to download yet.");
        return;
    }

    // Fetch the image data to bypass the browser's default behavior 
    // of just opening the image in a new tab, forcing a file download instead.
    fetch(img.src)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Create a clean filename using the current date and time
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `Hardware_Violation_Snapshot_${timestamp}.jpg`;
            
            document.body.appendChild(a);
            a.click(); // Simulate a user clicking the link
            
            // Cleanup memory
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(err => {
            console.error("Download failed:", err);
            alert("Failed to download the photo. Make sure the ESP32 is connected.");
        });
}

// --- STATE INITIALIZATION WITH PERSISTENCE EXTRACTION ---
let totalCamCount   = parseInt(localStorage.getItem('dashTotalCam')) || 0;
let totalSoundCount = parseInt(localStorage.getItem('dashTotalSound')) || 0;
let totalTiltCount  = parseInt(localStorage.getItem('dashTotalTilt')) || 0;
let savedLogsArray  = JSON.parse(localStorage.getItem('dashLogsHistory')) || [];

// Session Uptime Tracking
let savedStartTime = localStorage.getItem('dashStartTime');
if (!savedStartTime) {
    savedStartTime = Date.now();
    localStorage.setItem('dashStartTime', savedStartTime);
}
const startTime = parseInt(savedStartTime);

let lastProcessedTimeString = "";
let lastEventTimeCache = ""; 

// DOM Elements
const cameraFrame     = document.getElementById('camera-frame');
const placeholderText = document.getElementById('placeholder-text');
const tableBody       = document.getElementById('log-table-body');
const emptyState      = document.querySelector('.empty-state');

// Metric Cards
const runTimeCard     = document.getElementById('total-runtime');
const camCard         = document.getElementById('cam-total');
const soundCard       = document.getElementById('sound-total');
const tiltCard        = document.getElementById('tilt-total');

// Side Alert Panel Cards
const latestTitle     = document.getElementById('latest-title');
const latestDate      = document.getElementById('latest-date');
const latestSound     = document.getElementById('latest-sound');
const latestTilt      = document.getElementById('latest-tilt');
const latestStatus    = document.getElementById('latest-status');

// =========================================================================
// RUN ON BOOT: RESTORE DASHBOARD SYSTEM VISUALS
// =========================================================================
// =========================================================================
// RUN ON BOOT: RESTORE DASHBOARD SYSTEM VISUALS
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Target UI nodes
    const txtTime           = document.getElementById('dt-time');
    const txtSound          = document.getElementById('dt-sound');
    const txtTilt           = document.getElementById('dt-tilt');
    const txtStatus         = document.getElementById('dt-status');
    const txtInterpretation = document.getElementById('dt-interpretation');
    
    // Target Media nodes (Matches your capture details page IDs perfectly)
    const imgFrame          = document.getElementById('details-camera-frame');
    const placeholder       = document.getElementById('preview-placeholder');

    // 2. Fetch data out of shared localStorage cache registers
    const cachedTime       = localStorage.getItem('lastCaptureTime') || "No active events logged";
    const cachedTiltState  = localStorage.getItem('lastCaptureTiltActive') === 'true';
    const cachedSoundState = localStorage.getItem('lastCaptureSoundActive') === 'true';

    // 3. Output Text Displays
    if (txtTime) txtTime.innerText = cachedTime;

    if (txtSound) {
        if (cachedSoundState) {
            txtSound.innerText = "Sound Detected";
            txtSound.className = "yellow-text"; 
        } else {
            txtSound.innerText = "Normal";
            txtSound.className = "green-text";
        }
    }

    if (txtTilt) {
        if (cachedTiltState) {
            txtTilt.innerText = "Tilt Detected";
            txtTilt.className = "red-text";
        } else {
            txtTilt.innerText = "Stable";
            txtTilt.className = "green-text";
        }
    }

    if (txtStatus && txtInterpretation) {
        if (cachedTiltState && cachedSoundState) {
            txtStatus.innerHTML = "Flagged";
            txtStatus.className = "red-text";
            txtInterpretation.innerText = "This event was flagged because sound activity and unusual head movement were detected simultaneously during the monitoring session.";
        } else if (cachedTiltState) {
            txtStatus.innerHTML = "Flagged";
            txtStatus.className = "red-text";
            txtInterpretation.innerText = "This event was flagged strictly due to unexpected head movement anomalies detected by the tilt-sensor arrays.";
        } else if (cachedSoundState) {
            txtStatus.innerHTML = "Flagged";
            txtStatus.className = "red-text";
            txtInterpretation.innerText = "This event was flagged due to continuous audio noise spike limits being exceeded in the local testing perimeter.";
        } else {
            txtStatus.innerHTML = "Clear";
            txtStatus.className = "green-text";
            txtInterpretation.innerText = "No violations detected. The monitoring gear is reporting a fully stable testing configuration.";
        }
    }

    // 4. FIX: Render latest frame image if a sensor violation exists
    // (This block checks if the code is running on capture-details.html)
    // 4. Render latest frame image if a sensor violation exists
    if (imgFrame) {
        if (cachedTiltState || cachedSoundState) {
            // Set up an image preloader in the background
            const tempImg = new Image();
            
            tempImg.onload = function() {
                // ONLY hide placeholder and show image if the resource actually loads (Not a 404)
                if (placeholder) placeholder.style.display = "none";
                imgFrame.style.display = "block";
                imgFrame.src = this.src; 
                
                // NEW: Show the download button on boot if an image exists
                const downloadBtn = document.getElementById('download-btn');
                if (downloadBtn) downloadBtn.style.display = "block";
            };

            tempImg.onerror = function() {
                // If it returns a 404, keep the placeholder text but update it
                if (placeholder) {
                    placeholder.style.display = "block";
                    placeholder.innerHTML = "<span>▧</span><p>Waiting for first sensor trigger snapshot...</p>";
                }
                imgFrame.style.display = "none";
            };

            // Fire the request
            tempImg.src = `${cameraIP}/get-photo?cb=${Date.now()}`; 
        } else {
            if (placeholder) placeholder.style.display = "block";
            imgFrame.style.display = "none";
        }
    
    }

    // ... Keep the rest of your counter and logging tables logic down below ...

    // 5. Restore counters
    if (camCard) camCard.innerText = totalCamCount;
    if (soundCard) soundCard.innerText = totalSoundCount;
    if (tiltCard) tiltCard.innerText = totalTiltCount;

    // 6. Re-populate the HTML log table using history cache
    if (savedLogsArray.length > 0) {
        if (emptyState) emptyState.style.display = "none";
        
        savedLogsArray.forEach(logItem => {
            renderRowToTable(logItem.timestamp, logItem.sensorName);
        });
        
        const mostRecent = savedLogsArray[savedLogsArray.length - 1];
        updateSideAlertPanel(mostRecent.timestamp, mostRecent.sensorName);
    }

    // Set up initial placeholder configurations
    if (placeholderText) placeholderText.style.display = "block";
    if (cameraFrame) cameraFrame.style.display = "none";

    // Start background loops inside setup scope
    setInterval(pollCameraStatus, 1000);
    setInterval(updateTrackingUptime, 30000);
    updateTrackingUptime();
}); // <--- All DOM setup tasks are cleanly grouped together here

// ==========================================
// 3. CORE CORE LOGIC HELPERS
// ==========================================

/** Calculates active tracking uptime */
function updateTrackingUptime() {
    if (!runTimeCard) return; 
    const delta = Date.now() - startTime;
    const hours = Math.floor(delta / 3600000);
    const mins  = Math.floor((delta % 3600000) / 60000);
    runTimeCard.innerText = `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
}

/** Helper to strictly handle HTML DOM appending operations */
function renderRowToTable(timestamp, sensorName) {
    if (!tableBody) return;
    const lowerSensorName = sensorName.toLowerCase();
    const hasTilt  = lowerSensorName.includes("tilt") || lowerSensorName.includes("both");
    const hasSound = lowerSensorName.includes("sound") || lowerSensorName.includes("both");

    const newRow = document.createElement('tr');
    newRow.className = "log-row";
    newRow.innerHTML = `
        <td>${timestamp}</td>
        <td><span class="cyan-text">Photo Captured</span></td>
        <td><span class="${hasSound ? 'yellow-text' : 'green-text'}">${hasSound ? 'Sound Detected' : 'Normal'}</span></td>
        <td><span class="${hasTilt ? 'red-text' : 'green-text'}">${hasTilt ? 'Tilt Detected' : 'Stable'}</span></td>
    `;
    tableBody.insertBefore(newRow, tableBody.firstChild);
}

/** Handles state storage saving operations and updates HTML elements */
function logEventToTable(timestamp, sensorName) {
    savedLogsArray.push({ timestamp: timestamp, sensorName: sensorName });
    localStorage.setItem('dashLogsHistory', JSON.stringify(savedLogsArray));

    if (emptyState) emptyState.style.display = "none";
    renderRowToTable(timestamp, sensorName);
}

/** Helper function to update Side Alert UI indicators and load event picture */
function updateSideAlertPanel(timestamp, sensorStr) {
    const isTiltActive  = sensorStr.toLowerCase().includes("tilt") || sensorStr.toLowerCase().includes("both");
    const isSoundActive = sensorStr.toLowerCase().includes("sound") || sensorStr.toLowerCase().includes("both");

    if (placeholderText) placeholderText.style.display = "none";
    
    if (cameraFrame) {
        cameraFrame.style.display = "block";
        // CRITICAL FIX: Pull the exact snapshot taken during the sensor trigger
        cameraFrame.src = `${cameraIP}/get-photo?cb=${Date.now()}`;
        
        // NEW: Show the download button
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) downloadBtn.style.display = "block";
    }
    

    if (latestTitle) {
        if (isTiltActive && isSoundActive) {
            latestTitle.innerHTML = `<span class="red-text">⚠</span> Multiple Violations Logged`;
        } else if (isTiltActive) {
            latestTitle.innerHTML = `<span class="red-text">⚠</span> Head Tilt Detected`;
        } else {
            latestTitle.innerHTML = `<span class="yellow-text">⌁</span> Audio Event Logged`;
        }
    }
    if (latestTilt) {
        latestTilt.innerHTML = isTiltActive ? `<span class="red-text">⚠</span> Tilt: Detected` : `<span class="green-text">⌁</span> Tilt: Stable`;
    }
    if (latestSound) {
        latestSound.innerHTML = isSoundActive ? `<span class="yellow-text">⌁</span> Sound: Detected` : `<span class="green-text">⌁</span> Sound: Normal`;
    }
    if (latestDate) latestDate.innerText = timestamp;
    if (latestStatus) latestStatus.innerHTML = `<span class="red-text">●</span> Status: Flagged`;
}

/** Network Polling Hook checking hardware state */
function pollCameraStatus() {
    if (!camCard) return; 

    fetch(`${cameraIP}/status`)
        .then(res => res.json())
        .then(data => {
            if (data.time !== "None" && (data.tiltActive === true || data.soundActive === true)) {
                
                const sensorStr = data.sensor ? data.sensor : "";
                const isTiltActive  = data.tiltActive;   
                const isSoundActive = data.soundActive;  

                const options = { year: 'numeric', month: 'short', day: 'numeric' };
                const currentDate = new Date().toLocaleDateString('en-US', options);
                const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false });
                const combinedTimestamp = `${currentDate} — ${currentTime}`;

                // Debounce checking
                if (combinedTimestamp === lastProcessedTimeString && data.time === lastEventTimeCache) {
                    return; 
                }
                lastProcessedTimeString = combinedTimestamp;
                lastEventTimeCache = data.time; 

                console.log(`Alert processed from hardware: ${sensorStr}`);

                // 1. Process and save global capture counter variables
                totalCamCount++;
                camCard.innerText = totalCamCount;
                localStorage.setItem('dashTotalCam', totalCamCount);

                // 2. Process and save individual sensor metrics
                if (isTiltActive) {
                    totalTiltCount++;
                    if (tiltCard) tiltCard.innerText = totalTiltCount;
                    localStorage.setItem('dashTotalTilt', totalTiltCount);
                }
                if (isSoundActive) {
                    totalSoundCount++;
                    if (soundCard) soundCard.innerText = totalSoundCount;
                    localStorage.setItem('dashTotalSound', totalSoundCount);
                }

                // 3. Update Side Panel UI and swap out image container view
                updateSideAlertPanel(combinedTimestamp, sensorStr);

                // 4. Save state capture context variables for Capture Details page use
                localStorage.setItem('lastCaptureTime', combinedTimestamp);
                localStorage.setItem('lastCaptureTiltActive', isTiltActive ? 'true' : 'false');
                localStorage.setItem('lastCaptureSoundActive', isSoundActive ? 'true' : 'false');

                // 5. Append and cache event inside table data log arrays
                logEventToTable(combinedTimestamp, sensorStr);
            }
        })
        .catch(err => {
            // Silently wait for hardware connection recovery
        });
}