// rule/r1.js
// S1: Product veya Category alanında "phrase / soft-phrase" tam/yarı dizim eşleşmesi
// match.js içindeki S1 şartıyla aynı: p.score === PHRASE || c.score === PHRASE

(function (ns) {
  const ID = "r1-softPhrase";
  const TITLE = "Eşleşmeli Tarama (Soft Phrase)";

  /**
   * @param {Object} deps
   * @param {Object} deps.p - scoreProduct(...) çıktısı
   * @param {Object} deps.c - scoreCategory(...) çıktısı
   * @param {Object} deps.CONF - match.js CONF
   * @returns {{ok:boolean, kind?:'product'|'category', mode?:string, term?:string, id:string, title:string}}
   */
  function evaluate({ p, c, CONF }) {
    const S = CONF.SCORE;
    if (p && p.score === S.PHRASE) {
      return { ok: true, kind: "product", mode: "phrase", term: p.term, id: ID, title: TITLE };
    }
    if (c && c.score === S.PHRASE) {
      return { ok: true, kind: "category", mode: "phrase", term: c.term, id: ID, title: TITLE };
    }
    return { ok: false, id: ID, title: TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r1 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
