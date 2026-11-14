// Marking for the tracing games.
// The letter's centre line is split into its strokes (segments): each line, curve, bar,
// tail and dot, with sharp corners splitting a stroke in two. A letter counts as done when
// her finger has passed near every stroke along at least half of it. Being off the line
// is fine; leaving a part out is not. The finger's path only counts for the stroke it is
// nearest to, so tracing one stroke can't tick off its neighbour, and the bits of a stroke
// right at a join or corner are not checked.
// Stroke order and direction are not checked.
const TRACE = (() => {
  const ON = 100;
  const DEF = {
    reach: 9,       // the finger's path this close (mask pixels) to a check point counts, if it is nearer this stroke than any other
    margin: 2,      // ...or no more than this much further from it than from its nearest stroke
    corner: 55,     // a bend sharper than this many degrees splits a stroke in two (the corner of an L)
    junction: 6,    // ignore this much of a segment next to where it joins another stroke
    spacing: 10,    // check points every this many pixels along a segment
    share: 0.5,     // share of a segment's check points that need ink nearby
    spur: 5,        // centre-line branches shorter than this are rendering noise
    stray: 0.4      // share of ink allowed well away from the letter (stops scribbles passing)
  };
  let CFG = Object.assign({}, DEF);
  function config(c) { CFG = Object.assign({}, DEF, c); }

  const binary = (px, M) => { const on = new Uint8Array(M * M); for (let i = 0; i < M * M; i++) on[i] = px[i * 4 + 3] > ON ? 1 : 0; return on; };
  const NB = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

  /* ----- the centre line ----- */
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
  function segments(px, M) {
    const sk = thin(binary(px, M), M);
    for (let round = 0; round < 2; round++) {
      for (const b of branches(sk, M)) {
        const d0 = nbrs(sk, M, b[0]).length, d1 = nbrs(sk, M, b[b.length - 1]).length;
        const spur = (d0 === 1 && d1 >= 3) || (d1 === 1 && d0 >= 3);
        if (spur && b.length < CFG.spur) b.forEach(i => { if (nbrs(sk, M, i).length <= 2) sk[i] = 0; });
      }
    }
    const junctions = [];
    for (let i = 0; i < M * M; i++) if (sk[i] && nbrs(sk, M, i).length >= 3) junctions.push(i);
    const xy = i => ({ x: i % M, y: (i / M) | 0 });
    const nearJunction = i => junctions.some(j => Math.hypot(j % M - i % M, ((j / M) | 0) - ((i / M) | 0)) < CFG.junction);
    // split a stroke where it bends sharply
    const W = 4;
    const ang = (a, b, c) => {
      const ux = a % M - b % M, uy = ((a / M) | 0) - ((b / M) | 0), vx = c % M - b % M, vy = ((c / M) | 0) - ((b / M) | 0);
      const d = Math.hypot(ux, uy) * Math.hypot(vx, vy);
      return d ? 180 - Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d))) * 180 / Math.PI : 0;
    };
    const split = b => {
      const turns = b.map((_, k) => (k >= W && k < b.length - W ? ang(b[k - W], b[k], b[k + W]) : 0));
      let best = -1;
      for (let k = 6; k < b.length - 6; k++) if (turns[k] > CFG.corner && (best < 0 || turns[k] > turns[best])) best = k;
      if (best < 0) return [b];
      corners.push(b[best]);
      return split(b.slice(0, best + 1)).concat(split(b.slice(best)));
    };
    const strokes = [], corners = [];
    for (const b of branches(sk, M)) {
      const joined = nbrs(sk, M, b[0]).length >= 3 && nbrs(sk, M, b[b.length - 1]).length >= 3;
      if (joined && b.length < CFG.spur) continue; // tiny link inside a junction
      split(b).forEach(p => strokes.push(p));
    }
    junctions.push(...corners); // the corner of an L is treated like a join
    const out = [];
    for (const b of strokes) {
      let core = b.filter(i => !nearJunction(i));
      if (!core.length) { // a short stub such as the bar of a t: its free end is what counts
        const free = [b[0], b[b.length - 1]].filter(i => nbrs(sk, M, i).length <= 1);
        core = free.length ? free : [b[b.length >> 1]];
      }
      const n = Math.max(1, Math.round(core.length / CFG.spacing));
      const pts = [];
      for (let k = 0; k < n; k++) pts.push(xy(core[Math.round((k + 0.5) * (core.length - 1) / n)]));
      out.push({ px: b, pts });
    }
    // a lone dot thins to a pixel or two with no branch
    for (let i = 0; i < M * M; i++) if (sk[i] && !nbrs(sk, M, i).length) out.push({ px: [i], pts: [xy(i)] });
    return out;
  }

  function analyse(px, M) {
    const segs = segments(px, M);
    // how far each spot on the pad is from each stroke, and from the nearest stroke
    const nearest = new Float32Array(M * M).fill(1e9);
    const dist = segs.map(sg => {
      const d2 = new Float32Array(M * M).fill(1e9);
      sg.px.forEach(i => {
        const sx = i % M, sy = (i / M) | 0;
        for (let y = Math.max(0, sy - 24); y < Math.min(M, sy + 25); y++) for (let x = Math.max(0, sx - 24); x < Math.min(M, sx + 25); x++) {
          const d = (x - sx) * (x - sx) + (y - sy) * (y - sy), j = y * M + x;
          if (d < d2[j]) d2[j] = d;
        }
      });
      const d = d2.map(Math.sqrt);
      d.forEach((v, j) => { if (v < nearest[j]) nearest[j] = v; });
      return d;
    });
    // owner[j] is the nearest stroke (used by tests); counts(j, n) is the rule the check uses
    const owner = new Int16Array(M * M).fill(-1);
    for (let j = 0; j < M * M; j++) dist.forEach((d, n) => { if (d[j] === nearest[j] && owner[j] < 0) owner[j] = n; });
    return { M, segments: segs.map(sg => sg.pts), owner, dist, nearest };
  }

  /* ----- judging ----- */
  function judge(shape, ink, tol) {
    const { M, segments: segs } = shape;
    const on = i => ink[i * 4 + 3] > ON;
    let inkN = 0, stray = 0;
    for (let i = 0; i < M * M; i++) if (on(i)) { inkN++; if (tol[i * 4 + 3] <= ON) stray++; }
    const R = Math.ceil(CFG.reach);
    const near = (p, n) => {
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > CFG.reach * CFG.reach) continue;
        const x = p.x + dx, y = p.y + dy, j = y * M + x;
        if (x >= 0 && y >= 0 && x < M && y < M && on(j) && shape.dist[n][j] <= shape.nearest[j] + CFG.margin) return true;
      }
      return false;
    };
    const missing = [], unreached = [];
    segs.forEach((pts, n) => {
      const miss = pts.filter(p => !near(p, n));
      if (pts.length - miss.length < Math.ceil(pts.length * CFG.share - 1e-9)) { missing.push(n); unreached.push(...miss); }
    });
    const strayOk = inkN > 0 && stray / inkN <= CFG.stray;
    const done = segs.length - missing.length;
    return { pass: strayOk && !missing.length, missing, unreached, progress: segs.length ? done / segs.length : 0, strayOk };
  }

  return { analyse, judge, config, DEF, skeleton: (px, M) => thin(binary(px, M), M) };
})();
