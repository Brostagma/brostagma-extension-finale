// ==UserScript==
// @name         TrendYol New Page Script for Trendyol
// @namespace    http://tampermonkey.net/
// @version      2025-08-14
// @description  try to take over the world!
// @author       Brostagma Emin
// @match        https://www.trendyol.com/hesabim/siparislerim*
// @run-at       document-start
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trendyol.com
// @grant        none
// ==/UserScript==

(function() {
  const RE = /^\/hesabim\/siparislerim\/\d+$/;

  // Global capture: Hem sol (click) hem de orta tuş (auxclick) olaylarını yakala
  function universalClickHandler(e) {
    // Sadece sol (0) ve orta (1) tuş tıklamalarını dikkate al
    if (e.button !== 0 && e.button !== 1) {
      return;
    }

    const url = extractTargetUrl(e.target);
    if (!url) return;

    try {
      const u = new URL(url, location.origin);
      if (!RE.test(u.pathname)) return;

      // --- DÜZELTME ---
      // Hem sol hem de orta tuş için tarayıcının varsayılan davranışını (örn: sayfa kaydırma) engelle.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation && e.stopImmediatePropagation();

      // Linki her zaman yeni sekmede aç.
      window.open(u.href, '_blank', 'noopener,noreferrer');

    } catch (_) {}
  }

  function extractTargetUrl(el) {
    // 1) En yakın <a href>
    let n = el;
    while (n && n !== document) {
      if (n.tagName === 'A' && n.getAttribute('href')) return n.getAttribute('href');
      n = n.parentElement;
    }
    // 2) data-* fallback’ları (div/button vs.)
    n = el;
    while (n && n !== document) {
      if (n.getAttribute) {
        const id = n.getAttribute('data-orderid') || n.getAttribute('data-order-id') || n.getAttribute('data-ordernumber');
        if (id && /^\d+$/.test(id)) return location.origin + '/hesabim/siparislerim/' + id;
        const h = n.getAttribute('data-href') || n.getAttribute('data-url');
        if (h) return h;
      }
      n = n.parentElement;
    }
    return null;
  }

  // Linkleri target=_blank yap + node’u klonla (event listener’ları temizler)
  function retargetLinks(root) {
    const links = root.querySelectorAll ? root.querySelectorAll('a[href]') : [];
    links.forEach(a => {
      try {
        const u = new URL(a.getAttribute('href'), location.origin);
        if (RE.test(u.pathname)) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener');
          const clone = a.cloneNode(true);
          a.replaceWith(clone); // delegasyon yoksa site listener’larını sök
        }
      } catch (_) {}
    });
  }

  // Çok erken bağlan (document-start) + MutationObserver
  // 'mousedown' olayını kullanmak, 'click' ve 'auxclick'ten daha güvenilir olabilir
  // çünkü sayfa kaydırma gibi varsayılan eylemlerden önce tetiklenir.
  document.addEventListener('mousedown', universalClickHandler, true);

  const mo = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.addedNodes) m.addedNodes.forEach(n => retargetLinks(n));
    });
  });
  mo.observe(document.documentElement, {
    subtree: true,
    childList: true
  });
})();

