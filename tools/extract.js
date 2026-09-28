// ============================================================
//  Chuyển các file Excel lịch thi đấu Olympic → js/seed-data.js
//  Chạy:  node tools/extract.js "<thư mục OLYMPIC THỂ THAO 26.27>"
//  Cần thư viện 'xlsx' (SheetJS): npm i xlsx  (chỉ dùng cho công cụ này,
//  web không cần build).
//  Kết quả: js/seed-data.js (dữ liệu gốc) + tools/extract-report.txt
//  (các chỗ lệch/thiếu trong file nguồn để Tổ thể thao kiểm tra lại).
// ============================================================
const path = require('path');
const fs = require('fs');
let XLSX;
try { XLSX = require('xlsx'); }
catch (e) { XLSX = require('C:/Users/Administrator/Downloads/DKAN/node_modules/xlsx'); }

const SRC = process.argv[2] || 'C:/Users/Administrator/Downloads/OneDrive_2026-09-28 (1)/OLYMPIC THỂ THAO 26.27';
const OUT = path.join(__dirname, '..', 'js', 'seed-data.js');
const REPORT = path.join(__dirname, 'extract-report.txt');
const report = [];
const note = (...a) => report.push(a.join(' '));

// Thứ Hai tuần 1 của giải
const WEEK1 = Date.UTC(2026, 8, 28);
const DAY = 86400000;
const isoDate = ms => new Date(ms).toISOString().slice(0, 10);
const dateOf = (week, wd) => isoDate(WEEK1 + ((week - 1) * 7 + (wd - 2)) * DAY);

// ---------- tiện ích ----------
const wbCache = {};
function sheet(file, name) {
  if (!wbCache[file]) wbCache[file] = XLSX.readFile(path.join(SRC, file));
  const ws = wbCache[file].Sheets[name];
  if (!ws) throw new Error(`Không thấy sheet "${name}" trong ${file}`);
  return ws;
}
function txt(ws, col, row) {
  const c = ws[col + row];
  if (!c || c.v == null) return '';
  return String(c.v).replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();
}
// Bỏ dấu tiếng Việt + viết hoa, để so khớp chữ cho chắc
function fold(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/\s+/g, ' ').trim();
}
const pad2 = n => String(n).padStart(2, '0');

// ---------- mã lớp ----------
// Danh sách lớp chuẩn lấy từ các bảng bốc thăm; mọi mã lớp đọc được đều phải khớp danh sách này.
const CLASSES = new Set();
const ALIAS = { '10S0': '10S', '11N0': '11N', '11S0': '11S', '11T0': '11T' };
function normClass(raw) {
  let t = String(raw || '').toUpperCase().replace(/\s+/g, '').replace(/[().]/g, '');
  // chữ O viết nhầm thay số 0: 6AOM→6A0M, 10TO1→10T01, 7BO→7B0, 9IO→9I0
  t = t.replace(/^(\d{1,2})([A-Z])O(?=\d|[HM]?$)/, '$1$20');
  if (ALIAS[t]) t = ALIAS[t];
  return t;
}
const CLASS_RE = /\b(\d{1,2}\s?[A-Z]{1,2}[0-9O]{0,2}[HM]?)\b/;
function isClass(s) { return CLASSES.has(normClass(s)); }

// ---------- thời gian ----------
function parseTime(s) {
  const t = String(s || '').replace(/\n/g, ' ');
  const m = t.match(/(\d{1,2})\s*[:hH]\s*(\d{2})\s*[-–]\s*(\d{1,2})\s*[:hH\-]\s*(\d{2})/);
  const out = {};
  if (m) { out.time = pad2(m[1]) + ':' + m[2]; out.end = pad2(m[3]) + ':' + m[4]; }
  const tm = t.match(/Tiết\s*([\d]+(?:\s*\+\s*\d+)?)/i);
  if (tm) out.slot = 'Tiết ' + tm[1].replace(/\s+/g, '');
  return out;
}
function parseScore(s) {
  const m = String(s || '').match(/^\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\s*$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
function weekFromText(s) {
  const t = String(s || '');
  const m = t.match(/Tuần\s*(\d+)(?!\s*\/)/i);
  if (m) return Number(m[1]);
  const d = t.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (d) {
    const ms = Date.UTC(2026, Number(d[2]) - 1, Number(d[1]));
    const w = Math.floor((ms - WEEK1) / (7 * DAY)) + 1;
    if (w >= 1 && w <= 10) return w;
  }
  return null;
}

// ============================================================
//  CÁC MÔN ĐỒNG ĐỘI — bảng đấu (chép từ các sheet BXH / bảng bốc thăm)
// ============================================================
const G = s => Object.fromEntries(s.split('|').map(p => { const [k, v] = p.split(':'); return [k, v.split(',')]; }));
const GROUPS = {
  // ----- BÓNG RỔ (sheet BXH K1..K12) -----
  'bongro-k1': G('A:1A2,1A4,1B01,1A1|B:1A5,1A6,1B0,1A3|C:1A11,1A14,1A10,1A9|D:1A12,1A13,1A8,1A7'),
  'bongro-k2': G('A:2A6,2B0,2A12,2A11|B:2A13,2A4,2A9,2A10|C:2A5,2A1,2A7,2A2|D:2A8,2A3,2A0'),
  'bongro-k3': G('A:3A0,3A8,3A9,3A4|B:3B0,3A10,3A6|C:3A2,3A11,3A7|D:3A1,3A3,3A5'),
  'bongro-k4': G('A:4A9,4A10,4A7|B:4A4,4A5,4A1|C:4A8,4A6,4A0|D:4B0,4A3,4A2'),
  'bongro-k5': G('A:5A5,5A8,5A6,5A4,5A0|B:5A7,5A1,5B0,5A3,5A2'),
  'bongro-k6': G('A:6A06,6A05,6B02,6A0M|B:6A02,6B05,6A01,6B03|C:6A04,6A0H,6A03|D:6B0,6B01,6B04'),
  'bongro-k7': G('A:7A05,7B04,7B02,7B03|B:7A0,7B0,7B01|C:7A03,7A04,7B05|D:7A01,7A06,7A02'),
  'bongro-k8': G('A:8B03,8B0,8B02|B:8B04,8B01,8I0|C:8A0,8A02,8A03|D:8A01,8A05,8A04'),
  'bongro-k9': G('A:9A01,9B04,9B02,9B01|B:9A03,9A04,9I0,9A02|C:9B0,9B03,9A0'),
  'bongro-k10': G('RR:10N01,10L01,10S,10T01,10N0,10L0,10T0'),
  'bongro-k11': G('RR:11L01,11L0,11N,11S,11T'),
  'bongro-k12': G('A:12S01,12T0,12L0,12L02,12S0|B:12T01,12N0,12N01,12L01'),
  // ----- BÓNG ĐÁ (bảng xếp hạng trong từng sheet lịch) -----
  'bongda-k1': G('A:1A2,1A3,1A5,1A4|B:1A6,1A1,1B0,1B01|C:1A14,1A12,1A7,1A11|D:1A13,1A10,1A8,1A9'),
  'bongda-k2': G('A:2A3,2A8,2A13,2A7|B:2A12,2A5,2A10,2A2|C:2A0,2A11,2A4,2A1|D:2A9,2B0,2A6'),
  'bongda-k3': G('A:3A4,3A6,3A11,3B0|B:3A9,3A7,3A0|C:3A5,3A1,3A8|D:3A10,3A3,3A2'),
  'bongda-k4': G('A:4A7,4A4,4A5|B:4A6,4A8,4A3|C:4A1,4A9,4A2|D:4B0,4A10,4A0'),
  'bongda-k5': G('A:5A2,5A1,5A7,5A0,5A8|B:5A5,5A3,5B0,5A6,5A4'),
  'bongda-k6': G('A:6A05,6B04,6A04,6A0H|B:6A01,6A0M,6A06,6B01|C:6A03,6B02,6B05|D:6B03,6A02,6B0'),
  'bongda-k7': G('A:7B0,7B05,7A03,7A01|B:7B02,7A06,7A0|C:7A02,7A05,7B01|D:7B03,7A04,7B04'),
  'bongda-k8': G('A:8A0,8A04,8A01|B:8A02,8B0,8A05|C:8B01,8I0,8B03|D:8B04,8B02,8A03'),
  'bongda-k9': G('A:9B02,9A0,9A04,9B01|B:9A02,9B0,9I0,9B03|C:9A03,9B04,9A01'),
  'bongda-k10': G('RR:10S,10L0,10T01,10N0,10N01,10T0,10L01'),
  'bongda-k11': G('RR:11T,11L01,11L0,11N,11S'),
  'bongda-k12': G('A:12T01,12N01,12N0,12T0,12L01|B:12L02,12S01,12S0,12L0'),
  // ----- KÉO CO (bảng bốc thăm) -----
  'keoco-k1': G('A:1A5,1A3,1A6,1B0|B:1B01,1A1,1A2,1A4|C:1A10,1A7,1A13,1A14|D:1A9,1A11,1A8,1A12'),
  'keoco-k2': G('A:2A6,2A2,2A8,2B0|B:2A11,2A10,2A0,2A4|C:2A3,2A1,2A13,2A5|D:2A9,2A12,2A7'),
  'keoco-k3': G('A:3A1,3A2,3A3,3A10|B:3A4,3A7,3A5|C:3A0,3A8,3A11|D:3B0,3A9,3A6'),
  'keoco-k4': G('A:4A0,4A3,4A8|B:4A10,4A4,4A1|C:4A2,4A6,4A9|D:4B0,4A5,4A7'),
  'keoco-k5': G('A:5A0,5A1,5A6,5A8,5B0|B:5A3,5A4,5A5,5A7,5A2'),
  'keoco-k6': G('A:6B03,6A01,6A05,6A06|B:6B04,6A0M,6B0,6B01|C:6B05,6A03,6A0H|D:6A04,6A02,6B02'),
  'keoco-k7': G('A:7B04,7B0,7A05,7A0|B:7B02,7B05,7A01|C:7A02,7A06,7B03|D:7A03,7A04,7B01'),
  'keoco-k8': G('A:8A03,8B01,8A0|B:8A02,8A01,8B03|C:8A05,8B04,8B0|D:8B02,8A04,8I0'),
  'keoco-k9': G('A:9B03,9B04,9A0,9I0|B:9A01,9B01,9B0,9A02|C:9A03,9A04,9B02'),
  'keoco-k10': G('RR:10L0,10L01,10T0,10T01,10S,10N01,10N0'),
  'keoco-k11': G('RR:11T,11N,11L0,11L01,11S'),
  'keoco-k12': G('A:12N0,12L01,12N01,12L02,12L0|B:12S01,12T0,12S0,12T01'),
};
for (const ev of Object.values(GROUPS)) for (const list of Object.values(ev)) list.forEach(c => CLASSES.add(c));

// ============================================================
//  CẤU HÌNH TỪNG SHEET LỊCH (cột nào là đội / kết quả / sân)
// ============================================================
const F_BR = 'LỊCH THI ĐẤU/LỊCH THI ĐẤU BÓNG RỔ LC.xlsx';
const F_BD_TH = 'LỊCH THI ĐẤU/LỊCH THI ĐẤU MÔN BÓNG ĐÁ TIỂU HỌC.xlsx';
const F_BD_THPT = 'LỊCH THI ĐẤU/LỊCH THI ĐẤU MÔN BÓNG ĐÁ THPT.xlsx';
const F_BD_THCS = 'LỊCH THI ĐẤU/LTĐ MÔN BÓNG ĐÁ THCS/LTĐ SÁNG THỨ 2,3,5,6.xlsx';
const F_KC = 'LỊCH THI ĐẤU/LTĐ-VÕ THUẬT-KARATE-DO - KÉO CO/LTĐ MÔN KÉO CO/';

// Sân: tên hiển thị
const V_BR_TH = 'Sân bóng rổ Tiểu học', V_BR_TR = 'Sân bóng rổ Trung học';
const V_BD_TH = 'Sân bóng đá Tiểu học (5 người)', V_BD_THCS = 'Sân bóng đá THCS (7 người)';
const brVenue = v => /trung/i.test(fold(v)) || /TRUNG/.test(fold(v)) ? V_BR_TR : V_BR_TH;
const bdVenue = v => /THCS/.test(fold(v)) ? V_BD_THCS : V_BD_TH;
const AB = (ab, r, v) => ({ ab, r, v });
const PAIR = (a, b, r, v) => ({ a, b, r, v });

const TEAM_SHEETS = [
  // ---------------- BÓNG RỔ ----------------
  { sport: 'bongro', grade: 1, file: F_BR, sheet: 'bản chuẩn k1,ct2', wd: 2, rows: [3, 14], week: 'B', stt: 'A', time: 'C', courts: [PAIR('D', 'E', 'F', 'G'), PAIR('H', 'I', 'J', 'K')], venue: () => V_BR_TH },
  { sport: 'bongro', grade: 1, file: F_BR, sheet: 'bản chuẩn k1,ct3', wd: 3, rows: [4, 15], week: 'B', stt: 'A', time: 'C', courts: [PAIR('D', 'E', 'F', 'G'), PAIR('H', 'I', 'J', 'K')], venue: () => V_BR_TH },
  { sport: 'bongro', grade: 2, file: F_BR, sheet: 'bản chuẩn k2,ct4', wd: 4, rows: [3, 16], week: 'A', time: 'C', courts: [AB('D', 'E', V_BR_TH), AB('F', 'G', V_BR_TH), AB('H', 'I', V_BR_TR)], venue: v => v },
  { sport: 'bongro', grade: 3, file: F_BR, sheet: 'bản chuẩn k3,st4', wd: 4, rows: [3, 15], week: 'B', stt: 'A', time: 'C', courts: [PAIR('D', 'E', 'F', 'G'), PAIR('H', 'I', 'J', 'K')], venue: () => V_BR_TH },
  { sport: 'bongro', grade: 4, file: F_BR, sheet: 'bản chuẩn k4,st2', wd: 2, rows: [3, 13], week: 'B', stt: 'A', time: 'C', courts: [PAIR('D', 'E', 'F', 'G'), PAIR('H', 'I', 'J', 'K')], venue: () => V_BR_TH },
  { sport: 'bongro', grade: 5, file: F_BR, sheet: 'bản chuẩn k5,ct5', wd: 5, rows: [3, 16], week: 'B', stt: 'A', time: 'C', courts: [PAIR('D', 'E', 'F', 'G'), PAIR('H', 'I', 'J', 'K')], venue: () => V_BR_TH },
  { sport: 'bongro', grade: 6, file: F_BR, sheet: 'bản chuẩn k6', wd: 6, rows: [3, 14], week: 'B', stt: 'A', time: 'D', courts: [AB('E', 'F', 'G'), AB('H', 'I', 'J'), AB('K', 'L', 'M')], venue: () => V_BR_TR },
  { sport: 'bongro', grade: 7, file: F_BR, sheet: 'bản chuẩn k7', wd: 2, rows: [3, 14], week: 'B', stt: 'A', time: 'D', courts: [AB('E', 'F', 'G'), AB('H', 'I', 'J'), AB('K', 'L', 'M')], venue: () => V_BR_TR },
  { sport: 'bongro', grade: 8, file: F_BR, sheet: 'bản chuẩn k8', wd: 3, rows: [3, 14], week: 'B', stt: 'A', time: 'C', courts: [AB('D', 'E', 'F'), AB('G', 'H', 'I')], venue: () => V_BR_TR },
  { sport: 'bongro', grade: 9, file: F_BR, sheet: 'bản chuẩn k9', wd: 5, rows: [3, 14], week: 'A', time: 'B', courts: [AB('C', 'D', 'E'), AB('F', 'G', 'H'), AB('I', 'J', 'K')], venue: () => V_BR_TR },
  { sport: 'bongro', grade: 10, file: F_BR, sheet: 'bản chuẩn k10,11', wd: 6, rows: [4, 19], week: 'B', stt: 'A', time: 'C', courts: [AB('D', 'E', 'F'), AB('G', 'H', 'I')], venue: () => V_BR_TR },
  { sport: 'bongro', grade: 12, file: F_BR, sheet: 'bản chuẩn k12', wd: 3, rows: [3, 16], week: 'B', stt: 'A', time: 'C', courts: [AB('D', 'E', 'F'), AB('G', 'H', 'I')], venue: () => V_BR_TR },

  // ---------------- BÓNG ĐÁ ----------------
  { sport: 'bongda', grade: 1, file: F_BD_TH, sheet: 'K1 CT2', wd: 2, rows: [4, 15], week: 'E', stt: 'C', time: 'F', courts: [PAIR('G', 'H', 'I', 'J'), PAIR('K', 'L', 'M', 'N')], venue: bdVenue },
  { sport: 'bongda', grade: 1, file: F_BD_TH, sheet: 'K1 CT3', wd: 3, rows: [3, 15], week: 'C', stt: 'B', time: 'D', courts: [PAIR('E', 'F', 'G', 'H'), PAIR('I', 'J', 'K', 'L')], venue: bdVenue },
  { sport: 'bongda', grade: 2, file: F_BD_TH, sheet: 'K2 CT4', wd: 4, rows: [3, 18], week: 'E', stt: 'C', time: 'F', courts: [PAIR('G', 'H', 'I', 'J'), PAIR('K', 'L', 'M', 'N')], venue: bdVenue },
  { sport: 'bongda', grade: 3, file: F_BD_TH, sheet: 'K3 ST4', wd: 4, rows: [3, 15], week: 'E', stt: 'C', time: 'F', courts: [PAIR('G', 'H', 'I', 'J'), PAIR('K', 'L', 'M', 'N')], venue: bdVenue },
  { sport: 'bongda', grade: 4, file: F_BD_TH, sheet: 'K4 ST2', wd: 2, rows: [3, 13], week: 'C', stt: 'B', time: 'D', courts: [PAIR('E', 'F', 'G', 'H'), PAIR('I', 'J', 'K', 'L')], venue: bdVenue },
  { sport: 'bongda', grade: 5, file: F_BD_TH, sheet: 'K5 CT5', wd: 5, rows: [3, 15], week: 'B', stt: 'A', time: 'C', courts: [PAIR('D', 'E', 'F', 'G'), PAIR('H', 'I', 'J', 'K')], venue: bdVenue },
  { sport: 'bongda', grade: 6, file: F_BD_THCS, sheet: 'Thứ 6 - Khối 6', wd: 6, rows: [3, 17], week: 'C', stt: 'B', time: 'D', courts: [AB('E', 'F', 'G'), AB('I', 'J', 'K')], venue: bdVenue },
  { sport: 'bongda', grade: 7, file: F_BD_THCS, sheet: 'Thứ 2- Khối 7', wd: 2, rows: [3, 15], week: 'C', stt: 'B', time: 'D', courts: [AB('E', 'F', 'G'), AB('I', 'J', 'K')], venue: bdVenue },
  { sport: 'bongda', grade: 8, file: F_BD_THCS, sheet: 'Thứ 3 - Khối 8', wd: 3, rows: [3, 14], week: 'C', stt: 'B', time: 'D', courts: [AB('E', 'F', 'G'), AB('I', 'J', 'K')], venue: bdVenue },
  { sport: 'bongda', grade: 9, file: F_BD_THCS, sheet: 'Thứ 5 - Khối 9', wd: 5, rows: [3, 15], week: 'C', stt: 'B', time: 'D', courts: [AB('E', 'F', 'G'), AB('I', 'J', 'K')], venue: bdVenue },
  // THPT: file không ghi thứ; lấy theo tiết thể thao của khối (K10–K11 chiều T6, K12 sáng T3) như Bóng rổ/Kéo co
  { sport: 'bongda', grade: 10, file: F_BD_THPT, sheet: 'LỊCH THI ĐẤU KHỐI 10 ', wd: 6, rows: [3, 18], week: 'B', stt: 'A', time: 'C', courts: [AB('D', 'E', 'F'), AB('G', 'H', 'I')], venue: bdVenue, inferredDay: true },
  { sport: 'bongda', grade: 11, file: F_BD_THPT, sheet: 'LỊCH THI ĐẤU KHỐI 11 ', wd: 6, rows: [3, 18], week: 'B', stt: 'A', time: 'C', courts: [AB('D', 'E', 'F'), AB('G', 'H', 'I')], venue: bdVenue, inferredDay: true },
  { sport: 'bongda', grade: 12, file: F_BD_THPT, sheet: 'LỊCH THI ĐẤU KHỐI 12', wd: 3, rows: [3, 16], week: 'B', stt: 'A', time: 'C', courts: [AB('D', 'E', 'F'), AB('G', 'H', 'I')], venue: bdVenue, inferredDay: true },

  // ---------------- KÉO CO ----------------
  { sport: 'keoco', grade: 1, file: F_KC + 'LỊCH THI ĐẤU MÔN KÉO CO TIỂU HỌC (1).xlsx', sheet: 'Khối 1 ', wd: 2, rows: [3, 11], week: 'C', stt: 'A', time: 'D', courts: [PAIR('E', 'F', 'G', 'Sân thầy Bình'), PAIR('H', 'I', 'J', 'Sân cô Bi – thầy Vũ Thành')], venue: v => v, kcTH: true },
  { sport: 'keoco', grade: 1, file: F_KC + 'LỊCH THI ĐẤU MÔN KÉO CO TIỂU HỌC (1).xlsx', sheet: 'Khối 1 ', wd: 3, rows: [15, 26], week: 'C', stt: 'A', time: 'D', courts: [PAIR('E', 'F', 'G', 'Sân thầy Bình'), PAIR('H', 'I', 'J', 'Sân cô Bi – thầy Vũ Thành')], venue: v => v, kcTH: true },
  { sport: 'keoco', grade: 2, file: F_KC + 'LỊCH THI ĐẤU MÔN KÉO CO TIỂU HỌC (1).xlsx', sheet: 'Khối 2 ', wd: 4, rows: [3, 19], week: 'C', stt: 'A', time: 'D', courts: [PAIR('E', 'F', 'G', 'Sân thầy Bình'), PAIR('H', 'I', 'J', 'Sân cô Bi – thầy Vũ Thành')], venue: v => v, kcTH: true },
  { sport: 'keoco', grade: 3, file: F_KC + 'LỊCH THI ĐẤU MÔN KÉO CO TIỂU HỌC (1).xlsx', sheet: 'Khối 3', wd: 4, rows: [3, 13], week: 'C', stt: 'A', time: 'D', courts: [PAIR('E', 'F', 'G', 'Sân thầy Bình'), PAIR('H', 'I', 'J', 'Sân cô Bi'), PAIR('K', 'L', 'M', 'Sân thầy Vũ Thành')], venue: v => v, kcTH: true },
  { sport: 'keoco', grade: 4, file: F_KC + 'LỊCH THI ĐẤU MÔN KÉO CO TIỂU HỌC (1).xlsx', sheet: 'Khối 4 ', wd: 2, rows: [4, 15], week: 'C', stt: 'A', time: 'D', courts: [PAIR('E', 'F', 'G', 'Sân thầy Bình'), PAIR('H', 'I', 'J', 'Sân cô Bi – thầy Vũ Thành')], venue: v => v, kcTH: true },
  { sport: 'keoco', grade: 5, file: F_KC + 'LỊCH THI ĐẤU MÔN KÉO CO TIỂU HỌC (1).xlsx', sheet: 'Khối 5', wd: 5, rows: [3, 15], week: 'C', stt: 'A', time: 'D', courts: [PAIR('E', 'F', 'G', 'Sân thầy Bình'), PAIR('H', 'I', 'J', 'Sân cô Bi – thầy Vũ Thành')], venue: v => v, kcTH: true },
  { sport: 'keoco', grade: 6, file: F_KC + 'LỊCH THI ĐẤU KC-THCS.xlsx', sheet: 'KHỐI 6 ST6', wd: 6, rows: [4, 15], week: 'C', stt: 'A', time: 'D', courts: [AB('E', 'F', 'Sân bóng rổ THCS'), AB('G', 'H', 'Đường PIT trước sảnh chính'), AB('I', 'J', 'Đường PIT cạnh sân bóng đá THCS')], venue: v => v },
  { sport: 'keoco', grade: 7, file: F_KC + 'LỊCH THI ĐẤU KC-THCS.xlsx', sheet: 'KHỐI 7 - ST2', wd: 2, rows: [4, 15], week: 'C', stt: 'A', time: 'D', courts: [AB('E', 'F', 'Sân bóng rổ THCS'), AB('G', 'H', 'Đường PIT trước sảnh chính'), AB('I', 'J', 'Đường PIT cạnh sân bóng đá THCS')], venue: v => v },
  { sport: 'keoco', grade: 8, file: F_KC + 'LỊCH THI ĐẤU KC-THCS.xlsx', sheet: 'KHỐI 8 ST3', wd: 3, rows: [3, 14], week: 'C', stt: 'A', time: 'D', courts: [AB('E', 'F', 'Sân bóng rổ THCS'), AB('G', 'H', 'Đường PIT trước sảnh chính')], venue: v => v },
  { sport: 'keoco', grade: 9, file: F_KC + 'LỊCH THI ĐẤU KC-THCS.xlsx', sheet: 'KHỐI 9 ST5', wd: 5, rows: [3, 13], week: 'C', stt: 'A', time: 'D', courts: [AB('E', 'F', 'Sân bóng rổ THCS'), AB('G', 'H', 'Đường PIT trước sảnh chính'), AB('I', 'J', 'Đường PIT cạnh sân bóng đá THCS')], venue: v => v },
  { sport: 'keoco', grade: 10, file: F_KC + 'LỊCH THI ĐẤU KÉO CO THPT.xlsx', sheet: 'Lịch Thi Đấu K10 K11', wd: 6, rows: [3, 34], week: 'B', time: 'C', courts: [AB('D', 'E', 'Sân 1'), AB('G', 'H', 'Sân 2')], venue: v => v },
  { sport: 'keoco', grade: 12, file: F_KC + 'LỊCH THI ĐẤU KÉO CO THPT.xlsx', sheet: 'Lịch Thi Đấu K12', wd: 3, rows: [3, 18], week: 'E', stt: 'C', time: 'F', courts: [AB('G', 'H', 'Sân thầy Bình'), AB('J', 'K', 'Sân cô Bi')], venue: v => v },
];

// ============================================================
//  PHÂN TÍCH Ô "vòng loại trực tiếp": Tứ kết / Bán kết / Chung kết
// ============================================================
function isKOText(s) {
  const f = fold(s);
  return /\b(TK|TU KET|BK|BAN KET|CK|CHUNG KET|THONG BAO SAU)\b/.test(f) || /\b(NHAT|NHI|THANG)\b/.test(f);
}
function parseRefs(part) {
  const f = fold(part);
  let m;
  if ((m = f.match(/\b(?:THANG|NHAT)\s*(?:TK|TU KET)\s*(\d)/))) return { w: 'QF' + m[1] };
  if ((m = f.match(/\b(?:THANG|NHAT)\s*(?:BK|BAN KET)\s*(\d)/))) return { w: 'SF' + m[1] };
  if ((m = f.match(/\b(NHAT|NHI|BA|THU\s*3|THU\s*BA)\s*(?:BANG\s*)?([A-D])(?![A-Z])/))) {
    const rk = m[1] === 'NHAT' ? 1 : m[1] === 'NHI' ? 2 : 3;
    return { g: m[2], rank: rk };
  }
  return null;
}
function stageAnywhere(s) {
  const f = fold(s); let m;
  if ((m = f.match(/(?:TU KET|\bTK)\s*(\d)?/))) return { st: 'QF', i: m[1] ? Number(m[1]) : undefined };
  if ((m = f.match(/(?:BAN KET|\bBK)\s*(\d)?/))) return { st: 'SF', i: m[1] ? Number(m[1]) : undefined };
  if (/CHUNG KET|\bCK\b/.test(f)) return { st: 'F' };
  return {};
}
function parseKOFragment(s) {
  let f = fold(s).replace(/\bKHOI \d+\b/g, ' ').replace(/\bK\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
  const out = {};
  let m;
  if ((m = f.match(/^(?:TK|TU KET)\s*(\d)\s*:?\s*(.*)$/))) { out.st = 'QF'; out.i = Number(m[1]); f = m[2]; }
  else if ((m = f.match(/^(?:BK|BAN KET)\s*(\d)?\s*:?\s*(.*)$/))) { out.st = 'SF'; if (m[1]) out.i = Number(m[1]); f = m[2]; }
  else if ((m = f.match(/^(?:CK|CHUNG KET)\s*:?\s*(.*)$/))) { out.st = 'F'; f = m[1]; }
  else if ((m = f.match(/^(?:TU KET|TK)\s*:?\s*(.*)$/))) { out.st = 'QF'; f = m[1]; }
  // phần cặp đấu: "A - B" hoặc "A GAP B"
  const parts = f.split(/\s+-\s+|\s-|-\s|\s+GAP\s+|-/).map(x => x.trim()).filter(Boolean);
  const refs = parts.map(parseRefs).filter(Boolean);
  if (refs.length >= 2) { out.a = refs[0]; out.b = refs[1]; }
  else if (refs.length === 1) out.one = refs[0];
  if (/THONG BAO SAU/.test(f)) out.tbd = true;
  return out;
}

// ============================================================
//  ĐỌC LỊCH CÁC MÔN ĐỒNG ĐỘI
// ============================================================
const events = {};   // id → event
const matches = [];  // danh sách trận
const koSeen = {};   // evId → {QF1: match,...}

function evId(sport, grade) { return `${sport}-k${grade}`; }
function gradeOf(team) { const m = String(team).match(/^(\d{1,2})/); return m ? Number(m[1]) : null; }
function groupOf(ev, team) {
  const gs = GROUPS[ev] || {};
  for (const [g, list] of Object.entries(gs)) if (list.includes(team)) return g;
  return null;
}

function cleanTeamText(s) {
  return String(s || '')
    .replace(/\(\s*[^)]*nghỉ[^)]*\)/gi, ' ')          // ( 7B01 nghỉ )
    .replace(/\((?:KC xong|[^)]*khẩn trương)[^)]*\)/gi, ' ')
    .replace(/\(([A-D])\)/g, ' ')                        // 3A7(B)
    .replace(/[()]/g, ' ')
    .replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}
function splitAB(s) {
  const t = cleanTeamText(s);
  const parts = t.split(/\s*[-–]\s*/).map(x => x.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  return parts;
}

function addTeamMatch(cfg, week, tm, ta, tb, score, venue, src, extra = {}) {
  const A = normClass(ta), B = normClass(tb);
  if (!CLASSES.has(A) || !CLASSES.has(B)) { note(`[${cfg.sport}] ${cfg.sheet} dòng ${src}: mã lớp lạ "${ta}" / "${tb}" — bỏ qua`); return; }
  const grade = gradeOf(A);
  if (gradeOf(B) !== grade) { note(`[${cfg.sport}] ${cfg.sheet} dòng ${src}: hai lớp khác khối ${A}–${B}`); return; }
  const ev = evId(cfg.sport, grade);
  const gA = groupOf(ev, A), gB = groupOf(ev, B);
  if (!gA || gA !== gB) note(`[${cfg.sport}] ${cfg.sheet} dòng ${src}: ${A} (bảng ${gA}) gặp ${B} (bảng ${gB}) — không cùng bảng`);
  const m = {
    ev, stage: 'G', group: gA || '', week, date: dateOf(week, cfg.wd), wd: cfg.wd,
    time: tm.time || '', end: tm.end || '', slot: tm.slot || '', venue,
    a: { t: A }, b: { t: B }, src: `${cfg.sheet}!${src}`, ...extra,
  };
  if (score) { m.sa = score[0]; m.sb = score[1]; m.st = 'done'; }
  matches.push(m);
}

function addKO(cfg, grade, week, tm, ko, venue, src) {
  const ev = evId(cfg.sport, grade);
  koSeen[ev] = koSeen[ev] || {};
  const key = ko.st + (ko.st === 'F' ? '' : ko.i);
  if (koSeen[ev][key]) {
    const prev = koSeen[ev][key];
    if (prev.date !== dateOf(week, cfg.wd)) prev.note = (prev.note ? prev.note + ' ' : '') + `Có lịch dự phòng ${dateOf(week, cfg.wd)} (${cfg.sheet}).`;
    return;
  }
  const lbl = ko.st === 'QF' ? `Tứ kết ${ko.i}` : ko.st === 'SF' ? `Bán kết ${ko.i}` : 'Chung kết';
  const side = r => r ? (r.w ? { ref: 'W:' + r.w } : { ref: `G:${r.g}:${r.rank}` }) : { ref: '' };
  const m = {
    ev, stage: ko.st, ko: key, label: lbl, week, date: dateOf(week, cfg.wd), wd: cfg.wd,
    time: tm.time || '', end: tm.end || '', slot: tm.slot || '', venue,
    a: side(ko.a), b: side(ko.b), src: `${cfg.sheet}!${src}`,
  };
  if (ko.tbd) m.note = 'Lịch cụ thể: thông báo sau.';
  koSeen[ev][key] = m;
  matches.push(m);
}

// Sửa lỗi gõ nhầm CHẮC CHẮN trong file nguồn (chỉ khi chỉ có 1 cách sửa khớp thể thức). Mỗi chỗ đều ghi vào báo cáo.
const PATCH = {
  'Khối 3!L7': { v: '3A0(C)', why: 'Kéo co K3 tuần 3: file ghi 3A11 – 3A9 nhưng 3A9 thuộc bảng D; bảng C (3A0, 3A8, 3A11) còn thiếu đúng cặp 3A0 – 3A11 → sửa 3A9 thành 3A0.' },
  'KHỐI 6 ST6!E4': { v: '6B03 - 6A06', why: 'Kéo co K6 tuần 1: file ghi "6B03 - 6A0" (thiếu số); bảng A (6B03, 6A01, 6A05, 6A06) còn thiếu đúng cặp 6B03 – 6A06.' },
  'Khối 5!E14': { v: 'Bán kết 2: NHẤT B - NHÌ A', why: 'Kéo co K5 bán kết 2: file ghi "NHẤT B - NHẤT C" nhưng khối 5 chỉ có bảng A, B; theo điều lệ Bán kết 2 = Nhất B gặp Nhì A.' },
  'KHỐI 7 - ST2!I9': { v: '7A03 - 7A04', why: 'Kéo co K7 tuần 3: file ghi 7A03 – 7B01 (trùng tuần 2); bảng D còn thiếu đúng cặp 7A03 – 7A04.' },
};
const patchUsed = new Set();
function readTeamSheet(cfg) {
  const ws0 = sheet(cfg.file, cfg.sheet);
  const ws = new Proxy(ws0, { get(t, k) { const key = cfg.sheet + '!' + String(k); if (PATCH[key]) { if (!patchUsed.has(key)) { patchUsed.add(key); note('[ĐÃ SỬA] ' + PATCH[key].why); } return { v: PATCH[key].v }; } return t[k]; } });
  let week = null, tmPrev = {};
  const koCounters = {};
  for (let r = cfg.rows[0]; r <= cfg.rows[1]; r++) {
    const wTxt = txt(ws, cfg.week, r);
    const sTxt = cfg.stt ? txt(ws, cfg.stt, r) : '';
    const wk = weekFromText(wTxt);
    if (wk) week = wk;
    else if (/^\s*\d\s*$/.test(sTxt) && (week == null || Number(sTxt) > week)) week = Number(sTxt);
    if (!week) continue;
    const tTxt = txt(ws, cfg.time, r);
    let tm = parseTime(tTxt);
    if (!tm.time && tmPrev.time && !tTxt) tm = tmPrev;
    if (!tm.time && tTxt && /^\s*\(?\d/.test(tTxt) && !/\d{1,2}[:h]\d{2}/.test(tTxt)) {
      // giờ nằm ở dòng dưới (Kéo co THPT: "3" rồi "(14:10-14:30)")
      const nxt = parseTime(txt(ws, cfg.time, r + 1));
      if (nxt.time) tm = { ...nxt, slot: tm.slot };
    }
    if (tm.time) tmPrev = tm;

    const koFrags = [];
    if (isKOText(tTxt) && /TU KET|BAN KET|CHUNG KET/.test(fold(tTxt))) koFrags.push({ s: tTxt, court: null, stageOnly: true });
    cfg.courts.forEach((c, ci) => {
      const venue = typeof c.v === 'string' && c.v.length > 2 ? cfg.venue(c.v) : cfg.venue(txt(ws, c.v, r));
      const cells = c.ab ? [c.ab, c.r] : [c.a, c.b, c.r];
      if (typeof c.v === 'string' && c.v.length <= 2) cells.push(c.v);
      // trận vòng bảng
      let ta = '', tb = '';
      if (c.ab) {
        const ab = txt(ws, c.ab, r);
        const abClean = cleanTeamText(ab);
        if (ab && !/nghỉ|trọng tài/i.test(abClean) && !isKOText(ab) && !/^x$/i.test(ab)) {
          const p = splitAB(ab);
          if (p) { ta = p[0]; tb = p[1]; }
          else if (ab.trim()) note(`[${cfg.sport}] ${cfg.sheet} dòng ${r}: không tách được cặp đấu "${ab.replace(/\n/g, ' ')}"`);
        }
      } else {
        const a = txt(ws, c.a, r), b = txt(ws, c.b, r);
        if (a && b && !isKOText(a) && !isKOText(b) && !/^x$/i.test(a) && !/trọng tài/i.test(b)) {
          ta = cleanTeamText(a); tb = cleanTeamText(b);
        }
      }
      if (ta && tb) {
        const sc = parseScore(txt(ws, c.r, r));
        const grade = gradeOf(normClass(ta));
        addTeamMatch(cfg, week, tm, ta, tb, sc, typeof c.v === 'string' && c.v.length > 2 ? c.v : cfg.venue(txt(ws, c.v, r)), r);
        return;
      }
      for (const col of cells) {
        const s = txt(ws, col, r);
        if (!s || /trọng tài/i.test(s)) continue;
        if (isKOText(s)) koFrags.push({ s, court: ci, venue });
      }
    });

    if (koFrags.length) {
      // gộp các mảnh thành trận
      const items = koFrags.map(k => k.stageOnly ? { ...stageAnywhere(k.s), stageOnly: true } : ({ ...parseKOFragment(k.s), court: k.court, venue: k.venue }));
      const stageHint = items.find(x => x.stageOnly && x.st);
      const out = [];
      let pendStage = null, pendOne = null;
      for (const it of items) {
        if (it.stageOnly) continue;
        if (it.a && it.b) {
          const st = it.st || (pendStage && pendStage.st) || (stageHint && stageHint.st);
          const i = it.i || (pendStage && pendStage.i) || (stageHint && stageHint.i);
          out.push({ st, i, a: it.a, b: it.b, venue: it.venue, tbd: it.tbd });
          pendStage = null;
        } else if (it.one) {
          if (pendOne) {
            out.push({ st: it.st || pendOne.st || (stageHint && stageHint.st), i: it.i || pendOne.i, a: pendOne.one, b: it.one, venue: pendOne.venue });
            pendOne = null;
          } else pendOne = it;
        } else if (it.st) {
          if (pendStage && pendStage.st === 'F' && it.st === 'F') continue;
          pendStage = it;
          if (it.tbd && it.st) { out.push({ st: it.st, i: it.i, venue: it.venue, tbd: true }); pendStage = null; }
        } else if (it.tbd) {
          const st = (pendStage && pendStage.st) || (stageHint && stageHint.st);
          if (st) { out.push({ st, i: pendStage && pendStage.i, venue: it.venue, tbd: true }); pendStage = null; }
        }
      }
      if (pendStage && pendStage.st === 'F') out.push({ st: 'F', venue: pendStage.venue, tbd: true });
      for (const k of out) {
        // suy ra vòng từ tham chiếu nếu ô không ghi
        if (!k.st && k.a) k.st = k.a.w ? (k.a.w.startsWith('SF') ? 'F' : 'SF') : 'QF';
        if (!k.st) continue;
        if (k.st !== 'F' && !k.i) { koCounters[k.st] = (koCounters[k.st] || 0) + 1; k.i = koCounters[k.st]; }
        if (k.st === 'F' && !k.a) { k.a = { w: 'SF1' }; k.b = { w: 'SF2' }; }
        if (k.st === 'SF' && !k.a) { k.a = { w: 'QF' + (2 * k.i - 1) }; k.b = { w: 'QF' + 2 * k.i }; }
        addKO(cfg, cfg.grade, week, tm, k, k.venue || cfg.venue(''), r);
      }
    }
  }
}

TEAM_SHEETS.forEach(readTeamSheet);

// ============================================================
//  KIỂM TRA: mỗi bảng đủ vòng tròn, không trùng cặp
// ============================================================
function teamEventMeta(ev) {
  const [sport, k] = ev.split('-');
  const grade = Number(k.slice(1));
  const gs = GROUPS[ev];
  const nGroups = Object.keys(gs).length;
  let format = 'QF';
  if (gs.RR) format = 'RR';
  else if (nGroups === 2) format = 'SF';
  return { sport, grade, format };
}
for (const ev of Object.keys(GROUPS)) {
  const gs = GROUPS[ev];
  for (const [g, list] of Object.entries(gs)) {
    const seen = {};
    matches.filter(m => m.ev === ev && m.stage === 'G' && m.group === g).forEach(m => {
      const k = [m.a.t, m.b.t].sort().join('|');
      seen[k] = (seen[k] || 0) + 1;
    });
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const k = [list[i], list[j]].sort().join('|');
      if (!seen[k]) note(`[THIẾU] ${ev} bảng ${g}: chưa có trận ${list[i]} – ${list[j]}`);
      else if (seen[k] > 1) note(`[TRÙNG] ${ev} bảng ${g}: ${list[i]} – ${list[j]} xuất hiện ${seen[k]} lần`);
    }
  }
  const meta = teamEventMeta(ev);
  const ko = koSeen[ev] || {};
  const need = meta.format === 'QF' ? ['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F'] : meta.format === 'SF' ? ['SF1', 'SF2', 'F'] : [];
  need.forEach(k => { if (!ko[k]) note(`[THIẾU VÒNG TRONG] ${ev}: không thấy ${k} trong lịch`); });
  Object.keys(ko).forEach(k => { if (!need.includes(k)) note(`[THỪA] ${ev}: có ${k} ngoài thể thức`); });
}

// in thống kê
const bySport = {};
matches.forEach(m => { const s = m.ev.split('-')[0]; bySport[s] = (bySport[s] || 0) + 1; });
console.log('Số trận theo môn:', bySport);
console.log('Có kết quả:', matches.filter(m => m.st === 'done').length);

module.exports = { XLSX, matches, events, koSeen, GROUPS, CLASSES, note, report, fold, normClass, parseScore, dateOf, WEEK1, txt, sheet, SRC, OUT, REPORT, isoDate, DAY, pad2 };

if (require.main === module) {
  fs.writeFileSync(REPORT, report.join('\n'));
  console.log(report.join('\n'));
}
