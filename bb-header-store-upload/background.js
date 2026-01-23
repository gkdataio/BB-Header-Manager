chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "updateRules") {
    applyRules(msg.headers, msg.enabled).then(() => sendResponse({ success: true }));
    return true;
  }
});

async function applyRules(headers, enabled) {
  // Clear all existing rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map(r => r.id);
  
  if (existingIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds });
  }

  // Update badge
  chrome.action.setBadgeText({ text: enabled ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#22c55e" });

  if (!enabled || headers.length === 0) return;

  // Create rules for each header
  const rules = headers.map((h, i) => ({
    id: i + 1,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: h.name,
        operation: "set",
        value: h.value
      }]
    },
    condition: {
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "script", "stylesheet", "image", "font", "media", "websocket", "other"]
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["headers", "enabled"]);
  if (data.headers && data.enabled) {
    await applyRules(data.headers, data.enabled);
  }
});

// Re-apply on browser startup
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(["headers", "enabled"]);
  if (data.headers && data.enabled) {
    await applyRules(data.headers, data.enabled);
  }
});
