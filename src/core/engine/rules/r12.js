// src/core/engine/rules/r12.js
(function (ns) {
  ns.rules = ns.rules || {};

  function jaroWinkler(a, b) {
    // Küçük, hızlı JW (0..1 arası benzerlik). Kaynak: standart formül.
    if (a === b) return 1;
    const la = a.length, lb = b.length;
    if (!la || !lb) return 0;
    const matchDist = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
    const am = new Array(la).fill(false), bm = new Array(lb).fill(false);
    let matches = 0;
    for (let i = 0; i < la; i++) {
      const start = Math.max(0, i - matchDist), end = Math.min(i + matchDist + 1, lb);
      for (let j = start; j < end; j++) if (!bm[j] && a[i] === b[j]) { am[i] = bm[j] = true; matches++; break; }
    }
    if (!matches) return 0;
    let t = 0, k = 0;
    for (let i = 0; i < la; i++) if (am[i]) { while (!bm[k]) k++; if (a[i] !== b[k++]) t++; }
    t /= 2;
    const m = matches;
    const jaro = (m / la + m / lb + (m - t) / m) / 3;
    // Winkler prefix boost
    let l = 0; while (l < 4 && a[l] === b[l]) l++;
    const p = 0.1;
    return jaro + l * p * (1 - jaro);
  }

  ns.rules.r12 = {
    id: "r12",
    name: "jaro-winkler-fallback",
    evaluate({ hay }) {
      try {
        const M = ns.match || {};
        const S = M._state || {};
        const norm = (s) => M._normalize ? M._normalize(s) : String(s || "").toLowerCase();

        const title = norm(hay?.productTextNorm || hay?.wholeTextNorm || "");
        if (!title) return { ok: false };

        let best = 0, bestTerm = null, hitsBrandToken = false;

        // Basit marka izi (destek şartı)
        for (const be of (S.compiled?.brand || [])) {
          if (be.phrase && title.includes(be.phrase)) { hitsBrandToken = true; break; }
          for (const t of be.tokensAll) if (title.includes(t)) { hitsBrandToken = true; break; }
          if (hitsBrandToken) break;
        }

        // Hedef ürün/kategori ifadeleriyle JW benzerlik
        const pools = [(S.compiled?.product || []), (S.compiled?.category || [])];
        for (const list of pools) {
          for (const e of list) {
            const cand = e.phrase || [...e.tokensAll].join(" ");
            const sim = jaroWinkler(title, cand);
            if (sim > best) { best = sim; bestTerm = cand; }
          }
        }

        if (best >= 0.92 && hitsBrandToken) return { ok: true, kind: "product", mode: "jw≥0.92+brand", term: bestTerm };
        if (best >= 0.86)                 return { ok: true, dt: true, kind: "product", mode: "jw∈[0.86,0.92)", term: bestTerm };

        return { ok: false };
      } catch (_) {
        return { ok: false };
      }
    }
  };
})(window.BR = window.BR || {});
