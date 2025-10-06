// src/ui/content/resize.js
// Panel yeniden boyutlandırma + kalıcı state (BR.storage üzerinden 'panel:state')
// Mini mod geçişlerinde güvenli boyut saklama/geri yükleme akışı
(function(ns){
  const PANEL_ID = 'br-panel';
  const HANDLE_CLASS = 'br-resize';

  // Sınırlar
  const MIN_W = 500, MAX_W = 880;
  const MIN_H = 140;

  let panel = null, body = null, header = null, handle = null;
  let startX=0, startY=0, startW=0, startH=0;
  let resizing=false, raf=null;

  // mini öncesi son boyut (session)
  let prevSize=null;

  // ---- storage helpers (BR.storage üzerinden) ----
  const KEY = 'panel:state';
  async function readState(){
    try {
      if (ns.storage?.get) return await ns.storage.get(KEY, null);
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const out = await chrome.storage.local.get(KEY);
        return out?.[KEY] || null;
      }
    } catch {}
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {}
    return null;
  }
  async function writeState(patch){
    const curr = (await readState()) || {};
    const next = { ...curr, ...patch };
    try {
      if (ns.storage?.set) return await ns.storage.set(KEY, next);
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({ [KEY]: next });
        return;
      }
    } catch {}
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }

  // Yardımcılar
  const q = (root, sel) => root && root.querySelector(sel);

  function headerHeight(){
    return header?.getBoundingClientRect().height ?? 40;
  }

  function clampToViewport(w,h){
    const rect = panel.getBoundingClientRect();
    const maxW = Math.max(MIN_W, Math.min(MAX_W, window.innerWidth - rect.left - 6));
    const maxH = Math.max(MIN_H, window.innerHeight - rect.top - 6);
    return {
      w: Math.min(Math.max(MIN_W, w), maxW),
      h: Math.min(Math.max(MIN_H, h), maxH),
    };
  }

  function setWH(w,h,{silent=false}={}){
    const W = Math.round(w), H = Math.round(h);
    panel.style.width = `${W}px`;
    panel.style.height = `${H}px`;
    panel.style.setProperty('--br-panel-h', `${H}px`);

    // Body'nin kaydırılabilir yüksekliğini güncelle
    const hdr = headerHeight();
    const statusH = 0;
    if (body) {
      const maxH = Math.max(0, H - hdr - statusH);
      body.style.maxHeight = `${maxH}px`;
      body.style.overflow = 'auto';
    }

    if (!silent){
      panel.dispatchEvent(new CustomEvent('br:panel:resized', { bubbles:true, detail:{ w:W, h:H } }));
    }
  }

  function ensureHandle(){
    handle = q(panel, `.${HANDLE_CLASS}`);
    if (!handle){
      handle = document.createElement('div');
      handle.className = HANDLE_CLASS;
      panel.appendChild(handle);
    }
    handle.style.touchAction = 'none';
    handle.style.cursor = 'nwse-resize';
  }

  // Pointer olayları
  function onPointerDown(e){
    if (panel.classList.contains('br--mini')) return;       // mini iken resize kapalı
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const rect = panel.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startW = rect.width; startH = rect.height;

    resizing = true;
    try{ handle.setPointerCapture(e.pointerId); }catch{}
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    document.body.style.userSelect = 'none';
    handle.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onPointerMove(e){
    if (!resizing) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const next = clampToViewport(startW + dx, startH + dy);

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(async () => {
      setWH(next.w, next.h);
      await writeState({ width: next.w, height: next.h });
    });
  }

  function onPointerUp(e){
    if (!resizing) return;
    resizing = false;
    try{ handle.releasePointerCapture(e.pointerId); }catch{}
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('pointercancel', onPointerUp, true);
    document.body.style.userSelect = '';
    handle.style.cursor = 'nwse-resize';
  }

  // Mini mod geçişleri — sabit mini genişlik (CSS: 300px)
  async function onMini(e){
    const isMini = !!(e?.detail?.mini);
    if (isMini){
      // Şu anki boyutu sakla
      const r = panel.getBoundingClientRect();
      prevSize = { w: Math.round(r.width), h: Math.round(r.height) };
      await writeState({ width: prevSize.w, height: prevSize.h });

      // ❗ Miniye girerken inline width/height'ı temizle → CSS sabit 300px devreye girsin
      panel.style.width = '';
      panel.style.height = '';
      panel.style.removeProperty('--br-panel-h'); // mini'de body zaten 0; değişken gerekmiyor

      // Tutamağı gizle
      if (handle) handle.style.display = 'none';
    } else {
      // Mini kapandı → kaydedilmiş boyutu geri yükle
      const saved = await readState();
      const baseW = saved?.width ?? prevSize?.w ?? 500;
      const baseH = saved?.height ?? prevSize?.h ?? 500;
      const clamped = clampToViewport(baseW, baseH);

      requestAnimationFrame(() => {
        setWH(clamped.w, clamped.h);
        if (handle) handle.style.display = '';
      });
    }
  }

  // İlk açılışta boyutu geri yükle
  async function restoreSize(){
    const saved = await readState();
    if (saved?.width && saved?.height && !panel.classList.contains('br--mini')){
      const clamped = clampToViewport(saved.width, saved.height);
      setWH(clamped.w, clamped.h, { silent:true });
      document.dispatchEvent(new CustomEvent('br:panel:size-restored', { detail: clamped }));
      return true;
    }
    return false;
  }

  function onWindowResize(){
    if (!panel || panel.classList.contains('br--mini')) return;
    const r = panel.getBoundingClientRect();
    const clamped = clampToViewport(r.width, r.height);
    setWH(clamped.w, clamped.h, { silent:true });
    writeState({ width: clamped.w, height: clamped.h });
  }

  async function attach(){
    panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    body = q(panel, '.br-body');
    header = q(panel, '.br-header');

    ensureHandle();
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointerdown', onPointerDown);

    // Panel restore sinyali geldiğinde boyutu uygula
    const restoreOnce = async () => { await restoreSize(); };
    document.addEventListener('br:panel:restore', restoreOnce, { once:true });

    // İlk mount’ta da dene
    const ok = await restoreSize();
    if (!ok){
      const defaultW = 625, defaultH = 625;
      const clamped = clampToViewport(defaultW, defaultH);
      setWH(clamped.w, clamped.h, { silent:true });
      await writeState({ width: clamped.w, height: clamped.h });
      document.dispatchEvent(new CustomEvent('br:panel:size-restored', { detail: clamped }));
    }

    window.addEventListener('resize', onWindowResize);
    document.addEventListener('br:panel:mini', onMini);
  }

  function detach(){
    window.removeEventListener('resize', onWindowResize);
    document.removeEventListener('br:panel:mini', onMini);
    document.removeEventListener('br:panel:restore', restoreSize);
    panel = body = header = handle = null;
    prevSize = null;
  }

  document.addEventListener('br:panel:created', attach);
  document.addEventListener('br:panel:destroyed', detach);

  if (document.readyState === 'complete' || document.readyState === 'interactive') attach();
  else document.addEventListener('DOMContentLoaded', attach);
})(window.BR = window.BR || {});
