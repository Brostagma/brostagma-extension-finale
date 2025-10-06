// Global toast sistemi: br:toast:show ile çağır.
// detail: { type: 'info'|'success'|'warning'|'error', message: string, duration?: ms, undoText?: string, undoEvent?: string, undoPayload?: any }

(() => {
  const TYPES = new Set(['info','success','warning','error']);
  let stack = null;

  const EMOJI = {
    success: '✅',
    warning: '⚠️',
    error:   '❌',
    info:    'ℹ️'
  };

  function ensureStack() {
    stack = document.querySelector('.br-toaststack-global');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'br-toaststack-global';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function showToast({ type='info', message='', duration=3500, undoText, undoEvent, undoPayload } = {}) {
    const root = ensureStack();
    if (!TYPES.has(type)) type = 'info';

    const el = document.createElement('div');
    el.className = `br-toast br-toast--${type}`;
    el.innerHTML = `
      <div class="br-toast__emj">${EMOJI[type] || EMOJI.info}</div>
      <div class="br-toast__content">${message}</div>
      <div class="br-toast__actions">
        ${undoText ? `<button class="br-toast__undo" type="button">${undoText}</button>` : ''}
        <button class="br-toast__close" type="button" aria-label="Kapat">×</button>
      </div>
      <div class="br-toast__progress"></div>
    `;
    root.appendChild(el);

    const btnClose = el.querySelector('.br-toast__close');
    const btnUndo  = el.querySelector('.br-toast__undo');
    const bar      = el.querySelector('.br-toast__progress');

    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 200);
    };

    btnClose?.addEventListener('click', close);

    if (btnUndo) {
      btnUndo.addEventListener('click', () => {
        if (undoEvent) document.dispatchEvent(new CustomEvent(undoEvent, { detail: undoPayload }));
        close();
      });
    }

    // Auto-dismiss + progress
    if (duration > 0) {
      requestAnimationFrame(() => { bar.style.width = '100%'; bar.style.transitionDuration = duration + 'ms'; });
      const t = setTimeout(close, duration + 40);

      // hover → durdur / devam ettir
      el.addEventListener('mouseenter', () => {
        bar.style.transitionDuration = '0ms';
        bar.style.width = getComputedStyle(bar).width; // mevcut genişliği kilitle
        clearTimeout(t);
      });
      el.addEventListener('mouseleave', () => {
        const leftPct = 100 - (parseFloat(getComputedStyle(bar).width) / el.clientWidth) * 100;
        const remain = duration * (leftPct/100);
        bar.style.transitionDuration = remain + 'ms';
        requestAnimationFrame(() => { bar.style.width = '100%'; });
        setTimeout(close, remain + 60);
      });
    }
  }

  // Public event API
  document.addEventListener('br:toast:show', (e) => showToast(e.detail || {}));

  // Panel mini toggle
  document.addEventListener('br:panel:mini', (e) => {
    const on = !!(e.detail && e.detail.mini);
    showToast({ type:'info', message: on ? 'Mini mod açıldı' : 'Mini mod kapatıldı', duration: 2200 });
  });

  // Kampanya toggle
  document.addEventListener('br:campaigns:changed', (e) => {
    const d = e.detail || {};
    showToast({
      type: d.selected ? 'success' : 'warning',
      message: `${d.label} ${d.selected ? 'açık' : 'kapalı'}`,
      duration: 2400
    });
  });

  // İşlem butonları (eski)
  document.addEventListener('br:actions:match', () => {
    showToast({ type:'info', message:'Eşleştirme başlatıldı', duration: 2000 });
  });
  document.addEventListener('br:actions:export', () => {
    showToast({ type:'info', message:'CSV hazırlanıyor', duration: 2000 });
  });

  // 🔹 Tarama başlangıç/durdurma
  document.addEventListener('br:scan:start', () => {
    showToast({ type:'success', message:'Tarama başladı', duration: 1800 });
  });
  document.addEventListener('br:scan:stop', () => {
    showToast({ type:'warning', message:'Tarama durduruldu', duration: 1800 });
  });

  // 🔹 Hedef liste akışı
  document.addEventListener('br:targets:upload:ok',    () => showToast({ type:'success', message:'Hedef liste yüklendi', duration: 2200 }));
  document.addEventListener('br:targets:upload:error', () => showToast({ type:'error',   message:'Hedef liste yüklenemedi', duration: 2600 }));
  document.addEventListener('br:targets:download:ok',  () => showToast({ type:'success', message:'Ayıklananlar indirildi', duration: 2200 }));
  document.addEventListener('br:targets:download:na',  () => showToast({ type:'warning', message:'Henüz indirilecek veri yok', duration: 2200 }));

  // Stack hazır olsun
  if (document.readyState === 'complete' || document.readyState === 'interactive') ensureStack();
  else document.addEventListener('DOMContentLoaded', ensureStack);
})();
