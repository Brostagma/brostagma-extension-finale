// rule/r6.js
// S6: Yakınlık — product/category alanında iki strong token <= MAX_GAP mesafede.
// "Yakınlık"

(function (ns) {
  const ID = "r6-proximity";
  const TITLE = "Yakınlık";

  /**
   * @param {Object} deps
   * @param {Object} deps.hay - normalize edilmiş bundle verisi
   * @param {Object} deps.CONF - match.js CONF
   */
  function evaluate({ hay, CONF }) {
    const gap = CONF.PROX.MAX_GAP;

    const prodArr = [...hay.productTokensRaw];
    const prodStrong = prodArr.filter(t => t && t.length >= CONF.strongMinLen);
    const mapP = new Map(); prodArr.forEach((t,i)=>{ mapP.set(t, (mapP.get(t)||[]).concat(i)); });
    for (let i=0;i<prodStrong.length;i++){
      for (let j=i+1;j<prodStrong.length;j++){
        const a=prodStrong[i], b=prodStrong[j], A=mapP.get(a)||[], B=mapP.get(b)||[];
        for(const ia of A) for(const ib of B){
          if(Math.abs(ia-ib) <= gap){
            return { ok:true, kind:"product", mode:"proximity", term:`${a}~${b}`, id:ID, title:TITLE };
          }
        }
      }
    }

    const wholeArr = [...hay.wholeTokensRaw];
    const wholeStrong = wholeArr.filter(t => t && t.length >= CONF.strongMinLen);
    const mapW = new Map(); wholeArr.forEach((t,i)=>{ mapW.set(t, (mapW.get(t)||[]).concat(i)); });
    for (let i=0;i<wholeStrong.length;i++){
      for (let j=i+1;j<wholeStrong.length;j++){
        const a=wholeStrong[i], b=wholeStrong[j], A=mapW.get(a)||[], B=mapW.get(b)||[];
        for(const ia of A) for(const ib of B){
          if(Math.abs(ia-ib) <= gap){
            return { ok:true, kind:"category", mode:"proximity", term:`${a}~${b}`, id:ID, title:TITLE };
          }
        }
      }
    }

    return { ok:false, id:ID, title:TITLE };
  }

  ns.rules = ns.rules || {};
  ns.rules.r6 = { id: ID, title: TITLE, evaluate };
})(window.BR = window.BR || {});
