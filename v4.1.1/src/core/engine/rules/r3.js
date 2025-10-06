// rule/r3.js
// S3: Product ve Category ikisi de MID seviyesinde, en az birinde strong token varsa geçerli.
// "Çift Orta Sinerji"

(function (ns) {
  const ID = "r3-dualMidSynergy";
  const TITLE = "Çift Orta Sinerji";

  /**
   * @param {Object} deps
   * @param {Object} deps.p - scoreProduct(...) çıktısı
   * @param {Object} deps.c - scoreCategory(...) çıktısı
   * @param {Object} deps.CONF - match.js CONF
   * @returns {{ok:boolean, kind?:'product'|'category', mode?:string, term?:string, id:string, title:string}}
   */
  function evaluate({ p, c, CONF }) {
    const S = CONF.SCORE;
    if (
      p && c &&
      p.score >= S.MID && c.score >= S.MID &&
      (p.cStrong >= 1 || c.cStrong >= 1)
    ) {
      // hangisi daha yüksekse onu esas alıyoruz
      const kind = p.score >= c.score ? "product" : "category";
      const term = p.term || c.term;
      return { ok: true, kind, mode: "p+c-mid", term, id: ID, title: TITLE };
    }
    return { ok: false, id: ID, title: TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r3 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
