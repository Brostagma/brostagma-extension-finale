// scan.js
// Güvenli tarama: daha uzun dwell + hazır/kararlı DOM bekleme + küçük rastgele nefesler
// match.checkBundle senkron veya async olabilir; burada her iki durumu da bekliyoruz.
(function(){
  let stopFlag = false;
  let lastProcessedId = -1;
  let nextId = 0;
  let scanCountBase = 0;
  let scanCount = 0;

  // ⚙️ Pace ayarları (Hızlandırılmış)
  const FIXED_DWELL_MS    = 80;   // her kartta en az bu kadar "scanning" göster (düşürüldü)
  const READY_TIMEOUT_MS  = 800;  // brand/name/sub-text hazır olana kadar en fazla bu kadar bekle (düşürüldü)
  const READY_POLL_MS     = 40;   // daha sık kontrol (düşürüldü)
  const STABLE_WINDOW_MS  = 80;   // DOM text uzunlukları şu kadar süre değişmiyorsa "kararlı" (düşürüldü)
  const INTER_CARD_DELAY  = 40;   // kartlar arası nefes (düşürüldü)
  const RAND_JITTER_MS    = [10, 30]; // ekstra ufak beklemeler (ayarlandı)


  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rnd = (a,b)=> a + Math.floor(Math.random()*((b-a)+1));

  function readCurrentTotalFromUI(){
    const el = document.querySelector('.br-counters__grid .br-counters__item .br-counters__value');
    if (!el) return 0;
    const n = Number(String(el.textContent).replace(/[^\d.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }
  function assignIds(els){ for (const el of els){ if (!el.dataset.brId) el.dataset.brId = String(++nextId); } }
  function markProcessed(el){ el.dataset.brProcessed = "1"; lastProcessedId = Math.max(lastProcessedId, Number(el.dataset.brId)||-1); }

  async function bringIntoView(el){
    try { el.scrollIntoView({ behavior:"smooth", block:"center" }); } catch {}
    await sleep(140);
  }

  // ---- Yardımcı: metin çekici
  function pick(el){
    if (!el) return "";
    const t = el.getAttribute && el.getAttribute("title");
    return (t && t.trim()) || (el.textContent || "").trim();
  }

  // ---- Kart alanları hazır mı?
  function hasProductBrand(el){
    const q = s => el.querySelector(s);
    const brand = pick(q(".prdct-desc-cntnr-ttl")) || pick(q("[data-testid='brand']")) || pick(q(".brand"));
    const name  = pick(q(".product-desc-cntnr-name")) || pick(q(".prdct-desc-cntnr-name")) || pick(q("[data-testid='product-name']")) || pick(q(".name"));
    const sub   = pick(q(".product-desc-sub-text")) || pick(q(".product-desc-sub-container .product-desc-sub-text"));
    const hasProduct = (sub && sub.length > 3) || (name && name.length > 3);
    const hasBrand   = (brand && brand.length > 1);
    return { has: (hasProduct || hasBrand), brand, name, sub };
  }
  async function waitCardReady(el, timeoutMs = READY_TIMEOUT_MS, pollMs = READY_POLL_MS){
    const t0 = performance.now();
    while (performance.now() - t0 < timeoutMs){
      if (hasProductBrand(el).has) return true;
      await sleep(pollMs);
    }
    return false;
  }

  // ---- Kart DOM'u "kararlı" mı? (küçük süre boyunca metinler değişmeyecek)
  async function waitDomStable(el, timeoutMs = READY_TIMEOUT_MS){
    const q = s => el.querySelector(s);
    const snapshot = () => ({
      brand: (pick(q(".prdct-desc-cntnr-ttl")) || pick(q("[data-testid='brand']")) || pick(q(".brand"))).length,
      name:  (pick(q(".product-desc-cntnr-name")) || pick(q(".prdct-desc-cntnr-name")) || pick(q("[data-testid='product-name']")) || pick(q(".name"))).length,
      sub:   (pick(q(".product-desc-sub-text")) || pick(q(".product-desc-sub-container .product-desc-sub-text"))).length,
      price: (pick(q(".prc-box-dscntd")) || pick(q(".prc-box-sllng")) || pick(q("[data-testid='price-current']")) || pick(q(".price")) || pick(q(".prc-box"))).length
    });

    let last = snapshot();
    let lastChange = performance.now();

    const obs = new MutationObserver(()=>{ lastChange = performance.now(); });
    try { obs.observe(el, {subtree:true, childList:true, characterData:true}); } catch {}

    const t0 = performance.now();
    while (performance.now() - t0 < timeoutMs){
      const now = snapshot();
      const changed = (now.brand!==last.brand || now.name!==last.name || now.sub!==last.sub || now.price!==last.price);
      if (changed){ last = now; lastChange = performance.now(); }
      // Belirli bir pencere boyunca değişiklik yoksa "kararlı" say
      if ((performance.now() - lastChange) >= STABLE_WINDOW_MS){
        obs.disconnect();
        return true;
      }
      await sleep(50);
    }
    obs.disconnect();
    return false;
  }

  // ---- Kampanya rozetlerini topla
  function extractCampaigns(el){
    const names = Array.from(el.querySelectorAll(
      ".variant-options-wrapper .name, .badges-wrapper .name, [class*='badge'] .name, .badge .name"
    )).map(pick).map(s => s && s.trim()).filter(Boolean);

    // uniq
    const out = []; const seen = new Set();
    for (const n of names){ const k = n.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(n); }
    return out;
  }

  // ---- Bundle oluştur
  function extractBundle(el){
    const q = s => el.querySelector(s);
    const brandEl = q(".prdct-desc-cntnr-ttl") || q("[data-testid='brand']") || q(".brand");
    const nameEl  = q(".product-desc-cntnr-name") || q(".prdct-desc-cntnr-name") || q("[data-testid='product-name']") || q(".name");
    const subEl   = q(".product-desc-sub-text") || q(".product-desc-sub-container .product-desc-sub-text");

    const brandText = pick(brandEl);
    const nameText  = pick(nameEl);
    const subText   = pick(subEl);

    const productText = subText || nameText;
    const wholeText   = [brandText, productText || nameText].filter(Boolean).join(" ");

    const priceText = pick(q(".prc-box-dscntd")) || pick(q(".prc-box-sllng")) ||
                      pick(q("[data-testid='price-current']")) || pick(q(".price")) || pick(q(".prc-box"));

    let url = ""; const a = el.querySelector("a[href]"); if (a && a.href) url = a.href;

    // 🔹 Kampanyalar (rozet isimleri)
    const campaigns = extractCampaigns(el);
    try { el.dataset.brCampaigns = JSON.stringify(campaigns.slice(0, 12)); } catch {}

    return { brandText, productText, wholeText, priceText, url, campaigns };
  }

  // ---- match çağrısını senkron/async uyumlu bekle
  async function callMatch(bundle){
    try{
      const r = window.BR?.match?.checkBundle?.(bundle);
      if (r && typeof r.then === "function") return await r;
      return r;
    }catch(_){ return null; }
  }

  // =========================
  //   NEGATIF PREFILTER
  // =========================
  const NEG_STORAGE_KEY = "negatives:list"; // negatives.js ile aynı anahtar
  let negList = [];
  let negListNorm = [];

  function normalizeTr(s){
    // Türkçe harfleri taban forma indir, sonra locale lower
    const map = { "İ":"i", "I":"i", "ı":"i", "Ş":"s", "ş":"s", "Ğ":"g", "ğ":"g", "Ü":"u", "ü":"u", "Ö":"o", "ö":"o", "Ç":"c", "ç":"c" };
    const str = String(s || "").replace(/[İIıŞşĞğÜüÖöÇç]/g, ch => map[ch] || ch);
    try { return str.toLocaleLowerCase("tr"); } catch { return str.toLowerCase(); }
  }
  function normalizeForSearch(s){
    // diakritikleri ve noktalama/özel karakterleri sadeleştir
    let x = normalizeTr(s);
    try { x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch {}
    return x.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  async function loadNegatives(){
    try{
      const val = await (window.BR?.storage?.get?.(NEG_STORAGE_KEY, []) ?? Promise.resolve([]));
      negList = Array.isArray(val) ? val : [];
    }catch{ negList = []; }
    // Normalize + uniq
    const seen = new Set();
    negListNorm = [];
    for (const s of negList){
      const t = normalizeForSearch(String(s||""));
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      negListNorm.push(t);
    }
  }
  function bundleTextForCheck(bundle){
    const parts = [bundle.brandText, bundle.productText, bundle.wholeText, bundle.url];
    return normalizeForSearch(parts.filter(Boolean).join(" "));
  }
  function hasNegative(bundle){
    if (!negListNorm.length) return false;
    const text = bundleTextForCheck(bundle);
    for (const neg of negListNorm){
      if (!neg) continue;
      if (text.includes(neg)) return true; // basit ve hızlı: phrase içerenleri yakalar
    }
    return false;
  }

  // 👇 Görsel katman artık scanHighlight.js tarafından yönetiliyor.
  function showPassEmoji(el){
    try{
      document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"pass" }}));
    }catch{}
  }

  // =========================

  async function scanLoop({ selector }){
    let allEls = Array.from(document.querySelectorAll(selector));
    assignIds(allEls);

    while(!stopFlag){
      allEls = Array.from(document.querySelectorAll(selector));
      assignIds(allEls);

      const candidates = allEls.filter(el => Number(el.dataset.brId) > lastProcessedId);
      if (candidates.length === 0) break;

      for (const el of candidates){
        if (stopFlag) break;

        await bringIntoView(el);

        // SCANNING başlat: hold=true (done gelene kadar açık)
        document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"scanning", hold:true }}));

        // İçerik hazır + kısa süre kararlı olsun
        await waitCardReady(el);
        await waitDomStable(el);

        const t0 = performance.now();

        // 1) Bundle
        const bundle = extractBundle(el);

        // 1.5) NEGATIF PREFILTER: negatif içeriyorsa match'e hiç gitme
        let skippedByNegative = false;
        if (hasNegative(bundle)){
          skippedByNegative = true;
        }

        let result = null;
        if (!skippedByNegative){
          // 2) match (senkron/async olabilir)
          result = await callMatch(bundle);
        }

        // En az FIXED_DWELL_MS görünür kalsın
        const elapsed = performance.now() - t0;
        if (elapsed < FIXED_DWELL_MS) await sleep(FIXED_DWELL_MS - elapsed);

        // SCANNING bitti
        document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"done" }}));

        if (skippedByNegative){
          // Kart üzerinde "pass" görselini tetikle
          showPassEmoji(el);
        } else if (result && result.ok){
          // 🔸 Son onay: kampanya filtresi (kart üstünden)
          const passByCampaign = !!(window.BR?.campaignsMatch) && !window.BR.campaignsMatch.accept(bundle);
          if (passByCampaign){
            // ✅ Kartta yok ama ürün sayfasında olabilir: DS'e "kampanya kontrolü" işi ekle
            try{
              document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"dt" }})); // arka plan kontrol hissi
              document.dispatchEvent(new CustomEvent("br:ds:enqueue", {
                detail: { el, url: bundle.url, bundle, checkCampaignOnly:true }
              }));
            }catch(_){}
          } else {
            try { el.setAttribute("data-br-match","1"); } catch {}
            document.dispatchEvent(new CustomEvent("br:scan:highlight", { detail:{ el, state:"match" }}));
            document.dispatchEvent(new CustomEvent("br:scan:match", {
              detail: {
                el,
                kind:  result.kind,
                mode:  result.mode,
                term:  result.term,
                votes: result.votes,
                price: result.price,
                url:   result.url
              }
            }));
            await sleep(140);
          }
        } else if (result && result.dt){
          // ❇️ DS kuyruğuna al: ürün sayfasına gidip breadcrumb'lardan kategori doğrulaması yapacağız
          try{
            document.dispatchEvent(new CustomEvent("br:ds:enqueue", {
              detail: {
                el,
                url: bundle.url,
                bundle, // 🔸 kampanyalar DS'e de taşınır
                hint: { brand: bundle.brandText, product: bundle.productText }
              }
            }));
          }catch(_){}
        }

        markProcessed(el);

        // Sayaç
        scanCount++;
        try {
          const totalNow = scanCountBase + scanCount;
          window.BR?.counters?.set?.({ total: totalNow });
        } catch {}

        // Kartlar arası nefes + ufak rastgele jitter
        if (!stopFlag){
          await sleep(INTER_CARD_DELAY + rnd(RAND_JITTER_MS[0], RAND_JITTER_MS[1]));
        }
      }
    }
  }

  // Negatif liste değişince (UI'dan) runtime güncelle
  document.addEventListener("br:negatives:changed", async ()=>{ await loadNegatives(); }); // negatives.js bu event'i yayınlıyor.

  document.addEventListener("br:scan:start", e=>{
    const d = e.detail||{};
    stopFlag = false;
    scanCountBase = readCurrentTotalFromUI();
    scanCount = 0;
    // Taramaya başlamadan storage'tan negatifleri çek
    (async()=>{
      await loadNegatives(); // persist geri çekilir; kullanıcı yeniden girmek zorunda değil.
      scanLoop({ selector:d.selector||".p-card-wrppr" });
    })();
  });
  document.addEventListener("br:scan:stop", ()=>{ stopFlag = true; });
})()