// src/core/engine/rules/r14.js
(function (ns) {
  ns.rules = ns.rules || {};

  function isBoundaryMatch(hay, phrase) {
    // Kelime sınırları: \b yerine Unicode güvenlisi
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "u");
    return re.test(hay);
  }

  // Basit LCS uzunluğu (O(n*m)) yerine: kısa metinlerde yeterli
  function lcsLen(a, b) {
    const n = a.length, m = b.length;
    const dp = new Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      let prev = 0;
      for (let j = 1; j <= m; j++) {
        const tmp = dp[j];
        dp[j] = (a[i - 1] === b[j - 1]) ? prev + 1 : Math.max(dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[m];
  }

  ns.rules.r14 = {
    id: "r14",
    name: "boundary-lcs",
    evaluate({ hay }) {
      try {
        const M = ns.match || {};
        const S = M._state || {};
        const title = (hay?.productTextNorm || hay?.wholeTextNorm || "");
        if (!title) return { ok: false };

        let best = 0, bestTerm = null, boundaryHit = false;
        for (const e of (S.compiled?.product || [])) {
          const ph = e.phrase || Array.from(e.tokensAll||[]).join(" ");
          const L = lcsLen(title, ph);
          const norm = L / Math.max(8, Math.max(title.length, ph.length));
          const b = isBoundaryMatch(title, (Array.from(e.tokensAll||[])[0] || ""));
          if (norm > best) { best = norm; bestTerm = ph; boundaryHit = b; }
        }
        for (const e of (S.compiled?.category || [])) {
          const ph = e.phrase || Array.from(e.tokensAll||[]).join(" ");
          const L = lcsLen(title, ph);
          const norm = L / Math.max(8, Math.max(title.length, ph.length));
          const b = isBoundaryMatch(title, (Array.from(e.tokensAll||[])[0] || ""));
          if (norm > best) { best = norm; bestTerm = ph; boundaryHit = boundaryHit || b; }
        }

        if (best >= 0.55 && boundaryHit) return { ok: true, kind: "product", mode: "bLCS≥0.55+boundary", term: bestTerm };
        if (best >= 0.45)                return { ok: true, dt: true, kind: "product", mode: "bLCS∈[0.45,0.55)", term: bestTerm };
        return { ok: false };
      } catch (_) {
        return { ok: false };
      }
    }
  };
})(window.BR = window.BR || {});
