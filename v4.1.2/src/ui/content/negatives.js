// Negatif Anahtarlar
// - Tek tek ekle (input + Ekle/Enter)
// - Chip tıkla → sil
// - "Düzenle" modal: toplu düzenle / hepsini sil
// - Storage key: "negatives:list"
// - Event: br:negatives:changed { list }

(function (ns) {
  const STORAGE_KEY = "negatives:list";

  let mounted = false;
  let root = null;
  let listWrap = null;
  let inputEl = null;

  // Modal öğeleri
  let modal = null;
  let ta = null;

  function uniqNormalize(arr) {
    const out = [];
    const seen = new Set();
    for (let s of arr) {
      if (typeof s !== "string") continue;
      const t = s.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }

  async function loadList() {
    try {
      const val = await ns.storage.get(STORAGE_KEY, []);
      return Array.isArray(val) ? uniqNormalize(val) : [];
    } catch {
      return [];
    }
  }

  async function saveList(list) {
    const clean = uniqNormalize(list || []);
    await ns.storage.set(STORAGE_KEY, clean);
    document.dispatchEvent(
      new CustomEvent("br:negatives:changed", { detail: { list: clean } })
    );
    return clean;
  }

  function chip(label, onRemove) {
    const b = document.createElement("button");
    b.className = "br-chip br-chip--neg";
    b.type = "button";
    b.innerHTML = `<span class="br-chip__txt">${label}</span><span class="br-chip__x" aria-label="Kaldır">×</span>`;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      onRemove?.();
    });
    return b;
  }

  async function renderList(list) {
    listWrap.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "br-neg__empty";
      empty.textContent = "Henüz negatif anahtar yok.";
      listWrap.appendChild(empty);
      return;
    }
    for (const k of list) {
      listWrap.appendChild(
        chip(k, async () => {
          const arr = (await loadList()).filter((x) => x.toLowerCase() !== k.toLowerCase());
          const saved = await saveList(arr);
          renderList(saved);
          document.dispatchEvent(
            new CustomEvent("br:toast:show", {
              detail: { type: "warning", message: `Silindi: ${k}`, duration: 1400 },
            })
          );
        })
      );
    }
  }

  // --- Yardımcı: virgüllere göre güvenli böl ---
  function splitByComma(s) {
    // Sadece virgül; istersen buraya ; veya ， gibi varyantları da ekleyebiliriz.
    return String(s || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function addFromInput() {
    const raw = String(inputEl.value || "").trim();
    if (!raw) return;

    // 🔧 "a, b, c" → ["a","b","c"]
    const parts = splitByComma(raw);

    if (!parts.length) return;
    const arr = await loadList();
    arr.push(...parts);

    const saved = await saveList(arr);
    inputEl.value = "";
    await renderList(saved);
    document.dispatchEvent(
      new CustomEvent("br:toast:show", {
        detail: { type: "success", message: `Eklendi: ${parts.join(", ")}`, duration: 1400 },
      })
    );
    inputEl.focus();
  }

  // ============ Modal ============
  function openModal(current) {
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "br-negmodal";
      modal.innerHTML = `
        <div class="br-negmodal__scrim"></div>
        <div class="br-negmodal__panel" role="dialog" aria-modal="true" aria-label="Negatif Anahtarları Düzenle">
          <div class="br-negmodal__head">
            <h4>Negatif Anahtarları Düzenle</h4>
            <button type="button" class="br-negmodal__close" aria-label="Kapat">×</button>
          </div>
          <div class="br-negmodal__body">
            <p class="br-negmodal__hint">Her satıra bir anahtar yazın. Aynı satırdaki virgüller ayrı anahtar olarak bölünür.</p>
            <textarea class="br-negmodal__ta" rows="10" spellcheck="false"></textarea>
          </div>
          <div class="br-negmodal__foot">
            <button type="button" class="br-btn br-btn--subtle br-negmodal__clear">Hepsini Sil</button>
            <div class="br-negmodal__spacer"></div>
            <button type="button" class="br-btn br-btn--ghost br-negmodal__cancel">Vazgeç</button>
            <button type="button" class="br-btn br-negmodal__save">Kaydet</button>
          </div>
        </div>
      `;
      document.documentElement.appendChild(modal);

      ta = modal.querySelector(".br-negmodal__ta");
      const cls = modal.querySelector(".br-negmodal__close");
      const scr = modal.querySelector(".br-negmodal__scrim");
      const btnSave = modal.querySelector(".br-negmodal__save");
      const btnCancel = modal.querySelector(".br-negmodal__cancel");
      const btnClear = modal.querySelector(".br-negmodal__clear");

      const close = () => {
        modal.classList.remove("is-in");
        setTimeout(() => {
          modal.remove();
          modal = null;
          if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
          }
        }, 180);
      };

      cls.addEventListener("click", close);
      scr.addEventListener("click", close);
      btnCancel.addEventListener("click", close);

      btnSave.addEventListener("click", async () => {
        // 🔧 Her satır → virgüllerle parçala → trim → boşları at
        const raw = String(ta.value || "");
        const lines = raw.split(/\r?\n/);
        const pieces = [];
        for (const line of lines) {
          const parts = splitByComma(line);
          if (parts.length) pieces.push(...parts);
        }
        const saved = await saveList(pieces);
        await renderList(saved);
        document.dispatchEvent(
          new CustomEvent("br:toast:show", {
            detail: { type: "success", message: "Negatif anahtarlar kaydedildi", duration: 1800 },
          })
        );
        close();
      });

      btnClear.addEventListener("click", async () => {
        await saveList([]);
        await renderList([]);
        document.dispatchEvent(
          new CustomEvent("br:toast:show", {
            detail: { type: "warning", message: "Tüm negatif anahtarlar silindi", duration: 1800 },
          })
        );
        close();
      });
    }

    ta.value = (current || []).join("\n");
    requestAnimationFrame(() => modal.classList.add("is-in"));
  }

  ns.negatives = {
    mount(container) {
      if (!container || mounted) return;  // 🔧 double-mount koruması
      mounted = true;

      root = document.createElement("section");
      root.className = "br-card br-neg";

      const h = document.createElement("h3");
      h.textContent = "Negatif Anahtarlar";

      const row = document.createElement("div");
      row.className = "br-neg__row";

      inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.className = "br-neg__input";
      inputEl.placeholder = "Örn: rakip marka, istenmeyen kelime — virgülle ayırabilirsiniz";
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addFromInput();
      });

      const btnAdd = document.createElement("button");
      btnAdd.className = "br-btn";
      btnAdd.type = "button";
      btnAdd.textContent = "Ekle";
      btnAdd.addEventListener("click", addFromInput);

      const btnEdit = document.createElement("button");
      btnEdit.className = "br-btn br-btn--ghost";
      btnEdit.type = "button";
      btnEdit.textContent = "Düzenle";
      btnEdit.addEventListener("click", async () => {
        const current = await loadList();
        openModal(current);
      });

      row.append(inputEl, btnAdd, btnEdit);

      listWrap = document.createElement("div");
      listWrap.className = "br-neg__list";

      root.append(h, row, listWrap);
      container.appendChild(root);

      // İlk yükleme
      loadList().then(renderList);
    }
  };

  // Panel oluşturulunca yerleştir
  document.addEventListener("br:panel:created", () => {
    ns.negatives.mount(ns.panel.getBody());
  });
  if (ns.panel?.getBody?.()) ns.negatives.mount(ns.panel.getBody());

  // ❗ Kritik düzeltme: Panel yok edilince yeniden mount edilebilsin
  document.addEventListener("br:panel:destroyed", () => {
    mounted = false;
    root = listWrap = inputEl = modal = ta = null;
  });

})(window.BR = window.BR || {});
