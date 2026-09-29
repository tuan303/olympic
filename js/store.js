// ============================================================
//  KHO DỮ LIỆU
//  Lịch gốc (js/seed-data.js, chuyển từ Excel) + các thay đổi của Ban tổ chức.
//  - Có Firebase: thay đổi lưu trên Firestore, mọi người thấy ngay (thời gian thực).
//  - ?demo=1 hoặc chưa cấu hình Firebase: thay đổi chỉ lưu trên trình duyệt này.
// ============================================================
import { FIREBASE_CONFIG as FB_CFG, SUPER_ADMINS, AUTH_TENANT, ASSET_VER, SCHOOL_DOMAIN, VENUE_RENAME } from './config.js';
import { ls, clone } from './util.js';
import { createEngine } from './engine.js';

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
export async function loadSeed() {
  if (!seed) seed = (await import('./seed-data.js?v=' + ASSET_VER)).SEED;
  return seed;
}
// Lịch gốc + các phần ghi đè → dữ liệu hiển thị
function compose(parts) {
  const s = seed;
  const cfg = parts.config || {};
  const db = {
    meta: { ...s.meta, ...(cfg.meta || {}) }, settings: cfg.settings || {}, news: cfg.news || [],
    rules: { ...s.rules, ...(cfg.rules || {}) }, general: s.general, sourceNotes: s.sourceNotes || [],
    events: { ...s.events }, matches: { ...s.matches },
  };
  for (const id of OVERRIDE_DOCS) {
    const d = parts[id];
    if (!d) continue;
    for (const [k, e] of Object.entries(d.e || {})) if (e) db.events[k] = e;
    for (const [k, m] of Object.entries(d.m || {})) { if (m === null) delete db.matches[k]; else db.matches[k] = m && VENUE_RENAME[m.venue] ? { ...m, venue: VENUE_RENAME[m.venue] } : m; }
  }
  return db;
}
const docOf = (ev) => `r_${ev.sport}_${ev.level}`;

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
  if (state.mode === 'local') { localWrite((o) => { ((o[d] ||= {}).m ||= {})[m.id] = m; }); return m; }
  requireFb();
  await fb.setOverride(d, 'm', m.id, m);
  fb.addLog({ by: who(), action, id: m.id, ev: m.ev, before: brief(before), after: brief(m) });
  return m;
}
export async function deleteMatch(id) {
  const m = state.db.matches[id];
  if (!m) return;
  const ev = state.db.events[m.ev];
  if (!canEdit(ev.sport)) throw new Error('Bạn không có quyền sửa môn này.');
  const d = docOf(ev);
  if (state.mode === 'local') { localWrite((o) => { ((o[d] ||= {}).m ||= {})[id] = null; }); return; }
  requireFb();
  await fb.setOverride(d, 'm', id, null);
  fb.addLog({ by: who(), action: 'Xóa trận', id, ev: m.ev, before: brief(m) });
}
export async function saveEvent(ev, action = 'Sửa nội dung') {
  if (!canEdit(ev.sport)) throw new Error('Bạn không có quyền sửa môn này.');
  const d = docOf(ev);
  if (state.mode === 'local') { localWrite((o) => { ((o[d] ||= {}).e ||= {})[ev.id] = ev; }); return; }
  requireFb();
  await fb.setOverride(d, 'e', ev.id, ev);
  fb.addLog({ by: who(), action, ev: ev.id });
}
export async function saveConfig(patch, action = 'Sửa cấu hình') {
  if (!(state.role && (state.role.all || state.role.super))) throw new Error('Cần quyền quản trị toàn giải.');
  if (state.mode === 'local') { localWrite((o) => { o.config = { ...(o.config || {}), ...patch }; }); return; }
  requireFb();
  await fb.setConfig(patch);
  fb.addLog({ by: who(), action });
}
function brief(m) {
  if (!m) return null;
  const s = (x) => (x ? x.ref || [x.p, x.t].filter(Boolean).join(' ') : '');
  return { a: s(m.a), b: s(m.b), sa: m.sa ?? null, sb: m.sb ?? null, st: m.st || 'sched', date: m.date || '', time: m.time || '', venue: m.venue || '' };
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
  return parts;
}
export async function importBackup(json) {
  if (!isSuper()) throw new Error('Chỉ quản trị cao nhất được khôi phục.');
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data.events || !data.matches) throw new Error('File sao lưu không đúng định dạng.');
  await loadSeed();
  const parts = diffFromSeed(data);
  const config = { meta: data.meta || {}, settings: data.settings || {}, news: data.news || [] };
  if (state.mode === 'local') { ls.set(LOCAL_KEY, { ...parts, config }); set({ db: compose({ ...parts, config }) }); return; }
  requireFb();
  await fb.replaceOverrides(parts);
  await fb.setConfig(config);
  fb.addLog({ by: who(), action: 'Khôi phục từ file sao lưu' });
}
export async function resetAll() {
  if (!isSuper()) throw new Error('Chỉ quản trị cao nhất.');
  if (state.mode === 'local') { ls.del(LOCAL_KEY); set({ db: compose({}) }); return; }
  requireFb();
  await fb.replaceOverrides({});
  fb.addLog({ by: who(), action: 'Xóa mọi thay đổi, về lịch gốc' });
}
export const resetLocal = resetAll;
export const listLogs = (n) => (fb ? fb.listLogs(n) : Promise.resolve([]));
export const listAdmins = () => (fb ? fb.listAdmins() : Promise.resolve([]));
export const setAdmin = (email, data) => { if (!isSuper()) throw new Error('Chỉ quản trị cao nhất.'); return fb.setAdmin(email, data).then(() => fb.addLog({ by: who(), action: 'Cấp quyền ' + email })); };
export const removeAdmin = (email) => { if (!isSuper()) throw new Error('Chỉ quản trị cao nhất.'); return fb.removeAdmin(email).then(() => fb.addLog({ by: who(), action: 'Thu hồi quyền ' + email })); };
