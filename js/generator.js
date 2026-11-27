/* 小五面積温習 · 出題 */
(function (global) {
  const P5Area = global.P5Area = global.P5Area || {};

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFrom(seedOrFn) {
    if (typeof seedOrFn === 'function') return seedOrFn;
    if (typeof seedOrFn === 'number') return mulberry32(seedOrFn);
    return Math.random;
  }

  function randInt(rnd, a, b) {
    return a + Math.floor(rnd() * (b - a + 1));
  }

  function pick(rnd, arr) {
    return arr[Math.floor(rnd() * arr.length)];
  }

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function shuffleFormulas(rnd) {
    return shuffle(P5Area.FORMULA_LABELS, rnd);
  }

  function uniquePermuteKey(order) {
    return order.join('|');
  }

  function rotatePts(pts, angleDeg, origin) {
    const rad = (angleDeg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const o = origin || centroid(pts);
    return pts.map(function (p) {
      const x = p[0] - o[0];
      const y = p[1] - o[1];
      return [o[0] + x * c - y * s, o[1] + x * s + y * c];
    });
  }

  function rotatePt(p, angleDeg, origin) {
    return rotatePts([p], angleDeg, origin)[0];
  }

  function centroid(pts) {
    let x = 0, y = 0;
    pts.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / pts.length, y / pts.length];
  }

  function mid(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function len(v) { return Math.hypot(v[0], v[1]); }
  function norm(v) {
    const L = len(v) || 1;
    return [v[0] / L, v[1] / L];
  }
  function perp(v) { return [-v[1], v[0]]; }
  function dist(a, b) { return len(sub(a, b)); }

  function outwardFromEdge(a, b, insidePoint) {
    let n = perp(sub(b, a));
    n = norm(n);
    const m = mid(a, b);
    const toInside = sub(insidePoint, m);
    if (dot(n, toInside) > 0) n = mul(n, -1);
    return n;
  }

  function polyCentroid(verts) {
    return centroid(verts);
  }

  function makeDim(a, b, value, role, isDistractor, verts) {
    const inside = polyCentroid(verts);
    const n = outwardFromEdge(a, b, inside);
    return {
      a: [a[0], a[1]],
      b: [b[0], b[1]],
      value: value,
      role: role,
      isDistractor: !!isDistractor,
      outward: n
    };
  }

  /* Right-angle mark at foot F, along directions u (along base) and v (along height, toward apex). */
  function rightAngleAt(foot, alongBase, towardApex) {
    return {
      corner: [foot[0], foot[1]],
      v1: norm(alongBase),
      v2: norm(towardApex)
    };
  }

  function signatureOf(shape, measurements) {
    const keys = Object.keys(measurements).sort();
    const parts = keys.map(function (k) { return k + '=' + measurements[k]; });
    return shape + ':' + parts.join(',');
  }

  function unusedInt(rnd, forbidden, min, max) {
    min = min == null ? 2 : min;
    max = max == null ? 28 : max;
    for (let t = 0; t < 80; t++) {
      const n = randInt(rnd, min, max);
      if (forbidden.indexOf(n) === -1) return n;
    }
    for (let n = min; n <= max + 10; n++) {
      if (forbidden.indexOf(n) === -1) return n;
    }
    return max + 3;
  }

  /* Point T on segment PQ with |V-T| = k, if possible. */
  function pointOnSegAtDist(V, P, Q, k) {
    const pq = sub(Q, P);
    const L = len(pq);
    if (L < 1e-9) return null;
    const u = norm(pq);
    const w = sub(V, P);
    const midProj = dot(w, u);
    const distLine = Math.abs(dot(w, perp(u)));
    const rad2 = k * k - distLine * distLine;
    if (rad2 < -1e-8) return null;
    const half = Math.sqrt(Math.max(0, rad2));
    const cands = [midProj - half, midProj + half];
    for (let i = 0; i < cands.length; i++) {
      const t = cands[i];
      if (t >= -0.05 && t <= L + 0.05) {
        const clamped = Math.max(0, Math.min(L, t));
        /* Avoid endpoints and the altitude foot (projection). */
        if (clamped < 0.15 * L || clamped > 0.85 * L) {
          if (Math.abs(clamped - midProj) < 0.08 * L) continue;
        }
        if (Math.abs(clamped - midProj) < 0.06 * L) continue;
        return add(P, mul(u, clamped));
      }
    }
    return null;
  }

  function integerAuxLine(V, P, Q, forbidden, rnd) {
    const pq = sub(Q, P);
    const L = len(pq);
    if (L < 1e-6) return null;
    const u = norm(pq);
    const w = sub(V, P);
    const proj = Math.max(0, Math.min(L, dot(w, u)));
    const foot = add(P, mul(u, proj));
    const dMin = dist(V, foot);
    const dMax = Math.max(dist(V, P), dist(V, Q));
    const ks = [];
    for (let k = Math.max(2, Math.ceil(dMin + 0.15)); k <= Math.floor(dMax - 0.15); k++) {
      if (forbidden.indexOf(k) === -1) ks.push(k);
    }
    shuffle(ks, rnd);
    for (let i = 0; i < ks.length; i++) {
      const T = pointOnSegAtDist(V, P, Q, ks[i]);
      if (T) return { a: V, b: T, value: ks[i], type: 'aux' };
    }
    return null;
  }

  function shuffledTypes(rnd) {
    const arr = [];
    const mix = P5Area.MIX;
    Object.keys(mix).forEach(function (k) {
      for (let i = 0; i < mix[k]; i++) arr.push(k);
    });
    for (let t = 0; t < 400; t++) {
      const a = shuffle(arr, rnd);
      let ok = true;
      for (let i = 0; i < a.length - 2; i++) {
        if (a[i] === a[i + 1] && a[i] === a[i + 2]) { ok = false; break; }
      }
      if (ok) return a;
    }
    return shuffle(arr, rnd);
  }

  /* ---------- shapes ---------- */

  function makeSquare(rnd, morph) {
    const side = randInt(rnd, 2, 20);
    const A = [0, 0];
    const B = [side, 0];
    const C = [side, side];
    const D = [0, side];
    let verts = [A, B, C, D];
    let angle = 0;
    if (morph === 'rot45') angle = 45;
    else if (morph === 'slight') angle = pick(rnd, [14, 16, 18, 20, 22]);
    if (angle) verts = rotatePts(verts, angle);
    const a = verts[0], b = verts[1], c = verts[2], d = verts[3];
    /* Base = first side, height = adjacent side (d-a). */
    const geo = {
      vertices: verts,
      bases: [{ a: a, b: b, role: '底' }],
      heightSeg: { a: d, b: a, exterior: false },
      rightAngle: rightAngleAt(a, sub(b, a), sub(d, a)),
      dimensions: [],
      extras: []
    };
    if (morph === 'rot45') {
      geo.dimensions = [
        makeDim(a, b, side, '邊長', false, verts),
        makeDim(b, c, side, '邊長', false, verts),
        makeDim(c, d, side, '邊長', false, verts),
        makeDim(d, a, side, '邊長', false, verts)
      ];
    } else {
      geo.dimensions = [
        makeDim(a, b, side, '邊長', false, verts),
        makeDim(d, a, side, '邊長', false, verts)
      ];
    }
    return {
      shape: 'square',
      morph: morph,
      measurements: { side: side },
      area: side * side,
      geometry: geo
    };
  }

  function makeRectangle(rnd, morph) {
    let L, W;
    do {
      L = randInt(rnd, 3, 20);
      W = randInt(rnd, 2, 20);
    } while (L === W);
    if (L < W) { const t = L; L = W; W = t; }

    let verts;
    /* landscape: 長 on bottom; portrait: 闊 on bottom */
    if (morph === 'portrait') {
      verts = [[0, 0], [W, 0], [W, L], [0, L]];
    } else {
      verts = [[0, 0], [L, 0], [L, W], [0, W]];
    }
    if (morph === 'slight') {
      verts = rotatePts(verts, pick(rnd, [12, 15, 18, -15, -12]));
    }
    const a = verts[0], b = verts[1], c = verts[2], d = verts[3];
    /* 長 is the longer pair of sides, 闊 the shorter. */
    const e1 = dist(a, b);
    const e2 = dist(a, d);
    let lengthEdge, widthEdge;
    if (Math.abs(e1 - L) < Math.abs(e2 - L)) {
      lengthEdge = { a: a, b: b };
      widthEdge = { a: a, b: d };
    } else {
      lengthEdge = { a: a, b: d };
      widthEdge = { a: a, b: b };
    }
    const geo = {
      vertices: verts,
      bases: [{ a: lengthEdge.a, b: lengthEdge.b, role: '長' }],
      heightSeg: { a: widthEdge.b, b: widthEdge.a, exterior: false },
      rightAngle: rightAngleAt(a, sub(b, a), sub(d, a)),
      dimensions: [
        makeDim(lengthEdge.a, lengthEdge.b, L, '長', false, verts),
        makeDim(widthEdge.a, widthEdge.b, W, '闊', false, verts)
      ],
      extras: []
    };
    return {
      shape: 'rectangle',
      morph: morph,
      measurements: { length: L, width: W },
      area: L * W,
      geometry: geo
    };
  }

  function makeParallelogram(rnd, morph) {
    const leanL = morph.indexOf('leanL') === 0;
    const baseSide = morph.indexOf('baseSide') !== -1;
    let base, height, slant;
    let tries = 0;
    do {
      base = randInt(rnd, 4, 20);
      height = randInt(rnd, 3, 18);
      slant = randInt(rnd, height + 2, 20);
      tries++;
    } while (tries < 60 && (base === height || slant * slant - height * height < Math.pow(Math.max(2, height * 0.3), 2)));
    if (base === height) {
      height = height === 18 ? 17 : height + 1;
    }
    const off = Math.sqrt(Math.max(1, slant * slant - height * height)) * (leanL ? -1 : 1);

    let verts, heightSeg, foot, bases, dims;
    if (!baseSide) {
      /* Base at bottom: (0,0)-(base,0)-(base+off,h)-(off,h) */
      const A = [0, 0], B = [base, 0], C = [base + off, height], D = [off, height];
      verts = [A, B, C, D];
      foot = [off, 0];
      /* If foot is slightly outside, that's ok; keep height perpendicular. */
      heightSeg = { a: [off, height], b: foot, exterior: off < -0.05 || off > base + 0.05 };
      if (heightSeg.exterior) {
        heightSeg.extendBase = off < 0 ? [A, foot] : [B, foot];
      }
      bases = [{ a: A, b: B, role: '底' }];
      dims = [
        makeDim(A, B, base, '底', false, verts),
        makeDim([off, height], foot, height, '高', false, verts)
      ];
      const raBaseDir = off < 0 ? sub(A, B) : sub(B, A);
      const ra = rightAngleAt(foot, [base, 0], [0, height]);
      return finishPara(verts, bases, heightSeg, ra, dims, base, height, slant, morph, [A, B, C, D], off);
    }

    /* Base on the side (vertical left), height horizontal. */
    const A = [0, 0], D = [0, base], B = [height, off], C = [height, off + base];
    verts = [A, B, C, D];
    foot = [0, off];
    heightSeg = { a: [height, off], b: foot, exterior: off < -0.05 || off > base + 0.05 };
    if (heightSeg.exterior) heightSeg.extendBase = off < 0 ? [A, foot] : [D, foot];
    bases = [{ a: A, b: D, role: '底' }];
    dims = [
      makeDim(A, D, base, '底', false, verts),
      {
        a: [height, off],
        b: foot,
        value: height,
        role: '高',
        isDistractor: false,
        outward: [0, leanL ? -1 : 1]
      }
    ];
    const ra = rightAngleAt(foot, [0, 1], [1, 0]);
    return finishPara(verts, bases, heightSeg, ra, dims, base, height, slant, morph, [A, B, C, D], off);
  }

  function finishPara(verts, bases, heightSeg, ra, dims, base, height, slant, morph) {
    return {
      shape: 'parallelogram',
      morph: morph,
      measurements: { base: base, height: height },
      slant: slant,
      area: base * height,
      geometry: {
        vertices: verts,
        bases: bases,
        heightSeg: heightSeg,
        rightAngle: ra,
        dimensions: dims,
        extras: []
      }
    };
  }

  function isAcuteFoot(base, height, foot) {
    if (foot <= 0.05 || foot >= base - 0.05) return false;
    return height * height > foot * (base - foot) + 1e-6;
  }

  function makeTriangle(rnd, morph) {
    const obtuse = morph.indexOf('obtuse') === 0;
    const isRight = morph.indexOf('right') === 0;
    const baseSide = morph.indexOf('baseSide') !== -1;
    const apexR = morph.indexOf('apexR') !== -1;

    let base, height, foot;
    let tries = 0;
    do {
      base = randInt(rnd, 4, 20);
      height = randInt(rnd, 3, 20);
      if ((base * height) % 2 !== 0) {
        if (rnd() < 0.5) base = base % 2 === 0 ? base : Math.min(20, base + 1);
        else height = height % 2 === 0 ? height : Math.min(20, height + 1);
      }
      if (obtuse) {
        const gap = randInt(rnd, 2, Math.max(2, Math.min(8, Math.round(base * 0.5))));
        foot = apexR || rnd() < 0.5 ? base + gap : -gap;
      } else if (isRight) {
        foot = apexR || rnd() < 0.5 ? base : 0;
      } else {
        const lo = Math.max(1, Math.round(base * 0.22));
        const hi = Math.min(base - 1, Math.round(base * 0.78));
        if (apexR) foot = randInt(rnd, Math.max(lo, Math.ceil(base * 0.5)), hi);
        else foot = randInt(rnd, lo, Math.min(hi, Math.floor(base * 0.5)));
        if (foot <= 0 || foot >= base) foot = Math.round(base * (apexR ? 0.65 : 0.35));
      }
      tries++;
    } while (
      tries < 80 && (
        base === height ||
        (base * height) % 2 !== 0 ||
        height / base < 0.22 ||
        height / base > 2.6 ||
        (!obtuse && !isRight && !isAcuteFoot(base, height, foot))
      )
    );
    if (base === height) {
      height = height >= 20 ? height - 1 : height + 1;
      if ((base * height) % 2 !== 0) height = height >= 20 ? height - 1 : height + 1;
    }

    let A = [0, 0], B = [base, 0], C = [foot, height];
    let verts = [A, B, C];
    let footPt = [foot, 0];
    const exterior = foot < -0.05 || foot > base + 0.05;
    let heightSeg = { a: C, b: footPt, exterior: exterior };
    if (exterior) heightSeg.extendBase = foot < 0 ? [A, footPt] : [B, footPt];

    if (baseSide) {
      /* Rotate 90° CCW around origin: (x,y) -> (-y, x) then shift. */
      function rot90(p) { return [-p[1], p[0]]; }
      A = rot90(A); B = rot90(B); C = rot90(C); footPt = rot90(footPt);
      verts = [A, B, C];
      heightSeg = { a: C, b: footPt, exterior: exterior };
      if (exterior) heightSeg.extendBase = foot < 0 ? [A, footPt] : [B, footPt];
    }

    const alongBase = sub(B, A);
    const towardApex = sub(C, footPt);
    const ra = rightAngleAt(footPt, alongBase, towardApex);
    const dims = [
      makeDim(A, B, base, '底', false, verts),
      makeDim(C, footPt, height, '高', false, verts)
    ];
    return {
      shape: 'triangle',
      morph: morph,
      measurements: { base: base, height: height },
      area: (base * height) / 2,
      geometry: {
        vertices: verts,
        bases: [{ a: A, b: B, role: '底' }],
        heightSeg: heightSeg,
        rightAngle: ra,
        dimensions: dims,
        extras: []
      }
    };
  }

  function makeTrapezium(rnd, morph) {
    const isRight = morph.indexOf('right') === 0;
    const tilt = morph.indexOf('tilt') !== -1;
    const longTop = morph.indexOf('longTop') !== -1;

    let top, bottom, height, tries = 0;
    do {
      top = randInt(rnd, 2, 20);
      bottom = randInt(rnd, 2, 20);
      height = randInt(rnd, 3, 18);
      tries++;
    } while (
      tries < 80 && (
        top === bottom ||
        Math.abs(top - bottom) < 2 ||
        ((top + bottom) * height) % 2 !== 0
      )
    );
    if ((top + bottom) * height % 2 !== 0) {
      height = height % 2 === 0 ? height : Math.min(20, height + 1);
    }
    if (longTop && top < bottom) { const t = top; top = bottom; bottom = t; }
    if (!longTop && bottom < top) { const t = top; top = bottom; bottom = t; }

    const diff = Math.abs(bottom - top);
    let leftOff, rightOff;
    if (isRight) {
      if (rnd() < 0.5) { leftOff = 0; rightOff = diff; }
      else { leftOff = diff; rightOff = 0; }
    } else {
      leftOff = randInt(rnd, 1, Math.max(1, diff - 1));
      rightOff = diff - leftOff;
      if (rightOff === 0) { leftOff = Math.max(1, leftOff - 1); rightOff = 1; }
    }

    let verts;
    if (bottom >= top) {
      verts = [
        [0, 0],
        [bottom, 0],
        [bottom - rightOff, height],
        [leftOff, height]
      ];
    } else {
      verts = [
        [leftOff, 0],
        [leftOff + bottom, 0],
        [top, height],
        [0, height]
      ];
    }
    const A = verts[0], B = verts[1], C = verts[2], D = verts[3];
    const botMin = Math.min(A[0], B[0]);
    const botMax = Math.max(A[0], B[0]);
    let heightSeg;
    if (isRight && Math.abs(leftOff) < 1e-9) {
      /* Vertical left leg is already the height — do not drop a second dashed altitude. */
      heightSeg = { a: D, b: A, exterior: false };
    } else if (isRight && Math.abs(rightOff) < 1e-9) {
      heightSeg = { a: C, b: B, exterior: false };
    } else {
      /* Interior (or exterior, for a long top) altitude between the two parallels. */
      const midTopX = (D[0] + C[0]) / 2;
      const footX = midTopX;
      const onBottom = footX >= botMin - 1e-9 && footX <= botMax + 1e-9;
      const exterior = !onBottom;
      const hTop = [footX, height];
      const hFoot = [footX, 0];
      heightSeg = { a: hTop, b: hFoot, exterior: exterior };
      if (exterior) {
        const closer = Math.abs(footX - A[0]) < Math.abs(footX - B[0]) ? A : B;
        heightSeg.extendBase = [closer, hFoot];
      }
    }

    if (tilt) {
      const ang = pick(rnd, [-20, -16, 16, 20, 14, -14]);
      const o = centroid(verts);
      const ext = !!(heightSeg && heightSeg.exterior);
      const extendBefore = heightSeg.extendBase ? heightSeg.extendBase[0] : null;
      verts = rotatePts(verts, ang, o);
      const hsA = rotatePt(heightSeg.a, ang, o);
      const hsB = rotatePt(heightSeg.b, ang, o);
      heightSeg = { a: hsA, b: hsB, exterior: ext };
      if (ext && extendBefore) {
        heightSeg.extendBase = [rotatePt(extendBefore, ang, o), hsB];
      }
    }

    const Va = verts[0], Vb = verts[1], Vc = verts[2], Vd = verts[3];
    const raDirBase = sub(Vb, Va);
    const raDirH = sub(heightSeg.a, heightSeg.b);
    const ra = rightAngleAt(heightSeg.b, raDirBase, raDirH);
    const dims = [
      makeDim(Vd, Vc, top, '上底', false, verts),
      makeDim(Va, Vb, bottom, '下底', false, verts),
      makeDim(heightSeg.a, heightSeg.b, height, '高', false, verts)
    ];
    return {
      shape: 'trapezium',
      morph: morph,
      measurements: { topBase: top, bottomBase: bottom, height: height },
      area: ((top + bottom) * height) / 2,
      geometry: {
        vertices: verts,
        bases: [
          { a: Vd, b: Vc, role: '上底' },
          { a: Va, b: Vb, role: '下底' }
        ],
        heightSeg: heightSeg,
        rightAngle: ra,
        dimensions: dims,
        extras: []
      }
    };
  }

  function closerPointBefore(A, B, P) {
    return dist(A, P) <= dist(B, P) ? A : B;
  }

  function pythagoreanLegs() {
    const out = [];
    P5Area.TRIPLES.forEach(function (t) {
      out.push({ footDist: t[0], height: t[1], side: t[2] });
      if (t[0] !== t[1]) out.push({ footDist: t[1], height: t[0], side: t[2] });
    });
    return out;
  }

  function identifyMorphs(shape, level) {
    if (shape === 'triangle') {
      return morphsFor(shape, level).filter(function (m) { return m.indexOf('right') !== 0; });
    }
    if (shape === 'trapezium') {
      return morphsFor(shape, level).filter(function (m) { return m.indexOf('right') !== 0; });
    }
    return morphsFor(shape, level).slice();
  }

  function exactDist(a, b, value) {
    return Math.abs(dist(a, b) - value) < 1e-6;
  }

  function heightIsSide(geo) {
    const h = geo.heightSeg;
    if (!h) return true;
    return isEdge(h.a, h.b, geo.vertices);
  }

  function finishIdentify(q, pattern, distractors, lengths) {
    q.identifySides = true;
    q.identifyPattern = pattern;
    q.identifyLengths = lengths || {};
    q.geometry.extras = [];
    q.distractors = distractors;
    return q;
  }

  /* Advanced triangle: the corresponding base + height, plus one other
     integer side when that side's measurement does not overlap the height.
     If the extra side would crowd the altitude (common on obtuse figures
     with an exterior height), omit it; base + height alone is acceptable.
     Built from a Pythagorean foot/height/side so a labeled non-base side
     is exact, never rounded. Right-triangle morphs are avoided so the
     height is clearly not a side. If the base itself would overlap the
     height, skip the candidate and try another. */
  function makeIdentifyTriangle(rnd, morph) {
    const obtuse = morph.indexOf('obtuse') === 0;
    const baseSide = morph.indexOf('baseSide') !== -1;
    const apexRight = morph.indexOf('apexR') !== -1 ||
      (morph.indexOf('apexL') === -1 && rnd() < 0.5);
    const parts = shuffle(pythagoreanLegs(), rnd);

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const height = p.height;
      const footDist = p.footDist;
      const side = p.side;
      if (height < 2 || height > 20 || footDist < 1) continue;

      const baseOpts = [];
      if (obtuse) {
        for (let b = 4; b <= 20; b++) baseOpts.push(b);
      } else {
        const maxBase = Math.min(20, Math.floor(footDist + (height * height) / footDist - 1e-9));
        for (let b = Math.max(4, footDist + 2); b <= maxBase; b++) baseOpts.push(b);
      }
      const bases = shuffle(baseOpts, rnd);
      for (let j = 0; j < bases.length; j++) {
        const base = bases[j];
        if ((base * height) % 2 !== 0) continue;
        if (base === height) continue;
        const ratio = height / base;
        if (ratio < 0.22 || ratio > 2.6) continue;

        let foot;
        if (obtuse) foot = apexRight ? base + footDist : -footDist;
        else foot = apexRight ? base - footDist : footDist;
        if (Math.abs(foot) < 0.05 || Math.abs(foot - base) < 0.05) continue;
        if (!obtuse && !isAcuteFoot(base, height, foot)) continue;

        let A = [0, 0], B = [base, 0], C = [foot, height];
        let footPt = [foot, 0];
        const exterior = foot < -0.05 || foot > base + 0.05;
        if (obtuse !== exterior) continue;
        let verts = [A, B, C];
        let heightSeg = { a: C, b: footPt, exterior: exterior };
        if (exterior) heightSeg.extendBase = foot < 0 ? [A, footPt] : [B, footPt];

        if (baseSide) {
          function rot90(pt) { return [-pt[1], pt[0]]; }
          A = rot90(A); B = rot90(B); C = rot90(C); footPt = rot90(footPt);
          verts = [A, B, C];
          heightSeg = { a: C, b: footPt, exterior: exterior };
          if (exterior) heightSeg.extendBase = foot < 0 ? [A, footPt] : [B, footPt];
        }

        const labeledLeft = !apexRight; /* AC is the integer side */
        const sideA = labeledLeft ? A : B;
        const sideB = C;
        if (!exactDist(sideA, sideB, side)) continue;
        /* Do not also label the third side, even if it happens to be integer. */
        if (side === base || side === height) continue;
        if (isEdge(heightSeg.a, heightSeg.b, verts)) continue;

        const ra = rightAngleAt(footPt, sub(B, A), sub(C, footPt));
        const heightDim = makeDim(C, footPt, height, '高', false, verts);
        const baseCand = {
          edge: [A, B], kind: 'base', keepPreferred: true,
          dim: makeDim(A, B, base, '底', false, verts)
        };
        const otherCand = {
          edge: [sideA, sideB], kind: 'otherSide', keepPreferred: false,
          dim: dimForLine(sideA, sideB, side, '', verts)
        };
        const geo = {
          vertices: verts,
          extras: [],
          heightSeg: heightSeg,
          rightAngle: ra,
          bases: [{ a: A, b: B, role: '底' }]
        };
        const picked = selectClearSides([baseCand, otherCand], heightSeg, [heightDim], geo);
        /* Combined layout can still tighten a pair that was clear alone. */
        if (picked.kept.length === 2) {
          const rows = combinedHeightGaps(geo, [heightDim], picked.kept);
          if (rows.some(function (r) { return r.gap < MIN_HEIGHT_LABEL_GAP; })) {
            picked.omitted = picked.omitted.concat(picked.kept.filter(function (c) { return c.kind !== 'base'; }));
            picked.kept = picked.kept.filter(function (c) { return c.kind === 'base'; });
          }
        }
        const keptBase = picked.kept.some(function (c) { return c.kind === 'base'; });
        if (!keptBase) continue;
        const dims = [heightDim].concat(picked.kept.map(function (c) { return c.dim; }));
        const omittedKinds = picked.omitted.map(function (c) { return c.kind; });
        const q = {
          shape: 'triangle',
          morph: morph,
          measurements: { base: base, height: height },
          area: (base * height) / 2,
          geometry: {
            vertices: verts,
            bases: [{ a: A, b: B, role: '底' }],
            heightSeg: heightSeg,
            rightAngle: ra,
            dimensions: dims,
            extras: []
          }
        };
        return finishIdentify(q, 'triangle-two-sides',
          [{ type: 'side', value: side }],
          { base: base, height: height, otherSide: side,
            omitted: omittedKinds[0] || '', omittedKinds: omittedKinds });
      }
    }
    return null;
  }

  let cachedTrapSpecs = null;
  function integerTrapeziumSpecs() {
    if (cachedTrapSpecs) return cachedTrapSpecs;
    const out = [];
    const legs = pythagoreanLegs();
    /* Isosceles: half-difference / height / leg is a triple. */
    legs.forEach(function (t) {
      if (t.height < 2 || t.height > 20 || t.footDist < 1) return;
      const diff = t.footDist * 2;
      for (let shortS = 2; shortS <= 20 - diff; shortS++) {
        const longS = shortS + diff;
        if (longS > 20 || longS < 2) continue;
        if (((shortS + longS) * t.height) % 2 !== 0) continue;
        if (t.side === shortS || t.side === longS || t.side === t.height) continue;
        out.push({
          top: shortS, bottom: longS, height: t.height,
          leftOff: t.footDist, rightOff: t.footDist,
          leftLeg: t.side, rightLeg: t.side, longTop: false
        });
        out.push({
          top: longS, bottom: shortS, height: t.height,
          leftOff: t.footDist, rightOff: t.footDist,
          leftLeg: t.side, rightLeg: t.side, longTop: true
        });
      }
    });
    /* General: two triples sharing a height (the altitude). */
    const byH = {};
    legs.forEach(function (t) {
      if (t.height < 2 || t.height > 20 || t.footDist < 1) return;
      (byH[t.height] || (byH[t.height] = [])).push(t);
    });
    Object.keys(byH).forEach(function (hKey) {
      const group = byH[hKey];
      const h = group[0].height;
      for (let i = 0; i < group.length; i++) {
        for (let j = 0; j < group.length; j++) {
          if (i === j) continue;
          const L = group[i];
          const R = group[j];
          if (L.footDist < 1 || R.footDist < 1) continue;
          const diff = L.footDist + R.footDist;
          for (let shortS = 2; shortS <= 20 - diff; shortS++) {
            const longS = shortS + diff;
            if (longS > 20) continue;
            if (((shortS + longS) * h) % 2 !== 0) continue;
            const vals = [shortS, longS, h];
            if (vals.indexOf(L.side) !== -1 || vals.indexOf(R.side) !== -1) continue;
            out.push({
              top: shortS, bottom: longS, height: h,
              leftOff: L.footDist, rightOff: R.footDist,
              leftLeg: L.side, rightLeg: R.side, longTop: false
            });
            out.push({
              top: longS, bottom: shortS, height: h,
              leftOff: L.footDist, rightOff: R.footDist,
              leftLeg: L.side, rightLeg: R.side, longTop: true
            });
          }
        }
      }
    });
    cachedTrapSpecs = out;
    return out;
  }


  function pointSegDist(p, a, b) {
    const ab = sub(b, a);
    const L2 = dot(ab, ab) || 1e-9;
    let tt = dot(sub(p, a), ab) / L2;
    tt = Math.max(0, Math.min(1, tt));
    return dist(p, add(a, mul(ab, tt)));
  }

  function segSegDist(a, b, c, d) {
    return Math.min(
      pointSegDist(a, c, d), pointSegDist(b, c, d),
      pointSegDist(c, a, b), pointSegDist(d, a, b)
    );
  }

  function midPt(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

  /* A side crowds the height when its outward dimension band runs toward
     the altitude (typical: the slant adjoining an exterior height).
     Sharing a vertex with the dashed base-extension is not enough. */
  function sideCrowdsHeight(edge, heightSeg, verts) {
    const out = outwardFromEdge(edge[0], edge[1], centroid(verts));
    const midE = midPt(edge[0], edge[1]);
    const hMid = midPt(heightSeg.a, heightSeg.b);
    const faces = dot(out, sub(hMid, midE)) > 0;
    const dH = segSegDist(edge[0], edge[1], heightSeg.a, heightSeg.b);
    let bandD = Infinity;
    const offsets = [0.6, 1.2, 1.8, 2.4];
    for (let i = 0; i < offsets.length; i++) {
      const a2 = add(edge[0], mul(out, offsets[i]));
      const b2 = add(edge[1], mul(out, offsets[i]));
      bandD = Math.min(bandD, segSegDist(a2, b2, heightSeg.a, heightSeg.b));
    }
    return (faces && dH < 1.25) || (faces && bandD < 1.25);
  }

  function labelBoxGap(a, b) {
    const gapX = (a.x + a.w <= b.x) ? b.x - (a.x + a.w)
      : (b.x + b.w <= a.x) ? a.x - (b.x + b.w) : 0;
    const gapY = (a.y + a.h <= b.y) ? b.y - (a.y + a.h)
      : (b.y + b.h <= a.y) ? a.y - (b.y + b.h) : 0;
    const noOverlap = (a.x + a.w <= b.x) || (b.x + b.w <= a.x) ||
      (a.y + a.h <= b.y) || (b.y + b.h <= a.y);
    if (!noOverlap) return 0;
    if (gapX === 0 || gapY === 0) return gapX + gapY;
    return Math.hypot(gapX, gapY);
  }

  /* Side labels closer than this to the height label are treated as overlapping. */
  const MIN_HEIGHT_LABEL_GAP = 28;

  function gapOfDimToHeight(geo, heightDims, dim) {
    if (!P5Area.svg || !P5Area.svg.render) return Infinity;
    const trial = Object.assign({}, geo, {
      dimensions: heightDims.concat([dim]),
      extras: geo.extras || []
    });
    P5Area.svg.render(trial, { reveal: false });
    const labels = (P5Area.svg.lastLayout && P5Area.svg.lastLayout.labels) || [];
    const hLabs = labels.filter(function (l) { return l.role === '高'; });
    const sLabs = labels.filter(function (l) { return l.role !== '高'; });
    let gap = Infinity;
    hLabs.forEach(function (h) {
      sLabs.forEach(function (s) { gap = Math.min(gap, labelBoxGap(h.box, s.box)); });
    });
    return gap;
  }

  function combinedHeightGaps(geo, heightDims, kept) {
    if (!P5Area.svg || !P5Area.svg.render) return [];
    const trial = Object.assign({}, geo, {
      dimensions: heightDims.concat(kept.map(function (c) { return c.dim; })),
      extras: geo.extras || []
    });
    P5Area.svg.render(trial, { reveal: false });
    const labels = (P5Area.svg.lastLayout && P5Area.svg.lastLayout.labels) || [];
    const hLabs = labels.filter(function (l) { return l.role === '高'; });
    const sLabs = labels.filter(function (l) { return l.role !== '高'; });
    return sLabs.map(function (s) {
      let gap = Infinity;
      hLabs.forEach(function (h) { gap = Math.min(gap, labelBoxGap(h.box, s.box)); });
      return { text: s.text, role: s.role, box: s.box, gap: gap };
    });
  }

  function matchKeptToGaps(kept, gapRows) {
    const used = {};
    return kept.map(function (c) {
      let best = -1, bestD = Infinity;
      gapRows.forEach(function (row, i) {
        if (used[i]) return;
        const txt = String(row.text || '');
        if (txt.indexOf(String(c.dim.value)) === -1) return;
        if (row.gap < bestD) { bestD = row.gap; best = i; }
      });
      if (best < 0) {
        gapRows.forEach(function (row, i) {
          if (used[i]) return;
          if (best < 0 || row.gap < bestD) { bestD = row.gap; best = i; }
        });
      }
      if (best >= 0) used[best] = true;
      return { cand: c, gap: best >= 0 ? gapRows[best].gap : Infinity };
    });
  }

  /* Keep up to three sides that do not overlap the height. Two sides + height
     is allowed when a third side would crowd the altitude. Prefer keeping
     pedagogically useful sides (bases) when we have a spare to drop. */
  function selectClearSides(sideCands, heightSeg, heightDims, geo) {
    const verts = geo.vertices;
    const crowded = [];
    const clear = [];
    sideCands.forEach(function (c) {
      if (sideCrowdsHeight(c.edge, heightSeg, verts)) crowded.push(c);
      else clear.push(c);
    });
    const cleared = [];
    clear.forEach(function (c) {
      const gap = gapOfDimToHeight(geo, heightDims, c.dim);
      if (gap < MIN_HEIGHT_LABEL_GAP) crowded.push(c);
      else cleared.push(c);
    });

    function closeness(c) {
      const g = gapOfDimToHeight(geo, heightDims, c.dim);
      const dH = segSegDist(c.edge[0], c.edge[1], heightSeg.a, heightSeg.b);
      return (Number.isFinite(g) ? g : 1000) + dH * 0.01;
    }

    let kept = cleared.slice();
    while (kept.length > 3) {
      const optional = kept.filter(function (c) { return !c.keepPreferred; });
      const pool = optional.length ? optional : kept;
      let worst = pool[0], worstScore = closeness(worst);
      pool.forEach(function (c) {
        const s = closeness(c);
        if (s < worstScore) { worst = c; worstScore = s; }
      });
      crowded.push(worst);
      kept = kept.filter(function (c) { return c !== worst; });
    }

    let guard = 0;
    while (kept.length > 2 && guard++ < 4) {
      const rows = combinedHeightGaps(geo, heightDims, kept);
      if (!rows.length) break;
      const mapped = matchKeptToGaps(kept, rows);
      let worst = null, worstGap = Infinity;
      mapped.forEach(function (m) {
        if (m.gap < worstGap) { worstGap = m.gap; worst = m.cand; }
      });
      if (worstGap >= MIN_HEIGHT_LABEL_GAP) break;
      crowded.push(worst);
      kept = kept.filter(function (c) { return c !== worst; });
    }

    return { kept: kept, omitted: crowded };
  }

  /* Advanced trapezium: label sides that do not overlap the height
     (prefer both bases + one clear leg; drop a base only if it crowds
     the altitude). Two sides + height is allowed if needed for clearance. */
  function makeIdentifyTrapezium(rnd, morph) {
    const tilt = morph.indexOf('tilt') !== -1;
    const wantLongTop = morph.indexOf('longTop') !== -1;
    const specs = shuffle(integerTrapeziumSpecs().filter(function (s) {
      return !!s.longTop === wantLongTop;
    }), rnd);
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const top = s.top, bottom = s.bottom, height = s.height;
      const leftOff = s.leftOff, rightOff = s.rightOff;
      let verts;
      if (bottom >= top) {
        verts = [
          [0, 0],
          [bottom, 0],
          [bottom - rightOff, height],
          [leftOff, height]
        ];
      } else {
        verts = [
          [leftOff, 0],
          [leftOff + bottom, 0],
          [top, height],
          [0, height]
        ];
      }
      const A0 = verts[0], B0 = verts[1], C0 = verts[2], D0 = verts[3];
      if (!exactDist(A0, D0, s.leftLeg) || !exactDist(B0, C0, s.rightLeg)) continue;
      if (!exactDist(A0, B0, bottom) || !exactDist(D0, C0, top)) continue;

      const botMin = Math.min(A0[0], B0[0]);
      const botMax = Math.max(A0[0], B0[0]);
      const midTopX = (D0[0] + C0[0]) / 2;
      const onBottom = midTopX >= botMin - 1e-9 && midTopX <= botMax + 1e-9;
      const exterior = !onBottom;
      const hTop = [midTopX, height];
      const hFoot = [midTopX, 0];
      let heightSeg = { a: hTop, b: hFoot, exterior: exterior };
      if (exterior) {
        const closer = Math.abs(midTopX - A0[0]) < Math.abs(midTopX - B0[0]) ? A0 : B0;
        heightSeg.extendBase = [closer, hFoot];
      }

      if (tilt) {
        const ang = pick(rnd, [-20, -16, 16, 20, 14, -14]);
        const o = centroid(verts);
        const ext0 = heightSeg.extendBase;
        verts = rotatePts(verts, ang, o);
        heightSeg = {
          a: rotatePt(hTop, ang, o),
          b: rotatePt(hFoot, ang, o),
          exterior: exterior
        };
        if (exterior) {
          heightSeg.extendBase = [
            rotatePt(ext0 ? ext0[0] : A0, ang, o),
            rotatePt(hFoot, ang, o)
          ];
        }
      }

      const Va = verts[0], Vb = verts[1], Vc = verts[2], Vd = verts[3];
      if (!exactDist(Va, Vd, s.leftLeg) || !exactDist(Vb, Vc, s.rightLeg)) continue;
      if (isEdge(heightSeg.a, heightSeg.b, verts)) continue;

      const ra = rightAngleAt(heightSeg.b, sub(Vb, Va), sub(heightSeg.a, heightSeg.b));
      const heightDim = makeDim(heightSeg.a, heightSeg.b, height, '高', false, verts);
      const sideCands = [
        { edge: [Vd, Vc], kind: 'topBase', keepPreferred: true, dim: makeDim(Vd, Vc, top, '上底', false, verts) },
        { edge: [Va, Vb], kind: 'bottomBase', keepPreferred: true, dim: makeDim(Va, Vb, bottom, '下底', false, verts) },
        { edge: [Va, Vd], kind: 'leftLeg', keepPreferred: false, dim: dimForLine(Va, Vd, s.leftLeg, '', verts) },
        { edge: [Vb, Vc], kind: 'rightLeg', keepPreferred: false, dim: dimForLine(Vb, Vc, s.rightLeg, '', verts) }
      ];
      const picked = selectClearSides(sideCands, heightSeg, [heightDim], {
        vertices: verts, extras: [], heightSeg: heightSeg, rightAngle: ra,
        bases: [{ a: Vd, b: Vc }, { a: Va, b: Vb }]
      });
      const dims = [heightDim].concat(picked.kept.map(function (c) { return c.dim; }));
      const omittedKinds = picked.omitted.map(function (c) { return c.kind; });
      const q = {
        shape: 'trapezium',
        morph: morph,
        measurements: { topBase: top, bottomBase: bottom, height: height },
        area: ((top + bottom) * height) / 2,
        geometry: {
          vertices: verts,
          bases: [
            { a: Vd, b: Vc, role: '上底' },
            { a: Va, b: Vb, role: '下底' }
          ],
          heightSeg: heightSeg,
          rightAngle: ra,
          dimensions: dims,
          extras: []
        }
      };
      const dists = [
        { type: 'leg', value: s.leftLeg },
        { type: 'leg', value: s.rightLeg }
      ];
      return finishIdentify(q, 'trapezium-three-sides', dists, {
        topBase: top, bottomBase: bottom, height: height,
        leftLeg: s.leftLeg, rightLeg: s.rightLeg,
        omitted: omittedKinds[0] || '',
        omittedKinds: omittedKinds
      });
    }
    return null;
  }

  /* Advanced parallelogram: omit any side whose measurement would overlap
     the height (e.g. the slant adjoining an exterior altitude). Keep up to
     three clear sides; two sides + height is acceptable. Opposite sides
     remain equal, so students can still identify the corresponding base. */
  function makeIdentifyParallelogram(rnd, morph) {
    const q = makeParallelogram(rnd, morph);
    if (!q || !q.slant) return null;
    const base = q.measurements.base;
    const height = q.measurements.height;
    const slant = q.slant;
    if (base === height || slant === base || slant === height) return null;
    if (slant < 2) return null;
    const v = q.geometry.vertices;
    const baseSide = (q.morph || '').indexOf('baseSide') !== -1;
    let baseEdges, slantEdges;
    if (baseSide) {
      baseEdges = [[v[0], v[3]], [v[1], v[2]]];
      slantEdges = [[v[0], v[1]], [v[3], v[2]]];
    } else {
      baseEdges = [[v[0], v[1]], [v[3], v[2]]];
      slantEdges = [[v[0], v[3]], [v[1], v[2]]];
    }
    for (let i = 0; i < 2; i++) {
      if (!exactDist(baseEdges[i][0], baseEdges[i][1], base)) return null;
      if (!exactDist(slantEdges[i][0], slantEdges[i][1], slant)) return null;
    }
    if (isEdge(q.geometry.heightSeg.a, q.geometry.heightSeg.b, v)) return null;

    const heightDims = q.geometry.dimensions.filter(function (d) { return d.role === '高'; });
    const sideCands = [];
    baseEdges.forEach(function (e) {
      sideCands.push({ edge: e, kind: 'base', keepPreferred: true, dim: makeDim(e[0], e[1], base, '底', false, v) });
    });
    slantEdges.forEach(function (e) {
      sideCands.push({ edge: e, kind: 'slant', keepPreferred: false, dim: dimForLine(e[0], e[1], slant, '', v) });
    });
    const picked = selectClearSides(sideCands, q.geometry.heightSeg, heightDims, q.geometry);
    const dims = heightDims.slice();
    picked.kept.forEach(function (c) { dims.push(c.dim); });
    const omittedKinds = picked.omitted.map(function (c) { return c.kind; });
    q.geometry.dimensions = dims;
    q.geometry.extras = [];
    return finishIdentify(q, 'parallelogram-three-sides',
      [{ type: 'slant', value: slant }, { type: 'slant', value: slant }],
      { base: base, height: height, slant: slant, omitted: omittedKinds[0] || '', omittedKinds: omittedKinds });
  }

  function makeIdentifyShape(shape, morph, rnd) {
    if (shape === 'triangle') return makeIdentifyTriangle(rnd, morph);
    if (shape === 'trapezium') return makeIdentifyTrapezium(rnd, morph);
    if (shape === 'parallelogram') return makeIdentifyParallelogram(rnd, morph);
    return null;
  }


  /* ---------- distractors ---------- */

  function addDistractors(q, count, rnd) {
    if (count <= 0) {
      q.distractors = [];
      return q;
    }
    const forbidden = neededValuesList(q);
    const added = [];
    const geo = q.geometry;
    const v = geo.vertices;

    function pushAux(type, fallbackType) {
      if (added.length >= count) return;
      /* Try preferred constructions, then generic aux line. */
      const pref = preferredDistractor(q, type, forbidden.concat(added.map(function (d) { return d.value; })), rnd);
      if (pref) {
        added.push(pref);
        if (pref.line) geo.extras.push({ a: pref.line.a, b: pref.line.b });
        if (pref.dim) geo.dimensions.push(pref.dim);
        return;
      }
      const gen = genericAux(q, forbidden.concat(added.map(function (d) { return d.value; })), rnd);
      if (gen) {
        gen.type = fallbackType || 'aux';
        added.push(gen);
        geo.extras.push({ a: gen.line.a, b: gen.line.b });
        geo.dimensions.push(gen.dim);
      }
    }

    if (q.shape === 'square') {
      pushAux('aux', 'aux');
      if (count >= 2) pushAux('aux', 'aux');
    } else if (q.shape === 'rectangle') {
      pushAux('diagonal', 'aux');
      if (count >= 2) pushAux('aux', 'aux');
    } else if (q.shape === 'parallelogram') {
      pushAux('slant', 'aux');
      if (count >= 2) pushAux('aux', 'aux');
    } else if (q.shape === 'triangle') {
      pushAux('side', 'aux');
      if (count >= 2) pushAux('aux', 'aux');
    } else if (q.shape === 'trapezium') {
      pushAux('leg', 'aux');
      if (count >= 2) pushAux('diagonal', 'aux');
    }

    pruneAmbiguousDashed(q);
    /* If a close-to-height extra was dropped, try one more non-conflicting aux. */
    if (added.length < count) {
      /* no-op: added may still list a pruned item; refresh from remaining dims */
    }
    const remainingVals = {};
    (geo.dimensions || []).forEach(function (d) {
      if (d.isDistractor) remainingVals[d.value] = true;
    });
    const keptAdded = added.filter(function (d) { return remainingVals[d.value]; });
    let guard = 0;
    while (keptAdded.length < count && guard < 8) {
      guard++;
      const forbidNow = forbidden.concat(keptAdded.map(function (d) { return d.value; }));
      const gen = genericAux(q, forbidNow, rnd) || farFromHeightAux(q, forbidNow, rnd);
      if (!gen) break;
      geo.extras.push({ a: gen.line.a, b: gen.line.b });
      geo.dimensions.push(gen.dim);
      keptAdded.push(gen);
      pruneAmbiguousDashed(q);
      const still = {};
      (geo.dimensions || []).forEach(function (d) {
        if (d.isDistractor) still[d.value] = true;
      });
      if (!still[gen.value]) {
        keptAdded.pop();
      }
    }
    q.distractors = (geo.dimensions || []).filter(function (d) {
      return d.isDistractor;
    }).map(function (d) {
      const match = keptAdded.filter(function (a) { return a.value === d.value; })[0];
      return { type: (match && match.type) || 'aux', value: d.value };
    });
    return q;
  }

  function neededValuesList(q) {
    const m = q.measurements;
    return Object.keys(m).map(function (k) { return m[k]; });
  }

  function isEdge(a, b, verts) {
    const n = verts.length;
    function near(p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.15; }
    for (let i = 0; i < n; i++) {
      const A = verts[i], B = verts[(i + 1) % n];
      if ((near(a, A) && near(b, B)) || (near(a, B) && near(b, A))) return true;
    }
    return false;
  }

  function dimForLine(a, b, value, role, verts) {
    const d = makeDim(a, b, value, role, true, verts);
    d.onEdge = isEdge(a, b, verts);
    return d;
  }

  function preferredDistractor(q, type, forbidden, rnd) {
    const v = q.geometry.vertices;
    if (type === 'diagonal' && (q.shape === 'rectangle' || q.shape === 'square' || q.shape === 'trapezium' || q.shape === 'parallelogram')) {
      const A = v[0], C = v[2];
      const raw = dist(A, C);
      /* Use exact integer if the diagonal is very close to an integer (from triples). */
      const nearest = Math.round(raw);
      if (Math.abs(raw - nearest) < 0.03 && forbidden.indexOf(nearest) === -1 && nearest >= 2) {
        return {
          type: 'diagonal',
          value: nearest,
          line: { a: A, b: C },
          dim: dimForLine(A, C, nearest, '', v)
        };
      }
      /* Otherwise try a vertex-to-opposite-side auxiliary instead of a wrong diagonal length. */
    }
    if (type === 'slant' && q.shape === 'parallelogram' && q.slant && forbidden.indexOf(q.slant) === -1) {
      /* Label one adjacent (non-base) side. For base-bottom, sides AD or BC. For base-side, AB or DC. */
      const morph = q.morph || '';
      let a, b;
      if (morph.indexOf('baseSide') !== -1) {
        a = v[0]; b = v[1];
      } else {
        a = v[0]; b = v[3];
      }
      return {
        type: 'slant',
        value: q.slant,
        line: null,
        dim: dimForLine(a, b, q.slant, '', v)
      };
    }
    if (type === 'side' && q.shape === 'triangle') {
      /* Label a non-base side if its length is nearly integer. */
      const A = v[0], B = v[1], C = v[2];
      const sides = [
        { a: A, b: C, L: dist(A, C) },
        { a: B, b: C, L: dist(B, C) }
      ];
      for (let i = 0; i < sides.length; i++) {
        const n = Math.round(sides[i].L);
        if (Math.abs(sides[i].L - n) < 0.03 && n >= 2 && forbidden.indexOf(n) === -1) {
          return {
            type: 'side',
            value: n,
            line: null,
            dim: dimForLine(sides[i].a, sides[i].b, n, '', v)
          };
        }
      }
    }
    if (type === 'leg' && q.shape === 'trapezium') {
      const A = v[0], B = v[1], C = v[2], D = v[3];
      const legs = [
        { a: A, b: D, L: dist(A, D) },
        { a: B, b: C, L: dist(B, C) }
      ];
      /* Skip a leg that is essentially the height (right-angle leg). */
      const h = q.measurements.height;
      for (let i = 0; i < legs.length; i++) {
        const n = Math.round(legs[i].L);
        const isHeightLeg = Math.abs(legs[i].L - h) < 0.03;
        if (isHeightLeg) continue;
        if (Math.abs(legs[i].L - n) < 0.03 && n >= 2 && forbidden.indexOf(n) === -1) {
          return {
            type: 'leg',
            value: n,
            line: null,
            dim: dimForLine(legs[i].a, legs[i].b, n, '', v)
          };
        }
      }
    }
    return null;
  }

  /* Honest dashed extra: both ends on the polygon boundary, integer length. */
  function anyIntegerBoundaryChord(q, forbidden, rnd) {
    const v = q.geometry.vertices;
    const n = v.length;
    function accept(found) {
      if (!found) return null;
      if (closeToHeight(q, found.a, found.b)) return null;
      if (isEdge(found.a, found.b, v)) return null;
      return {
        type: 'aux',
        value: found.value,
        line: { a: found.a, b: found.b },
        dim: dimForLine(found.a, found.b, found.value, '', v)
      };
    }
    const vorder = [];
    for (let i = 0; i < n; i++) vorder.push(i);
    shuffle(vorder, rnd);
    for (let i = 0; i < vorder.length; i++) {
      const vi = vorder[i];
      const elist = [];
      for (let e = 0; e < n; e++) {
        if (e === vi || (e + 1) % n === vi) continue;
        elist.push(e);
      }
      if (q.shape === 'trapezium') {
        elist.sort(function (a, b) { return (b === 0 ? 1 : 0) - (a === 0 ? 1 : 0); });
      } else {
        shuffle(elist, rnd);
      }
      for (let j = 0; j < elist.length; j++) {
        const e = elist[j];
        const got = accept(integerAuxLine(v[vi], v[e], v[(e + 1) % n], forbidden, rnd));
        if (got) return got;
      }
    }
    const ts = [0.25, 0.5, 0.75, 0.2, 0.4, 0.6, 0.8, 1 / 3, 2 / 3];
    const eorder = [];
    for (let i = 0; i < n; i++) eorder.push(i);
    shuffle(eorder, rnd);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < eorder.length; i++) {
        const e1 = eorder[i];
        const P1 = v[e1], Q1 = v[(e1 + 1) % n];
        for (let ti = 0; ti < ts.length; ti++) {
          const S = add(P1, mul(sub(Q1, P1), ts[ti]));
          for (let e2 = 0; e2 < n; e2++) {
            if (e2 === e1) continue;
            const adj = (e2 === (e1 + 1) % n || e1 === (e2 + 1) % n);
            if (pass === 0 && adj) continue;
            if (pass === 1 && !adj) continue;
            const got = accept(integerAuxLine(S, v[e2], v[(e2 + 1) % n], forbidden, rnd));
            if (got) return got;
          }
        }
      }
    }
    return null;
  }

  function genericAux(q, forbidden, rnd) {
    const v = q.geometry.vertices;
    const n = v.length;
    const order = shuffle([0, 1, 2, 3].filter(function (i) { return i < n; }), rnd);
    for (let i = 0; i < order.length; i++) {
      const vi = order[i];
      const V = v[vi];
      /* Opposite edge: for triangle, the edge not incident; for quad, skip adjacent. */
      if (n === 3) {
        const P = v[(vi + 1) % 3];
        const Q = v[(vi + 2) % 3];
        /* Don't use the base as the only option if this vertex is the apex — that's ok (it's a line to the base, but not the height if we avoid the foot). */
        const found = integerAuxLine(V, P, Q, forbidden, rnd);
        if (found) {
          /* Reject if it coincides with the height segment. */
          if (closeToHeight(q, found.a, found.b)) continue;
          return {
            type: 'aux',
            value: found.value,
            line: { a: found.a, b: found.b },
            dim: dimForLine(found.a, found.b, found.value, '', v)
          };
        }
      } else {
        /* Every edge not incident to V (a quad has two). Prefer the bottom of a trapezium. */
        const edgeList = [];
        for (let e = 0; e < n; e++) {
          const P = v[e], Q = v[(e + 1) % n];
          if (e === vi || (e + 1) % n === vi) continue;
          edgeList.push([P, Q, e]);
        }
        if (q.shape === 'trapezium') {
          edgeList.sort(function (E1, E2) {
            function isBottom(E) { return E[2] === 0; }
            return (isBottom(E2) ? 1 : 0) - (isBottom(E1) ? 1 : 0);
          });
        }
        let kept = null;
        for (let ei = 0; ei < edgeList.length; ei++) {
          const P = edgeList[ei][0], Q = edgeList[ei][1];
          const found = integerAuxLine(V, P, Q, forbidden, rnd);
          if (!found) continue;
          if (closeToHeight(q, found.a, found.b)) continue;
          kept = found;
          break;
        }
        if (kept) {
          return {
            type: 'aux',
            value: kept.value,
            line: { a: kept.a, b: kept.b },
            dim: dimForLine(kept.a, kept.b, kept.value, '', v)
          };
        }
      }
    }
    /* No floating stubs: try a boundary-to-boundary integer chord, else give up. */
    return anyIntegerBoundaryChord(q, forbidden, rnd);
  }

  function pointToSegDist(p, a, b) {
    const ab = sub(b, a);
    const L2 = ab[0] * ab[0] + ab[1] * ab[1];
    if (L2 < 1e-12) return dist(p, a);
    let t = (dot(sub(p, a), ab)) / L2;
    t = Math.max(0, Math.min(1, t));
    return dist(p, add(a, mul(ab, t)));
  }

  /* Two dashed segments whose labels would be hard to tell apart
     (nearly the same line, or sharing a vertex at a tight angle). */
  function dashedSegsAmbiguous(a, b, c, d) {
    const lenAB = dist(a, b);
    const lenCD = dist(c, d);
    if (lenAB < 0.4 || lenCD < 0.4) return false;
    const u = mul(sub(b, a), 1 / lenAB);
    const v = mul(sub(d, c), 1 / lenCD);
    const par = Math.abs(dot(u, v));
    const share = dist(a, c) < 0.35 || dist(a, d) < 0.35 ||
      dist(b, c) < 0.35 || dist(b, d) < 0.35;
    function at(p, q, t) { return add(p, mul(sub(q, p), t)); }
    const dBody = Math.min(
      pointToSegDist(at(a, b, 0.5), c, d),
      pointToSegDist(at(a, b, 1 / 3), c, d),
      pointToSegDist(at(a, b, 2 / 3), c, d),
      pointToSegDist(at(c, d, 0.5), a, b),
      pointToSegDist(at(c, d, 1 / 3), a, b),
      pointToSegDist(at(c, d, 2 / 3), a, b)
    );
    if (share && par >= 0.88) return true;
    if (par >= 0.92 && dBody <= 1.6) return true;
    if (dBody <= 1.0 && par >= 0.8) return true;
    return false;
  }

  function closeToHeight(q, a, b) {
    const h = q.geometry && q.geometry.heightSeg;
    if (!h) return false;
    function near(p, qpt) { return dist(p, qpt) < 0.25; }
    if ((near(a, h.a) && near(b, h.b)) || (near(a, h.b) && near(b, h.a))) return true;
    return dashedSegsAmbiguous(a, b, h.a, h.b);
  }

  function dimMatchesSeg(d, a, b) {
    if (!d || !d._a || !d._b) return false;
    function near(p, qpt) { return dist(p, qpt) < 0.3; }
    return (near(d._a, a) && near(d._b, b)) || (near(d._a, b) && near(d._b, a));
  }

  function farFromHeightAux(q, forbidden, rnd) {
    const v = q.geometry.vertices;
    const h = q.geometry.heightSeg;
    if (!h) return null;
    const n = v.length;
    const midH = mid(h.a, h.b);
    const order = v.map(function (pt, i) { return { pt: pt, i: i, d: dist(pt, midH) }; })
      .sort(function (a, b) { return b.d - a.d; });
    for (let oi = 0; oi < order.length; oi++) {
      const vi = order[oi].i;
      const V = order[oi].pt;
      for (let e = 0; e < n; e++) {
        if (e === vi || (e + 1) % n === vi) continue;
        const found = integerAuxLine(V, v[e], v[(e + 1) % n], forbidden, rnd);
        if (!found) continue;
        if (closeToHeight(q, found.a, found.b)) continue;
        return {
          type: 'aux',
          value: found.value,
          line: { a: found.a, b: found.b },
          dim: dimForLine(found.a, found.b, found.value, '', v)
        };
      }
    }
    return anyIntegerBoundaryChord(q, forbidden, rnd);
  }

  /* Drop a non-height dashed extra (and its label) when it sits so close
     to the height — or to another dashed extra — that 13 vs 14 is ambiguous. */
  function pruneAmbiguousDashed(q) {
    const geo = q && q.geometry;
    if (!geo) return q;
    const h = geo.heightSeg;
    const extras = geo.extras || [];
    if (!extras.length) return q;
    const dropped = [];
    const kept = [];
    extras.forEach(function (e) {
      if (!e || !e.a || !e.b) { kept.push(e); return; }
      if (h && dashedSegsAmbiguous(e.a, e.b, h.a, h.b)) dropped.push(e);
      else kept.push(e);
    });
    const kept2 = [];
    kept.forEach(function (e) {
      const clash = kept2.some(function (k) {
        return dashedSegsAmbiguous(e.a, e.b, k.a, k.b);
      });
      if (clash) dropped.push(e);
      else kept2.push(e);
    });
    if (!dropped.length) return q;
    geo.extras = kept2;
    geo.dimensions = (geo.dimensions || []).filter(function (d) {
      return !dropped.some(function (e) { return dimMatchesSeg(d, e.a, e.b); });
    });
    if (q.distractors && q.distractors.length) {
      const remaining = {};
      (geo.dimensions || []).forEach(function (d) {
        if (d.isDistractor) remaining[d.value] = true;
      });
      q.distractors = q.distractors.filter(function (d) { return remaining[d.value]; });
    }
    return q;
  }

  function morphsFor(shape, level) {
    if (shape === 'triangle') {
      return level === 'beginner' ? P5Area.MORPHS.triangleBeginner : P5Area.MORPHS.triangleMidHigh;
    }
    return P5Area.MORPHS[shape];
  }

  function makeShape(shape, morph, rnd) {
    if (shape === 'square') return makeSquare(rnd, morph);
    if (shape === 'rectangle') return makeRectangle(rnd, morph);
    if (shape === 'parallelogram') return makeParallelogram(rnd, morph);
    if (shape === 'triangle') return makeTriangle(rnd, morph);
    return makeTrapezium(rnd, morph);
  }

  function validateQuestion(q) {
    const m = q.measurements;
    const keys = Object.keys(m);
    for (let i = 0; i < keys.length; i++) {
      const v = m[keys[i]];
      if (!Number.isInteger(v) || v < 2 || v > 20) return false;
    }
    const area = P5Area.scoring.computeArea(q);
    if (!Number.isInteger(area) || area <= 0) return false;
    if (q.shape === 'triangle' && (m.base * m.height) % 2 !== 0) return false;
    if (q.shape === 'trapezium' && ((m.topBase + m.bottomBase) * m.height) % 2 !== 0) return false;
    if (!q.geometry || !q.geometry.vertices || q.geometry.vertices.length < 3) return false;
    if (!q.geometry.heightSeg) return false;
    if (q.distractors) {
      const needed = neededValuesList(q);
      for (let i = 0; i < q.distractors.length; i++) {
        if (needed.indexOf(q.distractors[i].value) !== -1) return false;
        if (!Number.isInteger(q.distractors[i].value)) return false;
      }
    }
    return true;
  }

  function decorateQuestion(q, shape, level, rnd, opts) {
    q.level = level;
    q.formulaId = P5Area.FORMULA_BY_SHAPE[shape];
    q.shapeZh = P5Area.SHAPES[shape].zh;
    q.signature = signatureOf(shape, q.measurements);
    q.formulaOrder = opts.formulaOrder || shuffleFormulas(rnd);
    /* Role names never appear on the answering figure (svg.js / app.js).
       This flag is retained for compatibility; mid-level used to hide role
       names on some questions, which is now the default at every level.
       Length numbers themselves are never hidden. */
    q.showRoleLabels = false;
    if (!q.distractors) q.distractors = [];
    q.area = P5Area.scoring.computeArea(q);
    return q;
  }

  function generateQuestion(shape, level, rnd, opts) {
    opts = opts || {};
    let q = null;
    const wantIdentify = !!(level === 'advanced' && opts.identifySides &&
      (shape === 'triangle' || shape === 'trapezium' || shape === 'parallelogram'));
    if (wantIdentify) {
      const idList = identifyMorphs(shape, level);
      let morph = opts.morph;
      if (!morph || idList.indexOf(morph) === -1) morph = pick(rnd, idList);
      q = makeIdentifyShape(shape, morph, rnd);
    }
    if (!q) {
      const list = morphsFor(shape, level);
      const morph = opts.morph || pick(rnd, list);
      q = makeShape(shape, morph, rnd);
      decorateQuestion(q, shape, level, rnd, opts);
      if (level === 'advanced' && !q.identifySides) {
        const count = opts.distractorCount != null ? opts.distractorCount : (rnd() < 0.5 ? 1 : 2);
        addDistractors(q, count, rnd);
      }
      q.area = P5Area.scoring.computeArea(q);
      return q;
    }
    return decorateQuestion(q, shape, level, rnd, opts);
  }

  function planIdentifySlots(types, rnd) {
    const flags = types.map(function () { return false; });
    function assign(shape, prefer) {
      const idx = [];
      types.forEach(function (s, i) { if (s === shape) idx.push(i); });
      const sh = shuffle(idx, rnd);
      const k = Math.min(prefer, sh.length);
      for (let i = 0; i < k; i++) flags[sh[i]] = true;
    }
    assign('triangle', 2);
    assign('trapezium', 2);
    assign('parallelogram', 1);
    return flags;
  }

  function generateSession(level, seedOrFn, opts) {
    opts = opts || {};
    const rnd = rngFrom(seedOrFn);
    const types = opts.types || shuffledTypes(rnd);
    const questions = [];
    const used = new Set();
    let distractorPlan = null;
    let identifyPlan = null;
    if (level === 'advanced') {
      identifyPlan = planIdentifySlots(types, rnd);
      const rest = [];
      types.forEach(function (s, i) { if (!identifyPlan[i]) rest.push(i); });
      const restCounts = [];
      for (let i = 0; i < rest.length; i++) restCounts.push(i < Math.ceil(rest.length / 2) ? 1 : 2);
      shuffle(restCounts, rnd);
      distractorPlan = types.map(function () { return 1; });
      rest.forEach(function (idx, j) { distractorPlan[idx] = restCounts[j]; });
    }

    for (let i = 0; i < types.length; i++) {
      const shape = types[i];
      const prev = questions[i - 1] || null;
      const wantIdentify = !!(identifyPlan && identifyPlan[i]);
      let q = null;
      let ok = false;
      for (let t = 0; t < 90; t++) {
        const morphOpts = {};
        const morphSource = wantIdentify ? identifyMorphs(shape, level) : morphsFor(shape, level);
        if (prev && prev.shape === shape) {
          const allowed = morphSource.filter(function (m) { return m !== prev.morph; });
          if (allowed.length) morphOpts.morph = pick(rnd, allowed);
        }
        if (distractorPlan) morphOpts.distractorCount = distractorPlan[i];
        if (wantIdentify) morphOpts.identifySides = true;
        q = generateQuestion(shape, level, rnd, morphOpts);
        if (wantIdentify && (!q || !q.identifySides)) continue;
        if (distractorPlan && !q.identifySides && (q.distractors || []).length !== distractorPlan[i]) continue;
        if (!validateQuestion(q)) continue;
        if (used.has(q.signature)) continue;
        if (prev && prev.shape === shape && (prev.morph === q.morph || prev.signature === q.signature)) continue;
        ok = true;
        break;
      }
      if (!ok) {
        /* last attempt: fall back to a regular (possibly non-identify) valid question */
        const fallback = { };
        if (distractorPlan) fallback.distractorCount = distractorPlan[i];
        q = generateQuestion(shape, level, rnd, fallback);
      }
      used.add(q.signature);
      q.index = i;
      questions.push(q);
    }
    return questions;
  }

  P5Area.rng = {
    mulberry32: mulberry32,
    rngFrom: rngFrom,
    randInt: randInt,
    pick: pick,
    shuffle: shuffle
  };
  P5Area.generator = {
    shuffleFormulas: shuffleFormulas,
    uniquePermuteKey: uniquePermuteKey,
    shuffledTypes: shuffledTypes,
    generateQuestion: generateQuestion,
    generateSession: generateSession,
    validateQuestion: validateQuestion,
    morphsFor: morphsFor,
    identifyMorphs: identifyMorphs,
    makeShape: makeShape,
    makeIdentifyShape: makeIdentifyShape,
    addDistractors: addDistractors,
    pruneAmbiguousDashed: pruneAmbiguousDashed,
    dashedSegsAmbiguous: dashedSegsAmbiguous,
    signatureOf: signatureOf
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P5Area;
})(typeof globalThis !== 'undefined' ? globalThis : this);
