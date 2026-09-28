# OLYMPIC Thể thao học sinh lần thứ IV · 2026–2027 — Trường Ngôi Sao Hoàng Mai

**ONE TEAM – ONE SPIRIT.** Website điều hành giải: lịch thi đấu, kết quả, bảng xếp hạng, bảng tổng sắp huy chương và điều lệ 5 môn (Bóng đá, Bóng rổ, Kéo co, Cầu lông, Karate) cho 12 khối — dành cho học sinh, phụ huynh, CBGV-NV theo dõi; Ban tổ chức cập nhật kết quả trực tiếp.

- HTML/JS thuần, **không có bước build** — deploy tĩnh trên Vercel.
- Dữ liệu thời gian thực: **Firebase Firestore** project `olympic-nshm-758ac`.
- Đăng nhập quản trị: **Microsoft 365** của trường (Firebase Authentication).

## Các trang

| Trang | Đường dẫn | Nội dung |
|---|---|---|
| Trang chủ | `#/` | Tiến độ giải, lịch hôm nay theo khối, kết quả mới nhất, thông báo BTC, tổng sắp |
| Lịch thi đấu | `#/lich` | Theo ngày/tuần; lọc cấp, khối, môn, lớp, trạng thái; in lịch |
| Kết quả & BXH | `#/ket-qua/<môn>/<khối>` | Bảng xếp hạng vòng bảng, nhánh tứ kết–bán kết–chung kết (tự điền đội), nhánh đấu cá nhân |
| Bảng tổng sắp | `#/tong-sap` | Huy chương theo lớp, nhà vô địch từng nội dung |
| Tra cứu lớp | `#/lop/<lớp>` | Lịch, kết quả, thứ hạng, VĐV cá nhân của một lớp; "theo dõi lớp" trên trang chủ |
| Điều lệ | `#/dieu-le/<môn>/<cấp>` | Điều lệ từng môn từng cấp + quy định chung |
| Quản trị | `#/quan-tri` | Nhập kết quả theo ngày, sửa lịch/đổi giờ/đổi sân, xử thua, bảng đấu, huy chương tay, thông báo, cài đặt điểm, phân quyền theo môn, sao lưu, xuất CSV, nhật ký |

## Cấu trúc

```
index.html            khung trang
assets/app.css        giao diện (màu nhận diện: navy #083586, đỏ #ED213C, vàng #FDD132, lá #3FA856, trời #41BBFF)
assets/logo.svg       logo trường · assets/key-visual.jpg ảnh chia sẻ
js/config.js          cấu hình Firebase, tenant Microsoft, quản trị cao nhất, ASSET_VER
js/app.js             điều hướng + các trang công khai
js/admin.js           trang quản trị (tải khi cần)
js/engine.js          lõi: xếp hạng theo điều lệ, tự điền đội vòng trong, huy chương
js/store.js           dữ liệu: Firestore thời gian thực / chế độ xem thử
js/firebase.js        Firestore + đăng nhập Microsoft
js/ui.js, icons.js    thành phần giao diện, biểu tượng SVG
js/seed-data.js       DỮ LIỆU GỐC sinh từ Excel (đừng sửa tay)
firestore.rules       luật bảo mật Firestore (dán tay trên Console)
tools/                công cụ chuyển Excel → seed-data.js (không deploy)
```

## Kết nối Firebase (làm 1 lần)

1. Firebase Console → project **olympic-nshm-758ac** → **Firestore Database → Create database** (Production mode, vị trí `asia-southeast1`).
2. **Firestore → Rules**: dán toàn bộ `firestore.rules` → **Publish**. *(Rules KHÔNG tự deploy theo GitHub/Vercel — sửa file này xong phải dán lại.)*
3. **Authentication → Sign-in method → Microsoft → Enable**: Application ID + Secret lấy từ Azure App registration của trường; trong Azure thêm Redirect URI `https://olympic-nshm-758ac.firebaseapp.com/__/auth/handler`.
4. **Authentication → Settings → Authorized domains**: thêm tên miền website (vd `olympic.nshm.vn`, `olympic-xxx.vercel.app`).
5. Mở website → **Quản trị** → đăng nhập bằng tài khoản quản trị cao nhất → tab **Dữ liệu** → **Nạp dữ liệu gốc lên máy chủ**.
6. Tab **Quản trị viên**: cấp quyền cho giáo viên phụ trách từng môn (chỉ sửa được môn của mình).

Quản trị cao nhất khai ở **2 chỗ phải khớp nhau**: `SUPER_ADMINS` trong `js/config.js` và hàm `isSuper()` trong `firestore.rules`.

## Cập nhật lịch từ file Excel mới

```bash
cd tools
npm i xlsx
node build.js "<đường dẫn thư mục OLYMPIC THỂ THAO 26.27>"
```

Sinh lại `js/seed-data.js` và `tools/extract-report.txt` (các chỗ file gốc lệch/thiếu). Sau đó tăng `ASSET_VER` trong `js/config.js` và `?v=` trong `index.html`. **Lưu ý:** dữ liệu gốc chỉ dùng để nạp lần đầu; khi giải đang chạy, sửa lịch trên trang Quản trị (nạp lại dữ liệu gốc sẽ xóa kết quả đã nhập).

## Chạy thử trên máy

```bash
node tools/serve.js
```

Mở `http://localhost:5173`. Nếu `FIREBASE_CONFIG = null` web chạy **chế độ xem thử** (dữ liệu từ Excel, sửa đổi chỉ lưu trên trình duyệt).

## Deploy

Push nhánh `main` lên `github.com/tuan303/olympic` → Vercel tự deploy (Framework preset: *Other*, không Build Command, Output Directory để trống).
