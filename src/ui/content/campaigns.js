// src/ui/campaigns.js
// GÜNCELLEME: Kodda değişiklik yok, sadece CSS ile görünüm yenilendi.
(function (ns) {
  let wrap = null;
  let chips = [];
  let countEl = null;

  const OPTIONS = [
    { label: "X Al Y Öde" }, { label: "2. Ürün %" }, { label: "2. Ürün TL" },
    { label: "Çok Al Az Öde" }, { label: "Birlikte Al Kazan" }, { label: "Yetkili Satıcı" },
    { label: "TL Kupon" }, { label: "Kupon Fırsatı" },
  ];

  function makeChip(labelText){
    const btn = document.createElement('button');
    btn.className = 'br-chip';
    btn.type = 'button';
    btn.setAttribute('role','button');
    btn.setAttribute('aria-pressed','false');
    btn.dataset.label = labelText;
    btn.textContent = labelText;

    btn.addEventListener('click', () => {
      const selected = btn.classList.toggle('is-selected');
      btn.setAttribute('aria-pressed', String(selected));
      btn.classList.add('bump');
      setTimeout(() => btn.classList.remove('bump'), 140);
      updateCount();

      const selectedList = ns.campaigns.getSelected();
      BR.storage.set("campaigns:selected", selectedList);

      document.dispatchEvent(new CustomEvent('br:campaigns:changed', {
        detail: { label: labelText, selected }
      }));
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter'){
        e.preventDefault();
        btn.click();
      }
    });

    return btn;
  }

  function updateCount(){
    if (!countEl) return;
    const n = chips.filter(c => c.btn.classList.contains('is-selected')).length;
    countEl.textContent = `Seçili: ${n}`;
  }

  ns.campaigns = {
    mount(container){
      if (!container || wrap?.isConnected) return;

      wrap = document.createElement('section');
      wrap.className = 'br-card br-campaigns';
      
      const h = document.createElement('h3');
      h.textContent = 'Kampanya Tipleri';

      const grid = document.createElement('div');
      grid.className = 'br-campaigns__grid';

      chips = OPTIONS.map(({label}) => {
        const btn = makeChip(label);
        grid.appendChild(btn);
        return { btn, label };
      });

      const footer = document.createElement('div');
      footer.className = 'br-campaigns__footer';
      countEl = document.createElement('span');
      countEl.className = 'br-campaigns__count';
      footer.appendChild(countEl);

      wrap.append(h, grid, footer);
      container.appendChild(wrap);

      BR.storage.get("campaigns:selected", []).then(list => {
        const arr = Array.isArray(list) ? list : [];
        if (arr.length) ns.campaigns.setSelected(arr);
        updateCount();
      }).catch(console.error);
    },

    getSelected(){
      return chips
        .filter(c => c.btn.classList.contains('is-selected'))
        .map(c => c.label);
    },

    setSelected(list = []){
      const set = new Set(list);
      chips.forEach(c => {
        const on = set.has(c.label);
        c.btn.classList.toggle('is-selected', on);
        c.btn.setAttribute('aria-pressed', String(on));
      });
      updateCount();
    }
  };

  document.addEventListener('br:panel:created', () => {
    ns.campaigns.mount(ns.panel.getBody());
  });
  if (ns.panel?.getBody?.()) ns.campaigns.mount(ns.panel.getBody());

})(window.BR = window.BR || {});

