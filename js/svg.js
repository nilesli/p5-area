/* 小五面積温習 · SVG 繪圖（程式繪製，無課本掃描） */
(function (global) {
  const P5Area = global.P5Area = global.P5Area || {};

  const VW = 440;
  const VH = 400;
  const MARGIN = 62;
  const VIEW_PAD = 8;
  const LABEL_GAP = 8;
  const LINE_GAP = 6;

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function mul(v, k) { return [v[0] * k, v[1] * k]; }
  function len(v) { return Math.hypot(v[0], v[1]); }
  function norm(v) {
    const L = len(v) || 1;
    return [v[0] / L, v[1] / L];
  }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }

  function collectPts(geo) {
    const pts = [];
    (geo.vertices || []).forEach(function (p) { pts.push(p); });
    if (geo.heightSeg) {
      pts.push(geo.heightSeg.a, geo.heightSeg.b);
      if (geo.heightSeg.extendBase) {
        pts.push(geo.heightSeg.extendBase[0], geo.heightSeg.extendBase[1]);
      }
    }
    (geo.dimensions || []).forEach(function (d) { pts.push(d.a, d.b); });
    (geo.extras || []).forEach(function (e) { pts.push(e.a, e.b); });
    return pts;
  }

  /* Math (y-up, cm) → SVG (y-down, fitted). */
  function makeTransform(geo, margin) {
    margin = margin == null ? MARGIN : margin;
    const pts = collectPts(geo);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (!p) return;
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    });
    if (!isFinite(minX)) {
      minX = 0; minY = 0; maxX = 10; maxY = 10;
    }
    /* Pad in cm-space so dimension lines have room after scale. */
    const padCm = 0.7;
    minX -= padCm; minY -= padCm; maxX += padCm; maxY += padCm;
    const w = Math.max(0.5, maxX - minX);
    const h = Math.max(0.5, maxY - minY);
    const innerW = VW - 2 * margin;
    const innerH = VH - 2 * margin;
    const scale = Math.min(innerW / w, innerH / h);
    const ox = margin + (innerW - w * scale) / 2;
    const oy = margin + (innerH - h * scale) / 2;
    function T(p) {
      return [
        ox + (p[0] - minX) * scale,
        VH - (oy + (p[1] - minY) * scale)
      ];
    }
    return { T: T, scale: scale };
  }

  function polyPoints(verts, T) {
    return verts.map(function (p) {
      const q = T(p);
      return q[0].toFixed(2) + ',' + q[1].toFixed(2);
    }).join(' ');
  }

  function lineEl(a, b, attrs) {
    let s = '<line x1="' + a[0].toFixed(2) + '" y1="' + a[1].toFixed(2) +
      '" x2="' + b[0].toFixed(2) + '" y2="' + b[1].toFixed(2) + '"';
    Object.keys(attrs).forEach(function (k) {
      s += ' ' + k + '="' + esc(attrs[k]) + '"';
    });
    return s + ' />';
  }

  function textEl(x, y, str, attrs, box) {
    let s = '<text x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '"';
    Object.keys(attrs).forEach(function (k) {
      s += ' ' + k + '="' + esc(attrs[k]) + '"';
    });
    if (box) {
      s += ' data-lw="' + box.w.toFixed(1) + '" data-lh="' + box.h.toFixed(1) + '"';
    }
    return s + '>' + esc(str) + '</text>';
  }

  function rightAngleMark(ra, T, scale, color) {
    if (!ra) return { svg: '', segs: [] };
    const size = Math.max(10, Math.min(18, 0.35 * scale));
    const c = T(ra.corner);
    const u = norm(ra.v1);
    const v = norm(ra.v2);
    const uS = [u[0], -u[1]];
    const vS = [v[0], -v[1]];
    const p1 = add(c, mul(uS, size));
    const p2 = add(p1, mul(vS, size));
    const p3 = add(c, mul(vS, size));
    const svg = '<polyline fill="none" stroke="' + color + '" stroke-width="2" points="' +
      p1[0].toFixed(2) + ',' + p1[1].toFixed(2) + ' ' +
      p2[0].toFixed(2) + ',' + p2[1].toFixed(2) + ' ' +
      p3[0].toFixed(2) + ',' + p3[1].toFixed(2) + '" />';
    return { svg: svg, segs: [[c, p1], [p1, p2], [p2, p3], [p3, c]] };
  }

  function isBaseRole(role) {
    return role === '底' || role === '上底' || role === '下底' || role === '長';
  }

  function isSameSeg(d, seg) {
    if (!d || !seg) return false;
    function near(p, q) {
      return Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.2;
    }
    return (near(d.a, seg.a) && near(d.b, seg.b)) || (near(d.a, seg.b) && near(d.b, seg.a));
  }

  function measureText(str, fontSize) {
    let w = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charAt(i);
      const code = ch.charCodeAt(0);
      if (ch === ' ') w += fontSize * 0.36;
      else if (code > 127) w += fontSize * 1.08;
      else if (ch >= '0' && ch <= '9') w += fontSize * 0.70;
      else w += fontSize * 0.80;
    }
    return { w: w + 5, h: fontSize * 1.28 + 3 };
  }

  function boxFromCenter(x, y, size) {
    return {
      x: x - size.w / 2,
      y: y - size.h / 2,
      w: size.w,
      h: size.h,
      cx: x,
      cy: y
    };
  }

  function inflate(box, g) {
    return { x: box.x - g, y: box.y - g, w: box.w + 2 * g, h: box.h + 2 * g };
  }

  function boxesOverlap(a, b, gap) {
    const A = inflate(a, gap / 2);
    const B = inflate(b, gap / 2);
    return A.x < B.x + B.w && A.x + A.w > B.x && A.y < B.y + B.h && A.y + A.h > B.y;
  }

  function boxInView(box, pad) {
    pad = pad == null ? VIEW_PAD : pad;
    return box.x >= pad && box.y >= pad && box.x + box.w <= VW - pad && box.y + box.h <= VH - pad;
  }

  function distPtSeg(p, a, b) {
    const ab = sub(b, a);
    const L2 = ab[0] * ab[0] + ab[1] * ab[1];
    if (L2 < 1e-9) return len(sub(p, a));
    let t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2;
    t = Math.max(0, Math.min(1, t));
    return len(sub(p, [a[0] + t * ab[0], a[1] + t * ab[1]]));
  }

  function pointInRect(p, box) {
    return p[0] >= box.x && p[0] <= box.x + box.w && p[1] >= box.y && p[1] <= box.y + box.h;
  }

  function orient(a, b, c) {
    const v = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
    if (Math.abs(v) < 1e-9) return 0;
    return v > 0 ? 1 : 2;
  }

  function onSeg(a, b, c) {
    return Math.min(a[0], b[0]) - 1e-6 <= c[0] && c[0] <= Math.max(a[0], b[0]) + 1e-6 &&
      Math.min(a[1], b[1]) - 1e-6 <= c[1] && c[1] <= Math.max(a[1], b[1]) + 1e-6;
  }

  function segsIntersect(p1, q1, p2, q2) {
    const o1 = orient(p1, q1, p2);
    const o2 = orient(p1, q1, q2);
    const o3 = orient(p2, q2, p1);
    const o4 = orient(p2, q2, q1);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSeg(p1, q1, p2)) return true;
    if (o2 === 0 && onSeg(p1, q1, q2)) return true;
    if (o3 === 0 && onSeg(p2, q2, p1)) return true;
    if (o4 === 0 && onSeg(p2, q2, q1)) return true;
    return false;
  }

  function distPtRect(p, box) {
    const cx = Math.max(box.x, Math.min(p[0], box.x + box.w));
    const cy = Math.max(box.y, Math.min(p[1], box.y + box.h));
    return Math.hypot(p[0] - cx, p[1] - cy);
  }

  function segHitsRect(a, b, box) {
    if (pointInRect(a, box) || pointInRect(b, box)) return true;
    const x2 = box.x + box.w, y2 = box.y + box.h;
    return segsIntersect(a, b, [box.x, box.y], [x2, box.y]) ||
      segsIntersect(a, b, [x2, box.y], [x2, y2]) ||
      segsIntersect(a, b, [x2, y2], [box.x, y2]) ||
      segsIntersect(a, b, [box.x, y2], [box.x, box.y]);
  }

  function distBoxSeg(box, a, b) {
    if (segHitsRect(a, b, box)) return 0;
    const corners = [
      [box.x, box.y], [box.x + box.w, box.y],
      [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]
    ];
    let d = Infinity;
    for (let i = 0; i < 4; i++) d = Math.min(d, distPtSeg(corners[i], a, b));
    d = Math.min(d, distPtRect(a, box), distPtRect(b, box));
    return d;
  }

  function svgOutward(d) {
    const a = d._a, b = d._b;
    const along = sub(b, a);
    let n = d.outward ? [d.outward[0], -d.outward[1]] : [-along[1], along[0]];
    return norm(n);
  }

  function formatDimLabel(d, showRoles) {
    const unit = P5Area.UNIT;
    const num = d.value + ' ' + unit;
    if (showRoles && d.role && !d.isDistractor) return d.role + ' ' + num;
    return num;
  }

  function dimColor(d, reveal) {
    if (reveal && !d.isDistractor && isBaseRole(d.role)) return P5Area.COLOR_BASE;
    if (reveal && !d.isDistractor && d.role === '高') return P5Area.COLOR_HEIGHT;
    return P5Area.COLOR_DIM;
  }

  function dimClass(d, reveal) {
    if (reveal && !d.isDistractor && isBaseRole(d.role)) return P5Area.CLASS_BASE;
    if (reveal && !d.isDistractor && d.role === '高') return P5Area.CLASS_HEIGHT;
    return '';
  }

  function fontFor() {
    return 'Noto Sans CJK TC, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif';
  }

  function buildBracket(a, b, n, offset) {
    const a2 = add(a, mul(n, offset));
    const b2 = add(b, mul(n, offset));
    const tick = 6;
    const u = norm(sub(b, a));
    const segs = [
      [a, a2],
      [b, b2],
      [a2, b2],
      [add(a2, mul(u, -tick / 2)), add(a2, mul(u, tick / 2))],
      [add(b2, mul(u, -tick / 2)), add(b2, mul(u, tick / 2))]
    ];
    return { a2: a2, b2: b2, segs: segs };
  }

  function pointInPoly(pt, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
      const xi = verts[i][0], yi = verts[i][1];
      const xj = verts[j][0], yj = verts[j][1];
      const denom = (yj - yi) || 1e-12;
      const intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
        (pt[0] < (xj - xi) * (pt[1] - yi) / denom + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function scoreCandidate(box, prefer, segs, boxes, ownSegs, labelGap, lineGap, extra) {
    extra = extra || {};
    if (!boxInView(box)) return { hard: true, score: 1e9 };
    let i;
    for (i = 0; i < boxes.length; i++) {
      if (boxesOverlap(box, boxes[i], labelGap)) return { hard: true, score: 1e8 };
    }
    let score = 0;
    if (prefer) score += 0.12 * Math.hypot(box.cx - prefer[0], box.cy - prefer[1]);
    function consider(seg, isOwn) {
      const d = distBoxSeg(box, seg[0], seg[1]);
      const need = isOwn ? Math.max(4, lineGap - 1) : lineGap;
      if (d < need) score += 180 + (need - d) * 24;
      else if (d < need + 6) score += (need + 6 - d) * 2;
    }
    for (i = 0; i < segs.length; i++) consider(segs[i], false);
    if (ownSegs) {
      for (i = 0; i < ownSegs.length; i++) consider(ownSegs[i], true);
    }
    if (extra.preferOutsideVerts && pointInPoly([box.cx, box.cy], extra.preferOutsideVerts)) {
      score += 520;
    }
    if (extra.flipPenalty) score += extra.flipPenalty;
    if (extra.anchorSeg) {
      const dAnchor = distPtSeg([box.cx, box.cy], extra.anchorSeg[0], extra.anchorSeg[1]);
      const maxD = extra.anchorMax != null ? extra.anchorMax : 46;
      if (dAnchor > maxD) score += (dAnchor - maxD) * 14;
    }
    return { hard: score >= 180, score: score };
  }

  function pickPlacement(cands, segs, boxes, labelGap, lineGap) {
    let best = null;
    let i;
    for (i = 0; i < cands.length; i++) {
      const c = cands[i];
      const ev = scoreCandidate(c.box, c.prefer, segs, boxes, c.ownSegs, labelGap, lineGap, c.extra);
      c._ev = ev;
      if (!best || ev.score < best._ev.score) best = c;
    }
    /* Prefer a non-hard collision if any exist. */
    let bestSoft = null;
    for (i = 0; i < cands.length; i++) {
      if (!cands[i]._ev.hard && (!bestSoft || cands[i]._ev.score < bestSoft._ev.score)) {
        bestSoft = cands[i];
      }
    }
    return bestSoft || best;
  }

  function alongCandidates(a, b, n, size, prefer, ownSegs, compact) {
    const out = [];
    const ts = [0.50, 0.38, 0.62, 0.28, 0.72, 0.22, 0.78, 0.16, 0.84, 0.44, 0.56, 0.34, 0.66, 0.12, 0.88, -0.08, 1.08, -0.18, 1.18];
    const dists = compact
      ? [10, 13, 16, 20, 24, 28, 34, 40, 48, 56, 68, 8]
      : [14, 18, 12, 22, 26, 32, 38, 46, 54, 64, 76, 88, 10];
    const signs = [1, -1];
    let ti, di, si;
    for (ti = 0; ti < ts.length; ti++) {
      const p = add(a, mul(sub(b, a), ts[ti]));
      for (si = 0; si < 2; si++) {
        const nn = mul(n, signs[si]);
        for (di = 0; di < dists.length; di++) {
          const pos = add(p, mul(nn, dists[di]));
          out.push({
            pos: pos,
            box: boxFromCenter(pos[0], pos[1], size),
            prefer: prefer,
            ownSegs: ownSegs,
            offset: dists[di],
            sign: signs[si],
            t: ts[ti]
          });
        }
      }
    }
    return out;
  }

  function edgeCandidates(a, b, n, size, compact, prefer, polyVerts) {
    const out = [];
    const offsets = compact
      ? [18, 22, 26, 30, 34, 14, 40, 48, 58]
      : [24, 28, 22, 32, 36, 18, 42, 50, 58, 68];
    const lifts = compact ? [10, 13, 16, 20, 24, 30, 8] : [12, 16, 20, 24, 28, 10, 34, 44];
    const ts = [0.50, 0.38, 0.62, 0.28, 0.72, 0.20, 0.80, 0.14, 0.86];
    const signs = [1, -1];
    let oi, li, ti, si;
    for (si = 0; si < 2; si++) {
      const nn = mul(n, signs[si]);
      for (oi = 0; oi < offsets.length; oi++) {
        const br = buildBracket(a, b, nn, offsets[oi]);
        for (ti = 0; ti < ts.length; ti++) {
          const p0 = add(br.a2, mul(sub(br.b2, br.a2), ts[ti]));
          for (li = 0; li < lifts.length; li++) {
            const pos = add(p0, mul(nn, lifts[li]));
            out.push({
              pos: pos,
              box: boxFromCenter(pos[0], pos[1], size),
              prefer: prefer || add(mid(br.a2, br.b2), mul(n, compact ? 12 : 14)),
              ownSegs: br.segs.concat([[a, b]]),
              bracket: br,
              offset: offsets[oi],
              sign: signs[si],
              t: ts[ti],
              extra: {
                preferOutsideVerts: polyVerts || null,
                flipPenalty: signs[si] < 0 ? 260 : 0
              }
            });
          }
        }
      }
    }
    return out;
  }

  /**
   * @param {object} geo
   * @param {object} opts
   *   reveal: boolean — apply blue/red AND role names only when true
   *   showRoleLabels: ignored during answering; roles always appear on reveal
   *   compact: tighter layout for results review
   */
  function render(geo, opts) {
    opts = opts || {};
    const reveal = !!opts.reveal;
    const compact = !!opts.compact;
    /* Answering figures: numbers + units only. Role names only after reveal. */
    const showRoles = reveal;
    const C = P5Area;
    const tr = makeTransform(geo, compact ? 46 : MARGIN);
    const T = tr.T;
    const parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH +
      '" width="100%" height="100%" role="img" aria-label="' + esc(opts.ariaLabel || '面積圖形') + '">');
    parts.push('<rect width="' + VW + '" height="' + VH + '" fill="#ffffff" />');

    parts.push('<polygon points="' + polyPoints(geo.vertices, T) +
      '" fill="' + C.COLOR_FILL + '" stroke="' + C.COLOR_STROKE +
      '" stroke-width="2.6" stroke-linejoin="round" />');

    (geo.extras || []).forEach(function (e) {
      parts.push(lineEl(T(e.a), T(e.b), {
        stroke: C.COLOR_EXTRA,
        'stroke-width': '2.2',
        'stroke-dasharray': e.dashed ? '6 4' : '8 5',
        'stroke-linecap': 'round'
      }));
    });

    if (geo.heightSeg && geo.heightSeg.exterior && geo.heightSeg.extendBase) {
      parts.push(lineEl(T(geo.heightSeg.extendBase[0]), T(geo.heightSeg.extendBase[1]), {
        stroke: C.COLOR_HEIGHT_NEUTRAL,
        'stroke-width': '1.6',
        'stroke-dasharray': '5 4'
      }));
    }

    if (geo.heightSeg) {
      const hAttrs = reveal
        ? { stroke: C.COLOR_HEIGHT, 'stroke-width': '4', 'stroke-linecap': 'round', 'class': C.CLASS_HEIGHT }
        : { stroke: C.COLOR_HEIGHT_NEUTRAL, 'stroke-width': '2.2', 'stroke-dasharray': '7 5', 'stroke-linecap': 'round' };
      parts.push(lineEl(T(geo.heightSeg.a), T(geo.heightSeg.b), hAttrs));
    }

    if (reveal) {
      (geo.bases || []).forEach(function (b) {
        parts.push(lineEl(T(b.a), T(b.b), {
          stroke: C.COLOR_BASE,
          'stroke-width': '4.5',
          'stroke-linecap': 'round',
          'class': C.CLASS_BASE
        }));
      });
    }

    const raMark = rightAngleMark(
      geo.rightAngle,
      T,
      tr.scale,
      reveal ? C.COLOR_HEIGHT : C.COLOR_STROKE
    );
    parts.push(raMark.svg);

    /* ---- label layout ---- */
    const baseSegs = [];
    const verts = (geo.vertices || []).map(T);
    for (let i = 0; i < verts.length; i++) {
      baseSegs.push([verts[i], verts[(i + 1) % verts.length]]);
    }
    (geo.extras || []).forEach(function (e) { baseSegs.push([T(e.a), T(e.b)]); });
    if (geo.heightSeg) baseSegs.push([T(geo.heightSeg.a), T(geo.heightSeg.b)]);
    if (geo.heightSeg && geo.heightSeg.extendBase) {
      baseSegs.push([T(geo.heightSeg.extendBase[0]), T(geo.heightSeg.extendBase[1])]);
    }
    raMark.segs.forEach(function (s) { baseSegs.push(s); });

    const rawDims = (geo.dimensions || []).map(function (d, idx) {
      const local = Object.assign({}, d);
      local._a = T(d.a);
      local._b = T(d.b);
      local._idx = idx;
      if (reveal && d.role === '邊長') {
        if (isSameSeg(d, geo.heightSeg)) local.role = '高';
        else if ((geo.bases || []).some(function (b) { return isSameSeg(d, b); })) local.role = '底';
      }
      local._isHeight = isSameSeg(d, geo.heightSeg);
      /* Interior auxiliaries (not on a polygon edge): mid-edge in-shape marks, no bracket.
         Height already has a visible altitude line, so we also label it without a second bracket. */
      local._inline = !!(d.isDistractor && d.inline !== false && !d.onEdge) || local._isHeight;
      local._label = formatDimLabel(local, showRoles);
      local._font = compact
        ? (d.isDistractor ? 11 : 12)
        : (d.isDistractor ? 13 : 14);
      local._size = measureText(local._label, local._font);
      local._n = svgOutward(local);
      local._color = dimColor(local, reveal);
      local._cls = dimClass(local, reveal);
      return local;
    });

    const labelGap = compact ? 6 : LABEL_GAP;
    const lineGap = compact ? 5 : LINE_GAP;

    function bracketInView(br) {
      function ok(p) {
        return p[0] >= VIEW_PAD && p[1] >= VIEW_PAD && p[0] <= VW - VIEW_PAD && p[1] <= VH - VIEW_PAD;
      }
      return ok(br.a2) && ok(br.b2);
    }

    /* Commit a default outward bracket for every edge dimension first, so
       inline / height labels can steer clear of leader lines. */
    rawDims.forEach(function (d) {
      if (d._inline || len(sub(d._b, d._a)) < 1e-3) return;
      const offsets = compact ? [20, 16, 24, 28, 14, 32] : [26, 22, 30, 18, 34, 40];
      let chosen = null;
      let s, o;
      const signs = [1, -1];
      for (s = 0; s < signs.length && !chosen; s++) {
        const nn = mul(d._n, signs[s]);
        for (o = 0; o < offsets.length; o++) {
          const br = buildBracket(d._a, d._b, nn, offsets[o]);
          if (bracketInView(br)) {
            chosen = { bracket: br, n: nn, offset: offsets[o], sign: signs[s] };
            break;
          }
        }
      }
      if (!chosen) {
        chosen = {
          bracket: buildBracket(d._a, d._b, d._n, compact ? 20 : 26),
          n: d._n, offset: compact ? 20 : 26, sign: 1
        };
      }
      d._prefN = chosen.n;
      d._prefOffset = chosen.offset;
      d._prefBracket = chosen.bracket;
    });

    function currentSegs(ignoreIdx) {
      const s = baseSegs.slice();
      rawDims.forEach(function (d, i) {
        if (i === ignoreIdx) return;
        const p = placements[i];
        const br = (p && p.bracket) || d._prefBracket;
        if (br) br.segs.forEach(function (seg) { s.push(seg); });
      });
      return s;
    }

    function candidatesFor(d) {
      if (d._inline) {
        const prefer = add(mid(d._a, d._b), mul(d._n, compact ? 14 : 18));
        const cands = alongCandidates(d._a, d._b, d._n, d._size, prefer, [[d._a, d._b]], compact);
        if (d._isHeight) {
          cands.forEach(function (c) {
            c.extra = { anchorSeg: [d._a, d._b], anchorMax: compact ? 40 : 48 };
          });
        }
        return cands;
      }
      const n = d._prefN || d._n;
      const prefer = add(mid(d._a, d._b), mul(n, (d._prefOffset || (compact ? 20 : 26)) + 14));
      return edgeCandidates(d._a, d._b, n, d._size, compact, prefer, verts);
    }

    /* Edge labels keep their natural outside homes first; height and
       interior auxiliaries then fill remaining pockets. */
    const order = rawDims.map(function (d, i) { return i; });
    order.sort(function (ia, ib) {
      const a = rawDims[ia], b = rawDims[ib];
      function rank(d) {
        if (!d._inline) return 0;
        if (d._isHeight) return 1;
        return 2;
      }
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return len(sub(a._a, a._b)) - len(sub(b._a, b._b));
    });

    const placements = new Array(rawDims.length);
    const placedBoxes = [];

    function boxesExcept(idx) {
      const out = [];
      for (let i = 0; i < placements.length; i++) {
        if (i === idx || !placements[i]) continue;
        out.push(placements[i].box);
      }
      return out;
    }

    function applyPick(idx, picked) {
      placements[idx] = picked;
    }

    order.forEach(function (idx) {
      const d = rawDims[idx];
      if (len(sub(d._b, d._a)) < 1e-3) {
        placements[idx] = null;
        return;
      }
      const picked = pickPlacement(candidatesFor(d), currentSegs(idx), boxesExcept(idx), labelGap, lineGap);
      applyPick(idx, picked);
    });

    /* Repair: earlier labels did not see later boxes; nudge anything still colliding. */
    function hasHard(idx) {
      const p = placements[idx];
      if (!p) return false;
      const ev = scoreCandidate(p.box, p.prefer, currentSegs(idx), boxesExcept(idx), p.ownSegs, labelGap, lineGap, p.extra);
      return ev.hard;
    }
    let pass;
    for (pass = 0; pass < 4; pass++) {
      let moved = false;
      order.forEach(function (idx) {
        if (!hasHard(idx)) return;
        const d = rawDims[idx];
        if (!d || len(sub(d._b, d._a)) < 1e-3) return;
        const picked = pickPlacement(candidatesFor(d), currentSegs(idx), boxesExcept(idx), labelGap, lineGap);
        if (picked) {
          applyPick(idx, picked);
          moved = true;
        }
      });
      if (!moved) break;
    }

    const layoutLabels = [];
    const allSegsForAudit = currentSegs(-1);
    rawDims.forEach(function (d, idx) {
      const p = placements[idx];
      if (!p) return;
      layoutLabels.push({
        text: d._label,
        role: d.role || '',
        box: p.box,
        isDistractor: !!d.isDistractor,
        ownSegs: p.ownSegs || []
      });
    });

    /* Draw committed brackets then labels. */
    rawDims.forEach(function (d, idx) {
      const p = placements[idx];
      if (!p) return;
      const attrs = { stroke: d._color, 'stroke-width': '1.4', fill: 'none' };
      if (d._cls) attrs['class'] = d._cls;
      if (p.bracket) {
        p.bracket.segs.forEach(function (s) { parts.push(lineEl(s[0], s[1], attrs)); });
      }
      const textAttrs = {
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': String(d._font),
        'font-weight': '700',
        fill: d._color,
        'font-family': fontFor()
      };
      if (d._cls) textAttrs['class'] = d._cls;
      parts.push(textEl(p.pos[0], p.pos[1], d._label, textAttrs, p.box));
    });

    parts.push('</svg>');
    const svg = parts.join('');

    /* Record layout for tests / audit. */
    const collisions = findCollisions(layoutLabels, allSegsForAudit, labelGap, lineGap);
    P5Area.svg.lastLayout = {
      labels: layoutLabels,
      collisions: collisions,
      viewBox: [VW, VH]
    };
    return svg;
  }

  function isOwnSeg(label, seg) {
    const own = label.ownSegs || [];
    function near(p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.8; }
    for (let i = 0; i < own.length; i++) {
      const o = own[i];
      if ((near(o[0], seg[0]) && near(o[1], seg[1])) || (near(o[0], seg[1]) && near(o[1], seg[0]))) {
        return true;
      }
    }
    return false;
  }

  function findCollisions(labels, segs, labelGap, lineGap) {
    const out = [];
    let i, j;
    for (i = 0; i < labels.length; i++) {
      if (!boxInView(labels[i].box)) {
        out.push({ type: 'clip', a: labels[i].text });
      }
      for (j = i + 1; j < labels.length; j++) {
        if (boxesOverlap(labels[i].box, labels[j].box, labelGap)) {
          out.push({ type: 'label', a: labels[i].text, b: labels[j].text });
        }
      }
      for (j = 0; j < segs.length; j++) {
        if (isOwnSeg(labels[i], segs[j])) continue;
        const d = distBoxSeg(labels[i].box, segs[j][0], segs[j][1]);
        if (d < lineGap - 0.5) {
          out.push({
            type: 'line',
            a: labels[i].text,
            dist: Math.round(d * 10) / 10
          });
        }
      }
    }
    return out;
  }

  function svgTextContent(svgString) {
    const s = svgString || '';
    const out = [];
    const re = /<text\b[^>]*>([^<]*)<\/text>/g;
    let m;
    while ((m = re.exec(s))) out.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));
    return out;
  }

  function hasRoleNameInText(svgString) {
    const texts = svgTextContent(svgString);
    const roles = ['上底', '下底', '邊長', '底', '高', '長', '闊'];
    for (let i = 0; i < texts.length; i++) {
      for (let r = 0; r < roles.length; r++) {
        if (texts[i].indexOf(roles[r]) !== -1) return true;
      }
    }
    return false;
  }

  function hasRevealColors(svgString) {
    const s = svgString || '';
    return s.indexOf(P5Area.COLOR_BASE) !== -1 ||
      s.indexOf(P5Area.COLOR_HEIGHT) !== -1 ||
      s.indexOf(P5Area.CLASS_BASE) !== -1 ||
      s.indexOf(P5Area.CLASS_HEIGHT) !== -1;
  }

  P5Area.svg = {
    render: render,
    hasRevealColors: hasRevealColors,
    hasRoleNameInText: hasRoleNameInText,
    svgTextContent: svgTextContent,
    VW: VW,
    VH: VH
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P5Area;
})(typeof globalThis !== 'undefined' ? globalThis : this);
