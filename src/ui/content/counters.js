(function (ns) {
  const valueEls = { total: null, match: null, ratio: null, dtQueue: null, dtActive: null };

  function buildRow(icon, labelText, initial = '0', small = false) {
    const row = document.createElement('div');
    row.className = 'br-counters__item' + (small ? ' br-counters__item--small' : '');

    const ico = document.createElement('div');
    ico.className = 'br-counters__icon';
    ico.textContent = icon;

    const label = document.createElement('div');
    label.className = 'br-counters__label';
    label.textContent = labelText;

    const value = document.createElement('div');
    value.className = 'br-counters__value';
    value.textContent = initial;

    row.append(ico, label, value);
    return { row, value };
  }

  function fmtPct(n){
    if (!isFinite(n)) return '%0';
    return '%' + Math.round(n);
  }

  function bump(el){
    if (!el) return;
    el.style.transform = 'scale(1.06)';
    setTimeout(() => { el.style.transform = ''; }, 120);
  }

  function getNum(text){
    const n = Number(String(text).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  ns.counters = {
    mount(container) {
      if (!container) return;

      const wrap = document.createElement('section');
      wrap.className = 'br-card br-counters';

      const h = document.createElement('h3');
      h.textContent = 'Sayaçlar';
      wrap.appendChild(h);

      const grid = document.createElement('div');
      grid.className = 'br-counters__grid';

      const totalRow = buildRow('🧭','Taranan','0');
      valueEls.total = totalRow.value;
      grid.appendChild(totalRow.row);

      const matchRow = buildRow('🎯','Eşleşen','0');
      valueEls.match = matchRow.value;
      grid.appendChild(matchRow.row);

      const ratioRow = buildRow('📈','Eşleşme %','%0');
      valueEls.ratio = ratioRow.value;
      grid.appendChild(ratioRow.row);

      const dtWrap = document.createElement('div');
      dtWrap.className = 'br-counters__dt';
      const dtQueueRow = buildRow('📥','DT Kuyruğu','0', true);
      valueEls.dtQueue = dtQueueRow.value;
      dtWrap.appendChild(dtQueueRow.row);
      const dtActiveRow = buildRow('⚡','DT Aktif','0', true);
      valueEls.dtActive = dtActiveRow.value;
      dtWrap.appendChild(dtActiveRow.row);

      wrap.append(grid, dtWrap);
      container.appendChild(wrap);

      document.dispatchEvent(new CustomEvent('br:counters:updated', {
        detail: { total: 0, match: 0, ratioText: '%0' }
      }));
    },

    set({ total, match, ratio } = {}) {
      if (typeof total === 'number' && valueEls.total){
        valueEls.total.textContent = String(total);
        bump(valueEls.total);
      }
      if (typeof match === 'number' && valueEls.match){
        valueEls.match.textContent = String(match);
        bump(valueEls.match);
      }

      let pct = null;
      if (typeof ratio === 'number') {
        pct = ratio;
      } else if (typeof total === 'number' || typeof match === 'number') {
        const t = getNum(valueEls.total?.textContent || 0);
        const m = getNum(valueEls.match?.textContent || 0);
        pct = t > 0 ? (m * 100) / t : 0;
      }

      if (pct !== null && valueEls.ratio){
        const ratioText = fmtPct(pct);
        valueEls.ratio.textContent = ratioText;
        bump(valueEls.ratio);

        const tVal = getNum(valueEls.total?.textContent || 0);
        const mVal = getNum(valueEls.match?.textContent || 0);
        document.dispatchEvent(new CustomEvent('br:counters:updated', {
          detail: { total: tVal, match: mVal, ratioText }
        }));
      }
    },

    setDT({ queue, active } = {}) {
      if (typeof queue === 'number' && valueEls.dtQueue){
        valueEls.dtQueue.textContent = String(queue);
        bump(valueEls.dtQueue);
      }
      if (typeof active === 'number' && valueEls.dtActive){
        valueEls.dtActive.textContent = String(active);
        bump(valueEls.dtActive);
      }
      document.dispatchEvent(new CustomEvent('br:dt:updated', {
        detail: { queue, active }
      }));
    }
  };

  document.addEventListener('br:panel:created', () => {
    ns.counters.mount(ns.panel?.getBody?.());
  });
  if (ns.panel?.getBody?.()) ns.counters.mount(ns.panel.getBody());

  /* ======== EŞLEŞEN SAYACI: DEDUPE + OLAY KÖPRÜSÜ ======== */
  const countedMatchIds = new Set();
  function idFromEventEl(el){
    return (el && el.dataset && el.dataset.brId) ? el.dataset.brId : el;
  }
  function incrMatchOnce(el){
    const id = idFromEventEl(el);
    if (!id || countedMatchIds.has(id)) return;
    countedMatchIds.add(id);
    const current = getNum(valueEls.match?.textContent || 0);
    ns.counters.set({ match: current + 1 });
  }

  // ❌ ESKİ: br:scan:start → burada temizleniyordu (restart'ta sayaç 0'lanıyordu). :contentReference[oaicite:3]{index=3}
  // ✅ YENİ: yalnızca hedef değişince sıfırla.
  document.addEventListener('br:targets:set',  () => { countedMatchIds.clear(); ns.counters.set({ match: 0 }); });
  document.addEventListener('br:targets:clear',() => { countedMatchIds.clear(); ns.counters.set({ match: 0 }); });

  // Asıl sinyal: match.js tetikleyebilir
  document.addEventListener('br:scan:match', (e) => {
    incrMatchOnce(e.detail?.el);
  });

  // YEDEK sinyal: scan.js highlight aşaması "match" ise yine say
  document.addEventListener('br:scan:highlight', (e) => {
    if (e.detail?.state === 'match') incrMatchOnce(e.detail?.el);
  });

  // DT metrik köprüsü
  document.addEventListener('br:ds:metrics', (e) => {
    const d = e.detail || {};
    ns.counters.setDT({ queue: d.queue, active: d.active });
  });

})(window.BR = window.BR || {});
