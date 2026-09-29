// ============================================================
//  Danh sách học sinh ĐĂNG KÝ thi đấu (3 file Excel TH / THCS / THPT)
//  → js/roster-data.js (chỉ Lớp · Họ tên · Giới tính)
//
//  node tools/extract-roster.js <file TH.xlsx> <file THCS.xlsx> <file THPT.xlsx>
//
//  ⚠️ File gốc có Mã HS, ngày sinh, SĐT bố mẹ — KHÔNG đưa vào web, KHÔNG commit file Excel.
//  Mỗi sheet = 1 khối; mỗi dòng = 1 học sinh; ô môn có "1" (hoặc "1 Đơn", "X"…) = đăng ký.
//  Dòng tổng số của lớp (không có tên, số 2..18) bị bỏ qua.
//  Môn đồng đội → khóa '<môn>-k<khối>|<lớp>' (trùng mã nội dung, vd bongda-k7|7A05)
//  Môn cá nhân  → khóa '<môn>-k<khối>|<lớp>' (danh sách đăng ký của lớp, chưa chia nội dung)
// ============================================================
const path = require('path');
const fs = require('fs');
const XLSX = require(require.resolve('xlsx', { paths: [__dirname, process.cwd()] }));

const ROOT = path.join(__dirname, '..');
const files = process.argv.slice(2);
if (!files.length) { console.error('Cách dùng: node tools/extract-roster.js <file.xlsx> [file2.xlsx …]'); process.exit(1); }

// Lớp hợp lệ lấy từ lịch gốc
const seedSrc = fs.readFileSync(path.join(ROOT, 'js/seed-data.js'), 'utf8');
const SEED = JSON.parse(seedSrc.slice(seedSrc.indexOf('{'), seedSrc.lastIndexOf('}') + 1));
const CLASSES = new Set();
Object.values(SEED.events).forEach((e) => e.groups && Object.values(e.groups).flat().forEach((c) => CLASSES.add(c)));
Object.values(SEED.matches).forEach((m) => ['a', 'b'].forEach((k) => m[k] && m[k].t && CLASSES.add(m[k].t)));

const SPORT_COL = [
  [/BÓNG\s*RỔ/i, 'bongro'], [/BÓNG\s*ĐÁ/i, 'bongda'], [/KÉO\s*CO/i, 'keoco'], [/CẦU\s*LÔNG/i, 'caulong'], [/KARATE|VÕ\s*THUẬT/i, 'karate'],
];
const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const normCls = (v) => clean(v).toUpperCase().replace(/\s+/g, '').replace(/^LỚP/, '').replace(/^(\d{1,2})([A-Z])O(?=\d|[HM]?$)/, '$1$20');
const isName = (v) => { const t = clean(v); return t.split(' ').length >= 2 && /^[A-Za-zÀ-ỹĐđ .'-]+$/.test(t) && !/^(lớp|stt|họ)/i.test(t); };
// "NGUYỄN THỤC ANH" → "Nguyễn Thục Anh"; giữ nguyên tên đã viết hoa đầu từ
const titleCase = (s) => s === s.toUpperCase() ? s.toLocaleLowerCase('vi').replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('vi')) : s;
const gender = (v) => { const t = clean(v).toLocaleLowerCase('vi'); return t.startsWith('nữ') || t === 'nu' ? 'Nữ' : t.startsWith('nam') ? 'Nam' : ''; };
// Ô đăng ký: "1", "1`", "X", "1 Đơn", "1 (đôi nam)"… = có; trống/0 = không; số ≥ 2 = dòng tổng (lỗi) → báo
function mark(v, sp) {
  const t = clean(v);
  if (!t || t === '0') return { on: false };
  if (/^x$/i.test(t)) return { on: true };
  if (!/^\d/.test(t) && !/đơn|đôi/i.test(t)) return { on: false, bad: t }; // chữ lạ trong ô môn (ghi chú lọt cột)
  const m = t.match(/^(\d+)\D*(.*)$/);
  if (m) { const n = Number(m[1]); if (n === 1) return { on: true, note: m[2].replace(/[()]/g, '').trim() };
    if (n === 2 && sp === 'caulong') return { on: true, note: '2 nội dung' }; // cầu lông: đơn + đôi
    return { on: false, bad: t }; }
  return { on: true, note: t };
}

const rosters = {};
const report = [];
let students = 0;
for (const file of files) {
  const wb = XLSX.readFile(file);
  for (const sn of wb.SheetNames) {
    const grade = Number((sn.match(/\d+/) || [])[0]);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: false });
    const hi = rows.findIndex((r) => r.some((c) => /BÓNG/i.test(c)));
    if (!grade || hi < 0) continue;
    const H = rows[hi].map(clean);
    const sportCols = [];
    H.forEach((h, i) => { const s = SPORT_COL.find(([re]) => re.test(h)); if (s) sportCols.push([i, s[1]]); });
    const gCol = H.findIndex((h) => /giới tính/i.test(h));
    const body = rows.slice(hi + 1);
    // cột lớp / cột tên: dò theo nội dung (tiêu đề một số sheet bị lệch)
    const score = (i, fn) => body.reduce((n, r) => n + (fn(r[i]) ? 1 : 0), 0);
    const cols = [...Array(Math.min(H.length, 8)).keys()];
    const cCol = cols.reduce((b, i) => (score(i, (v) => CLASSES.has(normCls(v))) > score(b, (v) => CLASSES.has(normCls(v))) ? i : b), 0);
    const nCol = cols.filter((i) => i !== cCol).reduce((b, i) => (score(i, isName) > score(b, isName) ? i : b), cols.find((i) => i !== cCol));
    let nSheet = 0;
    body.forEach((r, ri) => {
      let cls = normCls(r[cCol]);
      let name = clean(r[nCol]);
      if (!isName(name)) return;
      // Ghi chú trên dòng: chuyển trường / nghỉ học → bỏ; chuyển sang lớp X → tính cho lớp X; "đổi thành <tên>" → thay tên
      const note = r.map(clean).filter((c) => /chuyển|nghỉ học|đổi thành|thôi học/i.test(c)).join(' · ');
      if (note) {
        const to = note.match(/(?:chuyển\s*(?:sang|lớp)|sang)\s*(\d{1,2}[A-Z][A-Z0-9]*)/i);
        const rename = note.match(/đổi thành\s+(.+)$/i);
        if (rename) { report.push(`[ĐỔI TÊN] ${sn} dòng ${hi + ri + 2}: ${name} → ${clean(rename[1])} (${cls}) — "${note}"`); name = clean(rename[1]); }
        else if (to && CLASSES.has(normCls(to[1]))) { report.push(`[CHUYỂN LỚP] ${sn} dòng ${hi + ri + 2}: ${name} ${cls} → ${normCls(to[1])} — "${note}"`); cls = normCls(to[1]); }
        else { report.push(`[BỎ QUA] ${sn} dòng ${hi + ri + 2}: ${name} (${cls}) — "${note}"`); return; }
      }
      if (!CLASSES.has(cls)) { if (cls) report.push(`[LỚP LẠ] ${sn} dòng ${hi + ri + 2}: "${clean(r[cCol])}" — ${name}`); return; }
      nSheet++;
      const g = gCol >= 0 ? gender(r[gCol]) : '';
      for (const [i, sp] of sportCols) {
        const k = mark(r[i], sp);
        if (k.bad) { report.push(`[KIỂM TRA] ${sn} dòng ${hi + ri + 2}: ${name} (${cls}) ô ${sp} ghi "${k.bad}" — ${/^\d/.test(k.bad) ? 'có vẻ là số tổng của lớp' : 'không phải đánh dấu đăng ký'}, KHÔNG tính`); continue; }
        if (!k.on) continue;
        const key = `${sp}-k${grade}|${cls}`;
        const item = { n: titleCase(name) };
        if (g) item.g = g;
        if (k.note) item.note = k.note.replace(/\s*,\s*/g, ', ');
        ((rosters[key] ||= { list: [] }).list).push(item);
      }
    });
    students += nSheet;
    console.log(`${sn}: ${nSheet} học sinh`);
  }
}
const keys = Object.keys(rosters).sort();
const out = {};
keys.forEach((k) => { out[k] = rosters[k]; });
const total = keys.reduce((n, k) => n + out[k].list.length, 0);
fs.writeFileSync(path.join(ROOT, 'js/roster-data.js'),
  `// Sinh tự động bởi tools/extract-roster.js từ file đăng ký Olympic 26.27 — đừng sửa tay.\n// Chỉ gồm Lớp · Họ tên · Giới tính. Ban tổ chức sửa danh sách trong trang Quản trị → Danh sách VĐV.\nexport const ROSTERS = ${JSON.stringify(out)};\n`);
fs.writeFileSync(path.join(__dirname, 'roster-report.txt'), report.join('\n') + '\n');
console.log(`\n${students} học sinh · ${total} lượt đăng ký · ${keys.length} danh sách (môn × lớp) · ${report.length} ghi chú → tools/roster-report.txt`);
