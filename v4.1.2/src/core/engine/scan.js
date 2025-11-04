// scan.js
// Sürüm 9 (Nihai - Bundle Loglama): Sadece çıkarılan kart bilgilerini konsola yazar.
(function(){
  // 🔴 YAYINLAMADAN ÖNCE BURAYI FALSE YAPIN! (Üretim modu için)
  const __DEV_MODE__ = false;

  if (__DEV_MODE__) {
      console.log("[scan.js] Script loaded and running (v9 - DEV MODE: Console Logging ACTIVE).");
  } else {
      // Üretim modunda, tüm console çağrılarını etkisizleştiren bir dummy fonksiyon kümesi tanımlayabiliriz
      // Ancak modern build araçları bunu zaten yapar. En basit çözüm, if bloklarını kullanmaktır.
      // DİKKAT: Üretim modunda loglama olmaması için tüm log çağrıları __DEV_MODE__ if bloğu içinde olmalıdır.
  }
  
  let stopFlag = false;
  let nextId = 0; // ID atama için sayaç
  let scanCountBase = 0;
  let scanCount = 0;

  // ⚙️ Pace Ayarları (Toleranslı)
  const FIXED_DWELL_MS    = 80;    // Her kartta minimum 'scanning' süresi
  const READY_TIMEOUT_MS  = 2500;  // Marka/İsim bulmak için maksimum bekleme süresi
  const READY_POLL_MS     = 70;    // Marka/İsim kontrol sıklığı
  const STABLE_TIMEOUT_MS = 2500;  // Fiyatın stabil olması için maksimum bekleme süresi
  const STABLE_WINDOW_MS  = 200;   // Temel bilgiler bulunduktan sonra beklenecek stabilite süresi
  const STABLE_POLL_MS    = 70;    // Stabilite kontrol sıklığı
  const INTER_CARD_DELAY  = 50;    // Kartlar arası bekleme
  const RAND_JITTER_MS    = [10, 40]; // Rastgele bekleme aralığı

  // --- Yardımcı Fonksiyonlar ---
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rnd = (a,b)=> a + Math.floor(Math.random()*((b-a)+1));

  function readCurrentTotalFromUI(){
    const el = document.querySelector('.br-counters__grid .br-counters__item .br-counters__value');
    if (!el) return 0;
    const n = Number(String(el.textContent).replace(/[^\d.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }
  function assignIds(els){ for (const el of els){ if (!el.dataset.brId) el.dataset.brId = String(++nextId); } }

  function markProcessed(el){
    if (!el || !el.dataset) return;
    el.dataset.brProcessed = "1";
  }

  async function bringIntoView(el){
    try { el.scrollIntoView({ behavior:"smooth", block:"center" }); } catch {}
    await sleep(150);
  }

  function pick(el){
    if (!el) return "";
    const t = el.getAttribute && (el.getAttribute("title") || el.getAttribute("aria-label"));
    return (t && t.trim()) || (el.textContent || "").trim();
  }

  // --- Kart Hazırlık ve Stabilite Kontrolleri ---

  function hasProductBrand(el){
    const q = s => el.querySelector(s);
    const brand = pick(q("span.product-brand"));
    const name  = pick(q("span.product-name"));
    const hasProduct = (name && name.length > 1);
    const hasBrand   = (brand && brand.length > 0);
    return { has: (hasProduct || hasBrand), brand, name };
  }

  async function waitCardReady(el, timeoutMs = READY_TIMEOUT_MS, pollMs = READY_POLL_MS){
    const t0 = performance.now();
    while (performance.now() - t0 < timeoutMs){
      if (hasProductBrand(el).has) return true;
      await sleep(pollMs);
    }
    if (__DEV_MODE__) console.warn(`[scan.js] waitCardReady TIMEOUT for card ${el.dataset.brId}. Neither Brand nor Name found.`);
    return false;
  }

  async function waitDomStable(el, timeoutMs = STABLE_TIMEOUT_MS, pollMs = STABLE_POLL_MS){
    const t0_stable = performance.now();
    const q = s => el.querySelector(s);

    const getPriceText = () => {
        return pick(q(".basket-promo-price-wrapper .price-value")) || // 1. Sepette İndirim
               pick(q(".ty-plus-promotion-price .price-value")) ||     // 2. Plus'a Özel Fiyat
               pick(q(".discounted-price > .sale-price")) ||          // 3. İndirimli Fiyat (sale-price)
               pick(q(".discounted-price > .price-value")) ||         // 4. İndirimli Fiyat (price-value)
               pick(q(".single-price > .price-section")) ||          // 5. Normal Fiyat (price-section)
               pick(q(".promotion-price > span.prc-slg")) ||
               pick(q(".discounted-price > div.prc-slg")) ||
               pick(q(".single-price > div.prc-slg"));
    };

    const snapshot = () => ({
      hasBrand: (pick(q("span.product-brand")) || "").length > 0,
      hasName:  (pick(q("span.product-name")) || "").length > 1,
      hasPrice: (getPriceText() || "").length > 0
    });

    let lastState = snapshot();
    let essentialsFoundTime = null;

    if (lastState.hasBrand && lastState.hasName && lastState.hasPrice) {
        essentialsFoundTime = performance.now();
    }

    let obs = null;
    const startObserver = () => { if (obs) return; obs = new MutationObserver(()=>{ const currentState = snapshot(); if (!essentialsFoundTime && currentState.hasBrand && currentState.hasName && currentState.hasPrice) { essentialsFoundTime = performance.now(); stopObserver(); } }); try { obs.observe(el, {subtree:true, childList:true, characterData:true, attributes: false}); } catch (e) { if (__DEV_MODE__) console.error(`Observer start failed for ${el.dataset.brId}`, e); obs = null; } };
    const stopObserver = () => { if (obs) { try { obs.disconnect(); } catch {} obs = null; } };

    if (!essentialsFoundTime) { startObserver(); }

    const t0 = performance.now();
    while (performance.now() - t0 < timeoutMs){
      if (!essentialsFoundTime) {
          const nowState = snapshot();
          if (nowState.hasBrand && nowState.hasName && nowState.hasPrice) {
              essentialsFoundTime = performance.now();
              stopObserver();
          }
          lastState = nowState;
      }

      if (essentialsFoundTime && (performance.now() - essentialsFoundTime) >= STABLE_WINDOW_MS) {
          stopObserver();
          return true;
      }
      await sleep(pollMs);
    }
    stopObserver();

    if (essentialsFoundTime || (lastState.hasBrand && lastState.hasName && lastState.hasPrice)) {
         // Log kaldırıldı
         return true; // ATLAMADAN devam et
    } else {
        if (__DEV_MODE__) console.error(`[scan.js] waitDomStable SEVERE TIMEOUT for card ${el.dataset.brId}. ESSENTIALS NEVER FOUND:`, lastState);
        return false; // ATLA
    }
}

  // --- Veri Çıkarma ---

  function extractCampaigns(el){ const names = Array.from(el.querySelectorAll(".simplified-badge-text")).map(pick).map(s => s && s.trim()).filter(Boolean); const out = []; const seen = new Set(); for (const n of names){ const k = n.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(n); } return out; }

  function extractBundle(el){
    const q = s => el.querySelector(s);
    const brandText = pick(q("span.product-brand"));
    const nameText  = pick(q("span.product-name"));
    const productText = nameText;
    const wholeText   = [brandText, productText].filter(Boolean).join(" ");

    const priceText =
      pick(q(".basket-promo-price-wrapper .price-value")) || // 1.
      pick(q(".ty-plus-promotion-price .price-value")) ||     // 2.
      pick(q(".discounted-price > .sale-price")) ||          // 3.
      pick(q(".discounted-price > .price-value")) ||         // 4.
      pick(q(".single-price > .price-section")) ||          // 5.
      pick(q(".promotion-price > span.prc-slg")) ||
      pick(q(".discounted-price > div.prc-slg")) ||
      pick(q(".single-price > div.prc-slg"));

    let url = "";
    if (el && el.href) { try{ url = new URL(el.href, location.href).href; } catch { url = el.href; } }
    else { if (__DEV_MODE__) console.warn(`[scan.js] URL extraction failed for card ${el.dataset.brId}`); }

    const campaigns = extractCampaigns(el);
    try { el.dataset.brCampaigns = JSON.stringify(campaigns.slice(0, 12)); } catch {}

    const bundle = { brandText, productText, wholeText, priceText, url, campaigns };
    if (!priceText && __DEV_MODE__) console.warn(`[scan.js] Price extraction might have failed for card ${el.dataset.brId}`);

    // ======================================================
    //   İSTENEN TEK LOGLAMA KISMI (Sadece Geliştirme Modunda Çalışır)
    // ======================================================
    if (__DEV_MODE__) { // Sadece DEV MOD açıksa logla
        console.log(
            `[scan.js] Kart ${el.dataset.brId} Bilgileri:\n` +
            `  Marka: ${bundle.brandText || '(Bulunamadı)'}\n` +
            `  Ürün Adı: ${bundle.productText || '(Bulunamadı)'}\n` +
            `  Fiyat Metni: ${bundle.priceText || '(Bulunamadı)'}\n` +
            `  URL: ${bundle.url || '(Bulunamadı)'}\n` +
            `  Kampanyalar: ${bundle.campaigns.length > 0 ? bundle.campaigns.join(', ') : '(Yok)'}`
        );
    }
    // ======================================================

    return bundle;
  }

  // --- Eşleştirme ve Negatif Filtre ---

  async function callMatch(bundle){ try{ const r = window.BR?.match?.checkBundle?.(bundle); return (r && typeof r.then === "function") ? await r : r; }catch(err){ if (__DEV_MODE__) console.error(`[scan.js] callMatch FAILED for ${bundle.brandText}. Error:`, err); return null; } }
  const NEG_STORAGE_KEY = "negatives:list"; let negListNorm = [];
  function normalizeTr(s){ const map = { "İ":"i", "I":"i", "ı":"i", "Ş":"s", "ş":"s", "Ğ":"g", "ğ":"g", "Ü":"u", "ü":"u", "Ö":"o", "ö":"o", "Ç":"c", "ç":"c" }; const str = String(s || "").replace(/[İIıŞşĞğÜüÖöÇç]/g, ch => map[ch] || ch); try { return str.toLocaleLowerCase("tr"); } catch { return str.toLowerCase(); } }
  function normalizeForSearch(s){ let x = normalizeTr(s); try { x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch {} return x.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
  async function loadNegatives(){ try{ const val = await (window.BR?.storage?.get?.(NEG_STORAGE_KEY, []) ?? Promise.resolve([])); const negList = Array.isArray(val) ? val : []; const seen = new Set(); negListNorm = []; for (const s of negList){ const t = normalizeForSearch(String(s||"")); if (!t || seen.has(t)) continue; seen.add(t); negListNorm.push(t); } }catch(err){ if (__DEV_MODE__) console.error("Failed to load negatives:", err); negListNorm = []; } }
  function bundleTextForCheck(bundle){ const parts = [bundle.brandText, bundle.productText, bundle.wholeText, bundle.url]; return normalizeForSearch(parts.filter(Boolean).join(" ")); }
  function hasNegative(bundle){ if (!negListNorm.length) return false; const text = bundleTextForCheck(bundle); for (const neg of negListNorm){ if (text.includes(neg)) { return true; } } return false; }
  function showPassEmoji(el){ try{ document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"pass" }})); }catch{} }

  // =========================
  //   ANA TARAMA DÖNGÜSÜ
  // =========================
  async function scanLoop({ selector }){
    // Log kaldırıldı
    while(!stopFlag){
      let allEls = Array.from(document.querySelectorAll(selector));
      assignIds(allEls);
      const candidates = allEls.filter(el => !el.dataset.brProcessed);

      if (candidates.length === 0) { await sleep(500); continue; }

      for (const el of candidates){
        if (!el || !el.dataset) continue;
        if (!el.dataset.brId) el.dataset.brId = String(++nextId);
        if (stopFlag) { /* console.log("[scan.js] Stop requested."); */ break; } 

        await bringIntoView(el);
        document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"scanning", hold:true }}));

        const stable = await waitDomStable(el);

        if (!stable) { // Sadece temel bilgiler hiç bulunamadıysa atla
            if (__DEV_MODE__) console.error(`[scan.js] SEVERE SKIP for card ${el.dataset.brId}. Essentials never found.`);
            markProcessed(el);
            document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"done" }}));
            await sleep(INTER_CARD_DELAY);
            continue;
        }

        const t0 = performance.now();
        // Bundle çıkarma ve loglama burada yapılıyor
        const bundle = extractBundle(el);

        // Kritik bilgiler (URL veya Fiyat) eksikse atla
        if (!bundle.url || !bundle.priceText) {
             if (__DEV_MODE__) console.warn(`[scan.js] SKIPPING card ${el.dataset.brId} after bundle: missing URL ('${bundle.url}') or Price ('${bundle.priceText}').`);
             markProcessed(el);
             document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"done" }}));
             await sleep(INTER_CARD_DELAY);
             continue;
        }

        let skippedByNegative = hasNegative(bundle);
        let result = null;
        if (!skippedByNegative){
          result = await callMatch(bundle);
        }

        const elapsed = performance.now() - t0;
        if (elapsed < FIXED_DWELL_MS) await sleep(FIXED_DWELL_MS - elapsed);

        document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"done" }}));

        // Sonuçları işle
        if (skippedByNegative){
          showPassEmoji(el);
        } else if (result && result.ok){
          const passByCampaign = !!(window.BR?.campaignsMatch) && !window.BR.campaignsMatch.accept(bundle);
          if (passByCampaign){
            try{ document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"dt" }})); document.dispatchEvent(new CustomEvent("br:ds:enqueue", { detail: { el, url: bundle.url, bundle, checkCampaignOnly:true } })); }catch(err){ if (__DEV_MODE__) console.error("DS enqueue error (campaign):", err); }
          } else {
            try { el.setAttribute("data-br-match","1"); document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"match" }})); document.dispatchEvent(new CustomEvent("br:scan:match", { detail: { el, kind: result.kind, mode: result.mode, term: result.term, votes: result.votes, price: result.price, url: result.url } })); } catch {}
            await sleep(140);
          }
        } else if (result && result.dt){
          try{ document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"dt" }})); document.dispatchEvent(new CustomEvent("br:ds:enqueue", { detail: { el, url: bundle.url, bundle, hint: { brand: bundle.brandText, product: bundle.productText } } })); }catch(err){ if (__DEV_MODE__) console.error("DS enqueue error (normal):", err); }
        } else {
             showPassEmoji(el); // Eşleşmeyenlere 'pass' ikonu
        }

        markProcessed(el); // İşlendi

        scanCount++;
        try { const totalNow = scanCountBase + scanCount; window.BR?.counters?.set?.({ total: totalNow }); } catch(err) { if (__DEV_MODE__) console.error("Counter update error:", err); }

        if (!stopFlag){ await sleep(INTER_CARD_DELAY + rnd(RAND_JITTER_MS[0], RAND_JITTER_MS[1])); }
      } // for loop
    } // while loop
    // Log kaldırıldı
  }

  // --- Olay Dinleyicileri ---
  document.addEventListener("br:negatives:changed", async ()=>{ await loadNegatives(); });
  document.addEventListener("br:scan:start", e=>{ const d = e.detail||{}; stopFlag = false; nextId = 0; document.querySelectorAll('[data-br-processed="1"]').forEach(el => { try { delete el.dataset.brProcessed; } catch {} }); document.querySelectorAll('[data-br-id]').forEach(el => { try { delete el.dataset.brId; } catch {} }); scanCountBase = readCurrentTotalFromUI(); scanCount = 0; (async()=>{ await loadNegatives(); scanLoop({ selector:d.selector||"[data-testid='product-card']" }); })(); });
  document.addEventListener("br:scan:stop", ()=>{ /*console.log("Scan stop received.");*/ stopFlag = true; }); // İç log kaldırıldı
  // Log kaldırıldı

})()
