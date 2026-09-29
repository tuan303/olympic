// ============================================================
//  Firebase: Firestore (thời gian thực) + đăng nhập Microsoft 365
//
//  Lịch gốc nằm trong js/seed-data.js (phục vụ tĩnh qua Vercel, không tốn Firestore).
//  Firestore CHỈ lưu phần thay đổi so với lịch gốc:
//    olympic/config            → meta, settings (cách tính điểm), news (thông báo), rules (điều lệ sửa)
//    olympic/r_<môn>_<cấp>     → { m: { <mã trận>: trận | null(đã xóa) }, e: { <mã nội dung>: nội dung },
//                                    r: { '<mã nội dung>|<lớp>': { list: [{ n, no }] } } (danh sách VĐV đội) }
//                                (15 document: 5 môn × TH/THCS/THPT — mỗi lần nhập kết quả chỉ gửi lại 1 document nhỏ)
//    admins/{email}            → { all: true } hoặc { sports: { bongda: true, ... } }
//    logs/{auto}               → nhật ký thay đổi
// ============================================================
const CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
export const SPORT_IDS = ['bongda', 'bongro', 'keoco', 'caulong', 'karate'];
export const LEVEL_IDS = ['TH', 'THCS', 'THPT'];
export const OVERRIDE_DOCS = SPORT_IDS.flatMap((s) => LEVEL_IDS.map((l) => `r_${s}_${l}`));

export async function connect(config) {
  const [appMod, fs] = await withTimeout(Promise.all([import(CDN + 'firebase-app.js'), import(CDN + 'firebase-firestore.js')]), 12000);
  const app = appMod.initializeApp(config);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) {
    db = fs.getFirestore(app);
  }
  const { doc, onSnapshot, setDoc, serverTimestamp, collection, addDoc, getDocs, getDoc, deleteDoc, query, orderBy, limit, writeBatch, FieldPath } = fs;
  const clean = (o) => JSON.parse(JSON.stringify(o));

  const api = {
    // Nghe các document; cb(tên, dữ liệu|null)
    watchAll(names, cb, onErr) {
      const stops = names.map((n) => onSnapshot(doc(db, 'olympic', n),
        (snap) => cb(n, snap.exists() ? snap.data() : null),
        (e) => onErr && onErr(e, n)));
      return () => stops.forEach((f) => f());
    },
    // Ghi đè 1 trận (kind 'm') hoặc 1 nội dung (kind 'e'); value = null nghĩa là xóa trận
    async setOverride(docId, kind, id, value) {
      const data = { [kind]: { [id]: value === null ? null : clean(value) }, rev: serverTimestamp() };
      await setDoc(doc(db, 'olympic', docId), data, { mergeFields: [new FieldPath(kind, id), 'rev'] });
    },
    async setConfig(patch) {
      await setDoc(doc(db, 'olympic', 'config'), clean(patch), { merge: true });
    },
    // Ghi hàng loạt (khôi phục sao lưu): parts = { docId: { m: {...}, e: {...} } }
    async replaceOverrides(parts) {
      const b = writeBatch(db);
      for (const id of OVERRIDE_DOCS) {
        const p = parts[id];
        if (p && (Object.keys(p.m || {}).length || Object.keys(p.e || {}).length || Object.keys(p.r || {}).length)) b.set(doc(db, 'olympic', id), clean({ m: p.m || {}, e: p.e || {}, r: p.r || {}, rev: Date.now() }));
        else b.delete(doc(db, 'olympic', id));
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
