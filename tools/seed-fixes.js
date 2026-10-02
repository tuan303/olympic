// ============================================================
//  Sửa sau khi gộp Excel (build.js gọi trước khi ghi js/seed-data.js)
//  Dùng cho các thay đổi BTC cấp lại mà file Excel gốc chưa sửa.
// ============================================================
// Karate khối 5 (BTC cấp sơ đồ 02/10): mỗi nội dung chỉ 1 nhánh — Nữ = nhánh A, Nam = nhánh B.
// Trận 9 của nhánh là Chung kết; 7–8 Bán kết; 3–6 Tứ kết; 1–2 Vòng loại.
const FIX_AT = Date.parse('2026-10-02T15:00:00+07:00');
const SINGLE_BRANCH = { 'karate-k5-kata-nu': 'A', 'karate-k5-kata-nam': 'B' };

module.exports = function applyFixes(seed) {
  seed.removed = seed.removed || [];
  for (const [evId, keep] of Object.entries(SINGLE_BRANCH)) {
    const ev = seed.events[evId];
    if (!ev) continue;
    const ms = Object.values(seed.matches).filter((m) => m.ev === evId);
    for (const m of ms) {
      if (m.branch !== keep) { delete seed.matches[m.id]; seed.removed.push(m.id); continue; }
      const st = m.n === 9 ? ['F', 'Chung kết'] : m.n >= 7 ? ['SF', 'Bán kết'] : m.n >= 3 ? ['QF', 'Tứ kết'] : ['R', 'Vòng loại'];
      m.stage = st[0]; m.label = st[1]; m.fix = FIX_AT;
    }
    ev.final = `${evId}-${keep}9`;
    ev.branches = { [keep]: (ev.branches && ev.branches[keep]) || ms.filter((m) => m.branch === keep).map((m) => m.id) };
  }
  seed.removed = [...new Set(seed.removed)];
  return seed;
};
