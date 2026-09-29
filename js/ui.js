// Thành phần giao diện dùng chung
import { esc, fmtDate, fmtFull, timeRange, relTime } from './util.js';
import { SPORT, STATUS, isDone, LEVEL } from './engine.js';
import { SPORT_ICON, I } from './icons.js';

export const sportVars = (id) => { const s = SPORT[id] || {}; return `--c:${s.color};--t:${s.tint};--k:${s.ink}`; };
export const sportTag = (id, text) => `<span class="tag" style="${sportVars(id)}">${SPORT_ICON[id] || ''}${esc(text || (SPORT[id] || {}).name || '')}</span>`;
export const levelName = (lv) => (LEVEL[lv] || {}).name || lv;
export function capFirst(s) {
  const t = String(s || '').trim();
  if (!t) return t;
  if (t === t.toUpperCase()) { const l = t.toLocaleLowerCase('vi'); return l.charAt(0).toLocaleUpperCase('vi') + l.slice(1); }
  return t;
}

// ---------- một bên của trận ----------
export function sideHtml(E, r, cls = '') {
  if (!r) return '';
  if (r.kind === 'team') return `<div class="side ${cls}">${esc(r.t)}${r.via ? `<small>${esc(r.via)}</small>` : ''}</div>`;
  if (r.kind === 'ath') return `<div class="side ${cls}">${esc(r.p || r.t)}${r.p ? `<small>${esc(r.t)}${r.via ? ' · ' + esc(r.via) : ''}</small>` : ''}</div>`;
  if (r.kind === 'bye') return `<div class="side bye ${cls}">${r.t ? esc(r.t) + ' – ' : ''}không thi đấu</div>`;
  return `<div class="side tbd ${cls}">${esc(r.label || 'Chưa xác định')}</div>`;
}
export function scoreHtml(E, m) {
  const st = E.status(m);
  if (isDone(m) || (st === 'live' && Number.isFinite(m.sa))) {
    const w = E.winner(m);
    const a = w === 'a' ? 'w' : w === 'b' ? 'l' : '', b = w === 'b' ? 'w' : w === 'a' ? 'l' : '';
    return `<div><div class="score"><span class="${a}">${m.sa}</span><span class="d">–</span><span class="${b}">${m.sb}</span></div>${m.pen ? `<div class="pen">${esc(m.pen)}</div>` : ''}</div>`;
  }
  if (st === 'wo') return `<div class="score pending">Miễn đấu</div>`;
  if (st === 'post') return `<div class="score pending">Hoãn</div>`;
  if (st === 'cancel') return `<div class="score pending">Hủy</div>`;
  return `<div class="score pending">${esc(m.time || 'vs')}</div>`;
}
export function statusPill(E, m) {
  const st = E.status(m);
  const s = STATUS[st] || STATUS.sched;
  return `<span class="st ${s.cls}">${esc(s.name)}</span>`;
}
export function evCaption(E, m, opt = {}) {
  const ev = E.events[m.ev] || {};
  const bits = [];
  if (opt.grade !== false) bits.push('Khối ' + ev.grade);
  if (ev.catName) bits.push(ev.catName);
  const stg = capFirst(E.stageLabel(m));
  if (stg) bits.push(stg);
  const no = E.matchNo(m);
  if (no && ev.kind === 'ind') bits.push(no);
  return bits.join(' · ');
}

// ---------- dòng trận kiểu "fixture" ----------
// Một trận một dòng: [giờ] [môn] [vòng/bảng] Đội A [ô tỉ số] Đội B [sân].
// Khung chứa hẹp (điện thoại, cột bên) tự chuyển sang 2 dòng nhờ container query.
function fxSide(r, side, cls) {
  if (!r) return `<div class="fx-team ${side}"></div>`;
  if (r.kind === 'team') return `<div class="fx-team ${side} ${cls}"><b>${esc(r.t)}</b>${r.via ? `<small>${esc(r.via)}</small>` : ''}</div>`;
  if (r.kind === 'ath') return `<div class="fx-team ${side} ${cls}"><b>${esc(r.p || r.t)}</b>${r.p ? `<small>${esc(r.t)}${r.via ? ' · ' + esc(r.via) : ''}</small>` : ''}</div>`;
  if (r.kind === 'bye') return `<div class="fx-team ${side} bye"><b>${esc(r.t || '—')}</b><small>không thi đấu</small></div>`;
  return `<div class="fx-team ${side} tbd"><b>${esc(r.label || 'Chưa xác định')}</b></div>`;
}
function fxScore(E, m, st) {
  const w = E.winner(m);
  let box;
  if (isDone(m)) {
    box = `<div class="fx-score done" title="Kết thúc"><b class="${w === 'b' ? 'dim' : ''}">${m.sa}</b><i>–</i><b class="${w === 'a' ? 'dim' : ''}">${m.sb}</b></div>`;
  } else if (st === 'live') {
    box = `<div class="fx-score live" title="Đang thi đấu"><span class="pulse"></span>${Number.isFinite(m.sa) ? `${m.sa}<i>–</i>${m.sb}` : 'Đang đấu'}</div>`;
  } else if (st === 'post') box = `<div class="fx-score post">Hoãn</div>`;
  else if (st === 'cancel') box = `<div class="fx-score cancel">Hủy</div>`;
  else if (st === 'wo') box = `<div class="fx-score wo">Miễn đấu</div>`;
  else box = `<div class="fx-score sched">VS</div>`;
  return `<div class="fx-mid">${box}${m.pen ? `<small class="fx-pen">${esc(m.pen)}</small>` : ''}</div>`;
}
export function matchRow(E, m, opt = {}) {
  const ev = E.events[m.ev] || {};
  const sp = SPORT[ev.sport] || {};
  const [A, B] = E.sidesOf(m);
  const w = E.winner(m);
  const ca = w === 'a' ? 'win' : w === 'b' ? 'lose' : '', cb = w === 'b' ? 'win' : w === 'a' ? 'lose' : '';
  const st = E.status(m);
  const when = opt.when === false ? ''
    : opt.showDate
      ? `<span class="fx-when"><b>${esc(fmtDate(m.date))}</b><small>${esc(m.time || '')}</small></span>`
      : `<span class="fx-when"><b>${esc(m.time || '—')}</b><small>${esc(m.end || '')}</small></span>`;
  const stage = [];
  if (opt.grade !== false) stage.push('Khối ' + ev.grade);
  if (ev.catName) stage.push(ev.catName);
  const stg = capFirst(E.stageLabel(m));
  const no = ev.kind === 'ind' ? E.matchNo(m) : '';
  return `<div class="fx ${m.stage === 'F' ? 'is-final' : ''}" data-match="${esc(m.id)}" tabindex="0" style="${sportVars(ev.sport)}">
    <div class="fx-top">${when}
      ${opt.showSport === false ? '' : `<span class="fx-sport">${SPORT_ICON[ev.sport] || ''}<span>${esc(sp.name || '')}</span></span>`}
      <span class="fx-stage"><b>${esc(stg)}</b>${stage.length || no ? `<small>${esc([...stage, no].filter(Boolean).join(' · '))}</small>` : ''}</span>
    </div>
    ${fxSide(A, 'a', ca)}${fxScore(E, m, st)}${fxSide(B, 'b', cb)}
    <span class="fx-venue ${opt.venue === false ? 'hide-narrow' : ''}" title="${esc(m.venue || '')}">${m.venue ? I.pin + '<span>' + esc(m.venue) + '</span>' : ''}</span>
  </div>`;
}
// Danh sách trận có tiêu đề cột; tuỳ chọn chia nhóm theo khung giờ
export function fixtureList(E, list, opt = {}) {
  const noWhen = !!(opt.bySlot || opt.when === false);
  const head = `<div class="fx-head">${noWhen ? '' : `<span class="h-when">${opt.showDate ? 'Ngày' : 'Giờ'}</span>`}${opt.showSport === false ? '' : '<span class="h-sport">Môn</span>'}<span class="h-stage">Vòng / bảng</span><span class="h-a">Đội / VĐV</span><span class="h-mid">Kết quả</span><span class="h-b">Đội / VĐV</span><span class="h-venue">Sân thi đấu</span></div>`;
  let body = '';
  if (opt.bySlot) {
    const slots = new Map();
    list.forEach((m) => { const k = (m.time || '') + '|' + (m.end || ''); if (!slots.has(k)) slots.set(k, []); slots.get(k).push(m); });
    for (const [k, ms] of [...slots.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const [t0, t1] = k.split('|');
      const tiet = ms.map((m) => m.slot).find((x) => x && /^Tiết/.test(x));
      body += `<div class="slot-h">${I.clock}<b>${esc(t0 || 'Chưa có giờ')}${t1 ? ' – ' + esc(t1) : ''}</b>${tiet ? `<span>${esc(tiet)}</span>` : ''}<span class="n">${ms.length} trận</span></div>`;
      body += ms.map((m) => matchRow(E, m, { ...opt, when: false })).join('');
    }
  } else body = list.map((m) => matchRow(E, m, opt)).join('');
  return `<div class="fxl ${noWhen ? 'no-when' : 'has-when'} ${opt.showSport === false ? 'no-sport' : ''}">${opt.header === false ? '' : head}${body}</div>`;
}

// ---------- bảng xếp hạng ----------
export function qualifyingRanks(E, evId, g) {
  const set = new Set();
  for (const m of E.matchesOf(evId)) for (const k of ['a', 'b']) {
    const r = m[k] && m[k].ref;
    if (r && r.startsWith('G:' + g + ':')) set.add(Number(r.split(':')[2]));
  }
  return set;
}
export function standingsTable(E, evId, g, opt = {}) {
  const ev = E.events[evId];
  const sp = SPORT[ev.sport];
  const st = E.standings(evId, g);
  const q = qualifyingRanks(E, evId, g);
  const foot = ev.sport === 'bongda';
  const rows = st.rows.map((r) => {
    const qc = q.has(r.rank) ? (r.rank >= 3 ? 'q3' : 'q') : '';
    const rkc = ev.format === 'RR' && st.complete ? (r.rank === 1 ? 'g' : r.rank === 2 ? 's' : r.rank <= 2 + (ev.bronze || 1) ? 'b' : '') : '';
    return `<tr class="${qc} ${opt.me === r.t ? 'me' : ''}">
      <td><span class="rk ${rkc}">${r.rank}</span></td>
      <td class="l team"><a href="#/lop/${encodeURIComponent(r.t)}">${esc(r.t)}</a></td>
      <td>${r.p}</td><td>${r.w}</td>${foot ? `<td>${r.d}</td>` : ''}<td>${r.l}</td>
      <td class="hide-sm">${r.f}</td><td class="hide-sm">${r.a}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td>
      <td class="pts">${r.pts}</td>
      ${opt.form ? `<td class="hide-sm"><span class="form">${r.form.slice(-4).map((x) => `<i class="${x}">${x}</i>`).join('')}</span></td>` : ''}
    </tr>`;
  }).join('');
  const P = E.points(ev.sport);
  const title = ev.format === 'RR' ? 'Bảng xếp hạng (vòng tròn 1 lượt)' : `Bảng ${g}`;
  return `<div class="card group-card">
    <div class="card-head"><h3>${esc(title)}</h3><span class="muted xs">${st.played}/${st.total} trận${st.complete ? ' · đã xong' : ''}</span></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>#</th><th class="l">Lớp</th><th title="Số trận">Tr</th><th title="Thắng">T</th>${foot ? '<th title="Hòa">H</th>' : ''}<th title="Thua">B</th>
      <th class="hide-sm" title="${esc(sp.forName)}">${esc(sp.forName === 'Hiệp thắng' ? 'HT' : sp.forName)}</th><th class="hide-sm" title="Bị ghi">${sp.id === 'keoco' ? 'HB' : sp.id === 'bongro' ? 'ĐT' : 'BB'}</th><th title="Hiệu số">HS</th><th title="Điểm">Đ</th>${opt.form ? '<th class="hide-sm">Gần đây</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div class="qnote">${q.size ? `<span><i style="background:var(--green)"></i>Vào vòng trong${[...q].some((x) => x >= 3) ? ' (Nhất, Nhì)' : ''}</span>${[...q].some((x) => x >= 3) ? '<span><i style="background:var(--yellow)"></i>Hạng Ba vào tứ kết</span>' : ''}` : ''}<span>Điểm: Thắng ${P.w}${ev.sport === 'bongda' ? ` · Hòa ${P.d}` : ''} · Thua ${P.l}</span></div>
  </div>`;
}

// ---------- ô trận trong nhánh đấu ----------
export function bracketBox(E, m, opt = {}) {
  const [A, B] = E.sidesOf(m);
  const w = E.winner(m);
  const st = E.status(m);
  const line = (r, side) => {
    const cls = r.kind === 'tbd' ? 't' : r.kind === 'bye' ? 'y' : w === side ? 'w' : w && w !== 'dead' ? 'l' : '';
    const name = r.kind === 'team' ? esc(r.t) : r.kind === 'ath' ? `${esc(r.p || r.t)} ${r.p ? `<small>${esc(r.t)}</small>` : ''}` : r.kind === 'bye' ? `${esc(r.t || '')} (không thi đấu)` : esc(r.label || 'Chưa xác định');
    const sc = isDone(m) ? `<b>${side === 'a' ? m.sa : m.sb}</b>` : '';
    return `<div class="bl ${cls}"><span>${name}</span>${sc}</div>`;
  };
  const cap = opt.cap != null ? opt.cap : `${capFirst(E.stageLabel(m))}${E.matchNo(m) ? ' · ' + E.matchNo(m) : ''}`;
  return `<div class="bm ${m.stage === 'F' ? 'final' : ''} ${st === 'wo' ? 'wo' : ''}" data-match="${esc(m.id)}">
    <div class="cap"><span>${esc(cap)}</span><span>${esc(m.date ? fmtDate(m.date) : '')}${m.time ? ' ' + esc(m.time) : ''}</span></div>
    ${line(A, 'a')}${line(B, 'b')}</div>`;
}
export function teamBracket(E, evId) {
  const ev = E.events[evId];
  const ms = E.matchesOf(evId);
  const pick = (st) => ms.filter((m) => m.stage === st).sort((a, b) => a.id.localeCompare(b.id));
  const cols = [];
  if (ev.format === 'QF') cols.push(['Tứ kết', pick('QF')]);
  cols.push(['Bán kết', pick('SF')], ['Chung kết', pick('F')]);
  if (!cols.some(([, l]) => l.length)) return '';
  return `<div class="bracket">${cols.map(([h, list]) => `<div class="bcol"><h4>${h}</h4><div class="bcol-l">${list.map((m) => bracketBox(E, m)).join('')}</div></div>`).join('')}</div>`;
}
// Nhánh đấu cá nhân: xếp cột theo độ sâu tính từ chung kết
export function indBracket(E, evId) {
  const ev = E.events[evId];
  const F = E.finalMatch(ev);
  if (!F) return '';
  const depth = {};
  const walk = (m, d) => {
    if (!m || depth[m.id] != null) return;
    depth[m.id] = d;
    for (const k of ['a', 'b']) {
      const r = m[k] && m[k].ref;
      if (!r) continue;
      const ids = r[0] === 'T' ? r.slice(2).split(',') : r[0] === 'W' || r[0] === 'L' ? [r.slice(2)] : [];
      ids.forEach((id) => walk(E.matches[id], d + 1));
    }
  };
  walk(F, 0);
  const max = Math.max(0, ...Object.values(depth));
  const cols = [];
  for (let d = max; d >= 0; d--) {
    const list = E.matchesOf(evId).filter((m) => depth[m.id] === d && !(E.status(m) === 'wo' && d >= 2 && E.winner(m) === 'dead'));
    if (!list.length) continue;
    list.sort((a, b) => (a.branch || '').localeCompare(b.branch || '') || (a.n || 0) - (b.n || 0));
    const name = d === 0 ? 'Chung kết' : d === 1 ? 'Bán kết' : d === 2 ? 'Tứ kết' : `Vòng ${max - d + 1}`;
    cols.push(`<div class="bcol"><h4>${name}</h4><div class="bcol-l">${list.map((m) => bracketBox(E, m)).join('')}</div></div>`);
  }
  return `<div class="bracket">${cols.join('')}</div>`;
}

// ---------- bục huy chương ----------
export function podiumHtml(E, evId, opt = {}) {
  const p = E.podium(evId);
  const ev = E.events[evId];
  const slot = (rank, i) => {
    const x = p.filter((q) => q.rank === rank)[i];
    const cls = rank === 1 ? 'g' : rank === 2 ? 's' : 'b';
    const medal = rank === 1 ? 'Huy chương Vàng · Nhất' : rank === 2 ? 'Huy chương Bạc · Nhì' : 'Huy chương Đồng · Ba';
    if (!x) return `<div class="pod ${cls} empty"><span class="medal">${medal}</span><b class="muted">—</b><span class="muted xs">Chưa xác định</span></div>`;
    const s = x.side;
    const main = s.kind === 'ath' ? (s.p || s.t) : s.t;
    const sub = s.kind === 'ath' ? `Lớp ${s.t}` : levelName(ev.level) + ' · Khối ' + ev.grade;
    return `<div class="pod ${cls}"><span class="medal">${medal}</span><b>${esc(main)}</b><span class="muted xs">${esc(sub)}${x.manual ? ' · BTC xác nhận' : ''}</span></div>`;
  };
  const bronze = ev.format === 'RR' && (ev.bronze || 1) === 1 ? [slot(3, 0)] : [slot(3, 0), slot(3, 1)];
  if (opt.compactEmpty && !p.length) return '';
  return `<div class="podium">${slot(1, 0)}${slot(2, 0)}${bronze.join('')}</div>`;
}

// ---------- hộp thoại ----------
export function openModal(html, opt = {}) {
  closeModal();
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-bg" data-close-bg><div class="modal ${opt.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const bg = root.firstElementChild;
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', escClose);
  document.body.style.overflow = 'hidden';
  const f = bg.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 30);
  return bg.firstElementChild;
}
function escClose(e) { if (e.key === 'Escape') closeModal(); }
export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  document.removeEventListener('keydown', escClose);
  document.body.style.overflow = '';
}
export function toast(msg, type = '') {
  let box = document.querySelector('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), type === 'err' ? 5000 : 2600);
}

// ---------- chi tiết trận ----------
export function matchDetail(E, id, opt = {}) {
  const m = E.matches[id];
  if (!m) return;
  const ev = E.events[m.ev] || {};
  const [A, B] = E.sidesOf(m);
  const w = E.winner(m);
  const nm = (r, side) => {
    const dim = w && w !== 'dead' && w !== side ? 'style="color:#9aa5b8"' : '';
    if (r.kind === 'team') return `<div class="nm" ${dim}>${esc(r.t)}${r.via ? `<small>${esc(r.via)}</small>` : ''}</div>`;
    if (r.kind === 'ath') return `<div class="nm" ${dim}>${esc(r.p || r.t)}<small>Lớp ${esc(r.t)}${r.via ? ' · ' + esc(r.via) : ''}</small></div>`;
    if (r.kind === 'bye') return `<div class="nm muted">${esc(r.t || '')}<small>Không thi đấu</small></div>`;
    return `<div class="nm muted" style="font-style:italic;font-size:16px">${esc(r.label)}</div>`;
  };
  const sc = isDone(m) || Number.isFinite(m.sa) ? `<div class="sc">${m.sa ?? '–'} : ${m.sb ?? '–'}</div>` : `<div class="sc muted" style="font-size:20px">VS</div>`;
  const unit = SPORT[ev.sport] ? SPORT[ev.sport].unit : '';
  const cards = ev.sport === 'bongda' && (m.ya || m.yb || m.ra || m.rb) ? `<dt>Thẻ phạt</dt><dd>${esc(A.t || '')}: ${m.ya || 0} vàng, ${m.ra || 0} đỏ · ${esc(B.t || '')}: ${m.yb || 0} vàng, ${m.rb || 0} đỏ</dd>` : '';
  const html = `<div class="modal-h"><h3>${sportTag(ev.sport)} <span style="margin-left:6px">${esc(ev.name || '')}</span></h3><button class="btn ghost sm" data-close aria-label="Đóng">${I.x}</button></div>
  <div class="modal-b mdetail">
    <div style="text-align:center">${statusPill(E, m)} <span class="muted small">${esc(capFirst(E.stageLabel(m)))}${E.matchNo(m) ? ' · ' + esc(E.matchNo(m)) : ''}</span></div>
    <div class="big">${nm(A, 'a')}${sc}${nm(B, 'b')}</div>
    ${m.pen ? `<p style="text-align:center;margin:-8px 0 12px" class="muted">${esc(m.pen)}</p>` : ''}
    <dl class="kv">
      <dt>Thời gian</dt><dd>${esc(fmtFull(m.date))}${m.time ? ' · ' + esc(timeRange(m)) : ''}${m.slot ? ' · ' + esc(m.slot) : ''}</dd>
      ${m.venue ? `<dt>Địa điểm</dt><dd>${esc(m.venue)}</dd>` : ''}
      ${isDone(m) ? `<dt>Kết quả</dt><dd>${m.sa} – ${m.sb} ${esc(unit)}${w === 'a' || w === 'b' ? ' · Thắng: <b>' + esc(E.sideName(w === 'a' ? A : B)) + '</b>' : ''}</dd>` : ''}
      ${cards}
      ${m.note ? `<dt>Ghi chú</dt><dd>${esc(m.note)}</dd>` : ''}
      ${m.upd ? `<dt>Cập nhật</dt><dd class="muted">${esc(relTime(m.upd))}</dd>` : ''}
    </dl>
  </div>
  <div class="modal-f">
    <a class="btn" href="#/ket-qua/${esc(ev.sport)}/${ev.grade}${ev.cat ? '/' + esc(ev.cat) : ''}" data-close>${I.trophy} Xem BXH & nhánh đấu</a>
    ${opt.canEdit ? `<button class="btn primary" data-edit-match="${esc(m.id)}">${I.edit} Cập nhật kết quả</button>` : ''}
  </div>`;
  openModal(html);
}
