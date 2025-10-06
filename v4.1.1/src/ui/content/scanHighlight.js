// scanHighlight.js
// Sınıf tabanlı animasyon tetikleyici: scanning, match, dt, pass
// Görseller highlight.css'te tanımlıdır.
(function(){
  const ACTIVE = "br-scan--active";
  const MATCH  = "br-scan--match";
  const DT     = "br-scan--dt";
  const PASS   = "br-scan--pass";

  function ensureAnchor(el){
    try {
      const cs = getComputedStyle(el);
      if (cs.position === "static") el.style.position = "relative";
    } catch {}
  }

  function addTemp(el, cls, ms){
    ensureAnchor(el);
    el.classList.add(cls);
    setTimeout(()=>{ el.classList.remove(cls); }, ms);
  }

  document.addEventListener("br:scan:highlight", e=>{
    const {el,state,hold,ms}=e.detail||{};
    if (!el) return;

    if (state==="scanning"){
      ensureAnchor(el);
      el.classList.add(ACTIVE);
      if (!hold){
        const dur = Number(ms)||1000;
        setTimeout(()=>{ el.classList.remove(ACTIVE); }, dur);
      }
    }
    else if (state==="match"){
      // 3D star + büyüyen ring: CSS toplam ~1.15–1.2s; güven payıyla 1.5s
      addTemp(el, MATCH, 1500);
    }
    else if (state==="dt"){
      addTemp(el, DT, 1800);
    }
    else if (state==="pass"){
      // 3D ⊘ + 3D ring: ~0.95–1.05s; güven payıyla 1.3s
      addTemp(el, PASS, 1300);
    }
    else if (state==="done"){
      el.classList.remove(ACTIVE);
    }
  });

  // Güvence: bazı akışlarda highlight "match" gelmezse,
  // br:scan:match yakalandığında da yıldız efektini göster.
  document.addEventListener("br:scan:match", e=>{
    const el = e.detail?.el; if (!el) return;
    addTemp(el, MATCH, 1500);
  });
})();
