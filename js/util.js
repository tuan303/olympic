// Tiện ích dùng chung: thoát HTML, ngày giờ, lưu cục bộ an toàn

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = esc;

// ---------- ngày giờ (giờ Việt Nam) ----------
const pad = (n) => String(n).padStart(2, '0');
export function todayISO() {
  // Lấy ngày theo giờ Hà Nội bất kể múi giờ máy
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function nowHM() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function parseISO(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
export function addDays(iso, n) { const d = parseISO(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WD_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
export const weekday = (iso) => WD[parseISO(iso).getUTCDay()];
export const weekdayLong = (iso) => WD_LONG[parseISO(iso).getUTCDay()];
export function fmtDM(iso) { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}/${m}`; }
export function fmtDate(iso, long = false) { if (!iso) return ''; return `${long ? weekdayLong(iso) : weekday(iso)}, ${fmtDM(iso)}`; }
export function fmtFull(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${weekdayLong(iso)}, ${d}/${m}/${y}`; }
export function mondayOf(iso) { const d = parseISO(iso); const wd = (d.getUTCDay() + 6) % 7; return addDays(iso, -wd); }
export function weekNo(iso, week1) { return Math.floor((parseISO(mondayOf(iso)) - parseISO(week1)) / (7 * 864e5)) + 1; }
export function timeRange(m) { if (!m.time) return ''; return m.end ? `${m.time}–${m.end}` : m.time; }
export function relTime(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  const d = new Date(ts + 7 * 3600 * 1000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// ---------- chữ ----------
export function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}
export const plural = (n, word) => `${n.toLocaleString('vi-VN')} ${word}`;

// ---------- lưu cục bộ (có thể bị chặn ở chế độ riêng tư) ----------
export const ls = {
  get(k, def = null) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } },
};

export function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const clone = (o) => JSON.parse(JSON.stringify(o));
