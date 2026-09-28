// ============================================================
//  KHO DỮ LIỆU
//  - Có FIREBASE_CONFIG: nghe Firestore thời gian thực (mọi người thấy kết quả ngay)
//  - Chưa có: "chế độ xem thử" — dữ liệu gốc từ Excel + chỉnh sửa lưu trên máy này
//  Lần mở sau hiện ngay bản đã lưu tạm trên máy rồi mới đồng bộ.
// ============================================================
import { FIREBASE_CONFIG, SUPER_ADMINS, AUTH_TENANT, ASSET_VER, SCHOOL_DOMAIN } from './config.js';
import { ls, clone } from './util.js';
import { createEngine } from './engine.js';

const SPORT_IDS = ['bongda', 'bongro', 'keoco', 'caulong', 'karate'];
const CACHE_KEY = 'olympic2627-cache-v1';
const LOCAL_KEY = 'olympic2627-local-v1';
const DEMO_USER_KEY = 'olympic2627-demo-admin';

let state = { ready: false, mode: 'loading', db: null, engine: null, user: null, role: null, needsSeed: false, error: '', lastSync: 0, authReady: false };
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
let seedMod = null;
export async function loadSeed() {
  if (!seedMod) seedMod = (await import('./seed-data.js?v=' + ASSET_VER)).SEED;
  return seedMod;
}
function fromSeed(seed) {
  return { meta: seed.meta, settings: seed.settings || {}, news: seed.news || [], rules: seed.rules, general: seed.general, events: clone(seed.events), matches: clone(seed.matches), sourceNotes: seed.sourceNotes || [] };
}

// ---------- chế độ xem thử: ghi đè cục bộ ----------
function localOverlay(db) {
  const o = ls.get(LOCAL_KEY, {});
  for (const [id, m] of Object.entries(o.matches || {})) { if (m === null) delete db.matches[id]; else db.matches[id] = m; }
  for (const [id, e] of Object.entries(o.events || {})) db.events[id] = e;
  if (o.news) db.news = o.news;
  if (o.settings) db.settings = o.settings;
  if (o.meta) db.meta = { ...db.meta, ...o.meta };
  if (o.rules) Object.assign(db.rules, o.rules);
  return db;
}
function localSave(fn) { const o = ls.get(LOCAL_KEY, {}); fn(o); ls.set(LOCAL_KEY, o); }

// ============================================================
export async function init() {
  const cached = ls.get(CACHE_KEY);
  if (FIREBASE_CONFIG && cached && cached.db) set({ db: cached.db, mode: 'cache', ready: true, lastSync: cached.at || 0 });

  if (!FIREBASE_CONFIG) {
    const seed = await loadSeed();
    const db = localOverlay(fromSeed(seed));
    const demo = ls.get(DEMO_USER_KEY);
    set({ db, mode: 'local', ready: true, authReady: true, user: demo || null, role: demo ? { all: true, super: true } : null });
    return;
  }
  try {
    const mod = await import('./firebase.js?v=' + ASSET_VER);
    fb = await mod.connect(FIREBASE_CONFIG);
  } catch (e) {
    console.warn('[store] Không kết nối được Firebase:', e.message);
    return fallbackSeed('Không kết nối được máy chủ dữ liệu — đang hiển thị lịch gốc.');
  }
  const parts = { sports: {} };
  const seen = new Set();
  let firstTimer = setTimeout(() => { if (state.mode !== 'live') fallbackSeed('Máy chủ phản hồi chậm — đang hiển thị dữ liệu gần nhất.'); }, 10000);
  fb.watchAll((name, data) => {
    seen.add(name);
    if (name === 'config') parts.config = data;
    else if (name === 'rules') parts.rules = data;
    else parts.sports[name.slice(6)] = data;
    if (seen.size < 2 + SPORT_IDS.length) return;
    clearTimeout(firstTimer);
    const empty = !parts.config && SPORT_IDS.every((s) => !parts.sports[s]);
    if (empty) { fallbackSeed('', true); return; }
    const db = {
      meta: (parts.config && parts.config.meta) || {}, settings: (parts.config && parts.config.settings) || {}, news: (parts.config && parts.config.news) || [],
      rules: (parts.rules && parts.rules.rules) || {}, general: (parts.rules && parts.rules.general) || {}, events: {}, matches: {},
    };
    for (const s of SPORT_IDS) { const d = parts.sports[s]; if (d) { Object.assign(db.events, d.events || {}); Object.assign(db.matches, d.matches || {}); } }
    set({ db, mode: 'live', ready: true, needsSeed: false, error: '', lastSync: Date.now() });
    try { ls.set(CACHE_KEY, { db, at: Date.now() }); } catch (e) { /* đầy bộ nhớ: bỏ qua */ }
  }, (e) => {
    console.warn('[store] Firestore lỗi:', e.code || e.message);
    if (state.mode !== 'live') fallbackSeed('Chưa đọc được dữ liệu từ máy chủ (' + (e.code || e.message) + ').');
  });
  fb.watchAuth(async (u) => {
    if (!u) { set({ user: null, role: null, authReady: true }); return; }
    const role = await roleOf(u.email);
    set({ user: u, role, authReady: true });
  });
}
async function fallbackSeed(msg, needsSeed = false) {
  if (state.mode === 'live' && !needsSeed) return;
  const seed = await loadSeed();
  const keepCache = state.mode === 'cache' && !needsSeed;
  set({ db: keepCache ? state.db : fromSeed(seed), mode: needsSeed ? 'seed' : (keepCache ? 'cache' : 'seed'), ready: true, needsSeed, error: msg });
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
    const u = { email: 'xem-thu@local', name: 'Quản trị (xem thử)' };
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
function sportOf(evId) { return String(evId).split('-')[0]; }
function applyLocal(p) { const db = clone(state.db); p(db); set({ db }); }
function who() { return state.user ? state.user.email : 'không rõ'; }

export async function saveMatch(match, action = 'Sửa trận') {
  const sport = sportOf(match.ev);
  if (!canEdit(sport)) throw new Error('Bạn không có quyền sửa môn này.');
  const before = state.db.matches[match.id] || null;
  const m = { ...match, upd: Date.now(), by: who() };
  if (state.mode === 'local') {
    localSave((o) => { (o.matches ||= {})[m.id] = m; });
    applyLocal((db) => { db.matches[m.id] = m; });
    return m;
  }
  requireLive();
  await fb.setMatch(sport, m);
  fb.addLog({ by: who(), action, id: m.id, ev: m.ev, before: brief(before), after: brief(m) });
  return m;
}
export async function deleteMatch(id) {
  const m = state.db.matches[id];
  if (!m) return;
  const sport = sportOf(m.ev);
  if (!canEdit(sport)) throw new Error('Bạn không có quyền sửa môn này.');
  if (state.mode === 'local') {
    localSave((o) => { (o.matches ||= {})[id] = null; });
    applyLocal((db) => { delete db.matches[id]; });
    return;
  }
  requireLive();
  await fb.deleteMatch(sport, id);
  fb.addLog({ by: who(), action: 'Xóa trận', id, ev: m.ev, before: brief(m) });
}
export async function saveEvent(ev, action = 'Sửa nội dung') {
  if (!canEdit(ev.sport)) throw new Error('Bạn không có quyền sửa môn này.');
  if (state.mode === 'local') {
    localSave((o) => { (o.events ||= {})[ev.id] = ev; });
    applyLocal((db) => { db.events[ev.id] = ev; });
    return;
  }
  requireLive();
  await fb.setEvent(ev.sport, ev);
  fb.addLog({ by: who(), action, ev: ev.id });
}
export async function saveConfig(patch, action = 'Sửa cấu hình') {
  if (!(state.role && (state.role.all || state.role.super))) throw new Error('Cần quyền quản trị chung.');
  if (state.mode === 'local') {
    localSave((o) => Object.assign(o, patch));
    applyLocal((db) => { if (patch.news) db.news = patch.news; if (patch.settings) db.settings = patch.settings; if (patch.meta) db.meta = { ...db.meta, ...patch.meta }; });
    return;
  }
  requireLive();
  await fb.setConfig(patch);
  fb.addLog({ by: who(), action });
}
export async function saveRule(key, rule) {
  if (!(state.role && (state.role.all || state.role.super) || canEdit(rule.sport))) throw new Error('Không có quyền.');
  if (state.mode === 'local') {
    localSave((o) => { (o.rules ||= {})[key] = rule; });
    applyLocal((db) => { db.rules[key] = rule; });
    return;
  }
  requireLive();
  await fb.setRule(key, rule);
  fb.addLog({ by: who(), action: 'Sửa điều lệ ' + key });
}
function requireLive() {
  if (!fb) throw new Error('Chưa kết nối máy chủ.');
  if (state.needsSeed) throw new Error('Máy chủ chưa có dữ liệu. Vào mục "Dữ liệu" để nạp dữ liệu gốc trước.');
}
function brief(m) {
  if (!m) return null;
  const s = (x) => (x ? x.ref || [x.p, x.t].filter(Boolean).join(' ') : '');
  return { a: s(m.a), b: s(m.b), sa: m.sa ?? null, sb: m.sb ?? null, st: m.st || 'sched', date: m.date || '', time: m.time || '', venue: m.venue || '' };
}

// ---------- dữ liệu gốc / sao lưu ----------
export async function seedServer() {
  if (!isSuper()) throw new Error('Chỉ quản trị cao nhất được nạp dữ liệu gốc.');
  const seed = await loadSeed();
  await fb.seedAll({ ...seed, settings: {}, news: [] });
  fb.addLog({ by: who(), action: 'Nạp dữ liệu gốc từ Excel' });
}
export async function importBackup(json) {
  if (!isSuper()) throw new Error('Chỉ quản trị cao nhất được khôi phục.');
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data.events || !data.matches) throw new Error('File sao lưu không đúng định dạng.');
  if (state.mode === 'local') {
    ls.set(LOCAL_KEY, { matches: data.matches, events: data.events, news: data.news || [], settings: data.settings || {}, meta: data.meta || {} });
    const seed = await loadSeed();
    set({ db: localOverlay(fromSeed(seed)) });
    return;
  }
  await fb.seedAll({ version: 'backup', meta: data.meta || state.db.meta, settings: data.settings || {}, news: data.news || [], rules: data.rules || state.db.rules, general: data.general || state.db.general, events: data.events, matches: data.matches });
  fb.addLog({ by: who(), action: 'Khôi phục từ file sao lưu' });
}
export async function resetLocal() { ls.del(LOCAL_KEY); const seed = await loadSeed(); set({ db: fromSeed(seed) }); }
export const listLogs = (n) => (fb ? fb.listLogs(n) : Promise.resolve([]));
export const listAdmins = () => (fb ? fb.listAdmins() : Promise.resolve([]));
export const setAdmin = (email, data) => { if (!isSuper()) throw new Error('Chỉ quản trị cao nhất.'); return fb.setAdmin(email, data).then(() => fb.addLog({ by: who(), action: 'Cấp quyền ' + email })); };
export const removeAdmin = (email) => { if (!isSuper()) throw new Error('Chỉ quản trị cao nhất.'); return fb.removeAdmin(email).then(() => fb.addLog({ by: who(), action: 'Thu hồi quyền ' + email })); };
