// dsOverlay.js
// DS aktifken: tarama durdurulursa veya "Eşleşenleri İndir"e basılırsa şeffaf overlay + progress.

(function(ns){
  let overlay, bar, title, desc, leftPill;
  let initialTotal = 0;
  let pendingResumeClick = null;

  function ensure(){
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "br-ds-overlay";
    overlay.innerHTML = `
      <div class="br-ds-card">
        <h4 id="br-ds-title">Arka plan denetimi sürüyor…</h4>
        <p id="br-ds-desc">Kalan ürün: <span class="left-pill pill">0</span></p>
        <div class="br-ds-progress"><div class="br-ds-progress__bar"></div></div>
        <div class="br-ds-meta">
          <span>DS ürün sayfası kontrolleri yapılıyor</span>
          <span class="pill" id="br-ds-left">0 kaldı</span>
        </div>
      </div>
    `;
    document.documentElement.appendChild(overlay);
    bar   = overlay.querySelector(".br-ds-progress__bar");
    title = overlay.querySelector("#br-ds-title");
    desc  = overlay.querySelector("#br-ds-desc");
    leftPill = overlay.querySelector("#br-ds-left");
  }

  function open(){
    ensure();
    overlay.classList.add("is-open");
    // 🔔 Panel/Ada kilidi için global sinyal
    try { document.dispatchEvent(new CustomEvent("br:ds:overlay:open")); } catch {}
  }
  function close(){
    if (!overlay) return;
    overlay.classList.remove("is-open");
    // 🔔 Kilit kaldırma sinyali
    try { document.dispatchEvent(new CustomEvent("br:ds:overlay:close")); } catch {}
    if (pendingResumeClick) {
      const fn = pendingResumeClick; pendingResumeClick = null;
      try { fn(); } catch{} // export'a devam
    }
  }

  function updateFromStatus(st){
    if (!overlay) return;
    const left = st.queue + st.active;
    const total = Math.max(initialTotal, left + st.processed);
    const done = total ? Math.max(0, Math.min(1, (st.processed) / total)) : 0;
    bar.style.width = (done * 100).toFixed(1) + "%";
    leftPill.textContent = `${left} kaldı`;
    desc.innerHTML = `Kalan ürün: <span class="left-pill pill">${left}</span>`;
  }

  // DS metrikleri değiştikçe progress güncelle
  document.addEventListener("br:ds:metrics", ()=>{
    if (!ns.ds) return;
    const st = ns.ds.status();
    if (initialTotal === 0) initialTotal = st.queue + st.active + st.processed;
    updateFromStatus(st);
  });

  // DS bittiğinde overlay varsa kapat
  document.addEventListener("br:ds:drained", ()=> close());

  // Tarama durdurulursa ve DS hâlâ çalışıyorsa overlay göster
  document.addEventListener("br:scan:stop", ()=>{
    if (!ns.ds) return;
    const st = ns.ds.status();
    if ((st.queue + st.active) > 0){
      initialTotal = st.queue + st.active + st.processed;
      open(); updateFromStatus(st);
    }
  });

  // "Eşleşenleri İndir" yakala: DS aktifse beklet, bitince devam et
  document.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest && e.target.closest(".br-island__btn--export");
    if (!btn || !ns.ds) return;
    const st = ns.ds.status();
    if ((st.queue + st.active) > 0){
      // ✅ İLK KURAL: her koşulda önce taramayı kesin durdur
      try { document.dispatchEvent(new CustomEvent("br:scan:stop")); } catch {}
      e.preventDefault(); e.stopPropagation();

      initialTotal = st.queue + st.active + st.processed;
      open(); updateFromStatus(st);

      pendingResumeClick = ()=> { try{ btn.click(); }catch{} };
    }
  }, true);

})(window.BR = window.BR || {});
