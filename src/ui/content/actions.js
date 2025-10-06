// İşlemler kartı: "Hedef Liste / Ayıklananlar"
// GÜNCELLEME: Kodda değişiklik yok, sadece CSS ile görünüm yenilendi.
(function (ns) {
  const KEY_DATA    = "targets:data";
  const KEY_SUMMARY = "targets:summary";
  const KEY_READY   = "targets:ready";
  const KEY_EXTRACTED = "targets:extracted";

  let mounted = false;
  let isClearing = false;
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
      return (v && typeof v === "object") ? { brand: v.brand||[], product: v.product||[], category: v.category||[] } : emptyData();
    }catch{ return emptyData(); }
  }
  async function saveData(d){
    const clean={ brand:dedupNormalize(d?.brand), product:dedupNormalize(d?.product), category:dedupNormalize(d?.category) };
    await ns.storage.set(KEY_DATA, clean);
    const sum=computeSummary(clean);
    await ns.storage.set(KEY_SUMMARY, sum);
    document.dispatchEvent(new CustomEvent("br:targets:changed",{ detail:{ data:clean, summary:sum }}));
    return { clean, sum };
  }

  async function loadExtracted(){
    try{
      const v=await ns.storage.get(KEY_EXTRACTED,null);
       return (v && typeof v === "object") ? { brand: v.brand||[], product: v.product||[], category: v.category||[] } : emptyData();
    }catch{ return emptyData(); }
  }
  async function saveExtracted(d){
    const clean={ brand:dedupNormalize(d?.brand), product:dedupNormalize(d?.product), category:dedupNormalize(d?.category) };
    await ns.storage.set(KEY_EXTRACTED, clean);
    return clean;
  }

  async function clearData({silent=false}={}){
    if(isClearing) return;
    isClearing=true;
    try{
      await Promise.all([
        ns.storage.remove(KEY_DATA),
        ns.storage.remove(KEY_SUMMARY),
        ns.storage.remove(KEY_READY),
        ns.storage.remove(KEY_EXTRACTED)
      ]);
      setSummaryUI({ total:0, brand:0, product:0, category:0 });
      setExportEnabled(false);
      if(!silent){
        document.dispatchEvent(new CustomEvent("br:toast:show",{ detail:{ type:"warning", message:"Hedef liste temizlendi", duration:1600 }}));
      }
    }finally{ isClearing=false; }
  }

  // ---------- UI helpers ----------
  const fmt = ({ total=0, brand=0, product=0, category=0 }={}) =>
    `Toplam ${total} | Marka: ${brand}, Ürün: ${product}, Kategori: ${category}`;
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
      <div class="br-teditmodal__scrim" role="button" aria-label="Kapat"></div>
      <div class="br-teditmodal__panel" role="dialog" aria-modal="true" aria-label="Hedef Listeyi Düzenle">
        <div class="br-teditmodal__head">
          <h4>Hedef Listeyi Düzenle</h4>
          <button type="button" class="br-teditmodal__close" aria-label="Kapat">×</button>
        </div>
        <div class="br-teditmodal__body">
          <div class="br-tedit__grid">
            <div class="br-tedit__col">
              <label class="br-tedit__label" for="br-tedit-brand">Marka</label>
              <textarea id="br-tedit-brand" class="br-tedit__ta br-tedit__ta--brand" rows="10" spellcheck="false"></textarea>
            </div>
            <div class="br-tedit__col">
              <label class="br-tedit__label" for="br-tedit-product">Ürün</label>
              <textarea id="br-tedit-product" class="br-tedit__ta br-tedit__ta--product" rows="10" spellcheck="false"></textarea>
            </div>
            <div class="br-tedit__col">
              <label class="br-tedit__label" for="br-tedit-category">Kategori</label>
              <textarea id="br-tedit-category" class="br-tedit__ta br-tedit__ta--category" rows="10" spellcheck="false"></textarea>
            </div>
          </div>
          <div class="br-tedit__extracted">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <h5>Ayıklananlar (Önizleme)</h5>
              <small>İlk 50 satır gösterilir</small>
            </div>
            <div class="br-tedit__grid">
              <div class="br-tedit__col">
                <div class="br-tedit__list br-tedit__list--brand"></div>
              </div>
              <div class="br-tedit__col">
                <div class="br-tedit__list br-tedit__list--product"></div>
              </div>
              <div class="br-tedit__col">
                <div class="br-tedit__list br-tedit__list--category"></div>
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

    const q = (sel) => tModal.querySelector(sel);
    const taBrand=q(".br-tedit__ta--brand");
    const taProd=q(".br-tedit__ta--product");
    const taCat=q(".br-tedit__ta--category");
    taBrand.value=(current?.brand||[]).join("\n");
    taProd.value=(current?.product||[]).join("\n");
    taCat.value=(current?.category||[]).join("\n");

    const fillPreview = (sel, arr) => {
      const host=q(sel);
      const list=(arr||[]).slice(0,50);
      if(!list.length){ host.innerHTML=`<div style="opacity:.7;">(henüz ayıklanan veri yok)</div>`; return; }
      host.innerHTML = list.map(it => `<div>• ${it}</div>`).join('');
    };
    fillPreview(".br-tedit__list--brand", extracted.brand);
    fillPreview(".br-tedit__list--product", extracted.product);
    fillPreview(".br-tedit__list--category", extracted.category);

    const close=()=>{ tModal.classList.remove("is-in"); setTimeout(()=>{ tModal.remove(); tModal=null; }, 200); };
    q(".br-teditmodal__scrim").addEventListener("click", close);
    q(".br-teditmodal__close").addEventListener("click", close);
    q(".br-tedit__cancel").addEventListener("click", close);

    q(".br-tedit__clear").addEventListener("click", async ()=>{ await clearData({silent:true}); close(); });
    q(".br-tedit__save").addEventListener("click", async ()=>{
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

  const onTargetsSet = async (e)=>{
    const payload=e.detail?.data||e.detail; if(!payload) return;
    const { sum } = await saveData(payload);
    setSummaryUI(sum);
  };
  const onTargetsReady = () => setExportEnabled(true);
  const onTargetsExtracted = async (e)=>{
    const d = e.detail || {};
    const ex = { brand:[], product:[], category:[] };
    (d.rows || []).forEach(r => {
      if(r.brand) ex.brand.push(String(r.brand));
      if(r.product) ex.product.push(String(r.product));
      if(r.category) ex.category.push(String(r.category));
    });
    await saveExtracted(ex);
  };
  const onTargetsClear = () => clearData({silent:true});

  ns.actions = {
    mount(container){
      if(!container || mounted) return; mounted=true;

      const wrap=document.createElement("section"); wrap.className="br-card br-actions";
      const h=document.createElement("h3"); h.textContent="Hedef Liste & Ayıklananlar";
      const row=document.createElement("div"); row.className="br-actions__row";

      fileInput=document.createElement("input");
      fileInput.type="file"; fileInput.accept=".xlsx"; fileInput.style.display="none";
      fileInput.addEventListener("change", async (e)=>{
        const file = e.target.files?.[0]; if(!file) return;
        await clearData({silent:true});
        document.dispatchEvent(new CustomEvent("br:targets:upload",{ detail:{ file } }));
        e.target.value="";
      });

      const createBtn = (text, primary = true, onClick) => {
          const btn = document.createElement("button");
          btn.className = `br-btn ${!primary ? 'br-btn--ghost' : ''}`;
          btn.type = "button";
          btn.textContent = text;
          btn.addEventListener("click", onClick);
          return btn;
      };

      const btnUpload = createBtn("Hedef Liste Yükle", true, () => fileInput.click());
      const btnEdit = createBtn("Düzenle", false, async () => openTargetsEditor(await loadData()));
      
      const btnClear = document.createElement("button");
      btnClear.className = "br-btn br-btn--subtle";
      btnClear.type = "button";
      btnClear.textContent = "Listeyi Temizle";
      btnClear.addEventListener("click", () => clearData());

      btnDownload=createBtn("Ayıklananları İndir", true, ()=>{
        if(btnDownload.disabled){
          document.dispatchEvent(new CustomEvent("br:toast:show",{ detail:{ type: "info", message: "Ayıklama henüz hazır değil", duration:1500 }}));
          return;
        }
        document.dispatchEvent(new CustomEvent("br:targets:download"));
      });
      btnDownload.disabled=true;

      row.append(btnUpload, btnEdit, btnClear, btnDownload, fileInput);
      summaryEl=document.createElement("div");
      summaryEl.className="br-actions__summary";
      wrap.append(h,row,summaryEl);
      container.appendChild(wrap);

      (async ()=>{
        const [data, isReady] = await Promise.all([loadData(), ns.storage.get(KEY_READY, false)]);
        const sum=computeSummary(data);
        setSummaryUI(sum);
        if(hasData(data)){
          document.dispatchEvent(new CustomEvent("br:targets:ensure", { detail: { data } }));
          setExportEnabled(isReady);
        } else {
          setExportEnabled(false);
        }
      })();

      if(!bound){
        document.addEventListener("br:targets:set", onTargetsSet);
        document.addEventListener("br:targets:ready", onTargetsReady);
        document.addEventListener("br:targets:extracted", onTargetsExtracted);
        document.addEventListener("br:targets:clear", onTargetsClear);
        bound = true;
      }
    }
  };

  document.addEventListener("br:panel:created",()=>{ ns.actions.mount(ns.panel.getBody()); });
  if(ns.panel?.getBody?.()) ns.actions.mount(ns.panel.getBody());
  document.addEventListener("br:panel:destroyed", ()=>{
    mounted = false;
    summaryEl = btnDownload = fileInput = null;
  });

})(window.BR = window.BR || {});

