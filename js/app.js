// ============================================================
//  OLYMPIC THỂ THAO HỌC SINH NSHM 2026–2027 — trang công khai
// ============================================================
import * as store from './store.js';
import { esc, todayISO, fmtDate, fmtFull, fmtDM, addDays, mondayOf, weekNo, weekdayLong, relTime, fold, ls, debounce } from './util.js';
import { SPORTS, SPORT, LEVELS, levelOf, gradeOfClass, isDone, cmpMatch, cmpClass } from './engine.js';
import { SPORT_ICON, I, heroArt } from './icons.js';
import { sportVars, sportTag, levelName, capFirst, matchRow, standingsTable, teamBracket, indBracket, podiumHtml, matchDetail, openModal, closeModal, toast, statusPill } from './ui.js';
import { ASSET_VER } from './config.js';

const app = document.getElementById('app');
const PREF_KEY = 'olympic2627-pref';
const pref = ls.get(PREF_KEY, {});
const savePref = (p) => { Object.assign(pref, p); ls.set(PREF_KEY, pref); };
let route = { name: '', parts: [], q: new URLSearchParams() };
let adminMod = null;

// ---------------- điều hướng ----------------
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean).map((x) => decodeURIComponent(x));
  return { name: parts[0] || '', parts: parts.slice(1), q: new URLSearchParams(qs || '') };
}
export function go(hash) { if (location.hash !== hash) location.hash = hash; else render(); }
function setQuery(obj, replace = true) {
  const q = new URLSearchParams(route.q);
  for (const [k, v] of Object.entries(obj)) { if (v == null || v === '') q.delete(k); else q.set(k, v); }
  const base = '#/' + [route.name, ...route.parts].filter(Boolean).map(encodeURIComponent).join('/');
  const s = q.toString();
  const url = base + (s ? '?' + s : '');
  if (replace) history.replaceState(null, '', url); else location.hash = url;
  route = parseHash();
  render();
}
const NAV = [
  { id: '', label: 'Trang chủ', icon: I.home, tab: true },
  { id: 'lich', label: 'Lịch thi đấu', short: 'Lịch', icon: I.cal, tab: true },
  { id: 'ket-qua', label: 'Kết quả & BXH', short: 'Kết quả', icon: I.trophy, tab: true },
  { id: 'tong-sap', label: 'Bảng tổng sắp', short: 'Tổng sắp', icon: I.medal, tab: true },
  { id: 'lop', label: 'Tra cứu lớp', short: 'Lớp', icon: I.users, tab: false },
  { id: 'dieu-le', label: 'Điều lệ', icon: I.book, tab: true },
];

function shell() {
  const on = (id) => (route.name === id ? 'on' : '');
  document.querySelector('.mainnav').innerHTML = NAV.map((n) => `<a href="#/${n.id}" class="${on(n.id)}">${esc(n.label)}</a>`).join('');
  document.querySelector('.tabbar').innerHTML = NAV.filter((n) => n.tab).map((n) => `<a href="#/${n.id}" class="${on(n.id)}">${n.icon}<span>${esc(n.short || n.label)}</span></a>`).join('');
  const S = store.getState();
  const ab = document.getElementById('admin-btn');
  ab.classList.toggle('on', route.name === 'quan-tri');
  ab.title = S.user ? 'Quản trị · ' + S.user.email : 'Quản trị (dành cho BTC)';
  const lb = document.getElementById('class-btn');
  lb.classList.toggle('on', route.name === 'lop');
  // dải thông báo trạng thái dữ liệu
  const b = document.getElementById('banner');
  let html = '';
  if (S.mode === 'local') html = `<div class="banner demo"><div class="wrap"><b>Chế độ xem thử.</b><span>Lịch và kết quả lấy từ file Excel của Tổ Thể thao (cập nhật đến 28/09). Kết nối máy chủ để mọi người cùng xem kết quả trực tiếp.</span></div></div>`;
  else if (S.mode === 'seed' && S.needsSeed) html = `<div class="banner demo"><div class="wrap"><b>Máy chủ chưa có dữ liệu.</b><span>Đang hiển thị lịch gốc từ Excel. Quản trị vào mục Quản trị → Dữ liệu để nạp lên máy chủ.</span></div></div>`;
  else if ((S.mode === 'seed' || S.mode === 'cache') && S.error) html = `<div class="banner warn"><div class="wrap"><b>Đang ngoại tuyến.</b><span>${esc(S.error)}</span><button onclick="location.reload()">Tải lại</button></div></div>`;
  b.innerHTML = html;
}

// ---------------- hiển thị ----------------
let renderQueued = false;
export function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; doRender(); });
}
function doRender() {
  const S = store.getState();
  shell();
  if (!S.ready) { app.innerHTML = `<div class="wrap page"><div class="skeleton" style="height:260px"></div><div class="skeleton" style="height:160px;margin-top:16px"></div></div>`; return; }
  const views = { '': viewHome, lich: viewSchedule, 'ket-qua': viewResults, 'tong-sap': viewMedals, lop: viewClass, 'dieu-le': viewRules, 'quan-tri': viewAdmin };
  const v = views[route.name] || viewHome;
  try { v(S); } catch (e) { console.error(e); app.innerHTML = `<div class="wrap page"><div class="card empty-box">${I.info}<b>Có lỗi khi hiển thị trang</b>${esc(e.message)}</div></div>`; }
}

// ============================================================
//  TRANG CHỦ
// ============================================================
function tournamentPhase(S) {
  const t = todayISO(), m = S.db.meta || {};
  if (t < (m.start || '2026-09-28')) return { label: 'Sắp khởi tranh', live: false };
  if (t > (m.end || '2026-11-20')) return { label: 'Đã bế mạc', live: false };
  return { label: `Đang diễn ra · Tuần ${weekNo(t, m.week1 || '2026-09-28')}`, live: true };
}
function viewHome(S) {
  const E = S.engine, meta = S.db.meta || {};
  const prog = E.progress();
  const phase = tournamentPhase(S);
  const real = Object.values(E.matches).filter((m) => E.isReal(m));
  const today = todayISO();
  const dates = [...new Set(real.map((m) => m.date))].sort();
  const day = dates.includes(today) ? today : (dates.find((d) => d > today) || dates[dates.length - 1]);
  const dayMs = real.filter((m) => m.date === day).sort(cmpMatch);
  const latest = real.filter((m) => isDone(m) && m.date <= today).sort((a, b) => (b.upd || 0) - (a.upd || 0) || (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 8);
  const myCls = pref.myClass;

  const sportCards = SPORTS.map((s) => {
    const p = E.progress({ sport: s.id });
    const nEv = Object.values(E.events).filter((e) => e.sport === s.id).length;
    return `<a class="sport-card" href="#/ket-qua/${s.id}" style="${sportVars(s.id)}">
      <span class="sc-ic">${SPORT_ICON[s.id]}</span><b>${esc(s.name)}</b>
      <span class="muted xs">${nEv} nội dung · ${p.done}/${p.total} trận</span>
      <span class="mini"><i style="width:${p.pct}%"></i></span></a>`;
  }).join('');

  // Lịch trong ngày: tóm tắt theo khối
  const byGrade = {};
  dayMs.forEach((m) => { const ev = E.events[m.ev]; (byGrade[ev.grade] ||= []).push(m); });
  const dayBlocks = Object.keys(byGrade).map(Number).sort((a, b) => a - b).map((g) => {
    const list = byGrade[g];
    const t0 = list.map((m) => m.time).filter(Boolean).sort()[0] || '';
    const t1 = list.map((m) => m.end || m.time).filter(Boolean).sort().pop() || '';
    const bySport = {};
    list.forEach((m) => { const s = E.events[m.ev].sport; bySport[s] = (bySport[s] || 0) + 1; });
    const done = list.filter(isDone).length;
    return `<a class="sum-row" href="#/lich?d=${day}&k=${g}">
      <div><b>Khối ${g}</b> <span class="muted small">· ${esc(levelName(levelOf(g)))} · ${esc(t0)}${t1 && t1 !== t0 ? '–' + esc(t1) : ''}</span>
        <div class="chips" style="margin-top:6px">${Object.entries(bySport).map(([s, n]) => `<span class="tag" style="${sportVars(s)}">${SPORT_ICON[s]}${esc(SPORT[s].name)} · ${n}</span>`).join('')}</div></div>
      <span class="nowrap small ${done ? '' : 'muted'}">${done ? `<b>${done}</b>/${list.length} xong` : list.length + ' trận'} ${I.right}</span></a>`;
  }).join('');
  const dayTitle = day === today ? `Hôm nay · ${weekdayLong(day)} ${fmtDM(day)}` : `${day > today ? 'Ngày thi đấu tiếp theo' : 'Ngày thi đấu gần nhất'} · ${weekdayLong(day)} ${fmtDM(day)}`;

  // Lớp của tôi
  let myBox = '';
  if (myCls) {
    const ms = E.matchesOfClass(myCls).filter((m) => E.isReal(m));
    const next = ms.filter((m) => !isDone(m) && m.date >= today).slice(0, 3);
    myBox = `<div class="card"><div class="card-head"><h3>${I.star} Lớp ${esc(myCls)}</h3><a class="more" href="#/lop/${encodeURIComponent(myCls)}">Xem tất cả ${I.right}</a></div>
      <div class="mlist">${next.length ? next.map((m) => matchRow(E, m, { showDate: true })).join('') : '<div class="empty-box small">Không còn trận sắp tới.</div>'}</div></div>`;
  }
  const classes = E.allClasses();
  const classSearch = `<div class="card card-pad">
      <h3 style="font-size:17px;font-weight:800;margin-bottom:4px">${I.users} Tra cứu lớp</h3>
      <p class="muted small" style="margin:0 0 10px">Nhập tên lớp để xem lịch, kết quả và thứ hạng của lớp ở tất cả các môn.</p>
      <form class="search" id="home-class-form"><span>${I.search}</span><input class="inp" style="width:100%" list="cls-list" id="home-class" placeholder="Ví dụ: 7A05, 10T01, 3A2…" autocomplete="off"></form>
      <datalist id="cls-list">${classes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
    </div>`;
  const news = (S.db.news || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.at || 0) - (a.at || 0)).slice(0, 4);
  const newsBox = `<div class="card"><div class="card-head"><h3>${I.bell} Thông báo từ Ban tổ chức</h3></div>
    <div class="news">${news.length ? news.map((n) => `<div class="news-item"><h4>${n.pinned ? '<span class="pin-tag">Ghim</span>' : ''}${esc(n.title)}</h4><div class="when">${esc(relTime(n.at))}</div><p>${esc(n.body || '')}</p></div>`).join('')
    : `<div class="news-item"><h4>Khai mạc Olympic Thể thao học sinh lần thứ IV</h4><div class="when">Thứ Hai, 28/09/2026</div><p>Các khối thi đấu trong 2 tiết thể thao hằng tuần. Trận nào hoãn sẽ chuyển sang tuần kế tiếp — theo dõi lịch cập nhật tại đây.</p></div>`}</div></div>`;

  const medals = E.medalTable().slice(0, 8);
  const medalBox = `<div class="card"><div class="card-head"><h3>${I.medal} Bảng tổng sắp huy chương</h3><a class="more" href="#/tong-sap">Chi tiết ${I.right}</a></div>
    ${medals.length ? medalTableHtml(medals, { compact: true }) : `<div class="empty-box small">${I.medal}<b>Chưa có huy chương</b>Huy chương được trao khi các nội dung đi đến trận chung kết.</div>`}</div>`;

  app.innerHTML = `
  <section class="hero"><div class="wrap hero-in">
    <div class="hero-copy">
      <div class="hero-school"><img src="assets/logo.svg" alt="Logo Trường Ngôi Sao Hoàng Mai"><div><b>NGÔI SAO HOÀNG MAI</b><small>Tiểu học · THCS · THPT</small></div></div>
      <div class="wordmark" aria-label="OLYMPIC"><span>O</span><span>L</span><span>Y</span><span>M</span><span>P</span><span>I</span><span>C</span></div>
      <div class="hero-sub">THỂ THAO HỌC SINH LẦN THỨ IV · NĂM HỌC ${esc(meta.year || '2026 – 2027')}</div>
      <div class="hero-slogan">${esc(meta.slogan || 'ONE TEAM – ONE SPIRIT')}</div>
      <div class="hero-chips"><span class="hchip ${phase.live ? 'live' : ''}">${esc(phase.label)}</span><span class="hchip">${I.cal} ${esc(fmtDM(meta.start || '2026-09-28'))} – ${esc(fmtDM(meta.end || '2026-11-20'))}/2026</span><span class="hchip">5 môn · 12 khối</span></div>
      <div class="hero-progress"><div class="lbl"><span>Tiến độ giải</span><span class="num">${prog.done}/${prog.total} trận đã có kết quả</span></div><div class="bar"><i style="width:${Math.max(prog.pct, 1)}%"></i></div></div>
    </div>
    <div class="hero-art-box">${heroArt()}</div>
  </div></section>
  <div class="wrap page" style="padding-top:0">
    <div class="sports">${sportCards}</div>
    <div class="cols section">
      <div class="card"><div class="card-head"><h3>${I.cal} ${esc(dayTitle)}</h3><a class="more" href="#/lich?d=${day}">Xem lịch chi tiết ${I.right}</a></div>
        ${dayBlocks || `<div class="empty-box">${I.cal}<b>Không có trận nào</b></div>`}</div>
      <div class="card"><div class="card-head"><h3>${I.whistle} Kết quả mới nhất</h3><a class="more" href="#/lich?st=done">Tất cả ${I.right}</a></div>
        <div class="mlist">${latest.length ? latest.map((m) => matchRow(E, m, { showDate: true })).join('') : `<div class="empty-box small">Chưa có kết quả.</div>`}</div></div>
    </div>
    <div class="cols section">
      <div style="display:flex;flex-direction:column;gap:16px">${myBox}${newsBox}</div>
      <div style="display:flex;flex-direction:column;gap:16px">${classSearch}${medalBox}</div>
    </div>
  </div>`;
  const f = document.getElementById('home-class-form');
  const inp = document.getElementById('home-class');
  const goClass = () => { const v = findClass(E, inp.value); if (v) go('#/lop/' + encodeURIComponent(v)); else if (inp.value.trim()) toast('Không tìm thấy lớp "' + inp.value.trim() + '"', 'err'); };
  f.addEventListener('submit', (e) => { e.preventDefault(); goClass(); });
  inp.addEventListener('change', goClass);
}
function findClass(E, raw) {
  let t = String(raw || '').toUpperCase().replace(/\s+/g, '').replace(/^(\d{1,2})([A-Z])O(?=\d|[HM]?$)/, '$1$20');
  const all = E.allClasses();
  if (all.includes(t)) return t;
  if (all.includes(t.replace(/0$/, ''))) return t.replace(/0$/, '');
  return null;
}
function medalTableHtml(rows, opt = {}) {
  let rank = 0, prev = '';
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th class="l">Lớp</th><th><span class="dot g"></span>Vàng</th><th><span class="dot s"></span>Bạc</th><th><span class="dot b"></span>Đồng</th><th>Tổng</th></tr></thead><tbody>
  ${rows.map((r, i) => { const key = `${r.g}-${r.s}-${r.b}`; if (key !== prev) { rank = i + 1; prev = key; }
    return `<tr><td><span class="rk ${rank === 1 ? 'g' : rank === 2 ? 's' : rank === 3 ? 'b' : ''}">${rank}</span></td><td class="l team"><a href="#/lop/${encodeURIComponent(r.t)}">${esc(r.t)}</a>${opt.compact ? '' : `<div class="muted xs">${esc(levelName(levelOf(gradeOfClass(r.t))))} · Khối ${gradeOfClass(r.t)}</div>`}</td><td><b>${r.g}</b></td><td><b>${r.s}</b></td><td><b>${r.b}</b></td><td class="pts">${r.n}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}

// ============================================================
//  LỊCH THI ĐẤU
// ============================================================
function viewSchedule(S) {
  const E = S.engine, meta = S.db.meta || {};
  const q = route.q;
  const real = Object.values(E.matches);
  const allDates = [...new Set(real.map((m) => m.date).filter(Boolean))].sort();
  const today = todayISO();
  const defDay = allDates.includes(today) ? today : (allDates.find((d) => d > today) || allDates[0]);
  const whole = q.get('w') === '1';
  const day = q.get('d') || defDay;
  const mon = mondayOf(day);
  const lv = q.get('lv') || '', k = q.get('k') || '', sp = q.get('m') || '', cls = (q.get('lop') || '').toUpperCase(), stf = q.get('st') || '';
  const showWo = q.get('wo') === '1';
  const days = [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
  const filt = (m) => {
    const ev = E.events[m.ev];
    if (!ev) return false;
    if (lv && ev.level !== lv) return false;
    if (k && ev.grade !== Number(k)) return false;
    if (sp && ev.sport !== sp) return false;
    const st = E.status(m);
    if (!showWo && st === 'wo') return false;
    if (stf === 'done' && !isDone(m)) return false;
    if (stf === 'todo' && (isDone(m) || st === 'cancel')) return false;
    if (cls) { const cs = E.classesOf(m); if (!cs.some((c) => c === cls || c.startsWith(cls))) return false; }
    return true;
  };
  const countDay = (d) => real.filter((m) => m.date === d && filt(m)).length;
  let list;
  if (stf === 'done' && !q.get('d') && !whole) list = real.filter((m) => filt(m) && isDone(m)).sort((a, b) => cmpMatch(b, a)).slice(0, 200);
  else list = real.filter((m) => (whole ? m.date >= mon && m.date <= addDays(mon, 6) : m.date === day) && filt(m)).sort(cmpMatch);
  const wk = weekNo(mon, meta.week1 || '2026-09-28');

  // nhóm: ngày → khối
  const byDate = {};
  list.forEach((m) => { (byDate[m.date] ||= {}); const g = E.events[m.ev].grade; (byDate[m.date][g] ||= []).push(m); });
  const body = Object.keys(byDate).sort(stf === 'done' && !q.get('d') ? (a, b) => b.localeCompare(a) : undefined).map((d) => {
    const grades = Object.keys(byDate[d]).map(Number).sort((a, b) => a - b);
    return `<div class="day"><div class="day-h"><h3>${esc(weekdayLong(d))}, ${esc(fmtDM(d))}</h3><span class="muted">${Object.values(byDate[d]).flat().length} trận</span></div>
      ${grades.map((g) => { const ms = byDate[d][g]; return `<div class="card gblock"><div class="gblock-h"><b>Khối ${g} <span class="muted small" style="font-weight:600">· ${esc(levelName(levelOf(g)))}</span></b><span class="muted">${ms.filter(isDone).length}/${ms.length} có kết quả</span></div>
        <div class="mlist">${ms.map((m) => matchRow(E, m, { grade: false, showStatus: true })).join('')}</div></div>`; }).join('')}</div>`;
  }).join('');

  const gradeOpts = LEVELS.filter((l) => !lv || l.id === lv).flatMap((l) => l.grades).map((g) => `<option value="${g}" ${String(g) === k ? 'selected' : ''}>Khối ${g}</option>`).join('');
  app.innerHTML = `<div class="wrap page">
    <div class="page-head"><div><div class="eyebrow">Lịch thi đấu</div><h1>${stf === 'done' && !q.get('d') ? 'Kết quả đã cập nhật' : whole ? `Tuần ${wk} · ${fmtDM(mon)} – ${fmtDM(addDays(mon, 4))}` : `${esc(weekdayLong(day))}, ${esc(fmtDM(day))}`}</h1>
      <p>Các khối thi đấu trong 2 tiết thể thao hằng tuần. Bấm vào trận để xem chi tiết.</p></div>
      <button class="btn no-print" onclick="window.print()">${I.print} In lịch</button></div>
    <div class="daybar">
      <button class="nav" data-wk="-7" aria-label="Tuần trước">${I.left}</button>
      <div class="days">${days.map((d) => { const c = countDay(d); return `<button class="dbtn ${d === day && !whole && !(stf === 'done' && !q.get('d')) ? 'on' : ''} ${d === today ? 'today' : ''} ${c ? '' : 'empty'}" data-day="${d}"><span class="w">${esc(fmtDate(d).split(',')[0])}</span><span class="d">${esc(fmtDM(d))}</span><span class="c">${c ? c + ' trận' : '—'}</span></button>`; }).join('')}
        <button class="dbtn ${whole ? 'on' : ''}" data-whole="1"><span class="w">Tuần ${wk}</span><span class="d">Cả tuần</span><span class="c">${days.reduce((n, d) => n + countDay(d), 0)} trận</span></button></div>
      <button class="nav" data-wk="7" aria-label="Tuần sau">${I.right}</button>
    </div>
    <div class="filters">
      <div class="chips">${[['', 'Tất cả cấp'], ...LEVELS.map((l) => [l.id, l.name])].map(([id, n]) => `<button class="chip ${lv === id ? 'on' : ''}" data-f="lv" data-v="${id}">${esc(n)}</button>`).join('')}</div>
      <select class="sel" data-fsel="k" aria-label="Khối"><option value="">Tất cả khối</option>${gradeOpts}</select>
      <select class="sel" data-fsel="m" aria-label="Môn"><option value="">Tất cả môn</option>${SPORTS.map((s) => `<option value="${s.id}" ${sp === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <select class="sel" data-fsel="st" aria-label="Trạng thái"><option value="">Mọi trạng thái</option><option value="todo" ${stf === 'todo' ? 'selected' : ''}>Chưa có kết quả</option><option value="done" ${stf === 'done' ? 'selected' : ''}>Đã có kết quả</option></select>
      <div class="search"><span>${I.search}</span><input class="inp" id="f-lop" value="${esc(cls)}" placeholder="Lọc theo lớp…" style="width:150px"></div>
      <label class="check"><input type="checkbox" id="f-wo" ${showWo ? 'checked' : ''}> Hiện trận miễn đấu</label>
    </div>
    ${body || `<div class="card empty-box">${I.cal}<b>Không có trận nào phù hợp</b>Thử chọn ngày khác hoặc bỏ bớt bộ lọc.</div>`}
  </div>`;
  app.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => setQuery({ d: b.dataset.day, w: null, st: stf === 'done' ? null : stf })));
  app.querySelector('[data-whole]').addEventListener('click', () => setQuery({ w: '1', d: mon }));
  app.querySelectorAll('[data-wk]').forEach((b) => b.addEventListener('click', () => {
    const nd = addDays(mon, Number(b.dataset.wk));
    const first = allDates.find((d) => d >= nd && d <= addDays(nd, 6)) || nd;
    setQuery({ d: whole ? nd : first });
  }));
  app.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => setQuery({ [b.dataset.f]: b.dataset.v, k: b.dataset.f === 'lv' ? null : k })));
  app.querySelectorAll('[data-fsel]').forEach((s) => s.addEventListener('change', () => setQuery({ [s.dataset.fsel]: s.value })));
  app.querySelector('#f-wo').addEventListener('change', (e) => setQuery({ wo: e.target.checked ? '1' : null }));
  const fl = app.querySelector('#f-lop');
  fl.addEventListener('input', debounce(() => { setQuery({ lop: fl.value.trim() }); const n = app.querySelector('#f-lop'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 400));
}

// ============================================================
//  KẾT QUẢ & BẢNG XẾP HẠNG (theo môn → khối → nội dung)
// ============================================================
function viewResults(S) {
  const E = S.engine;
  const sp = route.parts[0] && SPORT[route.parts[0]] ? route.parts[0] : (pref.sport || 'bongda');
  const evs = E.eventsOf({ sport: sp });
  const grades = [...new Set(evs.map((e) => e.grade))].sort((a, b) => a - b);
  let grade = Number(route.parts[1]) || pref['grade_' + sp] || grades[0];
  if (!grades.includes(grade)) grade = grades[0];
  const inGrade = evs.filter((e) => e.grade === grade);
  let ev = inGrade.find((e) => e.cat === route.parts[2]) || inGrade.find((e) => e.cat === pref['cat_' + sp]) || inGrade[0];
  savePref({ sport: sp, ['grade_' + sp]: grade, ...(ev && ev.cat ? { ['cat_' + sp]: ev.cat } : {}) });
  const s = SPORT[sp];
  const tabs = SPORTS.map((x) => `<a class="stab ${x.id === sp ? 'on' : ''} ${x.id === 'keoco' ? 'yellow' : ''}" style="${sportVars(x.id)}" href="#/ket-qua/${x.id}">${SPORT_ICON[x.id]}${esc(x.name)}</a>`).join('');
  const gradebar = LEVELS.map((l) => {
    const gs = l.grades.filter((g) => grades.includes(g));
    if (!gs.length) return '';
    return `<div class="lv"><span>${esc(l.name)}</span><div class="chips scroll">${gs.map((g) => `<a class="chip ${g === grade ? 'on' : ''}" href="#/ket-qua/${sp}/${g}">Khối ${g}</a>`).join('')}</div></div>`;
  }).join('');
  let content = '';
  if (!ev) content = `<div class="card empty-box">${I.info}<b>Chưa có nội dung</b></div>`;
  else if (ev.kind === 'team') content = teamEventView(E, ev);
  else content = indEventView(E, ev, inGrade);
  app.innerHTML = `<div class="wrap page">
    <div class="page-head"><div><div class="eyebrow">Kết quả & bảng xếp hạng</div><h1>${esc(s.name)} · Khối ${grade}</h1></div></div>
    <div class="sporttabs">${tabs}</div>
    <div class="gradebar">${gradebar}</div>
    ${content}
  </div>`;
  app.querySelectorAll('[data-toggle-done]').forEach((b) => b.addEventListener('click', () => { savePref({ onlyDone: !pref.onlyDone }); render(); }));
}
function formatText(ev) {
  const n = Object.keys(ev.groups || {}).length;
  if (ev.format === 'RR') return `${ev.groups.A.length} đội thi đấu vòng tròn một lượt tính điểm`;
  const teams = Object.values(ev.groups).reduce((a, l) => a + l.length, 0);
  return `${teams} đội · ${n} bảng → ${ev.format === 'QF' ? 'Tứ kết → ' : ''}Bán kết → Chung kết`;
}
function matchesByWeek(E, list, meta) {
  const by = {};
  list.forEach((m) => { const w = weekNo(m.date, meta.week1 || '2026-09-28'); (by[w] ||= []).push(m); });
  return Object.keys(by).map(Number).sort((a, b) => a - b).map((w) => {
    const ms = by[w];
    const d0 = mondayOf(ms[0].date);
    return `<div class="card gblock"><div class="gblock-h"><b>Tuần ${w} <span class="muted small" style="font-weight:600">· ${fmtDM(d0)} – ${fmtDM(addDays(d0, 4))}</span></b><span class="muted">${ms.filter(isDone).length}/${ms.length}</span></div>
      <div class="mlist">${ms.map((m) => matchRow(E, m, { showDate: true, showSport: false, grade: false, showStatus: true })).join('')}</div></div>`;
  }).join('');
}
function teamEventView(E, ev) {
  const S = store.getState();
  const prog = E.progress({ ev: ev.id });
  const pod = E.podium(ev.id);
  const groups = Object.keys(ev.groups);
  const ms = E.matchesOf(ev.id).filter((m) => E.status(m) !== 'wo');
  const shown = pref.onlyDone ? ms.filter(isDone) : ms;
  return `
    <div class="card card-pad" style="display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${sportTag(ev.sport)}<span class="tag">${esc(levelName(ev.level))}</span>${ev.days ? `<span class="tag">${I.cal} ${esc(ev.days)}</span>` : ''}</div>
        <h2 style="font-size:20px;font-weight:800;margin-top:8px">${esc(ev.name)}</h2><div class="muted small">${esc(formatText(ev))}</div></div>
      <div style="min-width:200px"><div class="muted xs" style="display:flex;justify-content:space-between"><span>Tiến độ</span><span class="num">${prog.done}/${prog.total} trận</span></div>
        <div class="mini" style="height:8px;background:var(--line-2);border-radius:9px;overflow:hidden;margin-top:6px"><i style="display:block;height:100%;width:${prog.pct}%;background:${SPORT[ev.sport].color}"></i></div></div>
    </div>
    ${pod.length ? `<div class="section"><div class="section-title"><h2>${I.medal} Thứ hạng chung cuộc</h2></div>${podiumHtml(E, ev.id)}</div>` : ''}
    <div class="section"><div class="section-title"><h2>${I.list} ${ev.format === 'RR' ? 'Bảng xếp hạng' : 'Vòng bảng'}</h2></div>
      <div class="${groups.length > 1 ? 'grid2' : ''}">${groups.map((g) => standingsTable(E, ev.id, g, { form: true })).join('')}</div></div>
    ${ev.format !== 'RR' ? `<div class="section"><div class="section-title"><h2>${I.bracket} Vòng loại trực tiếp</h2><span class="muted small">Tên đội tự điền khi vòng trước kết thúc</span></div><div class="card card-pad">${teamBracket(E, ev.id)}</div></div>` : ''}
    <div class="section"><div class="section-title"><h2>${I.cal} Lịch & kết quả</h2><button class="btn sm" data-toggle-done>${pref.onlyDone ? 'Hiện tất cả trận' : 'Chỉ trận đã có kết quả'}</button></div>
      ${matchesByWeek(E, shown, S.db.meta || {}) || `<div class="card empty-box">Chưa có trận đã có kết quả.</div>`}</div>`;
}
function indEventView(E, ev, inGrade) {
  const S = store.getState();
  const cats = inGrade.map((e) => `<a class="chip ${e.id === ev.id ? 'on' : ''}" href="#/ket-qua/${e.sport}/${e.grade}/${e.cat}">${esc(e.catName)}</a>`).join('');
  const prog = E.progress({ ev: ev.id });
  const ms = E.matchesOf(ev.id).filter((m) => E.status(m) !== 'wo');
  const shown = pref.onlyDone ? ms.filter(isDone) : ms;
  const athletes = new Map();
  E.matchesOf(ev.id).forEach((m) => E.sidesOf(m).forEach((r) => { if (r.kind === 'ath' && !r.via) athletes.set((r.p || '') + '|' + r.t, r); }));
  const karate = ev.sport === 'karate';
  return `
    <div class="chips" style="margin-bottom:14px">${cats}</div>
    <div class="card card-pad" style="display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${sportTag(ev.sport)}<span class="tag">${esc(levelName(ev.level))}</span>${karate ? `<span class="tag">${I.cal} ${esc(fmtFull(E.finalMatch(ev) ? E.finalMatch(ev).date : ''))}</span>` : ev.days ? `<span class="tag">${I.cal} ${esc(ev.days)}</span>` : ''}</div>
        <h2 style="font-size:20px;font-weight:800;margin-top:8px">${esc(ev.name)}</h2>
        <div class="muted small">${athletes.size} ${ev.cat && ev.cat.startsWith('doi') ? 'cặp VĐV' : 'VĐV'} · Thi đấu loại trực tiếp${karate ? ' · Trọng tài phất cờ (2–1 hoặc 3–0)' : ' · 1 séc 25 điểm (chung kết 31 điểm)'}${ev.venue ? ' · ' + esc(ev.venue) : ''}</div></div>
      <div style="min-width:200px"><div class="muted xs" style="display:flex;justify-content:space-between"><span>Tiến độ</span><span class="num">${prog.done}/${prog.total} trận</span></div>
        <div style="height:8px;background:var(--line-2);border-radius:9px;overflow:hidden;margin-top:6px"><i style="display:block;height:100%;width:${prog.pct}%;background:${SPORT[ev.sport].color}"></i></div></div>
    </div>
    <div class="section"><div class="section-title"><h2>${I.medal} Thứ hạng</h2></div>${podiumHtml(E, ev.id)}</div>
    <div class="section"><div class="section-title"><h2>${I.bracket} Nhánh đấu</h2><span class="muted small">Người thắng tự điền vào vòng sau · kéo ngang để xem hết</span></div><div class="card card-pad">${indBracket(E, ev.id)}</div></div>
    <div class="section"><div class="section-title"><h2>${I.cal} Lịch & kết quả</h2><button class="btn sm" data-toggle-done>${pref.onlyDone ? 'Hiện tất cả trận' : 'Chỉ trận đã có kết quả'}</button></div>
      ${karate ? `<div class="card gblock"><div class="mlist">${shown.map((m) => matchRow(E, m, { showDate: true, showSport: false, grade: false, showStatus: true })).join('') || '<div class="empty-box">Chưa có trận.</div>'}</div></div>` : (matchesByWeek(E, shown, S.db.meta || {}) || `<div class="card empty-box">Chưa có trận đã có kết quả.</div>`)}</div>`;
}

// ============================================================
//  BẢNG TỔNG SẮP & NHÀ VÔ ĐỊCH
// ============================================================
function viewMedals(S) {
  const E = S.engine;
  const tab = route.q.get('tab') || 'tong-sap';
  const lv = route.q.get('lv') || '', k = route.q.get('k') || '';
  const rows = E.medalTable({ level: lv, grade: k });
  const tabs = `<div class="chips" style="margin-bottom:12px">${[['tong-sap', 'Tổng sắp huy chương theo lớp'], ['vo-dich', 'Nhà vô địch từng nội dung']].map(([id, n]) => `<button class="chip ${tab === id ? 'on' : ''}" data-tab="${id}">${esc(n)}</button>`).join('')}</div>`;
  const filters = `<div class="filters"><div class="chips">${[['', 'Toàn trường'], ...LEVELS.map((l) => [l.id, l.name])].map(([id, n]) => `<button class="chip ${lv === id ? 'on' : ''}" data-lv="${id}">${esc(n)}</button>`).join('')}</div>
    <select class="sel" id="mk"><option value="">Tất cả khối</option>${LEVELS.filter((l) => !lv || l.id === lv).flatMap((l) => l.grades).map((g) => `<option value="${g}" ${String(g) === k ? 'selected' : ''}>Khối ${g}</option>`).join('')}</select></div>`;
  let body;
  if (tab === 'tong-sap') {
    const tot = rows.reduce((a, r) => ({ g: a.g + r.g, s: a.s + r.s, b: a.b + r.b }), { g: 0, s: 0, b: 0 });
    const evs = E.eventsOf({ level: lv, grade: k });
    const decided = evs.filter((e) => E.podium(e.id).some((p) => p.rank === 1)).length;
    body = `<div class="stats" style="margin-bottom:16px">
        <div class="card stat"><div class="v">${decided}/${evs.length}</div><div class="k">Nội dung đã có nhà vô địch</div></div>
        <div class="card stat"><div class="v"><span class="dot g"></span>${tot.g}</div><div class="k">Huy chương Vàng</div></div>
        <div class="card stat"><div class="v"><span class="dot s"></span>${tot.s}</div><div class="k">Huy chương Bạc</div></div>
        <div class="card stat"><div class="v"><span class="dot b"></span>${tot.b}</div><div class="k">Huy chương Đồng</div></div></div>
      <div class="card">${rows.length ? medalTableHtml(rows) : `<div class="empty-box">${I.medal}<b>Chưa có huy chương nào</b>Bảng tổng sắp tự cập nhật khi các nội dung có kết quả chung kết (đồng đội và cá nhân). Xếp hạng theo số HCV, rồi HCB, rồi HCĐ.</div>`}</div>
      <p class="muted small">Cách tính: mỗi nội dung trao 1 HCV (Nhất), 1 HCB (Nhì), 2 HCĐ (đồng hạng Ba — riêng Bóng rổ khối 10, 11 trao 1 hạng Ba theo điều lệ). Huy chương cá nhân (Cầu lông, Karate) tính cho lớp của VĐV.</p>`;
  } else {
    const grades = LEVELS.filter((l) => !lv || l.id === lv).flatMap((l) => l.grades).filter((g) => !k || g === Number(k));
    body = grades.map((g) => {
      const evs = E.eventsOf({ grade: g });
      return `<div class="card section"><div class="card-head"><h3>Khối ${g} <span class="muted small" style="font-weight:600">· ${esc(levelName(levelOf(g)))}</span></h3></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Nội dung</th><th class="l"><span class="dot g"></span>Nhất</th><th class="l"><span class="dot s"></span>Nhì</th><th class="l"><span class="dot b"></span>Ba</th></tr></thead><tbody>
        ${evs.map((e) => { const p = E.podium(e.id); const nm = (r) => p.filter((x) => x.rank === r).map((x) => x.side.kind === 'ath' ? `${esc(x.side.p || x.side.t)} <span class="muted xs">${esc(x.side.t)}</span>` : `<b>${esc(x.side.t)}</b>`).join('<br>') || '<span class="muted">—</span>';
          return `<tr><td class="l"><a href="#/ket-qua/${e.sport}/${e.grade}${e.cat ? '/' + e.cat : ''}" style="display:inline-flex;gap:6px;align-items:center">${sportTag(e.sport, e.kind === 'ind' ? SPORT[e.sport].name + ' · ' + e.catName : SPORT[e.sport].name)}</a></td><td class="l">${nm(1)}</td><td class="l">${nm(2)}</td><td class="l">${nm(3)}</td></tr>`; }).join('')}
        </tbody></table></div></div>`;
    }).join('');
  }
  app.innerHTML = `<div class="wrap page"><div class="page-head"><div><div class="eyebrow">Tổng hợp kết quả</div><h1>Bảng tổng sắp</h1><p>Tổng hợp huy chương của các lớp ở tất cả các môn, tất cả các khối — tự động cập nhật theo kết quả.</p></div></div>
    ${tabs}${filters}${body}</div>`;
  app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setQuery({ tab: b.dataset.tab })));
  app.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => setQuery({ lv: b.dataset.lv, k: null })));
  app.querySelector('#mk').addEventListener('change', (e) => setQuery({ k: e.target.value }));
}

// ============================================================
//  TRA CỨU LỚP
// ============================================================
function viewClass(S) {
  const E = S.engine;
  const all = E.allClasses();
  const cls = route.parts[0] ? findClass(E, route.parts[0]) : null;
  if (!cls) {
    const byG = {};
    all.forEach((c) => { (byG[gradeOfClass(c)] ||= []).push(c); });
    app.innerHTML = `<div class="wrap page"><div class="page-head"><div><div class="eyebrow">Tra cứu lớp</div><h1>Chọn lớp của bạn</h1><p>Xem lịch thi đấu, kết quả, thứ hạng và huy chương của một lớp ở tất cả các môn.</p></div></div>
      <div class="card card-pad" style="margin-bottom:16px"><form class="search" id="cls-form"><span>${I.search}</span><input class="inp" style="width:100%;max-width:420px" id="cls-inp" list="cls-list2" placeholder="Nhập tên lớp, ví dụ 7A05" autofocus autocomplete="off"></form><datalist id="cls-list2">${all.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="card card-pad classgrid">${LEVELS.map((l) => `<div><div class="eyebrow" style="margin:6px 0 8px">${esc(l.name)}</div>${l.grades.map((g) => `<div class="row"><b>Khối ${g}</b>${(byG[g] || []).map((c) => `<a class="cls-btn" href="#/lop/${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>`).join('')}</div>`).join('')}</div></div>`;
    const f = app.querySelector('#cls-form'), inp = app.querySelector('#cls-inp');
    const goC = () => { const v = findClass(E, inp.value); if (v) go('#/lop/' + encodeURIComponent(v)); else if (inp.value.trim()) toast('Không tìm thấy lớp "' + inp.value.trim() + '"', 'err'); };
    f.addEventListener('submit', (e) => { e.preventDefault(); goC(); });
    inp.addEventListener('change', goC);
    return;
  }
  const g = gradeOfClass(cls);
  const today = todayISO();
  const ms = E.matchesOfClass(cls).filter((m) => E.isReal(m));
  const upcoming = ms.filter((m) => !isDone(m) && m.st !== 'cancel' && m.date >= today);
  const past = ms.filter((m) => isDone(m)).reverse();
  const medal = E.medalTable().find((r) => r.t === cls);
  const teamEvs = E.eventsOf({ grade: g }).filter((e) => e.kind === 'team' && Object.values(e.groups).some((l) => l.includes(cls)));
  const teamCards = teamEvs.map((e) => {
    const grp = Object.keys(e.groups).find((k2) => e.groups[k2].includes(cls));
    const st = E.standings(e.id, grp);
    const row = st.rows.find((r) => r.t === cls);
    const pod = E.podium(e.id).find((p) => p.side.t === cls);
    return `<a class="sum-row" href="#/ket-qua/${e.sport}/${e.grade}"><div style="display:flex;gap:10px;align-items:center">${sportTag(e.sport)}<span class="small">${e.format === 'RR' ? 'Vòng tròn' : 'Bảng ' + esc(grp)} · hạng <b>${row ? row.rank : '–'}</b>/${st.rows.length} · ${row ? row.pts : 0} điểm${pod ? ` · <b>${pod.rank === 1 ? 'Vô địch' : pod.rank === 2 ? 'Á quân' : 'Hạng Ba'}</b>` : ''}</span></div><span class="small muted nowrap">${row ? `${row.w}T ${e.sport === 'bongda' ? row.d + 'H ' : ''}${row.l}B` : ''} ${I.right}</span></a>`;
  }).join('');
  const inds = new Map();
  Object.values(E.matches).forEach((m) => { const ev = E.events[m.ev]; if (!ev || ev.kind !== 'ind') return; E.sidesOf(m).forEach((r) => { if (r.kind === 'ath' && r.t === cls && !r.via) { const key = ev.id + '|' + r.p; inds.set(key, { ev, p: r.p }); } }); });
  const indRows = [...inds.values()].sort((a, b) => a.ev.sport.localeCompare(b.ev.sport) || a.ev.cat.localeCompare(b.ev.cat)).map((x) => {
    const pod = E.podium(x.ev.id).find((p) => p.side.t === cls && p.side.p === x.p);
    return `<a class="sum-row" href="#/ket-qua/${x.ev.sport}/${x.ev.grade}/${x.ev.cat}"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${sportTag(x.ev.sport, SPORT[x.ev.sport].name + ' · ' + x.ev.catName)}<b class="small">${esc(x.p)}</b>${pod ? `<span class="tag" style="--t:#fff1c2;--k:#8a6400">${pod.rank === 1 ? 'HCV' : pod.rank === 2 ? 'HCB' : 'HCĐ'}</span>` : ''}</div>${I.right}</a>`;
  }).join('');
  const following = pref.myClass === cls;
  app.innerHTML = `<div class="wrap page">
    <div class="class-hero"><div><div class="sub">${esc(levelName(levelOf(g)))} · Khối ${g}</div><h1>Lớp ${esc(cls)}</h1>
      <button class="btn sm" id="follow" style="margin-top:8px;position:relative;z-index:1">${I.star} ${following ? 'Đang theo dõi lớp này' : 'Theo dõi lớp này trên trang chủ'}</button></div>
      <div class="medals"><span><span class="dot g"></span>${medal ? medal.g : 0}</span><span><span class="dot s"></span>${medal ? medal.s : 0}</span><span><span class="dot b"></span>${medal ? medal.b : 0}</span></div></div>
    <div class="cols section">
      <div>
        <div class="section-title"><h2>${I.cal} Trận sắp tới</h2><span class="muted small">${upcoming.length} trận</span></div>
        <div class="card"><div class="mlist">${upcoming.slice(0, 30).map((m) => matchRow(E, m, { showDate: true, grade: false })).join('') || '<div class="empty-box small">Không còn trận sắp tới.</div>'}</div></div>
        <div class="section-title section"><h2>${I.whistle} Kết quả đã đấu</h2><span class="muted small">${past.length} trận</span></div>
        <div class="card"><div class="mlist">${past.map((m) => matchRow(E, m, { showDate: true, grade: false })).join('') || '<div class="empty-box small">Chưa có kết quả.</div>'}</div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card"><div class="card-head"><h3>${I.users} Môn đồng đội</h3></div>${teamCards || '<div class="empty-box small">Không có.</div>'}</div>
        <div class="card"><div class="card-head"><h3>${I.star} Vận động viên cá nhân</h3></div>${indRows || '<div class="empty-box small">Lớp chưa có VĐV đăng ký Cầu lông / Karate.</div>'}</div>
      </div>
    </div></div>`;
  app.querySelector('#follow').addEventListener('click', () => { savePref({ myClass: following ? null : cls }); toast(following ? 'Đã bỏ theo dõi' : `Đã theo dõi lớp ${cls} — xem nhanh ở trang chủ`, 'ok'); render(); });
}

// ============================================================
//  ĐIỀU LỆ
// ============================================================
function ruleBody(text) {
  return String(text || '').split('\n').map((raw) => {
    const l = raw.trim();
    if (!l) return '';
    const e = esc(l);
    if (/^(ĐIỀU|ĐIỂU)\s+[IVX]+|^[IVX]+\.\s|^[IVX]+\.[A-ZĐ]/.test(l)) return `<h3>${e}</h3>`;
    if (/^\d+(\.\d+)*\.?\s/.test(l) && l.length < 90 && !/[.;]$/.test(l)) return `<p><b>${e}</b></p>`;
    if (/^[-–]\s*/.test(l)) return `<p class="li">${esc(l.replace(/^[-–]\s*/, ''))}</p>`;
    if (/^\+\s*/.test(l)) return `<p class="li2">${esc(l.replace(/^\+\s*/, ''))}</p>`;
    if (/^\*/.test(l)) return `<div class="note">${esc(l.replace(/^\*\s*/, ''))}</div>`;
    if (/^'/.test(l)) return `<p class="li">${esc(l.replace(/^'[-\s]*/, ''))}</p>`;
    return `<p>${e}</p>`;
  }).join('');
}
function viewRules(S) {
  const rules = S.db.rules || {};
  const general = S.db.general || {};
  const sp = route.parts[0] || 'chung';
  const lv = route.parts[1] || pref.rulesLv || 'THCS';
  savePref({ rulesLv: lv });
  const nav = `<div class="grp"><b>${I.info} Quy định chung</b>${LEVELS.map((l) => `<a class="${sp === 'chung' && lv === l.id ? 'on' : ''}" href="#/dieu-le/chung/${l.id}">${esc(l.name)}</a>`).join('')}</div>` +
    SPORTS.map((s) => `<div class="grp"><b style="color:${s.ink}">${SPORT_ICON[s.id]} ${esc(s.name)}</b>${LEVELS.map((l) => rules[`${s.id}-${l.id}`] ? `<a class="${sp === s.id && lv === l.id ? 'on' : ''}" href="#/dieu-le/${s.id}/${l.id}">${esc(l.name)}</a>` : '').join('')}</div>`).join('');
  let doc;
  if (sp === 'chung') {
    const g = general[lv] || {};
    const contacts = (S.db.meta.contacts || []).map((c) => `<p class="li"><b>${esc(SPORT[c.sport] ? SPORT[c.sport].name : c.sport)}</b> – ${esc(c.name)}</p>`).join('');
    doc = `<div class="doc-title">OLYMPIC THỂ THAO HỌC SINH LẦN THỨ IV\nNĂM HỌC 2026 – 2027 · ${esc(levelName(lv).toUpperCase())}</div>
      <h3>Quy định đăng ký thi đấu</h3>${ruleBody(g.register)}
      <h3>Lưu ý quan trọng</h3>${ruleBody(g.important)}
      ${g.extra ? `<h3>Điều chỉnh lịch học</h3>${ruleBody(g.extra)}` : ''}
      <h3>Giáo viên phụ trách từng môn</h3>${contacts}<div class="note">Tổ Thể thao chỉ làm việc với GVCN, không làm việc trực tiếp với phụ huynh. Phụ huynh cần trao đổi vui lòng liên hệ GVCN của lớp.</div>`;
  } else {
    const r = rules[`${sp}-${lv}`];
    doc = r ? `<div class="doc-title">${esc(r.title)}</div>${ruleBody(r.body)}<div class="sign">${esc((r.dated || '').replace(/NGƯỜI LẬP.*$/i, '').trim())}${r.author ? `<br>Người lập: <b>${esc(capFirst(r.author))}</b>` : ''}</div>`
      : `<div class="empty-box">${I.book}<b>Chưa có điều lệ</b></div>`;
  }
  app.innerHTML = `<div class="wrap page"><div class="page-head"><div><div class="eyebrow">Điều lệ giải</div><h1>${sp === 'chung' ? 'Quy định chung' : esc(SPORT[sp] ? SPORT[sp].name : '')} · ${esc(levelName(lv))}</h1><p>Theo văn bản của Tổ Thể thao. Chỉ Ban tổ chức có quyền điều chỉnh, bổ sung nội dung điều lệ.</p></div><button class="btn no-print" onclick="window.print()">${I.print} In điều lệ</button></div>
    <div class="rules"><nav class="card rules-nav">${nav}</nav><article class="card doc">${doc}</article></div></div>`;
}

// ============================================================
//  QUẢN TRỊ (tải riêng khi cần)
// ============================================================
async function viewAdmin(S) {
  if (!adminMod) {
    app.innerHTML = `<div class="wrap page"><div class="skeleton" style="height:300px"></div></div>`;
    adminMod = await import('./admin.js?v=' + ASSET_VER);
  }
  adminMod.render(app, { store, route, go, setQuery, render });
}

// ============================================================
//  KHỞI ĐỘNG
// ============================================================
document.addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit-match]');
  if (edit) {
    const id = edit.dataset.editMatch;
    closeModal();
    if (!adminMod) adminMod = await import('./admin.js?v=' + ASSET_VER);
    adminMod.openEditor(id, { store, render });
    return;
  }
  const row = e.target.closest('[data-match]');
  if (row && !e.target.closest('a,button,input,select,textarea')) {
    const S = store.getState();
    const m = S.db.matches[row.dataset.match];
    matchDetail(S.engine, row.dataset.match, { canEdit: m && store.canEdit(m.ev.split('-')[0]) });
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches && e.target.matches('.mrow[data-match]')) e.target.click();
});
window.addEventListener('hashchange', () => { route = parseHash(); closeModal(); window.scrollTo(0, 0); render(); });
store.onChange(() => { if (route.name === 'quan-tri' && adminMod && adminMod.isBusy && adminMod.isBusy()) { adminMod.notifyUpdate && adminMod.notifyUpdate(); return; } render(); });
route = parseHash();
render();
store.init().catch((e) => { console.error(e); app.innerHTML = `<div class="wrap page"><div class="card empty-box">${I.info}<b>Không tải được dữ liệu</b>${esc(e.message)}</div></div>`; });
