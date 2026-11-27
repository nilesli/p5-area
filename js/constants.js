/* 小五面積温習 · 常數 */
(function (global) {
  const P5Area = global.P5Area = global.P5Area || {};

  P5Area.VERSION = '20261127a7';
  P5Area.STORAGE_KEY = 'p5area_v1';
  P5Area.SESSION_SIZE = 10;
  P5Area.UNIT = 'cm';
  P5Area.UNIT_SQ = 'cm²';
  P5Area.MIN_LEN = 2;
  P5Area.MAX_LEN = 20;

  P5Area.LEVELS = {
    beginner: { id: 'beginner', zh: '初級', maxScore: 10, desc: '看圖，選出正確的面積公式。' },
    intermediate: { id: 'intermediate', zh: '中級', maxScore: 20, desc: '先選出正確公式；選對後，用鍵盤把圖中的數字填進算式。不用計算出面積。' },
    advanced: { id: 'advanced', zh: '高級', maxScore: 20, desc: '圖中可能有 1 至 2 個用不上的數。先選出公式；選錯就會見到正確答案，然後進入下一題。選對後同樣填數，不用計算答案。' }
  };

  P5Area.SHAPES = {
    square: { id: 'square', zh: '正方形', formula: '邊長×邊長', prior: true },
    rectangle: { id: 'rectangle', zh: '長方形', formula: '長×闊', prior: true },
    parallelogram: { id: 'parallelogram', zh: '平行四邊形', formula: '底×高', prior: false },
    triangle: { id: 'triangle', zh: '三角形', formula: '底×高÷2', prior: false },
    trapezium: { id: 'trapezium', zh: '梯形', formula: '（上底＋下底）×高÷2', prior: false }
  };

  P5Area.MIX = { square: 1, rectangle: 1, parallelogram: 2, triangle: 3, trapezium: 3 };

  P5Area.FORMULA_LABELS = [
    '長×闊',
    '邊長×邊長',
    '底×高',
    '底×高÷2',
    '（上底＋下底）×高÷2'
  ];

  P5Area.FORMULA_BY_SHAPE = {
    square: '邊長×邊長',
    rectangle: '長×闊',
    parallelogram: '底×高',
    triangle: '底×高÷2',
    trapezium: '（上底＋下底）×高÷2'
  };

  /* Reveal colours — only used after the answer is shown */
  P5Area.COLOR_BASE = '#2563EB';
  P5Area.COLOR_HEIGHT = '#DC2626';
  P5Area.CLASS_BASE = 'reveal-base';
  P5Area.CLASS_HEIGHT = 'reveal-height';

  /* Neutral palette during answering (no blue/red leak) */
  P5Area.COLOR_STROKE = '#334155';
  P5Area.COLOR_FILL = '#F1F5F9';
  P5Area.COLOR_HEIGHT_NEUTRAL = '#475569';
  P5Area.COLOR_DIM = '#334155';
  P5Area.COLOR_TEXT = '#0F172A';
  P5Area.COLOR_EXTRA = '#64748B';

  /* Student-facing about text only. Scope disclaimers (學習重點 1–2 / 不宣稱完整 5M1) stay in README, not the UI. */
  P5Area.CURRICULUM_ABOUT = [
    '本 App 是小五面積 **温習**。正方形與長方形面積屬教育局 **4M2《面積（一）》**（小四已學），納入本 App 作先備温習，**不是小五新授內容**。小五單位 **5M1《面積（二）》** 的主要新授，是認識三角形和四邊形「底」與「對應高」，以及認識並運用 **平行四邊形、三角形、梯形** 的面積公式。'
  ].join('\n\n');

  P5Area.DEID_TOOL_URL = 'https://nilesli.github.io/sped-deidentification/';
  P5Area.DEFAULT_TEACHER_CODE = 'niles';

  P5Area.MORPHS = {
    square: ['axis', 'rot45', 'slight'],
    rectangle: ['landscape', 'portrait', 'slight'],
    parallelogram: ['leanR-baseBottom', 'leanL-baseBottom', 'leanR-baseSide', 'leanL-baseSide'],
    triangleBeginner: [
      'acute-baseBottom-apexL',
      'acute-baseBottom-apexR',
      'acute-baseSide',
      'right-baseBottom',
      'right-baseSide'
    ],
    triangleMidHigh: [
      'acute-baseBottom-apexL',
      'acute-baseBottom-apexR',
      'acute-baseSide',
      'right-baseBottom',
      'right-baseSide',
      'obtuse-baseBottom',
      'obtuse-baseSide'
    ],
    trapezium: [
      'general-horiz-longBottom',
      'general-horiz-longTop',
      'right-horiz-longBottom',
      'right-horiz-longTop',
      'general-tilt-longBottom',
      'general-tilt-longTop',
      'right-tilt-longBottom',
      'right-tilt-longTop'
    ]
  };

  /* Integer-sided right triangles with legs 2–20 (hyp may exceed 20). */
  P5Area.TRIPLES = (function () {
    const out = [];
    const seen = new Set();
    function add(a, b, c) {
      if (a < 2 || b < 2 || a > 20 || b > 20) return;
      const k = a + ',' + b + ',' + c;
      if (seen.has(k)) return;
      seen.add(k);
      out.push([a, b, c]);
    }
    const primitives = [
      [3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 12, 15],
      [12, 16, 20], [12, 35, 37], [9, 40, 41], [11, 60, 61], [15, 20, 25],
      [15, 36, 39], [16, 30, 34], [18, 24, 30], [21, 28, 35]
    ];
    primitives.forEach(function (t) {
      for (let k = 1; k <= 8; k++) add(t[0] * k, t[1] * k, t[2] * k);
    });
    return out;
  })();

  if (typeof module !== 'undefined' && module.exports) module.exports = P5Area;
})(typeof globalThis !== 'undefined' ? globalThis : this);
