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
//    logs/{auto}               → nhật ký thay đổi (ai, lúc nào, loại thao tác, trận/nội dung, giá trị trước → sau)
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
  const { doc, onSnapshot, serverTimestamp, collection, getDocs, getDoc, query, orderBy, limit, startAfter, writeBatch, FieldPath } = fs;
  const clean = (o) => JSON.parse(JSON.stringify(o));
  // ts thêm SAU clean() (JSON làm hỏng serverTimestamp)
  const addLogTo = (b, log) => { if (log) b.set(doc(collection(db, 'logs')), { ...clean(log), ts: serverTimestamp() }); };

  const api = {
    // Nghe các document; cb(tên, dữ liệu|null)
    watchAll(names, cb, onErr) {
      const stops = names.map((n) => onSnapshot(doc(db, 'olympic', n),
        (snap) => cb(n, snap.exists() ? snap.data() : null),
        (e) => onErr && onErr(e, n)));
      return () => stops.forEach((f) => f());
    },
    // Mỗi lần ghi dữ liệu kèm 1 dòng nhật ký trong CÙNG một lô (writeBatch): cùng lưu / cùng bị từ chối,
    // mất mạng thì cả hai cùng nằm trong hàng đợi — không có thay đổi nào lọt lên máy chủ mà thiếu nhật ký.
    // ts = giờ máy chủ (luật Firestore kiểm tra); at = giờ máy (để sắp xếp, tương thích bản ghi cũ)
    // Ghi đè 1 trận (kind 'm') hoặc 1 nội dung (kind 'e'); value = null nghĩa là xóa trận
    async setOverride(docId, kind, id, value, log) {
      const data = { [kind]: { [id]: value === null ? null : clean(value) }, rev: serverTimestamp() };
      const b = writeBatch(db);
      b.set(doc(db, 'olympic', docId), data, { mergeFields: [new FieldPath(kind, id), 'rev'] });
      addLogTo(b, log);
      await b.commit();
    },
    async setConfig(patch, log) {
      const b = writeBatch(db);
      b.set(doc(db, 'olympic', 'config'), clean(patch), { merge: true });
      addLogTo(b, log);
      await b.commit();
    },
    // Ghi hàng loạt (khôi phục sao lưu / về lịch gốc): parts = { docId: { m: {...}, e: {...}, r: {...} } }
    async replaceOverrides(parts, { config, log } = {}) {
      const b = writeBatch(db);
      for (const id of OVERRIDE_DOCS) {
        const p = parts[id];
        if (p && (Object.keys(p.m || {}).length || Object.keys(p.e || {}).length || Object.keys(p.r || {}).length)) b.set(doc(db, 'olympic', id), clean({ m: p.m || {}, e: p.e || {}, r: p.r || {}, rev: Date.now() }));
        else b.delete(doc(db, 'olympic', id));
      }
      if (config) b.set(doc(db, 'olympic', 'config'), clean(config), { merge: true });
      addLogTo(b, log);
      await b.commit();
    },
    // n bản ghi mới nhất; after = bản ghi cuối đã tải (tải tiếp các bản ghi cũ hơn, không sót bản ghi trùng mốc giờ)
    async listLogs(n = 150, after = null) {
      const base = [collection(db, 'logs'), orderBy('at', 'desc')];
      const q = after && after._snap ? query(...base, startAfter(after._snap), limit(n)) : query(...base, limit(n));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const x = d.data();
        const o = { ...x, _doc: d.id, srvAt: x.ts && x.ts.toMillis ? x.ts.toMillis() : null };
        delete o.ts;
        Object.defineProperty(o, '_snap', { value: d, enumerable: false }); // con trỏ phân trang (không xuất ra CSV)
        return o;
      });
    },
    async getAdmin(email) {
      try { const d = await getDoc(doc(db, 'admins', email)); return d.exists() ? d.data() : null; } catch (e) { return null; }
    },
    async listAdmins() {
      const snap = await getDocs(collection(db, 'admins'));
      return snap.docs.map((d) => ({ email: d.id, ...d.data() }));
    },
    async setAdmin(email, data, log) { const b = writeBatch(db); b.set(doc(db, 'admins', email), clean(data)); addLogTo(b, log); await b.commit(); },
    async removeAdmin(email, log) { const b = writeBatch(db); b.delete(doc(db, 'admins', email)); addLogTo(b, log); await b.commit(); },
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
