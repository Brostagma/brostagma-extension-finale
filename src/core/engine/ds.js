// ds.js
// Derin Tarama (DS): "emin değiliz" (dt) vakaları arka planda ürün sayfasına gidip breadcrumb'lardan kategori doğrular.
// + Kartta görünmeyen kampanyayı ürün sayfasında arayıp son onayı verebilir.

(function(ns){
  const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
  const rnd = (a,b)=> a + Math.floor(Math.random()*((b-a)+1));

  const CONF = {
    maxQueue: 60,
    throttleMs: [350, 650],   // istekler arası nefes
    backoffBase: 700,         // 429 sonrası taban bekleme
    maxAttempts: 3,           // 429/bağlantı hatasında en fazla deneme
  };

  const Q = [];
  let active = 0;
  let processed = 0;
  let plannedTotal = 0;
  let dropped = 0;
  let stopped = false;

  function metrics(){
    document.dispatchEvent(new CustomEvent("br:ds:metrics", {
      detail: { queue: Q.length, active, processed, plannedTotal, dropped }
    }));
  }
  function drained(){
    if (Q.length===0 && active===0){
      document.dispatchEvent(new CustomEvent("br:ds:drained"));
    }
  }
  function status(){ return { queue: Q.length, active, processed, plannedTotal, dropped }; }

  function enqueue(item){
    if (!item || !item.url) return;
    const id = item.el?.dataset?.brId || item.url;
    // aynı kart + aynı iş tipi (sadece kampanya / normal) için dedupe
    if (Q.some(x => (x.id===id && x.checkCampaignOnly===item.checkCampaignOnly))) return;
    if (Q.length >= CONF.maxQueue){ Q.shift(); dropped++; }
    Q.push({ id, ...item });
    plannedTotal++;
    metrics();
    pump();
  }

  async function pump(){
    if (active>0 || stopped) return;
    if (Q.length===0){ drained(); return; }
    active = 1; metrics();
    try{
      while(Q.length && !stopped){
        const item = Q.shift();
        await processItem(item);
        processed++;
        await sleep(rnd(CONF.throttleMs[0], CONF.throttleMs[1]));
        metrics();
      }
    } finally {
      active = 0; metrics(); drained();
    }
  }

  async function fetchWithBackoff(url){
    let attempt = 0;
    let wait = rnd(180, 340);
    while (attempt < CONF.maxAttempts){
      await sleep(wait);
      try{
        const res = await fetch(url, { credentials: "include", mode: "cors", redirect: "follow" });
        if (res.status === 429){
          const ra = parseInt(res.headers.get("Retry-After")||"0",10);
          wait = (ra>0 ? ra*1000 : (CONF.backoffBase * Math.pow(1.6, attempt))) + rnd(120,240);
          attempt++; continue;
        }
        if (!res.ok) return null;
        return await res.text();
      }catch(_){
        wait = (CONF.backoffBase * Math.pow(1.5, attempt)) + rnd(100,200);
        attempt++;
      }
    }
    return null;
  }

  // ---------- Ürün sayfasından veri çıkarıcılar ----------
  function extractBreadcrumbs(html){
    try{
      const doc = new DOMParser().parseFromString(html, "text/html");
      const sel = [
        "#product-detail-seo-main-breadcrumbs .breadcrumb-list li",
        ".product-detail-new-breadcrumbs-item",
        ".breadcrumb-wrapper li",
        "nav[aria-label='breadcrumb'] li"
      ];
      const out=[]; const seen=new Set();
      for (const s of sel){
        const nodes = doc.querySelectorAll(s);
        for (const li of nodes){
          const t = (li.textContent||"").trim();
          if (t && !seen.has(t)){ seen.add(t); out.push(t); }
        }
      }
      return out;
    }catch(_){ return []; }
  }

  // 🔧 Daha dayanıklı kampanya çıkarımı:
  // 1) Promosyon konteynerleri içinde geniş bir selektör seti
  // 2) Yine boşsa fallback: tüm sayfa metninde TR-normalize regex araması
  function extractPageCampaigns(html){
    try{
      const doc = new DOMParser().parseFromString(html, "text/html");
      const out=[]; const seen=new Set();
      const add = (s)=>{
        const t = String(s||"").replace(/\s+/g," ").trim();
        if(!t) return; const k=t.toLowerCase();
        if(seen.has(k)) return; seen.add(k); out.push(t);
      };

      // 1) Konteyner odaklı tarama
      const roots = doc.querySelectorAll(
        "[data-testid='product-promotions'], .product-promotions-wrapper, .promotion-box, [data-testid='product-promotions-wrapper']"
      );
      const scopes = roots.length ? Array.from(roots) : [doc];

      const selectors = [
        "[data-testid='promotion-title']",
        ".promotion-title",
        ".promotion-box .title",
        ".promotion-box-item .title",
        ".promotion-box .text .title",
        ".promotion-box-item .text .title",
        ".promotion-box [data-testid='promotion-title']",
        ".promotion-box-item [data-testid='promotion-title']"
      ];

      for(const scope of scopes){
        for(const sel of selectors){
          scope.querySelectorAll(sel).forEach(n => add(n.textContent));
        }
      }

      // 2) Fallback: metinden desen çıkarımı
      if(out.length === 0){
        const MAP = { "İ":"i","I":"i","ı":"i","Ş":"s","ş":"s","Ğ":"g","ğ":"g","Ü":"u","ü":"u","Ö":"o","ö":"o","Ç":"c","ç":"c" };
        const norm = (s)=> String(s||"").replace(/[İIıŞşĞğÜüÖöÇç]/g, ch=>MAP[ch]||ch).toLowerCase();
        const txt = norm(doc.body?.textContent || html).replace(/\s+/g," ");

        // X Al Y Öde
        for(const m of txt.matchAll(/\b(\d+)\s*al\s*(\d+)\s*ode\b/g)){
          add(`${m[1]} Al ${m[2]} Öde`);
        }
        // Çok Al Az Öde
        if(/\bcok\s*al\s*az\s*ode\b/.test(txt)) add("Çok Al Az Öde");
        // 2. Ürün TL
        for(const m of txt.matchAll(/2\.\s*urun\s*(\d+)\s*tl/g)){
          add(`2. Ürün ${m[1]} TL`);
        }
        // 2. Ürün %
        if(/2\.\s*urun\s*%/.test(txt)) add("2. Ürün %");
        // TL Kupon
        for(const m of txt.matchAll(/\b(\d+)\s*tl\s*kupon\b/g)){
          add(`${m[1]} TL Kupon`);
        }
        if(/\btl\s*kupon\b/.test(txt)) add("TL Kupon");
        // Diğerleri
        if(/kupon\s*firsati/.test(txt)) add("Kupon Fırsatı");
        if(/birlikte\s*al\s*kazan/.test(txt)) add("Birlikte Al Kazan");
        if(/yetkili\s*satici/.test(txt)) add("Yetkili Satıcı");
      }

      return out;
    }catch(_){ return []; }
  }

  function normalize(s){
    try { return (ns.match?._normalize?.(s) || "").trim(); }
    catch { return String(s||"").toLowerCase(); }
  }
  function tokenize(s){
    try { return ns.match?._tokenize?.(s) || []; }
    catch { return String(s||"").toLowerCase().split(/\s+/g); }
  }

  function categoryHitFromBreadcrumbs(bcTexts){
    const joined = bcTexts.join(" ");
    const joinedNorm = normalize(joined);
    const tokens = new Set(tokenize(joinedNorm));
    const state = ns.match?._state;
    if (!state?.compiled?.category?.length) return false;

    for (const e of state.compiled.category){
      if (e.phrase && joinedNorm.includes(e.phrase)) return true;
      const low = state.lowValue?.category;
      try{
        const cov = ns.match?._interCoverage?.(tokens, e.tokensAll, low);
        if (cov && (cov.frac >= 0.60 || cov.hit >= 2)) return true;
      }catch(_){}
    }
    return false;
  }

  async function processItem(item){
    const html = await fetchWithBackoff(item.url);
    if (!html){
      try{ document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el:item.el, state:"dt" }})); }catch(_){}
      return;
    }

    // ----- 1) Sadece kampanya kontrolü istenmişse
    if (item.checkCampaignOnly){
      const pageCamps = extractPageCampaigns(html);
      const okByCamp = !ns.campaignsMatch || ns.campaignsMatch.accept({ campaigns: pageCamps });
      if (okByCamp){
        try { item.el?.setAttribute?.("data-br-match","1"); } catch {}
        document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el:item.el, state:"match" }}));
        document.dispatchEvent(new CustomEvent("br:scan:match", {
          detail: { el:item.el, kind:"product", mode:"ds-campaign", term: pageCamps.join(" | "), votes:0, price: item.bundle?.priceText||"", url:item.url, source:"ds" }
        }));
      }else{
        document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el:item.el, state:"pass" }}));
      }
      return;
    }

    // ----- 2) Normal DT akışı: önce kategori breadcrumb doğrulaması
    const bc = extractBreadcrumbs(html);
    const ok = categoryHitFromBreadcrumbs(bc);

    if (ok){
      // Kampanya son onayı: önce kartta varsa dene, yoksa sayfadan kontrol et
      let passByCampaign = false;
      if (ns.campaignsMatch){
        let accept = ns.campaignsMatch.accept(item.bundle||{});
        if (!accept){
          const pageCamps = extractPageCampaigns(html);
          accept = ns.campaignsMatch.accept({ campaigns: pageCamps });
        }
        passByCampaign = !accept;
      }
      if (passByCampaign){
        document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el:item.el, state:"pass" }}));
        return;
      }

      try { item.el?.setAttribute?.("data-br-match","1"); } catch {}
      document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el:item.el, state:"match" }}));
      document.dispatchEvent(new CustomEvent("br:scan:match", {
        detail: {
          el:item.el, kind:"product", mode:"ds-breadcrumb", term: bc.join(" > "),
          votes: 0, price: item.bundle?.priceText || "", url: item.url, source:"ds"
        }
      }));
    }else{
      document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el:item.el, state:"dt" }}));
    }
  }

  // Dış API + olaylar
  ns.ds = {
    enqueue,
    status,
    stop(){ stopped = true; Q.length = 0; metrics(); drained(); },
    resume(){ stopped = false; pump(); },
    clear(){ Q.length = 0; stopped = false; metrics(); }
  };

  // Tarayıcı olayları
  document.addEventListener("br:ds:enqueue", (e)=> enqueue(e.detail||{}));
  document.addEventListener("br:scan:stop",   ()=>{ /* DS’yi nazikçe boşaltıyoruz */ });

})(window.BR = window.BR || {});
