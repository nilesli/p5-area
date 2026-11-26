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
  function checkFill(question, values) {
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

    if (shape === 'parallelogram' || shape === 'triangle') {
      const swapped = nums.base === m.height && nums.height === m.base;
      if (swapped) {
        return {
          ok: false,
          reason: 'base-height-swap',
          message: '底和高調轉了。請看清楚哪一條是底，哪一條是它對應的高（有直角標記的那一條）。',
          nums: nums
        };
      }
      if (nums.base === m.base && nums.height === m.height) {
        return { ok: true, reason: 'ok', message: '數據填對了！這題不用計算出最後答案。', nums: nums };
      }
      return {
        ok: false,
        reason: 'wrong-number',
        message: '這個數不是正確公式要用的數據（可能是斜邊、腰、對角線或多餘數據）。',
        nums: nums
      };
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
    fillBlanks: fillBlanks,
    correctFillValues: correctFillValues,
    computeArea: computeArea,
    scoreSession: scoreSession,
    formulaFeedbackMessage: formulaFeedbackMessage,
    usesDistractor: usesDistractor
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P5Area;
})(typeof globalThis !== 'undefined' ? globalThis : this);
