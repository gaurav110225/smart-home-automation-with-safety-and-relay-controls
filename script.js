let db,
  relays = {},
  timers = {},
  currentEditingTimerId = null,
  isSoundEnabled = true;

const sounds = {
  toggle: new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"),
  alert: new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"),
  success: new Audio("https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3"),
};
const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const IST_TIMEZONE = "Asia/Kolkata";

// Show loading
function showLoading() {
  document.getElementById("loading").style.display = "block";
}

// Hide loading
function hideLoading() {
  document.getElementById("loading").style.display = "none";
}

// Update current time display
function updateCurrentTime() {
  const now = moment().tz(IST_TIMEZONE);
  const currentTimeEl = document.getElementById("currentTime");
  const currentDateEl = document.getElementById("currentDate");
  
  if (currentTimeEl) currentTimeEl.textContent = now.format("HH:mm:ss");
  if (currentDateEl) currentDateEl.textContent = now.format("dddd, DD MMMM YYYY");
}

// Initialize app
window.onload = function () {
  // Load Sound Setting
  const savedSound = localStorage.getItem("soundEnabled");
  isSoundEnabled = savedSound !== null ? JSON.parse(savedSound) : true;
  updateSoundUI();

  const savedConfig = localStorage.getItem("firebaseConfig");
  if (savedConfig) {
    const { apiKey, databaseURL } = JSON.parse(savedConfig);
    document.getElementById("apiKey").value = apiKey;
    document.getElementById("databaseURL").value = databaseURL;
    initializeFirebase(apiKey, databaseURL);
  }

  // Update time every second
  setInterval(updateCurrentTime, 1000);
  updateCurrentTime();
};

function toggleSound() {
  isSoundEnabled = !isSoundEnabled;
  localStorage.setItem("soundEnabled", isSoundEnabled);
  updateSoundUI();
  if (isSoundEnabled) playSound("toggle");
}

function updateSoundUI() {
  const soundBtn = document.getElementById("soundToggle");
  if (soundBtn) {
    soundBtn.innerHTML = isSoundEnabled
      ? '<i class="fas fa-volume-up"></i>'
      : '<i class="fas fa-volume-mute"></i>';
    soundBtn.classList.toggle("muted", !isSoundEnabled);
  }
}

function playSound(type) {
  if (isSoundEnabled && sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play().catch(() => {});
  }
}

// Initialize Firebase
function initializeFirebase(apiKey, databaseURL) {
  showLoading();
  try {
    // Clear existing Firebase app if any
    if (firebase.apps.length > 0) {
      firebase.apps.forEach((app) => app.delete());
    }

    const firebaseConfig = { apiKey, databaseURL };
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    document.getElementById("instructionsSection").style.display = "none";
    document.getElementById("configSection").style.display = "none";
    document.getElementById("relaysSection").style.display = "block";
    document.getElementById("dhtSection").style.display = "block";
    document.getElementById("sensorsSection").style.display = "block";
    document.getElementById("timersSection").style.display = "block";

    loadData();
    startTimerScheduler();
    hideLoading();
    renderTimers();
  } catch (error) {
    hideLoading();
    alert("Firebase connection failed: " + error.message);
  }
}

// Handle config form submission
document.getElementById("configForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const apiKey = document.getElementById("apiKey").value;
  const databaseURL = document.getElementById("databaseURL").value;
  if (!apiKey || !databaseURL) {
    alert("Please provide both API Key and Database URL.");
    return;
  }
  localStorage.setItem(
    "firebaseConfig",
    JSON.stringify({ apiKey, databaseURL }),
  );
  initializeFirebase(apiKey, databaseURL);
});

// Load data from Firebase
function loadData() {
  if (!db) return;

  db.ref("relays").on("value", (snapshot) => {
    relays = snapshot.val() || {};
    renderRelays();
    updateTimerFormRelays();
  });

  db.ref("timers").on("value", (snapshot) => {
    timers = snapshot.val() || {};
    renderTimers();
  });

  // DHT Sensor real-time listener
  db.ref("DHT11").on("value", (snapshot) => {
    const data = snapshot.val();
    const tempEl = document.getElementById("tempValue");
    const humEl = document.getElementById("humValue");
    const tempStat = document.getElementById("tempStatus");
    const humStat = document.getElementById("humStatus");
    if (data) {
      const temp = data.Temperature !== undefined ? data.Temperature : null;
      const hum = data.Humidity !== undefined ? data.Humidity : null;
      if (temp !== null) {
        tempEl.textContent = parseFloat(temp).toFixed(1);
        tempStat.textContent = "Live ●";
      } else {
        tempEl.textContent = "--";
        tempStat.textContent = "No data";
      }
      if (hum !== null) {
        humEl.textContent = parseFloat(hum).toFixed(1);
        humStat.textContent = "Live ●";
      } else {
        humEl.textContent = "--";
        humStat.textContent = "No data";
      }
    } else {
      tempEl.textContent = "--";
      tempStat.textContent = "No data";
      humEl.textContent = "--";
      humStat.textContent = "No data";
    }
  });

  // MQ2 Gas Sensor listener
  db.ref("Sensors/GasLevel").on("value", (snapshot) => {
    const val = snapshot.val();
    const mq2Val = document.getElementById("mq2Value");
    const mq2Bar = document.getElementById("mq2Bar");
    const mq2Badge = document.getElementById("mq2Badge");
    const mq2Status = document.getElementById("mq2Status");

    if (val !== null && val !== undefined) {
      const num = parseFloat(val);
      mq2Val.textContent = Math.round(num);
      const pct = Math.min((num / 4095) * 100, 100);
      mq2Bar.style.width = pct + "%";
      mq2Status.textContent = "Live ●";

      if (pct < 30) {
        mq2Badge.textContent = "SAFE";
        mq2Badge.className = "sensor-badge";
      } else if (pct < 60) {
        mq2Badge.textContent = "WARNING";
        mq2Badge.className = "sensor-badge warning";
        playSound("alert");
      } else {
        mq2Badge.textContent = "DANGER!";
        mq2Badge.className = "sensor-badge danger";
        playSound("alert");
      }
    } else {
      mq2Val.textContent = "--";
      mq2Bar.style.width = "0%";
      mq2Status.textContent = "No data";
    }
  });

  // Flame Sensor listener
  db.ref("Sensors/Flame").on("value", (snapshot) => {
    const val = snapshot.val();
    const flameCard = document.getElementById("flameCard");
    const flameCircle = document.getElementById("flameCircle");
    const flameText = document.getElementById("flameText");
    const flameBadge = document.getElementById("flameBadge");
    const flameStatus = document.getElementById("flameStatus");

    flameStatus.textContent = "Live ●";

    // Flame detected: handles true/false, 0/1, string "DETECTED", or analog values < 500
    // (Flame sensors usually send LOW/0 when active, or a small analog value)
    let detected = false;
    if (typeof val === 'object' && val !== null) {
      detected = val.Detected === true || val.Detected === 1 || String(val.Detected).toUpperCase() === "DETECTED";
    } else {
      detected = val === true || val === 1 || val === "1" || 
                 String(val).toUpperCase() === "DETECTED" || 
                 String(val).toUpperCase() === "TRUE" ||
                 (typeof val === 'number' && val < 500 && val > 0);
    }

    if (detected) {
      flameCard.classList.add("detected-card");
      flameCircle.classList.add("detected");
      flameText.classList.add("detected");
      flameText.textContent = "⚠ Flame Detected!";
      flameBadge.textContent = "FLAME!";
      flameBadge.className = "sensor-badge flame-badge detected";
      playSound("alert");
    } else if (val === null || val === undefined) {
      flameCard.classList.remove("detected-card");
      flameCircle.classList.remove("detected");
      flameText.classList.remove("detected");
      flameText.textContent = "No Flame Detected";
      flameBadge.textContent = "NO FLAME";
      flameBadge.className = "sensor-badge flame-badge";
      flameStatus.textContent = "No data";
    } else {
      flameCard.classList.remove("detected-card");
      flameCircle.classList.remove("detected");
      flameText.classList.remove("detected");
      flameText.textContent = "No Flame Detected";
      flameBadge.textContent = "NO FLAME";
      flameBadge.className = "sensor-badge flame-badge";
    }
  });

  // LDR Light Sensor listener
  // Firebase path: LDR  →  { Dark: true/false, LightLevel: 0/1 }
  db.ref("LDR").on("value", (snapshot) => {
    const data = snapshot.val();

    const ldrCard = document.getElementById("ldrCard");
    const ldrOrb = document.getElementById("ldrOrb");
    const ldrOrbIcon = document.getElementById("ldrOrbIcon");
    const ldrIconEl = document.getElementById("ldrIconEl");
    const ldrIconWrap = document.getElementById("ldrIconWrap");
    const ldrBadge = document.getElementById("ldrBadge");
    const ldrScene = document.getElementById("ldrScene");
    const ldrStars = document.getElementById("ldrStars");
    const ldrText = document.getElementById("ldrText");
    const ldrLevelValue = document.getElementById("ldrLevelValue");
    const ldrStatus = document.getElementById("ldrStatus");

    if (data === null || data === undefined) {
      ldrStatus.textContent = "No data";
      ldrLevelValue.textContent = "--";
      ldrText.textContent = "Waiting for data...";
      ldrText.className = "ldr-text";
      return;
    }

    ldrStatus.textContent = "Live ●";

    // Detected = true means no light (dark environment detected)
    // Handle both object { Detected, LightLevel } and simple values
    let isDark = false;
    let levelDisplay = 0;

    if (typeof data === 'object' && data !== null) {
      isDark = data.Detected === true || data.Detected === "true" || data.LightLevel === 1 || (data.LightLevel > 500);
      levelDisplay = data.LightLevel !== undefined ? data.LightLevel : (isDark ? 1 : 0);
    } else {
      // If data is a simple value (number or boolean)
      isDark = data === true || data === "true" || data === 1 || (typeof data === 'number' && data > 500);
      levelDisplay = typeof data === 'number' ? data : (isDark ? 1 : 0);
    }

    ldrLevelValue.textContent = levelDisplay;

    if (isDark) {
      // DARK MODE
      ldrCard.classList.add("dark-mode");
      ldrOrb.className = "ldr-orb dark-mode-orb";
      ldrOrbIcon.className = "fas fa-moon";
      ldrIconEl.className = "fas fa-moon";
      ldrIconWrap.className = "sensor-icon-wrap ldr-icon";
      ldrScene.className = "ldr-scene";
      ldrStars.className = "ldr-stars visible";
      ldrBadge.textContent = "DARK";
      ldrBadge.className = "sensor-badge ldr-badge dark-mode";
      ldrText.textContent = "🌙 Dark — No Light Detected";
      ldrText.className = "ldr-text dark-mode";
    } else {
      // BRIGHT MODE
      ldrCard.classList.remove("dark-mode");
      ldrOrb.className = "ldr-orb bright";
      ldrOrbIcon.className = "fas fa-sun";
      ldrIconEl.className = "fas fa-sun";
      ldrIconWrap.className = "sensor-icon-wrap ldr-icon";
      ldrScene.className = "ldr-scene bright";
      ldrStars.className = "ldr-stars";
      ldrBadge.textContent = "BRIGHT";
      ldrBadge.className = "sensor-badge ldr-badge";
      ldrText.textContent = "☀️ Light Detected";
      ldrText.className = "ldr-text bright";
    }
  });

  // Rain Sensor listener
  // Path: Rain -> { Detected: boolean, Level: number }
  db.ref("Rain").on("value", (snapshot) => {
    const data = snapshot.val();
    const rainCard = document.getElementById("rainCard");
    const rainIconEl = document.getElementById("rainIconEl");
    const rainLevelValue = document.getElementById("rainLevelValue");
    const rainBadge = document.getElementById("rainBadge");
    const rainText = document.getElementById("rainText");
    const rainStatus = document.getElementById("rainStatus");
    const rainDrops = document.getElementById("rainDrops");

    if (data === null || data === undefined) {
      rainStatus.textContent = "No data";
      rainLevelValue.textContent = "--";
      rainText.textContent = "Waiting for data...";
      return;
    }

    let isRaining = false;
    let level = 0;

    if (typeof data === 'object' && data !== null) {
      isRaining = data.Detected === true || data.Detected === 1 || data.Detected === "true" || data.Level === 1;
      level = data.Level !== undefined ? data.Level : (isRaining ? 1 : 0);
    } else {
      isRaining = data === true || data === "true" || data === 1;
      level = typeof data === 'number' ? data : (isRaining ? 1 : 0);
    }
    
    rainLevelValue.textContent = level;

    if (isRaining) {
      rainCard.classList.add("raining");
      rainIconEl.className = "fas fa-cloud-showers-heavy";
      rainBadge.textContent = "RAINING";
      rainBadge.className = "sensor-badge rain-badge detected";
      rainText.textContent = "☔ Rain Detected — Stay Dry!";
      rainDrops.innerHTML = "<span></span><span></span><span></span><span></span><span></span>";
    } else {
      rainCard.classList.remove("raining");
      rainIconEl.className = "fas fa-cloud";
      rainBadge.textContent = "DRY";
      rainBadge.className = "sensor-badge rain-badge";
      rainText.textContent = "☀️ No Rain Detected";
      rainDrops.innerHTML = "";
    }
  });
}

// Render relays
// Helper: pick icon based on relay name keywords
function getRelayIcon(name) {
  const n = name.toLowerCase();
  if (n.includes("fan")) return "fa-fan";
  if (n.includes("light") || n.includes("led") || n.includes("lamp"))
    return "fa-lightbulb";
  if (n.includes("bulb")) return "fa-lightbulb";
  if (n.includes("pump")) return "fa-water";
  if (n.includes("socket") || n.includes("board") || n.includes("plug"))
    return "fa-plug";
  if (n.includes("ac") || n.includes("cool")) return "fa-snowflake";
  if (n.includes("heat")) return "fa-fire";
  if (n.includes("motor")) return "fa-cog";
  return "fa-bolt";
}

function renderRelays() {
  const container = document.getElementById("relaysContainer");
  container.innerHTML = "";

  if (!relays || Object.keys(relays).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-plug"></i>
        <p>No relays found in your database</p>
      </div>
    `;
    return;
  }

  const relayEntries = Object.entries(relays).filter(
    ([relay]) =>
      relay &&
      typeof relay === "string" &&
      relay !== "undefined" &&
      relay.trim() !== "",
  );

  relayEntries.forEach(([relay, state], index) => {
    const boolState = typeof state === "boolean" ? state : false;
    const icon = getRelayIcon(relay);
    const relayNum = index + 1;

    const div = document.createElement("div");
    div.className = `relay-card ${boolState ? "on" : "off"}`;
    div.innerHTML = `
      <div class="relay-icon-wrap">
        <i class="fas ${icon}"></i>
      </div>
      <div class="relay-device-name">${relay}</div>
      <div class="relay-number">Relay ${relayNum}</div>
      <div class="relay-category">Device Relay</div>
      <div class="relay-footer">
        <div>
          <div class="relay-output-label">Output</div>
          <div class="relay-power-text">Powered ${boolState ? "ON" : "OFF"}</div>
        </div>
        <label class="toggle-switch" onclick="event.stopPropagation()">
          <input type="checkbox" ${boolState ? "checked" : ""} onchange="toggleRelay('${relay}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
    container.appendChild(div);
  });
}

// Render timers
function renderTimers() {
  const container = document.getElementById("timersContainer");
  container.innerHTML = "";

  if (!timers || Object.keys(timers).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-clock"></i>
        <p>No timers configured</p>
      </div>
    `;
    return;
  }

  Object.entries(timers).forEach(([id, timer]) => {
    if (
      !timer ||
      !timer.relay ||
      typeof timer.relay !== "string" ||
      timer.relay === "undefined" ||
      timer.relay.trim() === ""
    ) {
      console.warn(`Skipping invalid timer entry: ${id}`);
      return; // Skip invalid timer entries
    }

    const activeDays = timer.days
      ? timer.days
          .map((active, index) => (active ? dayNames[index] : null))
          .filter(Boolean)
          .join(", ")
      : "None";

    const div = document.createElement("div");
    div.className = "timer-card";
    const statusClass = timer.active ? "active" : "inactive";
    const statusText = timer.active ? "Active" : "Inactive";
    
    div.innerHTML = `
      <div class="timer-badge ${statusClass}">${statusText}</div>
      <h4><i class="fas fa-toggle-on"></i> ${timer.relay}</h4>
      <div class="timer-details">
        <p><i class="fas fa-sign-in-alt"></i> Action: <strong>${timer.action}</strong></p>
        <p><i class="fas fa-clock"></i> ${timer.startTime}${timer.endTime ? " — " + timer.endTime : " (No End Time)"}</p>
        <p><i class="fas fa-calendar-alt"></i> ${activeDays}</p>
      </div>
      <div class="timer-actions">
        <button class="btn btn-edit" onclick="editTimer('${id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-danger" onclick="deleteTimer('${id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

// Update timer form relays
function updateTimerFormRelays() {
  const select = document.getElementById("timerRelay");
  select.innerHTML = '<option value="">Choose a relay...</option>';
  Object.keys(relays).forEach((relay) => {
    if (
      !relay ||
      typeof relay !== "string" ||
      relay === "undefined" ||
      relay.trim() === ""
    ) {
      console.warn(`Skipping invalid relay in form: ${relay}`);
      return; // Skip invalid relay names
    }
    const option = document.createElement("option");
    option.value = relay;
    option.textContent = relay;
    select.appendChild(option);
  });
}

// Toggle relay
function toggleRelay(relay, state) {
  if (
    !relay ||
    typeof relay !== "string" ||
    relay === "undefined" ||
    relay.trim() === ""
  ) {
    console.error(`Invalid relay name: ${relay}`);
    alert("Cannot toggle relay: Invalid relay name.");
    return;
  }
  showLoading();
  db.ref(`relays/${relay}`)
    .set(state)
    .then(() => {
      playSound("toggle");
      hideLoading();
    })
    .catch((error) => {
      hideLoading();
      alert("Error updating relay: " + error.message);
    });
}

// Timer modal functions
function openTimerModal() {
  currentEditingTimerId = null;
  document.getElementById("modalTitle").innerHTML =
    '<i class="fas fa-clock"></i> Add New Timer';
  document.getElementById("timerForm").reset();
  resetDayCheckboxes();
  document.getElementById("timerModal").style.display = "block";
}

function closeTimerModal() {
  document.getElementById("timerModal").style.display = "none";
  currentEditingTimerId = null;
}

function toggleDay(dayIndex) {
  const checkbox = document.getElementById("day" + dayIndex);
  const dayBox = checkbox.parentElement;
  checkbox.checked = !checkbox.checked;
  dayBox.classList.toggle("active", checkbox.checked);
}

function resetDayCheckboxes() {
  for (let i = 0; i < 7; i++) {
    const checkbox = document.getElementById("day" + i);
    const dayBox = checkbox.parentElement;
    checkbox.checked = false;
    dayBox.classList.remove("active");
  }
}

// Edit timer
function editTimer(timerId) {
  const timer = timers[timerId];
  if (timer) {
    currentEditingTimerId = timerId;
    document.getElementById("modalTitle").innerHTML =
      '<i class="fas fa-edit"></i> Edit Timer';
    document.getElementById("timerRelay").value = timer.relay || "";
    document.getElementById("timerAction").value = timer.action || "";
    document.getElementById("timerStartTime").value = timer.startTime || "";
    document.getElementById("timerEndTime").value = timer.endTime || "";

    resetDayCheckboxes();
    if (timer.days) {
      timer.days.forEach((active, index) => {
        if (active) {
          const checkbox = document.getElementById("day" + index);
          const dayBox = checkbox.parentElement;
          checkbox.checked = true;
          dayBox.classList.add("active");
        }
      });
    }
    document.getElementById("timerModal").style.display = "block";
  }
}

// Delete timer
function deleteTimer(timerId) {
  if (confirm("Are you sure you want to delete this timer?")) {
    showLoading();
    db.ref(`timers/${timerId}`)
      .remove()
      .then(() => {
        hideLoading();
        renderTimers();
      })
      .catch((error) => {
        hideLoading();
        alert("Error deleting timer: " + error.message);
      });
  }
}

// Update relay state based on timer schedule
function updateRelayForTimer(timer) {
  if (
    !timer ||
    !timer.active ||
    !timer.relay ||
    !timer.startTime ||
    !timer.days ||
    timer.relay === "undefined" ||
    timer.relay.trim() === "" ||
    !relays[timer.relay]
  ) {
    console.warn(
      `Skipping relay update for invalid timer or relay: ${JSON.stringify(timer)}`,
    );
    return;
  }

  const now = moment().tz(IST_TIMEZONE);
  const currentDay = (now.day() + 6) % 7; // Convert to Monday=0, Sunday=6

  // Check if the timer is active on the current day
  if (!timer.days[currentDay]) return;

  const startTime = moment.tz(
    `${now.format("YYYY-MM-DD")} ${timer.startTime}`,
    "YYYY-MM-DD HH:mm",
    IST_TIMEZONE,
  );
  const endTime = timer.endTime
    ? moment.tz(
        `${now.format("YYYY-MM-DD")} ${timer.endTime}`,
        "YYYY-MM-DD HH:mm",
        IST_TIMEZONE,
      )
    : null;

  if (endTime && endTime.isBefore(startTime)) {
    endTime.add(1, "day");
  }

  showLoading();
  // Update relay: ON if within active period, OFF if past endTime
  if (now.isSameOrAfter(startTime) && (!endTime || now.isBefore(endTime))) {
    console.log(
      `Immediate: Setting relay ${timer.relay} to ${timer.action} at ${now.format("HH:mm:ss")}`,
    );
    db.ref(`relays/${timer.relay}`)
      .set(timer.action === "ON")
      .then(() => hideLoading())
      .catch((error) => {
        hideLoading();
        alert("Error updating relay for timer: " + error.message);
      });
  } else if (endTime && now.isSameOrAfter(endTime)) {
    console.log(
      `Immediate: Setting relay ${timer.relay} to OFF at ${now.format("HH:mm:ss")}`,
    );
    db.ref(`relays/${timer.relay}`)
      .set(false)
      .then(() => hideLoading())
      .catch((error) => {
        hideLoading();
        alert("Error updating relay for timer: " + error.message);
      });
  } else {
    hideLoading();
  }
}

// Handle timer form submission
document.getElementById("timerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  showLoading();

  const relay = document.getElementById("timerRelay").value;
  const action = document.getElementById("timerAction").value;
  const startTime = document.getElementById("timerStartTime").value;
  const endTime = document.getElementById("timerEndTime").value;

  // Validate inputs
  if (!relay || relay === "undefined" || relay.trim() === "" || !action || !startTime) {
    hideLoading();
    alert("Please select a relay, action, and start time.");
    return;
  }

  // Ensure relay still exists in local data
  if (relays[relay] === undefined) {
    console.warn(`Relay ${relay} not found in state, but attempting to save anyway...`);
  }

  // Validation: Start Time < End Time
  if (startTime && endTime) {
    const startNum = parseInt(startTime.replace(":", ""));
    const endNum = parseInt(endTime.replace(":", ""));
    if (endNum <= startNum) {
      hideLoading();
      alert("End time must be LATER than start time.");
      return;
    }
  }

  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(document.getElementById("day" + i).checked);
  }

  // Ensure at least one day is selected
  if (!days.some((day) => day)) {
    hideLoading();
    alert("Please select at least one day for the timer.");
    return;
  }

  const timerData = {
    relay,
    action,
    startTime,
    endTime: endTime || null,
    days,
    active: true,
  };

  const refPath = currentEditingTimerId
    ? `timers/${currentEditingTimerId}`
    : `timers/${db.ref("timers").push().key}`;

  db.ref(refPath)
    .set(timerData)
    .then(() => {
      // Update relay state immediately if timer is active now
      updateRelayForTimer(timerData);
      hideLoading();
      closeTimerModal();
      renderTimers();
    })
    .catch((error) => {
      hideLoading();
      alert("Error saving timer: " + error.message);
    });
});

// Credentials modal functions
function showCredentialsModal() {
  const savedConfig = localStorage.getItem("firebaseConfig");
  if (savedConfig) {
    const { apiKey, databaseURL } = JSON.parse(savedConfig);
    document.getElementById("newApiKey").value = apiKey;
    document.getElementById("newDatabaseURL").value = databaseURL;
  }
  document.getElementById("credentialsModal").style.display = "block";
}

function closeCredentialsModal() {
  document.getElementById("credentialsModal").style.display = "none";
}

// Handle credentials form submission
document.getElementById("credentialsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const apiKey = document.getElementById("newApiKey").value;
  const databaseURL = document.getElementById("newDatabaseURL").value;

  if (!apiKey || !databaseURL) {
    alert("Please provide both API Key and Database URL.");
    return;
  }

  localStorage.setItem(
    "firebaseConfig",
    JSON.stringify({ apiKey, databaseURL }),
  );
  closeCredentialsModal();

  // Show sections again for reconnection
  document.getElementById("instructionsSection").style.display = "block";
  document.getElementById("configSection").style.display = "block";
  document.getElementById("relaysSection").style.display = "none";
  document.getElementById("dhtSection").style.display = "none";
  document.getElementById("sensorsSection").style.display = "none";
  document.getElementById("timersSection").style.display = "none";

  // Update form fields
  document.getElementById("apiKey").value = apiKey;
  document.getElementById("databaseURL").value = databaseURL;

  alert("Credentials updated! Please reconnect to Firebase.");
});

// Close modals when clicking outside
window.onclick = function (event) {
  const timerModal = document.getElementById("timerModal");
  const credentialsModal = document.getElementById("credentialsModal");

  if (event.target === timerModal) {
    closeTimerModal();
  }
  if (event.target === credentialsModal) {
    closeCredentialsModal();
  }
};

// Timer scheduler with IST timezone
function startTimerScheduler() {
  const updateSchedule = () => {
    if (!db) return;

    const now = moment().tz(IST_TIMEZONE);
    const currentDay = (now.day() + 6) % 7; // Convert to Monday=0, Sunday=6
    let nextTimer = null;
    let nextTimerDate = null;

    // Check current timers
    Object.entries(timers).forEach(([id, timer]) => {
      if (
        !timer ||
        !timer.active ||
        !timer.days ||
        !timer.days[currentDay] ||
        !timer.relay ||
        !timer.startTime ||
        timer.relay === "undefined" ||
        !relays[timer.relay]
      ) {
        console.warn(`Skipping invalid timer in scheduler: ${id}`);
        return;
      }

      const startTime = moment.tz(
        `${now.format("YYYY-MM-DD")} ${timer.startTime}`,
        "YYYY-MM-DD HH:mm",
        IST_TIMEZONE,
      );
      const endTime = timer.endTime
        ? moment.tz(
            `${now.format("YYYY-MM-DD")} ${timer.endTime}`,
            "YYYY-MM-DD HH:mm",
            IST_TIMEZONE,
          )
        : null;

      if (endTime && endTime.isBefore(startTime)) {
        endTime.add(1, "day");
      }

      // Execute timer: ON if within active period, OFF if past endTime
      if (now.isSameOrAfter(startTime) && (!endTime || now.isBefore(endTime))) {
        console.log(
          `Scheduler: Setting relay ${timer.relay} to ${timer.action} at ${now.format("HH:mm:ss")}`,
        );
        db.ref(`relays/${timer.relay}`).set(timer.action === "ON");
      } else if (endTime && now.isSameOrAfter(endTime)) {
        console.log(
          `Scheduler: Setting relay ${timer.relay} to OFF at ${now.format("HH:mm:ss")}`,
        );
        db.ref(`relays/${timer.relay}`).set(false);
      }
    });

    // Find next timer
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDate = moment(now).add(dayOffset, "days");
      const checkDay = (checkDate.day() + 6) % 7;

      Object.entries(timers).forEach(([id, timer]) => {
        if (
          !timer ||
          !timer.active ||
          !timer.days ||
          !timer.days[checkDay] ||
          !timer.relay ||
          !timer.startTime ||
          timer.relay === "undefined" ||
          !relays[timer.relay]
        ) {
          console.warn(
            `Skipping invalid timer in next timer calculation: ${id}`,
          );
          return;
        }

        const startTime = moment.tz(
          `${checkDate.format("YYYY-MM-DD")} ${timer.startTime}`,
          "YYYY-MM-DD HH:mm",
          IST_TIMEZONE,
        );

        if (dayOffset === 0 && startTime.isSameOrBefore(now)) return;

        if (!nextTimer || startTime.isBefore(nextTimerDate)) {
          nextTimer = timer;
          nextTimerDate = startTime;
        }
      });

      if (nextTimer) break;
    }

    // Update next timer display
    const nextTimerEl = document.getElementById("nextTimer");
    if (nextTimer && nextTimerDate) {
      const timeUntil = nextTimerDate.fromNow();
      nextTimerEl.innerHTML = `
        <i class="fas fa-calendar-check"></i> 
        <span>Next: <strong>${nextTimer.relay}</strong> — <strong>${nextTimer.action}</strong> at <strong>${nextTimerDate.format("HH:mm")}</strong> (${timeUntil})</span>
      `;
      nextTimerEl.style.display = "flex";
    } else {
      nextTimerEl.innerHTML = "";
      nextTimerEl.style.display = "none";
    }
  }

  // Run immediately then every 30s
  updateSchedule();
  setInterval(updateSchedule, 30000);
}
