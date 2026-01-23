let headers = [];
let enabled = false;

const headersList = document.getElementById("headersList");
const enabledToggle = document.getElementById("enabled");
const headerName = document.getElementById("headerName");
const headerValue = document.getElementById("headerValue");
const addBtn = document.getElementById("addBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

// Load saved state
chrome.storage.local.get(["headers", "enabled"], (data) => {
  headers = data.headers || [];
  enabled = data.enabled || false;
  enabledToggle.checked = enabled;
  renderHeaders();
  updateStatus();
});

// Toggle enabled
enabledToggle.addEventListener("change", () => {
  enabled = enabledToggle.checked;
  save();
  updateStatus();
});

// Add header
addBtn.addEventListener("click", addHeader);

function addHeader() {
  const name = headerName.value.trim();
  const value = headerValue.value.trim();
  
  if (!name || !value) return;
  
  // Check for duplicate header names
  const exists = headers.some(h => h.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    // Update existing
    headers = headers.map(h => 
      h.name.toLowerCase() === name.toLowerCase() ? { name, value } : h
    );
  } else {
    headers.push({ name, value });
  }
  
  headerName.value = "";
  headerValue.value = "";
  save();
}

// Enter key to add
headerValue.addEventListener("keypress", (e) => {
  if (e.key === "Enter") addHeader();
});

headerName.addEventListener("keypress", (e) => {
  if (e.key === "Enter") headerValue.focus();
});

// Preset buttons
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    headerName.value = btn.dataset.name;
    headerValue.focus();
  });
});

function updateStatus() {
  if (enabled && headers.length > 0) {
    statusDot.classList.add("active");
    statusText.textContent = `Active - injecting ${headers.length} header${headers.length > 1 ? 's' : ''} into all requests`;
  } else if (enabled && headers.length === 0) {
    statusDot.classList.remove("active");
    statusText.textContent = "Enabled but no headers configured";
  } else {
    statusDot.classList.remove("active");
    statusText.textContent = "Disabled - headers not being injected";
  }
}

function renderHeaders() {
  if (headers.length === 0) {
    headersList.innerHTML = '<div class="empty">No headers configured yet.<br>Add one below or use a preset.</div>';
    return;
  }
  
  headersList.innerHTML = headers.map((h, i) => `
    <div class="header-item">
      <div class="header-info">
        <div class="header-name">${escapeHtml(h.name)}</div>
        <div class="header-value">${escapeHtml(h.value)}</div>
      </div>
      <button class="delete-btn" data-index="${i}" title="Remove header">&times;</button>
    </div>
  `).join("");
  
  // Attach delete handlers
  headersList.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      headers.splice(parseInt(btn.dataset.index), 1);
      save();
    });
  });
}

function save() {
  chrome.storage.local.set({ headers, enabled }, () => {
    chrome.runtime.sendMessage({ action: "updateRules", headers, enabled });
    renderHeaders();
    updateStatus();
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
