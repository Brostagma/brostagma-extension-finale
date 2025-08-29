// src/ui/panel.js
// Panel kabı + mini/persist + progress + (YENİ) dsOverlay açıkken panel kilidi
(function (ns) {
  ns.state = ns.state || { open: false, mini: false };

  let progressEl = null;
  let bodyEl = null;

  // 🔒 Panel kilit overlay
  let lockEl = null;
  let lockMsgEl = null;

  const KEY_STATE = 'panel:state';

  // Güvenli başlangıç boyutu (resize.js sonrasında persistten restore eder)
  const DEFAULT_W = 500;
  const DEFAULT_H = 520;

  async function readState() {
    try {
      if (ns.storage?.get) return await ns.storage.get(KEY_STATE, null);
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const out = await new Promise((r)=>chrome.storage.local.get(KEY_STATE,(v)=>r(v)));
        return out?.[KEY_STATE] || null;
      }
    } catch {}
    try {
      const raw = localStorage.getItem(KEY_STATE);
      return raw ? JSON.parse(raw) : null;
    } catch {}
    return null;
  }
  async function writeState(patch) {
    const curr = (await readState()) || {};
    const next = { ...curr, ...patch };
    try {
      if (ns.storage?.set) return await ns.storage.set(KEY_STATE, next);
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await new Promise((r)=>chrome.storage.local.set({ [KEY_STATE]: next }, r));
        return;
      }
    } catch {}
    try { localStorage.setItem(KEY_STATE, JSON.stringify(next)); } catch {}
  }

  function ensureProgressBelowCounters() {
    if (!bodyEl) return;
    if (progressEl?.isConnected) return;

    const countersCard =
      document.querySelector('.br-counters') ||
      document.querySelector('.br-card');

    progressEl = document.createElement('div');
    progressEl.className = 'br-progress';
    progressEl.innerHTML = `<div class="br-progress__fill" style="width:0%"></div>`;

    if (countersCard && countersCard.parentNode) {
      countersCard.parentNode.insertBefore(progressEl, countersCard.nextSibling);
    } else {
      bodyEl.prepend(progressEl);
    }
  }

  function setProgress({ value = null, color = 'accent' } = {}) {
    if (!progressEl) return;
    const fill = progressEl.querySelector('.br-progress__fill');
    progressEl.classList.remove('br-progress--accent','br-progress--success','br-progress--warn','br-progress--error','br-progress--indeterminate');
    progressEl.classList.add(`br-progress--${color}`);

    if (value === null) {
      progressEl.classList.add('br-progress--indeterminate');
      fill.style.width = '100%';
    } else {
      progressEl.classList.remove('br-progress--indeterminate');
      const pct = Math.max(0, Math.min(1, value)) * 100;
      fill.style.width = pct.toFixed(1) + '%';
    }
  }

  // 🔒 Panel kilidi: inline stil + overlay node
  function ensureLockStyles(){
    if (document.getElementById('br-panel-lock-styles')) return;
    const css = `
      #br-panel .br-panel-lock{
        position:absolute; inset:0; display:none; align-items:center; justify-content:center;
        background: rgba(8,12,24,.55);
        backdrop-filter: blur(1.5px); -webkit-backdrop-filter: blur(1.5px);
        z-index: 5; pointer-events: auto;
      }
      #br-panel .br-panel-lock__card{
        background: rgba(28, 32, 44, 0.85); color:#f0f2f6;
        border: 1px solid rgba(255,255,255,.12); border-radius: 12px;
        padding: 10px 12px; box-shadow: 0 12px 32px rgba(0,0,0,.35);
        font-size: 13px; font-weight: 600; white-space: nowrap;
      }
    `;
    const style = document.createElement('style');
    style.id = 'br-panel-lock-styles';
    style.textContent = css;
    document.documentElement.appendChild(style);
  }
  function ensureLockOverlay(){
    if (!ns.panel?.el) return;
    if (lockEl?.isConnected) return;
    ensureLockStyles();
    lockEl = document.createElement('div');
    lockEl.className = 'br-panel-lock';
    const card = document.createElement('div');
    card.className = 'br-panel-lock__card';
    lockMsgEl = document.createElement('div');
    lockMsgEl.className = 'br-panel-lock__msg';
    lockMsgEl.textContent = 'Arka plan denetimi sürüyor…';
    card.appendChild(lockMsgEl);
    lockEl.appendChild(card);
    ns.panel.el.appendChild(lockEl);
  }
  function setLock(on, text){
    ensureLockOverlay();
    if (typeof text === 'string' && lockMsgEl) lockMsgEl.textContent = text;
    if (lockEl) lockEl.style.display = on ? 'flex' : 'none';
  }

  ns.panel = {
    el: null,
    headerEl: null,
    bodyEl: null,

    create() {
      if (this.el) return; // idempotent

      const root = document.createElement('div');
      root.id = 'br-panel';

      const header = document.createElement('div');
      header.className = 'br-header';

      const body = document.createElement('div');
      body.className = 'br-body';

      root.append(header, body);
      document.documentElement.appendChild(root);

      // 🧩 Güvenli başlangıç boyutu (ufacık başlamasın)
      try {
        root.style.width = `${DEFAULT_W}px`;
        root.style.setProperty('--br-panel-h', `${DEFAULT_H}px`);
      } catch {}

      this.el = root;
      this.headerEl = header;
      this.bodyEl = body;
      bodyEl = body;
      ns.state.open = true;

      // Varsayılan accent
      root.style.setProperty('--br-accent', '#7A2FFF');
      root.style.setProperty('--br-accent-strong', '#9B5CFF');

      // ❗ İlk açılışta daima büyük mod
      this.setMini(false);

      // Kilit overlay'i hazırla (görünmez)
      ensureLockOverlay();

      // Panel yaratıldı sinyali (resize.js burada handle ekler ve boyutu persistten restore eder)
      document.dispatchEvent(new CustomEvent('br:panel:created'));

      // Progress yerleşimi
      const oncePlace = () => {
        ensureProgressBelowCounters();
        document.removeEventListener('br:counters:updated', oncePlace);
      };
      document.addEventListener('br:counters:updated', oncePlace);
      requestAnimationFrame(ensureProgressBelowCounters);

      // 🔁 Yalnızca boyutu geri yüklemek için restore sinyali gönder
      // Mini persist'ini burada UYGULAMIYORUZ → ilk açılışta mini yok.
      setTimeout(async () => {
        document.dispatchEvent(new CustomEvent('br:panel:restore'));
      }, 0);
    },

    destroy() {
      if (!this.el) return;
      document.dispatchEvent(new CustomEvent('br:panel:destroyed'));
      this.el.remove();
      this.el = this.headerEl = this.bodyEl = null;
      bodyEl = null;
      progressEl = null;
      lockEl = null; lockMsgEl = null;
      ns.state.open = false;
    },

    toggle() { ns.state.open ? this.destroy() : this.create(); },

    async setMini(on) {
      ns.state.mini = !!on;
      if (this.el) {
        this.el.classList.toggle('br--mini', ns.state.mini);
      }
      await writeState({ mini: ns.state.mini });
      document.dispatchEvent(new CustomEvent('br:panel:mini', { detail: { mini: ns.state.mini } }));
    },
    toggleMini() { this.setMini(!ns.state.mini); },

    getHeader() { return this.headerEl; },
    getBody() { return this.bodyEl; },

    setProgress,
    lock: setLock
  };

  // ======= Event API (mevcut) =======
  document.addEventListener('br:progress:set', (e) => setProgress(e.detail || {}));
  document.addEventListener('br:status:set', (e) => {
    const d = e.detail || {};
    setProgress({ value: d.progress ?? null, color:
      d.type === 'success' ? 'success' :
      d.type === 'warning' ? 'warn' :
      d.type === 'error'   ? 'error' : 'accent'
    });
  });

  // ======= YENİ: dsOverlay açık/kapalı iken paneli kilitle =======
  document.addEventListener('br:ds:overlay:open', () => setLock(true, 'Arka plan denetimi sürüyor…'));
  document.addEventListener('br:ds:overlay:close', () => setLock(false));
  document.addEventListener('br:ds:drained', () => setLock(false)); // emniyet

  if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'TOGGLE_PANEL') ns.panel.toggle();
    });
  }
})(window.BR = window.BR || {});
