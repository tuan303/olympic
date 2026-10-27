// ============================================================
//  KHO DỮ LIỆU
//  Lịch gốc (js/seed-data.js, chuyển từ Excel) + các thay đổi của Ban tổ chức.
//  - Có Firebase: thay đổi lưu trên Firestore, mọi người thấy ngay (thời gian thực).
//  - ?demo=1 hoặc chưa cấu hình Firebase: thay đổi chỉ lưu trên trình duyệt này.
// ============================================================
import { FIREBASE_CONFIG as FB_CFG, SUPER_ADMINS, AUTH_TENANT, ASSET_VER, SCHOOL_DOMAIN, VENUE_RENAME } from './config.js';
import { ls, clone } from './util.js';
import { createEngine, SPORT, STATUS } from './engine.js';

// ?demo=1 → chế độ tập dượt: dùng dữ liệu gốc, mọi thay đổi chỉ lưu trên trình duyệt này
export const DEMO = (() => { try { return new URLSearchParams(location.search).has('demo'); } catch (e) { return false; } })();
const FIREBASE_CONFIG = DEMO ? null : FB_CFG;

const SPORT_IDS = ['bongda', 'bongro', 'keoco', 'caulong', 'karate'];
const LEVEL_IDS = ['TH', 'THCS', 'THPT'];
const OVERRIDE_DOCS = SPORT_IDS.flatMap((s) => LEVEL_IDS.map((l) => `r_${s}_${l}`));
const CACHE_KEY = 'olympic2627-ovr-cache-v2';
const LOCAL_KEY = 'olympic2627-local-v2';
const DEMO_USER_KEY = 'olympic2627-demo-admin';

let state = { ready: false, mode: 'loading', db: null, engine: null, user: null, role: null, error: '', lastSync: 0, authReady: false };
const subs = new Set();
export const getState = () => state;
export function onChange(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() { subs.forEach((f) => { try { f(state); } catch (e) { console.error(e); } }); }
function set(p) {
  if (p.db) p.engine = createEngine(p.db);
  state = { ...state, ...p };
  emit();
}

let fb = null;
let seed = null;
let seedRosters = {};
export async function loadSeed() {
  if (!seed) {
    const [s, r] = await Promise.all([
      import('./seed-data.js?v=' + ASSET_VER),
      import('./roster-data.js?v=' + ASSET_VER).catch(() => ({ ROSTERS: {} })), // danh sách đăng ký từ Excel
    ]);
    seed = s.SEED; seedRosters = r.ROSTERS || {};
  }
  return seed;
}
// Lịch gốc + các phần ghi đè → dữ liệu hiển thị
function compose(parts) {
  const s = seed;
  const cfg = parts.config || {};
  const db = {
    meta: { ...s.meta, ...(cfg.meta || {}) }, settings: cfg.settings || {}, news: cfg.news || [],
    rules: { ...s.rules }, general: { ...s.general }, sourceNotes: s.sourceNotes || [],
    ruleEdits: cfg.rules || {}, generalEdits: cfg.general || {},
    events: { ...s.events }, matches: { ...s.matches }, rosters: { ...seedRosters },
  };
  const removed = new Set(s.removed || []);
  for (const [k, r] of Object.entries(cfg.rules || {})) if (r) db.rules[k] = { ...(s.rules[k] || {}), ...withNewBongroPoints(k, r, s.rules[k]) };
  for (const [k, g] of Object.entries(cfg.general || {})) if (g) db.general[k] = { ...(s.general[k] || {}), ...g };
  for (const id of OVERRIDE_DOCS) {
    const d = parts[id];
    if (!d) continue;
    for (const [k, e] of Object.entries(d.e || {})) if (e) db.events[k] = e;
    for (const [k, r] of Object.entries(d.r || {})) { if (r && r.list && r.list.length) db.rosters[k] = r; else delete db.rosters[k]; }
    for (const [k, m0] of Object.entries(d.m || {})) {
      if (removed.has(k)) continue; // trận BTC đã bỏ khỏi sơ đồ (vd nhánh thừa) — bỏ qua bản lưu cũ
      const base = s.matches[k];
      // Trận có "fix" = BTC cấp lại sơ đồ sau khi đã sửa trên máy chủ → cặp đấu theo lịch gốc, giữ tỉ số đã nhập
      if (base && base.fix && (!m0 || !m0.upd || m0.upd < base.fix)) { if (m0) db.matches[k] = { ...m0, ...pick(base, FIX_FIELDS) }; continue; }
      if (m0 === null) { delete db.matches[k]; continue; }
      db.matches[k] = VENUE_RENAME[m0.venue] ? { ...m0, venue: VENUE_RENAME[m0.venue] } : m0;
    }
  }
  return db;
}
const docOf = (ev) => `r_${ev.sport}_${ev.level}`;
// Điều lệ Bóng rổ BTC sửa TRƯỚC 08/10 (khi đổi cách tính điểm): giữ phần sửa, thay mục "3. Cách tính điểm" bằng bản mới
const BONGRO_POINTS_AT = Date.parse('2026-10-08T00:00:00+07:00');
const sec3 = (t) => { const L = String(t || '').split('\n'); const i = L.findIndex((l) => /^\s*3\.\s*Cách tính điểm/i.test(l)); const j = L.findIndex((l, n) => n > i && /^\s*4\.\s*/.test(l)); return { L, i, j }; };
function withNewBongroPoints(k, r, base) {
  if (!k.startsWith('bongro-') || !base || !r.body || (r.upd || 0) >= BONGRO_POINTS_AT) return r;
  const o = sec3(r.body), b = sec3(base.body);
  if (o.i < 0 || o.j < 0 || b.i < 0 || b.j < 0) return r;
  o.L.splice(o.i, o.j - o.i, ...b.L.slice(b.i, b.j));
  return { ...r, body: o.L.join('\n') };
}
const FIX_FIELDS = ['a', 'b', 'stage', 'label', 'n', 'branch', 'fix'];
const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

// ============================================================
export async function init() {
  await loadSeed();
  if (!FIREBASE_CONFIG) {
    const local = ls.get(LOCAL_KEY, {});
    const demo = ls.get(DEMO_USER_KEY);
    set({ db: compose(local), mode: 'local', ready: true, authReady: true, user: demo || null, role: demo ? { all: true, super: true } : null });
    return;
  }
  // hiện ngay: lịch gốc + thay đổi đã lưu tạm lần trước
  const cached = ls.get(CACHE_KEY, null);
  const parts = (cached && cached.parts) || {};
  set({ db: compose(parts), mode: 'cache', ready: true, lastSync: (cached && cached.at) || 0 });
  try {
    const mod = await import('./firebase.js?v=' + ASSET_VER);
    fb = await mod.connect(FIREBASE_CONFIG);
  } catch (e) {
    console.warn('[store] Không kết nối được Firebase:', e.message);
    set({ error: 'Không kết nối được máy chủ — đang hiển thị lịch gốc và kết quả đã lưu gần nhất.' });
    return;
  }
  const names = ['config', ...OVERRIDE_DOCS];
  const seen = new Set();
  const firstTimer = setTimeout(() => { if (state.mode !== 'live') set({ error: 'Máy chủ phản hồi chậm — đang hiển thị dữ liệu gần nhất.' }); }, 10000);
  let saveTimer = null;
  fb.watchAll(names, (name, data) => {
    seen.add(name);
    if (data) parts[name] = data; else delete parts[name];
    if (seen.size < names.length) return;
    clearTimeout(firstTimer);
    set({ db: compose(parts), mode: 'live', error: '', lastSync: Date.now() });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => ls.set(CACHE_KEY, { parts, at: Date.now() }), 800);
  }, (e, n) => {
    console.warn('[store] Firestore lỗi', n, e.code || e.message);
    if (state.mode !== 'live') set({ error: 'Chưa đọc được dữ liệu từ máy chủ (' + (e.code || e.message) + ') — đang hiển thị lịch gốc.' });
  });
  fb.watchAuth(async (u) => {
    if (!u) { set({ user: null, role: null, authReady: true }); return; }
    const role = await roleOf(u.email);
    // Chỉ email có trong danh sách quản trị mới được giữ phiên đăng nhập
    if (!role) { try { await fb.signOut(); } catch (e) { /* bỏ qua */ } set({ user: null, role: null, authReady: true, denied: u.email }); return; }
    set({ user: u, role, authReady: true, denied: '' });
  });
}
async function roleOf(email) {
  if (!email) return null;
  if (SUPER_ADMINS.includes(email)) return { all: true, super: true };
  if (!email.endsWith('@' + SCHOOL_DOMAIN)) return null;
  const a = fb ? await fb.getAdmin(email) : null;
  return a ? { all: !!a.all, sports: a.sports || {}, name: a.name || '' } : null;
}
export function canEdit(sport) {
  const r = state.role;
  if (!r) return false;
  if (r.all || r.super) return true;
  return !!(sport && r.sports && r.sports[sport]);
}
export const isSuper = () => !!(state.role && state.role.super);
export const isLive = () => state.mode === 'live';
export const hasFirebase = () => !!FIREBASE_CONFIG;

// ---------- đăng nhập ----------
export async function signIn() {
  if (!FIREBASE_CONFIG) {
    const u = { email: 'xem-thu@local', name: 'Quản trị (tập dượt)' };
    ls.set(DEMO_USER_KEY, u);
    set({ user: u, role: { all: true, super: true } });
    return u;
  }
  return fb.signIn(AUTH_TENANT);
}
export async function signOut() {
  if (!FIREBASE_CONFIG) { ls.del(DEMO_USER_KEY); set({ user: null, role: null }); return; }
  await fb.signOut();
}

// ---------- ghi dữ liệu ----------
function who() { return state.user ? state.user.email : 'không rõ'; }

// ---------- nhật ký thao tác ----------
// Mỗi bản ghi: ai (by, name, role), lúc nào (at; ts = giờ máy chủ), loại (type/types), đối tượng (label, sport, grade, ev, mid),
// thay đổi [{ f: tên trường, from, to }] và ảnh chụp trước/sau của trận.
const LOG_KEY = 'olympic2627-local-logs';
export const LOG_TYPES = {
  result: 'Nhập / sửa kết quả', schedule: 'Lịch thi đấu', add: 'Thêm trận', delete: 'Xóa trận', event: 'Bảng đấu & xếp hạng',
  roster: 'Danh sách VĐV', news: 'Thông báo', rules: 'Điều lệ', config: 'Cài đặt', admin: 'Quản trị viên', data: 'Dữ liệu',
};
const roleTxt = () => { const r = state.role || {}; return r.super ? 'Quản trị cao nhất' : r.all ? 'Toàn giải' : 'Phụ trách: ' + Object.keys(r.sports || {}).filter((k) => r.sports[k]).join(', '); };
async function writeLog(entry) {
  const e = { by: who(), name: (state.user && state.user.name) || '', role: roleTxt(), ...entry, at: Date.now() };
  if (state.mode === 'local') { const L = ls.get(LOG_KEY, []); L.unshift(JSON.parse(JSON.stringify(e))); ls.set(LOG_KEY, L.slice(0, 1000)); return true; }
  return fb ? fb.addLog(e) : false;
}
const scoreTxt = (m) => (m && Number.isFinite(m.sa) && Number.isFinite(m.sb) ? `${m.sa}–${m.sb}` : '—');
const sideRaw = (x) => (!x ? '' : x.ref ? x.ref : [x.p, x.t].filter(Boolean).join(' · ') + (x.bye ? ' (không thi đấu)' : ''));
function sideTxt(m, k) {
  const x = m && m[k];
  if (!x) return '—';
  if (x.ref && state.engine) { const r = state.engine.resolveSide(m, k); return r.kind === 'tbd' ? r.label : state.engine.sideName(r) + (r.via ? ` (${r.via})` : ''); }
  return sideRaw(x) || '—';
}
function matchLabel(m) {
  const E = state.engine, ev = (E && E.events[m.ev]) || {};
  const stg = E ? E.stageLabel(m) : (m.stage || '');
  const no = E && ev.kind === 'ind' ? E.matchNo(m) : '';
  return `${(SPORT[ev.sport] || {}).name || ev.sport || ''} khối ${ev.grade || '?'}${ev.catName ? ' · ' + ev.catName : ''} · ${stg}${no ? ' · ' + no : ''} · ${sideTxt(m, 'a')} – ${sideTxt(m, 'b')}`;
}
const stName = (s) => (STATUS[s || 'sched'] || {}).name || s || '';
// So sánh 2 phiên bản trận → danh sách thay đổi + loại (kết quả / lịch)
function diffMatch(b, a) {
  const ch = [], types = new Set();
  const add = (type, f, from, to) => { if (String(from ?? '') !== String(to ?? '')) { ch.push({ f, from: from || '—', to: to || '—' }); types.add(type); } };
  add('result', 'Tỉ số', scoreTxt(b), scoreTxt(a));
  add('result', 'Trạng thái', b ? stName(b.st) : '', stName(a.st));
  add('result', 'Người thắng (hòa/xử)', b && b.w ? 'Bên ' + b.w.toUpperCase() : '', a.w ? 'Bên ' + a.w.toUpperCase() : '');
  add('result', 'Ghi chú kết quả', b && b.pen, a.pen);
  add('result', 'Xử thua', b && b.ff ? 'Bên ' + b.ff.toUpperCase() : '', a.ff ? 'Bên ' + a.ff.toUpperCase() : '');
  const cards = (m) => (m && (m.ya || m.ra || m.yb || m.rb) ? `A: ${m.ya || 0}V ${m.ra || 0}Đ · B: ${m.yb || 0}V ${m.rb || 0}Đ` : '');
  add('result', 'Thẻ phạt', cards(b), cards(a));
  add('schedule', 'Ngày', b && b.date, a.date);
  add('schedule', 'Giờ', b ? [b.time, b.end].filter(Boolean).join('–') : '', [a.time, a.end].filter(Boolean).join('–'));
  add('schedule', 'Sân', b && b.venue, a.venue);
  add('schedule', 'Bên A', b && sideRaw(b.a), sideRaw(a.a));
  add('schedule', 'Bên B', b && sideRaw(b.b), sideRaw(a.b));
  add('schedule', 'Ghi chú công khai', b && b.note, a.note);
  return { changes: ch, types: [...types] };
}
const evInfo = (ev) => (ev ? { sport: ev.sport, level: ev.level, grade: ev.grade, ev: ev.id } : {});
function localWrite(fn) {
  const o = ls.get(LOCAL_KEY, {});
  fn(o);
  ls.set(LOCAL_KEY, o);
  set({ db: compose(o) });
}
function requireFb() { if (!fb) throw new Error('Chưa kết nối được máy chủ — thử tải lại trang.'); }
function strip(m) { const c = { ...m }; delete c.src; return c; }

export async function saveMatch(match, action = 'Sửa trận') {
  const ev = state.db.events[match.ev];
  if (!ev) throw new Error('Không thấy nội dung của trận.');
  if (!canEdit(ev.sport)) throw new Error('Bạn không có quyền sửa môn này.');
  const before = state.db.matches[match.id] || null;
  const m = strip({ ...match, upd: Date.now(), by: who() });
  const d = docOf(ev);
  if (state.mode === 'local') { localWrite((o) => { ((o[d] ||= {}).m ||= {})[m.id] = m; }); await logMatch(before, m, action, ev); return m; }
  requireFb();
  await fb.setOverride(d, 'm', m.id, m);
  await logMatch(before, m, action, ev);
  return m;
}
async function logMatch(before, m, action, ev) {
  const { changes, types } = diffMatch(before, m);
  const type = !before ? 'add' : types.includes('result') ? 'result' : types.includes('schedule') ? 'schedule' : 'result';
  return writeLog({ type, types: !before ? ['add'] : types, action: changes.length || !before ? action : action + ' (lưu lại, không đổi)', ...evInfo(ev), mid: m.id, label: matchLabel(m), changes, before: brief(before), after: brief(m) });
}
export async function deleteMatch(id) {
  const m = state.db.matches[id];
  if (!m) return;
  const ev = state.db.events[m.ev];
  if (!canEdit(ev.sport)) throw new Error('Bạn không có quyền sửa môn này.');
  const d = docOf(ev);
  const entry = { type: 'delete', types: ['delete'], action: 'Xóa trận', ...evInfo(ev), mid: id, label: matchLabel(m), changes: [{ f: 'Trận', from: `${scoreTxt(m)} · ${m.date || ''} ${m.time || ''} · ${m.venue || ''}`, to: 'đã xóa' }], before: brief(m) };
  if (state.mode === 'local') { localWrite((o) => { ((o[d] ||= {}).m ||= {})[id] = null; }); await writeLog(entry); return; }
  requireFb();
  await fb.setOverride(d, 'm', id, null);
  await writeLog(entry);
}
export async function saveEvent(ev, action = 'Sửa bảng đấu / thứ hạng') {
  if (!canEdit(ev.sport)) throw new Error('Bạn không có quyền sửa môn này.');
  const old = state.db.events[ev.id] || {};
  const changes = [];
  const grp = (e) => Object.entries(e.groups || {}).map(([g, l]) => `${g}: ${l.join(', ')}`).join(' | ');
  const ord = (e) => Object.entries(e.manualOrder || {}).map(([g, l]) => `${g}: ${l.join(' › ')}`).join(' | ');
  const pod = (e) => (e.podium || []).map((p) => `${p.rank === 1 ? 'Nhất' : p.rank === 2 ? 'Nhì' : 'Ba'}: ${[p.p, p.t].filter(Boolean).join(' ')}`).join(' · ');
  for (const [f, fn] of [['Thành phần bảng', grp], ['Thứ tự bốc thăm', ord], ['Thứ hạng xác nhận tay', pod], ['Ghi chú nội dung', (e) => e.note || '']]) { const a = fn(old), b = fn(ev); if (a !== b) changes.push({ f, from: a || '—', to: b || '—' }); }
  const entry = { type: 'event', types: ['event'], action, ...evInfo(ev), label: ev.name, changes };
  const d = docOf(ev);
  if (state.mode === 'local') { localWrite((o) => { ((o[d] ||= {}).e ||= {})[ev.id] = ev; }); await writeLog(entry); return; }
  requireFb();
  await fb.setOverride(d, 'e', ev.id, ev);
  await writeLog(entry);
}
// Danh sách VĐV của một lớp trong một nội dung đồng đội; list rỗng = xóa
export async function saveRoster(evId, cls, list) {
  const ev = state.engine.rosterEvent(evId);
  if (!ev) throw new Error('Không thấy nội dung.');
  if (!canEdit(ev.sport)) throw new Error('Bạn không có quyền sửa môn này.');
  const key = evId + '|' + cls;
  const clean = (list || []).map((x) => { const o = { n: String(x.n || '').trim() }; for (const f of ['no', 'g', 'note']) if (x[f]) o[f] = String(x[f]).trim(); return o; }).filter((x) => x.n);
  const val = clean.length ? { list: clean, upd: Date.now(), by: who() } : null;
  const oldNames = state.engine.rosterOf(evId, cls).map((x) => x.n), newNames = clean.map((x) => x.n);
  const plus = newNames.filter((x) => !oldNames.includes(x)), minus = oldNames.filter((x) => !newNames.includes(x));
  const changes = [{ f: 'Số VĐV', from: String(oldNames.length), to: String(newNames.length) }];
  if (plus.length) changes.push({ f: 'Thêm', from: '', to: plus.slice(0, 15).join(', ') + (plus.length > 15 ? ` … (+${plus.length - 15})` : '') });
  if (minus.length) changes.push({ f: 'Bỏ', from: minus.slice(0, 15).join(', ') + (minus.length > 15 ? ` … (+${minus.length - 15})` : ''), to: '' });
  const entry = { type: 'roster', types: ['roster'], action: val ? 'Sửa danh sách VĐV' : 'Xóa danh sách VĐV', ...evInfo(ev), label: `${ev.name} · Lớp ${cls}`, changes };
  const d = docOf(ev);
  if (state.mode === 'local') { localWrite((o) => { ((o[d] ||= {}).r ||= {})[key] = val; }); await writeLog(entry); return; }
  requireFb();
  await fb.setOverride(d, 'r', key, val);
  await writeLog(entry);
}
// Sửa điều lệ một môn/cấp ('bongda-THCS') hoặc quy định chung ('general:THCS'); value null = khôi phục bản gốc
export async function saveRule(key, value) {
  if (!(state.role && (state.role.all || state.role.super))) throw new Error('Cần quyền quản trị toàn giải.');
  const gen = key.startsWith('general:');
  const field = gen ? 'general' : 'rules', k = gen ? key.slice(8) : key;
  const cur = { ...((gen ? state.db.generalEdits : state.db.ruleEdits) || {}) };
  cur[k] = value ? { ...value, upd: Date.now(), by: who() } : null;
  // thay đổi theo dòng (để nhật ký cho biết sửa chỗ nào)
  const oldDoc = gen ? (state.db.general[k] || {}) : (state.db.rules[k] || {});
  const newDoc = value || (gen ? (seed.general || {})[k] : (seed.rules || {})[k]) || {};
  const txt = (d) => (gen ? [d.register, d.important, d.extra] : [d.title, d.body, d.dated, d.author]).filter(Boolean).join('\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const A = txt(oldDoc), B = txt(newDoc), setA = new Set(A), setB = new Set(B);
  const added = B.filter((l) => !setA.has(l)), removed = A.filter((l) => !setB.has(l));
  const short = (l) => (l.length > 140 ? l.slice(0, 140) + '…' : l);
  const changes = [...removed.slice(0, 5).map((l) => ({ f: 'Bỏ dòng', from: short(l), to: '' })), ...added.slice(0, 5).map((l) => ({ f: 'Thêm dòng', from: '', to: short(l) }))];
  if (removed.length > 5 || added.length > 5) changes.push({ f: 'Tổng', from: '', to: `bỏ ${removed.length} dòng, thêm ${added.length} dòng` });
  return saveConfig({ [field]: cur }, `${value ? 'Sửa' : 'Khôi phục bản gốc'} điều lệ`, { type: 'rules', changes, label: (() => { const LV = { TH: 'Tiểu học', THCS: 'THCS', THPT: 'THPT' }; if (gen) return 'Quy định chung · ' + (LV[k] || k); const [sp, lv] = k.split('-'); return `${(SPORT[sp] || {}).name || sp} · ${LV[lv] || lv}`; })() });
}
export async function saveConfig(patch, action = 'Sửa cấu hình', meta = {}) {
  if (!(state.role && (state.role.all || state.role.super))) throw new Error('Cần quyền quản trị toàn giải.');
  const changes = [];
  let type = meta.type || 'config', label = meta.label || '';
  if (patch.news) {
    type = 'news';
    const was = state.db.news || [], now = patch.news;
    const ids = new Set(was.map((n) => n.id)), ids2 = new Set(now.map((n) => n.id));
    now.filter((n) => !ids.has(n.id)).forEach((n) => changes.push({ f: 'Đăng', from: '', to: n.title }));
    was.filter((n) => !ids2.has(n.id)).forEach((n) => changes.push({ f: 'Xóa', from: n.title, to: '' }));
    now.forEach((n) => { const o = was.find((x) => x.id === n.id); if (o && !!o.pinned !== !!n.pinned) changes.push({ f: n.pinned ? 'Ghim' : 'Bỏ ghim', from: '', to: n.title }); });
  }
  if (patch.settings && patch.settings.points) {
    const P = (pts, sp) => { const p = (pts || {})[sp] || {}; return Object.entries(p).map(([k, v]) => `${{ w: 'Thắng', d: 'Hòa', l: 'Thua', ff: 'Bỏ cuộc' }[k] || k} ${v}`).join(', '); };
    for (const sp of Object.keys(patch.settings.points)) { const a = P((state.db.settings || {}).points, sp), b = P(patch.settings.points, sp); if (a !== b) changes.push({ f: 'Điểm ' + ((SPORT[sp] || {}).name || sp), from: a || 'mặc định', to: b }); }
  }
  if (patch.meta) for (const [k, f] of [['start', 'Ngày khai mạc'], ['end', 'Ngày kết thúc'], ['slogan', 'Khẩu hiệu']]) { const a = (state.db.meta || {})[k] || '', b = patch.meta[k] || ''; if (a !== b) changes.push({ f, from: a || '—', to: b || '—' }); }
  if (meta.changes) changes.push(...meta.changes);
  const entry = { type, types: [type], action, label, changes };
  if (state.mode === 'local') { localWrite((o) => { o.config = { ...(o.config || {}), ...patch }; }); await writeLog(entry); return; }
  requireFb();
  await fb.setConfig(patch);
  await writeLog(entry);
}
function brief(m) {
  if (!m) return null;
  const s = (x) => (x ? x.ref || [x.p, x.t].filter(Boolean).join(' ') : '');
  return { a: s(m.a), b: s(m.b), sa: m.sa ?? null, sb: m.sb ?? null, st: m.st || 'sched', date: m.date || '', time: m.time || '', end: m.end || '', venue: m.venue || '', w: m.w || '', pen: m.pen || '', ff: m.ff || '', note: m.note || '' };
}

// ---------- sao lưu / khôi phục ----------
// Tách dữ liệu đầy đủ (file sao lưu) thành phần khác với lịch gốc
function diffFromSeed(data) {
  const parts = {};
  const put = (ev, kind, id, v) => { const d = docOf(ev); ((parts[d] ||= {})[kind] ||= {})[id] = v; };
  for (const [id, e] of Object.entries(data.events || {})) { if (JSON.stringify(e) !== JSON.stringify(seed.events[id])) put(e, 'e', id, e); }
  const evOf = (m) => (data.events || {})[m.ev] || seed.events[m.ev];
  for (const [id, m] of Object.entries(data.matches || {})) {
    const base = seed.matches[id];
    if (base && JSON.stringify(strip(base)) === JSON.stringify(strip(m))) continue;
    const ev = evOf(m); if (ev) put(ev, 'm', id, strip(m));
  }
  for (const id of Object.keys(seed.matches)) if (!(data.matches || {})[id]) { const ev = seed.events[seed.matches[id].ev]; if (ev) put(ev, 'm', id, null); }
  const regEv = (id) => (data.events || {})[id] || seed.events[id] || (state.engine && state.engine.rosterEvent(id));
  for (const [k, r] of Object.entries(data.rosters || {})) { if (JSON.stringify(r) === JSON.stringify(seedRosters[k])) continue; const ev = regEv(k.split('|')[0]); if (ev && r) put(ev, 'r', k, r); }
  if (data.rosters) for (const k of Object.keys(seedRosters)) if (!data.rosters[k]) { const ev = regEv(k.split('|')[0]); if (ev) put(ev, 'r', k, null); }
  return parts;
}
export async function importBackup(json) {
  if (!isSuper()) throw new Error('Chỉ quản trị cao nhất được khôi phục.');
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data.events || !data.matches) throw new Error('File sao lưu không đúng định dạng.');
  await loadSeed();
  const parts = diffFromSeed(data);
  // sao lưu cũ (trước khi đổi điểm Bóng rổ) không có pointsVer → ghi 1 để cài đặt điểm cũ trong file bị bỏ qua
  const config = { meta: data.meta || {}, settings: { pointsVer: 1, ...(data.settings || {}) }, news: data.news || [] };
  if (state.mode === 'local') { ls.set(LOCAL_KEY, { ...parts, config }); set({ db: compose({ ...parts, config }) }); return; }
  requireFb();
  await fb.replaceOverrides(parts);
  await fb.setConfig(config);
  await writeLog({ type: 'data', types: ['data'], action: 'Khôi phục từ file sao lưu', changes: [] });
}
// Về lịch gốc: xóa kết quả/đổi lịch nhưng GIỮ danh sách VĐV đã nhập
function rosterParts() {
  const parts = {};
  for (const [k, r] of Object.entries(state.db.rosters || {})) { if (seedRosters[k] === r) continue; const ev = state.engine.rosterEvent(k.split('|')[0]); if (ev) ((parts[docOf(ev)] ||= {}).r ||= {})[k] = r; }
  for (const k of Object.keys(seedRosters)) if (!state.db.rosters[k]) { const ev = state.engine.rosterEvent(k.split('|')[0]); if (ev) ((parts[docOf(ev)] ||= {}).r ||= {})[k] = null; }
  return parts;
}
export async function resetAll() {
  if (!isSuper()) throw new Error('Chỉ quản trị cao nhất.');
  if (state.mode === 'local') { const keep = rosterParts(); ls.set(LOCAL_KEY, keep); set({ db: compose(keep) }); return; }
  requireFb();
  await fb.replaceOverrides(rosterParts());
  await writeLog({ type: 'data', types: ['data'], action: 'Xóa mọi thay đổi, về lịch gốc', changes: [] });
}
export const resetLocal = resetAll;
export function listLogs(n = 300, before = 0) {
  if (!isSuper()) return Promise.reject(new Error('Chỉ quản trị cao nhất được xem nhật ký.'));
  if (state.mode === 'local') return Promise.resolve(ls.get(LOG_KEY, []).filter((l) => !before || l.at < before).slice(0, n));
  return fb ? fb.listLogs(n, before) : Promise.resolve([]);
}
export const listAdmins = () => (fb ? fb.listAdmins() : Promise.resolve([]));
const scopeTxt = (a) => (a.all ? 'Toàn giải' : Object.keys(a.sports || {}).filter((k) => a.sports[k]).map((k) => (SPORT[k] || {}).name || k).join(', '));
export const setAdmin = (email, data) => { if (!isSuper()) throw new Error('Chỉ quản trị cao nhất.'); return fb.setAdmin(email, data).then(() => writeLog({ type: 'admin', types: ['admin'], action: 'Cấp quyền', label: email, changes: [{ f: 'Phạm vi', from: '', to: scopeTxt(data) }] })); };
export const removeAdmin = (email) => { if (!isSuper()) throw new Error('Chỉ quản trị cao nhất.'); return fb.removeAdmin(email).then(() => writeLog({ type: 'admin', types: ['admin'], action: 'Thu hồi quyền', label: email, changes: [] })); };
