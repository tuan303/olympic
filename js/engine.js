// ============================================================
//  LÕI TÍNH TOÁN — không phụ thuộc giao diện
//  - Phân giải đội/VĐV ở vòng trong ("Nhất bảng A", "Thắng TK1", "(n)")
//  - Bảng xếp hạng theo điều lệ từng môn
//  - Nhất / Nhì / Ba từng nội dung, bảng tổng sắp huy chương theo lớp
// ============================================================

export const SPORTS = [
  { id: 'bongda', name: 'Bóng đá', color: '#3FA856', ink: '#1f7a35', tint: '#e8f6ec', kind: 'team', unit: 'bàn', diffName: 'HS', forName: 'BT' },
  { id: 'bongro', name: 'Bóng rổ', color: '#ED213C', ink: '#c8102e', tint: '#fde8eb', kind: 'team', unit: 'điểm', diffName: 'HS', forName: 'ĐG' },
  { id: 'keoco', name: 'Kéo co', color: '#F5B800', ink: '#8a6400', tint: '#fff6d6', kind: 'team', unit: 'hiệp', diffName: 'HS hiệp', forName: 'Hiệp thắng' },
  { id: 'caulong', name: 'Cầu lông', color: '#41BBFF', ink: '#0877b8', tint: '#e5f5ff', kind: 'ind', unit: 'điểm' },
  { id: 'karate', name: 'Karate', color: '#0249DF', ink: '#0238b0', tint: '#e6edfd', kind: 'ind', unit: 'cờ' },
];
export const SPORT = Object.fromEntries(SPORTS.map((s) => [s.id, s]));
export const LEVELS = [
  { id: 'TH', name: 'Tiểu học', grades: [1, 2, 3, 4, 5] },
  { id: 'THCS', name: 'THCS', grades: [6, 7, 8, 9] },
  { id: 'THPT', name: 'THPT', grades: [10, 11, 12] },
];
export const LEVEL = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
export const levelOf = (g) => (g <= 5 ? 'TH' : g <= 9 ? 'THCS' : 'THPT');
export const gradeOfClass = (t) => { const m = String(t || '').match(/^(\d{1,2})/); return m ? Number(m[1]) : null; };

// Điểm theo điều lệ (Quản trị có thể đổi trong mục Cài đặt)
export const DEFAULT_POINTS = {
  bongda: { w: 3, d: 1, l: 0 },   // Điều lệ Bóng đá: Thắng 3 – Hòa 1 – Thua 0
  bongro: { w: 1, d: 0, l: 0 },   // Điều lệ Bóng rổ: Thắng 1 – Thua 0
  keoco: { w: 2, d: 0, l: 0 },    // Điều lệ Kéo co: Thắng 2 – Thua 0
};
// Tỉ số xử thua khi bỏ cuộc / đến muộn (theo điều lệ)
export const FORFEIT = { bongda: [3, 0], bongro: [20, 0], keoco: [3, 0], caulong: [25, 0], karate: [3, 0] };

export const STATUS = {
  sched: { name: 'Chưa thi đấu', cls: 'sched' },
  live: { name: 'Đang thi đấu', cls: 'live' },
  done: { name: 'Kết thúc', cls: 'done' },
  post: { name: 'Hoãn', cls: 'post' },
  cancel: { name: 'Hủy', cls: 'cancel' },
  wo: { name: 'Miễn đấu', cls: 'wo' },
};
const RANK_WORD = { 1: 'Nhất', 2: 'Nhì', 3: 'Ba', 4: 'Tư' };
const STAGE_RANK = { R: 1, G: 1, QF: 2, SF: 3, F: 4 };

export const isDone = (m) => m && m.st === 'done' && Number.isFinite(m.sa) && Number.isFinite(m.sb);
export function cmpMatch(x, y) {
  return (x.date || '9').localeCompare(y.date || '9') || (x.time || '99').localeCompare(y.time || '99')
    || (STAGE_RANK[x.stage] || 0) - (STAGE_RANK[y.stage] || 0) || (x.n || 0) - (y.n || 0) || x.id.localeCompare(y.id, 'vi', { numeric: true });
}
export const cmpClass = (a, b) => String(a).localeCompare(String(b), 'vi', { numeric: true });

export function createEngine(db) {
  const events = db.events || {};
  const matches = db.matches || {};
  const settings = db.settings || {};
  const byEv = {};
  for (const m of Object.values(matches)) (byEv[m.ev] ||= []).push(m);
  for (const list of Object.values(byEv)) list.sort(cmpMatch);
  const memo = new Map();
  const cached = (k, fn) => { if (memo.has(k)) return memo.get(k); const v = fn(); memo.set(k, v); return v; };
  const points = (sport) => ({ ...DEFAULT_POINTS[sport], ...((settings.points || {})[sport] || {}) });

  // ---------------- phân giải một bên của trận ----------------
  function resolveSide(m, which, depth = 0) {
    const s = m && m[which];
    if (!s) return { kind: 'tbd', label: 'Chưa xác định' };
    if (s.ref) return resolveRef(m, s.ref, depth);
    const ind = events[m.ev] && events[m.ev].kind === 'ind';
    if (s.bye) return { kind: 'bye', t: s.t || '', p: s.p || '' };
    if (ind) return s.t || s.p ? { kind: 'ath', t: s.t || '', p: s.p || '' } : { kind: 'tbd', label: s.label || 'Chưa xác định' };
    if (s.t) return { kind: 'team', t: s.t };
    return { kind: 'tbd', label: s.label || 'Chưa xác định' };
  }
  function resolveRef(m, ref, depth) {
    if (depth > 14) return { kind: 'tbd', label: '…' };
    const type = ref[0];
    const rest = ref.slice(2);
    if (type === 'G') {
      const [g, rk] = rest.split(':');
      const label = `${RANK_WORD[rk] || 'Hạng ' + rk} bảng ${g}`;
      const st = standings(m.ev, g);
      if (st.complete) { const row = st.rows[Number(rk) - 1]; if (row) return { kind: 'team', t: row.t, via: label }; }
      return { kind: 'tbd', label };
    }
    if (type === 'W' || type === 'L') {
      const src = matches[rest];
      const label = (type === 'W' ? 'Thắng ' : 'Thua ') + refName(src, rest);
      if (!src) return { kind: 'tbd', label };
      const w = winner(src, depth + 1);
      if (w === 'dead') return { kind: 'bye', label };
      if (w !== 'a' && w !== 'b') return { kind: 'tbd', label };
      const side = type === 'W' ? w : w === 'a' ? 'b' : 'a';
      return { ...resolveSide(src, side, depth + 1), via: label };
    }
    if (type === 'T') {
      const ids = rest.split(',');
      const label = 'Thắng cặp trận ' + ids.map((id) => (matches[id] ? matches[id].n : '?')).join('–');
      const w = tieWinner(ids, depth + 1);
      if (w !== 'a' && w !== 'b') return { kind: 'tbd', label };
      return { ...resolveSide(matches[ids[0]], w, depth + 1), via: label };
    }
    return { kind: 'tbd', label: ref };
  }
  function refName(src, id) {
    if (!src) return 'trận ' + id;
    const ev = events[src.ev];
    if (ev && ev.kind === 'team') return src.stage === 'QF' ? 'TK' + id.slice(-1) : src.stage === 'SF' ? 'BK' + id.slice(-1) : src.stage === 'F' ? 'Chung kết' : 'trận';
    if (src.branch && src.stage === 'SF') return 'nhánh ' + src.branch;
    return 'trận ' + (src.branch || '') + (src.n || '');
  }
  // 'a' | 'b' | null (chưa có) | 'dead' (cả hai bên đều không thi đấu)
  function winner(m, depth = 0) {
    const k = 'w:' + m.id;
    if (memo.has(k)) return memo.get(k);
    memo.set(k, null);
    let w = null;
    if (m.st !== 'cancel') {
      if (m.w === 'a' || m.w === 'b') w = m.w;
      else if (isDone(m)) w = m.sa > m.sb ? 'a' : m.sb > m.sa ? 'b' : null;
      if (!w && !isDone(m)) {
        const A = resolveSide(m, 'a', depth + 1), B = resolveSide(m, 'b', depth + 1);
        if (A.kind === 'bye' && B.kind === 'bye') w = 'dead';
        else if (A.kind === 'bye' && B.kind !== 'tbd') w = 'b';
        else if (B.kind === 'bye' && A.kind !== 'tbd') w = 'a';
      }
    }
    memo.set(k, w);
    return w;
  }
  function tieWinner(ids, depth) {
    const legs = ids.map((id) => matches[id]).filter(Boolean);
    if (!legs.length) return null;
    let wa = 0, wb = 0, da = 0;
    for (const m of legs) {
      if (!isDone(m)) { const w = winner(m, depth); if (w === 'a') wa++; else if (w === 'b') wb++; else return null; continue; }
      if (m.sa > m.sb) wa++; else if (m.sb > m.sa) wb++;
      da += m.sa - m.sb;
    }
    if (wa !== wb) return wa > wb ? 'a' : 'b';
    if (da) return da > 0 ? 'a' : 'b';
    const last = legs[legs.length - 1];
    return last.w || null;
  }

  // ---------------- bảng xếp hạng ----------------
  function standings(evId, g) {
    return cached(`st:${evId}:${g}`, () => {
      const ev = events[evId] || {};
      const teams = (ev.groups && ev.groups[g]) || [];
      const P = points(ev.sport);
      const rows = new Map(teams.map((t) => [t, { t, p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, pts: 0, fp: 0, form: [] }]));
      const gm = (byEv[evId] || []).filter((m) => m.stage === 'G' && m.group === g);
      let pending = 0;
      const h2h = {};
      for (const m of gm) {
        if (m.st === 'cancel') continue;
        const A = m.a && m.a.t, B = m.b && m.b.t;
        if (!rows.has(A) || !rows.has(B)) continue;
        if (!isDone(m)) { pending++; continue; }
        const ra = rows.get(A), rb = rows.get(B);
        ra.p++; rb.p++; ra.f += m.sa; ra.a += m.sb; rb.f += m.sb; rb.a += m.sa;
        ra.fp += (m.ya || 0) + 2 * (m.ra || 0); rb.fp += (m.yb || 0) + 2 * (m.rb || 0);
        if (m.sa > m.sb) { ra.w++; rb.l++; ra.pts += P.w; rb.pts += P.l; ra.form.push('T'); rb.form.push('B'); h2h[A + '>' + B] = 1; }
        else if (m.sb > m.sa) { rb.w++; ra.l++; rb.pts += P.w; ra.pts += P.l; rb.form.push('T'); ra.form.push('B'); h2h[B + '>' + A] = 1; }
        else { ra.d++; rb.d++; ra.pts += P.d; rb.pts += P.d; ra.form.push('H'); rb.form.push('H'); }
      }
      const list = [...rows.values()];
      list.forEach((r) => { r.diff = r.f - r.a; });
      const manual = (ev.manualOrder && ev.manualOrder[g]) || [];
      const mi = (t) => { const i = manual.indexOf(t); return i < 0 ? 999 + teams.indexOf(t) : i; };
      const useH2H = ev.sport === 'bongro' || ev.sport === 'keoco';
      const base = (x, y) => y.diff - x.diff || y.f - x.f || (ev.sport === 'bongda' ? x.fp - y.fp : 0) || mi(x.t) - mi(y.t);
      list.sort((x, y) => y.pts - x.pts || base(x, y));
      // Bóng rổ / Kéo co: 2 đội bằng điểm → xét đối đầu trực tiếp
      if (useH2H) {
        for (let i = 0; i < list.length - 1; i++) {
          const blk = list.filter((r) => r.pts === list[i].pts);
          if (blk.length === 2 && list[i] === blk[0] && list[i + 1] === blk[1]) {
            const [x, y] = blk;
            if (h2h[y.t + '>' + x.t] && !h2h[x.t + '>' + y.t]) { list[i] = y; list[i + 1] = x; }
          }
        }
      }
      list.forEach((r, i) => { r.rank = i + 1; });
      const complete = gm.length > 0 && pending === 0;
      return { rows: list, complete, pending, played: gm.length - pending, total: gm.length };
    });
  }

  // ---------------- huy chương ----------------
  function finalMatch(ev) {
    if (!ev) return null;
    if (ev.kind === 'ind') return matches[ev.final] || null;
    return matches[`${ev.id}-F`] || null;
  }
  function feeders(m) {
    const out = [];
    for (const k of ['a', 'b']) {
      const r = m[k] && m[k].ref;
      if (!r) continue;
      if (r[0] === 'W') { const s = matches[r.slice(2)]; if (s) out.push({ kind: 'm', m: s }); }
      if (r[0] === 'T') out.push({ kind: 't', ids: r.slice(2).split(',') });
    }
    return out;
  }
  function podium(evId) {
    return cached('pod:' + evId, () => {
      const ev = events[evId];
      if (!ev) return [];
      if (Array.isArray(ev.podium) && ev.podium.length) {
        return ev.podium.map((p) => ({ rank: p.rank, side: ev.kind === 'ind' ? { kind: 'ath', t: p.t, p: p.p || '' } : { kind: 'team', t: p.t }, manual: true }));
      }
      const out = [];
      if (ev.format === 'RR') {
        const st = standings(evId, 'A');
        if (!st.complete) return [];
        st.rows.slice(0, 2 + (ev.bronze || 1)).forEach((r, i) => out.push({ rank: Math.min(i + 1, 3), side: { kind: 'team', t: r.t } }));
        return out;
      }
      const F = finalMatch(ev);
      if (!F) return [];
      const w = winner(F);
      if (w === 'a' || w === 'b') {
        const W = resolveSide(F, w), L = resolveSide(F, w === 'a' ? 'b' : 'a');
        if (W.kind === 'team' || W.kind === 'ath') out.push({ rank: 1, side: W });
        if (L.kind === 'team' || L.kind === 'ath') out.push({ rank: 2, side: L });
      }
      for (const f of feeders(F)) {
        let lose = null;
        if (f.kind === 'm') { const w2 = winner(f.m); if (w2 === 'a' || w2 === 'b') lose = resolveSide(f.m, w2 === 'a' ? 'b' : 'a'); }
        else { const w2 = tieWinner(f.ids, 0); if (w2 === 'a' || w2 === 'b') lose = resolveSide(matches[f.ids[0]], w2 === 'a' ? 'b' : 'a'); }
        if (lose && (lose.kind === 'team' || lose.kind === 'ath')) out.push({ rank: 3, side: lose });
      }
      return out.sort((a, b) => a.rank - b.rank);
    });
  }
  function medalTable(filter = {}) {
    const tally = new Map();
    for (const ev of Object.values(events)) {
      if (filter.level && ev.level !== filter.level) continue;
      if (filter.grade && ev.grade !== Number(filter.grade)) continue;
      if (filter.sport && ev.sport !== filter.sport) continue;
      for (const p of podium(ev.id)) {
        const t = p.side.t;
        if (!t) continue;
        const row = tally.get(t) || { t, g: 0, s: 0, b: 0, n: 0, items: [] };
        if (p.rank === 1) row.g++; else if (p.rank === 2) row.s++; else row.b++;
        row.n++;
        row.items.push({ ev: ev.id, rank: p.rank, p: p.side.p || '' });
        tally.set(t, row);
      }
    }
    return [...tally.values()].sort((x, y) => y.g - x.g || y.s - x.s || y.b - x.b || cmpClass(x.t, y.t));
  }

  // ---------------- tiện ích hiển thị ----------------
  function status(m) {
    if (m.st && m.st !== 'sched') return m.st;
    const w = winner(m);
    if (w === 'dead') return 'wo';
    const A = resolveSide(m, 'a'), B = resolveSide(m, 'b');
    if (A.kind === 'bye' || B.kind === 'bye') return 'wo';
    return 'sched';
  }
  const isReal = (m) => status(m) !== 'wo' && m.st !== 'cancel';
  function stageLabel(m) {
    const ev = events[m.ev] || {};
    if (m.stage === 'G') return ev.format === 'RR' ? 'Vòng tròn' : `Bảng ${m.group}`;
    if (ev.kind === 'team') {
      if (m.stage === 'QF') return 'Tứ kết ' + m.id.slice(-1);
      if (m.stage === 'SF') return 'Bán kết ' + m.id.slice(-1);
      if (m.stage === 'F') return 'Chung kết';
    }
    return m.label || '';
  }
  function matchNo(m) { return m.n && m.n < 99 ? `Trận ${m.branch || ''}${m.n}` : ''; }
  function sideName(r, opt = {}) {
    if (!r) return '';
    if (r.kind === 'team') return r.t;
    if (r.kind === 'ath') return opt.short ? (r.p || r.t) : (r.p ? `${r.p}${r.t ? ' (' + r.t + ')' : ''}` : r.t);
    if (r.kind === 'bye') return r.t ? `${r.t} – không thi đấu` : (r.label || 'Không thi đấu');
    return r.label || 'Chưa xác định';
  }
  function sidesOf(m) { return [resolveSide(m, 'a'), resolveSide(m, 'b')]; }
  function classesOf(m) { return sidesOf(m).map((r) => r.t).filter(Boolean); }

  function allClasses() {
    return cached('classes', () => {
      const set = new Set();
      for (const ev of Object.values(events)) if (ev.groups) Object.values(ev.groups).forEach((l) => l.forEach((t) => set.add(t)));
      return [...set].sort(cmpClass);
    });
  }
  function matchesOfClass(t) {
    return Object.values(matches).filter((m) => { const [A, B] = sidesOf(m); return (A.t === t && A.kind !== 'bye') || (B.t === t && B.kind !== 'bye'); }).sort(cmpMatch);
  }
  function eventsOf(filter = {}) {
    return Object.values(events).filter((e) => (!filter.sport || e.sport === filter.sport) && (!filter.level || e.level === filter.level) && (!filter.grade || e.grade === Number(filter.grade)))
      .sort((a, b) => a.grade - b.grade || SPORTS.findIndex((s) => s.id === a.sport) - SPORTS.findIndex((s) => s.id === b.sport) || String(a.cat || '').localeCompare(String(b.cat || '')));
  }
  function progress(filter = {}) {
    return cached('prog:' + JSON.stringify(filter), () => {
      let total = 0, done = 0;
      for (const m of Object.values(matches)) {
        const ev = events[m.ev];
        if (!ev) continue;
        if (filter.sport && ev.sport !== filter.sport) continue;
        if (filter.ev && m.ev !== filter.ev) continue;
        if (filter.grade && ev.grade !== Number(filter.grade)) continue;
        if (!isReal(m)) continue;
        total++;
        if (isDone(m)) done++;
      }
      return { total, done, pct: total ? Math.round((done * 100) / total) : 0 };
    });
  }

  return {
    events, matches, settings, byEv, points,
    resolveSide, winner, standings, podium, medalTable, finalMatch, feeders,
    status, isReal, stageLabel, matchNo, sideName, sidesOf, classesOf, allClasses, matchesOfClass, eventsOf, progress,
    matchesOf: (evId) => byEv[evId] || [],
  };
}
