// rule/r10.js
// "Baş/Son Odaklı Lokal Kapsama" (Head/Tail Focus Window)
// Product alanının ilk 9 ve son 9 token'ında kapsama ölçer.
// Eşik: coverage >= 0.70 ve >=1 strong (tot>=3)

(function (ns) {
  const ID = "r10-headTailCoverage";
  const TITLE = "Baş/Son Odaklı Lokal Kapsama";

  function evaluate({ hay, state }) {
    const prod = [...hay.productTokensRaw];
    if (prod.length === 0) return { ok:false, id:ID, title:TITLE };

    const head = new Set(prod.slice(0, Math.min(9, prod.length)));
    const tail = new Set(prod.slice(Math.max(0, prod.length - 9)));

    function checkZone(zoneSet){
      for (const e of state.compiled.product) {
        const tgt = e.tokensAllArr.filter(t => !state.lowValue.product.has(t));
        if (tgt.length < 3) continue;

        let tot = 0, hit = 0, strongHits = 0;
        for (const t of e.tokensAll) {
          if (state.lowValue.product.has(t)) continue;
          tot++;
          if (zoneSet.has(t)) {
            hit++;
            if (e.tokensStrong.has(t)) strongHits++;
          }
        }
        const frac = tot > 0 ? hit / tot : 0;
        if (tot >= 3 && frac >= 0.70 && strongHits >= 1) {
          return { ok:true, kind:"product", mode:"headTailCoverage", term:e.phrase };
        }
      }
      return { ok:false };
    }

    const resH = checkZone(head);
    if (resH.ok) return { ...resH, id:ID, title:TITLE };
    const resT = checkZone(tail);
    if (resT.ok) return { ...resT, id:ID, title:TITLE };

    return { ok:false, id:ID, title:TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r10 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
