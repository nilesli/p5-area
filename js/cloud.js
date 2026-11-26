/**
 * 小五面積温習 — Firebase 雲端成績
 * Classic script (not type=module) so file:// / tests / preview still boot.
 * Firebase ESM 11.10.0 loaded lazily via import() from gstatic.
 * Path: artifacts/p5-area-default/public/data/p5_area/sessions/entries/{id}
 * Upload only after a finished 10-question session. No name or class.
 */
(function (global) {
  'use strict';

  const P5Area = global.P5Area = global.P5Area || {};
  const APP_ID = 'p5-area-default';
  const DATA_NAME = 'p5_area';
  const BUCKET = 'sessions';
  const LS_PENDING = 'p5area-pending-sessions';
  const FIREBASE_APP_NAME = 'p5-area';
  const FB_APP = 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
  const FB_AUTH = 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
  const FB_FS = 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
  const PATH_PREFIX = 'artifacts/' + APP_ID + '/public/data/' + DATA_NAME + '/' + BUCKET + '/entries';

  const STRIP_KEYS = [
    'name', 'class', 'studentName', 'className', 'displayName',
    '姓名', '班別', '班', '學生姓名', 'nickname', 'fullName'
  ];

  let app = null;
  let auth = null;
  let db = null;
  let ready = false;
  let initPromise = null;
  let fbMods = null;
  let testUploader = null;

  function getFirebaseConfig() {
    if (
      typeof global.P5_AREA_FIREBASE_CONFIG === 'object' &&
      global.P5_AREA_FIREBASE_CONFIG &&
      global.P5_AREA_FIREBASE_CONFIG.apiKey
    ) {
      return global.P5_AREA_FIREBASE_CONFIG;
    }
    return null;
  }

  function isConfigured() {
    const c = getFirebaseConfig();
    return !!(c && c.apiKey && c.projectId && c.apiKey !== 'demo');
  }

  function readJsonArray(key) {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeJsonArray(key, arr) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
    } catch (e) {
      /* quota / blocked */
    }
  }

  function appendPending(record) {
    const all = readJsonArray(LS_PENDING);
    all.push(record);
    writeJsonArray(LS_PENDING, all);
  }

  function stripForbidden(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    STRIP_KEYS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) delete obj[k];
    });
    return obj;
  }

  function isCompleteSession(session) {
    return !!(
      session &&
      session.id &&
      String(session.studentId || '').trim() &&
      Array.isArray(session.questions) &&
      session.questions.length === 10 &&
      session.finishedAt
    );
  }

  function buildPayload(session) {
    session = session || {};
    const questions = Array.isArray(session.questions)
      ? session.questions.map(function (q) {
          q = q || {};
          return {
            shape: q.shape || '',
            shapeZh: q.shapeZh || '',
            morph: q.morph || '',
            formulaOk: !!q.formulaOk,
            fillOk: !!q.fillOk,
            fillSkipped: !!q.fillSkipped,
            usedDistractor: !!q.usedDistractor,
            timeSec: Number(q.timeSec) || 0,
            errorType: q.errorType || '',
            formulaChosen: q.formulaChosen || ''
          };
        })
      : [];
    const record = {
      id: String(session.id || ''),
      studentId: String(session.studentId || '').trim(),
      level: session.level || '',
      score: Number(session.score) || 0,
      maxScore: Number(session.maxScore) || 0,
      formulaCorrect: Number(session.formulaCorrect) || 0,
      fillCorrect: Number(session.fillCorrect) || 0,
      totalTimeSec: Number(session.totalTimeSec) || 0,
      startedAt: session.startedAt || '',
      finishedAt: session.finishedAt || '',
      questions: questions,
      whenIso: session.finishedAt || new Date().toISOString(),
      createdAtClient: Date.now(),
      appVersion: (P5Area && P5Area.VERSION) || ''
    };
    return stripForbidden(record);
  }

  function loadFirebaseMods() {
    if (fbMods) return fbMods;
    fbMods = Promise.all([
      import(FB_APP),
      import(FB_AUTH),
      import(FB_FS)
    ]).then(function (mods) {
      return { app: mods[0], auth: mods[1], fs: mods[2] };
    }).catch(function (err) {
      console.warn('[P5AreaCloud] firebase import failed', err);
      fbMods = null;
      throw err;
    });
    return fbMods;
  }

  function sessionsPath(fs) {
    return fs.collection(
      db,
      'artifacts',
      APP_ID,
      'public',
      'data',
      DATA_NAME,
      BUCKET,
      'entries'
    );
  }

  function ensureInit() {
    if (ready && db) return Promise.resolve(true);
    if (initPromise) return initPromise;
    initPromise = (function () {
      const cfg = getFirebaseConfig();
      if (!cfg || !cfg.apiKey || !cfg.projectId || cfg.apiKey === 'demo') {
        ready = false;
        return Promise.resolve(false);
      }
      return loadFirebaseMods().then(function (mods) {
        const initializeApp = mods.app.initializeApp;
        const getApp = mods.app.getApp;
        const getApps = mods.app.getApps;
        const getAuth = mods.auth.getAuth;
        const signInAnonymously = mods.auth.signInAnonymously;
        const getFirestore = mods.fs.getFirestore;
        if (getApps().some(function (a) { return a.name === FIREBASE_APP_NAME; })) {
          app = getApp(FIREBASE_APP_NAME);
        } else {
          app = initializeApp(cfg, FIREBASE_APP_NAME);
        }
        auth = getAuth(app);
        db = getFirestore(app);
        const signed = auth.currentUser
          ? Promise.resolve()
          : signInAnonymously(auth);
        return signed.then(function () {
          ready = !!(auth.currentUser && db);
          return ready;
        });
      }).catch(function (err) {
        console.warn('[P5AreaCloud] init failed', err);
        ready = false;
        db = null;
        return false;
      });
    })();
    return initPromise.then(function (ok) {
      if (!ok) initPromise = null;
      return ok;
    });
  }

  function uploadRecord(record) {
    if (typeof testUploader === 'function') {
      return Promise.resolve().then(function () { return testUploader(record); });
    }
    return ensureInit().then(function (ok) {
      if (!ok) throw new Error('cloud not ready');
      return loadFirebaseMods().then(function (mods) {
        const payload = Object.assign({}, record, {
          createdAt: mods.fs.serverTimestamp()
        });
        return mods.fs.addDoc(sessionsPath(mods.fs), payload);
      });
    });
  }

  /**
   * Upload one finished 10-question session. Fail soft → pending localStorage.
   * @returns {Promise<'cloud'|'queued'|'skipped'>}
   */
  function saveSession(session) {
    if (!isCompleteSession(session)) {
      return Promise.resolve('skipped');
    }
    const record = buildPayload(session);
    return uploadRecord(record).then(function () {
      return 'cloud';
    }).catch(function (err) {
      console.warn('[P5AreaCloud] upload failed', err);
      appendPending(record);
      return 'queued';
    });
  }

  function flushPending() {
    const pending = readJsonArray(LS_PENDING);
    if (!pending.length) return Promise.resolve({ flushed: 0, left: 0 });
    const left = [];
    let flushed = 0;
    let chain = Promise.resolve();
    pending.forEach(function (rec) {
      chain = chain.then(function () {
        return uploadRecord(rec).then(function () {
          flushed += 1;
        }).catch(function () {
          left.push(rec);
        });
      });
    });
    return chain.then(function () {
      writeJsonArray(LS_PENDING, left);
      return { flushed: flushed, left: left.length };
    });
  }

  function mapCloudDoc(d) {
    const data = d.data ? d.data() : (d || {});
    const rec = Object.assign({}, data);
    if (d && d.id && !rec.docId) rec.docId = d.id;
    stripForbidden(rec);
    return rec;
  }

  function loadSessions(max) {
    max = max || 400;
    if (typeof testUploader === 'function') {
      return Promise.resolve({ source: 'none', sessions: [], error: 'test driver' });
    }
    return ensureInit().then(function (ok) {
      if (!ok) return { source: 'none', sessions: [], error: 'not configured / offline' };
      return loadFirebaseMods().then(function (mods) {
        const q = mods.fs.query(
          sessionsPath(mods.fs),
          mods.fs.orderBy('whenIso', 'desc'),
          mods.fs.limit(max)
        );
        return mods.fs.getDocs(q).then(function (snap) {
          const sessions = [];
          snap.forEach(function (d) { sessions.push(mapCloudDoc(d)); });
          return { source: 'cloud', sessions: sessions };
        }).catch(function (err) {
          console.warn('[P5AreaCloud] load orderBy failed', err);
          return mods.fs
            .getDocs(mods.fs.query(sessionsPath(mods.fs), mods.fs.limit(max)))
            .then(function (snap) {
              const sessions = [];
              snap.forEach(function (d) { sessions.push(mapCloudDoc(d)); });
              sessions.sort(function (a, b) {
                return String(b.whenIso || b.finishedAt || '').localeCompare(String(a.whenIso || a.finishedAt || ''));
              });
              return { source: 'cloud', sessions: sessions.slice(0, max) };
            })
            .catch(function (err2) {
              console.warn('[P5AreaCloud] load failed', err2);
              return {
                source: 'none',
                sessions: [],
                error: String(err2 && err2.message)
              };
            });
        });
      });
    });
  }

  function mergeSessions(local, cloud) {
    const map = {};
    (local || []).forEach(function (s) {
      if (!s || !s.id) return;
      map[s.id] = Object.assign({}, s, { _source: 'local' });
    });
    (cloud || []).forEach(function (s) {
      if (!s || !s.id) return;
      const prev = map[s.id];
      if (!prev) {
        map[s.id] = Object.assign({}, s, { _source: 'cloud' });
        return;
      }
      const merged = Object.assign({}, prev, s, { _source: 'both' });
      if ((!s.questions || !s.questions.length) && prev.questions) {
        merged.questions = prev.questions;
      }
      map[s.id] = merged;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      return String(b.finishedAt || b.whenIso || '').localeCompare(String(a.finishedAt || a.whenIso || ''));
    });
  }

  const api = {
    APP_ID: APP_ID,
    PATH_PREFIX: PATH_PREFIX,
    LS_PENDING: LS_PENDING,
    isConfigured: isConfigured,
    ensureInit: ensureInit,
    isCompleteSession: isCompleteSession,
    buildPayload: buildPayload,
    saveSession: saveSession,
    flushPending: flushPending,
    loadSessions: loadSessions,
    fetchSessions: loadSessions,
    mergeSessions: mergeSessions,
    pendingCount: function () { return readJsonArray(LS_PENDING).length; },
    readPending: function () { return readJsonArray(LS_PENDING); },
    clearPending: function () { writeJsonArray(LS_PENDING, []); },
    __setUploader: function (fn) { testUploader = fn; }
  };

  P5Area.cloud = api;
  global.P5AreaCloud = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = P5Area;

  /* Warm-up only in a real browser — never in Node tests. */
  if (typeof global.document !== 'undefined') {
    try {
      ensureInit().then(function (ok) {
        if (ok) flushPending();
      });
    } catch (e) {
      console.warn('[P5AreaCloud] boot warm-up skipped', e);
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
