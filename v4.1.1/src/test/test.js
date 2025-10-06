// src/test/test.js
// =======================================================
// KALICI DEBUG PANELİ (sadece test amaçlı).
// - Sol-alt mini panel: Taranan +1, Eşleşen +1, Reset
// - Seçili kampanyaları göster / örnek seçim uygula
// - Actions durum yazısını güncelle
// - 🔸 Rastgele Tara / Rastgele Eşleştir test butonları
// =======================================================
(function () {
  let root = null;
  let logEl = null;

  // Güvenli text log yazıcı
  function log(msg) {
    if (!logEl) return;
    const t = (new Date()).toLocaleTimeString();
    logEl.textContent = `[${t}] ${msg}\n` + logEl.textContent;
    logEl.scrollTop = 0;
  }

  // Paneli oluştur
  function createDebugPanel() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'br-debug';

    // header
    const header = document.createElement('div');
    header.className = 'dbg-header';

    const title = document.createElement('div');
    title.className = 'dbg-title';
    title.textContent = 'Debug Panel';

    const close = document.createElement('button');
    close.className = 'dbg-close';
    close.type = 'button';
    close.textContent = '×';
    close.title = 'Kapat';
    close.addEventListener('click', () => {
      root.remove();
      root = null;
    });

    header.append(title, close);

    // body
    const body = document.createElement('div');
    body.className = 'dbg-body';

    // --- Sayaçlar satırı ---
    const rowCounters = document.createElement('div');
    rowCounters.className = 'dbg-row';

    const btnTotal = mkBtn('Taranan +1', () => {
      ensurePanelOpen();
      const t = getSafeNumber(getText('.br-counters__value', 0));
      BR.counters.set({ total: t + 1 });
      log(`Taranan -> ${t + 1}`);
    });

    const btnMatch = mkBtn('Eşleşen +1', () => {
      ensurePanelOpen();
      const t = getSafeNumber(getText('.br-counters__value', 0));
      const m = getSafeNumber(getText('.br-counters__value', 1));
      const next = m + 1;
      BR.counters.set({ match: next });
      log(`Eşleşen -> ${next} (Total=${t})`);
    });

    const btnReset = mkBtn('Reset', () => {
      ensurePanelOpen();
      BR.counters.set({ total: 0, match: 0, ratio: 0 });
      log(`Sayaçlar sıfırlandı`);
    });

    rowCounters.append(btnTotal, btnMatch, btnReset);

    // --- Kampanya satırı ---
    const rowCamps = document.createElement('div');
    rowCamps.className = 'dbg-row';

    const btnShowSel = mkBtn('Seçili kampanyaları göster', () => {
      ensurePanelOpen();
      try {
        const arr = BR.campaigns.getSelected();
        log(`Seçili: ${JSON.stringify(arr)}`);
      } catch (e) {
        log('Hata: BR.campaigns yok veya panel kapalı');
      }
    });

    const btnApplySel = mkBtn('Örnek seçim uygula', () => {
      ensurePanelOpen();
      try {
        BR.campaigns.setSelected(['X Al Y Öde', 'Birlikte Al Kazan', 'Yetkili Satıcı']);
        log('Örnek seçim uygulandı');
      } catch (e) {
        log('Hata: BR.campaigns yok veya panel kapalı');
      }
    });

    rowCamps.append(btnShowSel, btnApplySel);

    // --- Actions / Status satırı ---
    const rowStatus = document.createElement('div');
    rowStatus.className = 'dbg-row';

    const btnStatus1 = mkBtn('Status: Hazırlanıyor', () => {
      ensurePanelOpen();
      BR.actions?.setStatus?.('Hazırlanıyor…');
      log('Status -> Hazırlanıyor…');
    });

    const btnStatus2 = mkBtn('Status: Tamamlandı', () => {
      ensurePanelOpen();
      BR.actions?.setStatus?.('Tamamlandı.');
      log('Status -> Tamamlandı.');
    });

    rowStatus.append(btnStatus1, btnStatus2);

    // --- 🔸 Test: Rastgele Tara / Rastgele Eşleştir ---
    const rowScan = document.createElement('div');
    rowScan.className = 'dbg-row';

    const btnScanOne = mkBtn('Rastgele Tara', () => {
      const el = pickRandomVisible('.p-card-wrppr');
      if (!el) return log('Görünür kart bulunamadı.');
      document.dispatchEvent(new CustomEvent('br:scan:highlight', { detail: { el, state: 'scanning' } }));
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('br:scan:highlight', { detail: { el, state: 'done' } }));
      }, 1500);
      log('Rastgele kart tarandı (1.5s).');
    });

    const btnMatchOne = mkBtn('Rastgele Eşleştir', () => {
      const el = pickRandomVisible('.p-card-wrppr');
      if (!el) return log('Görünür kart bulunamadı.');
      try { el.setAttribute('data-br-match', '1'); } catch {}
      document.dispatchEvent(new CustomEvent('br:scan:highlight', { detail: { el, state: 'match' } }));
      setTimeout(() => { try { el.removeAttribute('data-br-match'); } catch {} }, 1600);
      log('Rastgele kart eşleşme efekti gösterdi.');
    });

    rowScan.append(btnScanOne, btnMatchOne);

    // --- Log alanı ---
    logEl = document.createElement('div');
    logEl.className = 'dbg-log';
    logEl.textContent = 'Debug log hazır.\n';

    body.append(rowCounters, rowCamps, rowStatus, rowScan, logEl);
    root.append(header, body);
    document.documentElement.appendChild(root);
  }

  // Küçük yardımcılar
  function mkBtn(text, onClick) {
    const b = document.createElement('button');
    b.className = 'dbg-btn';
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function ensurePanelOpen() {
    if (!BR?.panel?.el) {
      BR?.panel?.create?.();
    }
  }

  function getSafeNumber(s) {
    const n = Number(String(s).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function getText(selector, index) {
    const list = document.querySelectorAll(selector);
    return list[index]?.textContent ?? '0';
  }

  function pickRandomVisible(selector){
    const els = Array.from(document.querySelectorAll(selector));
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const visible = els.filter(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh;
    });
    if (visible.length === 0) return null;
    return visible[Math.floor(Math.random() * visible.length)];
  }

  // Panel oluşturulunca otomatik debug panelini de göster
  document.addEventListener('br:panel:created', () => {
    createDebugPanel();
  });
})();
