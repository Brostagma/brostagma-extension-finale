// src/core/campaignsMatch.js
// Seçili kampanyalara göre son eşleşme kararı.
// - UI seçimleri: BR.storage("campaigns:selected") / br:campaigns:changed
// - Karttaki rozet metinleri: bundle.campaigns (scan.js doldurur)
// - Sınıflandırma, UI'daki etiketlerle birebir eşleşir:
//   ["X Al Y Öde","2. Ürün %","2. Ürün TL","Çok Al Az Öde","Birlikte Al Kazan","Yetkili Satıcı","TL Kupon","Kupon Fırsatı"]

(function(ns){
  const STORAGE_KEY = "campaigns:selected";
  let selected = new Set(); // UI'da seçili olanlar

  // ---- normalize yardımcıları (TR uyumlu) ----
  function normTr(s){
    const map = { "İ":"i","I":"i","ı":"i","Ş":"s","ş":"s","Ğ":"g","ğ":"g","Ü":"u","ü":"u","Ö":"o","ö":"o","Ç":"c","ç":"c" };
    const x = String(s||"").replace(/[İIıŞşĞğÜüÖöÇç]/g, ch => map[ch]||ch).toLowerCase();
    return x.replace(/\s+/g," ").trim();
  }

  // ---- sınıflandırıcı: rozet metninden UI etiketine ----
  // Bir metin birden fazla tipe düşebileceği için dizi döndürüyoruz.
  function classifyOne(raw){
    const t = normTr(raw);
    const out = new Set();

    // X Al Y Öde (örn: "3 Al 2 Öde", "5 al 3 öde")
    if (/\b(\d+)\s*al\s*(\d+)\s*ode\b/.test(t)) out.add("X Al Y Öde");

    // Çok Al Az Öde (generic ifade; bazen X/Y yazmaz)
    if (/cok\s*al\s*az\s*ode/.test(t)) out.add("Çok Al Az Öde");

    // 2. Ürün TL (örn: "2. urun 1 tl", "2. Ürün 10 TL")
    if (/2\.\s*urun\s*\d+\s*tl/.test(t)) out.add("2. Ürün TL");

    // 2. Ürün % (örn: "2. urun %10", "2. urun %")
    if (/2\.\s*urun\s*%/.test(t)) out.add("2. Ürün %");

    // TL Kupon (örn: "10 TL Kupon", "200 TL Kupon", "tl kupon")
    if (/\b\d+\s*tl\s*kupon\b/.test(t) || /\btl\s*kupon\b/.test(t)) out.add("TL Kupon");

    // Kupon Fırsatı
    if (/kupon\s*firsati/.test(t)) out.add("Kupon Fırsatı");

    // Birlikte Al Kazan
    if (/birlikte\s*al\s*kazan/.test(t)) out.add("Birlikte Al Kazan");

    // Yetkili Satıcı
    if (/yetkili\s*satici/.test(t)) out.add("Yetkili Satıcı");

    return [...out];
  }

  function classifyAll(texts){
    const set = new Set();
    for (const s of (texts||[])){
      for (const lab of classifyOne(s)) set.add(lab);
    }
    return [...set];
  }

  // ---- seçim yönetimi ----
  async function loadSelected(){
    try{
      const v = await (ns.storage?.get?.(STORAGE_KEY, []) ?? Promise.resolve([]));
      const arr = Array.isArray(v) ? v : (typeof v === "string" ? JSON.parse(v||"[]") : []);
      selected = new Set(arr);
    }catch{ selected = new Set(); }
  }
  function setSelected(arr){
    selected = new Set(Array.isArray(arr) ? arr : []);
  }
  function getSelected(){ return [...selected]; }

  // ---- SON KARAR ----
  // Seçim boşsa -> herkes geçer.
  // Seçim varsa -> karttaki sınıflandırılmış tiplerle KESİŞİM boş değilse geçer.
  function accept(bundle){
    const want = getSelected();
    if (!want.length) return true; // filtre kapalı
    const found = classifyAll(bundle?.campaigns || []);
    if (!found.length) return false; // filtre var ama kartta kampanya yok
    const wantSet = new Set(want);
    for (const f of found){ if (wantSet.has(f)) return true; }
    return false;
  }

  // ---- dış API ----
  ns.campaignsMatch = { accept, classifyAll, classifyOne, getSelected, setSelected };

  // ---- ilk yükleme + canlı güncelleme ----
  loadSelected();
  document.addEventListener("br:campaigns:changed", async (e)=>{
    try{
      const curr = await (ns.storage?.get?.(STORAGE_KEY, []) ?? Promise.resolve([]));
      setSelected(curr);
    }catch{ /* sessiz */ }
  });

})(window.BR = window.BR || {});
