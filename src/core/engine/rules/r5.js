// rule/r5.js
// S5: Coverage Oranı — product/category alanında yüksek kapsama + min strong.
// "Kapsama Oranı"

(function (ns) {
  const ID = "r5-coverage";
  const TITLE = "Kapsama Oranı";

  /**
   * @param {Object} deps
   * @param {Object} deps.hay - normalize edilmiş bundle verisi
   * @param {Object} deps.b   - scoreBrand(...) çıktısı
   * @param {Object} deps.CONF - match.js CONF
   * @param {Function} deps.interCoverage - match.js içinden coverage fonksiyonu
   * @param {Function} deps.interStrongCount - match.js içinden strong token sayacı
   * @param {Object} deps.state - match.js state (compiled, lowValue vs)
   */
  function evaluate({ hay, b, CONF, interCoverage, interStrongCount, state }) {
    const needFrac = b && b.score >= CONF.SCORE.BRAND_TOKEN ? CONF.COV.FRACTION_BRAND_BOOST : CONF.COV.FRACTION;
    const needStrong = CONF.COV.MIN_STRONG;

    for (const e of state.compiled.product) {
      const { frac } = interCoverage(hay.productTokens, e.tokensAll, state.lowValue.product);
      if (e.tokensAll.size >= 3 && frac >= needFrac) {
        const sh = interStrongCount(hay.productTokensRaw, e);
        if (sh >= needStrong) {
          return { ok:true, kind:"product", mode:"coverage", term:e.phrase, id:ID, title:TITLE };
        }
      }
    }
    for (const e of state.compiled.category) {
      const { frac } = interCoverage(hay.wholeTokens, e.tokensAll, state.lowValue.category);
      if (e.tokensAll.size >= 3 && frac >= needFrac) {
        const sh = interStrongCount(hay.wholeTokensRaw, e);
        if (sh >= needStrong) {
          return { ok:true, kind:"category", mode:"coverage", term:e.phrase, id:ID, title:TITLE };
        }
      }
    }

    return { ok:false, id:ID, title:TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r5 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
