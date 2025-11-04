// rule/r2.js
// S2: Bir alan STRONG_PLUS (>=1 strong + >=2 toplam) iken diğeri en az MID ya da cStrong>=1
// match.js içindeki S2 kombinasyonuyla bire bir aynı mantık.

(function (ns) {
  const ID = "r2-strongPlusSynergy";
  const TITLE = "Güçlü+Kapsam Sinerjisi";

  /**
   * @param {Object} deps
   * @param {Object} deps.p - scoreProduct(...) çıktısı: {score,cAll,cStrong,mode,term}
   * @param {Object} deps.c - scoreCategory(...) çıktısı: {score,cAll,cStrong,mode,term}
   * @param {Object} deps.CONF - match.js CONF
   * @returns {{ok:boolean, kind?:'product'|'category', mode?:string, term?:string, id:string, title:string}}
   */
  function evaluate({ p, c, CONF }) {
    const S = CONF.SCORE;

    // product güçlü ise category en az MID ya da cStrong>=1
    if (p && c && p.score >= S.STRONG_PLUS && (c.cStrong >= 1 || c.score >= S.MID)) {
      return {
        ok: true,
        kind: "product",
        mode: "strong+all",
        term: p.term || c.term,
        id: ID,
        title: TITLE
      };
    }

    // category güçlü ise product en az MID ya da cStrong>=1
    if (p && c && c.score >= S.STRONG_PLUS && (p.cStrong >= 1 || p.score >= S.MID)) {
      return {
        ok: true,
        kind: "category",
        mode: "strong+all",
        term: c.term || p.term,
        id: ID,
        title: TITLE
      };
    }

    return { ok: false, id: ID, title: TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r2 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
