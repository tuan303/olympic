// ============================================================
//  ĐỌC SƠ ĐỒ NHÁNH ĐẤU (hình vẽ bằng ô Excel bên trái bảng lịch)
//  Số "(n)" trên sơ đồ là NÚT của sơ đồ; bảng lịch dùng lại số nút này, không
//  phải lúc nào cũng trùng "Số trận". Mỗi nút nằm giữa 2 nút con ở cột bên trái
//  (nhánh phải của sơ đồ 2 phía thì ngược lại).
// ============================================================
const X = require('./extract.js');
const { txt, fold } = X;

function colIdx(c) { return X.XLSX.utils.decode_col(c); }
function colName(i) { return X.XLSX.utils.encode_col(i); }

// Đọc các nút trong vùng [r0..r1] x [c0..c1]
function readNodes(ws, r0, r1, c0, c1, isEntrant) {
  const nodes = [];
  let ck = null;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    let v = txt(ws, colName(c), r).replace(/\n/g, ' ').replace(/^'+/, '').replace(/\s+/g, ' ').trim();
    if (!v) continue;
    if (/^\(?\s*CK\s*\)?$/i.test(v)) { ck = { r, c }; continue; }
    let m = v.match(/^'?\((\d{1,2})\)\s*(.*)$/);
    if (m) { nodes.push({ kind: 'label', n: Number(m[1]), r, c, annot: m[2] }); continue; }
    if (/^\d{1,2}$/.test(v)) continue; // số đứng riêng (vd "13" ghi chú)
    if (isEntrant(v)) nodes.push({ kind: 'ent', text: v, r, c });
  }
  return { nodes, ck };
}

// Dựng cây: xử lý nút theo thứ tự cột; con = nút chưa dùng gần nhất phía trên & phía dưới
function buildTree(nodes, dir) {
  const labels = nodes.filter((n) => n.kind === 'label').sort((a, b) => (dir > 0 ? a.c - b.c : b.c - a.c) || a.r - b.r);
  const used = new Set();
  const errs = [];
  for (const L of labels) {
    const cands = nodes.filter((x) => x !== L && !used.has(x) && (dir > 0 ? x.c < L.c : x.c > L.c) && !(x.kind === 'label' && !x.done));
    const dist = (x) => Math.abs(x.r - L.r) * 100 + Math.abs(x.c - L.c);
    const above = cands.filter((x) => x.r <= L.r).sort((a, b) => b.r - a.r || dist(a) - dist(b))[0];
    const below = cands.filter((x) => x.r >= L.r && x !== above).sort((a, b) => a.r - b.r || dist(a) - dist(b))[0];
    if (!above || !below) { errs.push(`nút (${L.n}) thiếu nút con`); L.done = true; continue; }
    L.kids = [above, below];
    used.add(above); used.add(below);
    L.done = true;
  }
  const roots = labels.filter((L) => !used.has(L));
  return { labels, roots, errs };
}

// Toàn bộ sơ đồ của một bảng: tự nhận 1 phía hay 2 phía (nhánh phải đối xứng)
function parseDrawing(ws, r0, r1, c0, c1, isEntrant) {
  const { nodes, ck } = readNodes(ws, r0, r1, c0, c1, isEntrant);
  if (!nodes.some((n) => n.kind === 'label')) return null;
  let sides;
  const ents = nodes.filter((n) => n.kind === 'ent');
  const minC = Math.min(...ents.map((n) => n.c)), maxC = Math.max(...ents.map((n) => n.c));
  if (ck && ents.some((n) => n.c > ck.c) && ents.some((n) => n.c < ck.c)) {
    sides = [buildTree(nodes.filter((n) => n.c < ck.c), 1), buildTree(nodes.filter((n) => n.c > ck.c), -1)];
  } else sides = [buildTree(nodes, 1)];
  const labels = sides.flatMap((s) => s.labels);
  const roots = sides.flatMap((s) => s.roots);
  const errs = sides.flatMap((s) => s.errs);
  return { labels, roots, errs, byN: Object.fromEntries(labels.map((l) => [l.n, l])) };
}

module.exports = { parseDrawing, readNodes, colIdx, colName };
