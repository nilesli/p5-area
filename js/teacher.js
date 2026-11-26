/* 小五面積温習 · 老師查閱 */
(function (global) {
  const P5Area = global.P5Area = global.P5Area || {};

  function formatHK(iso, withSeconds) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const opts = {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    if (withSeconds) opts.second = '2-digit';
    return d.toLocaleString('zh-HK', opts) + '（香港時間）';
  }

  function hkDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
  }

  function formatDuration(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m <= 0) return s + ' 秒';
    return m + ' 分 ' + s + ' 秒';
  }

  function filterSessions(sessions, filters) {
    filters = filters || {};
    const sid = String(filters.studentId || '').trim().toLowerCase();
    const level = String(filters.level || '').trim();
    const dateFrom = String(filters.dateFrom || '').trim();
    const dateTo = String(filters.dateTo || '').trim();
    return (sessions || []).filter(function (s) {
      if (sid && String(s.studentId || '').toLowerCase().indexOf(sid) === -1) return false;
      if (level && s.level !== level) return false;
      const d = hkDate(s.finishedAt || s.startedAt);
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      return true;
    }).slice().sort(function (a, b) {
      return String(b.finishedAt || b.startedAt || '') .localeCompare(String(a.finishedAt || a.startedAt || ''));
    });
  }

  function levelZh(level) {
    return (P5Area.LEVELS[level] || {}).zh || level;
  }

  function renderTable(sessions, expandedId) {
    if (!sessions.length) {
      return '<p class="teacher-empty">沒有符合條件的紀錄。</p>';
    }
    let html = '<div class="teacher-table-wrap"><table class="teacher-table"><thead><tr>' +
      '<th></th><th>學號</th><th>完成時間</th><th>難度</th><th>得分</th><th>公式</th><th>填數</th><th>總用時</th>' +
      '</tr></thead><tbody>';
    sessions.forEach(function (s) {
      const open = expandedId === s.id;
      const fill = s.level === 'beginner' || s.fillCorrect == null ? '—' : (s.fillCorrect + '／10');
      html += '<tr class="teacher-session-row' + (open ? ' is-open' : '') + '" data-sid="' + esc(s.id) + '">' +
        '<td><button type="button" class="btn btn-ghost btn-sm teacher-expand" data-sid="' + esc(s.id) +
        '" aria-expanded="' + (open ? 'true' : 'false') + '">' + (open ? '收合' : '明細') + '</button></td>' +
        '<td>' + esc(s.studentId) + '</td>' +
        '<td>' + esc(formatHK(s.finishedAt || s.startedAt, false)) + '</td>' +
        '<td>' + esc(levelZh(s.level)) + '</td>' +
        '<td>' + s.score + '／' + s.maxScore + '</td>' +
        '<td>' + (s.formulaCorrect == null ? '—' : s.formulaCorrect + '／10') + '</td>' +
        '<td>' + fill + '</td>' +
        '<td>' + esc(formatDuration(s.totalTimeSec)) + '</td></tr>';
      if (open) {
        html += '<tr class="teacher-detail-row"><td colspan="8">' + renderDetail(s) + '</td></tr>';
      }
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderDetail(s) {
    const qs = s.questions || [];
    if (!qs.length) return '<p class="muted">沒有題目明細（可能由匯入檔合併，欄位不完整）。</p>';
    let html = '<table class="teacher-detail-table"><thead><tr>' +
      '<th>題</th><th>圖形</th><th>公式</th><th>填數</th><th>用時</th><th>學生所選</th>' +
      '</tr></thead><tbody>';
    qs.forEach(function (q, i) {
      const f = q.formulaOk ? '<span class="pill ok">對</span>' : '<span class="pill bad">錯</span>';
      let fill = '<span class="muted">—</span>';
      if (q.fillSkipped) fill = '<span class="pill mute">未進入</span>';
      else if (q.fillOk === true) fill = '<span class="pill ok">對</span>';
      else if (q.fillOk === false) fill = '<span class="pill bad">錯</span>';
      html += '<tr><td>' + (i + 1) + '</td><td>' + esc(q.shapeZh || q.shape) +
        '</td><td>' + f + '</td><td>' + fill + '</td><td>' +
        esc(q.timeSec == null ? '—' : formatDuration(q.timeSec)) + '</td><td>' +
        esc(q.formulaChosen || '—') + (q.usedDistractor ? ' · 誤用多餘數據' : '') +
        '</td></tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  P5Area.teacher = {
    formatHK: formatHK,
    hkDate: hkDate,
    formatDuration: formatDuration,
    filterSessions: filterSessions,
    renderTable: renderTable,
    levelZh: levelZh,
    downloadText: downloadText,
    esc: esc
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P5Area;
})(typeof globalThis !== 'undefined' ? globalThis : this);
