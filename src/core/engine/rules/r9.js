// rule/r9.js
// "Bulanık Sıralı Alt Dizi" (Fuzzy Ordered Subsequence)
// Product alanında hedef tokensAllArr içinden >=3 token aynı sırada bulunur.
// Eşleşme token'larının her biri için edit-distance <= 1 tolerans verilir.
// En az 1 strong şartı korunur.

(function (ns) {
  const ID = "r9-fuzzyOrderedSubseq";
  const TITLE = "Bulanık Sıralı Alt Dizi";

  function editDistLe1(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;

    // aynı boy: tek yerine koyma
    if (la === lb) {
      let diff = 0;
      for (let i = 0; i < la; i++) if (a[i] !== b[i] && ++diff > 1) return false;
      return diff <= 1;
    }

    // bir fark: tek ekleme/silme
    let i = 0, j = 0, edits = 0;
    const s = la < lb ? a : b;
    const t = la < lb ? b : a;
    while (i < s.length && j < t.length) {
      if (s[i] === t[j]) { i++; j++; }
      else {
        edits++;
        if (edits > 1) return false;
        j++; // uzun olanı ilerlet
      }
    }
    // kalan tek karakter olabilir
    return true;
  }

  function evaluate({ hay, state }) {
    const prodArr = [...hay.productTokensRaw];
    if (prodArr.length === 0) return { ok:false, id:ID, title:TITLE };

    for (const e of state.compiled.product) {
      const tgt = e.tokensAllArr.filter(t => !state.lowValue.product.has(t));
      if (tgt.length < 3) continue;

      let j = 0, matched = 0, strongHits = 0;
      for (const w of prodArr) {
        if (j < tgt.length && editDistLe1(w, tgt[j])) {
          matched++;
          if (e.tokensStrong.has(tgt[j])) strongHits++;
          j++;
          if (matched >= 3 && strongHits >= 1) {
            return { ok:true, kind:"product", mode:"fuzzyOrderedSubseq", term:e.phrase, id:ID, title:TITLE };
          }
        }
      }
    }
    return { ok:false, id:ID, title:TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r9 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
