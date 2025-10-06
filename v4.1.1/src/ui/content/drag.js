// src/ui/drag.js
// ----------------------------------------------------
// Paneli başlıktan sürükleme + konum persist.
// Kalıcı kayıt: 'panel:state' { left, top, width?, height?, mini? }  (BR.storage varsa onu kullanır)
// Geriye dönük uyumluluk: eski 'br_panel_pos' { left, top } okunur → 'panel:state' içine migrate.
//
// Sıra garantisi:
// - br:panel:created -> dinleyiciler eklenir
// - br:panel:size-restored -> POS kesin uygulanır (boyut restore SONRASI)
// - rAF -> emniyet amaçlı POS uygulanır (ilk frame’de)
//
// Ayrıca: window:resize & br:panel:resized -> ekranda clamp + kaydet
// ----------------------------------------------------
(function (ns) {
  const KEY_STATE  = 'panel:state';
  const LEGACY_POS = 'br_panel_pos';

  // ---- storage helpers (BR.storage varsa onu tercih et) ----
  async function readState() {
    try {
      if (ns.storage?.get) return await ns.storage.get(KEY_STATE, null);
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const out = await chrome.storage.local.get(KEY_STATE);
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
        await chrome.storage.local.set({ [KEY_STATE]: next });
        return;
      }
    } catch {}
    try {
      localStorage.setItem(KEY_STATE, JSON.stringify(next));
    } catch {}
  }

  // Eski anahtardan migrate
  async function migrateLegacyPosIfNeeded() {
    const has = await readState();
    if (has && Number.isFinite(has.left) && Number.isFinite(has.top)) return;
    // legacy oku
    try {
      let legacy = null;
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const out = await chrome.storage.local.get(LEGACY_POS);
        legacy = out?.[LEGACY_POS] || null;
      } else {
        const raw = localStorage.getItem(LEGACY_POS);
        legacy = raw ? JSON.parse(raw) : null;
      }
      if (legacy && Number.isFinite(legacy.left) && Number.isFinite(legacy.top)) {
        await writeState({ left: legacy.left, top: legacy.top });
      }
    } catch {}
  }

  function applyPos(panel, left, top) {
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.right = 'auto';
  }

  function clampToViewport(panel, wantLeft, wantTop) {
    const rect = panel.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const minLeft = 0, minTop = 0;
    const maxLeft = Math.max(0, window.innerWidth - w);
    const maxTop = Math.max(0, window.innerHeight - h);
    return {
      left: Math.min(Math.max(wantLeft, minLeft), maxLeft),
      top: Math.min(Math.max(wantTop, minTop), maxTop)
    };
  }

  async function restorePos(panel) {
    await migrateLegacyPosIfNeeded();
    const st = await readState();
    if (st && Number.isFinite(st.left) && Number.isFinite(st.top)) {
      const c = clampToViewport(panel, st.left, st.top);
      applyPos(panel, c.left, c.top);
      return true;
    }
    return false;
  }

  function enableDrag() {
    const panel = document.getElementById('br-panel');
    if (!panel) return;
    const header = panel.querySelector('.br-header');
    if (!header) return;

    // 1) Boyut restore edildikten SONRA pos'u kesin uygula
    const onSizeRestored = () => { restorePos(panel); };
    document.addEventListener('br:panel:size-restored', onSizeRestored);

    // 2) Emniyet: ilk frame’de de pos dene
    requestAnimationFrame(() => { restorePos(panel); });

    let sx = 0, sy = 0, px = 0, py = 0, dragging = false;

    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true;

      const rect = panel.getBoundingClientRect();
      panel.style.left = rect.left + 'px';
      panel.style.top  = rect.top  + 'px';
      panel.style.right = 'auto';

      sx = e.clientX; sy = e.clientY; px = rect.left; py = rect.top;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const wantLeft = px + (e.clientX - sx);
      const wantTop  = py + (e.clientY - sy);
      const c = clampToViewport(panel, wantLeft, wantTop);
      applyPos(panel, c.left, c.top);
    });

    window.addEventListener('mouseup', async () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      const left = parseInt(panel.style.left || '0', 10) || 0;
      const top  = parseInt(panel.style.top  || '0', 10) || 0;
      await writeState({ left, top }); // 🔒 tek anahtar
      document.dispatchEvent(new CustomEvent('br:panel:moved', { detail: { left, top } }));
    });

    const reclamp = async () => {
      const left = parseInt(panel.style.left || '0', 10) || 0;
      const top  = parseInt(panel.style.top  || '0', 10) || 0;
      const c = clampToViewport(panel, left, top);
      applyPos(panel, c.left, c.top);
      await writeState({ left: c.left, top: c.top });
    };
    window.addEventListener('resize', reclamp);
    panel.addEventListener('br:panel:resized', reclamp);

    const cleanup = () => {
      document.removeEventListener('br:panel:size-restored', onSizeRestored);
      window.removeEventListener('resize', reclamp);
      panel.removeEventListener('br:panel:resized', reclamp);
      document.removeEventListener('br:panel:destroyed', cleanup);
    };
    document.addEventListener('br:panel:destroyed', cleanup);
  }

  document.addEventListener('br:panel:created', enableDrag);
  if (ns.panel?.el) enableDrag();
})(window.BR = window.BR || {});
