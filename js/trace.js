// Marking for the tracing games.
// A letter counts as done only when all of its key parts have been traced:
//  1. Regions: every separate piece (the dot on an i), cut into a grid, has to be mostly covered.
//  2. Key points: the letter's centre line is found, and each stroke end plus a point every
//     so often along each stroke has to be touched. This catches short parts such as the
//     bar of a t or the tail of a Q, which a coverage percentage can't.
// Stroke order and direction are not checked.
const TRACE = (() => {
  const ON = 100;
  const DEF = {
    cell: 12,       // grid size in mask pixels (the mask is 96 x 96)
    minPart: 20,    // grid pieces smaller than this are corner slivers, not key parts
    cover: 0.5,     // share of each region that must be covered
    spacing: 14,    // a key point every this many pixels along each stroke
    reach: 1.5,     // a key point counts if ink is within this distance of it
    spur: 5,        // centre-line branches shorter than this are rendering noise
    total: 0.7,     // share of the whole letter that must be covered
    stray: 0.35     // share of ink allowed well away from the letter
  };
  let CFG = Object.assign({}, DEF);
  function config(c) { CFG = Object.assign({}, DEF, c); }

  const binary = (px, M) => { const on = new Uint8Array(M * M); for (let i = 0; i < M * M; i++) on[i] = px[i * 4 + 3] > ON ? 1 : 0; return on; };
  const NB = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

  /* ----- 1. regions ----- */
  function pieces(on, M) {
    const seen = new Uint8Array(M * M), out = [];
    for (let s = 0; s < M * M; s++) {
      if (!on[s] || seen[s]) continue;
      const piece = [], stack = [s];
      seen[s] = 1;
      while (stack.length) {
        const i = stack.pop(); piece.push(i);
        const x = i % M, y = (i / M) | 0;
        for (const [dx, dy] of NB) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= M || ny >= M) continue;
          const j = ny * M + nx;
          if (on[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
      }
      if (piece.length >= 6) out.push(piece);
    }
    return out;
  }
  function boxOf(list, M) {
    let x0 = M, y0 = M, x1 = 0, y1 = 0;
    for (const i of list) { const x = i % M, y = (i / M) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return [x0, y0, x1 + 1, y1 + 1];
  }
  function regions(px, M) {
    const out = [];
    for (const piece of pieces(binary(px, M), M)) {
      const cells = new Map();
      for (const i of piece) {
        const k = ((((i / M) | 0) / CFG.cell) | 0) * 1000 + (((i % M) / CFG.cell) | 0);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(i);
      }
      const big = [...cells.values()].filter(p => p.length >= CFG.minPart);
      (big.length ? big : [piece]).forEach(p => out.push({ px: p, box: boxOf(p, M) }));
    }
    return out;
  }

  /* ----- 2. key points on the centre line ----- */
  function thin(on, M) { // Zhang-Suen thinning
    const s = on.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= M || y >= M ? 0 : s[y * M + x]);
    let changed = true;
    while (changed) {
      changed = false;
      for (let pass = 0; pass < 2; pass++) {
        const del = [];
        for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
          if (!s[y * M + x]) continue;
          const p = NB.map(([dx, dy]) => at(x + dx, y + dy)); // p[1] N, p[3] E, p[5] S, p[7] W
          const b = p.reduce((a, v) => a + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++;
          if (a !== 1) continue;
          if (pass === 0 ? (p[1] && p[3] && p[5]) || (p[3] && p[5] && p[7]) : (p[1] && p[3] && p[7]) || (p[1] && p[5] && p[7])) continue;
          del.push(y * M + x);
        }
        if (del.length) { changed = true; del.forEach(i => { s[i] = 0; }); }
      }
    }
    return s;
  }
  function nbrs(sk, M, i) {
    const x = i % M, y = (i / M) | 0, out = [];
    for (const [dx, dy] of NB) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < M && ny < M && sk[ny * M + nx]) out.push(ny * M + nx); }
    return out;
  }
  // Walk the centre line into branches: runs of pixels between ends and junctions.
  function branches(sk, M) {
    const node = i => nbrs(sk, M, i).length !== 2;
    const used = new Set(), out = [];
    const key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    for (let i = 0; i < M * M; i++) {
      if (!sk[i] || !node(i)) continue;
      for (const n of nbrs(sk, M, i)) {
        if (used.has(key(i, n))) continue;
        const path = [i];
        let prev = i, cur = n;
        used.add(key(i, n));
        for (;;) {
          path.push(cur);
          if (node(cur)) break;
          const nx = nbrs(sk, M, cur).filter(j => j !== prev && !used.has(key(cur, j)));
          if (!nx.length) break;
          used.add(key(cur, nx[0]));
          prev = cur; cur = nx[0];
        }
        out.push(path);
      }
    }
    // closed loops with no ends or junctions (an O): walk them too
    const onBranch = new Set(out.flat());
    for (let i = 0; i < M * M; i++) {
      if (!sk[i] || onBranch.has(i)) continue;
      const path = [i];
      onBranch.add(i);
      let cur = i;
      for (;;) {
        const nx = nbrs(sk, M, cur).filter(j => !onBranch.has(j));
        if (!nx.length) break;
        cur = nx[0]; path.push(cur); onBranch.add(cur);
      }
      if (path.length > 3) out.push(path);
    }
    return out;
  }
  function keyPoints(px, M) {
    const sk = thin(binary(px, M), M);
    // remove short spurs (thinning noise at square stroke ends), twice for knock-on spurs
    for (let round = 0; round < 2; round++) {
      for (const b of branches(sk, M)) {
        const d0 = nbrs(sk, M, b[0]).length, d1 = nbrs(sk, M, b[b.length - 1]).length;
        const spur = (d0 === 1 && d1 >= 3) || (d1 === 1 && d0 >= 3);
        if (spur && b.length < CFG.spur) b.forEach(i => { if (nbrs(sk, M, i).length <= 2) sk[i] = 0; });
      }
    }
    const pts = [];
    const add = i => { if (!pts.some(j => Math.hypot(j % M - i % M, ((j / M) | 0) - ((i / M) | 0)) < CFG.spacing * 0.6)) pts.push(i); };
    for (const b of branches(sk, M)) {
      [b[0], b[b.length - 1]].filter(i => nbrs(sk, M, i).length <= 1).forEach(add);
      const n = Math.max(1, Math.round(b.length / CFG.spacing));
      for (let k = 1; k <= n; k++) add(b[Math.round((k - 0.5) * (b.length - 1) / n)]);
    }
    // a lone dot thins to a pixel or two with no branch
    for (let i = 0; i < M * M; i++) if (sk[i] && !nbrs(sk, M, i).length) add(i);
    return pts.map(i => ({ x: i % M, y: (i / M) | 0 }));
  }

  function analyse(px, M) {
    return { M, regions: regions(px, M), points: keyPoints(px, M), count: binary(px, M).reduce((a, v) => a + v, 0) };
  }

  /* ----- judging ----- */
  function judge(shape, ink, tol) {
    const { M, regions: regs, points } = shape;
    const on = i => ink[i * 4 + 3] > ON;
    let inkN = 0, stray = 0;
    for (let i = 0; i < M * M; i++) if (on(i)) { inkN++; if (tol[i * 4 + 3] <= ON) stray++; }
    let hit = 0;
    const missing = [];
    regs.forEach((r, n) => {
      let h = 0;
      for (const i of r.px) if (on(i)) h++;
      hit += h;
      if (h / r.px.length < CFG.cover) missing.push(n);
    });
    const R = Math.ceil(CFG.reach);
    const missingPts = [];
    points.forEach((p, n) => {
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > CFG.reach * CFG.reach) continue;
        const x = p.x + dx, y = p.y + dy;
        if (x >= 0 && y >= 0 && x < M && y < M && on(y * M + x)) return;
      }
      missingPts.push(n);
    });
    const total = shape.count ? hit / shape.count : 0;
    const strayOk = inkN > 0 && stray / inkN <= CFG.stray;
    return { pass: strayOk && total >= CFG.total && !missing.length && !missingPts.length, missing, missingPts, total, strayOk };
  }

  return { analyse, judge, config, DEF };
})();
