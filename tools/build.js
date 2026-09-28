// ============================================================
//  Gộp dữ liệu từ Excel → js/seed-data.js  (dữ liệu gốc của web)
//  Chạy: node tools/build.js "<thư mục OLYMPIC THỂ THAO 26.27>"
// ============================================================
const fs = require('fs');
const path = require('path');
const X = require('./extract.js');
const I = require('./extract-ind.js');
const { note, report, fold, txt, sheet } = X;

const LEVEL = g => (g <= 5 ? 'TH' : g <= 9 ? 'THCS' : 'THPT');
const WD_NAME = { 2: 'Thứ Hai', 3: 'Thứ Ba', 4: 'Thứ Tư', 5: 'Thứ Năm', 6: 'Thứ Sáu', 7: 'Thứ Bảy' };
const SPORT_NAME = { bongda: 'Bóng đá', bongro: 'Bóng rổ', keoco: 'Kéo co', caulong: 'Cầu lông', karate: 'Karate' };

// ---------------- sự kiện đồng đội ----------------
const events = {};
const matches = {};
const teamByEv = {};
X.matches.forEach(m => { (teamByEv[m.ev] = teamByEv[m.ev] || []).push(m); });

for (const [ev, groupsRaw] of Object.entries(X.GROUPS)) {
  const [sport, k] = ev.split('-');
  const grade = Number(k.slice(1));
  const rr = !!groupsRaw.RR;
  const groups = rr ? { A: groupsRaw.RR } : groupsRaw;
  const nG = Object.keys(groups).length;
  const format = rr ? 'RR' : nG === 2 ? 'SF' : 'QF';
  const list = (teamByEv[ev] || []).slice();
  const wds = [...new Set(list.map(m => m.wd))];
  // Hạng Ba: KO → 2 đội thua bán kết; vòng tròn → theo điều lệ (Bóng đá/Kéo co THPT: hạng 3 & 4 đồng hạng Ba; Bóng rổ: 1 đội hạng Ba)
  const bronze = format === 'RR' ? (sport === 'bongro' ? 1 : 2) : 2;
  events[ev] = {
    id: ev, sport, kind: 'team', level: LEVEL(grade), grade,
    name: `${SPORT_NAME[sport]} Khối ${grade}`, format, groups, bronze,
    days: wds.map(w => WD_NAME[w]).join(' · '),
  };
  // sắp xếp trận vòng bảng theo ngày/giờ; đánh id
  const g = list.filter(m => m.stage === 'G').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  // Mã trận vòng bảng cố định theo cặp đấu (không phụ thuộc thứ tự) để lần sau nạp lại Excel
  // các kết quả đã nhập trên máy chủ vẫn gắn đúng trận.
  const used = {};
  g.forEach((m) => {
    const pair = [m.a.t, m.b.t].sort((x, y) => x.localeCompare(y, 'vi', { numeric: true })).join('-');
    let id = `${ev}-${rr ? 'A' : m.group}-${pair}`;
    if (used[id]) { used[id]++; id += '-' + used[id]; } else used[id] = 1;
    const out = { id, ev, stage: 'G', group: rr ? 'A' : m.group, date: m.date, time: m.time, end: m.end, venue: m.venue, a: m.a, b: m.b, week: m.week, src: m.src };
    if (m.slot) out.slot = m.slot;
    if (m.st) { out.st = m.st; out.sa = m.sa; out.sb = m.sb; }
    matches[id] = out;
  });
  list.filter(m => m.stage !== 'G').forEach(m => {
    const id = `${ev}-${m.ko}`;
    const conv = s => (s.ref && s.ref.startsWith('W:') ? { ref: `W:${ev}-${s.ref.slice(2)}` } : s);
    const out = { id, ev, stage: m.stage, label: m.label, date: m.date, time: m.time, end: m.end, venue: m.venue, a: conv(m.a), b: conv(m.b), week: m.week, src: m.src };
    if (m.slot) out.slot = m.slot;
    if (m.note) out.note = m.note;
    matches[id] = out;
  });
}

// ---------------- sự kiện cá nhân ----------------
for (const E of Object.values(I.indEvents)) {
  const list = I.indMatches.filter(m => m.ev === E.id);
  events[E.id] = {
    id: E.id, sport: E.sport, kind: 'ind', level: LEVEL(E.grade), grade: E.grade, cat: E.cat, catName: E.catName,
    name: `${SPORT_NAME[E.sport]} ${E.catName} – Khối ${E.grade}`, format: 'KO', bronze: 2, final: E.final,
    venue: E.venue, days: E.sport === 'karate' ? '' : WD_NAME[I.SESSION[E.grade][0]],
  };
  list.forEach(m => {
    const out = { id: m.id, ev: m.ev, stage: m.stage, label: m.label, n: m.n, date: m.date, time: m.time, end: m.end, venue: m.venue, a: m.a, b: m.b, src: m.src };
    if (m.branch) out.branch = m.branch;
    if (m.week) out.week = m.week;
    if (m.slot) out.slot = m.slot;
    if (m.st) { out.st = m.st; out.sa = m.sa; out.sb = m.sb; }
    matches[m.id] = out;
  });
}

// ---------------- điều lệ ----------------
const RULE_FILES = [
  { sport: 'bongro', levels: ['TH', 'THCS', 'THPT'], file: 'ĐIỀU LỆ CÁC MÔN/Điều lệ Bóng Rổ LC.xlsx', sheet: 'Điều Lệ ' },
  { sport: 'bongda', levels: ['TH'], file: 'ĐIỀU LỆ CÁC MÔN/Điều lệ môn Bóng đá TiH.xlsx', sheet: 'Điều lệ giải bóng đá ' },
  { sport: 'bongda', levels: ['THCS'], file: 'ĐIỀU LỆ CÁC MÔN/Điều lệ Bóng đá THCS - Olympic 2026-2027.xlsx', sheet: 'Điều Lệ BĐ THCS', fixTitle: ['TIỂU HỌC', 'THCS'] },
  { sport: 'bongda', levels: ['THPT'], file: 'ĐIỀU LỆ CÁC MÔN/Điều lệ Bóng đá THPT  Olympic 2026-2027.xlsx', sheet: 'Điều lệ THPT ' },
  { sport: 'keoco', levels: ['TH'], file: 'ĐIỀU LỆ CÁC MÔN/Điều Lệ Kéo co/Điều lệ kéo co Tiểu Học.xlsx', sheet: 'Tiểu Học ' },
  { sport: 'keoco', levels: ['THCS'], file: 'ĐIỀU LỆ CÁC MÔN/Điều Lệ Kéo co/Điều lệ kéo co THCS 2026-2027.xlsx', sheet: 'ĐIỀU LỆ THCS - KÉO CO', skipRows: [16] },
  { sport: 'keoco', levels: ['THPT'], file: 'ĐIỀU LỆ CÁC MÔN/Điều Lệ Kéo co/Điều lệ kéo co THPT.xlsx', sheet: 'Điều lệ kéo co THPT' },
  { sport: 'caulong', levels: ['TH'], file: 'ĐIỀU LỆ CÁC MÔN/CẦU LÔNG/ĐIỀU LỆ MÔN CẦU LÔNG CẤP TIỂU HỌC.xlsx', sheet: 'ĐIỀU LỆ' },
  { sport: 'caulong', levels: ['THCS'], file: 'ĐIỀU LỆ CÁC MÔN/CẦU LÔNG/ĐIỀU LỆ MÔN CẦU LÔNG CẤP THCS.xlsx', sheet: 'CẤP THCS' },
  { sport: 'caulong', levels: ['THPT'], file: 'ĐIỀU LỆ CÁC MÔN/CẦU LÔNG/ĐIỀU LỆ MÔN CẦU LÔNG CẤP THPT.xlsx', sheet: 'ĐIỀU LỆ' },
  { sport: 'karate', levels: ['TH', 'THCS', 'THPT'], file: 'ĐIỀU LỆ CÁC MÔN/VÕ THUẬT-KARATE-DO/ĐIỀU LỆ MÔN KARATE  CÁC CẤP.xlsx', sheet: 'ĐIỀU LỆ' },
];
function readRules(rf) {
  const ws = sheet(rf.file, rf.sheet);
  const R = X.XLSX.utils.decode_range(ws['!ref']);
  const lines = [];
  let author = '', dated = '';
  for (let r = R.s.r + 1; r <= Math.min(R.e.r + 1, 200); r++) {
    if (rf.skipRows && rf.skipRows.includes(r)) continue;
    const cells = [];
    for (let c = 0; c <= Math.min(R.e.c, 26); c++) {
      const v = txt(ws, X.XLSX.utils.encode_col(c), r);
      if (v) cells.push(v);
    }
    if (!cells.length) continue;
    const joined = cells.join('\n').trim();
    if (/^Hà Nội,?\s*Ngày|^Ngày \d/i.test(joined.replace(/\s+/g, ' ').trim())) {
      const d = cells.map(s => s.trim()).filter(s => /2026/.test(s)).pop();
      if (d) dated = d.replace(/\s+/g, ' ').trim();
      if (/NGƯỜI LẬP/i.test(joined)) author = joined.split('\n').map(s => s.trim()).filter(Boolean).pop();
      continue;
    }
    if (/^\s*Người lập\s*$/i.test(joined)) continue;
    if (lines.length && /CHỈ CÓ BAN TỔ CHỨC/i.test(lines[lines.length - 1]) && cells.length <= 2 && joined.length < 60) {
      author = cells.map(s => s.trim()).filter(Boolean).pop(); continue;
    }
    if (lines.some(l => /CHỈ CÓ BAN TỔ CHỨC/i.test(l)) && joined.length < 60) { author = cells.map(s => s.trim()).filter(Boolean).pop(); continue; }
    lines.push(joined);
  }
  // dòng cuối chỉ là tên người lập (không có dấu câu/số) → tách ra
  while (lines.length && !author && /^[A-Za-zÀ-ỹĐđ .]{5,40}$/.test(lines[lines.length - 1].trim()) && !/[.:]$/.test(lines[lines.length - 1].trim())) author = lines.pop().trim();
  let title = lines.shift().replace(/\s+\n/g, '\n').split('\n').map(s => s.trim()).filter(Boolean).join('\n');
  if (rf.fixTitle) { title = title.replace(rf.fixTitle[0], rf.fixTitle[1]); note(`[ĐIỀU LỆ] File "${path.basename(rf.file)}" có tiêu đề ghi "${rf.fixTitle[0]}" nhưng nội dung là cấp ${rf.fixTitle[1]} — web hiển thị tiêu đề cấp ${rf.fixTitle[1]}.`); }
  // tiêu đề nhiều dòng trong 1 file (Kéo co TH) → nối
  while (lines.length && /^(OLYMPIC|NĂM HỌC)/i.test(lines[0])) title += '\n' + lines.shift();
  const body = lines.map(s => s.split('\n').map(x => x.replace(/\s+$/, '').replace(/^\s{2,}/, ' ')).join('\n')).join('\n');
  return { title, body, author: (author || '').replace(/\s+/g, ' ').trim(), dated };
}
const rules = {};
for (const rf of RULE_FILES) {
  try {
    const r = readRules(rf);
    rf.levels.forEach(lv => { rules[`${rf.sport}-${lv}`] = { sport: rf.sport, level: lv, ...r, shared: rf.levels.length > 1 }; });
  } catch (e) { note(`[ĐIỀU LỆ] ${rf.file}: ${e.message}`); }
}

// ---------------- thông tin chung (quy định đăng ký, lưu ý, người phụ trách) ----------------
function readGeneral(file, sheetName) {
  const ws = sheet(file, sheetName);
  const out = {};
  for (let r = 1; r <= 20; r++) {
    const b = fold(txt(ws, 'B', r));
    const c = txt(ws, 'C', r);
    if (/DANG KI|DANG KY/.test(b)) out.register = c;
    if (/LUU Y/.test(b)) out.important = c;
    if (!b && c && /Xin phép|đổi lịch/i.test(c)) out.extra = c;
  }
  return out;
}
const general = {
  TH: readGeneral('OLYMPIC Tiểu học 2026-2027.xlsx', 'Tiểu học'),
  THCS: readGeneral('OLYMPIC THCS & THPT 2026- 2027.xlsx', 'THCS'),
  THPT: readGeneral('OLYMPIC THCS & THPT 2026- 2027.xlsx', 'THPT'),
};

// ---------------- ghi file ----------------
const meta = {
  title: 'Olympic Thể thao học sinh lần thứ IV',
  year: '2026 – 2027',
  slogan: 'ONE TEAM – ONE SPIRIT',
  school: 'Trường Tiểu học, THCS & THPT Ngôi Sao Hoàng Mai',
  start: '2026-09-28',
  end: '2026-11-20',
  week1: '2026-09-28',
  contacts: [
    { sport: 'bongda', name: 'Cô Lê Thị Oanh', phone: '0928981968' },
    { sport: 'bongro', name: 'Thầy Đạo', phone: '0986098640' },
    { sport: 'keoco', name: 'Thầy Bùi Quang Bình', phone: '0868171012' },
    { sport: 'caulong', name: 'Cô Mai Thị An Nhi', phone: '0372098094' },
    { sport: 'karate', name: 'Thầy Bùi Quang Bình', phone: '0868171012' },
  ],
};
const seed = {
  version: new Date().toISOString(),
  meta, events, matches, rules, general,
  sourceNotes: report.slice(),
};
const OUT = X.OUT;
const js = '// Dữ liệu gốc Olympic 2026–2027 — SINH TỰ ĐỘNG bởi tools/build.js từ các file Excel của Tổ Thể thao.\n' +
  '// Đừng sửa tay: cập nhật kết quả/lịch trên trang Quản trị; muốn nạp lại từ Excel thì chạy lại tools/build.js.\n' +
  'export const SEED = ' + JSON.stringify(seed) + ';\n';
fs.writeFileSync(OUT, js);
fs.writeFileSync(X.REPORT, report.join('\n') + '\n');
const cnt = {};
Object.values(matches).forEach(m => { const s = m.ev.split('-')[0]; cnt[s] = (cnt[s] || 0) + 1; });
console.log('Đã ghi', OUT, (js.length / 1024).toFixed(0) + ' KB');
console.log('Nội dung thi đấu:', Object.keys(events).length, '| Trận:', Object.keys(matches).length, cnt);
console.log('Điều lệ:', Object.keys(rules).join(', '));
console.log('Ghi chú dữ liệu nguồn:', report.length, 'dòng →', X.REPORT);
