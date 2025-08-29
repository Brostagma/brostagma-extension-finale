// İşlemler kartı: "Hedef Liste / Ayıklananlar"
// Yenile sonrası rehidratasyon:
//  - Açılışta storage'tan hedef veri bulunursa core'a br:targets:ensure {data} gönderilir.
//  - core export'u yeniden hazırlar → br:targets:ready ile buton aktif hale gelir.
//  - Düzenle modalı, ayıklanan veriyi (targets:extracted) gösterir.

(function (ns) {
  const KEY_DATA    = "targets:data";
  const KEY_SUMMARY = "targets:summary";
  const KEY_READY   = "targets:ready";
  const KEY_EXTRACTED = "targets:extracted";

  let mounted = false;
  let isClearing = false;

  // 🚫 Global dinleyicilerin iki kez bağlanmasını önlemek için
  let bound = false;

  let summaryEl = null;
  let btnDownload = null;
  let fileInput = null;

  // ---------- Helpers ----------
  const emptyData = () => ({ brand: [], product: [], category: [] });
  const hasData = (d) => !!((d?.brand?.length||0)+(d?.product?.length||0)+(d?.category?.length||0));

  function dedupNormalize(arr){
    const seen=new Set(), out=[];
    for(const s of arr||[]){
      const t=(""+s).trim(); if(!t) continue;
      const k=t.toLowerCase(); if(seen.has(k)) continue;
      seen.add(k); out.push(t);
    }
    return out;
  }
  function splitLinesAndCommas(text){
    return String(text||"").split(/\r?\n|,/g).map(s=>s.trim()).filter(Boolean);
  }
  function computeSummary(d){
    const b=dedupNormalize(d?.brand), p=dedupNormalize(d?.product), c=dedupNormalize(d?.category);
    return { total:b.length+p.length+c.length, brand:b.length, product:p.length, category:c.length };
  }

  async function loadData(){
    try{
      const v=await ns.storage.get(KEY_DATA,null);
      if(v&&typeof v==="object"){
        return {
          brand:Array.isArray(v.brand)?v.brand:[],
          product:Array.isArray(v.product)?v.product:[],
          category:Array.isArray(v.category)?v.category:[]
        };
      }
      return emptyData();
    }catch{ return emptyData(); }
  }
  async function saveData(d){
    const clean={
      brand:dedupNormalize(d?.brand),
      product:dedupNormalize(d?.product),
      category:dedupNormalize(d?.category)
    };
    await ns.storage.set(KEY_DATA, clean);
    const sum=computeSummary(clean);
    await ns.storage.set(KEY_SUMMARY, sum);
    document.dispatchEvent(new CustomEvent("br:targets:changed",{ detail:{ data:clean, summary:sum }}));
    return { clean, sum };
  }

  async function loadExtracted(){
    try{
      const v=await ns.storage.get(KEY_EXTRACTED,null);
      if(v&&typeof v==="object"){
        return {
          brand:Array.isArray(v.brand)?v.brand:[],
          product:Array.isArray(v.product)?v.product:[],
          category:Array.isArray(v.category)?v.category:[]
        };
      }
      return emptyData();
    }catch{ return emptyData(); }
  }
  async function saveExtracted(d){
    const clean={
      brand:dedupNormalize(d?.brand),
      product:dedupNormalize(d?.product),
      category:dedupNormalize(d?.category)
    };
    await ns.storage.set(KEY_EXTRACTED, clean);
    return clean;
  }

  async function clearData({silent=false}={}){
    if(isClearing) return;
    isClearing=true;
    try{
      if(ns.storage?.remove){
        await ns.storage.remove(KEY_DATA);
        await ns.storage.remove(KEY_SUMMARY);
        await ns.storage.remove(KEY_READY);
        await ns.storage.remove(KEY_EXTRACTED);
      }else{
        await ns.storage.set(KEY_DATA, emptyData());
        await ns.storage.set(KEY_SUMMARY,{ total:0, brand:0, product:0, category:0 });
        await ns.storage.set(KEY_READY,false);
        await ns.storage.set(KEY_EXTRACTED, emptyData());
      }
      setSummaryUI({ total:0, brand:0, product:0, category:0 });
      setExportEnabled(false);
      if(!silent){
        document.dispatchEvent(new CustomEvent("br:toast:show",{ detail:{ type:"warning", message:"Hedef liste temizlendi", duration:1600 }}));
      }
    }finally{ isClearing=false; }
  }

  // ---------- UI helpers ----------
  const fmt = ({ total=0, brand=0, product=0, category=0 }={}) =>
    `Toplam ${total} — Marka ${brand} · Ürün ${product} · Kategori ${category}`;
  function setSummaryUI(sum){ if(summaryEl) summaryEl.textContent = fmt(sum||{}); }
  function setExportEnabled(on){ if(!btnDownload) return; btnDownload.disabled=!on; ns.storage.set(KEY_READY, !!on); }

  // ---------- Düzenleme Modalı ----------
  let tModal=null;
  async function openTargetsEditor(passedCurrent){
    if(tModal) return;

    const current = passedCurrent && hasData(passedCurrent) ? passedCurrent : await loadData();
    const extracted = await loadExtracted();

    tModal=document.createElement("div");
    tModal.className="br-teditmodal";
    tModal.innerHTML=`
      <div class="br-teditmodal__scrim"></div>
      <div class="br-teditmodal__panel" role="dialog" aria-modal="true" aria-label="Hedef Listeyi Düzenle">
        <div class="br-teditmodal__head">
          <h4>Hedef Listeyi Düzenle</h4>
          <button type="button" class="br-teditmodal__close" aria-label="Kapat">×</button>
        </div>
        <div class="br-teditmodal__body">
          <div class="br-tedit__grid">
            <div class="br-tedit__col">
              <label class="br-tedit__label">Marka</label>
              <textarea class="br-tedit__ta br-tedit__ta--brand" rows="10" spellcheck="false"></textarea>
            </div>
            <div class="br-tedit__col">
              <label class="br-tedit__label">Ürün</label>
              <textarea class="br-tedit__ta br-tedit__ta--product" rows="10" spellcheck="false"></textarea>
            </div>
            <div class="br-tedit__col">
              <label class="br-tedit__label">Kategori</label>
              <textarea class="br-tedit__ta br-tedit__ta--category" rows="10" spellcheck="false"></textarea>
            </div>
          </div>
          <div class="br-tedit__extracted" style="margin-top:10px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <h5 style="margin:0;font-size:12px;color:#e8eef8;">Ayıklananlar (Önizleme)</h5>
              <small style="opacity:.8;color:#cbd3df;">İlk 50 satır gösterilir</small>
            </div>
            <div class="br-tedit__grid" style="gap:8px;">
              <div class="br-tedit__col">
                <label class="br-tedit__label">Marka</label>
                <div class="br-tedit__list br-tedit__list--brand" style="font-size:11px;color:#dfe5ee;max-height:120px;overflow:auto;border:1px solid color-mix(in oklab, var(--br-border), #fff 10%);border-radius:8px;padding:8px;background:color-mix(in oklab, var(--br-bg) 95%, transparent);"></div>
              </div>
              <div class="br-tedit__col">
                <label class="br-tedit__label">Ürün</label>
                <div class="br-tedit__list br-tedit__list--product" style="font-size:11px;color:#dfe5ee;max-height:120px;overflow:auto;border:1px solid color-mix(in oklab, var(--br-border), #fff 10%);border-radius:8px;padding:8px;background:color-mix(in oklab, var(--br-bg) 95%, transparent);"></div>
              </div>
              <div class="br-tedit__col">
                <label class="br-tedit__label">Kategori</label>
                <div class="br-tedit__list br-tedit__list--category" style="font-size:11px;color:#dfe5ee;max-height:120px;overflow:auto;border:1px solid color-mix(in oklab, var(--br-border), #fff 10%);border-radius:8px;padding:8px;background:color-mix(in oklab, var(--br-bg) 95%, transparent);"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="br-teditmodal__foot">
          <button type="button" class="br-btn br-btn--subtle br-tedit__clear">Hepsini Sil</button>
          <div class="br-teditmodal__spacer"></div>
          <button type="button" class="br-btn br-btn--ghost br-tedit__cancel">Vazgeç</button>
          <button type="button" class="br-btn br-tedit__save">Kaydet</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(tModal);

    const taBrand=tModal.querySelector(".br-tedit__ta--brand");
    const taProd=tModal.querySelector(".br-tedit__ta--product");
    const taCat=tModal.querySelector(".br-tedit__ta--category");
    taBrand.value=(current?.brand||[]).join("\n");
    taProd.value=(current?.product||[]).join("\n");
    taCat.value=(current?.category||[]).join("\n");

    function fillPreview(sel, arr){
      const host=tModal.querySelector(sel); host.innerHTML="";
      const list=(arr||[]).slice(0,50);
      if(!list.length){ host.innerHTML=`<div style="opacity:.7;">(henüz ayıklanan veri yok)</div>`; return; }
      for(const it of list){ const div=document.createElement("div"); div.textContent="• "+it; host.appendChild(div); }
    }
    fillPreview(".br-tedit__list--brand", extracted.brand);
    fillPreview(".br-tedit__list--product", extracted.product);
    fillPreview(".br-tedit__list--category", extracted.category);

    const close=()=>{ tModal.classList.remove("is-in"); setTimeout(()=>{ tModal.remove(); tModal=null; },180); };
    tModal.querySelector(".br-teditmodal__scrim").addEventListener("click", close);
    tModal.querySelector(".br-teditmodal__close").addEventListener("click", close);
    tModal.querySelector(".br-tedit__cancel").addEventListener("click", close);

    tModal.querySelector(".br-tedit__clear").addEventListener("click", async ()=>{ await clearData({silent:true}); close(); });
    tModal.querySelector(".br-tedit__save").addEventListener("click", async ()=>{
      const next={
        brand:splitLinesAndCommas(taBrand.value),
        product:splitLinesAndCommas(taProd.value),
        category:splitLinesAndCommas(taCat.value),
      };
      const { sum } = await saveData(next);
      setSummaryUI(sum);
      setExportEnabled(hasData(next));
      document.dispatchEvent(new CustomEvent("br:toast:show",{ detail:{ type:"success", message:"Hedef liste kaydedildi", duration:1700 }}));
      close();
    });

    requestAnimationFrame(()=>tModal.classList.add("is-in"));
  }

  // ------- Global event handler'lar (tek sefer bağlanır) -------
  const onTargetsSet = async (e)=>{
    const payload=e.detail?.data||e.detail; if(!payload) return;
    const { sum } = await saveData(payload);
    setSummaryUI(sum);
    // Export hazır değil; ready gelince buton açılacak
  };
  const onTargetsReady = async ()=>{
    setExportEnabled(true);
  };
  const onTargetsExtracted = async (e)=>{
    const d=e.detail||{};
    let ex=emptyData();
    if(Array.isArray(d.rows)){
      for(const r of d.rows){
        if(r?.brand) ex.brand.push(String(r.brand));
        if(r?.product) ex.product.push(String(r.product));
        if(r?.category) ex.category.push(String(r.category));
      }
    }else{
      ex={ brand:d.brand||[], product:d.product||[], category:d.category||[] };
    }
    await saveExtracted(ex);
  };
  const onTargetsClear = async ()=>{
    await clearData({silent:true});
  };

  // ---------- Public API ----------
  ns.actions = {
    mount(container){
      if(!container || mounted) return; mounted=true;

      const wrap=document.createElement("section"); wrap.className="br-card br-actions";
      const h=document.createElement("h3"); h.textContent="Hedef Liste / Ayıklananlar";
      const row=document.createElement("div"); row.className="br-actions__row";

      // file input
      const fi=document.createElement("input");
      fi.type="file"; fi.accept=".xlsx"; fi.style.display="none";
      fi.addEventListener("change", async ()=>{
        const file=fi.files&&fi.files[0]; if(!file) return;
        await clearData({silent:true});
        document.dispatchEvent(new CustomEvent("br:targets:upload",{ detail:{ file } }));
        fi.value=""; // aynı dosyayı tekrar seçebilmek için
      });
      fileInput=fi;

      // buttons
      const btnUpload=document.createElement("button");
      btnUpload.className="br-btn"; btnUpload.type="button"; btnUpload.textContent="Hedef Liste Yükle";
      btnUpload.addEventListener("click",()=>fileInput.click());

      const btnEdit=document.createElement("button");
      btnEdit.className="br-btn br-btn--ghost"; btnEdit.type="button"; btnEdit.textContent="Düzenle";
      btnEdit.addEventListener("click", async ()=>{ const data=await loadData(); await openTargetsEditor(data); });

      const btnClear=document.createElement("button");
      btnClear.className="br-btn br-btn--subtle"; btnClear.type="button"; btnClear.textContent="Listeyi Temizle";
      btnClear.addEventListener("click",()=>clearData());

      btnDownload=document.createElement("button");
      btnDownload.className="br-btn"; btnDownload.type="button"; btnDownload.textContent="Ayıklananları İndir";
      btnDownload.disabled=true;
      btnDownload.addEventListener("click", async ()=>{
        if(btnDownload.disabled){
          const d=await loadData();
          document.dispatchEvent(new CustomEvent("br:toast:show",{
            detail:{ type: hasData(d) ? "info":"warning", message: hasData(d) ? "Ayıklama henüz hazır değil" : "Hedef liste bulunamadı", duration:1500 }
          }));
          return;
        }
        document.dispatchEvent(new CustomEvent("br:targets:download"));
      });

      row.append(btnUpload, btnEdit, btnClear, btnDownload, fileInput);

      summaryEl=document.createElement("div");
      summaryEl.className="br-actions__summary";
      summaryEl.textContent=fmt();

      wrap.append(h,row,summaryEl);
      container.appendChild(wrap);

      // ------- Rehydrate on startup -------
      (async ()=>{
        const [data, sumStored] = await Promise.all([
          ns.storage.get(KEY_DATA, null),
          ns.storage.get(KEY_SUMMARY, null),
        ]);

        if(data && hasData(data)){
          const sum=computeSummary(data);
          setSummaryUI(sum);
          // Yenile sonrası export'u yeniden oluşturması için core'a veriyle "ensure" gönder
          document.dispatchEvent(new CustomEvent("br:targets:ensure", { detail: { data } }));
          // hazır sinyalini bekleyeceğiz; o gelince butonu açacağız
          setExportEnabled(false);
        }else if(sumStored){
          setSummaryUI(sumStored);
          setExportEnabled(false);
        }else{
          setSummaryUI({ total:0, brand:0, product:0, category:0 });
          setExportEnabled(false);
        }
      })();

      // ------- Events from core (tek sefer bağla) -------
      if(!bound){
        document.addEventListener("br:targets:set", onTargetsSet);
        document.addEventListener("br:targets:ready", onTargetsReady);
        document.addEventListener("br:targets:extracted", onTargetsExtracted);
        document.addEventListener("br:targets:clear", onTargetsClear);
        bound = true;
      }
    }
  };

  // Panel lifecycle
  document.addEventListener("br:panel:created",()=>{ ns.actions.mount(ns.panel.getBody()); });
  if(ns.panel?.getBody?.()) ns.actions.mount(ns.panel.getBody());

  // ❗ Kritik düzeltme: Panel yok edilirken yeniden mount edilebilmesi için bayrağı sıfırla
  document.addEventListener("br:panel:destroyed", ()=>{
    mounted = false;
    summaryEl = btnDownload = fileInput = null;
  });

})(window.BR = window.BR || {});
