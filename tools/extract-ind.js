// ============================================================
//  CẦU LÔNG & KARATE — nhánh đấu loại trực tiếp (thi cá nhân)
//  "(n)" trong file = người thắng trận số n của cùng bảng/nhánh.
//  Karate THCS ghi số ô bốc thăm ("2 - 3") thay vì tên → tra bảng ô bốc thăm.
// ============================================================
const X = require('./extract.js');
const { fold, normClass, CLASSES, note, parseScore, dateOf, txt, sheet } = X;

const F_CL = 'LỊCH THI ĐẤU/CẦU LÔNG/';
const F_KA = 'LỊCH THI ĐẤU/LTĐ-VÕ THUẬT-KARATE-DO - KÉO CO/Lịch TĐ Môn KARATE/';

// Tiết thể thao của từng khối (thứ, giờ bắt đầu, giờ kết thúc) — lấy từ lịch các môn đồng đội
const SESSION = {
  1: [2, '15:00', '16:10'], 2: [4, '15:00', '16:10'], 3: [4, '08:00', '09:10'], 4: [2, '08:00', '09:10'],
  5: [5, '15:00', '16:10'], 6: [6, '07:40', '09:15'], 7: [2, '09:30', '11:05'], 8: [3, '07:40', '09:15'],
  9: [5, '07:40', '09:15'], 10: [6, '13:30', '15:00'], 11: [6, '13:30', '15:00'], 12: [3, '09:30', '11:00'],
};
// Karate thi tập trung 1 ngày (theo kế hoạch đã phê duyệt)
const KARATE_DAY = {
  2: ['2026-11-04', '08:00', '11:30'], 3: ['2026-11-04', '08:00', '11:30'],
  4: ['2026-11-04', '13:30', '15:30'], 5: ['2026-11-04', '13:30', '15:30'],
  6: ['2026-10-30', '07:40', '11:30'], 7: ['2026-10-30', '07:40', '11:30'], 8: ['2026-10-30', '07:40', '11:30'],
  9: ['2026-10-30', '13:30', '15:30'], 10: ['2026-10-30', '13:30', '15:30'], 11: ['2026-10-30', '13:30', '15:30'], 12: ['2026-10-30', '13:30', '15:30'],
};
const KARATE_VENUE = 'Sảnh tầng 1 – khu tập trung xe buýt';

const S = (sport, file, sheetName, grade, extra = {}) => ({ sport, file, sheet: sheetName, grade, ...extra });
const IND_SHEETS = [
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG_TiH.xlsx', 'K3T4 (Đơn nam)', 3),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG_TiH.xlsx', 'K3T4 (Đơn nữ)', 3),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG_TiH.xlsx', 'K4T2 (Đơn nam)', 4),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG_TiH.xlsx', 'K4T2 (Đơn nữ)', 4),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG_TiH.xlsx', 'K5T5 (Đơn nam)', 5),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG_TiH.xlsx', 'K5T5 (Đơn nữ)', 5),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG THCS.xlsx', 'K6T6', 6),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG THCS.xlsx', 'K7T2', 7),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG THCS.xlsx', 'K8T3', 8),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG THCS.xlsx', 'K9T5', 9),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG KHỐI THPT.xlsx', 'KHỐI 10T6', 10),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG KHỐI THPT.xlsx', 'KHỐI 11T6', 11, { legs: true }),
  S('caulong', F_CL + 'BẢNG THI ĐẤU MÔN CẦU LÔNG KHỐI THPT.xlsx', 'KHỐI 12T3', 12),

  S('karate', F_KA + 'TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K2 (KATA NAM)-xong', 2),
  S('karate', F_KA + 'TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K2(KATA NỮ)-xong', 2),
  S('karate', F_KA + 'TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'Khối 3 (Kata nam )-xong ', 3),
  S('karate', F_KA + 'TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K3 (KATA nữ)-xong', 3),
  S('karate', F_KA + 'TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K4 (KATA nam)-Xong', 4),
  S('karate', F_KA + 'TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K4(KATA nữ)', 4),
  S('karate', F_KA + 'TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K5-KATA NAM-xong', 5),
  S('karate', F_KA + 'TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K5-KATA NỮ-xong', 5),
  S('karate', F_KA + 'THCS-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K6 -KATA CN NAM-xong', 6, { slots: true }),
  S('karate', F_KA + 'THCS-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K6 -KATA CN NỮ-xong', 6, { slots: true }),
  S('karate', F_KA + 'THCS-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'KHỐI 7(KATA CN NAM)-xong', 7, { slots: true }),
  S('karate', F_KA + 'THCS-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'KHỐI 7-KATA CN NỮ-xong', 7, { slots: true }),
  S('karate', F_KA + 'THCS-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K8-KATA CN NAM-xong ', 8, { slots: true }),
  S('karate', F_KA + 'THCS-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K8-KATA CN NỮ-xong', 8, { slots: true }),
  S('karate', F_KA + 'THCS-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K9 - KATA CN NAM - Xong', 9, { slots: true }),
  S('karate', F_KA + 'THCS-BẢNG THI ĐẤU - KARATE-DO.xlsx', 'K9 - KATA CN NỮ-Xong', 9, { slots: true }),
  S('karate', F_KA + 'THPT - BẢNG THI ĐẤU - KARATE.xlsx', 'KHỐI 10-KATA NAM-xong', 10),
  S('karate', F_KA + 'THPT - BẢNG THI ĐẤU - KARATE.xlsx', 'K10-KATA NỮ-xong', 10),
  S('karate', F_KA + 'THPT - BẢNG THI ĐẤU - KARATE.xlsx', 'KHỐI 11-KATA CN NAM-xong', 11),
  S('karate', F_KA + 'THPT - BẢNG THI ĐẤU - KARATE.xlsx', 'K11-KATA CN NỮ-xong', 11),
  S('karate', F_KA + 'THPT - BẢNG THI ĐẤU - KARATE.xlsx', 'KHỐI 12-KATA CN NAM-xong', 12),
  S('karate', F_KA + 'THPT - BẢNG THI ĐẤU - KARATE.xlsx', 'KHỐI 12-KATA CN NỮ-xong', 12),
];

const CATS = [
  [/DOI NAM NU/, 'doi-nam-nu', 'Đôi nam nữ'], [/DON NAM/, 'don-nam', 'Đơn nam'], [/DON NU/, 'don-nu', 'Đơn nữ'],
  [/DOI NAM/, 'doi-nam', 'Đôi nam'], [/DOI NU/, 'doi-nu', 'Đôi nữ'],
];
function catFromText(f) { for (const [re, code, name] of CATS) if (re.test(f)) return { code, name }; return null; }

// ---------- chữ ----------
function titleCase(s) {
  const t = String(s || '').trim();
  if (!t) return t;
  const letters = t.replace(/[^A-Za-zÀ-ỹĐđ]/g, '');
  if (letters && letters !== letters.toUpperCase()) return t.replace(/\s+/g, ' '); // đã viết thường/hoa lẫn → giữ nguyên
  return t.toLocaleLowerCase('vi').replace(/(^|[\s/+(])(\p{L})/gu, (m, p, c) => p + c.toLocaleUpperCase('vi')).replace(/\s+/g, ' ');
}
const BYE_RE = /\bOUT\b|K(?:O|HÔNG|HONG)\s*(?:THAM GIA|Đ?D?KY|ĐĂNG\s*KÝ|DANG\s*KY)|\b2 L[ỚO]P\b|\(\s*bỏ[^)]*\)|\bbỏ\b/i;
const BYE_RE_G = new RegExp(BYE_RE.source, 'gi');
function classTokens(s) {
  const up = String(s).toUpperCase().replace(/\n/g, ' ');
  const out = [];
  const re = /(^|[^0-9A-ZÀ-ỸĐ])(\d{1,2}\s?[A-Z]{1,2}[0-9O]{0,2}[HM]?)(?=$|[^0-9A-ZÀ-ỸĐ])/g;
  let m;
  while ((m = re.exec(up))) {
    const c = normClass(m[2]);
    if (CLASSES.has(c)) out.push({ raw: m[2], cls: c, at: m.index + m[1].length });
  }
  return out;
}

// Tách "A - B" thành 2 vế: chọn dấu gạch sao cho mỗi vế có đúng 1 mã lớp hoặc 1 tham chiếu "(n)"/số ô
function sideKind(s, slotMode) {
  const t = s.trim();
  if (/^\(\s*\d{1,2}\s*\)$/.test(t)) return 'ref';
  if (slotMode && /^\d{1,2}$/.test(t)) return 'slot';
  const n = classTokens(t).length;
  if (n === 1) return 'cls';
  if (n > 1) return 'multi';
  return BYE_RE.test(t) ? 'bye' : '';
}
function splitSides(text, slotMode) {
  let t = String(text || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/(\d{1,2}[A-Z]{1,2}[0-9O]{0,2})\s*-\s*\((OUT)\)/i, '$1 (OUT)').replace(/^'/, '');
  // "10TO1 - NGUYỄN VĂN KHOA" (gạch giữa lớp và tên) → bỏ gạch đó
  t = t.replace(/(\b\d{1,2}\s?[A-Z]{1,2}\s?[0-9O]{0,2}[HM]?)\s*-\s*(?=[A-ZÀ-Ỹa-zà-ỹĐđ]{2,}(?:\s|$))(?!KO\b|OUT\b)/g, (m, c) => (CLASSES.has(normClass(c)) ? c + ' ' : m));
  const idxs = [...t.matchAll(/[-–]/g)].map(m => m.index);
  let best = null;
  for (const i of idxs) {
    const L = t.slice(0, i).trim(), R = t.slice(i + 1).trim();
    if (!L || !R) continue;
    const kl = sideKind(L, slotMode), kr = sideKind(R, slotMode);
    const good = k => (k === 'ref' || k === 'slot' || k === 'cls' ? 2 : k === 'bye' ? 1 : 0);
    const score = good(kl) + good(kr) - (kl === 'multi' || kr === 'multi' ? 3 : 0);
    if (!best || score > best.score) best = { score, L, R };
  }
  if (!best || best.score < 3) {
    // "10L01-10N0 2 LỚP Ko đky" → cả hai đều không đăng ký
    const cls = classTokens(t);
    if (cls.length === 2 && BYE_RE.test(t)) return [cls[0].cls + ' KO ĐKY', cls[1].cls + ' KO ĐKY'];
    return null;
  }
  return [best.L, best.R];
}

function parseAthlete(s) {
  let t = String(s || '').replace(/\n/g, ' ').trim().replace(/^'/, '');
  const bye = BYE_RE.test(t);
  const cls = classTokens(t)[0];
  let name = t;
  if (cls) name = name.slice(0, cls.at) + ' ' + name.slice(cls.at + cls.raw.length);
  name = name.replace(BYE_RE_G, ' ').replace(/[()\-:;']/g, ' ').replace(/^\s*\d{1,2}\s+/, ' ').replace(/\s+/g, ' ').trim();
  name = name.replace(/\s*\+\s*/g, ' + ').replace(/\s*\/\s*/g, ' / ');
  if (/^(x|lớp|lop|\d{1,2})$/i.test(name)) name = '';
  const side = { t: cls ? cls.cls : '' };
  // "11L Ko đky": mã lớp không rõ (không có trong danh sách lớp) → chỉ ghi nhận là không đăng ký
  if (!cls && bye && /^d{1,2}s?[A-Z]{1,2}d{0,2}$/i.test(name)) name = '';
  if (name) side.p = titleCase(name);
  if (bye || (!name && cls)) side.bye = true;
  return side;
}

// Ô bốc thăm Karate THCS: "1 (6AOM:Nguyễn Đăng Khoa)", "2 (6BO1)" (lớp không đăng ký → trống)
function readSlots(ws, rowFrom, rowTo, grade) {
  const slots = {};
  for (let r = rowFrom; r <= rowTo; r++) for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const v = txt(ws, col, r).replace(/\n/g, ' ').trim();
    const m = v.match(/^(\d{1,2})\s*\(\s*([0-9A-Za-z ]{2,7}?)\s*(?:[:;\-]\s*([^)]*?))?\s*\)?\s*$/);
    if (!m) continue;
    let cls = normClass(m[2]);
    if (!CLASSES.has(cls)) { const fix = normClass(m[2].replace(/^3(?=7)/, '')); if (CLASSES.has(fix)) cls = fix; }
    if (!CLASSES.has(cls) && /^[A-Z]/i.test(m[2].trim())) { const fix = normClass(grade + m[2]); if (CLASSES.has(fix)) cls = fix; }
    const name = (m[3] || '').trim();
    slots[Number(m[1])] = { t: CLASSES.has(cls) ? cls : '', raw: m[2], p: name ? titleCase(name) : '', bye: !name };
  }
  return slots;
}

// Sửa chỗ ghi đảo ngoặc / nhầm số trong file Karate (đối chiếu sheet "chính-quyền" — các trận chính sau khi lọc đăng ký)
const KPATCH = {
  'KHỐI 7(KATA CN NAM)-xong!K11': '(2) - 6', 'KHỐI 7(KATA CN NAM)-xong!K41': '21 - (4)',
  'KHỐI 7-KATA CN NỮ-xong!K11': '(2) - 6', 'KHỐI 7-KATA CN NỮ-xong!K48': '21 - (4)',
  'K8-KATA CN NAM-xong !K12': '7 - (3)', 'K8-KATA CN NỮ-xong!K12': '7 - (3)',
  'K9 - KATA CN NAM - Xong!K9': '7 - (3)', 'K9 - KATA CN NAM - Xong!K40': '(1) - 16', 'K9 - KATA CN NAM - Xong!K42': '(3) - 22',
  'K9 - KATA CN NỮ-Xong!K10': '7 - (3)', 'K9 - KATA CN NỮ-Xong!K43': '(1) - 16', 'K9 - KATA CN NỮ-Xong!K45': '(3) - 22',
  'K5-KATA NAM-xong!K27': '5A2 KO ĐKY - 5A0 KO ĐKY',
  // K5 Kata Nam nhánh B — sơ đồ BTC gửi 02/10: (1) gặp 5A3 Phạm An Nguyên; (7) = (3)-(4); (8) = (5)-(6); BK2 = (7)-(8)
  'K5-KATA NAM-xong!K28': '(1) - 5A3 Phạm An Nguyên', 'K5-KATA NAM-xong!K29': '5A6 KO ĐKY - (2)',
  'K5-KATA NAM-xong!K31': '(3) - (4)', 'K5-KATA NAM-xong!K32': '(5) - (6)', 'K5-KATA NAM-xong!K33': '(7) - (8)',
  'K5-KATA NAM-xong!K9': '5A1 KO ĐKY - 5A7 KO ĐKY', 'K5-KATA NAM-xong!K10': '(1) - 5A8 Bùi Ngọc Lâm',
  'K5-KATA NỮ-xong!K29': '5A6 Vũ Trà My - (2)',
  // K5 Kata Nữ nhánh A — trận 2: 5A3 không đăng ký
  'K5-KATA NỮ-xong!K8': '5A2 Nguyễn Thảo Nguyên - 5A3 KO ĐKY',
  'K5-KATA NỮ-xong!K26': '5A1 KO ĐKY - 5A7 Nguyễn Tuệ Anh', 'K5-KATA NỮ-xong!K27': '5A2 KO ĐKY - 5A0 KO ĐKY',
  'K11-KATA CN NỮ-xong!O9': '11L0 KO ĐKY - 11L01 KO ĐKY',
};

const indEvents = {};
const indMatches = [];

function findHeaders(ws) {
  const XL = X.XLSX;
  const ref = ws['!ref'];
  if (!ref) return [];
  const out = [];
  const R = XL.utils.decode_range(ref);
  for (let r = R.s.r; r <= Math.min(R.e.r, 400); r++) {
    for (let c = R.s.c + 1; c <= Math.min(R.e.c, 30); c++) {
      const cell = ws[XL.utils.encode_cell({ r, c })];
      if (!cell || fold(cell.v) !== 'SO TRAN') continue;
      const left = ws[XL.utils.encode_cell({ r, c: c - 1 })];
      if (!left || fold(left.v) !== 'VONG DAU') continue;
      const col = k => XL.utils.encode_col(c + k);
      const wk = ws[XL.utils.encode_cell({ r, c: c - 2 })];
      out.push({
        row: r + 1, num: col(0), round: col(-1), pair: col(1), res: col(2),
        week: wk && fold(wk.v) === 'TUAN' ? col(-2) : null,
        venueHead: String((ws[XL.utils.encode_cell({ r, c: c + 1 })] || {}).v || ''),
      });
    }
  }
  return out;
}

function readIndSheet(cfg) {
  const ws = sheet(cfg.file, cfg.sheet);
  const heads = findHeaders(ws);
  if (!heads.length) { note(`[${cfg.sport}] ${cfg.sheet}: không thấy bảng "Vòng đấu | Số trận"`); return; }
  const isKarate = cfg.sport === 'karate';
  const sheetFold = fold(cfg.sheet);
  const tables = [];
  heads.forEach((h, hi) => {
    // ---- nội dung ----
    let cat;
    if (isKarate) {
      const nu = /\bNU\b/.test(sheetFold);
      cat = nu ? { code: 'kata-nu', name: 'Kata cá nhân Nữ' } : { code: 'kata-nam', name: 'Kata cá nhân Nam' };
    } else {
      for (let r = h.row; r >= Math.max(1, h.row - 6) && !cat; r--) {
        for (const col of 'ABCDEFGHIJKLMNOPQRS'.split('')) { const c = catFromText(fold(txt(ws, col, r))); if (c) { cat = c; break; } }
      }
      if (!cat) cat = catFromText(fold(cfg.sheet));
      if (!cat) { note(`[caulong] ${cfg.sheet} dòng ${h.row}: không xác định được nội dung`); return; }
    }
    const ev = `${cfg.sport}-k${cfg.grade}-${cat.code}`;
    const branch = isKarate ? (heads.length > 1 ? (hi === 0 ? 'A' : 'B') : '') : '';
    if (!indEvents[ev]) {
      const E = { id: ev, sport: cfg.sport, grade: cfg.grade, cat: cat.code, catName: cat.name, src: cfg.sheet, branches: {} };
      if (isKarate) { const d = KARATE_DAY[cfg.grade]; E.date = d[0]; E.time = d[1]; E.end = d[2]; E.venue = KARATE_VENUE; }
      indEvents[ev] = E;
    }
    const E = indEvents[ev];
    if (!isKarate) E.venue = 'Sân cầu lông (đối diện sảnh đợi xe buýt) – ' + h.venueHead.replace(/\s+/g, ' ').trim();

    // ---- ô bốc thăm (Karate THCS) ----
    let slots = null;
    if (cfg.slots) {
      const nextRow = heads[hi + 1] ? heads[hi + 1].row - 3 : h.row + 40;
      slots = readSlots(ws, Math.max(1, h.row - 4), nextRow, cfg.grade);
    }
    // ---- các trận ----
    let week = null, round = '', prevN = 0, empty = 0;
    const local = [];
    const stopRow = heads[hi + 1] ? heads[hi + 1].row - 1 : h.row + 60;
    for (let r = h.row + 1; r <= stopRow; r++) {
      const pk = cfg.sheet + '!' + h.pair + r;
      let pairTxt = txt(ws, h.pair, r);
      if (KPATCH[pk] != null) {
        note(`[ĐÃ SỬA] Karate ${cfg.sheet.trim()} dòng ${r}: "${pairTxt.replace(/\s+/g, ' ')}" → "${KPATCH[pk]}"`);
        pairTxt = KPATCH[pk];
      }
      const numTxt = txt(ws, h.num, r);
      const rTxt = txt(ws, h.round, r);
      if (h.week) { const w = txt(ws, h.week, r).match(/^\s*(\d{1,2})/); if (w) week = Number(w[1]); }
      if (rTxt && !/^\d+$/.test(rTxt)) round = rTxt.replace(/\s+/g, ' ').trim();
      if (!pairTxt) { if (++empty >= 3 && local.length) break; continue; }
      empty = 0;
      if (/^(Vòng đấu|Số trận|THI ĐẤU|Thi đấu)$/i.test(pairTxt)) continue;
      if (/DANH SÁCH|Giới tính|Họ và tên/i.test(pairTxt + ' ' + rTxt + ' ' + numTxt)) break;
      if (!/[-–]/.test(pairTxt)) continue;
      if (/NHẤT NHÁNH|2 VĐV/i.test(pairTxt)) continue;
      let n = Number((numTxt.match(/^\s*(\d{1,3})/) || [])[1]);
      if (!n || n <= prevN) {
        if (n && n <= prevN) note(`[${cfg.sport}] ${cfg.sheet} dòng ${r}: số trận ${n} trùng/lùi → đánh lại ${prevN + 1}`);
        n = prevN + 1;
      }
      prevN = n;
      const sides = splitSides(pairTxt, !!slots);
      if (!sides) { note(`[${cfg.sport}] ${cfg.sheet} dòng ${r}: không tách được cặp "${pairTxt.replace(/\n/g, ' ')}"`); continue; }
      const id = `${ev}-${branch}${n}`;
      const mk = s => {
        const t = s.trim();
        let m;
        if ((m = t.match(/^\(\s*(\d{1,2})\s*\)$/))) {
          const k = Number(m[1]);
          if (cfg.legs) return { ref: `T:${ev}-${2 * k - 1},${ev}-${2 * k}` };
          return { ref: `W:${ev}-${branch}${k}`, rawRef: k };
        }
        if (slots && /^\d{1,2}$/.test(t)) {
          const sl = slots[Number(t)];
          if (!sl) { note(`[karate] ${cfg.sheet} dòng ${r}: không thấy ô bốc thăm số ${t}`); return { t: '', p: `Ô ${t}`, bye: true }; }
          const o = { t: sl.t, slot: Number(t) };
          if (sl.p) o.p = sl.p; else o.bye = true;
          return o;
        }
        return parseAthlete(t);
      };
      const m = {
        id, ev, stage: 'KO', label: round, n, branch, a: mk(sides[0]), b: mk(sides[1]), src: `${cfg.sheet}!${r}`,
      };
      const sc = parseScore(txt(ws, h.res, r));
      if (sc && !m.a.bye && !m.b.bye) { m.sa = sc[0]; m.sb = sc[1]; m.st = 'done'; }
      if (isKarate) { m.date = E.date; m.time = E.time; m.end = E.end; m.venue = E.venue; }
      else {
        const [wd, t0, t1] = SESSION[cfg.grade];
        if (!week) week = 1;
        m.week = week; m.date = dateOf(week, wd); m.time = t0; m.end = t1; m.venue = E.venue; m.wd = wd;
        m.slot = 'Trong 2 tiết thể thao';
      }
      local.push(m);
    }
    E.branches[branch || '-'] = local.map(x => x.id);
    indMatches.push(...local);
    tables.push({ h, local, ev, branch, slots });
  });
  if (!cfg.legs && cfg.sport === 'caulong') remapByDrawing(ws, cfg, tables);
}

// ---------- đối chiếu sơ đồ nhánh: "(k)" trong bảng lịch = nút k của sơ đồ ----------
const D = require('./drawing.js');
function isEntrantText(v) { return classTokens(v).length > 0 || /^\d{1,2}\s*[-(]/.test(v); }
// "1 (6AOM:Nguyễn Đăng Khoa)", "2-2A4 Lê Tuấn Hưng", "7A04 Nguyễn Gia Huy" → {slot, t, p}
function entInfo(text) {
  let t = String(text).trim();
  let slot = null;
  let m = t.match(/^(\d{1,2})\s*\(\s*(.*?)\s*\)?\s*$/);          // số ô (lớp: tên)
  if (m) { slot = Number(m[1]); t = m[2]; }
  else if ((m = t.match(/^(\d{1,2})\s*-\s*(\d{1,2}\s?[A-Z].*)$/i))) { slot = Number(m[1]); t = m[2]; } // số ô - lớp tên
  const a = parseAthlete(t.replace(/[:;]/, ' '));
  return { slot, t: a.t, p: a.p ? fold(a.p) : '', bye: !!a.bye };
}
function remapByDrawing(ws, cfg, tables) {
  const firstTableCol = Math.min(...tables.map((t) => D.colIdx(t.h.week || t.h.round)));
  // gom các dòng có nút sơ đồ thành cụm (cách nhau ≥ 3 dòng trống)
  const maxRow = Math.max(...tables.map((t) => t.h.row)) + 70;
  const rowsWithNodes = [];
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 0; c < firstTableCol; c++) {
      const v = txt(ws, D.colName(c), r).replace(/\n/g, ' ').replace(/^'+/, '').trim();
      if (v && (/^\(\d{1,2}\)/.test(v) || isEntrantText(v))) { rowsWithNodes.push(r); break; }
    }
  }
  const clusters = [];
  for (const r of rowsWithNodes) { const last = clusters[clusters.length - 1]; if (last && r - last[1] <= 3) last[1] = r; else clusters.push([r, r]); }
  const own = tables.map(() => []);
  for (const cl of clusters) {
    let best = 0, bd = Infinity;
    tables.forEach((t, i) => { const hr = t.h.row; const d = hr < cl[0] ? cl[0] - hr : hr > cl[1] ? hr - cl[1] : 0; if (d < bd) { bd = d; best = i; } });
    own[best].push(cl);
  }
  tables.forEach((T, i) => {
    if (!own[i].length || !T.local.length) return;
    const r0 = Math.min(...own[i].map((c) => c[0])), r1 = Math.max(...own[i].map((c) => c[1]));
    const dr = D.readNodes(ws, r0, r1, 0, firstTableCol - 1, isEntrantText);
    const labels = dr.nodes.filter((n) => n.kind === 'label');
    if (!labels.length) return;
    const ents = dr.nodes.filter((n) => n.kind === 'ent').map((n) => ({ ...n, info: entInfo(n.text) }));
    const labelPos = Object.fromEntries(labels.map((L) => [L.n, L]));
    const ckCol = dr.ck ? dr.ck.c : null;
    // vị trí ô con của 1 bên trận: nút "(i)" hoặc ô tên VĐV / số ô bốc thăm
    const posOf = (side) => {
      if (!side) return null;
      if (side.rawRef) return labelPos[side.rawRef] || null;
      const hits = ents.filter((e) => (side.slot != null && e.info.slot != null) ? e.info.slot === side.slot
        : (side.t && e.info.t === side.t && (!side.p || !e.info.p || e.info.p === fold(side.p) || side.bye || e.info.bye)));
      if (!hits.length) return null;
      const sc = (e) => (side.p && e.info.p === fold(side.p) ? 3 : side.bye && e.info.bye ? 3 : !side.p && !e.info.p ? 2 : 1);
      return hits.sort((a, b) => sc(b) - sc(a) || a.c - b.c)[0];
    };
    // Gán mỗi trận vào nút nằm giữa 2 ô con (phía phải; nhánh đối xứng thì phía trái)
    const assigned = new Map(); // nút n -> trận
    const usedL = new Set();
    const pending = T.local.slice();
    for (let pass = 0; pass < 6 && pending.length; pass++) {
      for (let i = 0; i < pending.length; i++) {
        const m = pending[i];
        const pa = posOf(m.a), pb = posOf(m.b);
        if (!pa || !pb) continue;
        const mid = (pa.r + pb.r) / 2;
        const lo = Math.min(pa.r, pb.r) - 2, hi = Math.max(pa.r, pb.r) + 2;
        const right = ckCol != null && Math.min(pa.c, pb.c) > ckCol;
        const edge = right ? Math.min(pa.c, pb.c) : Math.max(pa.c, pb.c);
        const cand = labels.filter((L) => !usedL.has(L) && L.r >= lo && L.r <= hi && (right ? L.c < edge : L.c > edge) && L.n !== m.a.rawRef && L.n !== m.b.rawRef);
        if (!cand.length) continue;
        cand.sort((x, y) => (Math.abs(x.c - edge) * 100 + Math.abs(x.r - mid) * 10) - (Math.abs(y.c - edge) * 100 + Math.abs(y.r - mid) * 10));
        assigned.set(cand[0].n, m); usedL.add(cand[0]);
        pending.splice(i, 1); i--;
      }
    }
    // viết lại tham chiếu
    let changed = 0;
    for (const m of T.local) for (const k of ['a', 'b']) {
      const s = m[k];
      if (!s || !s.rawRef) continue;
      const target = assigned.get(s.rawRef);
      if (!target) { note(`[SƠ ĐỒ] ${cfg.sheet.trim()} (${T.ev}): không tìm thấy trận ứng với nút (${s.rawRef}) — giữ theo số trận`); continue; }
      const ref = 'W:' + target.id;
      if (ref !== s.ref) changed++;
      s.ref = ref;
    }
    for (const m of T.local) for (const k of ['a', 'b']) if (m[k]) delete m[k].rawRef;
    if (changed) note(`[SƠ ĐỒ] ${cfg.sheet.trim()} (${T.ev}${T.branch ? ' nhánh ' + T.branch : ''}): số trong ngoặc là số nút sơ đồ ≠ số trận → đã nối lại ${changed} tham chiếu theo sơ đồ`);
  });
}

IND_SHEETS.forEach(cfg => { try { readIndSheet(cfg); } catch (e) { note(`[LỖI] ${cfg.sheet}: ${e.message}`); } });

// ---------- Karate: thêm trận chung kết giữa 2 nhánh ----------
for (const E of Object.values(indEvents)) {
  if (E.sport !== 'karate') continue;
  const br = Object.keys(E.branches).filter(k => k !== '-');
  if (br.length === 2) {
    const last = b => E.branches[b][E.branches[b].length - 1];
    const f = { id: `${E.id}-CK`, ev: E.id, stage: 'KO', label: 'Chung kết', n: 99, branch: '', a: { ref: 'W:' + last('A') }, b: { ref: 'W:' + last('B') }, date: E.date, time: E.time, end: E.end, venue: E.venue, src: 'Nhất nhánh A gặp Nhất nhánh B' };
    indMatches.push(f);
  }
}

// ---------- kiểm tra cây nhánh đấu + gán vòng theo độ sâu ----------
const byId = Object.fromEntries(indMatches.map(m => [m.id, m]));
for (const E of Object.values(indEvents)) {
  const list = indMatches.filter(m => m.ev === E.id);
  const refCount = {};
  list.forEach(m => [m.a, m.b].forEach(s => {
    if (!s.ref) return;
    const ids = s.ref.startsWith('T:') ? s.ref.slice(2).split(',') : [s.ref.slice(2)];
    ids.forEach(id => { refCount[id] = (refCount[id] || 0) + 1; if (!byId[id]) note(`[NHÁNH] ${E.id}: trận ${m.id} tham chiếu trận không có (${id})`); });
  }));
  const roots = list.filter(m => !refCount[m.id]);
  // trận cuối (chung kết) = trận không ai tham chiếu và nằm cuối danh sách
  const legsEvent = list.some(m => (m.a.ref || '').startsWith('T:') || (m.b.ref || '').startsWith('T:'));
  if (!legsEvent && roots.length !== 1) note(`[NHÁNH] ${E.id}: có ${roots.length} trận không dẫn tới đâu: ${roots.map(m => m.id.split('-').pop()).join(', ')}`);
  list.forEach(m => { if (refCount[m.id] > 1 && !legsEvent) note(`[NHÁNH] ${E.id}: trận ${m.id.split('-').pop()} được tham chiếu ${refCount[m.id]} lần`); });
  // độ sâu tính từ chung kết
  const final = roots.length ? roots[roots.length - 1] : list[list.length - 1];
  if (!final) continue;
  E.final = final.id;
  const depth = {};
  const walk = (id, d) => { if (!byId[id] || depth[id] != null) return; depth[id] = d; const m = byId[id]; [m.a, m.b].forEach(s => { if (s.ref) (s.ref.startsWith('T:') ? s.ref.slice(2).split(',') : [s.ref.slice(2)]).forEach(x => walk(x, d + 1)); }); };
  walk(final.id, 0);
  list.forEach(m => {
    const d = depth[m.id];
    m.stage = d === 0 ? 'F' : d === 1 ? 'SF' : d === 2 ? 'QF' : 'R';
    if (!m.label || /^(Loại|LOẠI)$/i.test(m.label) || /Tứ kết|Bán kết|TỨ KẾT|BÁN KẾT|CK|CHUNG KẾT/i.test(m.label)) {
      m.label = d === 0 ? 'Chung kết' : d === 1 ? 'Bán kết' : d === 2 ? 'Tứ kết' : 'Vòng loại';
    }
  });
}

module.exports = { indEvents, indMatches, SESSION, KARATE_DAY, titleCase };

if (require.main === module) {
  const cnt = {};
  indMatches.forEach(m => { cnt[m.ev] = (cnt[m.ev] || 0) + 1; });
  console.log(Object.entries(cnt).map(([k, v]) => `${k}: ${v}`).join('\n'));
  console.log(X.report.filter(l => /caulong|karate|NHÁNH|LỖI/.test(l)).join('\n'));
}
