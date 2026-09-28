// ============================================================
//  QUẢN TRỊ — dành cho Ban tổ chức / giáo viên phụ trách môn
// ============================================================
import { esc, todayISO, fmtDate, fmtDM, addDays, mondayOf, weekNo, weekdayLong, relTime, uid, clone, ls } from './util.js';
import { SPORTS, SPORT, LEVELS, levelOf, isDone, cmpMatch, cmpClass, FORFEIT, DEFAULT_POINTS, STATUS } from './engine.js';
import { SPORT_ICON, I } from './icons.js';
import { sportTag, sportVars, capFirst, openModal, closeModal, toast, evCaption, levelName } from './ui.js';
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
  { id: 'thong-bao', label: 'Thông báo', icon: I.bell, all: true },
  { id: 'cai-dat', label: 'Cài đặt', icon: I.gear, all: true },
  { id: 'quyen', label: 'Quản trị viên', icon: I.users, super: true, live: true },
  { id: 'du-lieu', label: 'Dữ liệu & xuất file', icon: I.download },
  { id: 'nhat-ky', label: 'Nhật ký', icon: I.clock, live: true },
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
  const views = { nhap: tabEntry, tran: tabMatches, 'noi-dung': tabEvents, 'thong-bao': tabNews, 'cai-dat': tabSettings, quyen: tabAdmins, 'du-lieu': tabData, 'nhat-ky': tabLogs };
  views[cur.id](body, S);
}

// ---------------- đăng nhập ----------------
function loginView(app, S) {
  const live = hasFirebase() && !DEMO;
  app.innerHTML = `<div class="wrap page"><div class="card login-card">
    <img src="assets/logo.svg" alt="">
    <h1 style="font-size:22px;font-weight:700">Quản trị giải Olympic</h1>
    <p class="muted">Dành cho Ban tổ chức và giáo viên phụ trách môn để cập nhật lịch, kết quả thi đấu.</p>
    ${live ? `<button class="ms-btn" id="login"><span class="ms-logo"><i style="background:#f25022"></i><i style="background:#7fba00"></i><i style="background:#00a4ef"></i><i style="background:#ffb900"></i></span>Đăng nhập bằng Microsoft 365 của trường</button>
      <p class="muted small" style="margin-top:14px">Chỉ tài khoản @hoangmaistarschool.edu.vn đã được cấp quyền mới cập nhật được.</p>
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
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
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
  body.innerHTML = `
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
  const ov = body.querySelector('#show-overdue');
  if (ov) ov.addEventListener('click', () => overdueModal(E, overdue));
  wireEntryRows(body, S);
}
function entryRow(E, m) {
  const ev = E.events[m.ev];
  const [A, B] = E.sidesOf(m);
  const ready = (A.kind === 'team' || A.kind === 'ath') && (B.kind === 'team' || B.kind === 'ath');
  const st = m.st || 'sched';
  const ko = m.stage !== 'G';
  const w = m.w || '';
  const drawKO = ko && isDone(m) && m.sa === m.sb;
  return `<div class="arow" data-row="${esc(m.id)}">
    <div class="small"><b class="num" style="font-size:15px">${esc(m.time || '')}</b><br><span class="muted">${esc(m.venue ? m.venue.replace(/^Sân /, '').slice(0, 26) : '')}</span></div>
    <div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">${sportTag(ev.sport)}<span class="small" style="font-weight:600">${esc(evCaption(E, m))}</span>${m.upd ? `<span class="muted xs">· sửa ${esc(relTime(m.upd))}</span>` : ''}</div>
      <div style="font-weight:700">${esc(sideLabel(E, A))} <span class="muted" style="font-weight:500">vs</span> ${esc(sideLabel(E, B))}</div>
      ${ko ? `<div class="xs muted wline ${drawKO ? '' : 'hide'}" style="margin-top:4px">Hòa → đội thắng: <label><input type="radio" name="w-${esc(m.id)}" value="a" ${w === 'a' ? 'checked' : ''}> ${esc(A.t || A.label || 'A')}</label> <label><input type="radio" name="w-${esc(m.id)}" value="b" ${w === 'b' ? 'checked' : ''}> ${esc(B.t || B.label || 'B')}</label></div>` : ''}</div>
    <div class="inputs">${ready ? `<input inputmode="numeric" pattern="[0-9]*" aria-label="Tỉ số ${esc(sideLabel(E, A))}" data-sa value="${m.sa ?? ''}"><span class="muted">–</span><input inputmode="numeric" pattern="[0-9]*" aria-label="Tỉ số ${esc(sideLabel(E, B))}" data-sb value="${m.sb ?? ''}">` : '<span class="muted small">Chờ xác định đội</span>'}
      <select data-st aria-label="Trạng thái">${Object.entries(STATUS).filter(([kk]) => kk !== 'wo').map(([kk, v]) => `<option value="${kk}" ${st === kk ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
    <div class="acts"><button class="btn sm primary" data-save ${ready ? '' : 'disabled'}>${I.check} Lưu</button><button class="btn sm" data-more title="Sửa chi tiết">⋯</button></div>
  </div>`;
}
function wireEntryRows(root, S) {
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
      if (m.stage !== 'G' && m.st === 'done' && m.sa === m.sb) {
        if (!wr) { toast('Trận vòng trong hòa: chọn đội thắng (luân lưu / hiệp phụ)', 'err'); return; }
        m.w = wr.value;
      } else delete m.w;
      if (m.st === 'sched') { delete m.sa; delete m.sb; delete m.w; }
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
    if (out.stage !== 'G' && out.st === 'done' && out.sa === out.sb && !out.w) return toast('Vòng trong hòa: chọn người thắng', 'err');
    const pen = $('#e-pen').value.trim(); if (pen) out.pen = pen; else delete out.pen;
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
    ${team ? `<div class="card card-pad"><h3 style="font-weight:700;margin-bottom:6px">Thành phần các bảng</h3><p class="help" style="margin-top:0">Mỗi bảng một dòng, các lớp cách nhau bằng dấu phẩy. Thứ tự trong bảng chỉ dùng khi phải <b>bốc thăm</b> phân hạng (bằng mọi chỉ số) — kéo lớp xếp trên lên trước.</p>
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
  const row = (sp, label) => { const p = { ...DEFAULT_POINTS[sp], ...(pts[sp] || {}) }; return `<div class="field"><span>${esc(label)}</span><div style="display:flex;gap:6px;align-items:center">Thắng <input class="inp" style="width:60px" data-pt="${sp}.w" value="${p.w}">${sp === 'bongda' ? ` Hòa <input class="inp" style="width:60px" data-pt="${sp}.d" value="${p.d}">` : ''} Thua <input class="inp" style="width:60px" data-pt="${sp}.l" value="${p.l}"></div></div>`; };
  body.innerHTML = `<div class="card card-pad"><h3 style="font-weight:700">Cách tính điểm vòng bảng</h3>
      <p class="help">Mặc định theo điều lệ: Bóng đá 3–1–0; Bóng rổ thắng 1 – thua 0; Kéo co thắng 2 – thua 0. (Lưu ý: bảng xếp hạng giấy của môn Bóng rổ đang ghi thắng 2 – thua 1; thứ hạng không đổi khi các đội đá đủ số trận, chỉ khác con số điểm.)</p>
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
    try { await ctx.store.saveConfig({ settings: { ...(ctx.store.getState().db.settings || {}), points } }, 'Đổi cách tính điểm'); toast('Đã lưu', 'ok'); ctx.render(); } catch (e) { toast(e.message, 'err'); }
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
      <div class="field full"><span>Phạm vi</span><label class="check"><input type="checkbox" id="a-all"> Toàn giải (mọi môn, thông báo, cài đặt)</label>
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
    download(`olympic-sao-luu-${stamp}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), meta: db.meta, settings: db.settings, news: db.news, rules: db.rules, general: db.general, events: db.events, matches: db.matches }), 'application/json');
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
async function tabLogs(body) {
  body.innerHTML = `<div class="skeleton" style="height:200px"></div>`;
  try {
    const logs = await ctx.store.listLogs(200);
    const fmt = (x) => (x ? `${x.a || '?'} ${x.sa != null ? x.sa + '–' + x.sb : 'vs'} ${x.b || '?'} (${x.st}${x.date ? ', ' + x.date + ' ' + (x.time || '') : ''})` : '');
    body.innerHTML = `<div class="card">${logs.map((l) => `<div class="log-row"><span class="muted">${esc(relTime(l.at))}</span><span>${esc(l.by || '')}</span><span><b>${esc(l.action || '')}</b> ${esc(l.id || l.ev || '')}${l.after ? `<br><span class="muted xs">${esc(fmt(l.before))} → ${esc(fmt(l.after))}</span>` : ''}</span></div>`).join('') || '<div class="empty-box">Chưa có thay đổi.</div>'}</div>`;
  } catch (e) { body.innerHTML = `<div class="card empty-box">${esc(e.message)}</div>`; }
}
