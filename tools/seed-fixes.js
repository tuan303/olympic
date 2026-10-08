// ============================================================
//  Sửa sau khi gộp Excel (build.js gọi trước khi ghi js/seed-data.js)
//  Dùng cho các thay đổi BTC cấp lại mà file Excel gốc chưa sửa.
// ============================================================
// Karate khối 5 — theo file "TiH-BẢNG THI ĐẤU - KARATE-DO.xlsx" BTC gửi 02/10:
// mỗi nội dung 2 nhánh A, B (trận 9 = Bán kết 1/2) và Chung kết (Nhất A gặp Nhất B).
// Gắn mốc "fix": bản sửa cũ trên máy chủ (trước mốc) chỉ còn giữ tỉ số, cặp đấu theo file này.
const FIX_AT = Date.parse('2026-10-02T17:00:00+07:00');
const FIX_EVENTS = ['karate-k5-kata-nu', 'karate-k5-kata-nam'];

// Bóng rổ — BTC sửa cách tính điểm 08/10: Thắng 2 – Thua 1 – Bỏ cuộc 0; bằng điểm (2 đội trở lên)
// → hiệu số điểm thắng bại toàn vòng bảng → bốc thăm. Thay mục "3. Cách tính điểm" trong điều lệ 3 cấp.
const BONGRO_POINTS = [
  '3. Cách tính điểm:',
  ' - Thắng: 2 điểm',
  ' - Thua: 1 điểm',
  ' - Bỏ cuộc: 0 điểm (đội bỏ cuộc hoặc đến muộn bị xử thua 0 - 20)',
  ' * Xếp hạng: Đội có tổng điểm cao hơn xếp trên.',
  ' - Nếu có 2 đội trở lên bằng điểm nhau thì kết quả được xác định:',
  ' + Thứ nhất: Tính hiệu số điểm thắng bại (tổng điểm ghi được trừ tổng điểm bị ghi) của các đội trong tất cả các trận vòng bảng, đội có hiệu số cao hơn xếp trên.',
  ' + Thứ hai: Nếu vẫn bằng nhau sẽ bốc thăm phân thứ hạng.',
];
function patchBongroRules(seed) {
  for (const lv of ['TH', 'THCS', 'THPT']) {
    const r = seed.rules && seed.rules['bongro-' + lv];
    if (!r) continue;
    const L = r.body.split('\n');
    const i = L.findIndex((l) => /^\s*3\.\s*Cách tính điểm/i.test(l));
    const j = L.findIndex((l, k) => k > i && /^\s*4\.\s*/.test(l));
    if (i < 0 || j < 0) continue;
    L.splice(i, j - i, ...BONGRO_POINTS);
    r.body = L.join('\n');
  }
}

module.exports = function applyFixes(seed) {
  for (const m of Object.values(seed.matches)) if (FIX_EVENTS.includes(m.ev)) m.fix = FIX_AT;
  patchBongroRules(seed);
  return seed;
};
