/* 小五面積温習 · 介面 */
(function () {
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  const state = {
    screen: 'start',
    studentId: '',
    level: null,
    questions: [],
    index: 0,
    phase: 'formula', /* formula | formula-feedback | fill | fill-feedback */
    selectedFormula: null,
    fills: {},
    activeSlot: null,
    pad: null,
    questionStartedAt: 0,
    sessionStartedAt: 0,
    results: [],
    session: null,
    teacherUnlocked: false,
    teacherExpanded: null,
    teacherSessions: [],
    teacherCloud: [],
    timerId: null
  };

  function showScreen(id) {
    $$('.screen').forEach(function (el) {
      const on = el.id === id;
      el.classList.toggle('active', on);
      el.hidden = !on;
    });
    state.screen = id.replace('screen-', '');
    window.scrollTo(0, 0);
  }

  function mdLite(text) {
    return P5Area.teacher.esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>');
  }

  function renderAboutBodies() {
    const html = '<p>' + mdLite(P5Area.CURRICULUM_ABOUT) + '</p>';
    const extra = '<h3>計分</h3><p>初級每題 1 分，滿分 10。中級、高級每題公式 1 分＋填數 1 分，滿分 20。做錯即公布正確公式或正確填法，圖中用<strong>藍線標底、紅線標高</strong>，並加文字標籤。不設重試。單位用 cm／cm²，學生不用輸入單位，也不用計算出面積數值。</p>' +
      '<h3>成績和私隱</h3><p>完成 10 題後會把成績上載（學號、難度、得分、用時、每題對錯），不上載姓名或班別。本機同時保留備份；離線時會暫存，稍後再試。老師頁會優先顯示雲端紀錄。完整 CSV 含學號，只宜留在校內裝置；若要交校外或交 AI，請先去識別。工具：<a href="' + P5Area.DEID_TOOL_URL + '" target="_blank" rel="noopener">' + P5Area.DEID_TOOL_URL + '</a></p>' +
      '<div class="callout">來源：教育局《小學數學課程闡釋（第二學習階段）》（2020）對 4M2、5M1 的闡釋；《數學教育學習領域課程指引補充文件：小學數學科學習內容》（2017）。</div>';
    const start = $('#start-about-body');
    const full = $('#about-full');
    if (start) start.innerHTML = html;
    if (full) full.innerHTML = html + extra;
  }

  function setMascot(name) {
    const img = $('#practice-mascot-img');
    if (img) img.src = 'assets/mascot_' + name + '.png';
  }

  function updatePrompt() {
    const el = $('#practice-prompt');
    if (!el) return;
    const midHigh = state.level !== 'beginner';
    if (!midHigh) el.textContent = '看圖，選出正確的面積公式。';
    else if (state.phase === 'fill' || state.phase === 'fill-feedback')
      el.textContent = '用鍵盤把圖中的數字填進算式。不用計算出面積。';
    else el.textContent = '先選出正確公式；選對後才填數。';
  }

  function formatFills(shape, values) {
    if (!values) return '';
    if (P5Area.scoring.isFillExpression(values)) {
      return P5Area.scoring.formatExpression(shape, values);
    }
    return P5Area.scoring.fillBlanks(shape).map(function (b) {
      return b.label + ' ' + (values[b.id] == null || values[b.id] === '' ? '—' : values[b.id]);
    }).join('、');
  }

  function emptyExpression(shape) {
    const spec = P5Area.scoring.expressionSpec(shape);
    return {
      nums: spec.numHints.map(function () { return ''; }),
      ops: Array(spec.opCount).fill('')
    };
  }

  function slotOrder(shape) {
    const spec = P5Area.scoring.expressionSpec(shape);
    const order = [];
    const n = spec.numHints.length;
    for (let i = 0; i < n; i++) {
      order.push({ kind: 'num', i: i });
      if (i < spec.opCount) order.push({ kind: 'op', i: i });
    }
    return order;
  }

  function currentQuestion() {
    return state.questions[state.index];
  }

  function paintFigure(reveal) {
    const q = currentQuestion();
    if (!q) return;
    const host = $('#figure-stage');
    host.innerHTML = P5Area.svg.render(q.geometry, {
      reveal: !!reveal,
      showRoleLabels: !!reveal,
      ariaLabel: q.shapeZh + '面積圖'
    });
  }

  function formatTimer(ms) {
    return P5Area.teacher.formatDuration(Math.floor(ms / 1000));
  }

  function tickTimer() {
    const el = $('#practice-timer');
    if (!el || !state.questionStartedAt) return;
    el.textContent = '本題 ' + formatTimer(Date.now() - state.questionStartedAt);
  }

  function startQuestionTimer() {
    state.questionStartedAt = Date.now();
    tickTimer();
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(tickTimer, 250);
  }

  function stopQuestionTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    return Math.max(0, Math.round((Date.now() - state.questionStartedAt) / 1000));
  }

  function renderQuestion() {
    const q = currentQuestion();
    const n = state.index + 1;
    const lv = P5Area.LEVELS[state.level];
    $('#practice-meta').textContent = lv.zh + ' · 第 ' + n + '／10 題';
    $('#practice-sid').textContent = state.studentId;
    updatePrompt();
    if (state.phase === 'formula') setMascot('think');
    state.selectedFormula = null;
    state.fills = {};
    state.activeSlot = null;
    state.pad = null;
    const reveal = state.phase === 'formula-feedback' || state.phase === 'fill-feedback';
    paintFigure(reveal);
    renderFormulaPane();
    renderFillPane();
    renderFeedbackPane();
  }

  function renderFormulaPane() {
    const pane = $('#formula-pane');
    const q = currentQuestion();
    const locked = state.phase !== 'formula';
    const result = state.results[state.index];
    let html = '<div class="formula-grid" role="group" aria-label="面積公式">';
    q.formulaOrder.forEach(function (label) {
      let cls = 'formula-btn';
      if (!locked && state.selectedFormula === label) cls += ' selected';
      if (locked) {
        if (label === q.formulaId) cls += ' correct';
        if (result && result.formulaChosen === label && !result.formulaOk) cls += ' wrong';
      }
      html += '<button type="button" class="' + cls + '" data-formula="' + P5Area.teacher.esc(label) + '"' +
        (locked ? ' disabled' : '') + '>' + P5Area.teacher.esc(label) + '</button>';
    });
    html += '</div>';
    if (!locked) {
      html += '<button type="button" class="btn btn-primary btn-lg" id="btn-confirm-formula">確定</button>';
    }
    pane.innerHTML = html;
    pane.hidden = state.phase === 'fill';
    if (!locked) {
      $$('.formula-btn', pane).forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.selectedFormula = btn.getAttribute('data-formula');
          $$('.formula-btn', pane).forEach(function (b) { b.classList.toggle('selected', b === btn); });
        });
      });
      const c = $('#btn-confirm-formula', pane);
      if (c) c.addEventListener('click', confirmFormula);
    }
  }

  function fillTemplateHTML(q, mode) {
    /* mode: edit | reveal — mid/high operator-entry: □ ○ □, with fixed trapezium parentheses */
    const spec = P5Area.scoring.expressionSpec(q.shape);
    const correct = P5Area.scoring.correctFillExpression(q);
    const rec = state.results[state.index];
    const useStudent = mode === 'reveal' && rec && rec.fillOk;
    const student = rec && rec.fillValues;
    let shownExpr;
    if (useStudent && student) {
      shownExpr = P5Area.scoring.isFillExpression(student)
        ? student
        : P5Area.scoring.legacyValuesToExpression(q, student);
    } else if (mode === 'reveal') {
      shownExpr = correct;
    } else {
      shownExpr = state.fills && P5Area.scoring.isFillExpression(state.fills)
        ? state.fills
        : emptyExpression(q.shape);
    }
    const nums = shownExpr.nums || [];
    const ops = shownExpr.ops || [];

    function numBtn(i) {
      const meta = { label: spec.numHints[i] };
      const raw = nums[i];
      const shown = (raw == null || raw === '') ? '' : String(raw);
      const active = mode === 'edit' && state.activeSlot && state.activeSlot.kind === 'num' && state.activeSlot.i === i;
      let cls = 'blank-btn' + (active ? ' is-active' : '');
      if (mode === 'reveal') cls += ' is-reveal';
      return '<span class="blank"><button type="button" class="' + cls + '" data-slot="num" data-i="' + i + '"' +
        (mode === 'edit' ? '' : ' disabled') + ' aria-label="數字空格，' + meta.label + '">' +
        (shown || '　') + '</button><span class="blank-label">' + meta.label + '</span></span>';
    }
    function opBtn(i) {
      const raw = ops[i];
      const shown = raw ? String(raw) : '';
      const active = mode === 'edit' && state.activeSlot && state.activeSlot.kind === 'op' && state.activeSlot.i === i;
      let cls = 'op-btn' + (active ? ' is-active' : '') + (shown ? ' has-value' : '');
      if (mode === 'reveal') cls += ' is-reveal';
      return '<span class="op-wrap"><button type="button" class="' + cls + '" data-slot="op" data-i="' + i + '"' +
        (mode === 'edit' ? '' : ' disabled') + ' aria-label="運算符號空格">' +
        (shown || '') + '</button></span>';
    }

    let html = '<div class="template expr-template" aria-label="算式模板">';
    html += '<span class="tmpl-lead">面積 ＝</span>';
    html += '<div class="expr-row">';
    if (spec.parens) {
      html += '<span class="paren" aria-hidden="true">（</span>';
      html += numBtn(0) + opBtn(0) + numBtn(1);
      html += '<span class="paren" aria-hidden="true">）</span>';
      html += opBtn(1) + numBtn(2) + opBtn(2) + numBtn(3);
    } else if (spec.opCount === 2) {
      html += numBtn(0) + opBtn(0) + numBtn(1) + opBtn(1) + numBtn(2);
    } else {
      html += numBtn(0) + opBtn(0) + numBtn(1);
    }
    html += '<span class="unit-tag">（' + P5Area.UNIT_SQ + '）</span>';
    html += '</div></div>';
    return html;
  }

  function renderFillPane() {
    const pane = $('#fill-pane');
    const q = currentQuestion();
    const show = state.phase === 'fill' || (state.phase === 'fill-feedback');
    pane.hidden = !show;
    if (!show) { pane.innerHTML = ''; return; }
    const mode = state.phase === 'fill' ? 'edit' : 'reveal';
    if (mode === 'edit') {
      if (!state.fills || !P5Area.scoring.isFillExpression(state.fills)) {
        state.fills = emptyExpression(q.shape);
      }
      if (!state.activeSlot) state.activeSlot = { kind: 'num', i: 0 };
      if (state.pad !== 'num' && state.pad !== 'op' && state.pad !== 'none') {
        state.pad = state.activeSlot.kind === 'op' ? 'op' : 'num';
      }
    }
    let html = fillTemplateHTML(q, mode);
    if (mode === 'edit') {
      if (state.pad === 'num') {
        html += '<div class="keypad" role="group" aria-label="數字鍵盤">' +
          [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
            return '<button type="button" data-k="' + n + '">' + n + '</button>';
          }).join('') +
          '<button type="button" data-k="del" class="key-del">刪除</button>' +
          '<button type="button" data-k="0">0</button>' +
          '<button type="button" data-k="clear" class="key-clear">清除</button></div>';
      } else if (state.pad === 'op') {
        html += '<div class="op-picker" role="group" aria-label="運算符號">' +
          ['＋', '－', '×', '÷'].map(function (op) {
            return '<button type="button" data-op="' + op + '" aria-label="' + op + '">' + op + '</button>';
          }).join('') + '</div>';
      }
      html += '<button type="button" class="btn btn-primary btn-lg fill-confirm" id="btn-confirm-fill">確定</button>';
    }
    pane.innerHTML = html;
    if (mode === 'edit') {
      $$('[data-slot]', pane).forEach(function (btn) {
        btn.addEventListener('click', function () {
          const kind = btn.getAttribute('data-slot');
          const i = parseInt(btn.getAttribute('data-i'), 10);
          state.activeSlot = { kind: kind, i: i };
          state.pad = kind === 'op' ? 'op' : 'num';
          renderFillPane();
        });
      });
      $$('.keypad button', pane).forEach(function (btn) {
        btn.addEventListener('click', function () { handleKey(btn.getAttribute('data-k')); });
      });
      $$('.op-picker button', pane).forEach(function (btn) {
        btn.addEventListener('click', function () { handleOp(btn.getAttribute('data-op')); });
      });
      const ok = $('#btn-confirm-fill', pane);
      if (ok) ok.addEventListener('click', confirmFill);
    }
  }

  function ensureExprFills(shape) {
    if (!state.fills || !P5Area.scoring.isFillExpression(state.fills)) {
      state.fills = emptyExpression(shape);
    }
  }

  function advanceAfter(shape, kind, i) {
    const order = slotOrder(shape);
    let idx = -1;
    for (let k = 0; k < order.length; k++) {
      if (order[k].kind === kind && order[k].i === i) { idx = k; break; }
    }
    function isEmpty(slot) {
      if (slot.kind === 'num') return !String(state.fills.nums[slot.i] || '');
      return !state.fills.ops[slot.i];
    }
    let next = null;
    for (let k = idx + 1; k < order.length; k++) {
      if (isEmpty(order[k])) { next = order[k]; break; }
    }
    if (!next) {
      for (let k = 0; k < order.length; k++) {
        if (isEmpty(order[k])) { next = order[k]; break; }
      }
    }
    if (next) {
      state.activeSlot = { kind: next.kind, i: next.i };
      state.pad = next.kind === 'op' ? 'op' : 'num';
    }
  }

  function handleKey(k) {
    const q = currentQuestion();
    ensureExprFills(q.shape);
    if (!state.activeSlot || state.activeSlot.kind !== 'num') {
      state.activeSlot = { kind: 'num', i: 0 };
    }
    const i = state.activeSlot.i;
    const cur = String(state.fills.nums[i] || '');
    if (k === 'ok') { confirmFill(); return; }
    if (k === 'clear') {
      state.fills.nums[i] = '';
      renderFillPane();
      return;
    }
    if (k === 'del') {
      state.fills.nums[i] = cur.slice(0, -1);
      renderFillPane();
      return;
    }
    if (!/^\d$/.test(k)) return;
    if (cur === '' && k === '0') return;
    if (cur.length >= 2) return;
    state.fills.nums[i] = cur + k;
    if ((cur + k).length >= 2) advanceAfter(q.shape, 'num', i);
    renderFillPane();
  }

  function handleOp(op) {
    const q = currentQuestion();
    ensureExprFills(q.shape);
    const norm = P5Area.scoring.normalizeOp(op);
    if (!norm) return;
    if (!state.activeSlot || state.activeSlot.kind !== 'op') {
      state.activeSlot = { kind: 'op', i: 0 };
    }
    const i = state.activeSlot.i;
    state.fills.ops[i] = norm;
    advanceAfter(q.shape, 'op', i);
    renderFillPane();
  }

  function renderFeedbackPane() {
    const pane = $('#feedback-pane');
    const r = state.results[state.index];
    const q = currentQuestion();
    if (state.phase !== 'formula-feedback' && state.phase !== 'fill-feedback') {
      pane.hidden = true;
      pane.innerHTML = '';
      return;
    }
    const isFill = state.phase === 'fill-feedback';
    const ok = isFill ? r.fillOk : (r.gotoFill ? true : r.formulaOk);
    pane.hidden = false;
    pane.className = 'feedback ' + (ok ? 'ok' : 'bad');
    let html = '<div>' + P5Area.teacher.esc(r.feedbackText) + '</div>';
    if (!r.gotoFill) {
      html += '<div class="fb-formula">正確公式：' + P5Area.teacher.esc(q.formulaId) + '</div>';
      var baseNote = '';
      if (q.shape === 'trapezium') baseNote = '（梯形兩條平行邊都是藍）';
      else if (q.shape === 'parallelogram') baseNote = '（一對對應邊都是藍）';
      html += '<p class="legend-note">圖中：<span class="c-base">藍線＝底</span>' + baseNote + '，<span class="c-height">紅線＝對應高</span>；並有文字標籤。</p>';
    }
    if (isFill && r.fillOk) {
      if (q.shape === 'triangle' && P5Area.scoring.isRightTriangle(q)) {
        html += '<div class="fb-formula">直角三角形中，形成直角的兩條邊都可以做底或高；兩種次序都正確。</div>';
      } else {
        html += '<div class="fb-formula">正確填法已顯示在算式。</div>';
      }
    } else if (isFill && !r.fillOk) {
      html += '<div class="fb-formula">正確填法已填入空格，請對照圖中的底和高。</div>';
    }
    if (r.gotoFill) {
      html += '<button type="button" class="btn btn-primary btn-lg" id="btn-start-fill">開始填數</button>';
    } else {
      html += '<button type="button" class="btn btn-primary btn-lg" id="btn-next">' +
        (state.index >= state.questions.length - 1 ? '查看結果' : '下一題') + '</button>';
    }
    pane.innerHTML = html;
    const nf = $('#btn-start-fill', pane);
    if (nf) nf.addEventListener('click', enterFill);
    const nx = $('#btn-next', pane);
    if (nx) nx.addEventListener('click', nextQuestion);
  }

  function confirmFormula() {
    if (state.phase !== 'formula') return;
    if (!state.selectedFormula) {
      flashStartError('請先選一個公式，再按確定。');
      const pane = $('#feedback-pane');
      pane.hidden = false;
      pane.className = 'feedback bad';
      pane.innerHTML = '請先選一個公式，再按確定。';
      return;
    }
    const q = currentQuestion();
    const chk = P5Area.scoring.checkFormula(q.shape, state.selectedFormula);
    const timeSec = stopQuestionTimer();
    const rec = {
      shape: q.shape,
      shapeZh: q.shapeZh,
      morph: q.morph,
      measurements: q.measurements,
      area: q.area,
      formulaId: q.formulaId,
      formulaOrder: q.formulaOrder,
      formulaChosen: state.selectedFormula,
      formulaOk: chk.ok,
      fillOk: null,
      fillSkipped: false,
      usedDistractor: false,
      timeSec: timeSec,
      errorType: chk.ok ? '' : chk.reason,
      feedbackText: P5Area.scoring.formulaFeedbackMessage(q.shape, state.selectedFormula, chk),
      geometry: q.geometry,
      showRoleLabels: q.showRoleLabels,
      distractors: q.distractors,
      gotoFill: false
    };
    const midHigh = state.level !== 'beginner';
    if (chk.ok && midHigh) {
      rec.gotoFill = true;
      rec.feedbackText = '公式選對了！接著把圖中的數字填進算式。不用計算出面積。';
      rec.timeSec = 0;
      rec._formulaTime = timeSec;
      state.results[state.index] = rec;
      state.phase = 'formula-feedback';
      setMascot('thumbsup');
      updatePrompt();
      paintFigure(false); /* 唔好用藍紅洩漏填數答案 */
      renderFormulaPane();
      renderFillPane();
      renderFeedbackPane();
      return;
    }
    if (!chk.ok && midHigh) {
      rec.fillSkipped = true;
      rec.fillOk = false;
    }
    state.results[state.index] = rec;
    state.phase = 'formula-feedback';
    setMascot(chk.ok ? 'thumbsup' : 'think');
    paintFigure(true);
    renderFormulaPane();
    renderFillPane();
    renderFeedbackPane();
  }

  function enterFill() {
    const rec = state.results[state.index];
    if (rec) rec.gotoFill = false;
    state.phase = 'fill';
    state.fills = emptyExpression(currentQuestion().shape);
    state.activeSlot = { kind: 'num', i: 0 };
    state.pad = 'num';
    startQuestionTimer();
    setMascot('point');
    updatePrompt();
    paintFigure(false);
    renderFormulaPane();
    renderFillPane();
    renderFeedbackPane();
  }

  function confirmFill() {
    if (state.phase !== 'fill') return;
    const q = currentQuestion();
    const chk = P5Area.scoring.checkFill(q, state.fills);
    if (chk.reason === 'empty') {
      const pane = $('#feedback-pane');
      pane.hidden = false;
      pane.className = 'feedback bad';
      pane.innerHTML = chk.message;
      return;
    }
    const fillTime = stopQuestionTimer();
    const rec = state.results[state.index] || {};
    rec.fillOk = chk.ok;
    rec.fillSkipped = false;
    rec.usedDistractor = chk.reason === 'distractor';
    rec.fillValues = Object.assign({}, state.fills);
    rec.fillSwapped = !!chk.swapped;
    rec.errorType = rec.errorType || (chk.ok ? '' : chk.reason);
    rec.feedbackText = chk.message;
    rec.timeSec = (rec._formulaTime || 0) + fillTime;
    rec.gotoFill = false;
    state.results[state.index] = rec;
    state.phase = 'fill-feedback';
    setMascot(chk.ok ? 'thumbsup' : 'think');
    paintFigure(true);
    updatePrompt();
    renderFormulaPane();
    renderFillPane();
    renderFeedbackPane();
  }

  function nextQuestion() {
    if (state.index >= state.questions.length - 1) {
      finishSession();
      return;
    }
    state.index += 1;
    state.phase = 'formula';
    state.selectedFormula = null;
    state.fills = {};
    startQuestionTimer();
    renderQuestion();
  }

  function collectTips(results, level) {
    const tips = [];
    const count = function (pred) { return results.filter(pred).length; };
    const nSq = count(function (r) { return r.errorType === 'square-as-rectangle'; });
    const nTri = count(function (r) {
      return r.errorType === 'triangle-no-half' || r.errorType === 'missing-half' || r.errorType === 'wrong-half';
    });
    const nSwap = count(function (r) { return r.errorType === 'base-height-swap'; });
    const nDist = count(function (r) { return r.usedDistractor; });
    const nTrap = count(function (r) { return r.errorType === 'trapezium-wrong-form' || r.errorType === 'trap-height-in-bases'; });
    if (nSq) tips.push('有 ' + nSq + ' 題把正方形選成「長×闊」。正方形四邊相等，要用邊長×邊長。');
    if (nTri) tips.push('有 ' + nTri + ' 題不記得 ÷2，或誤用 ×2。三角形和梯形的面積都要除以 2。');
    const nHyp = count(function (r) { return r.errorType === 'hypotenuse'; });
    if (nSwap) tips.push('有 ' + nSwap + ' 題把底和高調轉了。高必須垂直於所選的底，並帶有直角標記。直角三角形則例外：形成直角的兩條邊都可以做底或高。');
    if (nHyp) tips.push('有 ' + nHyp + ' 題用了直角三角形的斜邊來配底和高。形成直角的兩條邊才可以互相做底或高。');
    if (nDist) tips.push('有 ' + nDist + ' 題用了多餘數據（可能是斜邊、腰、對角線）。');
    if (nTrap) tips.push('有梯形題公式或上底下底／高填錯。梯形要用（上底＋下底）×高÷2。');
    if (!tips.length && level) {
      const allF = results.every(function (r) { return r.formulaOk; });
      if (allF) tips.push('這次公式都選對了！記得底和高要對應。');
    }
    return tips;
  }

  function finishSession() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    const scored = P5Area.scoring.scoreSession(state.level, state.results);
    const finishedAt = new Date().toISOString();
    const totalTimeSec = Math.max(0, Math.round((Date.now() - state.sessionStartedAt) / 1000));
    const session = {
      id: P5Area.storage.newId('s'),
      studentId: state.studentId,
      level: state.level,
      startedAt: new Date(state.sessionStartedAt).toISOString(),
      finishedAt: finishedAt,
      totalTimeSec: totalTimeSec,
      score: scored.score,
      maxScore: scored.maxScore,
      formulaCorrect: scored.formulaCorrect,
      fillCorrect: scored.fillCorrect,
      questions: state.results
    };
    P5Area.storage.addSession(session);
    state.session = session;
    renderResults();
    showScreen('screen-results');
    const cloudEl = $('#results-cloud');
    if (P5Area.cloud && typeof P5Area.cloud.saveSession === 'function') {
      P5Area.cloud.saveSession(session).then(function (res) {
        if (!cloudEl) return;
        if (res === 'cloud') cloudEl.textContent = '成績已上載。';
        else if (res === 'queued') cloudEl.textContent = '暫時未能上載，已暫存本機，稍後會再試。';
        else cloudEl.textContent = '成績已保存在本機。';
      }).catch(function () {
        if (cloudEl) cloudEl.textContent = '暫時未能上載，已暫存本機，稍後會再試。';
      });
    } else if (cloudEl) {
      cloudEl.textContent = '成績已保存在本機。';
    }
  }

  function renderResults() {
    const s = state.session;
    const host = $('#results-wrap');
    $('#results-sid').textContent = s.studentId;
    const lv = P5Area.LEVELS[s.level];
    const tips = collectTips(s.questions, s.level);
    let html = '<div class="results-card score-hero">' +
      '<div class="mascot-inline"><img src="assets/mascot_celebrate.png" alt="" /></div>' +
      '<p class="score-num">' + s.score + '／' + s.maxScore + '</p>' +
      '<p class="score-sub">' + lv.zh + '　公式選對 ' + s.formulaCorrect + '／10 題' +
      (s.fillCorrect == null ? '' : '　填數對 ' + s.fillCorrect + '／10 題') + '</p>' +
      '<p class="score-sub">完成：' + P5Area.teacher.formatHK(s.finishedAt, true) +
      '　總用時 ' + P5Area.teacher.formatDuration(s.totalTimeSec) + '</p>' +
      '<p class="score-sub" id="results-cloud">成績正嘗試上載……</p></div>';
    if (tips.length) {
      html += '<div class="tips-box"><h3>這次可以再留意</h3><ul>' +
        tips.map(function (t) { return '<li>' + P5Area.teacher.esc(t) + '</li>'; }).join('') +
        '</ul></div>';
    }
    html += '<div class="results-actions">' +
      '<button type="button" class="btn btn-primary" id="btn-again">再做 10 題</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-results-start">返回開始頁</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-results-teacher">老師查閱成績</button></div>';
    html += '<h3>每題回顧</h3><div class="review-list">';
    s.questions.forEach(function (q, i) {
      const fig = P5Area.svg.render(q.geometry, { reveal: true, showRoleLabels: true, compact: true, ariaLabel: q.shapeZh });
      const fillTxt = q.fillSkipped ? '填數：未進入（公式已錯）'
        : (q.fillOk == null ? '填數：—'
          : (q.fillOk ? '填數：對' : '填數：錯'));
      html += '<article class="review-item"><div class="review-head">' +
        '<span>第 ' + (i + 1) + ' 題　' + P5Area.teacher.esc(q.shapeZh) + '</span>' +
        '<span class="pill ' + (q.formulaOk ? 'ok' : 'bad') + '">公式 ' + (q.formulaOk ? '對' : '錯') + '</span>' +
        (s.level === 'beginner' ? '' : '<span class="pill ' + (q.fillOk ? 'ok' : (q.fillSkipped || q.fillOk === false ? 'bad' : 'mute')) + '">' + fillTxt + '</span>') +
        '<span class="muted">用時 ' + P5Area.teacher.formatDuration(q.timeSec) + '</span></div>' +
        '<div class="review-grid"><div class="review-fig">' + fig + '</div><div>' +
        '<p>正確公式：<strong>' + P5Area.teacher.esc(q.formulaId) + '</strong></p>' +
        '<p>你選：' + P5Area.teacher.esc(q.formulaChosen || '—') + '</p>' +
        (q.fillValues ? '<p>你填：' + P5Area.teacher.esc(formatFills(q.shape, q.fillValues)) + '</p>' : '') +
        '<p>面積（對照用，練習時不用計算）＝ <strong>' + q.area + ' ' + P5Area.UNIT_SQ + '</strong></p>' +
        '</div></div></article>';
    });
    html += '</div>';
    host.innerHTML = html;
    $('#btn-again').addEventListener('click', function () {
      showScreen('screen-start');
      syncGoButton();
    });
    $('#btn-results-start').addEventListener('click', function () { showScreen('screen-start'); });
    $('#btn-results-teacher').addEventListener('click', openTeacher);
  }

  function flashStartError(msg) {
    const el = $('#start-error');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
  }

  function syncGoButton() {
    const btn = $('#btn-go');
    const idVal = ($('#student-id').value || '').trim();
    if (!idVal || !state.level) {
      btn.disabled = true;
      btn.textContent = '請先輸入學號並選難度';
    } else {
      btn.disabled = false;
      btn.textContent = '開始 10 題（' + P5Area.LEVELS[state.level].zh + '）';
    }
  }

  function startSession(opts) {
    opts = opts || {};
    const checked = P5Area.storage.validateStudentId(opts.studentId != null ? opts.studentId : $('#student-id').value);
    if (!checked.ok) { flashStartError(checked.error); return false; }
    const level = opts.level || state.level;
    if (!level) { flashStartError('請先選擇難度。'); return false; }
    $('#start-error').hidden = true;
    state.studentId = checked.value;
    state.level = level;
    P5Area.storage.setLastStudentId(checked.value);
    state.questions = P5Area.generator.generateSession(level, opts.seed);
    state.index = 0;
    state.phase = 'formula';
    state.results = [];
    state.session = null;
    state.sessionStartedAt = Date.now();
    showScreen('screen-practice');
    startQuestionTimer();
    renderQuestion();
    return true;
  }

  function confirmLeavePractice() {
    if (state.screen !== 'practice') return true;
    if (state.results.length === 0 && state.phase === 'formula' && state.index === 0) {
      return window.confirm('現在離開就不會儲存成績。確定離開？');
    }
    return window.confirm('練習未完成，離開就不會儲存這場成績。確定離開？');
  }

  /* ---------- teacher ---------- */
  function openTeacher() {
    showScreen('screen-teacher');
    const q = new URLSearchParams(location.search);
    if (!state.teacherUnlocked) {
      $('#teacher-gate').hidden = false;
      $('#teacher-panel').hidden = true;
    } else {
      $('#teacher-gate').hidden = true;
      $('#teacher-panel').hidden = false;
      refreshTeacher();
    }
    if (q.get('teacher') === '1' && !state.teacherUnlocked) {
      /* stay on gate */
    }
  }

  function enterTeacher() {
    const code = $('#teacher-code').value;
    if (!P5Area.storage.teacherCodeMatches(code)) {
      const el = $('#teacher-gate-error');
      el.hidden = false;
      el.textContent = '老師代號不正確。';
      return;
    }
    state.teacherUnlocked = true;
    $('#teacher-gate-error').hidden = true;
    $('#teacher-gate').hidden = true;
    $('#teacher-panel').hidden = false;
    refreshTeacher();
  }

  function currentTeacherFilters() {
    return {
      studentId: $('#filter-sid').value,
      dateFrom: $('#filter-from').value,
      dateTo: $('#filter-to').value,
      level: $('#filter-level').value
    };
  }

  function paintTeacher(sessions, cloudInfo) {
    state.teacherSessions = sessions || [];
    const all = state.teacherSessions;
    const list = P5Area.teacher.filterSessions(all, currentTeacherFilters());
    $('#teacher-table-host').innerHTML = P5Area.teacher.renderTable(list, state.teacherExpanded);
    const localN = P5Area.storage.load().sessions.length;
    const cloudN = ((cloudInfo && cloudInfo.sessions) || state.teacherCloud || []).length;
    let msg = '顯示 ' + list.length + ' 場練習（合共 ' + all.length + ' 場';
    if (cloudInfo && cloudInfo.source === 'cloud') {
      msg += '：雲端 ' + cloudN + ' 場，本機 ' + localN + ' 場，已合併';
    } else if (cloudInfo && cloudInfo.error) {
      msg += '。雲端讀取未成功，以下為本機紀錄';
    } else {
      msg += '：本機 ' + localN + ' 場';
    }
    msg += '）。';
    $('#teacher-status').textContent = msg;
    $$('.teacher-expand', $('#teacher-table-host')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-sid');
        state.teacherExpanded = state.teacherExpanded === id ? null : id;
        paintTeacher(state.teacherSessions, cloudInfo);
      });
    });
  }

  function refreshTeacher() {
    const local = P5Area.storage.load().sessions;
    const mergeFn = (P5Area.cloud && P5Area.cloud.mergeSessions)
      ? P5Area.cloud.mergeSessions
      : function (a, b) { return (a || []).concat(b || []); };
    paintTeacher(mergeFn(local, state.teacherCloud || []), {
      source: state.teacherCloud && state.teacherCloud.length ? 'cloud' : 'local',
      sessions: state.teacherCloud || [],
      error: null
    });
    if (!P5Area.cloud || typeof P5Area.cloud.loadSessions !== 'function') return;
    P5Area.cloud.loadSessions(400).then(function (res) {
      state.teacherCloud = (res && res.sessions) || [];
      paintTeacher(mergeFn(P5Area.storage.load().sessions, state.teacherCloud), res);
    }).catch(function (err) {
      paintTeacher(mergeFn(P5Area.storage.load().sessions, []), {
        source: 'none',
        sessions: [],
        error: String(err && err.message || 'load failed')
      });
    });
  }

  function exportCSV(deid) {
    const all = (state.teacherSessions && state.teacherSessions.length)
      ? state.teacherSessions
      : P5Area.storage.load().sessions;
    const list = P5Area.teacher.filterSessions(all, currentTeacherFilters());
    if (!list.length) {
      $('#teacher-status').textContent = '沒有可匯出的紀錄。';
      return;
    }
    const csv = P5Area.storage.toCSV(list, deid);
    const stamp = P5Area.teacher.hkDate(new Date().toISOString());
    P5Area.teacher.downloadText(
      (deid ? 'p5-area-deid-' : 'p5-area-full-') + stamp + '.csv',
      csv
    );
    $('#teacher-status').textContent = deid
      ? '已下載去識別 CSV（學號改為尾碼代號）。'
      : '已下載完整 CSV（含學號，請只在校內裝置保存）。';
  }

  function bind() {
    renderAboutBodies();
    const stored = P5Area.storage.load();
    if (stored.lastStudentId) $('#student-id').value = stored.lastStudentId;
    if (P5Area.cloud && typeof P5Area.cloud.flushPending === 'function') {
      P5Area.cloud.flushPending().catch(function () {});
    }

    $$('.level-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.level-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        state.level = btn.getAttribute('data-level');
        syncGoButton();
      });
    });
    $('#student-id').addEventListener('input', syncGoButton);
    $('#student-id').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (!$('#btn-go').disabled) startSession(); }
    });
    $('#btn-go').addEventListener('click', function () { startSession(); });
    $('#btn-about').addEventListener('click', function () { showScreen('screen-about'); });
    $('#btn-about-back').addEventListener('click', function () { showScreen('screen-start'); });
    $('#btn-teacher').addEventListener('click', openTeacher);
    $('#btn-practice-back').addEventListener('click', function () {
      if (confirmLeavePractice()) {
        if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
        showScreen('screen-start');
      }
    });
    $('#btn-results-home').addEventListener('click', function () { showScreen('screen-start'); });
    $('#btn-teacher-back').addEventListener('click', function () { showScreen('screen-start'); });
    $('#btn-teacher-enter').addEventListener('click', enterTeacher);
    $('#teacher-code').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); enterTeacher(); }
    });
    $('#btn-filter').addEventListener('click', refreshTeacher);
    ['filter-sid', 'filter-from', 'filter-to', 'filter-level'].forEach(function (id) {
      const el = $('#' + id);
      if (el) el.addEventListener('change', refreshTeacher);
      if (el && el.tagName === 'INPUT' && el.type === 'text') el.addEventListener('input', refreshTeacher);
    });
    $('#btn-export-full').addEventListener('click', function () { exportCSV(false); });
    $('#btn-export-deid').addEventListener('click', function () { exportCSV(true); });
    $('#import-csv').addEventListener('change', function () {
      const file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const res = P5Area.storage.importMerge(String(reader.result || ''));
          $('#teacher-status').textContent = '已合併：新增 ' + res.added + ' 場，略過重複 ' + res.skipped + ' 場。現時合共 ' + res.total + ' 場。';
          refreshTeacher();
        } catch (e) {
          $('#teacher-status').textContent = '匯入失敗，請確認是本 App 匯出的 CSV。';
        }
      };
      reader.readAsText(file, 'utf-8');
    });
    $('#btn-delete').addEventListener('click', function () {
      const list = P5Area.teacher.filterSessions(P5Area.storage.load().sessions, currentTeacherFilters());
      if (!list.length) { $('#teacher-status').textContent = '沒有可刪除的紀錄。'; return; }
      if (!window.confirm('確定刪除現在篩選到的本機紀錄（' + list.length + ' 場）？雲端紀錄不會在此刪除。這步不可以還原。')) return;
      const ids = new Set(list.map(function (s) { return s.id; }));
      const n = P5Area.storage.deleteSessions(function (s) { return ids.has(s.id); });
      $('#teacher-status').textContent = '已刪除 ' + n + ' 場本機紀錄。雲端紀錄不會在此刪除。';
      refreshTeacher();
    });
    $('#btn-save-code').addEventListener('click', function () {
      const v = P5Area.storage.setTeacherCode($('#teacher-code-new').value);
      $('#teacher-status').textContent = '老師代號已更新為「' + v + '」（只保存在這部裝置）。';
    });

    if (new URLSearchParams(location.search).get('teacher') === '1') openTeacher();
    syncGoButton();
  }

  /* Preview / tests hook */
  window.P5AreaUI = {
    startSession: startSession,
    getState: function () {
      return {
        screen: state.screen,
        studentId: state.studentId,
        level: state.level,
        index: state.index,
        phase: state.phase,
        selectedFormula: state.selectedFormula,
        question: currentQuestion(),
        results: state.results,
        session: state.session
      };
    },
    selectFormula: function (label) {
      state.selectedFormula = label;
      renderFormulaPane();
    },
    confirmFormula: confirmFormula,
    enterFill: enterFill,
    setFill: function (values) {
      const q = currentQuestion();
      if (P5Area.scoring.isFillExpression(values)) {
        state.fills = {
          nums: values.nums.map(function (v) { return v == null ? '' : String(v); }),
          ops: values.ops.map(function (o) { return P5Area.scoring.normalizeOp(o) || o || ''; })
        };
      } else if (q) {
        const expr = P5Area.scoring.legacyValuesToExpression(q, values || {});
        state.fills = {
          nums: expr.nums.map(function (v) { return v == null ? '' : String(v); }),
          ops: expr.ops.slice()
        };
      } else {
        state.fills = Object.assign({}, values);
      }
      renderFillPane();
    },
    openFillPad: function (kind, i) {
      if (!kind || kind === 'none') {
        state.pad = 'none';
        renderFillPane();
        return;
      }
      state.activeSlot = { kind: kind, i: i == null ? 0 : i };
      state.pad = kind === 'op' ? 'op' : 'num';
      renderFillPane();
    },
    confirmFill: confirmFill,
    nextQuestion: nextQuestion,
    gotoIndex: function (i) {
      if (i < 0 || i >= state.questions.length) return false;
      state.index = i;
      state.phase = 'formula';
      state.selectedFormula = null;
      state.fills = {};
      startQuestionTimer();
      renderQuestion();
      return true;
    },
    getQuestions: function () { return state.questions; },
    showScreen: showScreen,
    openTeacher: function (code) {
      if (code != null) $('#teacher-code').value = code;
      openTeacher();
      if (code != null) enterTeacher();
    },
    refreshTeacher: refreshTeacher,
    seedDemoRecords: function () {
      const qs = P5Area.generator.generateSession('advanced', 99);
      const results = qs.map(function (q, i) {
        const okF = i % 3 !== 0;
        const okFill = okF && i % 2 === 0;
        return {
          shape: q.shape, shapeZh: q.shapeZh, morph: q.morph,
          measurements: q.measurements, area: q.area, formulaId: q.formulaId,
          formulaOrder: q.formulaOrder,
          formulaChosen: okF ? q.formulaId : '底×高',
          formulaOk: okF, fillOk: okF ? okFill : false, fillSkipped: !okF,
          usedDistractor: false, timeSec: 20 + i, geometry: q.geometry,
          errorType: okF ? '' : 'wrong-formula'
        };
      });
      const scored = P5Area.scoring.scoreSession('advanced', results);
      const now = new Date();
      P5Area.storage.addSession({
        id: 'demo-' + now.getTime(),
        studentId: '5A12',
        level: 'advanced',
        startedAt: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
        finishedAt: now.toISOString(),
        totalTimeSec: 720,
        score: scored.score,
        maxScore: scored.maxScore,
        formulaCorrect: scored.formulaCorrect,
        fillCorrect: scored.fillCorrect,
        questions: results
      });
      const qs2 = P5Area.generator.generateSession('beginner', 7);
      const res2 = qs2.map(function (q, i) {
        const okF = i !== 2;
        return {
          shape: q.shape, shapeZh: q.shapeZh, morph: q.morph,
          measurements: q.measurements, area: q.area, formulaId: q.formulaId,
          formulaOrder: q.formulaOrder,
          formulaChosen: okF ? q.formulaId : (q.shape === 'square' ? '長×闊' : '底×高'),
          formulaOk: okF, fillOk: null, fillSkipped: false,
          usedDistractor: false, timeSec: 12 + i, geometry: q.geometry,
          errorType: okF ? '' : (q.shape === 'square' ? 'square-as-rectangle' : 'wrong-formula')
        };
      });
      const sc2 = P5Area.scoring.scoreSession('beginner', res2);
      P5Area.storage.addSession({
        id: 'demo2-' + now.getTime(),
        studentId: '5B07',
        level: 'beginner',
        startedAt: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
        finishedAt: new Date(now.getTime() - 28 * 60 * 1000).toISOString(),
        totalTimeSec: 400,
        score: sc2.score,
        maxScore: sc2.maxScore,
        formulaCorrect: sc2.formulaCorrect,
        fillCorrect: sc2.fillCorrect,
        questions: res2
      });
    },
    updatePrompt: updatePrompt,
    repaint: function (reveal) { updatePrompt(); paintFigure(!!reveal); renderFormulaPane(); renderFillPane(); renderFeedbackPane(); },
    goAbout: function () { showScreen('screen-about'); },
    setLevel: function (level) {
      state.level = level;
      $$('.level-btn').forEach(function (b) {
        b.classList.toggle('selected', b.getAttribute('data-level') === level);
      });
      syncGoButton();
    }
  };

  bind();
})();
