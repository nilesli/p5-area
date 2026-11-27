/* 小五面積温習 · 本機儲存（localStorage 備份；完成後由 cloud.js 上載） */
(function (global) {
  const P5Area = global.P5Area = global.P5Area || {};

  function defaultState() {
    return {
      version: 1,
      lastStudentId: '',
      teacherCode: P5Area.DEFAULT_TEACHER_CODE,
      sessions: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(P5Area.STORAGE_KEY);
      if (!raw) return defaultState();
      const data = JSON.parse(raw);
      const base = defaultState();
      const state = Object.assign(base, data, {
        sessions: Array.isArray(data.sessions) ? data.sessions : []
      });
      /* Keep a previously saved code (including the former default "default").
         Only a missing or blank code falls back to the current default. */
      if (!String(state.teacherCode || '').trim()) {
        state.teacherCode = P5Area.DEFAULT_TEACHER_CODE;
      }
      return state;
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(P5Area.STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function validateStudentId(raw) {
    const value = String(raw == null ? '' : raw).trim();
    if (!value) return { ok: false, error: '請先輸入學號，才可以開始練習。' };
    if (value.length > 12) return { ok: false, error: '學號請不要超過 12 個字。' };
    if (value.length < 2) return { ok: false, error: '學號請至少輸入 2 個字元。' };
    if (/\s/.test(value)) return { ok: false, error: '學號請不要包含空格。' };
    if (value.indexOf('同學') !== -1) return { ok: false, error: '請輸入學號，不要輸入姓名。' };
    if (!/^[A-Za-z0-9\-]+$/.test(value)) {
      return { ok: false, error: '學號只可以是英文字母、數字或連字號。' };
    }
    return { ok: true, value: value };
  }

  function newId(prefix) {
    prefix = prefix || 's';
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function addSession(session) {
    const state = load();
    if (session.studentId) state.lastStudentId = session.studentId;
    state.sessions.push(session);
    if (state.sessions.length > 800) state.sessions = state.sessions.slice(-700);
    save(state);
    return state;
  }

  function setLastStudentId(id) {
    const state = load();
    state.lastStudentId = id;
    save(state);
  }

  function setTeacherCode(code) {
    const state = load();
    const v = String(code || '').trim() || P5Area.DEFAULT_TEACHER_CODE;
    state.teacherCode = v;
    save(state);
    return v;
  }

  function teacherCodeMatches(input) {
    const state = load();
    const want = String(state.teacherCode || P5Area.DEFAULT_TEACHER_CODE).trim();
    const got = String(input || '').trim();
    if (!got) return false;
    return got === want;
  }

  function deidentifyId(sid) {
    const s = String(sid || '').replace(/\W/g, '');
    return 'S' + s.slice(-4).padStart(4, 'X');
  }

  function csvEscape(v) {
    const s = v == null ? '' : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function sessionRows(session, deid) {
    const sid = deid ? deidentifyId(session.studentId) : session.studentId;
    const idKey = deid ? 'studentCode' : 'studentId';
    const base = {
      sessionId: session.id,
      difficulty: session.level,
      difficultyZh: (P5Area.LEVELS[session.level] || {}).zh || session.level,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      totalTimeSec: session.totalTimeSec,
      score: session.score,
      maxScore: session.maxScore,
      formulaCorrect: session.formulaCorrect,
      fillCorrect: session.fillCorrect == null ? '' : session.fillCorrect
    };
    base[idKey] = sid;
    const qs = session.questions || [];
    if (!qs.length) {
      return [Object.assign({ qIndex: '', shape: '', shapeZh: '', morph: '', formulaChosen: '', formulaOk: '', fillOk: '', fillStatus: '', usedDistractor: '', qTimeSec: '', measurements: '', area: '', errorType: '' }, base)];
    }
    return qs.map(function (q, i) {
      return Object.assign({}, base, {
        qIndex: i + 1,
        shape: q.shape,
        shapeZh: q.shapeZh || (P5Area.SHAPES[q.shape] || {}).zh || '',
        morph: q.morph || '',
        formulaChosen: q.formulaChosen || '',
        formulaOk: q.formulaOk ? '1' : '0',
        fillOk: q.fillOk ? '1' : (q.fillSkipped ? '' : (q.fillOk === false ? '0' : '')),
        fillStatus: q.fillSkipped ? 'skipped' : (q.fillOk === true ? 'correct' : (q.fillOk === false ? 'wrong' : 'na')),
        usedDistractor: q.usedDistractor ? '1' : '0',
        qTimeSec: q.timeSec == null ? '' : q.timeSec,
        measurements: JSON.stringify(q.measurements || {}),
        area: q.area == null ? '' : q.area,
        errorType: q.errorType || ''
      });
    });
  }

  function toCSV(sessions, deid) {
    const idKey = deid ? 'studentCode' : 'studentId';
    const header = [
      'sessionId', idKey, 'difficulty', 'difficultyZh', 'startedAt', 'finishedAt',
      'totalTimeSec', 'score', 'maxScore', 'formulaCorrect', 'fillCorrect',
      'qIndex', 'shape', 'shapeZh', 'morph', 'formulaChosen', 'formulaOk',
      'fillOk', 'fillStatus', 'usedDistractor', 'qTimeSec', 'measurements', 'area', 'errorType'
    ];
    const lines = [header.map(csvEscape).join(',')];
    sessions.forEach(function (s) {
      sessionRows(s, deid).forEach(function (row) {
        lines.push(header.map(function (k) { return csvEscape(row[k]); }).join(','));
      });
    });
    return lines.join('\n');
  }

  function parseCSV(text) {
    const rows = [];
    let i = 0;
    const s = String(text).replace(/^\uFEFF/, '');
    while (i < s.length) {
      const row = [];
      while (i < s.length) {
        if (s[i] === '"') {
          let val = '';
          i++;
          while (i < s.length) {
            if (s[i] === '"') {
              if (s[i + 1] === '"') { val += '"'; i += 2; continue; }
              i++;
              break;
            }
            val += s[i++];
          }
          row.push(val);
        } else {
          let val = '';
          while (i < s.length && s[i] !== ',' && s[i] !== '\n' && s[i] !== '\r') val += s[i++];
          row.push(val);
        }
        if (s[i] === ',') { i++; continue; }
        if (s[i] === '\r') i++;
        if (s[i] === '\n') { i++; break; }
        break;
      }
      if (row.length && row.some(function (c) { return String(c).trim() !== ''; })) rows.push(row);
    }
    if (!rows.length) return [];
    const header = rows[0].map(function (h) { return String(h).trim(); });
    return rows.slice(1).map(function (r) {
      const o = {};
      header.forEach(function (h, idx) { o[h] = r[idx] == null ? '' : r[idx]; });
      return o;
    });
  }

  function rowsToSessions(rows) {
    const map = new Map();
    rows.forEach(function (row) {
      const id = row.sessionId || (row[row.studentId || row.studentCode ? 'studentId' : 'sessionId']);
      const sid = row.sessionId;
      if (!sid) return;
      if (!map.has(sid)) {
        const studentId = row.studentId || row.studentCode || '';
        map.set(sid, {
          id: sid,
          studentId: studentId,
          level: row.difficulty || 'beginner',
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          totalTimeSec: Number(row.totalTimeSec || 0),
          score: Number(row.score || 0),
          maxScore: Number(row.maxScore || 0),
          formulaCorrect: Number(row.formulaCorrect || 0),
          fillCorrect: row.fillCorrect === '' ? null : Number(row.fillCorrect),
          questions: [],
          imported: true
        });
      }
      const sess = map.get(sid);
      if (row.qIndex === '' || row.qIndex == null) return;
      let measurements = {};
      try { measurements = JSON.parse(row.measurements || '{}'); } catch (e) { measurements = {}; }
      sess.questions.push({
        shape: row.shape,
        shapeZh: row.shapeZh,
        morph: row.morph,
        formulaChosen: row.formulaChosen,
        formulaOk: row.formulaOk === '1',
        fillOk: row.fillStatus === 'correct' || row.fillOk === '1',
        fillSkipped: row.fillStatus === 'skipped',
        usedDistractor: row.usedDistractor === '1',
        timeSec: row.qTimeSec === '' ? null : Number(row.qTimeSec),
        measurements: measurements,
        area: row.area === '' ? null : Number(row.area),
        errorType: row.errorType
      });
    });
    return Array.from(map.values());
  }

  function importMerge(csvText) {
    const rows = parseCSV(csvText);
    const incoming = rowsToSessions(rows);
    const state = load();
    const have = new Set(state.sessions.map(function (s) { return s.id; }));
    let added = 0;
    let skipped = 0;
    incoming.forEach(function (s) {
      if (have.has(s.id)) { skipped++; return; }
      state.sessions.push(s);
      have.add(s.id);
      added++;
    });
    save(state);
    return { added: added, skipped: skipped, total: state.sessions.length };
  }

  function deleteSessions(predicate) {
    const state = load();
    const before = state.sessions.length;
    state.sessions = state.sessions.filter(function (s) { return !predicate(s); });
    save(state);
    return before - state.sessions.length;
  }

  P5Area.storage = {
    defaultState: defaultState,
    load: load,
    save: save,
    validateStudentId: validateStudentId,
    newId: newId,
    addSession: addSession,
    setLastStudentId: setLastStudentId,
    setTeacherCode: setTeacherCode,
    teacherCodeMatches: teacherCodeMatches,
    deidentifyId: deidentifyId,
    toCSV: toCSV,
    parseCSV: parseCSV,
    importMerge: importMerge,
    deleteSessions: deleteSessions
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P5Area;
})(typeof globalThis !== 'undefined' ? globalThis : this);
