// ============================================================
//  Firebase: Firestore (dữ liệu thời gian thực) + đăng nhập Microsoft 365
//  Cấu trúc:
//    olympic/config        → meta, settings (điểm), news (thông báo)
//    olympic/rules         → điều lệ + quy định chung
//    olympic/sport_<môn>   → { events: {id: ...}, matches: {id: ...} }
//    admins/{email}        → { all: true } hoặc { sports: { bongda: true, ... } }
//    logs/{auto}           → nhật ký thay đổi (chỉ quản trị đọc)
//  Mỗi người xem chỉ đọc 7 document → rất ít lượt đọc Firestore.
// ============================================================
const CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
export const SPORT_IDS = ['bongda', 'bongro', 'keoco', 'caulong', 'karate'];

export async function connect(config) {
  const [appMod, fs] = await withTimeout(Promise.all([import(CDN + 'firebase-app.js'), import(CDN + 'firebase-firestore.js')]), 12000);
  const app = appMod.initializeApp(config);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) {
    db = fs.getFirestore(app);
  }
  const { doc, onSnapshot, setDoc, updateDoc, deleteField, serverTimestamp, collection, addDoc, getDocs, getDoc, deleteDoc, query, orderBy, limit, writeBatch } = fs;
  const clean = (o) => JSON.parse(JSON.stringify(o));
  const sportDoc = (s) => doc(db, 'olympic', 'sport_' + s);

  const api = {
    // Nghe 7 document; cb(name, data|null) mỗi khi có thay đổi
    watchAll(cb, onErr) {
      const names = ['config', 'rules', ...SPORT_IDS.map((s) => 'sport_' + s)];
      const stops = names.map((n) => onSnapshot(doc(db, 'olympic', n),
        (snap) => cb(n, snap.exists() ? snap.data() : null, snap.metadata.fromCache),
        (e) => onErr && onErr(e)));
      return () => stops.forEach((f) => f());
    },
    async setMatch(sport, match) {
      await updateDoc(sportDoc(sport), { ['matches.' + match.id]: clean(match), rev: serverTimestamp() });
    },
    async deleteMatch(sport, id) {
      await updateDoc(sportDoc(sport), { ['matches.' + id]: deleteField(), rev: serverTimestamp() });
    },
    async setEvent(sport, ev) {
      await updateDoc(sportDoc(sport), { ['events.' + ev.id]: clean(ev), rev: serverTimestamp() });
    },
    async setConfig(patch) {
      await setDoc(doc(db, 'olympic', 'config'), clean({ ...patch }), { merge: true });
    },
    async setRule(key, rule) {
      await updateDoc(doc(db, 'olympic', 'rules'), { ['rules.' + key]: clean(rule) });
    },
    // Nạp toàn bộ dữ liệu gốc (lần đầu, hoặc khôi phục)
    async seedAll(seed) {
      const b = writeBatch(db);
      b.set(doc(db, 'olympic', 'config'), clean({ meta: seed.meta, settings: seed.settings || {}, news: seed.news || [], seededAt: Date.now(), seedVersion: seed.version }));
      b.set(doc(db, 'olympic', 'rules'), clean({ rules: seed.rules, general: seed.general }));
      for (const s of SPORT_IDS) {
        const events = {}, matches = {};
        Object.values(seed.events).filter((e) => e.sport === s).forEach((e) => { events[e.id] = e; });
        Object.values(seed.matches).filter((m) => events[m.ev]).forEach((m) => { const c = { ...m }; delete c.src; matches[m.id] = c; });
        b.set(sportDoc(s), clean({ events, matches, rev: Date.now() }));
      }
      await b.commit();
    },
    async addLog(entry) {
      try { await addDoc(collection(db, 'logs'), clean({ ...entry, at: Date.now() })); } catch (e) { console.warn('[log]', e.message); }
    },
    async listLogs(n = 150) {
      const snap = await getDocs(query(collection(db, 'logs'), orderBy('at', 'desc'), limit(n)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async getAdmin(email) {
      try { const d = await getDoc(doc(db, 'admins', email)); return d.exists() ? d.data() : null; } catch (e) { return null; }
    },
    async listAdmins() {
      const snap = await getDocs(collection(db, 'admins'));
      return snap.docs.map((d) => ({ email: d.id, ...d.data() }));
    },
    async setAdmin(email, data) { await setDoc(doc(db, 'admins', email), clean(data)); },
    async removeAdmin(email) { await deleteDoc(doc(db, 'admins', email)); },
  };

  // ---------- đăng nhập Microsoft 365 ----------
  let authMod = null, auth = null;
  const ensureAuth = async () => { if (!auth) { authMod = await import(CDN + 'firebase-auth.js'); auth = authMod.getAuth(app); } return authMod; };
  api.watchAuth = (cb) => {
    ensureAuth().then((m) => {
      m.getRedirectResult(auth).catch(() => {});
      m.onAuthStateChanged(auth, (u) => cb(u ? { email: (u.email || '').toLowerCase(), name: u.displayName || u.email, uid: u.uid } : null));
    }).catch(() => cb(null));
  };
  api.signIn = async (tenant) => {
    const m = await ensureAuth();
    const p = new m.OAuthProvider('microsoft.com');
    const params = { prompt: 'select_account' };
    if (tenant) params.tenant = tenant;
    p.setCustomParameters(params);
    p.addScope('openid'); p.addScope('email'); p.addScope('profile');
    try {
      const res = await m.signInWithPopup(auth, p);
      return { email: (res.user.email || '').toLowerCase(), name: res.user.displayName || res.user.email };
    } catch (e) {
      const c = (e && e.code) || '';
      if (/popup-blocked|operation-not-supported|web-storage-unsupported/.test(c)) { await m.signInWithRedirect(auth, p); return { redirect: true }; }
      throw e;
    }
  };
  api.signOut = async () => { const m = await ensureAuth(); await m.signOut(auth); };
  return api;
}
