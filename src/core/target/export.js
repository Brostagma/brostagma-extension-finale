// export.js
// XLSX üretimi: 1) Eşleşmeler  2) Özet  3) Detaylar
// Dosya adı: "YYYY-MM-DD - HH.mm - tt{TT} - te{TE}.xlsx"
(function () {
  if (!window.BR_XLSX) window.BR_XLSX = {};

  function ensureXlsx() {
    if (!window.XLSX) throw new Error("XLSX kütüphanesi yok (SheetJS).");
  }

  // Güvenli dosya ismi
  function sanitizeFilename(s) {
    return String(s || "dosya").replace(/[\\/:*?"<>|]+/g, "_").trim() || "dosya";
  }

  // XLSX -> Blob URL + dosya adı
  function toBlobUrl(wb, { filename, filenameBase }) {
    const ab = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([ab], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const blobUrl = URL.createObjectURL(blob);
    const finalName = sanitizeFilename(filename || filenameBase || "eslesenler") + ".xlsx";
    return { blobUrl, filename: finalName };
  }

  function numberCell(v) {
    if (v == null || v === "") return { t: "s", v: "" };
    const n = Number(v);
    if (!isFinite(n)) return { t: "s", v: String(v) };
    return { t: "n", v: n, z: '#,##0.00' };
  }

  // rows: [{ brand, product, price, unitPrice, campaignsText, url, priceText? }]
  // meta : { tt, te, createdAt, selectedCampaigns[] }
  async function exportMatches({ rows = [], filename, filenameBase, meta = {} } = {}) {
    ensureXlsx();
    const XLSX = window.XLSX;

    // ---------- 1) EŞLEŞMELER ----------
    const head = ["Marka", "Ürün", "Fiyat", "Birim Fiyat", "Kampanya", "Ürüne Git"];
    const wsMain = XLSX.utils.aoa_to_sheet([head]);

    // veri satırları
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const R = i + 2; // header = 1
      const row = [
        { t: "s", v: (r.brand || "") },
        { t: "s", v: (r.product || "") },
        numberCell(r.price),
        numberCell(r.unitPrice),
        { t: "s", v: (r.campaignsText || "") },
        { t: "s", v: "Ürüne Git" },
      ];
      XLSX.utils.sheet_add_aoa(wsMain, [row], { origin: "A" + R });

      // hyperlink
      if (r.url) {
        const addr = "F" + R;
        wsMain[addr] = wsMain[addr] || { t: "s", v: "Ürüne Git" };
        wsMain[addr].l = { Target: r.url, Tooltip: r.product || r.url };
      }
    }

    // genişlikler + filtre
    wsMain["!cols"] = [
      { wch: 24 }, // Marka
      { wch: 60 }, // Ürün
      { wch: 12 }, // Fiyat
      { wch: 12 }, // Birim Fiyat
      { wch: 28 }, // Kampanya
      { wch: 16 }, // Link
    ];
    const lastRow = rows.length + 1;
    wsMain["!autofilter"] = { ref: `A1:F${lastRow}` };

    // ---------- 2) ÖZET ----------
    const tt = Number(meta.tt || 0);
    const te = Number(meta.te || rows.length || 0);
    const createdAt = meta.createdAt ? new Date(meta.createdAt) : new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${createdAt.getFullYear()}-${pad(createdAt.getMonth()+1)}-${pad(createdAt.getDate())}`;
    const timeStr = `${pad(createdAt.getHours())}.${pad(createdAt.getMinutes())}`;
    const selCampaigns = (meta.selectedCampaigns && meta.selectedCampaigns.length)
      ? meta.selectedCampaigns.join(", ")
      : "";

    const wsSummary = XLSX.utils.aoa_to_sheet([
      ["Oluşturma Tarihi", dateStr],
      ["Oluşturma Saati", timeStr],
      ["Toplam Taranan (tt)", tt],
      ["Toplam Eşleşen (te)", te],
      ["Eşleşme %", tt ? ((te / tt) * 100).toFixed(2) + "%" : "-"],
      ["Seçili Kampanya Filtresi", selCampaigns || "-"],
    ]);
    wsSummary["!cols"] = [{ wch: 28 }, { wch: 60 }];

    // ---------- 3) DETAYLAR ----------
    const headD = ["#", "Marka", "Ürün", "Fiyat", "Birim Fiyat", "Kampanyalar", "URL", "Fiyat (Metin)"];
    const wsDetail = XLSX.utils.aoa_to_sheet([headD]);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const R = i + 2;
      XLSX.utils.sheet_add_aoa(wsDetail, [[
        i + 1,
        r.brand || "",
        r.product || "",
        Number.isFinite(+r.price) ? +r.price : "",
        Number.isFinite(+r.unitPrice) ? +r.unitPrice : "",
        r.campaignsText || "",
        r.url || "",
        r.priceText || ""
      ]], { origin: "A" + R });
    }
    wsDetail["!cols"] = [
      { wch: 6 },  // #
      { wch: 24 }, // Marka
      { wch: 60 }, // Ürün
      { wch: 12 }, // Fiyat
      { wch: 12 }, // Birim Fiyat
      { wch: 28 }, // Kampanyalar
      { wch: 46 }, // URL
      { wch: 14 }, // Fiyat (Metin)
    ];
    wsDetail["!autofilter"] = { ref: `A1:H${rows.length + 1}` };

    // ---------- Kitap ----------
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMain, "Eşleşmeler");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Özet");
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detaylar");

    return toBlobUrl(wb, { filename, filenameBase });
  }

  // Diğer eski API korunuyor (dokunmadım)
  function makeTripleColumnSheet({ brands = [], products = [], categories = [] }) {
    const maxLen = Math.max(brands.length, products.length, categories.length);
    const rows = [];
    rows.push(["Marka", "Ürün", "Kategori"]);
    for (let i = 0; i < maxLen; i++) {
      rows.push([brands[i] ?? "", products[i] ?? "", categories[i] ?? ""]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 24 }, { wch: 60 }, { wch: 24 }];
    return ws;
  }
  async function exportLists({ brands = [], products = [], categories = [], filenameBase = "ayiklananlar" } = {}) {
    ensureXlsx();
    const wb = XLSX.utils.book_new();
    const ws = makeTripleColumnSheet({ brands, products, categories });
    XLSX.utils.book_append_sheet(wb, ws, "Ayıklananlar");
    return toBlobUrl(wb, { filenameBase });
  }

  window.BR_XLSX.exportMatches = exportMatches;
  window.BR_XLSX.exportLists   = exportLists;
})();
