// State
let profiles = {};
let activeProfile = "Default";
let enabled = false;
let timerEnd = null;

// DOM elements
const enabledToggle = document.getElementById("enabled");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const requestCount = document.getElementById("requestCount");
const profileSelect = document.getElementById("profileSelect");
const headersList = document.getElementById("headersList");
const targetsList = document.getElementById("targetsList");
const excludesList = document.getElementById("excludesList");

// Initialize
async function init() {
  const data = await chrome.storage.local.get(["profiles", "activeProfile", "enabled", "timerEnd"]);
  
  profiles = data.profiles || { "Default": { headers: [], targets: [], excludes: [], methods: [] } };
  activeProfile = data.activeProfile || "Default";
  enabled = data.enabled || false;
  timerEnd = data.timerEnd || null;
  
  enabledToggle.checked = enabled;
  
  renderProfiles();
  renderAll();
  updateStatus();
  updateRequestCount();
  updateTimerStatus();
  
  // Update count every second
  setInterval(updateRequestCount, 1000);
  setInterval(updateTimerStatus, 1000);
}

// Render profile dropdown
function renderProfiles() {
  profileSelect.innerHTML = Object.keys(profiles).map(name => 
    `<option value="${escapeHtml(name)}" ${name === activeProfile ? "selected" : ""}>${escapeHtml(name)}</option>`
  ).join("");
}

// Get current profile
function getProfile() {
  return profiles[activeProfile] || { headers: [], targets: [], excludes: [], methods: [] };
}

// Render all lists
function renderAll() {
  renderHeaders();
  renderTargets();
  renderExcludes();
  renderMethods();
}

// Render headers list
function renderHeaders() {
  const headers = getProfile().headers || [];
  
  if (headers.length === 0) {
    headersList.innerHTML = '<div class="empty">No headers configured</div>';
    return;
  }
  
  headersList.innerHTML = headers.map((h, i) => `
    <div class="list-item">
      <div class="list-item-toggle">
        <input type="checkbox" id="header-toggle-${i}" data-index="${i}" ${h.enabled !== false ? "checked" : ""}>
        <label for="header-toggle-${i}"></label>
      </div>
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(h.name)}</div>
        <div class="list-item-value">${escapeHtml(h.value)}</div>
      </div>
      <button class="delete-btn" data-type="header" data-index="${i}">&times;</button>
    </div>
  `).join("");
  
  // Toggle handlers
  headersList.querySelectorAll('input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener("change", (e) => {
      const idx = parseInt(e.target.dataset.index);
      profiles[activeProfile].headers[idx].enabled = e.target.checked;
      save();
    });
  });
  
  // Delete handlers
  headersList.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      profiles[activeProfile].headers.splice(parseInt(btn.dataset.index), 1);
      save();
    });
  });
}

// Render targets list
function renderTargets() {
  const targets = getProfile().targets || [];
  
  if (targets.length === 0) {
    targetsList.innerHTML = '<div class="empty">All domains (no filter)</div>';
    return;
  }
  
  targetsList.innerHTML = targets.map((t, i) => `
    <div class="list-item">
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(t)}</div>
      </div>
      <button class="delete-btn" data-type="target" data-index="${i}">&times;</button>
    </div>
  `).join("");
  
  targetsList.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      profiles[activeProfile].targets.splice(parseInt(btn.dataset.index), 1);
      save();
    });
  });
}

// Render excludes list
function renderExcludes() {
  const excludes = getProfile().excludes || [];
  
  if (excludes.length === 0) {
    excludesList.innerHTML = '<div class="empty">No exclusions</div>';
    return;
  }
  
  excludesList.innerHTML = excludes.map((e, i) => `
    <div class="list-item">
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(e)}</div>
      </div>
      <button class="delete-btn" data-type="exclude" data-index="${i}">&times;</button>
    </div>
  `).join("");
  
  excludesList.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      profiles[activeProfile].excludes.splice(parseInt(btn.dataset.index), 1);
      save();
    });
  });
}

// Render methods filter
function renderMethods() {
  const methods = getProfile().methods || [];
  
  document.querySelectorAll(".method-btn").forEach(btn => {
    btn.classList.toggle("active", methods.includes(btn.dataset.method));
  });
}

// Update status display
function updateStatus() {
  const profile = getProfile();
  const activeHeaders = (profile.headers || []).filter(h => h.enabled !== false);
  const targets = profile.targets || [];
  
  if (enabled && activeHeaders.length > 0) {
    statusDot.classList.add("active");
    let text = `Active - ${activeHeaders.length} header${activeHeaders.length > 1 ? "s" : ""}`;
    if (targets.length > 0) {
      text += ` on ${targets.length} target${targets.length > 1 ? "s" : ""}`;
    }
    statusText.textContent = text;
  } else if (enabled) {
    statusDot.classList.remove("active");
    statusText.textContent = "Enabled but no headers";
  } else {
    statusDot.classList.remove("active");
    statusText.textContent = "Disabled";
  }
}

// Update request count
async function updateRequestCount() {
  chrome.runtime.sendMessage({ action: "getCount" }, (response) => {
    if (response) {
      requestCount.textContent = `${response.count} requests`;
    }
  });
}

// Update timer status
function updateTimerStatus() {
  const timerStatus = document.getElementById("timerStatus");
  
  if (timerEnd && timerEnd > Date.now()) {
    const remaining = Math.ceil((timerEnd - Date.now()) / 60000);
    timerStatus.textContent = `Auto-disable in ${remaining} minute${remaining > 1 ? "s" : ""}`;
    timerStatus.classList.add("active");
  } else {
    timerStatus.textContent = "No timer active";
    timerStatus.classList.remove("active");
    timerEnd = null;
  }
}

// Save and apply rules
async function save() {
  await chrome.storage.local.set({ profiles, activeProfile, enabled, timerEnd });
  
  chrome.runtime.sendMessage({
    action: "updateRules",
    config: {
      enabled,
      profile: getProfile()
    }
  });
  
  renderAll();
  updateStatus();
}

// Event: Toggle enabled
enabledToggle.addEventListener("change", () => {
  enabled = enabledToggle.checked;
  save();
});

// Event: Profile change
profileSelect.addEventListener("change", () => {
  activeProfile = profileSelect.value;
  save();
});

// Event: New profile
document.getElementById("newProfileBtn").addEventListener("click", () => {
  const name = prompt("Profile name:");
  if (name && name.trim() && !profiles[name.trim()]) {
    profiles[name.trim()] = { headers: [], targets: [], excludes: [], methods: [] };
    activeProfile = name.trim();
    renderProfiles();
    save();
  }
});

// Event: Delete profile
document.getElementById("deleteProfileBtn").addEventListener("click", () => {
  if (Object.keys(profiles).length <= 1) {
    alert("Cannot delete the last profile");
    return;
  }
  if (confirm(`Delete profile "${activeProfile}"?`)) {
    delete profiles[activeProfile];
    activeProfile = Object.keys(profiles)[0];
    renderProfiles();
    save();
  }
});

// Event: Add header
document.getElementById("addHeaderBtn").addEventListener("click", () => {
  const name = document.getElementById("headerName").value.trim();
  const value = document.getElementById("headerValue").value.trim();
  
  if (!name || !value) return;
  
  if (!profiles[activeProfile].headers) profiles[activeProfile].headers = [];
  
  // Update existing or add new
  const existing = profiles[activeProfile].headers.findIndex(h => h.name.toLowerCase() === name.toLowerCase());
  if (existing >= 0) {
    profiles[activeProfile].headers[existing] = { name, value, enabled: true };
  } else {
    profiles[activeProfile].headers.push({ name, value, enabled: true });
  }
  
  document.getElementById("headerName").value = "";
  document.getElementById("headerValue").value = "";
  save();
});

// Event: Preset buttons
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("headerName").value = btn.dataset.name;
    document.getElementById("headerValue").focus();
  });
});

// Event: Add target
document.getElementById("addTargetBtn").addEventListener("click", () => {
  const domain = document.getElementById("targetDomain").value.trim();
  if (!domain) return;
  
  if (!profiles[activeProfile].targets) profiles[activeProfile].targets = [];
  if (!profiles[activeProfile].targets.includes(domain)) {
    profiles[activeProfile].targets.push(domain);
  }
  
  document.getElementById("targetDomain").value = "";
  save();
});

// Event: Add exclude
document.getElementById("addExcludeBtn").addEventListener("click", () => {
  const domain = document.getElementById("excludeDomain").value.trim();
  if (!domain) return;
  
  if (!profiles[activeProfile].excludes) profiles[activeProfile].excludes = [];
  if (!profiles[activeProfile].excludes.includes(domain)) {
    profiles[activeProfile].excludes.push(domain);
  }
  
  document.getElementById("excludeDomain").value = "";
  save();
});

// Event: Method filter
document.querySelectorAll(".method-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!profiles[activeProfile].methods) profiles[activeProfile].methods = [];
    
    const method = btn.dataset.method;
    const idx = profiles[activeProfile].methods.indexOf(method);
    
    if (idx >= 0) {
      profiles[activeProfile].methods.splice(idx, 1);
    } else {
      profiles[activeProfile].methods.push(method);
    }
    
    save();
  });
});

// Event: Set timer
document.getElementById("setTimerBtn").addEventListener("click", () => {
  const minutes = parseInt(document.getElementById("timerSelect").value);
  
  if (minutes > 0) {
    timerEnd = Date.now() + (minutes * 60000);
    chrome.storage.local.set({ timerEnd });
    chrome.runtime.sendMessage({ action: "setTimer", minutes });
  } else {
    timerEnd = null;
    chrome.storage.local.set({ timerEnd: null });
    chrome.runtime.sendMessage({ action: "clearTimer" });
  }
  
  updateTimerStatus();
});

// Event: Reset request count
requestCount.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "resetCount" });
  requestCount.textContent = "0 requests";
});

// Event: Export
document.getElementById("exportBtn").addEventListener("click", () => {
  const data = JSON.stringify({ profiles, activeProfile }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `bb-headers-${activeProfile.toLowerCase().replace(/\s+/g, "-")}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
});

// Event: Import
document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.profiles) {
        profiles = { ...profiles, ...data.profiles };
        if (data.activeProfile && profiles[data.activeProfile]) {
          activeProfile = data.activeProfile;
        }
        renderProfiles();
        save();
        alert("Config imported successfully");
      }
    } catch (err) {
      alert("Invalid config file");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// Event: Tabs
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

// Enter key handlers
document.getElementById("headerValue").addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("addHeaderBtn").click();
});
document.getElementById("headerName").addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("headerValue").focus();
});
document.getElementById("targetDomain").addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("addTargetBtn").click();
});
document.getElementById("excludeDomain").addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("addExcludeBtn").click();
});

// Escape HTML
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Init
init();
