// src/core/storage.js
// Minimal, güvenli ve await'li depolama katmanı.
// API: storage.get(key, defaultVal), storage.set(key, val), storage.remove(key), storage.clear()

(function (ns) {
  const hasChrome = typeof chrome !== "undefined" && chrome?.storage?.local;

  function getChrome(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (res) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          // Hata durumunda default'a bırakacağız
          resolve(undefined);
          return;
        }
        resolve(res ? res[key] : undefined);
      });
    });
  }

  function setChrome(kv) {
    return new Promise((resolve) => {
      chrome.storage.local.set(kv, () => resolve());
    });
  }

  function removeChrome(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, () => resolve());
    });
  }

  function clearChrome() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => resolve());
    });
  }

  async function get(key, defaultVal = null) {
    try {
      if (hasChrome) {
        const v = await getChrome(key);
        return typeof v === "undefined" ? defaultVal : v;
      }
    } catch {}
    // Fallback: localStorage
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultVal : JSON.parse(raw);
    } catch {
      return defaultVal;
    }
  }

  async function set(key, value) {
    try {
      if (hasChrome) {
        await setChrome({ [key]: value });
        return;
      }
    } catch {}
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  async function remove(key) {
    try {
      if (hasChrome) {
        await removeChrome(key);
        return;
      }
    } catch {}
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  async function clear() {
    try {
      if (hasChrome) {
        await clearChrome();
        return;
      }
    } catch {}
    try {
      localStorage.clear();
    } catch {}
  }

  ns.storage = { get, set, remove, clear };
})(window.BR = window.BR || {});
