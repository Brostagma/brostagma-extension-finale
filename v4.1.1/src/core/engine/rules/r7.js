// rule/r7.js
// S7: Product alanında kayan pencere içinde yüksek kapsama (>=0.70) + >=2 strong
// "Lokal Pencere Kapsaması"

(function (ns) {
  const ID = "r7-windowCoverage";
  const TITLE = "Lokal Pencere Kapsaması";

  /**
   * @param {Object} deps
   * @param {Object} deps.hay   - normalize edilmiş bundle (productTokensRaw vs.)
   * @param {Object} deps.CONF  - match.js CONF
   * @param {Object} deps.state - match.js state (compiled, lowValue)
   * @returns {{ok:boolean, kind?:'product', mode?:string, term?:string, id:string, title:string}}
   */
  function evaluate({ hay, CONF, state }) {
    const needFrac   = 0.70;  // lokal kapsama eşiği (pencere içi)
    const needStrong = 2;     // pencere içinde min strong

    const prodArr = [...hay.productTokensRaw];
    if (prodArr.length === 0) return { ok:false, id:ID, title:TITLE };

    for (const e of state.compiled.product) {
      // low-value olanları kapsam hesabından çıkar
      const tgt = e.tokensAllArr.filter(t => !state.lowValue.product.has(t));
      if (tgt.length < 3) continue;

      // pencere boyutu: hedef uzunluğu + tolerans
      const win = Math.min(prodArr.length, tgt.length + 2);
      if (win < 3) continue;

      for (let L = 0; L <= prodArr.length - win; L++) {
        const R = L + win - 1;
        const windowTokens = new Set(prodArr.slice(L, R + 1));

        let tot = 0, hit = 0, strongHits = 0;
        for (const t of e.tokensAll) {
          if (state.lowValue.product.has(t)) continue;
          tot++;
          if (windowTokens.has(t)) {
            hit++;
            if (e.tokensStrong.has(t)) strongHits++;
          }
        }

        const frac = tot > 0 ? hit / tot : 0;
        if (tot >= 3 && frac >= needFrac && strongHits >= needStrong) {
          return { ok:true, kind:"product", mode:"winCoverage", term:e.phrase, id:ID, title:TITLE };
        }
      }
    }

    return { ok:false, id:ID, title:TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r7 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
