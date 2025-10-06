// src/core/target/parse.js
// XLSX dosyasını okuyup Marka / Kategori / Ürün sütunlarını akıllıca bulur,
// satırlardan bu üç alanı ayıklar ve benzersiz kümeleri döndürür.
//
// Global API: window.BR_XLSX.parseFile(file)
// -> Promise<{ rows, brandSet, productSet, categorySet }>

(function () {
  if (!window.BR_XLSX) window.BR_XLSX = {};

  // Türkçe & varyasyon destekli başlık adayları
  const FIELD_CANDIDATES = {
    brand: [
      'marka', 'markaadi', 'markaadı', 'brand', 'brandname'
    ],
    product: [
      'urun', 'ürün', 'urunadi', 'ürünadı', 'urunad', 'ürünad',
      'urunisim', 'ürünisim', 'product', 'productname', 'model', 'sku', 'mpn'
    ],
    category: [
      'kategori', 'kategoriler', 'kategoriadi', 'kategoriadı',
      'category', 'categoryname', 'subcategory', 'altkategori', 'altkategoriadi', 'altkategoriadı'
    ]
  };

  // Hücre başlıklarını karşılaştırmak için normalize
  function normalizeKey(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // diacritics
      .replace(/[^\w]+/g, '')          // non-words
      .trim();
  }

  // 2D array içinde başlık satırını bul (en az bir alanı eşleyen ilk satır)
  function findHeaderRow(rows2d) {
    for (let r = 0; r < rows2d.length; r++) {
      const row = rows2d[r] || [];
      const norm = row.map(normalizeKey);
      const anyHit =
        norm.some(v => FIELD_CANDIDATES.brand.includes(v)) ||
        norm.some(v => FIELD_CANDIDATES.product.includes(v)) ||
        norm.some(v => FIELD_CANDIDATES.category.includes(v));
      if (anyHit) return r;
    }
    return 0; // fallback: ilk satır
  }

  // Başlık satırındaki kolon indekslerini bul
  function findFieldIndices(headerRow) {
    const norm = headerRow.map(normalizeKey);
    const getIndex = (cands) => {
      for (const c of cands) {
        const i = norm.indexOf(c);
        if (i !== -1) return i;
      }
      return -1;
    };
    return {
      brandIdx: getIndex(FIELD_CANDIDATES.brand),
      productIdx: getIndex(FIELD_CANDIDATES.product),
      categoryIdx: getIndex(FIELD_CANDIDATES.category)
    };
  }

  async function fileToArrayBuffer(file) {
    if (file.arrayBuffer) return await file.arrayBuffer();
    return await new Response(file).arrayBuffer();
  }

  async function parseFile(file) {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX (SheetJS) bulunamadı. Lütfen vendor/xlsx.min.js yükleyin.');
    }

    const buf = await fileToArrayBuffer(file);
    const wb = XLSX.read(buf, { type: 'array' });

    // İlk sayfa
    const shName = wb.SheetNames[0];
    const ws = wb.Sheets[shName];

    // 2D olarak çek, başlık satırını güvenle bul
    const rows2d = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    if (!rows2d.length) {
      return { rows: [], brandSet: new Set(), productSet: new Set(), categorySet: new Set() };
    }

    const headerRowIdx = findHeaderRow(rows2d);
    const headerRow = rows2d[headerRowIdx] || [];
    const { brandIdx, productIdx, categoryIdx } = findFieldIndices(headerRow);

    // En az birinin bulunması gerekir; hiçbiri yoksa hata verelim
    if (brandIdx < 0 && productIdx < 0 && categoryIdx < 0) {
      throw new Error('Marka / Ürün / Kategori başlıkları bulunamadı.');
    }

    const brandSet = new Set();
    const productSet = new Set();
    const categorySet = new Set();

    // Veri satırları: headerRowIdx sonrası
    const dataRows = rows2d.slice(headerRowIdx + 1);

    // rows objesi: total sayım için basit dizi
    const rows = [];

    for (const row of dataRows) {
      if (!row || row.every(v => v === null || v === undefined || String(v).trim() === '')) continue;

      const brandVal = brandIdx >= 0 ? String(row[brandIdx] ?? '').trim() : '';
      const productVal = productIdx >= 0 ? String(row[productIdx] ?? '').trim() : '';
      const categoryVal = categoryIdx >= 0 ? String(row[categoryIdx] ?? '').trim() : '';

      if (brandVal) brandSet.add(brandVal);
      if (productVal) productSet.add(productVal);
      if (categoryVal) categorySet.add(categoryVal);

      rows.push({ brand: brandVal, product: productVal, category: categoryVal });
    }

    return { rows, brandSet, productSet, categorySet };
  }

  window.BR_XLSX.parseFile = parseFile;
})();
