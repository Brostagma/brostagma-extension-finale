// rule/r4.js
// S4: Brand destek veriyor ve Product veya Category en az MID seviyesinde.
// "Marka Destekli"

(function (ns) {
  const ID = "r4-brandAssisted";
  const TITLE = "Marka Destekli";

  /**
   * @param {Object} deps
   * @param {Object} deps.p - scoreProduct(...) çıktısı
   * @param {Object} deps.c - scoreCategory(...) çıktısı
   * @param {Object} deps.b - scoreBrand(...) çıktısı
   * @param {Object} deps.CONF - match.js CONF
   * @returns {{ok:boolean, kind?:'product'|'category', mode?:string, term?:string, id:string, title:string}}
   */
  function evaluate({ p, c, b, CONF }) {
    const S = CONF.SCORE;
    if (
      b && b.score >= S.BRAND_TOKEN &&
      ((p && p.score >= S.MID) || (c && c.score >= S.MID))
    ) {
      const kind = p && p.score >= S.MID ? "product" : "category";
      const term = (p && p.term) || (c && c.term) || b.term;
      return { ok: true, kind, mode: "brand-assisted", term, id: ID, title: TITLE };
    }
    return { ok: false, id: ID, title: TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r4 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
