// ============================================================
//  Sửa sau khi gộp Excel (build.js gọi trước khi ghi js/seed-data.js)
//  Dùng cho các thay đổi BTC cấp lại mà file Excel gốc chưa sửa.
// ============================================================
// Karate khối 5 — theo file "TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx" BTC gửi 02/10:
// mỗi nội dung 2 nhánh A, B (trận 9 = Bán kết 1/2) và Chung kết (Nhất A gặp Nhất B).
// Gắn mốc "fix": bản sửa cũ trên máy chủ (trước mốc) chỉ còn giữ tỉ số, cặp đấu theo file này.
const FIX_AT = Date.parse('2026-10-02T17:00:00+07:00');
const FIX_EVENTS = ['karate-k5-kata-nu', 'karate-k5-kata-nam'];

module.exports = function applyFixes(seed) {
  for (const m of Object.values(seed.matches)) if (FIX_EVENTS.includes(m.ev)) m.fix = FIX_AT;
  return seed;
};
