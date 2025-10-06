// src/core/match.js
// Modüler kural yapısı: r1..r8 (rule/*.js) dosyalarından çağrılır.
// DOM erişimi yok; yalnızca bundle ile çalışır.
(function (ns) {
  const CONF = {
    tokenMinLen: 3,
    strongMinLen: 4,
    idfStrongThresh: 0.70,
    prodAllMin: 2,
    prodStrongMin: 1,
    catAllMin: 2,
    catStrongMin: 1,
    maxWholeLen: 600,
    LOWVAL: { dfRatioMin: 0.35, maxTokenLen: 4, idfVeto: 0.15, storagePrefix: "br:lv:" },
    SCORE: { PHRASE:100, STRONG_PLUS:80, MID:60, WEAK:30, BRAND_PHRASE:60, BRAND_TOKEN:40 },
    SOFT_PHRASE_N: 3,
    // r5 (coverage) için eşikler:
    COV: { FRACTION: 0.60, FRACTION_BRAND_BOOST: 0.55, MIN_STRONG: 2 },
    // r6 (proximity) için eşikler:
    PROX: { MAX_GAP: 8 }
  };

  // Gürültü: renk/beden/numara… (yalnız ATTR ipucunda devreye sok)
  const ATTR_HINTS = ["renk","color","rengi","beden","numara","no","size","boyut","ölcü","olcu","ölçü","büyuk","buyuk","küçük","kucuk"];
  const COLOR_TOKENS = ["siyah","beyaz","mavi","lacivert","kirmizi","kırmızı","pembe","mor","turuncu","sari","sarı","yesil","yeşil","kahverengi","bej","krem","gri","antrasit","vizon","altin","altın","gumus","gümüş","pastel","bordo"];
  const SIZE_TOKENS  = ["xs","s","m","l","xl","xxl","xxxl","34","35","36","37","38","39","40","41","42","43","44","45"];

  // ---- Normalizasyon / tokenizasyon yardımcıları ----
  const trMap = (s)=> s.replace(/[İI]/g,"i").replace(/ı/g,"i").replace(/[Şş]/g,"s").replace(/[Ğğ]/g,"g").replace(/[Üü]/g,"u").replace(/[Öö]/g,"o").replace(/[Çç]/g,"c");
  function normalize(s){
    if(!s) return "";
    let t=trMap(String(s)).toLowerCase();
    t=t.replace(/\b(\d+[.,]?\d*)\s*(ml|gr|kg|lt|tl|cm|mm|x|adet|set|paket)\b/g," ");
    t=t.replace(/[^\p{L}\p{N}\s]/gu," ");
    t=t.replace(/\s+/g," ").trim();
    if(t.length>CONF.maxWholeLen) t=t.slice(0,CONF.maxWholeLen);
    return t;
  }
  function stemTr(w){ if(!w) return w; let s=w;
    s=s.replace(/(lari|leri|ları|leri)$/,"");
    s=s.replace(/(lar|ler)$/,"");
    s=s.replace(/(li|lı|lu|lü)$/,"");
    s=s.replace(/(siz|sız|suz|süz)$/,"");
    s=s.replace(/(lik|lık|luk|lük)$/,"");
    s=s.replace(/(ci|cı|cu|cü|çi|çı|çu|çü)$/,"");
    s=s.replace(/(sel|sal)$/,"");
    return s;
  }
  function tokenizeBase(str){
    const arr=normalize(str).split(" ");
    const out=[];
    for(let w of arr){
      if(!w) continue;
      if(w.length<CONF.tokenMinLen) continue;
      w=stemTr(w);
      if(w.length<CONF.tokenMinLen) continue;
      out.push(w);
    }
    return out;
  }
  const uniq = (a)=>{ const s=new Set(), o=[]; for(const x of a){ if(x && !s.has(x)){ s.add(x); o.push(x); } } return o; };

  function stripAttrNoiseTokens(text, tokens){
    if (!text) return tokens;
    const t = normalize(text), words=t.split(" ");
    const set=new Set(tokens);
    for (let i=0;i<words.length;i++){
      if (ATTR_HINTS.includes(words[i])){
        for (let j=Math.max(0,i-2); j<=Math.min(words.length-1,i+3); j++){
          const w=words[j];
          if (COLOR_TOKENS.includes(w)||SIZE_TOKENS.includes(w)) set.delete(w);
        }
      }
    }
    const attrLike=/\b(renk|color|beden|size|numara|no)\s*:\s*([^\s]+)/g; let m;
    while((m=attrLike.exec(t))!==null){
      const v=m[2];
      if(COLOR_TOKENS.includes(v)||SIZE_TOKENS.includes(v)) set.delete(v);
    }
    return Array.from(set);
  }

  function wordIncludes(hay, term){
    if(!term || term.length<3) return false;
    const esc=term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const re=new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`,"u");
    return re.test(hay);
  }

  const hashTargets=(obj)=>{ const s=JSON.stringify(obj||{}); let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return (h>>>0).toString(16); };

  // soft-phrase yardımcıları
  const makeNgrams=(t,n)=>{ const out=[]; if(t.length<n) return out; for(let i=0;i<=t.length-n;i++) out.push(t.slice(i,i+n).join(" ")); return out; };
  const hasSoftPhrase=(field, e)=>{
    if(e.phrase && wordIncludes(field,e.phrase)) return true;
    // DÜZELTME: sadece tek n yerine 3..2 tüm n-gramları tara
    const maxN = Math.min(CONF.SOFT_PHRASE_N, e.tokensAllArr.length);
    for (let n = maxN; n >= 2; n--) {
      const grams = e.ngrams[n] || [];
      for (const ng of grams) {
        if (wordIncludes(field, ng)) return true;
      }
    }
    return false;
  };

  // ---- State (hedef liste derlenmiş halleri) ----
  const state = {
    compiled: { brand:[], product:[], category:[] },
    tokenStats:{ totalDocs:0, df:new Map(), idfNorm:new Map() },
    anyTargets:false,
    lowValue:{ brand:new Set(), product:new Set(), category:new Set() }
  };

  function computeTokenStats(allDocsSets){
    const df=new Map(); const total=allDocsSets.length;
    for(const doc of allDocsSets){
      const seen=new Set();
      for(const t of doc){ if(seen.has(t)) continue; seen.add(t); df.set(t,(df.get(t)||0)+1); }
    }
    const idfNorm=new Map(); const denom=Math.log(total+1);
    for(const [t,d] of df){
      const raw=Math.log((total+1)/(d+1));
      idfNorm.set(t, denom>0?(raw/denom):0 );
    }
    state.tokenStats={ totalDocs:total, df, idfNorm };
  }
  const isStrongToken=(t)=> !!t && t.length>=CONF.strongMinLen && (state.tokenStats.idfNorm.get(t)||0) >= CONF.idfStrongThresh;

  function firstPassDocs(lists){
    const docs=[];
    for(const arr of lists){
      for(const raw of (arr||[])){
        const toks=new Set(uniq(tokenizeBase(raw)));
        if(toks.size) docs.push(toks);
      }
    }
    return docs;
  }

  function compileEntries(list){
    const out=[];
    for(const raw of (list||[])){
      const phrase=normalize(raw);
      if(!phrase) continue;
      const tokensAllArr=uniq(tokenizeBase(phrase));
      const tokensAll=new Set(tokensAllArr);
      const tokensStrong=new Set(tokensAllArr.filter(isStrongToken));
      const ngrams={2:makeNgrams(tokensAllArr,2), 3:makeNgrams(tokensAllArr,3)};
      out.push({ phrase, tokensAll, tokensAllArr, tokensStrong, ngrams });
    }
    return out;
  }

  function computeLowValueMap(targets){
    const fields=["brand","product","category"];
    const out={ brand:new Set(), product:new Set(), category:new Set() };
    for(const f of fields){
      const list=Array.isArray(targets?.[f])?targets[f]:[];
      if(!list.length) continue;
      const docs=[];
      for(const raw of list){
        const toks=new Set(uniq(tokenizeBase(raw)));
        if(toks.size) docs.push(toks);
      }
      if(!docs.length) continue;
      const df=new Map();
      for(const d of docs){ for(const t of d){ df.set(t,(df.get(t)||0)+1); } }
      const total=docs.length;
      const ratios=[...df.values()].map(v=>v/total).sort((a,b)=>a-b);
      const p75 = ratios.length ? ratios[Math.floor(ratios.length*0.75)] : 1;
      const thr=Math.max(CONF.LOWVAL.dfRatioMin, p75*0.9);
      for(const [t,d] of df){
        const ratio=d/total;
        const idfN=state.tokenStats.idfNorm.get(t)||0;
        if ((t.length<=CONF.LOWVAL.maxTokenLen || idfN<=CONF.LOWVAL.idfVeto) && ratio>=thr){ out[f].add(t); continue; }
        if ((COLOR_TOKENS.includes(t)||SIZE_TOKENS.includes(t)) && ratio>=thr){ out[f].add(t); }
      }
    }
    return out;
  }

  // ---- Genel yardımcılar (r5/r6 için de gerekir) ----
  function interCountExLow(hayTokens, entryTokensAll, lowSet){
    let c=0; for(const t of entryTokensAll){ if(lowSet && lowSet.has(t)) continue; if(hayTokens.has(t)) c++; } return c;
  }
  function interStrongCount(hayTokens, entry){ let c=0; for(const t of entry.tokensStrong){ if(hayTokens.has(t)) c++; } return c; }
  function interCoverage(hayTokens, entryTokensAll, lowSet){
    let hit=0, tot=0;
    for(const t of entryTokensAll){ if(lowSet && lowSet.has(t)) continue; tot++; if(hayTokens.has(t)) hit++; }
    return { hit, tot, frac: tot>0 ? hit/tot : 0 };
  }

  // ---- Hedef listesini set et ----
  function loadLV(key){
    try{
      const s=localStorage.getItem(key);
      if(!s) return null;
      const o=JSON.parse(s);
      return { brand:new Set(o.brand||[]), product:new Set(o.product||[]), category:new Set(o.category||[]) };
    }catch(_){ return null; }
  }
  function saveLV(key, lv){
    try{
      localStorage.setItem(key, JSON.stringify({ brand:[...lv.brand], product:[...lv.product], category:[...lv.category], ts:Date.now() }));
    }catch(_){}
  }

  function setTargets(data){
    const brand   = Array.isArray(data?.brand)   ? data.brand   : [];
    const product = Array.isArray(data?.product) ? data.product : [];
    const category= Array.isArray(data?.category)? data.category: [];

    computeTokenStats(firstPassDocs([brand,product,category]));
    state.compiled={ brand:compileEntries(brand), product:compileEntries(product), category:compileEntries(category) };

    const key = CONF.LOWVAL.storagePrefix + hashTargets({brand,product,category});
    const cached = loadLV(key);
    state.lowValue = cached || computeLowValueMap({brand,product,category});
    if (!cached) saveLV(key, state.lowValue);

    state.anyTargets = (state.compiled.brand.length + state.compiled.product.length + state.compiled.category.length) > 0;
  }

  document.addEventListener("br:targets:set",   (e)=> setTargets(e.detail?.data || e.detail || {}));
  document.addEventListener("br:targets:clear", ()=> setTargets({ brand:[], product:[], category:[] }));

  // ---- Skorlayıcılar (bundle üstünde) ----
  const interCount=(A,B)=>{ let c=0; for(const t of B){ if(A.has(t)) c++; } return c; };

  function scoreBrand(hay){
    for(const e of state.compiled.brand){
      if(e.phrase && wordIncludes(hay.brandTextNorm, e.phrase))
        return { ok:true, score:CONF.SCORE.BRAND_PHRASE, mode:"brand-phrase", term:e.phrase };
      if(e.tokensAll.size){
        const cAll=interCount(hay.brandTokens, e.tokensAll);
        if(cAll>=1) return { ok:true, score:CONF.SCORE.BRAND_TOKEN, mode:"brand-token", term:[...e.tokensAll][0] };
      }
    }
    return { ok:false, score:0 };
  }

  function scoreProduct(hay){
    let best={ ok:false, score:0, cAll:0, cStrong:0, mode:null, term:null };
    for(const e of state.compiled.product){
      if(hasSoftPhrase(hay.productTextNorm, e))
        return { ok:true, score:CONF.SCORE.PHRASE, cAll:Infinity, cStrong:Infinity, mode:"product-phrase", term:e.phrase };
      const cAll=interCountExLow(hay.productTokens, e.tokensAll, state.lowValue.product);
      const cStrong=interStrongCount(hay.productTokensRaw, e);
      let score=0, mode="product-weak", term=null;
      if(cStrong>=CONF.prodStrongMin && cAll>=CONF.prodAllMin){ score=CONF.SCORE.STRONG_PLUS; mode:"product-strong+all"; term=[...e.tokensStrong][0]||[...e.tokensAll][0]; }
      else if(cAll>=2){ score=CONF.SCORE.MID; mode:"product-mid"; term=[...e.tokensAll][0]||null; }
      else if(cAll>=1){ score=CONF.SCORE.WEAK; mode:"product-weak"; term=[...e.tokensAll][0]||null; }
      if(score>best.score) best={ ok:score>0, score, cAll, cStrong, mode, term };
    }
    return best;
  }

  function scoreCategory(hay){
    let best={ ok:false, score:0, cAll:0, cStrong:0, mode:null, term:null };
    for(const e of state.compiled.category){
      if(hasSoftPhrase(hay.wholeTextNorm, e))
        return { ok:true, score:CONF.SCORE.PHRASE, cAll:Infinity, cStrong:Infinity, mode:"category-phrase", term:e.phrase };
      const cAll=interCountExLow(hay.wholeTokens, e.tokensAll, state.lowValue.category);
      const cStrong=interStrongCount(hay.wholeTokensRaw, e);
      let score=0, mode="category-weak", term=null;
      if(cStrong>=CONF.catStrongMin && cAll>=CONF.catAllMin){ score=CONF.SCORE.STRONG_PLUS; mode:"category-strong+all"; term=[...e.tokensStrong][0]||[...e.tokensAll][0]; }
      else if(cAll>=2){ score=CONF.SCORE.MID; mode:"category-mid"; term=[...e.tokensAll][0]||null; }
      else if(cAll>=1){ score=CONF.SCORE.WEAK; mode:"category-weak"; term=[...e.tokensAll][0]||null; }
      if(score>best.score) best={ ok:score>0, score, cAll, cStrong, mode, term };
    }
    return best;
  }

  // ---- Ana değerlendirme (bundle) ----
  function checkBundle(bundle){
    try{
      if (!state.anyTargets) return { ok:false, votes:0, url:(bundle?.url||""), price:(bundle?.priceText||"") };

      const brandText=bundle?.brandText||"", productText=bundle?.productText||"";
      const wholeText=(bundle?.wholeText || (brandText+" "+productText)) || "";

      const productTokensBase=uniq(tokenizeBase(productText));
      const wholeTokensBase=uniq(tokenizeBase(wholeText));

      const hay={
        brandTextNorm:normalize(brandText),
        productTextNorm:normalize(productText),
        wholeTextNorm:normalize(wholeText),
        brandTokens:new Set(uniq(tokenizeBase(brandText))),
        productTokens:new Set(stripAttrNoiseTokens(productText, productTokensBase)),
        wholeTokens:new Set(stripAttrNoiseTokens(wholeText, wholeTokensBase)),
        productTokensRaw:new Set(productTokensBase),
        wholeTokensRaw:new Set(wholeTokensBase),
        // 🔧 EKLENDİ: r11 için URL bilgisi
        url: (bundle?.url || "")
      };

      // Skorlar
      const b=scoreBrand(hay);
      const p=scoreProduct(hay);
      const c=scoreCategory(hay);

      // Modüler kurallar
      const R = (window.BR && window.BR.rules) ? window.BR.rules : {};
      const safeEval = (rule, args)=> (rule && typeof rule.evaluate === "function") ? rule.evaluate(args) : { ok:false };

      // r1..r4 esas oy kuralları (S1..S4)
      const r1 = safeEval(R.r1, { p, c, CONF });                                           // Soft phrase
      const r2 = safeEval(R.r2, { p, c, CONF });                                           // Strong+All synergy
      const r3 = safeEval(R.r3, { p, c, CONF });                                           // Dual MID + strong
      const r4 = safeEval(R.r4, { p, c, b, CONF });                                        // Brand assisted

      // r5..r8 destekleyici kurallar
      const r5 = safeEval(R.r5, { hay, b, CONF, interCoverage, interStrongCount, state }); // Coverage
      const r6 = safeEval(R.r6, { hay, CONF });                                            // Proximity
      const r7 = safeEval(R.r7, { hay, CONF, state });                                     // Window coverage (local)
      const r8 = safeEval(R.r8, { hay, state });                                           // Ordered subsequence

      // r9..r10 diğer kurallar
      const r9  = safeEval(R.r9,  { hay, state });
      const r10 = safeEval(R.r10, { hay, state });

      // 🔧 YENİ: r11..r14 kurallarını da çağır
      const r11 = safeEval(R.r11, { hay, state }); // url-slug-booster
      const r12 = safeEval(R.r12, { hay, state }); // jaro-winkler-fallback
      const r13 = safeEval(R.r13, { hay, state }); // bm25f-lite
      const r14 = safeEval(R.r14, { hay, state }); // boundary-lcs

      // Oylar yalnız r1..r4 üzerinden sayılır
      const s1 = !!r1.ok, s2 = !!r2.ok, s3 = !!r3.ok, s4 = !!r4.ok;
      const votes = (s1?1:0) + (s2?1:0) + (s3?1:0) + (s4?1:0);

      // Kabul öncelik sırası (votes>=3): r1 > r2 > r3 > r4
      let accepted = null;
      if (votes >= 3) {
        if (r1.ok) accepted = { kind:r1.kind, mode:(votes===4 ? "full-4of4" : r1.mode), term:r1.term };
        else if (r2.ok) accepted = { kind:r2.kind, mode:(votes===4 ? "full-4of4" : r2.mode), term:r2.term };
        else if (r3.ok) accepted = { kind:r3.kind, mode:(votes===4 ? "full-4of4" : r3.mode), term:r3.term };
        else if (r4.ok) accepted = { kind:r4.kind, mode:(votes===4 ? "full-4of4" : r4.mode), term:r4.term };
      }
      // Güvenli gevşeme (votes===2): r1 > r2 > r5 > r6 > r7 > r8 > r9 > r10 > r11 > r12 > r13 > r14
      else if (votes === 2 && (r1.ok || r2.ok || r5.ok || r6.ok || r7.ok || r8.ok || r9.ok || r10.ok || r11.ok || r12.ok || r13.ok || r14.ok)) {
        if (r1.ok)      accepted = { kind:r1.kind, mode:"2of4+phrase",       term:r1.term };
        else if (r2.ok) accepted = { kind:r2.kind, mode:"2of4+strong+all",   term:r2.term };
        else if (r5.ok) accepted = { kind:r5.kind|| (p.score>=c.score?"product":"category"), mode:"2of4+coverage",      term:r5.term||p.term||c.term };
        else if (r6.ok) accepted = { kind:r6.kind|| (p.score>=c.score?"product":"category"), mode:"2of4+proximity",     term:r6.term||p.term||c.term };
        else if (r7.ok) accepted = { kind:"product", mode:"2of4+winCoverage",      term:r7.term||p.term||c.term };
        else if (r8.ok) accepted = { kind:"product", mode:"2of4+orderedSubseq",    term:r8.term||p.term||c.term };
        else if (r9.ok)  accepted = { kind:"product", mode:"2of4+fuzzyOrderedSubseq", term:r9.term || p.term || c.term };
        else if (r10.ok) accepted = { kind:"product", mode:"2of4+headTailCoverage",   term:r10.term || p.term || c.term };
        else if (r11.ok) accepted = { kind:r11.kind||"product", mode:"2of4+urlSlug",      term:r11.term || p.term || c.term };
        else if (r12.ok) accepted = { kind:"product",            mode: r12.dt ? "2of4+jw→DT" : "2of4+jw",  term:r12.term || p.term || c.term };
        else if (r13.ok) accepted = { kind:"product",            mode: r13.dt ? "2of4+bm25f→DT" : "2of4+bm25f", term:r13.term || p.term || c.term };
        else if (r14.ok) accepted = { kind:"product",            mode: r14.dt ? "2of4+bLCS→DT" : "2of4+bLCS",  term:r14.term || p.term || c.term };
      }

      if (accepted){
        return {
          ok: true,
          ...accepted,
          votes,
          price: (bundle?.priceText||""),
          url:   (bundle?.url||""),
          // Telemetri bayrakları
          s5: !!r5.ok, s6: !!r6.ok, s7: !!r7.ok, s8: !!r8.ok,
          s9: !!r9.ok, s10: !!r10.ok, s11: !!r11.ok, s12: !!r12.ok, s13: !!r13.ok, s14: !!r14.ok
        };
      }

      // DT kuyruğu kararı: zayıf temaslar veya destekleyici sinyaller varsa
      const weakTouch = (
        (p.score >= CONF.SCORE.WEAK) || (c.score >= CONF.SCORE.WEAK) || (b.ok) ||
        r5.ok || r6.ok || r7.ok || r8.ok || r9.ok || r10.ok || r11.ok || r12.ok || r13.ok || r14.ok
      );
      const needsDT = (votes >= 1 && votes <= 2) || (votes === 0 && weakTouch);

      if (needsDT){
        return {
          ok:false, dt:true, votes,
          price:(bundle?.priceText||""), url:(bundle?.url||""),
          s5: !!r5.ok, s6: !!r6.ok, s7: !!r7.ok, s8: !!r8.ok,
          s9: !!r9.ok, s10: !!r10.ok, s11: !!r11.ok, s12: !!r12.ok, s13: !!r13.ok, s14: !!r14.ok
        };
      }

      return {
        ok:false, votes,
        price:(bundle?.priceText||""), url:(bundle?.url||""),
        s5: !!r5.ok, s6: !!r6.ok, s7: !!r7.ok, s8: !!r8.ok,
        s9: !!r9.ok, s10: !!r10.ok, s11: !!r11.ok, s12: !!r12.ok, s13: !!r13.ok, s14: !!r14.ok
      };

    }catch(err){
      if (window.BR_MATCH_DEBUG) console.error("[match.checkBundle] error:", err);
      return { ok:false, votes:0, err:String(err) };
    }
  }

  // 🔕 DEPRECATED: DOM’a dokunmaz. Yanlışlıkla bundle verilirse checkBundle’a yönlendirir.
  function checkCard(arg){
    if (arg && (arg.brandText || arg.productText || arg.wholeText)) {
      if (window.BR_MATCH_DEBUG) console.warn("[match] checkCard(bundle-like) kullanıldı; checkBundle’a yönlendirildi.");
      return checkBundle(arg);
    }
    if (window.BR_MATCH_DEBUG) console.warn("[match] checkCard DEPRECATED – lütfen scan.js -> checkBundle kullanın.");
    return false;
  }

  ns.match = {
    setTargets,
    checkBundle,
    checkCard,
    // test amaçlı dışa açılan yardımcılar:
    _normalize: normalize,
    _tokenize: tokenizeBase,
    _interCoverage: interCoverage,
    _interStrongCount: interStrongCount,
    _state: state,
    _conf: CONF
  };
})(window.BR = window.BR || {});
