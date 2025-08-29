// src/ui/header.js
// =======================================================
// Başlık bileşeni: mini/close + mini rozetler.
// Mini modda Tüm sayaçlar (🧭 Tar, 🎯 Eş, 📈 %, 📥 DTQ, ⚡ DTA)
// =======================================================

(function (ns) {
  // Mini rozet referansları
  let badges = { total: null, match: null, ratio: null, dtq: null, dta: null };

  ns.header = {
    mount(container) {
      if (!container) return;

      container.innerHTML = '';

      // Başlık
      const title = document.createElement('div');
      title.className = 'br-title';
      title.textContent = 'Brostagma Tarayıcı-(Beta V1.4.0)';

      // Mini rozet alanı
      const miniWrap = document.createElement('div');
      miniWrap.className = 'br-miniBadges';

      const bTotal = document.createElement('span');
      bTotal.className = 'br-badge br-badge--mini';
      bTotal.title = 'Taranan';
      bTotal.textContent = '🧭 Tar: 0';

      const bMatch = document.createElement('span');
      bMatch.className = 'br-badge br-badge--mini';
      bMatch.title = 'Eşleşen';
      bMatch.textContent = '🎯 Eş: 0';

      const bRatio = document.createElement('span');
      bRatio.className = 'br-badge br-badge--mini';
      bRatio.title = 'Eşleşme %';
      bRatio.textContent = '📈 %0';

      const bDTQ = document.createElement('span');
      bDTQ.className = 'br-badge br-badge--mini';
      bDTQ.title = 'DT Kuyruğu';
      bDTQ.textContent = '📥 DTQ: 0';

      const bDTA = document.createElement('span');
      bDTA.className = 'br-badge br-badge--mini';
      bDTA.title = 'DT Aktif';
      bDTA.textContent = '⚡ DTA: 0';

      miniWrap.append(bTotal, bMatch, bRatio, bDTQ, bDTA);
      badges = { total: bTotal, match: bMatch, ratio: bRatio, dtq: bDTQ, dta: bDTA };

      // Sağ aksiyonlar
      const actions = document.createElement('div');
      actions.className = 'br-headerActions';
      actions.setAttribute('role','toolbar');

      const miniBtn = document.createElement('button');
      miniBtn.className = 'br-iconBtn';
      miniBtn.type = 'button';
      miniBtn.title = 'Mini mod';
      miniBtn.setAttribute('aria-label','Mini moda al');
      miniBtn.textContent = '▭';
      miniBtn.addEventListener('click', () => ns.panel?.toggleMini?.());

      const closeBtn = document.createElement('button');
      closeBtn.className = 'br-close';
      closeBtn.type = 'button';
      closeBtn.title = 'Kapat';
      closeBtn.setAttribute('aria-label', 'Paneli kapat');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => ns.panel?.destroy?.());

      actions.append(miniBtn, closeBtn);

      container.append(title, miniWrap, actions);

      // Normal sayaçlar güncellenince rozetleri yaz
      document.addEventListener('br:counters:updated', (e) => {
        const { total, match, ratioText } = e.detail || {};
        if (typeof total === 'number') badges.total.textContent = `🧭 Taranan: ${total}`;
        if (typeof match === 'number') badges.match.textContent = `🎯 Eşleşen: ${match}`;
        if (typeof ratioText === 'string') badges.ratio.textContent = `📈 ${ratioText}`;
      });

      // DT sayaçları güncellenince rozetleri yaz
      document.addEventListener('br:dt:updated', (e) => {
        const d = e.detail || {};
        if (typeof d.queue === 'number') badges.dtq.textContent = `📥 DTQ: ${d.queue}`;
        if (typeof d.active === 'number') badges.dta.textContent = `⚡ DTA: ${d.active}`;
      });
    }
  };

  document.addEventListener('br:panel:created', () => {
    ns.header.mount(ns.panel.getHeader());
  });

  if (ns.panel?.getHeader?.()) {
    ns.header.mount(ns.panel.getHeader());
  }

  // 🔘 Tarama başlayınca mini modu sadece buradan tetikle
  document.addEventListener('br:scan:start', () => {
    try { ns.panel?.setMini?.(true); } catch {}
  });

})(window.BR = window.BR || {});
