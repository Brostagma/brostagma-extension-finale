// src/core/engine/rules/r13.js
(function (ns) {
  ns.rules = ns.rules || {};

  function bm25Score(qTokens, dTokens, idfMap, avgdl, k1 = 1.5, b = 0.75) {
    // dTokens: Map token -> freq
    const dl = Array.from(dTokens.values()).reduce((a, b) => a + b, 0) || 1;
    let score = 0;
    for (const t of qTokens) {
      const f = dTokens.get(t) || 0;
      if (!f) continue;
      const idf = idfMap.get(t) || 0;
      const tf = (f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgdl)));
      score += idf * tf;
    }
    return score;
  }

  ns.rules.r13 = {
    id: "r13",
    name: "bm25f-lite",
    evaluate({ hay }) {
      try {
        const M = ns.match || {};
        const S = M._state || {};
        const idf = S.tokenStats?.idfNorm || new Map();

        // Belgeler: ürün başlığı (yüksek ağırlık) + tüm metin (düşük)
        const ptoks = Array.from(hay.productTokens || []);
        const wtoks = Array.from(hay.wholeTokens || []);
        if (!ptoks.length && !wtoks.length) return { ok: false };

        const dMap = new Map();
        for (const t of ptoks) dMap.set(t, (dMap.get(t) || 0) + 2); // başlığa 2x ağırlık
        for (const t of wtoks) dMap.set(t, (dMap.get(t) || 0) + 1);

        // Sorgu: en iyi ürün/kategori girdisinin tokenları (low-value hariç)
        let bestScore = 0, bestTerm = null, strongHit = 0;
        const avgdl = 50;

        for (const e of (S.compiled?.product || [])) {
          const q = Array.from(e.tokensAll || []);
          const s = bm25Score(q, dMap, idf, avgdl);
          const strong = Array.from(e.tokensStrong || []).filter(t => (hay.productTokensRaw||hay.wholeTokensRaw||new Set()).has(t)).length;
          if (s > bestScore) { bestScore = s; bestTerm = e.phrase || q[0]; strongHit = strong; }
        }
        for (const e of (S.compiled?.category || [])) {
          const q = Array.from(e.tokensAll || []);
          const s = bm25Score(q, dMap, idf, avgdl) * 0.9; // kategoriye azıcık daha düşük ağırlık
          const strong = Array.from(e.tokensStrong || []).filter(t => (hay.productTokensRaw||hay.wholeTokensRaw||new Set()).has(t)).length;
          if (s > bestScore) { bestScore = s; bestTerm = e.phrase || q[0]; strongHit = strong; }
        }

        // Eşikler: IDF ölçeğine bağlı ılımlı bir sınır + en az 1 strong
        if (bestScore >= 2.0 && strongHit >= 1) return { ok: true, kind: "product", mode: "bm25f≥2.0+strong", term: bestTerm };
        if (bestScore >= 1.2)                    return { ok: true, dt: true, kind: "product", mode: "bm25f∈[1.2,2.0)", term: bestTerm };
        return { ok: false };
      } catch (_) {
        return { ok: false };
      }
    }
  };
})(window.BR = window.BR || {});
