/* 小五面積温習 · 評分 */
(function (global) {
  const P5Area = global.P5Area = global.P5Area || {};

  function toInt(v) {
    if (v === '' || v == null) return null;
    const s = String(v).trim();
    if (!/^\d+$/.test(s)) return null;
    return parseInt(s, 10);
  }

  function neededValues(q) {
    const m = q.measurements || {};
    const vals = [];
    Object.keys(m).forEach(function (k) {
      if (typeof m[k] === 'number') vals.push(m[k]);
    });
    return vals;
  }

  function distractorValues(q) {
    return (q.distractors || []).map(function (d) { return d.value; });
  }

  function usesDistractor(q, nums) {
    const needed = neededValues(q);
    const ds = distractorValues(q);
    return Object.keys(nums).some(function (k) {
      const v = nums[k];
      if (v == null) return false;
      const isD = ds.indexOf(v) !== -1;
      const isNeeded = needed.indexOf(v) !== -1;
      return isD && !isNeeded;
    });
  }

  const FILL_OK_MSG = '數據填對了！這題不用計算出最後答案。';
  const FILL_OK_RIGHT_LEGS_MSG = '數據填對了！直角三角形中，形成直角的兩條邊都可以做底或高。這題不用計算出最後答案。';
  const FILL_SWAP_MSG = '底和高調轉了。高必須垂直於所選的底；請看清楚圖中與底垂直、帶直角標記的那一段，才是這條底對應的高。';
  const FILL_HYPOTENUSE_MSG = '不能用斜邊配一條直角邊來當底和高。直角三角形中，形成直角的兩條邊都可以做底或高。';
  const FILL_WRONG_NUM_MSG = '這個數不是正確公式要用的數據（可能是斜邊、腰、對角線或多餘數據）。';

  function almostEq(a, b, eps) {
    return Math.abs(a - b) < (eps == null ? 1e-6 : eps);
  }

  function ptDist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function intIfExact(x) {
    if (x == null || !isFinite(x)) return null;
    const n = Math.round(x);
    return almostEq(x, n, 0.03) ? n : null;
  }

  /* Right triangle: the two legs that form the right angle may each be 底, with the other as 對應高. */
  function rightTriangleInfo(question) {
    if (!question || question.shape !== 'triangle') return null;
    const v = question.geometry && question.geometry.vertices;
    if (v && v.length === 3) {
      for (let k = 0; k < 3; k++) {
        const P = v[k];
        const Q = v[(k + 1) % 3];
        const R = v[(k + 2) % 3];
        const ux = Q[0] - P[0], uy = Q[1] - P[1];
        const wx = R[0] - P[0], wy = R[1] - P[1];
        const lu = Math.hypot(ux, uy);
        const lw = Math.hypot(wx, wy);
        if (lu < 1e-9 || lw < 1e-9) continue;
        if (Math.abs((ux * wx + uy * wy) / (lu * lw)) < 0.02) {
          const hyp = ptDist(Q, R);
          return {
            legs: [lu, lw],
            hypotenuse: hyp,
            altitudeToHyp: (lu * lw) / hyp
          };
        }
      }
    }
    if (String(question.morph || '').indexOf('right') === 0) {
      const a = question.measurements && question.measurements.base;
      const b = question.measurements && question.measurements.height;
      if (typeof a === 'number' && typeof b === 'number') {
        const hyp = Math.sqrt(a * a + b * b);
        return { legs: [a, b], hypotenuse: hyp, altitudeToHyp: (a * b) / hyp };
      }
    }
    return null;
  }

  function isRightTriangle(question) {
    return rightTriangleInfo(question) != null;
  }

  function labeledInts(question) {
    const out = [];
    const m = question.measurements || {};
    Object.keys(m).forEach(function (k) {
      if (typeof m[k] === 'number') out.push(m[k]);
    });
    (question.geometry && question.geometry.dimensions || []).forEach(function (d) {
      if (typeof d.value === 'number' && out.indexOf(d.value) === -1) out.push(d.value);
    });
    return out;
  }

  function checkFormula(shape, chosenLabel) {
    const correct = P5Area.FORMULA_BY_SHAPE[shape];
    const ok = chosenLabel === correct;
    let reason = ok ? 'ok' : 'wrong-formula';
    if (shape === 'square' && chosenLabel === '長×闊') reason = 'square-as-rectangle';
    else if (shape === 'triangle' && chosenLabel === '底×高') reason = 'triangle-no-half';
    else if (shape === 'trapezium' && (chosenLabel === '底×高' || chosenLabel === '底×高÷2')) {
      reason = 'trapezium-wrong-form';
    }
    return { ok: ok, reason: reason, correct: correct };
  }

  /* values: map of blank id -> string/number */

  const FILL_EMPTY_EXPR_MSG = '請把所有數字空格和運算符號都填上。';
  const FILL_MISSING_HALF_MSG = '算式要包含 ÷2。三角形和梯形的面積都要除以 2。';
  const FILL_WRONG_HALF_MSG = '不能用 ×2 代替 ÷2，也不能把 2 配在錯誤的運算位置。';
  const FILL_WRONG_OP_MSG = '運算符號不正確。請按正確公式填上 ＋、－、× 或 ÷。';

  function normalizeOp(op) {
    if (op == null) return null;
    const s = String(op).trim();
    if (s === '') return null;
    if (s === '+' || s === '＋') return '＋';
    if (s === '-' || s === '－' || s === '−' || s === '–') return '－';
    if (s === '*' || s === 'x' || s === 'X' || s === '×' || s === '⋅' || s === '·') return '×';
    if (s === '/' || s === '÷' || s === ':') return '÷';
    return null;
  }

  function isFillExpression(values) {
    return !!(values && Array.isArray(values.nums) && Array.isArray(values.ops));
  }

  function expressionSpec(shape) {
    if (shape === 'square') return { numHints: ['邊長', '邊長'], opCount: 1, parens: false };
    if (shape === 'rectangle') return { numHints: ['長', '闊'], opCount: 1, parens: false };
    if (shape === 'parallelogram') return { numHints: ['底', '高'], opCount: 1, parens: false };
    if (shape === 'triangle') return { numHints: ['底', '高', '2'], opCount: 2, parens: false };
    return { numHints: ['上底', '下底', '高', '2'], opCount: 3, parens: true };
  }

  function correctFillExpression(question) {
    const m = question.measurements || {};
    if (question.shape === 'square') return { nums: [m.side, m.side], ops: ['×'] };
    if (question.shape === 'rectangle') return { nums: [m.length, m.width], ops: ['×'] };
    if (question.shape === 'parallelogram') return { nums: [m.base, m.height], ops: ['×'] };
    if (question.shape === 'triangle') return { nums: [m.base, m.height, 2], ops: ['×', '÷'] };
    return { nums: [m.topBase, m.bottomBase, m.height, 2], ops: ['＋', '×', '÷'] };
  }

  function formatExpression(shape, expr) {
    if (!expr || !expr.nums || !expr.ops) return '';
    function n(i) {
      const v = expr.nums[i];
      return (v == null || v === '') ? '□' : String(v);
    }
    function o(i) {
      const v = expr.ops[i];
      return v ? String(v) : '○';
    }
    let body;
    if (shape === 'trapezium') {
      body = '（' + n(0) + ' ' + o(0) + ' ' + n(1) + '）' + o(1) + ' ' + n(2) + ' ' + o(2) + ' ' + n(3);
    } else if (shape === 'triangle') {
      body = n(0) + ' ' + o(0) + ' ' + n(1) + ' ' + o(1) + ' ' + n(2);
    } else {
      body = n(0) + ' ' + o(0) + ' ' + n(1);
    }
    return '面積 ＝ ' + body + '（cm²）';
  }

  /* Convert a role-keyed fill (舊模板) into an expression with canonical operators.
     Used by the new fill UI / previews, not by checkFill's legacy path. */
  function legacyValuesToExpression(question, values) {
    if (isFillExpression(values)) {
      return { nums: values.nums.slice(), ops: values.ops.slice() };
    }
    const expr = correctFillExpression(question);
    const nums = expr.nums.slice();
    fillBlanks(question.shape).forEach(function (b, i) {
      if (values && values[b.id] != null && values[b.id] !== '') nums[i] = values[b.id];
    });
    return { nums: nums, ops: expr.ops.slice() };
  }

  function parseExpr(values) {
    const nums = (values.nums || []).map(function (v) {
      if (v === '' || v == null) return null;
      if (typeof v === 'number' && isFinite(v) && Math.round(v) === v) return v;
      return toInt(v);
    });
    const ops = (values.ops || []).map(normalizeOp);
    return { nums: nums, ops: ops };
  }

  function exprIsEmpty(spec, parsed) {
    if (parsed.nums.length !== spec.numHints.length) return true;
    if (parsed.ops.length !== spec.opCount) return true;
    if (parsed.nums.some(function (n) { return n == null; })) return true;
    if (parsed.ops.some(function (o) { return o == null; })) return true;
    return false;
  }

  function pairEq(a, b, x, y) {
    return (a === x && b === y) || (a === y && b === x);
  }

  function hasDivideByTwo(nums, ops) {
    for (let i = 0; i < ops.length; i++) {
      if (ops[i] === '÷' && nums[i + 1] === 2) return true;
    }
    return false;
  }

  function timesTwoAsRight(nums, ops) {
    for (let i = 0; i < ops.length; i++) {
      if (ops[i] === '×' && nums[i + 1] === 2) return true;
    }
    return false;
  }

  function exprUsesDistractor(question, nums, ops) {
    const needed = neededValues(question);
    const ds = distractorValues(question);
    const halfIdx = [];
    (ops || []).forEach(function (o, i) {
      if (o === '÷' && nums[i + 1] === 2) halfIdx.push(i + 1);
    });
    return nums.some(function (v, i) {
      if (v == null) return false;
      if (halfIdx.indexOf(i) !== -1) return false;
      if (needed.indexOf(v) !== -1) return false;
      return ds.indexOf(v) !== -1;
    });
  }

  function halfFailReason(nums, ops) {
    if (hasDivideByTwo(nums, ops) ) return null;
    if (timesTwoAsRight(nums, ops)) return 'wrong-half';
    return 'missing-half';
  }

  function halfFailResult(reason, parsed) {
    if (reason === 'wrong-half') {
      return { ok: false, reason: 'wrong-half', message: FILL_WRONG_HALF_MSG, nums: parsed.nums, ops: parsed.ops };
    }
    return { ok: false, reason: 'missing-half', message: FILL_MISSING_HALF_MSG, nums: parsed.nums, ops: parsed.ops };
  }

  function matchTimesHalfForm(n0, o0, n1, o1, n2, B, H) {
    if (o0 === '×' && o1 === '÷' && n2 === 2 && pairEq(n0, n1, B, H)) {
      return { ok: true, swapped: n0 === H && n1 === B };
    }
    if (o0 === '÷' && o1 === '×' && n1 === 2 && pairEq(n0, n2, B, H)) {
      return { ok: true, swapped: n0 === H };
    }
    return null;
  }

  function matchTrapForm(nums, ops, T, B, H) {
    const n0 = nums[0], n1 = nums[1], n2 = nums[2], n3 = nums[3];
    const o0 = ops[0], o1 = ops[1], o2 = ops[2];
    if (o0 !== '＋') return null;
    if (!pairEq(n0, n1, T, B)) return null;
    if (o1 === '×' && n2 === H && o2 === '÷' && n3 === 2) {
      return { ok: true, swapped: n0 === B && n1 === T };
    }
    if (o1 === '÷' && n2 === 2 && o2 === '×' && n3 === H) {
      return { ok: true, swapped: n0 === B && n1 === T };
    }
    return null;
  }

  function checkFillExpression(question, values) {
    const shape = question.shape;
    const m = question.measurements || {};
    const spec = expressionSpec(shape);
    const parsed = parseExpr(values);
    if (exprIsEmpty(spec, parsed)) {
      return { ok: false, reason: 'empty', message: FILL_EMPTY_EXPR_MSG };
    }
    const nums = parsed.nums;
    const ops = parsed.ops;

    if (shape === 'square') {
      if (ops[0] !== '×') {
        return { ok: false, reason: 'wrong-operator', message: FILL_WRONG_OP_MSG, nums: nums, ops: ops };
      }
      if (nums[0] !== nums[1]) {
        return { ok: false, reason: 'square-unequal', message: '兩個空格都應該填同一條邊長。', nums: nums, ops: ops };
      }
      if (nums[0] === m.side && nums[1] === m.side) {
        return { ok: true, reason: 'ok', message: FILL_OK_MSG, nums: nums, ops: ops };
      }
      return { ok: false, reason: 'wrong-number', message: FILL_WRONG_NUM_MSG, nums: nums, ops: ops };
    }

    if (shape === 'rectangle') {
      if (ops[0] !== '×') {
        return { ok: false, reason: 'wrong-operator', message: FILL_WRONG_OP_MSG, nums: nums, ops: ops };
      }
      if (pairEq(nums[0], nums[1], m.length, m.width)) {
        const swapped = nums[0] === m.width && nums[1] === m.length;
        return { ok: true, reason: 'ok', message: FILL_OK_MSG, nums: nums, ops: ops, swapped: swapped && !(nums[0] === m.length && nums[1] === m.width) };
      }
      return { ok: false, reason: 'wrong-number', message: FILL_WRONG_NUM_MSG, nums: nums, ops: ops };
    }

    if (shape === 'parallelogram') {
      if (exprUsesDistractor(question, nums, ops)) {
        return { ok: false, reason: 'distractor', message: '這個數是多餘數據，正確公式用不上它。', nums: nums, ops: ops };
      }
      if (ops[0] === '×' && pairEq(nums[0], nums[1], m.base, m.height)) {
        const swapped = nums[0] === m.height && nums[1] === m.base;
        return { ok: true, reason: 'ok', message: FILL_OK_MSG, nums: nums, ops: ops, swapped: !!swapped };
      }
      if (pairEq(nums[0], nums[1], m.base, m.height) && ops[0] !== '×') {
        return { ok: false, reason: 'wrong-operator', message: FILL_WRONG_OP_MSG, nums: nums, ops: ops };
      }
      return { ok: false, reason: 'wrong-number', message: FILL_WRONG_NUM_MSG, nums: nums, ops: ops };
    }

    if (shape === 'triangle') {
      const rt = rightTriangleInfo(question);
      const pairs = [[m.base, m.height, 'canonical']];
      if (rt) {
        const legA = intIfExact(rt.legs[0]);
        const legB = intIfExact(rt.legs[1]);
        if (legA != null && legB != null) pairs.push([legA, legB, 'legs']);
        const hyp = intIfExact(rt.hypotenuse);
        const alt = intIfExact(rt.altitudeToHyp);
        const labeled = labeledInts(question);
        if (hyp != null && alt != null && labeled.indexOf(alt) !== -1) {
          pairs.push([hyp, alt, 'hyp-alt']);
        }
      }

      let matched = null;
      let matchedKind = '';
      for (let i = 0; i < pairs.length; i++) {
        const got = matchTimesHalfForm(nums[0], ops[0], nums[1], ops[1], nums[2], pairs[i][0], pairs[i][1]);
        if (got) { matched = got; matchedKind = pairs[i][2]; break; }
      }

      const hyp = rt ? intIfExact(rt.hypotenuse) : null;
      const usedHyp = hyp != null && nums.indexOf(hyp) !== -1;
      if (!matched && usedHyp) {
        return { ok: false, reason: 'hypotenuse', message: FILL_HYPOTENUSE_MSG, nums: nums, ops: ops };
      }
      if (matched && usedHyp && matchedKind !== 'hyp-alt' && !(pairs[0][0] === hyp || pairs[0][1] === hyp)) {
        /* A matched legs form should not also include the hypotenuse as a number
           unless a leg length equals the hypotenuse (impossible). */
      }

      if (matched) {
        const useRightMsg = rt && (matchedKind === 'legs' || matchedKind === 'canonical');
        return {
          ok: true,
          reason: 'ok',
          message: useRightMsg ? FILL_OK_RIGHT_LEGS_MSG : FILL_OK_MSG,
          nums: nums,
          ops: ops,
          swapped: !!matched.swapped,
          usedHypotenuseAltitude: matchedKind === 'hyp-alt'
        };
      }

      if (exprUsesDistractor(question, nums, ops)) {
        return { ok: false, reason: 'distractor', message: '這個數是多餘數據，正確公式用不上它。', nums: nums, ops: ops };
      }

      const half = halfFailReason(nums, ops);
      const looksLikeBH = pairEq(nums[0], nums[1], m.base, m.height) ||
        (nums[1] === 2 && pairEq(nums[0], nums[2], m.base, m.height)) ||
        (rt && (function () {
          const legA = intIfExact(rt.legs[0]);
          const legB = intIfExact(rt.legs[1]);
          if (legA == null || legB == null) return false;
          return pairEq(nums[0], nums[1], legA, legB) || (nums[1] === 2 && pairEq(nums[0], nums[2], legA, legB));
        })());
      if (half && looksLikeBH) return halfFailResult(half, parsed);
      if (half && !hasDivideByTwo(nums, ops)) return halfFailResult(half, parsed);
      return { ok: false, reason: 'wrong-operator', message: FILL_WRONG_OP_MSG, nums: nums, ops: ops };
    }

    if (shape === 'trapezium') {
      const T = m.topBase, B = m.bottomBase, H = m.height;
      const matched = matchTrapForm(nums, ops, T, B, H);
      if (matched) {
        return { ok: true, reason: 'ok', message: FILL_OK_MSG, nums: nums, ops: ops, swapped: !!matched.swapped };
      }
      const n0 = nums[0], n1 = nums[1], n2 = nums[2], n3 = nums[3];
      const heightInParens = (n0 === H || n1 === H);
      const baseOutside = (n2 === T || n2 === B || n3 === T || n3 === B);
      if (heightInParens && baseOutside) {
        return {
          ok: false,
          reason: 'trap-height-in-bases',
          message: '高要填在括號外面；括號裏面只是上底和下底。',
          nums: nums,
          ops: ops
        };
      }
      if (exprUsesDistractor(question, nums, ops)) {
        return { ok: false, reason: 'distractor', message: '這個數是多餘數據，正確公式用不上它。', nums: nums, ops: ops };
      }
      if (ops[0] === '＋' && pairEq(n0, n1, T, B)) {
        const half = halfFailReason(nums, ops);
        if (half) return halfFailResult(half, parsed);
      }
      if (ops.indexOf('＋') === -1 || ops[0] !== '＋') {
        return { ok: false, reason: 'wrong-operator', message: FILL_WRONG_OP_MSG, nums: nums, ops: ops };
      }
      return { ok: false, reason: 'wrong-number', message: FILL_WRONG_NUM_MSG, nums: nums, ops: ops };
    }

    return { ok: false, reason: 'unknown', message: '請再檢查一次。', nums: nums, ops: ops };
  }

  function checkFill(question, values) {
    if (isFillExpression(values)) return checkFillExpression(question, values);
    return checkFillLegacy(question, values);
  }

  function checkFillLegacy(question, values) {
    const shape = question.shape;
    const m = question.measurements;
    const blanks = fillBlanks(shape);

    const nums = {};
    for (let i = 0; i < blanks.length; i++) {
      const id = blanks[i].id;
      const n = toInt(values[id]);
      if (n == null) {
        return { ok: false, reason: 'empty', message: '請把所有空格填上數字。' };
      }
      nums[id] = n;
    }

    /* Prefer a specific 斜邊 explanation over the generic distractor message. */
    if (shape === 'triangle') {
      const rtEarly = rightTriangleInfo(question);
      if (rtEarly) {
        const hypEarly = intIfExact(rtEarly.hypotenuse);
        const altEarly = intIfExact(rtEarly.altitudeToHyp);
        const labeledEarly = labeledInts(question);
        const acceptedAlt = hypEarly != null && altEarly != null &&
          nums.base === hypEarly && nums.height === altEarly && labeledEarly.indexOf(altEarly) !== -1;
        if (!acceptedAlt && hypEarly != null && (nums.base === hypEarly || nums.height === hypEarly)) {
          return { ok: false, reason: 'hypotenuse', message: FILL_HYPOTENUSE_MSG, nums: nums };
        }
      }
    }

    if (usesDistractor(question, nums)) {
      return {
        ok: false,
        reason: 'distractor',
        message: '這個數是多餘數據，正確公式用不上它。',
        nums: nums
      };
    }

    if (shape === 'square') {
      const a = nums.side1;
      const b = nums.side2;
      if (a !== b) {
        return { ok: false, reason: 'square-unequal', message: '兩個空格都應該填同一條邊長。', nums: nums };
      }
      if (a === m.side && b === m.side) {
        return { ok: true, reason: 'ok', message: '數據填對了！這題不用計算出最後答案。', nums: nums };
      }
      return {
        ok: false,
        reason: 'wrong-number',
        message: '這個數不是正確公式要用的數據（可能是斜邊、腰、對角線或多餘數據）。',
        nums: nums
      };
    }

    if (shape === 'rectangle') {
      const L = m.length;
      const W = m.width;
      const okDirect = nums.length === L && nums.width === W;
      const okSwap = nums.length === W && nums.width === L;
      if (okDirect || okSwap) {
        return { ok: true, reason: 'ok', message: '數據填對了！這題不用計算出最後答案。', nums: nums, swapped: okSwap && !okDirect };
      }
      return {
        ok: false,
        reason: 'wrong-number',
        message: '這個數不是正確公式要用的數據（可能是斜邊、腰、對角線或多餘數據）。',
        nums: nums
      };
    }

    if (shape === 'parallelogram') {
      const swapped = nums.base === m.height && nums.height === m.base;
      if (swapped) {
        return { ok: false, reason: 'base-height-swap', message: FILL_SWAP_MSG, nums: nums };
      }
      if (nums.base === m.base && nums.height === m.height) {
        return { ok: true, reason: 'ok', message: FILL_OK_MSG, nums: nums };
      }
      return { ok: false, reason: 'wrong-number', message: FILL_WRONG_NUM_MSG, nums: nums };
    }

    if (shape === 'triangle') {
      const rt = rightTriangleInfo(question);
      const okDirect = nums.base === m.base && nums.height === m.height;
      if (rt) {
        const legA = intIfExact(rt.legs[0]);
        const legB = intIfExact(rt.legs[1]);
        const legsOk = legA != null && legB != null && (
          (nums.base === legA && nums.height === legB) ||
          (nums.base === legB && nums.height === legA)
        );
        if (okDirect || legsOk) {
          const swapped = !(nums.base === m.base && nums.height === m.height);
          return {
            ok: true,
            reason: 'ok',
            message: FILL_OK_RIGHT_LEGS_MSG,
            nums: nums,
            swapped: !!swapped
          };
        }
        const hyp = intIfExact(rt.hypotenuse);
        const alt = intIfExact(rt.altitudeToHyp);
        /* Accept 斜邊×對應高 only when that altitude is a labelled length on the figure. */
        const labeled = labeledInts(question);
        if (hyp != null && alt != null && nums.base === hyp && nums.height === alt && labeled.indexOf(alt) !== -1) {
          return { ok: true, reason: 'ok', message: FILL_OK_MSG, nums: nums, usedHypotenuseAltitude: true };
        }
        if (hyp != null && (nums.base === hyp || nums.height === hyp)) {
          return { ok: false, reason: 'hypotenuse', message: FILL_HYPOTENUSE_MSG, nums: nums };
        }
      } else if (okDirect) {
        return { ok: true, reason: 'ok', message: FILL_OK_MSG, nums: nums };
      }
      const swapped = nums.base === m.height && nums.height === m.base;
      if (swapped) {
        return { ok: false, reason: 'base-height-swap', message: FILL_SWAP_MSG, nums: nums };
      }
      return { ok: false, reason: 'wrong-number', message: FILL_WRONG_NUM_MSG, nums: nums };
    }

    if (shape === 'trapezium') {
      const t = m.topBase;
      const b = m.bottomBase;
      const h = m.height;
      const heightInBases = (nums.topBase === h || nums.bottomBase === h);
      const baseInHeight = (nums.height === t || nums.height === b);
      if (nums.height !== h && (heightInBases || baseInHeight)) {
        return {
          ok: false,
          reason: 'trap-height-in-bases',
          message: '高要填在「高」那一格；括號裏面只是上底和下底。',
          nums: nums
        };
      }
      const okDirect = nums.topBase === t && nums.bottomBase === b && nums.height === h;
      const okSwap = nums.topBase === b && nums.bottomBase === t && nums.height === h;
      if (okDirect || okSwap) {
        return { ok: true, reason: 'ok', message: '數據填對了！這題不用計算出最後答案。', nums: nums, swapped: okSwap && !okDirect };
      }
      return {
        ok: false,
        reason: 'wrong-number',
        message: '這個數不是正確公式要用的數據（可能是斜邊、腰、對角線或多餘數據）。',
        nums: nums
      };
    }

    return { ok: false, reason: 'unknown', message: '請再檢查一次。', nums: nums };
  }

  function fillBlanks(shape) {
    if (shape === 'square') {
      return [
        { id: 'side1', label: '邊長' },
        { id: 'side2', label: '邊長' }
      ];
    }
    if (shape === 'rectangle') {
      return [
        { id: 'length', label: '長' },
        { id: 'width', label: '闊' }
      ];
    }
    if (shape === 'parallelogram') {
      return [
        { id: 'base', label: '底' },
        { id: 'height', label: '高' }
      ];
    }
    if (shape === 'triangle') {
      return [
        { id: 'base', label: '底' },
        { id: 'height', label: '高' }
      ];
    }
    return [
      { id: 'topBase', label: '上底' },
      { id: 'bottomBase', label: '下底' },
      { id: 'height', label: '高' }
    ];
  }

  function correctFillValues(question) {
    const m = question.measurements;
    if (question.shape === 'square') return { side1: m.side, side2: m.side };
    if (question.shape === 'rectangle') return { length: m.length, width: m.width };
    if (question.shape === 'parallelogram' || question.shape === 'triangle') {
      return { base: m.base, height: m.height };
    }
    return { topBase: m.topBase, bottomBase: m.bottomBase, height: m.height };
  }

  function computeArea(question) {
    const m = question.measurements;
    if (question.shape === 'square') return m.side * m.side;
    if (question.shape === 'rectangle') return m.length * m.width;
    if (question.shape === 'parallelogram') return m.base * m.height;
    if (question.shape === 'triangle') return (m.base * m.height) / 2;
    if (question.shape === 'trapezium') return ((m.topBase + m.bottomBase) * m.height) / 2;
    return null;
  }

  function scoreSession(level, questionResults) {
    const midHigh = level !== 'beginner';
    const maxScore = midHigh ? 20 : 10;
    let score = 0;
    let formulaCorrect = 0;
    let fillCorrect = 0;
    questionResults.forEach(function (r) {
      if (r.formulaOk) {
        formulaCorrect += 1;
        score += 1;
      }
      if (midHigh && r.fillOk) {
        fillCorrect += 1;
        score += 1;
      }
    });
    return {
      score: score,
      maxScore: maxScore,
      formulaCorrect: formulaCorrect,
      formulaTotal: questionResults.length,
      fillCorrect: midHigh ? fillCorrect : null,
      fillTotal: midHigh ? questionResults.length : null
    };
  }

  function formulaFeedbackMessage(shape, chosen, result) {
    if (result.ok) return '公式選對了！';
    if (result.reason === 'square-as-rectangle') {
      return '這是正方形，四邊相等，請用邊長×邊長。';
    }
    if (result.reason === 'triangle-no-half') {
      return '三角形面積要記得 ÷2。';
    }
    if (result.reason === 'trapezium-wrong-form') {
      return '梯形要用（上底＋下底）×高÷2，記得先把兩條平行邊相加，還要 ÷2。';
    }
    return '這題公式不正確；請看清楚哪一條是底（藍）、哪一條是高（紅）。正確公式是「' + result.correct + '」。';
  }

  P5Area.scoring = {
    toInt: toInt,
    checkFormula: checkFormula,
    checkFill: checkFill,
    checkFillLegacy: checkFillLegacy,
    fillBlanks: fillBlanks,
    expressionSpec: expressionSpec,
    correctFillExpression: correctFillExpression,
    formatExpression: formatExpression,
    isFillExpression: isFillExpression,
    normalizeOp: normalizeOp,
    legacyValuesToExpression: legacyValuesToExpression,
    correctFillValues: correctFillValues,
    computeArea: computeArea,
    scoreSession: scoreSession,
    formulaFeedbackMessage: formulaFeedbackMessage,
    usesDistractor: usesDistractor,
    isRightTriangle: isRightTriangle,
    rightTriangleInfo: rightTriangleInfo,
    messages: {
      fillOk: FILL_OK_MSG,
      fillOkRightLegs: FILL_OK_RIGHT_LEGS_MSG,
      fillSwap: FILL_SWAP_MSG,
      fillHypotenuse: FILL_HYPOTENUSE_MSG,
      fillWrongNumber: FILL_WRONG_NUM_MSG,
      fillEmptyExpr: FILL_EMPTY_EXPR_MSG,
      fillMissingHalf: FILL_MISSING_HALF_MSG,
      fillWrongHalf: FILL_WRONG_HALF_MSG,
      fillWrongOperator: FILL_WRONG_OP_MSG
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P5Area;
})(typeof globalThis !== 'undefined' ? globalThis : this);
