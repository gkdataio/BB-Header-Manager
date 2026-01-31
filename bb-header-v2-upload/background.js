// Request counter
let requestCount = 0;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "updateRules") {
    applyRules(msg.config).then(() => sendResponse({ success: true }));
    return true;
  }
  if (msg.action === "getCount") {
    sendResponse({ count: requestCount });
    return true;
  }
  if (msg.action === "resetCount") {
    requestCount = 0;
    updateBadge(0, false);
    sendResponse({ success: true });
    return true;
  }
  if (msg.action === "setTimer") {
    setAutoDisableTimer(msg.minutes);
    sendResponse({ success: true });
    return true;
  }
  if (msg.action === "clearTimer") {
    chrome.alarms.clear("autoDisable");
    sendResponse({ success: true });
    return true;
  }
});

// Track matched requests for counter
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  requestCount++;
  chrome.storage.local.get(["enabled"], (data) => {
    if (data.enabled) {
      updateBadge(requestCount, true);
    }
  });
});

// Auto-disable timer
function setAutoDisableTimer(minutes) {
  chrome.alarms.clear("autoDisable");
  if (minutes > 0) {
    chrome.alarms.create("autoDisable", { delayInMinutes: minutes });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "autoDisable") {
    chrome.storage.local.set({ enabled: false }, async () => {
      const data = await chrome.storage.local.get(["profiles", "activeProfile"]);
      const config = {
        enabled: false,
        profile: data.profiles?.[data.activeProfile] || {}
      };
      await applyRules(config);
    });
  }
});

// Update badge
function updateBadge(count, enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: count > 0 ? count.toString() : "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#22c55e" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Match domain with wildcard support
function matchDomain(pattern, hostname) {
  if (pattern.startsWith("*.")) {
    const base = pattern.slice(2);
    return hostname === base || hostname.endsWith("." + base);
  }
  return hostname === pattern;
}

// Convert targets to declarativeNetRequest conditions
function buildUrlFilter(targets, excludes) {
  // If no targets specified, match all
  if (!targets || targets.length === 0) {
    return null; // Will use default match all
  }
  return targets;
}

// Apply rules based on config
async function applyRules(config) {
  const { enabled, profile } = config;
  
  // Clear existing rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map(r => r.id);
  
  if (existingIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds });
  }

  // Update badge
  if (!enabled) {
    updateBadge(0, false);
    return;
  }

  const headers = profile.headers || [];
  const targets = profile.targets || [];
  const excludes = profile.excludes || [];
  const methods = profile.methods || [];

  // Filter only enabled headers
  const activeHeaders = headers.filter(h => h.enabled !== false);
  
  if (activeHeaders.length === 0) {
    updateBadge(0, true);
    return;
  }

  // Build rules
  const rules = [];
  let ruleId = 1;

  // Map method names to valid types
  const methodMap = {
    "GET": "get",
    "POST": "post", 
    "PUT": "put",
    "DELETE": "delete",
    "PATCH": "patch",
    "HEAD": "head",
    "OPTIONS": "options"
  };

  // Build request methods array
  let requestMethods = undefined;
  if (methods && methods.length > 0) {
    requestMethods = methods.map(m => methodMap[m] || m.toLowerCase());
  }

  // Resource types to match
  const resourceTypes = [
    "main_frame", "sub_frame", "stylesheet", "script", "image", 
    "font", "object", "xmlhttprequest", "ping", "media", 
    "websocket", "webtransport", "webbundle", "other"
  ];

  if (targets.length === 0 && excludes.length === 0) {
    // No domain filtering - single rule for all headers
    const rule = {
      id: ruleId++,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: activeHeaders.map(h => ({
          header: h.name,
          operation: "set",
          value: h.value
        }))
      },
      condition: {
        resourceTypes: resourceTypes
      }
    };
    
    if (requestMethods) {
      rule.condition.requestMethods = requestMethods;
    }
    
    rules.push(rule);
  } else {
    // With domain filtering - need regexFilter
    // Build regex for targets
    let urlRegex = null;
    
    if (targets.length > 0) {
      const targetPatterns = targets.map(t => {
        if (t.startsWith("*.")) {
          const base = t.slice(2).replace(/\./g, "\\.");
          return `([a-z0-9-]+\\.)*${base}`;
        }
        return t.replace(/\./g, "\\.");
      });
      urlRegex = `^https?://((${targetPatterns.join("|")}))(/.*)?$`;
    }

    const rule = {
      id: ruleId++,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: activeHeaders.map(h => ({
          header: h.name,
          operation: "set",
          value: h.value
        }))
      },
      condition: {
        resourceTypes: resourceTypes
      }
    };

    if (urlRegex) {
      rule.condition.regexFilter = urlRegex;
    }
    
    if (requestMethods) {
      rule.condition.requestMethods = requestMethods;
    }

    rules.push(rule);

    // Add exclude rules (higher priority to block)
    if (excludes.length > 0) {
      const excludePatterns = excludes.map(e => {
        if (e.startsWith("*.")) {
          const base = e.slice(2).replace(/\./g, "\\.");
          return `([a-z0-9-]+\\.)*${base}`;
        }
        return e.replace(/\./g, "\\.");
      });
      
      // We need to use allowAllRequests to NOT modify excluded domains
      // Actually, simpler approach: just don't match excluded domains in main rule
      // Rebuild with negative lookahead or separate logic
      
      // For simplicity, we'll handle excludes in the main regex
      // Rebuild the rule with excludes baked in
      rules.pop(); // Remove the rule we just added
      
      let finalRegex;
      if (targets.length > 0) {
        const targetPatterns = targets.map(t => {
          if (t.startsWith("*.")) {
            const base = t.slice(2).replace(/\./g, "\\.");
            return `([a-z0-9-]+\\.)*${base}`;
          }
          return t.replace(/\./g, "\\.");
        });
        finalRegex = `^https?://(${targetPatterns.join("|")})(/.*)?$`;
      } else {
        // Match all except excludes - use excludedRequestDomains instead
        const finalRule = {
          id: ruleId++,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: activeHeaders.map(h => ({
              header: h.name,
              operation: "set",
              value: h.value
            }))
          },
          condition: {
            resourceTypes: resourceTypes,
            excludedRequestDomains: excludes.map(e => e.startsWith("*.") ? e.slice(2) : e)
          }
        };
        
        if (requestMethods) {
          finalRule.condition.requestMethods = requestMethods;
        }
        
        rules.push(finalRule);
        finalRegex = null;
      }
      
      if (finalRegex) {
        const finalRule = {
          id: ruleId++,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: activeHeaders.map(h => ({
              header: h.name,
              operation: "set",
              value: h.value
            }))
          },
          condition: {
            regexFilter: finalRegex,
            excludedRequestDomains: excludes.map(e => e.startsWith("*.") ? e.slice(2) : e),
            resourceTypes: resourceTypes
          }
        };
        
        if (requestMethods) {
          finalRule.condition.requestMethods = requestMethods;
        }
        
        rules.push(finalRule);
      }
    }
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
    updateBadge(requestCount, true);
  } catch (e) {
    console.error("Failed to apply rules:", e);
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["enabled", "profiles", "activeProfile"]);
  if (data.enabled && data.profiles && data.activeProfile) {
    await applyRules({
      enabled: data.enabled,
      profile: data.profiles[data.activeProfile]
    });
  }
});

// Re-apply on startup
chrome.runtime.onStartup.addListener(async () => {
  requestCount = 0;
  const data = await chrome.storage.local.get(["enabled", "profiles", "activeProfile"]);
  if (data.enabled && data.profiles && data.activeProfile) {
    await applyRules({
      enabled: data.enabled,
      profile: data.profiles[data.activeProfile]
    });
  }
});
