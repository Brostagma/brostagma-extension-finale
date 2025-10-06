// src/core/engine/rules/r11.js
(function (ns) {
  ns.rules = ns.rules || {};
  ns.rules.r11 = {
    id: "r11",
    name: "url-slug-booster",
    evaluate({ hay }) {
      try {
        const M = (ns.match || {});
        const S = M._state || {};
        const interCoverage = M._interCoverage;

        const url = hay?.url || hay?.wholeTextNorm || "";
        if (!url) return { ok: false };

        // /brand/product-name-...-p-123456
        const m = String(url).match(/\/([^\/]+)-p-\d+/i);
        const slug = m ? m[1] : "";
        if (!slug) return { ok: false };

        const slugNorm = M._normalize ? M._normalize(slug) : slug.toLowerCase();
        const slugTokensArr = M._tokenize ? M._tokenize(slugNorm) : slugNorm.split(/\s+/);
        const slugTokens = new Set(slugTokensArr);

        let bestFrac = 0, bestTerm = null, kind = "product";
        const pools = [
          { list: (S.compiled?.product || []), lv: (S.lowValue?.product || new Set()), k: "product" },
          { list: (S.compiled?.category || []), lv: (S.lowValue?.category || new Set()), k: "category" }
        ];

        for (const pool of pools) {
          for (const e of pool.list) {
            const cov = interCoverage(slugTokens, e.tokensAll, pool.lv);
            if (cov.frac > bestFrac) { bestFrac = cov.frac; bestTerm = [...e.tokensAll][0] || e.phrase; kind = pool.k; }
            if (bestFrac >= 0.95) break;
          }
        }

        if (bestFrac >= 0.80) return { ok: true, kind, mode: "urlSlug≥0.80", term: bestTerm };
        if (bestFrac >= 0.60) return { ok: true, dt: true, kind, mode: "urlSlug≥0.60", term: bestTerm };
        return { ok: false };
      } catch (_) {
        return { ok: false };
      }
    }
  };
})(window.BR = window.BR || {});
