// src/core/targets.js
// Akış: upload → parse → extracted/set/summary → export → ready
// Ek: ensure (rehydrate) → verilen data'dan export'u yeniden oluştur ve ready et.

(function () {
  let lastExport = { blobUrl: null, filename: null };

  function revokeLast(){
    if(lastExport.blobUrl){
      try{ URL.revokeObjectURL(lastExport.blobUrl); }catch{}
      lastExport = { blobUrl:null, filename:null };
    }
  }

  function toast(type, message, duration=1800){
    try{
      document.dispatchEvent(new CustomEvent("br:toast:show",{ detail:{ type, message, duration }}));
    }catch{}
  }

  async function buildExportFromData(data){
    if(!window.BR_XLSX || !window.BR_XLSX.exportLists){
      toast("error","Export modülü bulunamadı");
      return null;
    }
    const brands = Array.from(new Set((data.brand||[]).map(s=>(""+s).trim()).filter(Boolean))).sort();
    const products = Array.from(new Set((data.product||[]).map(s=>(""+s).trim()).filter(Boolean))).sort();
    const categories = Array.from(new Set((data.category||[]).map(s=>(""+s).trim()).filter(Boolean))).sort();

    revokeLast();
    const exp = await window.BR_XLSX.exportLists({
      brands, products, categories,
      filenameBase: "ayiklanmis-hedef-liste"
    }); // { blobUrl, filename }
    lastExport = exp;

    // UI senkron
    document.dispatchEvent(new CustomEvent("br:targets:set", { detail:{ data:{ brand:brands, product:products, category:categories } }}));
    document.dispatchEvent(new CustomEvent("br:targets:summary", { detail:{
      total: brands.length + products.length + categories.length,
      brand: brands.length, product: products.length, category: categories.length
    }}));
    document.dispatchEvent(new CustomEvent("br:targets:ready", { detail: exp }));
    return exp;
  }

  // Upload → parse → export hazırla
  async function handleUpload(file){
    try{
      if(!file){ toast("warning","Dosya seçilmedi"); return; }
      if(!window.BR_XLSX || !window.BR_XLSX.parseFile){ toast("error","Çekirdek XLSX modülü yüklenemedi"); return; }

      const parsed = await window.BR_XLSX.parseFile(file);
      const brands = Array.from(parsed.brandSet||[]).sort();
      const products = Array.from(parsed.productSet||[]).sort();
      const categories = Array.from(parsed.categorySet||[]).sort();

      // UI'ya aktarımlar
      document.dispatchEvent(new CustomEvent("br:targets:extracted", { detail:{
        rows: parsed.rows||[], brand:brands, product:products, category:categories
      }}));
      document.dispatchEvent(new CustomEvent("br:targets:set", { detail:{ data:{ brand:brands, product:products, category:categories } }}));
      document.dispatchEvent(new CustomEvent("br:targets:summary", { detail:{
        total: brands.length + products.length + categories.length,
        brand: brands.length, product: products.length, category: categories.length
      }}));

      // Export hazırlığı
      await buildExportFromData({ brand:brands, product:products, category:categories });
      toast("success","Hedef liste ayıklandı ve indirilmeye hazır",1600);
    }catch(err){
      console.error("[targets] handleUpload error:", err);
      toast("error","Dosya işlenirken hata oluştu");
    }
  }

  // Ensure (rehydrate) → verilen data'dan export'u yeniden oluştur
  async function handleEnsure(e){
    try{
      const data = e?.detail?.data || e?.detail;
      if(!data){ toast("warning","Rehidratasyon verisi yok"); return; }
      await buildExportFromData(data);
    }catch(err){
      console.error("[targets] ensure error:", err);
      toast("error","Export yeniden hazırlanamadı");
    }
  }

  function handleDownload(){
    try{
      if(!lastExport.blobUrl){ toast("info","Henüz indirilecek dosya hazır değil"); return; }
      const a=document.createElement("a");
      a.href=lastExport.blobUrl;
      a.download=lastExport.filename||"ayiklanmis-hedef-liste.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      document.dispatchEvent(new CustomEvent("br:targets:download:ok"));
    }catch(err){
      console.error("[targets] download error:", err);
      toast("error","İndirme sırasında hata");
    }
  }

  // Event bağlama
  document.addEventListener("br:targets:upload", (e)=>{ handleUpload(e.detail?.file); });
  document.addEventListener("br:targets:download", handleDownload);
  document.addEventListener("br:targets:ensure", handleEnsure);
})();
