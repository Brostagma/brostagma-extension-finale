// src/test/campaigns.test.js

(function () {
  // Test-spesifik log alanı
  let logEl = null;

  function log(msg, isError = false) {
    if (!logEl) return;
    const t = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = isError ? 'tst-log-line tst-log--error' : 'tst-log-line';
    line.textContent = `[${t}] ${msg}`;
    logEl.prepend(line);
  }

  function assert(condition, message) {
    if (condition) {
      log(`✅ PASS: ${message}`);
    } else {
      log(`❌ FAIL: ${message}`, true);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Test senaryosunu çalıştır
  async function runCampaignFilterTest() {
    log('Campaign filter test started.');

    // 1. Gerekli ortamı hazırla
    // Sahte bir ürün kartı oluştur
    const fakeCard = document.createElement('div');
    fakeCard.className = 'p-card-wrppr';
    fakeCard.innerHTML = `
      <div class="prdct-desc-cntnr-ttl">Marka</div>
      <div class="prdct-desc-cntnr-name">Ürün Adı</div>
      <div class="prc-box-dscntd">100 TL</div>
      <a href="/link/to/product"></a>
    `;
    document.body.appendChild(fakeCard);
    log('Fake product card created.');

    // Gerekli BR objelerini ve metodlarını mock'la
    window.BR = window.BR || {};
    window.BR.match = {
      checkBundle: () => ({ ok: true, /* Diğer detaylar... */ })
    };
    window.BR.campaignsMatch = {
      // Bu test için accept'in ne döndürdüğü önemli değil,
      // çünkü her iki durumda da DS'e gitmeli.
      accept: () => true
    };
    window.BR.storage = { get: () => Promise.resolve([]) }; // Negatif filtre için
    log('Mock BR objects created.');

    // 2. Olay dinleyicisi ekle (DS kuyruğunu dinle)
    let dsEnqueued = false;
    let enqueuedDetail = null;
    document.addEventListener('br:ds:enqueue', (e) => {
      dsEnqueued = true;
      enqueuedDetail = e.detail;
      log('br:ds:enqueue event caught.');
    });

    // 3. Tarama işlemini tetikle
    log('Dispatching br:scan:start event...');
    document.dispatchEvent(new CustomEvent('br:scan:start', {
      detail: { selector: '.p-card-wrppr' }
    }));

    // Taramanın tamamlanması için kısa bir süre bekle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Sonuçları doğrula
    try {
      assert(dsEnqueued, 'Product should be enqueued for deep scan.');
      assert(enqueuedDetail !== null, 'Enqueue event detail should not be null.');
      if (enqueuedDetail) {
        assert(enqueuedDetail.checkCampaignOnly === true, 'Enqueue reason should be for campaign check.');
        assert(enqueuedDetail.bundle.brandText === 'Marka', 'Brand text should be correct.');
      }
      log('All assertions passed.');
    } catch (err) {
      console.error(err);
    } finally {
      // Temizlik
      fakeCard.remove();
      delete window.BR.match;
      delete window.BR.campaignsMatch;
      log('Test finished and cleaned up.');
    }
  }

  // Debug paneline test butonu ekle
  function addTestButtonToDebugPanel() {
    const debugBody = document.querySelector('#br-debug .dbg-body');
    if (!debugBody) {
      // Debug paneli yoksa bekleyip tekrar dene
      setTimeout(addTestButtonToDebugPanel, 500);
      return;
    }

    const row = document.createElement('div');
    row.className = 'dbg-row';

    const btn = document.createElement('button');
    btn.className = 'dbg-btn dbg-btn--special';
    btn.textContent = '▶️ Run Campaign Filter Test';
    btn.onclick = runCampaignFilterTest;
    row.appendChild(btn);

    logEl = document.createElement('div');
    logEl.className = 'dbg-log tst-log';
    row.appendChild(logEl);

    // Stilleri ekle
    const style = document.createElement('style');
    style.textContent = `
      .dbg-btn--special { background-color: #5e35b1; color: white; }
      .tst-log { border: 1px solid #444; margin-top: 8px; padding: 6px; max-height: 150px; overflow-y: auto; font-size: 11px; }
      .tst-log-line { margin-bottom: 4px; }
      .tst-log--error { color: #ff8a80; font-weight: bold; }
    `;
    document.head.appendChild(style);

    debugBody.prepend(row);
  }

  // Debug paneli hazır olduğunda butonu ekle
  document.addEventListener('br:panel:created', () => {
    addTestButtonToDebugPanel();
  });
})();