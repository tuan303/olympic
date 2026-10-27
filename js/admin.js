// ============================================================
//  QUẢN TRỊ — dành cho Ban tổ chức / giáo viên phụ trách môn
// ============================================================
import { esc, todayISO, fmtDate, fmtDM, addDays, mondayOf, weekNo, weekdayLong, relTime, uid, clone, ls } from './util.js';
import { SPORTS, SPORT, LEVELS, levelOf, gradeOfClass, isDone, cmpMatch, cmpClass, FORFEIT, DEFAULT_POINTS, STATUS, POINTS_VER, NO_DRAW, forfeitSide } from './engine.js';
import { SPORT_ICON, I } from './icons.js';
import { sportTag, sportVars, capFirst, openModal, closeModal, toast, evCaption, levelName, shortName, ruleBody } from './ui.js';
import { hasFirebase, DEMO } from './store.js';

let ctx = null;
let dirty = new Set();
let pendingUpdate = false;
export const isBusy = () => dirty.size > 0 || !!document.querySelector('.modal [data-editor]');
export function notifyUpdate() {
  pendingUpdate = true;
  const b = document.getElementById('adm-refresh');
  if (b) b.classList.remove('hide');
}

const TABS = [
  { id: 'nhap', label: 'Nhập kết quả', icon: I.whistle },
  { id: 'tran', label: 'Lịch & trận đấu', icon: I.cal },
  { id: 'noi-dung', label: 'Bảng đấu & xếp hạng', icon: I.list },
  { id: 'doi-hinh', label: 'Danh sách VĐV', icon: I.users },
  { id: 'thong-bao', label: 'Thông báo', icon: I.bell, all: true },
  { id: 'dieu-le', label: 'Điều lệ', icon: I.book, all: true },
  { id: 'cai-dat', label: 'Cài đặt', icon: I.gear, all: true },
  { id: 'quyen', label: 'Quản trị viên', icon: I.users, super: true, live: true },
  { id: 'du-lieu', label: 'Dữ liệu & xuất file', icon: I.download },
  { id: 'nhat-ky', label: 'Nhật ký', icon: I.clock, super: true },
];

export function render(app, c) {
  ctx = c;
  dirty = new Set();
  pendingUpdate = false;
  const S = c.store.getState();
  if (!S.authReady) { app.innerHTML = `<div class="wrap page"><div class="skeleton" style="height:240px"></div></div>`; return; }
  if (!S.user) return loginView(app, S);
  if (!S.role) return noRoleView(app, S);
  const tab = c.route.parts[0] || 'nhap';
  if (tab !== 'nhat-ky') logCache = null;
  const allowed = TABS.filter((t) => (!t.super || S.role.super) && (!t.all || S.role.all || S.role.super) && (!t.live || S.mode !== 'local'));
  const cur = allowed.find((t) => t.id === tab) || allowed[0];
  const roleTxt = S.role.super ? 'Quản trị cao nhất' : S.role.all ? 'Quản trị toàn giải' : 'Phụ trách: ' + Object.keys(S.role.sports || {}).filter((k) => S.role.sports[k]).map((k) => SPORT[k] ? SPORT[k].name : k).join(', ');
  app.innerHTML = `<div class="wrap page">
    <div class="page-head"><div><div class="eyebrow">Quản trị giải</div><h1>${esc(cur.label)}</h1><p>${esc(S.user.name || S.user.email)} · ${esc(roleTxt)}${S.mode === 'local' ? ' · <b>chế độ xem thử: thay đổi chỉ lưu trên máy này</b>' : ''}</p></div>
      <div style="display:flex;gap:8px"><button class="btn hide" id="adm-refresh">${I.refresh} Có cập nhật mới – tải lại</button><button class="btn" id="adm-out">${I.logout} Đăng xuất</button></div></div>
    <div class="admin-tabs">${allowed.map((t) => `<a class="chip ${t.id === cur.id ? 'on' : ''}" href="#/quan-tri/${t.id}">${t.icon} ${esc(t.label)}</a>`).join('')}</div>
    <div id="adm-body"></div></div>`;
  app.querySelector('#adm-out').addEventListener('click', async () => { await c.store.signOut(); toast('Đã đăng xuất'); c.render(); });
  app.querySelector('#adm-refresh').addEventListener('click', () => { dirty.clear(); c.render(); });
  const body = app.querySelector('#adm-body');
  const tabsEl = app.querySelector('.admin-tabs'), onTab = tabsEl.querySelector('.chip.on');
  if (onTab && tabsEl.scrollWidth > tabsEl.clientWidth) tabsEl.scrollLeft = onTab.offsetLeft - tabsEl.offsetLeft - (tabsEl.clientWidth - onTab.offsetWidth) / 2;
  const views = { nhap: tabEntry, tran: tabMatches, 'noi-dung': tabEvents, 'doi-hinh': tabRosters, 'thong-bao': tabNews, 'dieu-le': tabRules, 'cai-dat': tabSettings, quyen: tabAdmins, 'du-lieu': tabData, 'nhat-ky': tabLogs };
  views[cur.id](body, S);
}

// ---------------- đăng nhập ----------------
function loginView(app, S) {
  const live = hasFirebase() && !DEMO;
  app.innerHTML = `<div class="wrap page"><div class="card login-card">
    <img src="assets/logo.svg" alt="">
    <h1 style="font-size:22px;font-weight:700">Quản trị giải Olympic</h1>
    <p class="muted">Dành cho Ban tổ chức và giáo viên phụ trách môn để cập nhật lịch, kết quả thi đấu.</p>
    ${live ? `<button class="ms-btn" id="login"><span class="ms-logo"><i style="background:#f25022"></i><i style="background:#7fba00"></i><i style="background:#00a4ef"></i><i style="background:#ffb900"></i></span>Đăng nhập bằng Microsoft 365</button>
      ${S.denied ? `<div class="banner warn" style="border-radius:10px;margin-top:14px;padding:10px 12px;text-align:left"><b>${esc(S.denied)}</b> không có quyền quản trị giải nên đã bị đăng xuất. Nhờ quản trị cao nhất (Tổ CNTT) cấp quyền rồi đăng nhập lại.</div>` : ''}
      <p class="muted small" style="margin-top:14px">Chỉ những email được Ban tổ chức cấp quyền mới đăng nhập được.</p>
      <p class="small" style="margin-top:18px"><a href="?demo=1#/quan-tri" style="color:var(--royal);font-weight:700">Tập dượt nhập kết quả (không ảnh hưởng dữ liệu thật) →</a></p>`
    : `<button class="btn primary" id="login">${I.gear} Vào quản trị (chế độ xem thử)</button>
      <p class="muted small" style="margin-top:14px">Chưa kết nối máy chủ: mọi thay đổi chỉ lưu trên trình duyệt này để chạy thử. Khi kết nối Firebase, trang này dùng đăng nhập Microsoft 365 của trường.</p>`}
  </div></div>`;
  app.querySelector('#login').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await ctx.store.signIn(); ctx.render(); }
    catch (err) { toast('Đăng nhập không thành công: ' + (err.code || err.message), 'err'); e.target.disabled = false; }
  });
}
function noRoleView(app, S) {
  app.innerHTML = `<div class="wrap page"><div class="card login-card"><img src="assets/logo.svg" alt="">
    <h1 style="font-size:20px;font-weight:700">Tài khoản chưa được cấp quyền</h1>
    <p class="muted">${esc(S.user.email)} chưa có trong danh sách quản trị của giải. Nhờ quản trị cao nhất (Tổ CNTT) cấp quyền theo môn bạn phụ trách.</p>
    <button class="btn" id="adm-out">${I.logout} Đăng xuất</button></div></div>`;
  app.querySelector('#adm-out').addEventListener('click', async () => { await ctx.store.signOut(); ctx.render(); });
}

// ---------------- tiện ích ----------------
const canSport = (sp) => ctx.store.canEdit(sp);
const mySports = () => SPORTS.filter((s) => canSport(s.id));
function sideLabel(E, r) { return E.sideName(r); }
function download(name, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + text : text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// ô bắt đầu bằng = + - @ (công thức Excel; trừ số âm) → thêm ' phía trước để Excel hiểu là chữ
const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-\d+(\.\d+)?$/.test(s))) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
function venuesOf(E) { return [...new Set(Object.values(E.matches).map((m) => m.venue).filter(Boolean))].sort(); }

// ============================================================
//  1) NHẬP KẾT QUẢ NHANH THEO NGÀY
// ============================================================
function tabEntry(body, S) {
  const E = S.engine;
  const q = ctx.route.q;
  const sports = mySports();
  const today = todayISO();
  const allDates = [...new Set(Object.values(E.matches).filter((m) => canSport(m.ev.split('-')[0])).map((m) => m.date))].sort();
  const day = q.get('d') || (allDates.includes(today) ? today : allDates.find((d) => d > today) || allDates[allDates.length - 1]);
  const sp = q.get('m') || '', k = q.get('k') || '';
  const onlyTodo = q.get('todo') === '1';
  const mon = mondayOf(day);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
  const list = Object.values(E.matches).filter((m) => {
    const ev = E.events[m.ev];
    if (!ev || !canSport(ev.sport) || m.date !== day) return false;
    if (sp && ev.sport !== sp) return false;
    if (k && ev.grade !== Number(k)) return false;
    if (E.status(m) === 'wo') return false;
    if (onlyTodo && isDone(m)) return false;
    return true;
  }).sort((a, b) => E.events[a.ev].grade - E.events[b.ev].grade || cmpMatch(a, b));
  // quá hạn chưa nhập
  const overdue = Object.values(E.matches).filter((m) => { const ev = E.events[m.ev]; return ev && canSport(ev.sport) && m.date < today && !isDone(m) && !['post', 'cancel'].includes(m.st) && E.status(m) !== 'wo' && E.sidesOf(m).every((r) => r.kind === 'team' || r.kind === 'ath'); });
  const rows = list.map((m) => entryRow(E, m)).join('');
  const lateKO = scheduleIssues(E);
  body.innerHTML = `
    ${lateKO.length ? `<div class="card card-pad" style="margin-bottom:12px;border-color:#f3dc8a;background:#fffaf0"><b style="color:#7a5a00">⚠ ${lateKO.length} trận vòng trong có ngày thi đấu sớm hơn trận dẫn vào — kiểm tra lại lịch.</b> <button class="btn sm" id="show-late" style="margin-left:6px">Xem danh sách</button></div>` : ''}
    ${overdue.length ? `<div class="card card-pad" style="margin-bottom:12px;border-color:#f7c9d1;background:#fff5f6"><b style="color:#8c1024">${overdue.length} trận đã qua ngày nhưng chưa có kết quả.</b> <button class="btn sm" id="show-overdue" style="margin-left:6px">Xem danh sách</button></div>` : ''}
    <div class="daybar"><button class="nav" data-wk="-7">${I.left}</button><div class="days">${days.map((d) => `<button class="dbtn ${d === day ? 'on' : ''} ${d === today ? 'today' : ''}" data-day="${d}"><span class="w">${esc(fmtDate(d).split(',')[0])}</span><span class="d">${esc(fmtDM(d))}</span></button>`).join('')}</div><button class="nav" data-wk="7">${I.right}</button></div>
    <div class="filters">
      <div class="chips">${[['', 'Tất cả môn'], ...sports.map((s) => [s.id, s.name])].map(([id, n]) => `<button class="chip ${sp === id ? 'on' : ''}" data-m="${id}">${id ? SPORT_ICON[id] : ''}${esc(n)}</button>`).join('')}</div>
      <select class="sel" id="fk"><option value="">Tất cả khối</option>${LEVELS.flatMap((l) => l.grades).map((g) => `<option value="${g}" ${String(g) === k ? 'selected' : ''}>Khối ${g}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="ftodo" ${onlyTodo ? 'checked' : ''}> Chỉ trận chưa có kết quả</label>
    </div>
    <div class="card">${rows || `<div class="empty-box">${I.cal}<b>Không có trận trong ngày ${esc(fmtDM(day))}</b>Chọn ngày khác ở thanh phía trên.</div>`}</div>
    <p class="help">Nhập tỉ số rồi bấm <b>Lưu</b> (hoặc Enter). Kéo co nhập số <b>hiệp</b> thắng (2–1, 2–0). Trận vòng trong hòa → chọn đội thắng luân lưu/hiệp phụ. Bấm <b>⋯</b> để đổi giờ, sân, ghi thẻ phạt, xử thua.</p>`;
  body.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => ctx.setQuery({ d: b.dataset.day })));
  body.querySelectorAll('[data-wk]').forEach((b) => b.addEventListener('click', () => ctx.setQuery({ d: addDays(mon, Number(b.dataset.wk)) })));
  body.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => ctx.setQuery({ m: b.dataset.m })));
  body.querySelector('#fk').addEventListener('change', (e) => ctx.setQuery({ k: e.target.value }));
  body.querySelector('#ftodo').addEventListener('change', (e) => ctx.setQuery({ todo: e.target.checked ? '1' : null }));
  const lt = body.querySelector('#show-late');
  if (lt) lt.addEventListener('click', () => {
    const html = `<div class="modal-h"><h3>Trận vòng trong xếp lịch sớm hơn trận dẫn vào (${lateKO.length})</h3><button class="btn ghost sm" data-close>${I.x}</button></div>
      <div class="modal-b" style="max-height:60vh;overflow:auto;padding:0"><div class="mlist">${lateKO.map((x) => `<div class="mrow" data-open="${esc(x.m.id)}"><div class="when"><b>${esc(fmtDate(x.m.date))}</b>${esc(x.m.time || '')}</div><div class="mid"><div class="meta">${sportTag(E.events[x.m.ev].sport)}<span class="stg">${esc(evCaption(E, x.m))}</span></div><span class="small muted">${esc(x.why)}</span></div><div class="right"><span class="btn sm">${I.edit} Sửa lịch</span></div></div>`).join('')}</div></div>`;
    const md = openModal(html, { wide: true });
    md.querySelectorAll('[data-open]').forEach((r) => r.addEventListener('click', () => { closeModal(); openEditor(r.dataset.open, ctx); }));
  });
  const ov = body.querySelector('#show-overdue');
  if (ov) ov.addEventListener('click', () => overdueModal(E, overdue));
  wireEntryRows(body, S);
}
// Trận vòng trong có ngày sớm hơn trận dẫn vào / trước khi vòng bảng kết thúc (lỗi nhập lịch)
function scheduleIssues(E) {
  const out = [];
  const lastG = {};
  Object.values(E.matches).forEach((m) => { if (m.stage === 'G' && m.date && (!lastG[m.ev] || m.date > lastG[m.ev])) lastG[m.ev] = m.date; });
  for (const m of Object.values(E.matches)) {
    const ev = E.events[m.ev];
    if (!ev || !canSport(ev.sport) || !m.date || m.stage === 'G' || isDone(m) || ['cancel', 'post'].includes(m.st)) continue;
    let why = '';
    for (const k of ['a', 'b']) {
      const r = m[k] && m[k].ref;
      if (!r || !/^[WLT]:/.test(r)) continue;
      for (const id of r.slice(2).split(',')) { const f = E.matches[id]; if (f && f.date && f.date > m.date) why = `Trận dẫn vào (${capFirst(E.stageLabel(f))}) đấu ${fmtDM(f.date)}`; }
    }
    if (!why && ev.kind === 'team' && lastG[m.ev] && m.date < lastG[m.ev]) why = `Vòng bảng còn trận ngày ${fmtDM(lastG[m.ev])}`;
    if (why) out.push({ m, why });
  }
  return out.sort((a, b) => cmpMatch(a.m, b.m));
}
function entryRow(E, m) {
  const ev = E.events[m.ev];
  const [A, B] = E.sidesOf(m);
  const ready = (A.kind === 'team' || A.kind === 'ath') && (B.kind === 'team' || B.kind === 'ath');
  const st = m.st || 'sched';
  const ko = m.stage !== 'G' || !!NO_DRAW[ev.sport]; // vòng trong, hoặc môn không có hòa (Bóng rổ: hiệp phụ / ném phạt)
  const w = m.w || '';
  const drawKO = ko && isDone(m) && m.sa === m.sb;
  const nm = (r) => { const t = sideLabel(E, r); return r.kind === 'ath' && r.p ? `<b title="${esc(t)}">${esc(shortName(r.p))}</b><small>${esc(r.t)}</small>` : `<b>${esc(t)}</b>`; };
  return `<div class="arow" data-row="${esc(m.id)}">
    <div class="a-when"><b class="num">${esc(m.time || '—')}</b><span title="${esc(m.venue || '')}">${esc(m.venue || '')}</span></div>
    <div class="a-info">${sportTag(ev.sport)}<span class="a-cap">${esc(evCaption(E, m))}</span>${m.upd ? `<span class="muted xs">· sửa ${esc(relTime(m.upd))}</span>` : ''}</div>
    <div class="a-score">${ready
      ? `<div class="a-side a">${nm(A)}</div><input class="a-in" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" aria-label="Tỉ số ${esc(sideLabel(E, A))}" data-sa value="${m.sa ?? ''}"><span class="a-dash">–</span><input class="a-in" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" aria-label="Tỉ số ${esc(sideLabel(E, B))}" data-sb value="${m.sb ?? ''}"><div class="a-side b">${nm(B)}</div>`
      : `<div class="a-side a">${nm(A)}</div><span class="a-wait">Chờ xác định đội</span><div class="a-side b">${nm(B)}</div>`}</div>
    ${ko ? `<div class="a-wl wline ${drawKO ? '' : 'hide'}">Hòa → đội thắng: <label><input type="radio" name="w-${esc(m.id)}" value="a" ${w === 'a' ? 'checked' : ''}> ${esc(A.t || A.label || 'A')}</label><label><input type="radio" name="w-${esc(m.id)}" value="b" ${w === 'b' ? 'checked' : ''}> ${esc(B.t || B.label || 'B')}</label></div>` : ''}
    <select class="a-st" data-st aria-label="Trạng thái">${Object.entries(STATUS).filter(([kk]) => kk !== 'wo').map(([kk, v]) => `<option value="${kk}" ${st === kk ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
    <div class="a-acts"><button class="btn sm" data-more title="Sửa chi tiết: giờ, sân, xử thua…" aria-label="Sửa chi tiết">⋯</button><button class="btn sm primary" data-save ${ready ? '' : 'disabled'}>${I.check} Lưu</button></div>
  </div>`;
}
function wireEntryRows(root, S) {
  const E0 = S.engine;
  root.querySelectorAll('[data-row]').forEach((row) => {
    const id = row.dataset.row;
    const mark = () => { row.classList.add('dirty'); row.classList.remove('saved'); dirty.add(id); };
    const sa = row.querySelector('[data-sa]'), sb = row.querySelector('[data-sb]'), st = row.querySelector('[data-st]');
    const wl = row.querySelector('.wline');
    const onScore = () => {
      mark();
      if (sa.value !== '' && sb.value !== '' && st.value === 'sched') st.value = 'done';
      if (wl) wl.classList.toggle('hide', !(sa.value !== '' && sa.value === sb.value));
    };
    if (sa) { sa.addEventListener('input', onScore); sb.addEventListener('input', onScore); }
    st.addEventListener('change', mark);
    row.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', mark));
    const save = async () => {
      const cur = ctx.store.getState().db.matches[id];
      if (!cur) return;
      const m = clone(cur);
      const va = sa ? sa.value.trim() : '', vb = sb ? sb.value.trim() : '';
      if ((va === '') !== (vb === '')) { toast('Nhập đủ tỉ số hai bên', 'err'); return; }
      if (va !== '' && (!/^\d{1,3}$/.test(va) || !/^\d{1,3}$/.test(vb))) { toast('Tỉ số phải là số', 'err'); return; }
      m.st = st.value;
      if (va !== '') { m.sa = Number(va); m.sb = Number(vb); } else { delete m.sa; delete m.sb; }
      if (m.st === 'done' && va === '') { toast('Trận "Kết thúc" cần có tỉ số', 'err'); return; }
      const wr = row.querySelector('input[type=radio]:checked');
      const noDraw = m.stage !== 'G' || !!NO_DRAW[(E0.events[m.ev] || {}).sport];
      if (noDraw && m.st === 'done' && m.sa === m.sb) {
        if (!wr) { toast(m.stage !== 'G' ? 'Trận vòng trong hòa: chọn đội thắng (luân lưu / hiệp phụ)' : 'Bóng rổ không có hòa: chọn đội thắng hiệp phụ / ném phạt', 'err'); return; }
        m.w = wr.value;
      } else delete m.w;
      if (m.st === 'sched') { delete m.sa; delete m.sb; delete m.w; }
      // tỉ số / trạng thái đổi ở ô nhập nhanh → bỏ dấu xử thua cũ (nếu không, Bóng rổ vẫn cho đội đó 0 điểm)
      if (m.st !== 'done' || m.sa !== cur.sa || m.sb !== cur.sb) { delete m.ff; if (/xử\s*thua/i.test(m.pen || '')) delete m.pen; }
      const btn = row.querySelector('[data-save]');
      btn.disabled = true;
      try {
        await ctx.store.saveMatch(m, 'Nhập kết quả');
        dirty.delete(id);
        row.classList.remove('dirty'); row.classList.add('saved');
        toast('Đã lưu ' + (m.st === 'done' ? `${m.sa}–${m.sb}` : STATUS[m.st].name), 'ok');
        if (!dirty.size && pendingUpdate) ctx.render();
        else if (!dirty.size) setTimeout(() => { if (!dirty.size) ctx.render(); }, 600);
      } catch (e) { toast(e.message, 'err'); }
      btn.disabled = false;
    };
    row.querySelector('[data-save]').addEventListener('click', save);
    row.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); }));
    row.querySelector('[data-more]').addEventListener('click', () => openEditor(id, ctx));
  });
}
function overdueModal(E, list) {
  const html = `<div class="modal-h"><h3>Trận đã qua ngày, chưa có kết quả (${list.length})</h3><button class="btn ghost sm" data-close>${I.x}</button></div>
    <div class="modal-b" style="max-height:60vh;overflow:auto;padding:0"><div class="mlist">${list.sort(cmpMatch).map((m) => `<div class="mrow" data-open="${esc(m.id)}"><div class="when"><b>${esc(fmtDate(m.date))}</b>${esc(m.time || '')}</div><div class="mid"><div class="meta">${sportTag(E.events[m.ev].sport)}<span class="stg">${esc(evCaption(E, m))}</span></div><b>${esc(E.sideName(E.resolveSide(m, 'a')))} – ${esc(E.sideName(E.resolveSide(m, 'b')))}</b></div><div class="right"><span class="btn sm">${I.edit} Nhập</span></div></div>`).join('')}</div></div>`;
  const md = openModal(html, { wide: true });
  md.querySelectorAll('[data-open]').forEach((r) => r.addEventListener('click', () => { closeModal(); openEditor(r.dataset.open, ctx); }));
}

// ============================================================
//  HỘP SỬA TRẬN ĐẦY ĐỦ
// ============================================================
export function openEditor(id, c, opt = {}) {
  ctx = ctx || c;
  const S = c.store.getState();
  const E = S.engine;
  const orig = opt.newMatch || S.db.matches[id];
  if (!orig) return toast('Không tìm thấy trận', 'err');
  const m = clone(orig);
  const ev = E.events[m.ev];
  if (!c.store.canEdit(ev.sport)) return toast('Bạn không có quyền sửa môn ' + SPORT[ev.sport].name, 'err');
  const team = ev.kind === 'team';
  const teams = team ? Object.values(ev.groups || {}).flat().sort(cmpClass) : [];
  const [A, B] = E.sidesOf(m);
  const sideField = (k, r) => {
    const s = m[k] || {};
    if (team) {
      return `<label class="field"><span>Đội ${k.toUpperCase()}${s.ref ? ` · tự điền: ${esc(r.via || r.label || '')}` : ''}</span>
        <select class="sel" data-side="${k}"><option value="__ref" ${s.ref ? 'selected' : ''} ${s.ref ? '' : 'disabled'}>${s.ref ? `Tự điền (${esc(r.kind === 'team' ? r.t : r.label)})` : '—'}</option>${teams.map((t) => `<option value="${esc(t)}" ${!s.ref && s.t === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    }
    return `<div class="field"><span>VĐV ${k.toUpperCase()}${s.ref ? ` · tự điền: ${esc(r.via || r.label || '')}` : ''}</span>
      <div style="display:flex;gap:6px"><input class="inp" style="flex:1" data-p="${k}" placeholder="${s.ref ? esc(r.kind === 'ath' ? r.p : r.label) : 'Họ tên'}" value="${s.ref ? '' : esc(s.p || '')}"><input class="inp" style="width:90px" data-t="${k}" placeholder="Lớp" value="${s.ref ? '' : esc(s.t || '')}"></div>
      <label class="check xs"><input type="checkbox" data-bye="${k}" ${s.bye ? 'checked' : ''}> Không thi đấu / bỏ cuộc</label></div>`;
  };
  const foot = ev.sport === 'bongda';
  const html = `<div data-editor><div class="modal-h"><h3>${sportTag(ev.sport)} <span style="margin-left:6px">${esc(ev.name)} · ${esc(capFirst(E.stageLabel(m)))}${E.matchNo(m) ? ' · ' + esc(E.matchNo(m)) : ''}</span></h3><button class="btn ghost sm" data-close>${I.x}</button></div>
  <div class="modal-b"><div class="formgrid">
    ${sideField('a', A)}${sideField('b', B)}
    <label class="field"><span>Tỉ số ${esc(team ? 'A' : 'VĐV A')} (${esc(SPORT[ev.sport].unit)})</span><input class="inp" id="e-sa" inputmode="numeric" value="${m.sa ?? ''}"></label>
    <label class="field"><span>Tỉ số ${esc(team ? 'B' : 'VĐV B')}</span><input class="inp" id="e-sb" inputmode="numeric" value="${m.sb ?? ''}"></label>
    <label class="field"><span>Trạng thái</span><select class="sel" id="e-st">${Object.entries(STATUS).filter(([kk]) => kk !== 'wo').map(([kk, v]) => `<option value="${kk}" ${(m.st || 'sched') === kk ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Người thắng (khi hòa ở vòng trong / xử thắng)</span><select class="sel" id="e-w"><option value="">Theo tỉ số</option><option value="a" ${m.w === 'a' ? 'selected' : ''}>Bên A</option><option value="b" ${m.w === 'b' ? 'selected' : ''}>Bên B</option></select></label>
    <label class="field full"><span>Ghi chú kết quả (VD: Luân lưu 4–3, xử thua do đến muộn…)</span><input class="inp" id="e-pen" value="${esc(m.pen || '')}"></label>
    ${foot ? `<div class="field full"><span>Thẻ phạt (dùng khi bằng điểm, thẻ đỏ = 2 thẻ vàng)</span><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">A: <input class="inp" style="width:64px" id="e-ya" placeholder="vàng" value="${m.ya || ''}"><input class="inp" style="width:64px" id="e-ra" placeholder="đỏ" value="${m.ra || ''}"> &nbsp; B: <input class="inp" style="width:64px" id="e-yb" placeholder="vàng" value="${m.yb || ''}"><input class="inp" style="width:64px" id="e-rb" placeholder="đỏ" value="${m.rb || ''}"></div></div>` : ''}
    <label class="field"><span>Ngày thi đấu</span><input class="inp" type="date" id="e-date" value="${esc(m.date || '')}"></label>
    <div class="field"><span>Giờ</span><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="time" id="e-time" value="${esc(m.time || '')}"> – <input class="inp" type="time" id="e-end" value="${esc(m.end || '')}"></div></div>
    <label class="field full"><span>Sân / địa điểm</span><input class="inp" id="e-venue" list="venues" value="${esc(m.venue || '')}"><datalist id="venues">${venuesOf(E).map((v) => `<option value="${esc(v)}">`).join('')}</datalist></label>
    <label class="field full"><span>Ghi chú công khai (hiển thị cho người xem)</span><input class="inp" id="e-note" value="${esc(m.note || '')}" placeholder="VD: Hoãn do mưa, đá bù thứ Sáu tuần sau"></label>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn sm" data-ff="b">Xử thua bên A (${FORFEIT[ev.sport].join('–').split('–').reverse().join('–')})</button><button class="btn sm" data-ff="a">Xử thua bên B (${FORFEIT[ev.sport].join('–')})</button><button class="btn sm" id="e-clear">Xóa kết quả</button></div>
  ${m.src ? `<p class="help" style="margin-top:10px">Nguồn Excel: ${esc(m.src)}</p>` : ''}
  </div>
  <div class="modal-f">${opt.newMatch ? '' : `<button class="btn red" id="e-del" style="margin-right:auto">${I.trash} Xóa trận</button>`}<button class="btn" data-close>Hủy</button><button class="btn primary" id="e-save">${I.check} Lưu thay đổi</button></div></div>`;
  const md = openModal(html, { wide: true });
  const $ = (s) => md.querySelector(s);
  md.querySelectorAll('[data-ff]').forEach((b) => b.addEventListener('click', () => {
    const f = FORFEIT[ev.sport];
    if (b.dataset.ff === 'a') { $('#e-sa').value = f[0]; $('#e-sb').value = f[1]; $('#e-w').value = 'a'; $('#e-pen').value = 'Bên B bị xử thua (bỏ cuộc / đến muộn)'; }
    else { $('#e-sa').value = f[1]; $('#e-sb').value = f[0]; $('#e-w').value = 'b'; $('#e-pen').value = 'Bên A bị xử thua (bỏ cuộc / đến muộn)'; }
    $('#e-st').value = 'done';
  }));
  $('#e-clear').addEventListener('click', () => { $('#e-sa').value = ''; $('#e-sb').value = ''; $('#e-w').value = ''; $('#e-pen').value = ''; $('#e-st').value = 'sched'; });
  const del = $('#e-del');
  if (del) del.addEventListener('click', async () => {
    if (!confirm('Xóa hẳn trận này khỏi lịch? (Có thể khôi phục bằng file sao lưu)')) return;
    try { await c.store.deleteMatch(m.id); closeModal(); toast('Đã xóa trận', 'ok'); c.render(); } catch (e) { toast(e.message, 'err'); }
  });
  $('#e-save').addEventListener('click', async () => {
    const out = clone(m);
    for (const k of ['a', 'b']) {
      if (team) {
        const v = md.querySelector(`[data-side="${k}"]`).value;
        if (v !== '__ref') out[k] = { t: v };
      } else {
        const p = md.querySelector(`[data-p="${k}"]`).value.trim(), t = md.querySelector(`[data-t="${k}"]`).value.trim().toUpperCase();
        const bye = md.querySelector(`[data-bye="${k}"]`).checked;
        if (p || t) out[k] = { p, t, ...(bye ? { bye: true } : {}) };
        else if (bye) out[k] = { ...(out[k] || {}), bye: true };
        else if (out[k] && out[k].bye && !out[k].ref) delete out[k].bye;
      }
    }
    const va = $('#e-sa').value.trim(), vb = $('#e-sb').value.trim();
    if ((va === '') !== (vb === '') || (va && (!/^\d{1,3}$/.test(va) || !/^\d{1,3}$/.test(vb)))) return toast('Tỉ số không hợp lệ', 'err');
    out.st = $('#e-st').value;
    if (va !== '') { out.sa = Number(va); out.sb = Number(vb); } else { delete out.sa; delete out.sb; }
    if (out.st === 'done' && va === '') return toast('Trận "Kết thúc" cần có tỉ số', 'err');
    const w = $('#e-w').value; if (w) out.w = w; else delete out.w;
    if ((out.stage !== 'G' || NO_DRAW[ev.sport]) && out.st === 'done' && out.sa === out.sb && !out.w) return toast(out.stage !== 'G' ? 'Vòng trong hòa: chọn người thắng' : 'Bóng rổ không có hòa: chọn đội thắng hiệp phụ / ném phạt', 'err');
    const pen = $('#e-pen').value.trim(); if (pen) out.pen = pen; else delete out.pen;
    const ffs = forfeitSide({ pen, sa: out.sa, sb: out.sb }); // bên bỏ cuộc (Bóng rổ: 0 điểm)
    if (ffs && out.st === 'done') out.ff = ffs; else delete out.ff;
    if (foot) for (const f of ['ya', 'ra', 'yb', 'rb']) { const v = Number($('#e-' + f).value) || 0; if (v) out[f] = v; else delete out[f]; }
    out.date = $('#e-date').value; out.time = $('#e-time').value; out.end = $('#e-end').value;
    out.venue = $('#e-venue').value.trim();
    const note = $('#e-note').value.trim(); if (note) out.note = note; else delete out.note;
    if (out.st === 'sched') { delete out.sa; delete out.sb; }
    try {
      await c.store.saveMatch(out, opt.newMatch ? 'Thêm trận' : 'Sửa trận');
      closeModal(); toast('Đã lưu', 'ok'); c.render();
    } catch (e) { toast(e.message, 'err'); }
  });
}

// ============================================================
//  2) LỊCH & TRẬN ĐẤU (tìm, sửa, thêm)
// ============================================================
function tabMatches(body, S) {
  const E = S.engine;
  const q = ctx.route.q;
  const sp = q.get('m') || (mySports()[0] || {}).id || '';
  const k = q.get('k') || '';
  const evs = E.eventsOf({ sport: sp, grade: k }).filter((e) => canSport(e.sport));
  const evId = q.get('ev') || '';
  const text = (q.get('q') || '').toLowerCase();
  const list = Object.values(E.matches).filter((m) => {
    const ev = E.events[m.ev];
    if (!ev || ev.sport !== sp || !canSport(ev.sport)) return false;
    if (k && ev.grade !== Number(k)) return false;
    if (evId && m.ev !== evId) return false;
    if (text) { const hay = (E.sidesOf(m).map((r) => E.sideName(r)).join(' ') + ' ' + (m.venue || '') + ' ' + m.date).toLowerCase(); if (!hay.includes(text)) return false; }
    return true;
  }).sort(cmpMatch);
  body.innerHTML = `<div class="filters">
      <div class="chips">${mySports().map((s) => `<button class="chip ${sp === s.id ? 'on' : ''}" data-m="${s.id}">${SPORT_ICON[s.id]}${esc(s.name)}</button>`).join('')}</div>
      <select class="sel" id="fk"><option value="">Tất cả khối</option>${LEVELS.flatMap((l) => l.grades).map((g) => `<option value="${g}" ${String(g) === k ? 'selected' : ''}>Khối ${g}</option>`).join('')}</select>
      <select class="sel" id="fev"><option value="">Tất cả nội dung</option>${evs.map((e) => `<option value="${e.id}" ${e.id === evId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      <div class="search"><span>${I.search}</span><input class="inp" id="fq" value="${esc(q.get('q') || '')}" placeholder="Tìm lớp, tên VĐV, sân…"></div>
      <button class="btn primary" id="add">${I.plus} Thêm trận</button>
    </div>
    <div class="card"><div class="mlist">${list.slice(0, 400).map((m) => {
      const [A, B] = E.sidesOf(m);
      return `<div class="mrow" data-open="${esc(m.id)}"><div class="when"><b>${esc(fmtDate(m.date))}</b>${esc(m.time || '')}</div>
        <div class="mid"><div class="meta"><span class="stg">${esc(evCaption(E, m))}</span>${E.status(m) !== 'sched' ? `<span class="st ${STATUS[E.status(m)].cls}">${esc(STATUS[E.status(m)].name)}</span>` : ''}</div>
        <b>${esc(E.sideName(A))}</b> ${isDone(m) ? `<b>${m.sa} – ${m.sb}</b>` : '<span class="muted">vs</span>'} <b>${esc(E.sideName(B))}</b></div>
        <div class="right"><span class="venue">${esc(m.venue || '')}</span><span class="btn sm">${I.edit} Sửa</span></div></div>`;
    }).join('') || '<div class="empty-box">Không có trận.</div>'}</div></div>
    ${list.length > 400 ? `<p class="help">Đang hiện 400/${list.length} trận — lọc theo khối/nội dung để xem thêm.</p>` : ''}`;
  body.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => ctx.setQuery({ m: b.dataset.m, ev: null })));
  body.querySelector('#fk').addEventListener('change', (e) => ctx.setQuery({ k: e.target.value, ev: null }));
  body.querySelector('#fev').addEventListener('change', (e) => ctx.setQuery({ ev: e.target.value }));
  const fq = body.querySelector('#fq');
  fq.addEventListener('change', () => ctx.setQuery({ q: fq.value.trim() }));
  body.querySelectorAll('[data-open]').forEach((r) => r.addEventListener('click', () => openEditor(r.dataset.open, ctx)));
  body.querySelector('#add').addEventListener('click', () => addMatchModal(E, sp, evId || (evs[0] && evs[0].id)));
}
function addMatchModal(E, sp, evId) {
  const evs = E.eventsOf({ sport: sp }).filter((e) => canSport(e.sport));
  const html = `<div class="modal-h"><h3>${I.plus} Thêm trận mới</h3><button class="btn ghost sm" data-close>${I.x}</button></div>
    <div class="modal-b"><div class="formgrid">
      <label class="field full"><span>Nội dung</span><select class="sel" id="n-ev">${evs.map((e) => `<option value="${e.id}" ${e.id === evId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Loại trận</span><select class="sel" id="n-stage"><option value="G">Vòng bảng</option><option value="R">Vòng loại / thi đấu lại</option><option value="QF">Tứ kết</option><option value="SF">Bán kết</option><option value="F">Chung kết</option></select></label>
      <label class="field"><span>Bảng (nếu vòng bảng)</span><input class="inp" id="n-group" placeholder="A"></label>
    </div><p class="help">Sau khi tạo, hộp sửa trận mở ra để chọn đội/VĐV, ngày giờ, sân.</p></div>
    <div class="modal-f"><button class="btn" data-close>Hủy</button><button class="btn primary" id="n-ok">Tiếp tục</button></div>`;
  const md = openModal(html);
  md.querySelector('#n-ok').addEventListener('click', () => {
    const ev = md.querySelector('#n-ev').value, stage = md.querySelector('#n-stage').value;
    const id = `${ev}-x${uid()}`;
    const today = todayISO();
    const m = { id, ev, stage, a: {}, b: {}, date: today, time: '', end: '', venue: '' };
    if (stage === 'G') m.group = (md.querySelector('#n-group').value.trim().toUpperCase() || Object.keys(E.events[ev].groups || { A: 1 })[0]);
    if (stage !== 'G') m.label = { R: 'Vòng loại', QF: 'Tứ kết', SF: 'Bán kết', F: 'Chung kết' }[stage];
    closeModal();
    openEditor(id, ctx, { newMatch: m });
  });
}

// ============================================================
//  3) BẢNG ĐẤU, XẾP HẠNG TAY, HUY CHƯƠNG TAY
// ============================================================
function tabEvents(body, S) {
  const E = S.engine;
  const q = ctx.route.q;
  const evs = E.eventsOf({}).filter((e) => canSport(e.sport));
  const evId = q.get('ev') || (evs[0] && evs[0].id);
  const ev = E.events[evId];
  const sel = `<div class="filters"><select class="sel" id="fev" style="min-width:280px">${LEVELS.map((l) => `<optgroup label="${esc(l.name)}">${evs.filter((e) => e.level === l.id).map((e) => `<option value="${e.id}" ${e.id === evId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>`;
  if (!ev) { body.innerHTML = sel + '<div class="card empty-box">Chọn nội dung.</div>'; return; }
  const team = ev.kind === 'team';
  const groups = team ? Object.keys(ev.groups) : [];
  const pod = E.podium(ev.id);
  const cands = team ? Object.values(ev.groups).flat().sort(cmpClass) : [];
  const podRow = (rank, i) => {
    const cur = (ev.podium || []).filter((p) => p.rank === rank)[i] || {};
    return team
      ? `<label class="field"><span>${rank === 1 ? 'Nhất (HCV)' : rank === 2 ? 'Nhì (HCB)' : 'Ba (HCĐ)'}</span><select class="sel" data-pod="${rank}"><option value="">—</option>${cands.map((t) => `<option ${cur.t === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`
      : `<div class="field"><span>${rank === 1 ? 'Nhất (HCV)' : rank === 2 ? 'Nhì (HCB)' : 'Ba (HCĐ)'}</span><div style="display:flex;gap:6px"><input class="inp" style="flex:1" data-podp="${rank}" placeholder="Họ tên" value="${esc(cur.p || '')}"><input class="inp" style="width:84px" data-pod="${rank}" placeholder="Lớp" value="${esc(cur.t || '')}"></div></div>`;
  };
  body.innerHTML = `${sel}
    ${team ? `<div class="card card-pad"><h3 style="font-weight:700;margin-bottom:6px">Thành phần các bảng</h3><p class="help" style="margin-top:0">Mỗi bảng một dòng, các lớp cách nhau bằng dấu phẩy. Khi các đội bằng mọi chỉ số và BTC đã <b>bốc thăm</b>, nhập kết quả vào ô «Thứ tự bốc thăm» (lớp xếp trên ghi trước) — không cần đổi thứ tự trong bảng.</p>
      <div class="formgrid">${groups.map((g) => { const st = E.standings(ev.id, g); return `<label class="field"><span>${ev.format === 'RR' ? 'Vòng tròn' : 'Bảng ' + g} — hiện tại: ${st.rows.map((r) => r.t).join(' › ')}</span><input class="inp" data-group="${g}" value="${esc(ev.groups[g].join(', '))}"></label>
        <label class="field"><span>Thứ tự bốc thăm khi bằng chỉ số (để trống nếu không cần)</span><input class="inp" data-order="${g}" value="${esc(((ev.manualOrder || {})[g] || []).join(', '))}" placeholder="VD: ${esc(ev.groups[g].slice(0, 2).join(', '))}"></label>`; }).join('')}</div></div>` : ''}
    <div class="card card-pad section"><h3 style="font-weight:700;margin-bottom:6px">Thứ hạng chung cuộc</h3>
      <p class="help" style="margin-top:0">Hệ thống tự xác định từ trận chung kết/bán kết${ev.format === 'RR' ? ' hoặc bảng xếp hạng' : ''}. Chỉ điền ở đây khi BTC cần <b>xác nhận thủ công</b> (VD: Karate trọng tài phân định, có khiếu nại). Để trống toàn bộ = tự động.</p>
      <p class="small">Tự động hiện tại: ${pod.filter((p) => !p.manual).map((p) => `${p.rank === 1 ? 'Nhất' : p.rank === 2 ? 'Nhì' : 'Ba'}: <b>${esc(E.sideName(p.side))}</b>`).join(' · ') || '<span class="muted">chưa có</span>'}</p>
      <div class="formgrid">${podRow(1, 0)}${podRow(2, 0)}${podRow(3, 0)}${ev.format === 'RR' && (ev.bronze || 1) === 1 ? '' : podRow(3, 1)}</div></div>
    <div class="card card-pad section"><label class="field"><span>Ghi chú của nội dung (hiển thị công khai)</span><input class="inp" id="ev-note" value="${esc(ev.note || '')}"></label></div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn primary" id="ev-save">${I.check} Lưu nội dung</button></div>`;
  body.querySelector('#fev').addEventListener('change', (e) => ctx.setQuery({ ev: e.target.value }));
  body.querySelectorAll('input,select').forEach((i) => i.addEventListener('input', () => dirty.add('ev')));
  body.querySelector('#ev-save').addEventListener('click', async () => {
    const out = clone(ev);
    const split = (s) => s.split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (team) {
      body.querySelectorAll('[data-group]').forEach((i) => { out.groups[i.dataset.group] = split(i.value); });
      out.manualOrder = {};
      body.querySelectorAll('[data-order]').forEach((i) => { const l = split(i.value); if (l.length) out.manualOrder[i.dataset.order] = l; });
    }
    const podium = [];
    body.querySelectorAll('[data-pod]').forEach((i) => { const t = i.value.trim().toUpperCase(); if (!t) return; const p = team ? '' : (body.querySelector(`[data-podp="${i.dataset.pod}"]`) ? '' : ''); podium.push({ rank: Number(i.dataset.pod), t }); });
    if (!team) { const ps = [...body.querySelectorAll('[data-podp]')]; podium.length = 0; ps.forEach((pi, idx) => { const t = body.querySelectorAll('[data-pod]')[idx].value.trim().toUpperCase(); const p = pi.value.trim(); if (t || p) podium.push({ rank: Number(pi.dataset.podp), t, p }); }); }
    if (podium.length) out.podium = podium; else delete out.podium;
    const note = body.querySelector('#ev-note').value.trim(); if (note) out.note = note; else delete out.note;
    try { await ctx.store.saveEvent(out); dirty.delete('ev'); toast('Đã lưu nội dung', 'ok'); ctx.render(); } catch (e) { toast(e.message, 'err'); }
  });
}

// ============================================================
//  4) THÔNG BÁO
// ============================================================
// ---------------- danh sách VĐV các đội ----------------
// Mỗi dòng 1 học sinh: "Họ tên" hoặc "Số áo. Họ tên" / "Số áo - Họ tên"
const rosterText = (list) => list.map((x) => (x.no ? `${x.no}. ` : '') + x.n + (x.g ? ` (${x.g}${x.note ? ', ' + x.note : ''})` : x.note ? ` (${x.note})` : '')).join('\n');
function parseRoster(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const cells = l.split('\t').map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 2 && /^\d{1,3}$/.test(cells[0])) return { no: cells[0], n: cells.slice(1).join(' ') };
    const m = l.match(/^(\d{1,3})\s*[.\-–:)]\s*(.+)$/);
    const r = m ? { no: m[1], n: m[2].trim() } : { no: '', n: l.replace(/\t+/g, ' ') };
    const p = r.n.match(/^(.*?)\s*\(([^)]*)\)\s*$/); // "Họ tên (Nữ, 2 nội dung)"
    if (p) { r.n = p[1].trim(); const bits = p[2].split(',').map((x) => x.trim()).filter(Boolean); if (/^(nam|nữ)$/i.test(bits[0] || '')) r.g = bits.shift().replace(/^n/i, 'N'); if (bits.length) r.note = bits.join(', '); }
    return r;
  });
}
const normCls = (s) => String(s || '').toUpperCase().replace(/\s+/g, '').replace(/^LỚP/, '');
function tabRosters(body, S) {
  const E = S.engine;
  const regs = ['caulong', 'karate'].filter(canSport).flatMap((sp) => [...new Set(E.eventsOf({ sport: sp }).map((e) => e.grade))].map((g) => E.rosterEvent(`${sp}-k${g}`)));
  const evs = [...E.eventsOf({}).filter((e) => e.kind === 'team' && canSport(e.sport)), ...regs].sort((a, b) => a.grade - b.grade || SPORTS.findIndex((s) => s.id === a.sport) - SPORTS.findIndex((s) => s.id === b.sport));
  const evId = ctx.route.q.get('ev') || (evs[0] && evs[0].id);
  const ev = E.rosterEvent(evId);
  const sel = `<div class="filters"><select class="sel" id="rev" style="min-width:280px">${LEVELS.map((l) => `<optgroup label="${esc(l.name)}">${evs.filter((e) => e.level === l.id).map((e) => `<option value="${e.id}" ${e.id === evId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>`;
  if (!ev || (ev.kind !== 'team' && ev.kind !== 'reg')) { body.innerHTML = sel + '<div class="card empty-box">Chọn một môn.</div>'; bindSel(); return; }
  const classes = (ev.kind === 'team' ? Object.values(ev.groups).flat() : E.allClasses().filter((c) => gradeOfClass(c) === ev.grade)).sort(cmpClass);
  const done = classes.filter((c) => E.rosterOf(ev.id, c).length).length;
  body.innerHTML = `${sel}
    <div class="card card-pad"><h3 style="font-weight:700;margin-bottom:4px">Dán nhanh từ Excel</h3>
      <p class="help" style="margin-top:0">Bôi đen các cột <b>Lớp | Họ tên</b> (thêm cột <b>Giới tính</b>, <b>Số áo</b> nếu có) trong Excel → Copy → dán vào ô dưới → bấm <b>Chia vào các lớp</b>. Lớp nào có trong bảng dán sẽ được thay danh sách; kiểm tra lại rồi bấm <b>Lưu</b>.</p>
      <textarea class="inp" id="r-paste" rows="4" style="width:100%" placeholder="7A05&#9;Nguyễn Văn An&#9;10&#10;7A05&#9;Trần Minh Khoa&#9;7"></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn" id="r-split">${I.list} Chia vào các lớp</button></div></div>
    <div class="section-title section"><h2 style="font-size:17px">${esc(ev.name)} · ${done}/${classes.length} lớp đã có danh sách</h2><button class="btn primary" id="r-save">${I.check} Lưu</button></div>
    <p class="help" style="margin-top:-6px">Mỗi dòng một học sinh, dạng <b>10. Nguyễn Văn An (Nam)</b> — số áo và giới tính có thể bỏ. Xóa hết nội dung ô = xóa danh sách của lớp. Danh sách ban đầu lấy từ file đăng ký Olympic 26.27.</p>
    <div class="roster-grid">${classes.map((c) => { const l = E.rosterOf(ev.id, c); return `<label class="card card-pad field"><span style="display:flex;justify-content:space-between"><b style="color:var(--navy);font-size:15px">${esc(c)}</b><i class="rc" data-rc="${esc(c)}" style="font-style:normal">${l.length} VĐV</i></span>
      <textarea class="inp" rows="7" data-cls="${esc(c)}" placeholder="Mỗi dòng 1 học sinh">${esc(rosterText(l))}</textarea></label>`; }).join('')}</div>`;
  bindSel();
  const areas = [...body.querySelectorAll('textarea[data-cls]')];
  const count = (ta) => { const n = parseRoster(ta.value).length; body.querySelector(`[data-rc="${CSS.escape(ta.dataset.cls)}"]`).textContent = n + ' VĐV'; };
  areas.forEach((ta) => ta.addEventListener('input', () => { dirty.add('roster'); count(ta); }));
  body.querySelector('#r-split').addEventListener('click', () => {
    const by = {}; let skip = 0;
    body.querySelector('#r-paste').value.split(/\r?\n/).forEach((line) => {
      const cells = line.split(/\t|;/).map((c) => c.trim()).filter(Boolean);
      if (!cells.length) return;
      const ci = cells.findIndex((c) => classes.includes(normCls(c)));
      if (ci < 0) { skip++; return; }
      const cls = normCls(cells[ci]);
      const rest = cells.filter((_, i) => i !== ci);
      const no = rest.find((c) => /^\d{1,3}$/.test(c)) || '';
      const g = rest.find((c) => /^(nam|nữ)$/i.test(c)) || '';
      const n = rest.filter((c) => c !== no && c !== g).join(' ');
      if (n) (by[cls] ||= []).push({ n, no, g: g ? g.replace(/^n/i, 'N') : '' });
    });
    const got = Object.keys(by);
    if (!got.length) return toast('Không đọc được dòng nào có tên lớp của nội dung này', 'err');
    got.forEach((c) => { const ta = areas.find((a) => a.dataset.cls === c); ta.value = rosterText(by[c]); count(ta); });
    dirty.add('roster');
    toast(`Đã chia ${got.reduce((a, c) => a + by[c].length, 0)} học sinh vào ${got.length} lớp${skip ? ` · bỏ qua ${skip} dòng không có lớp` : ''} — bấm Lưu`, 'ok');
  });
  body.querySelector('#r-save').addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    let n = 0;
    try {
      for (const ta of areas) {
        const next = parseRoster(ta.value);
        const cur = E.rosterOf(ev.id, ta.dataset.cls);
        if (rosterText(next) === rosterText(cur)) continue;
        await ctx.store.saveRoster(ev.id, ta.dataset.cls, next); n++;
      }
      dirty.delete('roster');
      toast(n ? `Đã lưu danh sách ${n} lớp` : 'Không có thay đổi', 'ok');
      ctx.render();
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  });
  function bindSel() { body.querySelector('#rev').addEventListener('change', (e) => { if (dirty.has('roster') && !confirm('Danh sách đang sửa chưa lưu. Bỏ qua?')) { e.target.value = evId; return; } dirty.delete('roster'); ctx.setQuery({ ev: e.target.value }); }); }
}

// ---------------- điều lệ giải (quyền Toàn giải) ----------------
function tabRules(body, S) {
  const db = S.db;
  const docs = [
    ...LEVELS.map((l) => ({ key: 'general:' + l.id, label: `Quy định chung · ${l.name}`, gen: true, lv: l.id })),
    ...SPORTS.flatMap((s) => LEVELS.filter((l) => db.rules[`${s.id}-${l.id}`]).map((l) => ({ key: `${s.id}-${l.id}`, label: `${s.name} · ${l.name}`, sport: s.id, lv: l.id }))),
  ];
  const key = ctx.route.q.get('doc') || docs[0].key;
  const doc = docs.find((d) => d.key === key) || docs[0];
  const edits = doc.gen ? db.generalEdits : db.ruleEdits;
  const k = doc.gen ? doc.lv : doc.key;
  const edited = edits && edits[k];
  const cur = doc.gen ? (db.general[doc.lv] || {}) : (db.rules[doc.key] || {});
  const ta = (id, label, val, rows, help = '') => `<label class="field full"><span>${label}</span><textarea class="inp rule-ta" id="${id}" rows="${rows}" spellcheck="false">${esc(val || '')}</textarea>${help ? `<small class="help">${help}</small>` : ''}</label>`;
  const fields = doc.gen
    ? ta('r-register', 'Quy định đăng ký thi đấu', cur.register, 12) + ta('r-important', 'Lưu ý quan trọng', cur.important, 10) + ta('r-extra', 'Điều chỉnh lịch học (để trống nếu không có)', cur.extra, 5)
    : ta('r-title', 'Tiêu đề (mỗi dòng một dòng tiêu đề)', cur.title, 3) + ta('r-body', 'Nội dung điều lệ', cur.body, 24)
      + `<div class="formgrid"><label class="field"><span>Ngày ban hành</span><input class="inp" id="r-dated" value="${esc((cur.dated || '').replace(/NGƯỜI LẬP.*$/i, '').trim())}" placeholder="Hà Nội, ngày … tháng … năm 2026"></label><label class="field"><span>Người lập</span><input class="inp" id="r-author" value="${esc(cur.author || '')}"></label></div>`;
  const sel = `<div class="filters"><select class="sel" id="r-doc" style="min-width:280px">${[['Quy định chung', docs.filter((d) => d.gen)], ...SPORTS.map((s) => [s.name, docs.filter((d) => d.sport === s.id)])].map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((d) => `<option value="${d.key}" ${d.key === doc.key ? 'selected' : ''}>${esc(d.label)}${(d.gen ? db.generalEdits : db.ruleEdits)[d.gen ? d.lv : d.key] ? ' ✎' : ''}</option>`).join('')}</optgroup>`).join('')}</select>
    <a class="btn sm" href="#/dieu-le/${doc.gen ? 'chung' : doc.sport}/${doc.lv}" target="_blank">${I.book} Xem trang công khai</a></div>`;
  body.innerHTML = `${sel}
    <div class="card card-pad" style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span class="small">${edited ? `<b style="color:#8a6400">Đã chỉnh sửa</b> · ${esc(edited.by || '')} · ${esc(relTime(edited.upd))}` : '<span class="muted">Đang dùng bản gốc từ văn bản của Tổ Thể thao</span>'}</span>
      <span style="margin-left:auto;display:flex;gap:8px">${edited ? `<button class="btn sm" id="r-reset">${I.refresh} Khôi phục bản gốc</button>` : ''}<button class="btn primary" id="r-save">${I.check} Lưu điều lệ</button></span></div>
    <div class="rule-edit">
      <div class="card card-pad"><div class="formgrid">${fields}</div>
        <p class="help">Cách trình bày: dòng bắt đầu bằng <b>ĐIỀU I</b> hoặc <b>I.</b> → tiêu đề mục · <b>1.</b> → tiêu đề nhỏ · <b>-</b> → gạch đầu dòng · <b>+</b> → ý con · <b>*</b> → ô lưu ý màu vàng.</p></div>
      <div class="card doc rule-preview"><div class="eyebrow" style="margin-bottom:8px">Xem trước</div><div id="r-prev"></div></div>
    </div>`;
  const $ = (s) => body.querySelector(s);
  const read = () => doc.gen
    ? { register: $('#r-register').value, important: $('#r-important').value, extra: $('#r-extra').value }
    : { title: $('#r-title').value.trim(), body: $('#r-body').value, dated: $('#r-dated').value.trim(), author: $('#r-author').value.trim() };
  const preview = () => {
    const v = read();
    $('#r-prev').innerHTML = doc.gen
      ? `<h3>Quy định đăng ký thi đấu</h3>${ruleBody(v.register)}<h3>Lưu ý quan trọng</h3>${ruleBody(v.important)}${v.extra.trim() ? `<h3>Điều chỉnh lịch học</h3>${ruleBody(v.extra)}` : ''}`
      : `<div class="doc-title">${esc(v.title)}</div>${ruleBody(v.body)}<div class="sign">${esc(v.dated)}${v.author ? `<br>Người lập: <b>${esc(capFirst(v.author))}</b>` : ''}</div>`;
  };
  preview();
  body.querySelectorAll('textarea, input').forEach((el) => el.addEventListener('input', () => { dirty.add('rules'); preview(); }));
  $('#r-doc').addEventListener('change', (e) => {
    if (dirty.has('rules') && !confirm('Điều lệ đang sửa chưa lưu. Bỏ qua thay đổi?')) { e.target.value = doc.key; return; }
    dirty.delete('rules'); ctx.setQuery({ doc: e.target.value });
  });
  $('#r-save').addEventListener('click', async (e) => {
    const v = read();
    if (!doc.gen && (!v.title || !v.body.trim())) return toast('Cần có tiêu đề và nội dung', 'err');
    e.currentTarget.disabled = true;
    try { await ctx.store.saveRule(doc.key, v); dirty.delete('rules'); toast('Đã lưu điều lệ — trang công khai cập nhật ngay', 'ok'); ctx.render(); }
    catch (err) { toast(err.message, 'err'); e.currentTarget.disabled = false; }
  });
  const rs = $('#r-reset');
  if (rs) rs.addEventListener('click', async () => {
    if (!confirm('Bỏ các chỉnh sửa và quay về bản gốc của điều lệ này?')) return;
    try { await ctx.store.saveRule(doc.key, null); dirty.delete('rules'); toast('Đã khôi phục bản gốc', 'ok'); ctx.render(); } catch (err) { toast(err.message, 'err'); }
  });
}

function tabNews(body, S) {
  const news = (S.db.news || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
  body.innerHTML = `<div class="grid2" style="align-items:start">
    <div class="card card-pad"><h3 style="font-weight:700;margin-bottom:10px">Đăng thông báo</h3>
      <div class="formgrid"><label class="field full"><span>Tiêu đề</span><input class="inp" id="nt" placeholder="VD: Hoãn các trận chiều thứ Tư do mưa"></label>
      <label class="field full"><span>Nội dung</span><textarea class="inp" id="nb" rows="5"></textarea></label>
      <label class="check full"><input type="checkbox" id="np"> Ghim lên đầu trang chủ</label></div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="btn primary" id="nadd">${I.plus} Đăng</button></div></div>
    <div class="card"><div class="card-head"><h3>Đã đăng (${news.length})</h3></div>
      <div class="news">${news.map((n) => `<div class="news-item"><h4>${n.pinned ? '<span class="pin-tag">Ghim</span>' : ''}${esc(n.title)}</h4><div class="when">${esc(relTime(n.at))} · ${esc(n.by || '')}</div><p>${esc(n.body || '')}</p>
        <div style="display:flex;gap:6px;margin-top:6px"><button class="btn sm" data-pin="${esc(n.id)}">${n.pinned ? 'Bỏ ghim' : 'Ghim'}</button><button class="btn sm" data-del="${esc(n.id)}">${I.trash} Xóa</button></div></div>`).join('') || '<div class="empty-box small">Chưa có thông báo.</div>'}</div></div></div>`;
  const save = async (list, msg) => { try { await ctx.store.saveConfig({ news: list }, msg); toast('Đã lưu', 'ok'); ctx.render(); } catch (e) { toast(e.message, 'err'); } };
  body.querySelector('#nadd').addEventListener('click', () => {
    const t = body.querySelector('#nt').value.trim();
    if (!t) return toast('Nhập tiêu đề', 'err');
    const S2 = ctx.store.getState();
    save([{ id: uid(), title: t, body: body.querySelector('#nb').value.trim(), pinned: body.querySelector('#np').checked, at: Date.now(), by: S2.user.email }, ...(S2.db.news || [])], 'Đăng thông báo');
  });
  body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { if (confirm('Xóa thông báo này?')) save((ctx.store.getState().db.news || []).filter((n) => n.id !== b.dataset.del), 'Xóa thông báo'); }));
  body.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => save((ctx.store.getState().db.news || []).map((n) => (n.id === b.dataset.pin ? { ...n, pinned: !n.pinned } : n)), 'Ghim thông báo')));
}

// ============================================================
//  5) CÀI ĐẶT
// ============================================================
function tabSettings(body, S) {
  const pts = S.db.settings.points || {};
  const meta = S.db.meta || {};
  const row = (sp, label) => { const p = S.engine.points(sp); return `<div class="field"><span>${esc(label)}</span><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">Thắng <input class="inp" style="width:60px" data-pt="${sp}.w" value="${p.w}">${sp === 'bongda' ? ` Hòa <input class="inp" style="width:60px" data-pt="${sp}.d" value="${p.d}">` : ''} Thua <input class="inp" style="width:60px" data-pt="${sp}.l" value="${p.l}">${sp === 'bongro' ? ` Bỏ cuộc <input class="inp" style="width:60px" data-pt="${sp}.ff" value="${p.ff}">` : ''}</div></div>`; };
  body.innerHTML = `<div class="card card-pad"><h3 style="font-weight:700">Cách tính điểm vòng bảng</h3>
      <p class="help">Mặc định theo điều lệ: Bóng đá thắng 3 – hòa 1 – thua 0; Bóng rổ thắng 2 – thua 1 – bỏ cuộc 0 (đội bị "Xử thua" trong hộp sửa trận); Kéo co thắng 2 – thua 0.</p>
      <div class="formgrid">${row('bongda', 'Bóng đá')}${row('bongro', 'Bóng rổ')}${row('keoco', 'Kéo co')}</div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="btn primary" id="save-pts">${I.check} Lưu cách tính điểm</button></div></div>
    <div class="card card-pad section"><h3 style="font-weight:700">Thông tin giải</h3>
      <div class="formgrid">
        <label class="field"><span>Ngày khai mạc</span><input class="inp" type="date" id="m-start" value="${esc(meta.start || '')}"></label>
        <label class="field"><span>Ngày kết thúc dự kiến</span><input class="inp" type="date" id="m-end" value="${esc(meta.end || '')}"></label>
        <label class="field full"><span>Khẩu hiệu</span><input class="inp" id="m-slogan" value="${esc(meta.slogan || '')}"></label>
      </div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="btn primary" id="save-meta">${I.check} Lưu thông tin</button></div></div>`;
  body.querySelector('#save-pts').addEventListener('click', async () => {
    const points = {};
    body.querySelectorAll('[data-pt]').forEach((i) => { const [sp, k] = i.dataset.pt.split('.'); (points[sp] ||= {})[k] = Number(i.value) || 0; });
    try { await ctx.store.saveConfig({ settings: { ...(ctx.store.getState().db.settings || {}), points, pointsVer: POINTS_VER } }, 'Đổi cách tính điểm'); toast('Đã lưu', 'ok'); ctx.render(); } catch (e) { toast(e.message, 'err'); }
  });
  body.querySelector('#save-meta').addEventListener('click', async () => {
    const m = { ...(ctx.store.getState().db.meta || {}), start: body.querySelector('#m-start').value, end: body.querySelector('#m-end').value, slogan: body.querySelector('#m-slogan').value.trim() };
    try { await ctx.store.saveConfig({ meta: m }, 'Sửa thông tin giải'); toast('Đã lưu', 'ok'); ctx.render(); } catch (e) { toast(e.message, 'err'); }
  });
}

// ============================================================
//  6) QUẢN TRỊ VIÊN
// ============================================================
async function tabAdmins(body) {
  body.innerHTML = `<div class="skeleton" style="height:160px"></div>`;
  let list = [];
  try { list = await ctx.store.listAdmins(); } catch (e) { body.innerHTML = `<div class="card empty-box">${esc(e.message)}</div>`; return; }
  body.innerHTML = `<div class="grid2" style="align-items:start">
    <div class="card card-pad"><h3 style="font-weight:700;margin-bottom:10px">Cấp quyền</h3>
      <div class="formgrid"><label class="field full"><span>Email trường</span><input class="inp" id="a-email" placeholder="ten@hoangmaistarschool.edu.vn"></label>
      <label class="field full"><span>Tên hiển thị</span><input class="inp" id="a-name" placeholder="VD: Cô Oanh – Bóng đá"></label>
      <div class="field full"><span>Phạm vi</span><label class="check"><input type="checkbox" id="a-all"> Toàn giải (mọi môn, thông báo, cài đặt, điều lệ)</label>
        <div class="chips" style="margin-top:6px">${SPORTS.map((s) => `<label class="chip"><input type="checkbox" data-sp="${s.id}"> ${esc(s.name)}</label>`).join('')}</div></div></div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="btn primary" id="a-add">${I.plus} Cấp quyền</button></div>
      <p class="help">Quản trị cao nhất (ghi trong js/config.js và firestore.rules) luôn có toàn quyền.</p></div>
    <div class="card"><div class="card-head"><h3>Danh sách (${list.length})</h3></div>
      ${list.map((a) => `<div class="sum-row"><div><b>${esc(a.name || a.email)}</b><div class="muted xs">${esc(a.email)} · ${a.all ? 'Toàn giải' : Object.keys(a.sports || {}).filter((k) => a.sports[k]).map((k) => SPORT[k] ? SPORT[k].name : k).join(', ')}</div></div><button class="btn sm" data-rm="${esc(a.email)}">${I.trash} Thu hồi</button></div>`).join('') || '<div class="empty-box small">Chưa cấp quyền cho ai.</div>'}</div></div>`;
  body.querySelector('#a-add').addEventListener('click', async () => {
    const email = body.querySelector('#a-email').value.trim().toLowerCase();
    if (!/^[^@\s]+@hoangmaistarschool\.edu\.vn$/.test(email)) return toast('Email phải là tài khoản @hoangmaistarschool.edu.vn', 'err');
    const sports = {}; body.querySelectorAll('[data-sp]').forEach((c) => { if (c.checked) sports[c.dataset.sp] = true; });
    const all = body.querySelector('#a-all').checked;
    if (!all && !Object.keys(sports).length) return toast('Chọn ít nhất một môn hoặc "Toàn giải"', 'err');
    try { await ctx.store.setAdmin(email, { all, sports, name: body.querySelector('#a-name').value.trim(), at: Date.now() }); toast('Đã cấp quyền', 'ok'); tabAdmins(body); } catch (e) { toast(e.message, 'err'); }
  });
  body.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => { if (!confirm('Thu hồi quyền của ' + b.dataset.rm + '?')) return; try { await ctx.store.removeAdmin(b.dataset.rm); toast('Đã thu hồi', 'ok'); tabAdmins(body); } catch (e) { toast(e.message, 'err'); } }));
}

// ============================================================
//  7) DỮ LIỆU & XUẤT FILE
// ============================================================
function tabData(body, S) {
  const E = S.engine;
  let issues = S.db.sourceNotes || [];
  if (!issues.length) ctx.store.loadSeed().then((s) => { const box = document.getElementById('issues'); if (box && s.sourceNotes) box.innerHTML = s.sourceNotes.map((l) => `<div class="issue ${/ĐÃ SỬA/.test(l) ? 'fix' : /THIẾU|TRÙNG|lạ|khác/.test(l) ? 'warn' : ''}">${esc(l)}</div>`).join(''); });
  body.innerHTML = `<div class="grid2" style="align-items:start">
    <div class="card card-pad"><h3 style="font-weight:700">Xuất file</h3><p class="help">File CSV mở trực tiếp bằng Excel (tiếng Việt có dấu).</p>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
        <button class="btn" id="x-matches">${I.download} Lịch & kết quả toàn giải (.csv)</button>
        <button class="btn" id="x-standings">${I.download} Bảng xếp hạng vòng bảng (.csv)</button>
        <button class="btn" id="x-medals">${I.download} Bảng tổng sắp & nhà vô địch (.csv)</button>
        <button class="btn" id="x-json">${I.download} Sao lưu toàn bộ dữ liệu (.json)</button>
      </div></div>
    <div class="card card-pad"><h3 style="font-weight:700">Máy chủ dữ liệu</h3>
      <p class="small">Trạng thái: <b>${S.mode === 'live' ? 'Đang đồng bộ thời gian thực (Firebase)' : S.mode === 'local' ? 'Chế độ tập dượt — thay đổi chỉ lưu trên máy này' : 'Chưa kết nối được máy chủ'}</b></p>
      ${S.role.super ? `<div style="margin-top:10px"><label class="btn" style="cursor:pointer">${I.upload} Khôi phục từ file sao lưu (.json)<input type="file" id="imp" accept=".json,application/json" hidden></label></div>` : ''}
      ${S.role.super ? `<div style="margin-top:10px"><button class="btn" id="reset-local">${I.refresh} ${S.mode === 'local' ? 'Xóa thay đổi tập dượt, về lịch gốc' : 'Xóa MỌI thay đổi trên máy chủ, về lịch gốc'}</button></div>` : ''}
      <p class="help" style="margin-top:10px">Lịch gốc (từ Excel) nằm sẵn trong web. Máy chủ chỉ lưu phần Ban tổ chức cập nhật (kết quả, đổi lịch, thông báo) nên mỗi lượt xem rất nhẹ.</p>
    </div></div>
    <div class="card section"><div class="card-head"><h3>${I.info} Ghi chú khi chuyển dữ liệu từ Excel (${issues.length})</h3></div>
      <p class="help" style="padding:0 18px">Các chỗ file gốc bị lệch/thiếu. "Đã sửa" = lỗi gõ chỉ có một cách sửa khớp thể thức; còn lại cần Tổ Thể thao kiểm tra và sửa trong tab "Lịch & trận đấu".</p>
      <div id="issues">${issues.map((l) => `<div class="issue ${/ĐÃ SỬA/.test(l) ? 'fix' : /THIẾU|TRÙNG|lạ|khác/.test(l) ? 'warn' : ''}">${esc(l)}</div>`).join('') || '<div class="empty-box small">Đang tải…</div>'}</div></div>`;
  const stamp = todayISO();
  body.querySelector('#x-matches').addEventListener('click', () => {
    const rows = [['Môn', 'Cấp', 'Khối', 'Nội dung', 'Vòng', 'Ngày', 'Giờ bắt đầu', 'Giờ kết thúc', 'Sân', 'Bên A', 'Lớp A', 'Tỉ số A', 'Tỉ số B', 'Bên B', 'Lớp B', 'Trạng thái', 'Ghi chú']];
    Object.values(E.matches).sort((a, b) => E.events[a.ev].sport.localeCompare(E.events[b.ev].sport) || E.events[a.ev].grade - E.events[b.ev].grade || cmpMatch(a, b)).forEach((m) => {
      const ev = E.events[m.ev]; const [A, B] = E.sidesOf(m); const st = E.status(m);
      rows.push([SPORT[ev.sport].name, levelName(ev.level), ev.grade, ev.catName || '', capFirst(E.stageLabel(m)) + (E.matchNo(m) ? ' ' + E.matchNo(m) : ''), m.date, m.time || '', m.end || '', m.venue || '', A.kind === 'ath' ? A.p : E.sideName(A), A.t || '', isDone(m) ? m.sa : '', isDone(m) ? m.sb : '', B.kind === 'ath' ? B.p : E.sideName(B), B.t || '', STATUS[st].name, [m.pen, m.note].filter(Boolean).join(' · ')]);
    });
    download(`olympic-lich-ket-qua-${stamp}.csv`, csv(rows));
  });
  body.querySelector('#x-standings').addEventListener('click', () => {
    const rows = [['Môn', 'Khối', 'Bảng', 'Hạng', 'Lớp', 'Số trận', 'Thắng', 'Hòa', 'Thua', 'Ghi được', 'Bị ghi', 'Hiệu số', 'Điểm', 'Bảng đã xong']];
    E.eventsOf({}).filter((e) => e.kind === 'team').forEach((e) => Object.keys(e.groups).forEach((g) => { const st = E.standings(e.id, g); st.rows.forEach((r) => rows.push([SPORT[e.sport].name, e.grade, e.format === 'RR' ? 'Vòng tròn' : g, r.rank, r.t, r.p, r.w, r.d, r.l, r.f, r.a, r.diff, r.pts, st.complete ? 'Có' : 'Chưa'])); }));
    download(`olympic-bang-xep-hang-${stamp}.csv`, csv(rows));
  });
  body.querySelector('#x-medals').addEventListener('click', () => {
    const rows = [['BẢNG TỔNG SẮP'], ['Hạng', 'Lớp', 'Khối', 'HCV', 'HCB', 'HCĐ', 'Tổng']];
    E.medalTable().forEach((r, i) => rows.push([i + 1, r.t, levelOf(Number(String(r.t).match(/^\d+/)[0])) + ' ' + String(r.t).match(/^\d+/)[0], r.g, r.s, r.b, r.n]));
    rows.push([], ['NHÀ VÔ ĐỊCH TỪNG NỘI DUNG'], ['Môn', 'Khối', 'Nội dung', 'Nhất', 'Nhì', 'Ba']);
    E.eventsOf({}).forEach((e) => { const p = E.podium(e.id); const nm = (k) => p.filter((x) => x.rank === k).map((x) => E.sideName(x.side)).join('; '); rows.push([SPORT[e.sport].name, e.grade, e.catName || 'Đồng đội', nm(1), nm(2), nm(3)]); });
    download(`olympic-tong-sap-${stamp}.csv`, csv(rows));
  });
  body.querySelector('#x-json').addEventListener('click', () => {
    const db = ctx.store.getState().db;
    download(`olympic-sao-luu-${stamp}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), meta: db.meta, settings: db.settings, news: db.news, rules: db.rules, general: db.general, events: db.events, matches: db.matches, rosters: db.rosters || {} }), 'application/json');
  });
  const imp = body.querySelector('#imp');
  if (imp) imp.addEventListener('change', async () => {
    const f = imp.files[0]; if (!f) return;
    if (!confirm('Khôi phục sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại bằng file "' + f.name + '". Tiếp tục?')) return;
    try { await ctx.store.importBackup(await f.text()); toast('Đã khôi phục', 'ok'); ctx.render(); } catch (e) { toast(e.message, 'err'); }
  });
  const rl = body.querySelector('#reset-local');
  if (rl) rl.addEventListener('click', async () => {
    if (!confirm(S.mode === 'local' ? 'Xóa mọi thay đổi tập dượt trên máy này?' : 'XÓA MỌI kết quả, đổi lịch đã nhập trên máy chủ và quay về lịch gốc? Nên bấm "Sao lưu" trước.')) return;
    if (S.mode !== 'local' && prompt('Gõ XOA HET để xác nhận') !== 'XOA HET') return;
    try { await ctx.store.resetAll(); toast('Đã về lịch gốc', 'ok'); ctx.render(); } catch (e) { toast(e.message, 'err'); }
  });
}

// ============================================================
//  8) NHẬT KÝ
// ============================================================
// Nhật ký thao tác — chỉ quản trị cao nhất xem được (luật Firestore cũng chặn đọc với người khác)
let logCache = null;
// app.js gọi khi rời trang Quản trị → quay lại tab Nhật ký sẽ đọc lại bản mới
export function resetLogCache() { logCache = null; }
async function tabLogs(body) {
  const LT = ctx.store.LOG_TYPES;
  const q = ctx.route.q;
  const ft = q.get('lt') || '', fs = q.get('lm') || '', fu = q.get('lu') || '', fd = q.get('ld') || '', fq = (q.get('lq') || '').toLowerCase();
  const local = ctx.store.getState().mode === 'local';
  if (!logCache) {
    body.innerHTML = `<div class="skeleton" style="height:200px"></div>`;
    try { const l = await ctx.store.listLogs(300); logCache = { list: l, last: l[l.length - 1] || null, more: l.length >= 300 }; }
    catch (e) { body.innerHTML = `<div class="card empty-box">${I.info}<b>Không đọc được nhật ký</b>${esc(e.message)}</div>`; return; }
  }
  // Bản ghi do người dùng ghi lên (luật chỉ kiểm tra email + giờ máy chủ) → đọc phòng thủ, không tin kiểu dữ liệu
  const str = (x) => { try { return typeof x === 'string' ? x : x == null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x); } catch (e) { return '?'; } };
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // giờ thao tác: giờ máy chủ (ts) nếu có, không thì giờ máy người ghi (bản ghi cũ / xem thử)
  const when = (l) => { const t = Number.isFinite(l.srvAt) ? l.srvAt : typeof l.at === 'number' ? l.at : NaN; return Number.isFinite(t) && t > 0 && t < 8.64e15 ? t : null; };
  const vn = (t) => new Date(t + 7 * 3600e3); // giờ Việt Nam qua getUTC*
  const p2 = (n) => String(n).padStart(2, '0');
  const dt = (t) => { if (t == null) return '—'; const d = vn(t); return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`; };
  const dayOf = (t) => (t == null ? '' : vn(t).toISOString().slice(0, 10));
  const all = logCache.list.slice().sort((a, b) => (when(b) || 0) - (when(a) || 0));
  // bản ghi cũ (trước khi nâng cấp) chưa có danh sách thay đổi → dựng từ ảnh chụp trước/sau
  const changesOf = (l) => { try { return changesOf0(l); } catch (e) { return []; } };
  const changesOf0 = (l) => {
    if (Array.isArray(l.changes)) return l.changes.filter((c) => c && typeof c === 'object').map((c) => ({ f: str(c.f), from: str(c.from), to: str(c.to) }));
    const b = (l.before && typeof l.before === 'object' && l.before) || {}, a = (l.after && typeof l.after === 'object' && l.after) || {}, out = [];
    const sc = (x) => (x && x.sa != null ? `${str(x.sa)}–${str(x.sb)}` : '—');
    const v = (k, x) => str(k === 'st' && own(STATUS, x) ? STATUS[x].name : x) || '—';
    if (l.after) { if (sc(b) !== sc(a)) out.push({ f: 'Tỉ số', from: sc(b), to: sc(a) }); for (const [k, f] of [['st', 'Trạng thái'], ['date', 'Ngày'], ['time', 'Giờ'], ['venue', 'Sân']]) if (str(b[k]) !== str(a[k])) out.push({ f, from: v(k, b[k]), to: v(k, a[k]) }); }
    return out;
  };
  const legacyTypes = (l) => { const f = changesOf(l).map((c) => c.f), t = []; if (f.includes('Tỉ số') || f.includes('Trạng thái')) t.push('result'); if (f.includes('Ngày') || f.includes('Giờ') || f.includes('Sân')) t.push('schedule'); return t; };
  const typeOf = (l) => { try { return typeOf0(l); } catch (e) { return 'config'; } };
  const typeOf0 = (l) => {
    if (own(LT, l.type)) return l.type;
    const a = str(l.action);
    return /Xóa trận/.test(a) ? 'delete' : /Thêm trận/.test(a) ? 'add' : l.after ? (legacyTypes(l)[0] || 'result') : /Sửa nội dung|bảng đấu/i.test(a) ? 'event' : /điều lệ/i.test(a) ? 'rules' : /thông báo/i.test(a) ? 'news' : /quyền/i.test(a) ? 'admin' : /sao lưu|lịch gốc/i.test(a) ? 'data' : /Danh sách VĐV/.test(a) ? 'roster' : 'config';
  };
  // chỉ các loại đã biết mới vào thuộc tính class (chặn chèn mã qua bản ghi tự ghi)
  const typesOf = (l) => (Array.isArray(l.types) ? l.types.filter((x) => own(LT, x)) : l.after && l.before ? legacyTypes(l) : []);
  const sportOf = (l) => str(l.sport) || str(l.ev || l.id).split('-')[0];
  const users = [...new Set(all.map((l) => str(l.by)).filter(Boolean))].sort();
  const list = all.filter((l) => {
    const t = typeOf(l);
    if (ft && !(t === ft || typesOf(l).includes(ft))) return false;
    if (fs && sportOf(l) !== fs) return false;
    if (fu && str(l.by) !== fu) return false;
    if (fd && dayOf(when(l)) !== fd) return false;
    if (fq && ![l.label, l.action, l.by, l.name, l.role, l.mid, l.id, l.ev, ...changesOf(l).flatMap((c) => [c.f, c.from, c.to])].map(str).filter(Boolean).join('\n').toLowerCase().includes(fq)) return false;
    return true;
  });
  const chHtml = (c) => `<li><b>${esc(c.f)}:</b> ${c.from && c.from !== '—' ? `<del>${esc(c.from)}</del>${c.to ? ' → ' : ''}` : ''}${c.to || !c.from ? `<ins>${esc(c.to || '—')}</ins>` : ''}</li>`;
  const counts = {}; all.forEach((l) => { const t = typeOf(l); counts[t] = (counts[t] || 0) + 1; });
  body.innerHTML = `
    <div class="filters">
      <select class="sel" data-lf="lt"><option value="">Mọi loại thao tác (${all.length})</option>${Object.entries(LT).map(([k, v]) => `<option value="${k}" ${ft === k ? 'selected' : ''}>${esc(v)}${counts[k] ? ` (${counts[k]})` : ''}</option>`).join('')}</select>
      <select class="sel" data-lf="lm"><option value="">Mọi môn</option>${SPORTS.map((s) => `<option value="${s.id}" ${fs === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <select class="sel" data-lf="lu"><option value="">Mọi người thực hiện</option>${users.map((u) => `<option ${fu === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>
      <input class="inp" type="date" data-lf="ld" value="${esc(fd)}" title="Ngày thao tác">
      <div class="search"><span>${I.search}</span><input class="inp" id="lq" value="${esc(q.get('lq') || '')}" placeholder="Tìm lớp, trận, nội dung…" style="width:200px"></div>
      <button class="btn sm" id="l-csv">${I.download} Xuất CSV</button><button class="btn sm" id="l-reload">${I.refresh} Tải lại</button>
    </div>
    <p class="help" style="margin-top:-4px">Ghi lại mọi thao tác nhập / sửa kết quả, đổi lịch, thêm / xóa trận, bảng đấu, danh sách VĐV, thông báo, điều lệ, cài đặt, phân quyền. Nhật ký không sửa, không xóa được; giờ theo máy chủ. Đang hiện ${list.length}/${all.length} bản ghi gần nhất.</p>
    <div class="card log-list">${list.map((l) => { try { return rowHtml(l); } catch (e) { return ''; } }).join('') || '<div class="empty-box small">Không có bản ghi phù hợp.</div>'}</div>
    ${logCache.more ? `<div style="display:flex;justify-content:center;margin-top:12px"><button class="btn" id="l-more">Tải thêm bản ghi cũ hơn</button></div>` : ''}`;
  function rowHtml(l) { const t = typeOf(l), at = when(l), ch = changesOf(l), sp = sportOf(l), lbl = str(l.label || l.id || l.ev); return `<div class="lg">
      <div class="lg-when"><b>${esc(dt(at))}</b><span>${esc(at == null ? '' : relTime(at))}</span></div>
      <div class="lg-main"><div class="lg-top"><span class="lt lt-${t}">${esc(LT[t])}</span>${typesOf(l).filter((x) => x !== t).map((x) => `<span class="lt lt-${x}">${esc(LT[x])}</span>`).join('')}<b>${esc(str(l.action))}</b>${own(SPORT, sp) ? sportTag(sp) : ''}</div>
        ${lbl ? `<div class="lg-label">${esc(lbl)}</div>` : ''}
        ${ch.length ? `<ul class="lg-ch">${ch.map(chHtml).join('')}</ul>` : ''}</div>
      <div class="lg-who"><b>${esc(str(l.by) || '—')}</b>${l.name ? `<span>${esc(str(l.name))}</span>` : ''}${l.role ? `<span>${esc(str(l.role))}</span>` : ''}</div>
    </div>`; }
  body.querySelectorAll('[data-lf]').forEach((el) => el.addEventListener('change', () => ctx.setQuery({ [el.dataset.lf]: el.value })));
  const lq = body.querySelector('#lq');
  lq.addEventListener('keydown', (e) => { if (e.key === 'Enter') ctx.setQuery({ lq: lq.value.trim() }); });
  lq.addEventListener('change', () => ctx.setQuery({ lq: lq.value.trim() }));
  body.querySelector('#l-reload').addEventListener('click', () => { logCache = null; ctx.render(); });
  const more = body.querySelector('#l-more');
  if (more) more.addEventListener('click', async () => {
    more.disabled = true;
    try {
      const older = await ctx.store.listLogs(300, logCache.last, local ? logCache.list.length : 0);
      logCache.list = logCache.list.concat(older); logCache.last = older[older.length - 1] || logCache.last; logCache.more = older.length >= 300; ctx.render();
    } catch (e) { toast(e.message, 'err'); more.disabled = false; }
  });
  body.querySelector('#l-csv').addEventListener('click', () => {
    const rows = [['Thời gian (giờ VN)', 'Email', 'Tên', 'Vai trò', 'Loại', 'Thao tác', 'Môn', 'Đối tượng', 'Thay đổi']];
    list.forEach((l) => { const at = when(l); rows.push([at == null ? '' : `${dayOf(at)} ${dt(at).slice(6)}`, str(l.by), str(l.name), str(l.role), LT[typeOf(l)] || '', str(l.action), own(SPORT, sportOf(l)) ? SPORT[sportOf(l)].name : '', str(l.label || l.id || l.ev), changesOf(l).map((c) => `${c.f}: ${c.from || ''} → ${c.to || ''}`).join(' | ')]); });
    download(`olympic-nhat-ky-${todayISO()}.csv`, csv(rows));
  });
}
