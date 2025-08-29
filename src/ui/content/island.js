// island.js
// Mini ada: taramayı başlat/durdur + eşleşenleri indir (xlsx)
// - Karttan kampanyaları ve "iki farklı fiyat DOM" varyantını okur
// - Birim fiyat: yalnız "X Al Y Öde" ve "2. Ürün %" için hesaplanır
(function (ns) {
  let mounted = false;
  let root;
  let btnScan;
  let btnExport;
  let scanning = false;
  let exportReady = false;
  let watchTimer = null;

  const matches = [];
  const matchKeys = new Set();

  // 🔧 hedef kontrol bayrağı
  let hasTargets = false;

  function toast(type, message, duration = 1400) {
    try { document.dispatchEvent(new CustomEvent("br:toast:show", { detail: { type, message, duration } })); } catch {}
  }

  function setExportEnabled(on) {
    exportReady = !!on;
    if (!btnExport) return;
    btnExport.classList.toggle("is-disabled", !exportReady);
    btnExport.setAttribute("aria-disabled", String(!exportReady));
  }

  function setScanState(on) {
    scanning = !!on;
    if (!btnScan) return;
    btnScan.classList.toggle("is-on", scanning);
    btnScan.setAttribute("aria-pressed", String(scanning));
    const label = btnScan.querySelector(".br-island__label");
    if (label) label.textContent = scanning ? "Taramayı Durdur" : "Taramayı Başlat";
  }

  function getPanelRect() {
    const el =
      ns.panel?.el ||
      document.getElementById("br-panel") ||
      (ns.panel?.getHeader && ns.panel.getHeader()?.parentElement) ||
      null;
    if (!el) return null;
    try { return el.getBoundingClientRect(); } catch { return null; }
  }

  function reposition() {
    if (!root) return;
    const r = getPanelRect();
    if (!r || r.width === 0 || r.height === 0) {
      root.style.opacity = "0";
      root.style.pointerEvents = "none";
      return;
    }
    root.style.position = "fixed";
    root.style.left = (r.right + 10) + "px";
    root.style.top  = (r.top + 0) + "px";
    root.style.zIndex = "2147483647";
    root.style.opacity = "1";
    root.style.pointerEvents = "none";
  }

  function attachObservers() {
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("br:panel:created", () => requestAnimationFrame(reposition));
    document.addEventListener("br:panel:mini", reposition);
    document.addEventListener("br:panel:resized", reposition);
    document.addEventListener("br:panel:moved", reposition);
    if (!watchTimer) watchTimer = setInterval(reposition, 400);
  }

  // ---------- Yardımcılar ----------
  const normTr = (s)=>{
    const map = { "İ":"i","I":"i","ı":"i","Ş":"s","ş":"s","Ğ":"g","ğ":"g","Ü":"u","ü":"u","Ö":"o","ö":"o","Ç":"c","ç":"c" };
    return String(s||"").replace(/[İIıŞşĞğÜüÖöÇç]/g, ch=>map[ch]||ch).toLowerCase();
  };
  const cleanWS = (s)=> String(s||"").replace(/\s+/g," ").trim();

  function parsePriceToNumber(text){
    let s = String(text||"").replace(/[^\d.,]/g,"").trim();
    if (!s) return null;
    // 1.000,50 → 1000.50  |  110,20 → 110.20
    const hasComma = s.includes(",");
    const hasDot   = s.includes(".");
    if (hasComma && hasDot){
      // binlik nokta → sil, ondalık virgül → .
      s = s.replace(/\./g,"").replace(",",".");
    } else if (hasComma){
      s = s.replace(",",".");
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function readCampaignsFromCard(card){
    // scan.js, kampanyaları JSON olarak el.dataset.brCampaigns'e yazar. (varsa onu al)
    try{
      if (card.dataset && card.dataset.brCampaigns){
        const arr = JSON.parse(card.dataset.brCampaigns || "[]");
        if (Array.isArray(arr) && arr.length) return arr.map(cleanWS);
      }
    }catch{}
    // Fallback: karttan okuyalım (aynı seçiciler)
    const qAll = (sel)=> Array.from(card.querySelectorAll(sel));
    const names = qAll(".variant-options-wrapper .name, .badges-wrapper .name, [class*='badge'] .name, .badge .name")
      .map(n=>cleanWS(n.textContent)).filter(Boolean);
    // uniq
    const out=[]; const seen=new Set();
    for(const n of names){ const k=normTr(n); if(seen.has(k)) continue; seen.add(k); out.push(n); }
    return out;
  }

  function computeUnitPrice(price, campaigns){
    if (!price || !Array.isArray(campaigns) || !campaigns.length) return null;
    let best = null;
    for (const raw of campaigns){
      const t = normTr(raw);
      // X Al Y Öde → price * (Y/X)
      const mXY = t.match(/\b(\d+)\s*al\s*(\d+)\s*ode\b/);
      if (mXY){
        const X = parseInt(mXY[1],10), Y = parseInt(mXY[2],10);
        if (X>0 && Y>0){
          const u = price * (Y / X);
          best = (best==null || u < best) ? u : best;
        }
      }
      // 2. Ürün % → ikinci ürün p% indirim → iki ürün ortalama: price * (1 - p/200)
      const mP = t.match(/2\.\s*urun\s*%(\d+)/);
      if (mP){
        const p = parseInt(mP[1],10);
        if (p>=0 && p<=100){
          const u = price * (1 - (p/200));
          best = (best==null || u < best) ? u : best;
        }
      }
    }
    return best;
  }

  function extractPriceFromCard(card){
    const q = (sel)=> card.querySelector(sel);
    const pick = (el)=> el ? cleanWS(el.textContent || el.getAttribute("title") || "") : "";

    // V1: klasik
    let el =
      q(".prc-box-dscntd") || q(".prc-box-sllng") ||
      q("[data-testid='price-current']") || q(".price") || q(".prc-box");

    // V2: yeni yapı (price-information-container)
    if (!el) {
      el = q(".price-information-container .price-item.lowest-price-discounted") ||
           q(".price-information-container .price-item.discounted") ||
           q(".price-information-container .price-item") ||
           q(".price-information .price-item.discounted");
    }

    const priceText = pick(el);
    const priceNum  = parsePriceToNumber(priceText);
    return { priceText, priceNum };
  }

  function extractRowFromCard(card){
    const q = (sel) => card.querySelector(sel);
    const pickText = (el) => {
      if (!el) return "";
      const t = el.getAttribute && el.getAttribute("title");
      return (t && t.trim()) || (el.textContent || "").trim();
    };

    const brandEl = q(".prdct-desc-cntnr-ttl") || q("[data-testid='brand']") || q(".brand");
    const nameEl  = q(".product-desc-cntnr-name") || q(".prdct-desc-cntnr-name") || q("[data-testid='product-name']") || q(".name");
    const subEl   = q(".product-desc-sub-text") || q(".product-desc-sub-container .product-desc-sub-text");

    const brand   = cleanWS(pickText(brandEl));
    const product = cleanWS(pickText(subEl) || pickText(nameEl));

    const { priceText, priceNum } = extractPriceFromCard(card);

    // URL
    let url = "";
    const aTags = Array.from(card.querySelectorAll("a[href]"));
    if (aTags.length){
      const cand = aTags.filter(a => !a.href.includes("#") && !/javascript:/i.test(a.href))
                        .sort((a,b)=> (b.href.length||0)-(a.href.length||0))[0];
      if (cand) {
        try { url = new URL(cand.getAttribute("href"), location.href).href; }
        catch { url = cand.getAttribute("href"); }
      }
    }

    // Kampanyalar + birim fiyat
    const campaigns = readCampaignsFromCard(card);
    const unitPrice = computeUnitPrice(priceNum, campaigns);
    const campaignsText = campaigns.join(", ");

    return { brand, product, priceText, price: priceNum, unitPrice, campaignsText, url };
  }

  // Eşleşme geldiğinde listeye ekle (dedupe)
  function pushMatchFromEl(el, detail){
    if (!el) return;
    const row = extractRowFromCard(el);
    const key = row.url || (row.brand + "|" + row.product);
    if (!key.trim() || matchKeys.has(key)) return;
    matchKeys.add(key);
    matches.push(row);
    setExportEnabled(matches.length > 0);
  }

  // Asıl olaylar
  document.addEventListener("br:scan:match", e=>{
    try{ pushMatchFromEl(e.detail?.el, e.detail); }catch(_){}
  });
  document.addEventListener("br:scan:highlight", e=>{
    try{ if (e.detail?.state === "match") pushMatchFromEl(e.detail?.el); }catch(_){}
  });

  // Temizleme
  function clearMatches(){
    matches.length = 0;
    matchKeys.clear();
    setExportEnabled(false);
  }

  document.addEventListener("br:targets:set",   ()=>{ hasTargets = true;  clearMatches(); });
  document.addEventListener("br:targets:clear", ()=>{ hasTargets = false; clearMatches(); });

  document.addEventListener("br:scan:start", ()=>{
    const anyTargets = hasTargets || !!(ns.match?._state?.anyTargets);
    if (!anyTargets){
      toast("warning","Hedef liste yüklenmedi (br:targets:set çağrılmadı).");
    }
    setScanState(true);
  });
  document.addEventListener("br:scan:stop", ()=>{ setScanState(false); });

  // ========================= DS/EXPORT =========================
  function isDsActive(){
    try{ const st = ns.ds?.status?.(); return !!st && (st.queue + st.active) > 0; }
    catch{ return false; }
  }
  function enforceStopScan(){
    try { document.dispatchEvent(new CustomEvent("br:scan:stop")); } catch {}
    setScanState(false);
  }
  function lockPanel(on=true, text){
    try{ document.dispatchEvent(new CustomEvent("br:panel:lock", { detail:{ on, text } })); }catch{}
  }
  function waitDsThenResume(resumeFn){
    lockPanel(true, "Arka plan DS işlemleri tamamlanıyor…");
    try { document.dispatchEvent(new CustomEvent("br:ds:overlay:open")); } catch {}
    toast("info","DS sürüyor… Bittiğinde indirme otomatik başlayacak.", 1800);
    const onDrained = ()=>{
      document.removeEventListener("br:ds:drained", onDrained);
      lockPanel(false);
      try { resumeFn && resumeFn(); } catch {}
    };
    document.addEventListener("br:ds:drained", onDrained);
  }

  // Sayaçtan toplam taranan (tt) okuma (UI)
  function readTotalScannedFromUI(){
    const el = document.querySelector('.br-counters__grid .br-counters__item .br-counters__value');
    if (!el) return 0;
    const n = Number(String(el.textContent).replace(/[^\d.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }
  function buildFilename(tt, te){
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,'0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}.${pad(d.getMinutes())}`;
    return `${dateStr} - ${timeStr} - tt${tt} - te${te}`;
  }

  function createIsland() {
    if (mounted) return;
    mounted = true;

    root = document.createElement("div");
    root.className = "br-island br-island--stack";
    root.style.opacity = "0";
    root.style.pointerEvents = "none";

    // --- Tarama ---
    btnScan = document.createElement("button");
    btnScan.type = "button";
    btnScan.className = "br-island__btn br-island__btn--scan";
    btnScan.style.pointerEvents = "auto";
    btnScan.innerHTML = `
      <span class="br-island__icon" aria-hidden="true">▶</span>
      <span class="br-island__label">Taramayı Başlat</span>
    `;
    btnScan.addEventListener("click", () => {
      if (!scanning) {
        document.dispatchEvent(new CustomEvent("br:scan:start", {
          detail: { selector: ".p-card-wrppr", minDwellMs: 40 }
        }));
      } else {
        document.dispatchEvent(new CustomEvent("br:scan:stop"));
      }
    });

    // --- Eşleşenleri İndir ---
    btnExport = document.createElement("button");
    btnExport.type = "button";
    btnExport.className = "br-island__btn br-island__btn--export is-disabled";
    btnExport.setAttribute("aria-disabled", "true");
    btnExport.style.pointerEvents = "auto";
    btnExport.innerHTML = `
      <span class="br-island__icon" aria-hidden="true">⬇</span>
      <span class="br-island__label">Eşleşenleri İndir</span>
    `;
    btnExport.addEventListener("click", async (e) => {
      if (!exportReady || matches.length === 0) {
        toast("info","İndirilecek eşleşme yok");
        return;
      }
      // 1) Mutlaka taramayı durdur
      enforceStopScan();

      // 2) DS aktifse: kilitle ve bitince tekrar dene
      if (isDsActive()){
        e.preventDefault(); e.stopPropagation();
        waitDsThenResume(()=> { try { btnExport.click(); } catch{} });
        return;
      }

      try{
        if (!window.BR_XLSX?.exportMatches) {
          toast("error","Export modülü yok (BR_XLSX.exportMatches)");
          return;
        }

        const te = matches.length;
        const tt = readTotalScannedFromUI();
        const filename = buildFilename(tt, te);
        const meta = {
          tt, te,
          createdAt: new Date().toISOString(),
          selectedCampaigns: (ns.campaignsMatch && ns.campaignsMatch.getSelected)
            ? ns.campaignsMatch.getSelected()
            : []
        };

        const { blobUrl, filename: outName } = await window.BR_XLSX.exportMatches({
          rows: matches,
          filename,   // doğrudan kullan
          filenameBase: "eslesenler",
          meta
        });

        const a = document.createElement("a");
        a.href = blobUrl; a.download = outName;
        document.body.appendChild(a); a.click(); a.remove();
        toast("success", "Eşleşenler indiriliyor…");
      }catch(err){
        toast("error","İndirilemedi: " + (err?.message||err));
      }
    });

    root.append(btnScan, btnExport);
    document.documentElement.appendChild(root);

    setScanState(false);
    setExportEnabled(false);

    attachObservers();
    requestAnimationFrame(reposition);

    // dsOverlay açık/kapalı iken ada butonlarını kilitle
    const setIslandLock = (on)=> { if (!root) return; root.classList.toggle('is-locked', !!on); };
    document.addEventListener('br:ds:overlay:open', () => setIslandLock(true));
    document.addEventListener('br:ds:overlay:close', () => setIslandLock(false));
    document.addEventListener('br:ds:drained',      () => setIslandLock(false));
  }

  createIsland();

})(window.BR = window.BR || {});
