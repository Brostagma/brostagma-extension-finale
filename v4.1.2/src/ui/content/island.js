// island.js
// MAJOR GÜNCELLEME V2: Buton görünürlük mantığı ve durum renkleri iyileştirildi.
// GÜNCELLEME V3: Tarama başlatma seçicisi ve export yardımcı fonksiyonları düzeltildi.
// GÜNCELLEME V4 (Düzeltme): Fiyat çıkarma (extractPriceFromCard) mantığı, scan.js ile %100 senkronize hale getirildi.
(function (ns) {
  let mounted = false;
  let root, btnScan, btnExport;
  let scanning = false;
  let exportReady = false;
  let watchTimer = null;

  const matches = [];
  const matchKeys = new Set();
  let hasTargets = false;

  function toast(type, message, duration = 1400) {
    document.dispatchEvent(new CustomEvent("br:toast:show", { detail: { type, message, duration } }));
  }

  function setExportEnabled(on) {
    exportReady = !!on;
    if (btnExport) {
      btnExport.setAttribute("aria-disabled", String(!exportReady));
      btnExport.classList.toggle("is-ready", exportReady);
    }
  }

  function setScanState(on) {
    scanning = !!on;
    if (btnScan) {
        btnScan.classList.toggle("is-on", scanning);
        btnScan.setAttribute("aria-pressed", String(scanning));
        const label = btnScan.querySelector(".br-island__label");
        if (label) {
            label.textContent = scanning ? "Durdur" : "Taramayı Başlat";
        }
        btnScan.setAttribute("title", scanning ? "Taramayı Durdur" : "Taramayı Başlat");
    }
  }

  function reposition() {
    if (!root) return;
    const panelEl = ns.panel?.el;
    if (!panelEl || panelEl.getBoundingClientRect().width === 0) {
      root.style.opacity = "0";
      root.style.pointerEvents = "none";
      return;
    }
    const r = panelEl.getBoundingClientRect();
    root.style.opacity = "1";
    root.style.pointerEvents = "auto";
    root.style.position = "fixed";
    root.style.left = `${r.right + 12}px`;
    root.style.top  = `${r.top}px`;
    root.style.zIndex = "2147483647";
  }

  function attachObservers() {
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    document.addEventListener("br:panel:created", reposition);
    document.addEventListener("br:panel:mini", reposition);
    document.addEventListener("br:panel:resized", reposition);
    document.addEventListener("br:panel:moved", reposition);
    if (!watchTimer) watchTimer = setInterval(reposition, 400);
  }

  // --- Yardımcı fonksiyonlar (Export için güncellendi) ---
  const cleanWS = (s)=> String(s||"").replace(/\s+/g," ").trim();
  const pick = (el)=>{ if(!el)return"";const t=el.getAttribute&&el.getAttribute("title");return(t&&t.trim())||(el.textContent||"").trim();}; // scan.js'den pick fonksiyonu
  function parsePriceToNumber(text){ let s=String(text||"").replace(/[^\d.,]/g,"").trim(); if(!s)return null; const hC=s.includes(","),hD=s.includes("."); if(hC&&hD){s=s.replace(/\./g,"").replace(",",".");}else if(hC){s=s.replace(",",".");} const n=parseFloat(s); return isFinite(n)?n:null; }

  // YENİ: readCampaignsFromCard güncellendi
  function readCampaignsFromCard(card){
    try{
      // scan.js tarafından eklenen data attribute'unu öncelikli kullan
      if(card.dataset.brCampaigns){
        const arr=JSON.parse(card.dataset.brCampaigns||"[]");
        if(Array.isArray(arr) && arr.length) return arr.map(cleanWS);
      }
    }catch{}
    // Fallback (eğer data attribute yoksa veya boşsa, DOM'dan okumayı dene)
    const names = Array.from(card.querySelectorAll(
        ".simplified-badge-text" // Yeni kampanya metin class'ı
      )).map(n=>cleanWS(n.textContent)).filter(Boolean);

    const out=[],seen=new Set();
    for(const n of names){const k=n.toLowerCase(); if(seen.has(k))continue; seen.add(k); out.push(n);}
    return out;
  }
  function computeUnitPrice(price,campaigns){ if(!price||!campaigns?.length)return null; let best=null; for(const raw of campaigns){ const t=raw.toLowerCase(); const mXY=t.match(/\b(\d+)\s*al\s*(\d+)\s*ode\b/); if(mXY){const[_,X,Y]=mXY.map(Number); if(X>0&&Y>0){const u=price*(Y/X); best=(best==null||u<best)?u:best;}} const mP=t.match(/2\.\s*urun\s*%(\d+)/); if(mP){const p=parseInt(mP[1],10); if(p>=0&&p<=100){const u=price*(1-(p/200)); best=(best==null||u<best)?u:best;}}} return best; }


  // ====================== DÜZELTME BAŞLANGIÇ ======================
  // YENİ: extractPriceFromCard güncellendi (scan.js'deki mantıkla BİREBİR AYNI)
  function extractPriceFromCard(card){
    const q=(sel)=>card.querySelector(sel);
    const priceText =
      pick(q(".basket-promo-price-wrapper .price-value")) || // 1. Sepette İndirim
      pick(q(".ty-plus-promotion-price .price-value")) ||     // 2. Plus'a Özel Fiyat
      pick(q(".discounted-price > .sale-price")) ||          // 3. İndirimli Fiyat (sale-price)
      pick(q(".discounted-price > .price-value")) ||         // 4. İndirimli Fiyat (price-value)
      pick(q(".single-price > .price-section")) ||          // 5. Normal Fiyat (price-section)
      pick(q(".promotion-price > span.prc-slg")) ||           // 6. (scan.js sırası)
      pick(q(".discounted-price > div.prc-slg")) ||           // 7. (scan.js sırası)
      pick(q(".single-price > div.prc-slg"));                 // 8. (scan.js sırası)

    const priceNum = parsePriceToNumber(priceText);
    return { priceText: priceText || "", priceNum }; // priceText boşsa boş string döndür
   }
  // ======================= DÜZELTME SONU =======================


   // YENİ: extractRowFromCard güncellendi
  function extractRowFromCard(card){
    const q=(sel)=>card.querySelector(sel);
    // Yeni seçiciler
    const brand=cleanWS(pick(q("span.product-brand")));
    const product=cleanWS(pick(q("span.product-name")));
    const{priceText,priceNum}=extractPriceFromCard(card); // Güncellenmiş (düzeltilmiş) fonksiyonu kullan
    let url="";
    // Yeni link seçicisi
    // product-card'ın kendisi <a> etiketi olduğu için card'ı direkt kullanabiliriz.
    const a = card; // Kartın kendisi link
    if(a){try{url=new URL(a.getAttribute("href"),location.href).href;}catch{url=a.getAttribute("href") || "";}} // URL yoksa boş string

    const campaigns=readCampaignsFromCard(card); // Güncellenmiş fonksiyonu kullan
    const unitPrice=computeUnitPrice(priceNum,campaigns);
    const campaignsText=campaigns.join(", ");
    return{brand,product,priceText,price:priceNum,unitPrice,campaignsText,url};
  }
  // --- Yardımcı fonksiyonlar sonu ---

  function pushMatchFromEl(el){
    if (!el) return;
    const row = extractRowFromCard(el); // Güncellenmiş fonksiyonu kullanacak
    const key = row.url || `${row.brand}|${row.product}`;
    if (!key.trim() || matchKeys.has(key)) return;
    matchKeys.add(key);
    matches.push(row);
    setExportEnabled(true);
  }

  const clearMatches = () => { matches.length=0; matchKeys.clear(); setExportEnabled(false); };

  document.addEventListener("br:scan:match", e => pushMatchFromEl(e.detail?.el));
  document.addEventListener("br:scan:highlight", e => { if (e.detail?.state === "match") pushMatchFromEl(e.detail?.el); });
  document.addEventListener("br:targets:set", () => { hasTargets = true; clearMatches(); });
  document.addEventListener("br:targets:clear", () => { hasTargets = false; clearMatches(); });
  document.addEventListener("br:scan:start", () => {
    if (!hasTargets && !ns.match?._state?.anyTargets) toast("warning","Hedef liste yüklenmedi.");
    setScanState(true);
  });
  document.addEventListener("br:scan:stop", () => setScanState(false));
  const lockPanel = (on=true, text) => document.dispatchEvent(new CustomEvent("br:panel:lock", { detail:{ on, text } }));

  function createIsland() {
    if (mounted) return;
    mounted = true;

    root = document.createElement("div");
    root.className = "br-island";
    root.style.opacity = "0";

    const ICONS = {
        play: `<svg class="br-island__icon--play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        stop: `<svg class="br-island__icon--stop" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"></rect></svg>`,
        download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`
    };

    btnScan = document.createElement("button");
    btnScan.type = "button";
    btnScan.className = "br-island__btn br-island__btn--scan";
    btnScan.innerHTML = `<span class="br-island__icon">${ICONS.play}${ICONS.stop}</span><span class="br-island__label">Taramayı Başlat</span>`;
    btnScan.addEventListener("click", () => {
        const eventName = scanning ? "br:scan:stop" : "br:scan:start";
        // YENİ: Doğru seçiciyi kullan
        document.dispatchEvent(new CustomEvent(eventName, { detail: { selector: "[data-testid='product-card']", minDwellMs: 40 } }));
        // Alternatif (varsayılanı kullanmak için):
        // document.dispatchEvent(new CustomEvent(eventName, { detail: { minDwellMs: 40 } }));
    });

    btnExport = document.createElement("button");
    btnExport.type = "button";
    btnExport.className = "br-island__btn br-island__btn--export";
    btnExport.innerHTML = `<span class="br-island__icon">${ICONS.download}</span><span class="br-island__label">Eşleşenleri İndir</span>`;
    btnExport.addEventListener("click", async () => {
      if (!exportReady || !matches.length) return toast("info", "İndirilecek eşleşme yok");
      document.dispatchEvent(new CustomEvent("br:scan:stop"));
      setScanState(false);

      const isDsActive = ns.ds?.status && (ns.ds.status().queue + ns.ds.status().active > 0);
      if (isDsActive) {
          lockPanel(true, "Arka plan işlemleri tamamlanıyor…");
          toast("info","İşlemler bitince indirme başlayacak.", 1800);
          const onDrained = () => {
            document.removeEventListener("br:ds:drained", onDrained);
            lockPanel(false);
            btnExport.click(); // Tekrar tıkla
          };
          document.addEventListener("br:ds:drained", onDrained);
          return;
      }

      try {
        if (!window.BR_XLSX?.exportMatches) throw new Error("Export modülü (BR_XLSX) bulunamadı.");
        const te = matches.length;
        const ttEl = document.querySelector('.br-counters__grid .br-counters__item .br-counters__value');
        const tt = ttEl ? parseInt(ttEl.textContent.replace(/[^\d]/g, ''), 10) || 0 : 0; // Sayıyı temizle
        const d = new Date();
        const filename = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} - tt${tt} - te${te}`;

        // Kampanya filtresi bilgisini meta'ya ekle
        const selectedCampaigns = ns.campaigns?.getSelected ? ns.campaigns.getSelected() : [];

        const { blobUrl, filename: outName } = await window.BR_XLSX.exportMatches({
             rows: matches,
             filename,
             meta: { tt, te, createdAt: d.toISOString(), selectedCampaigns } // Kampanyaları ekle
        });
        const a = document.createElement("a");
        a.href = blobUrl; a.download = outName;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(blobUrl); // Blob URL'yi serbest bırak
        toast("success", "Eşleşenler indiriliyor…");
      } catch (err) {
        console.error("Export error:", err); // Hata detayını konsola yazdır
        toast("error", `İndirilemedi: ${err.message || err}`);
      }
    });

    root.append(btnScan, btnExport);
    document.documentElement.appendChild(root);
    setScanState(false);
    setExportEnabled(false);
    attachObservers();
    reposition();

    const setIslandLock = on => root?.classList.toggle('is-locked', !!on);
    document.addEventListener('br:ds:overlay:open', () => setIslandLock(true));
    document.addEventListener('br:ds:overlay:close', () => setIslandLock(false));
  }

  // Gecikmeli başlatma (sayfa tamamen yüklendikten sonra)
  if (document.readyState === "complete") {
      createIsland();
  } else {
      window.addEventListener("load", createIsland);
  }

})(window.BR = window.BR || {});