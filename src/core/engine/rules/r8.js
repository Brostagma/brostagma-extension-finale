// rule/r8.js
// S8: Product alanında hedef tokenların en az 3’ü aynı sırada (arada kelime olabilir), >=1 strong şartıyla
// "Sıralı Alt Dizi"

(function (ns) {
  const ID = "r8-orderedSubseq";
  const TITLE = "Sıralı Alt Dizi";

  /**
   * @param {Object} deps
   * @param {Object} deps.hay   - normalize edilmiş bundle (productTokensRaw vs.)
   * @param {Object} deps.state - match.js state (compiled, lowValue)
   * @returns {{ok:boolean, kind?:'product', mode?:string, term?:string, id:string, title:string}}
   */
  function evaluate({ hay, state }) {
    const prodArr = [...hay.productTokensRaw];
    if (prodArr.length === 0) return { ok:false, id:ID, title:TITLE };

    for (const e of state.compiled.product) {
      const tgt = e.tokensAllArr.filter(t => !state.lowValue.product.has(t));
      if (tgt.length < 3) continue;

      let j = 0, matched = 0, strongHits = 0;
      for (const w of prodArr) {
        if (j < tgt.length && w === tgt[j]) {
          matched++;
          if (e.tokensStrong.has(w)) strongHits++;
          j++;
          if (matched >= 3 && strongHits >= 1) {
            return { ok:true, kind:"product", mode:"orderedSubseq", term:e.phrase, id:ID, title:TITLE };
          }
        }
      }
    }

    return { ok:false, id:ID, title:TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r8 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
