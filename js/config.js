// ============================================================
//  CẤU HÌNH KẾT NỐI
//  - FIREBASE_CONFIG = null  → web chạy "chế độ xem thử": dữ liệu lấy từ file
//    Excel đã chuyển (js/seed-data.js), sửa kết quả chỉ lưu trên máy đang dùng.
//  - Điền cấu hình Firebase (Project settings → Your apps → Web app) để bật
//    đồng bộ thời gian thực cho mọi người xem + đăng nhập quản trị bằng
//    Microsoft 365 của trường. Xem README.md mục "Kết nối Firebase".
// ============================================================
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBgMVqhWY_aPa-HXyK6_WAkCRz6twAJwX0',
  authDomain: 'olympic-nshm-758ac.firebaseapp.com',
  projectId: 'olympic-nshm-758ac',
  storageBucket: 'olympic-nshm-758ac.firebasestorage.app',
  messagingSenderId: '132287318902',
  appId: '1:132287318902:web:6a3888d6318c94781d4857',
};

// Tenant Azure của trường — chỉ tài khoản @hoangmaistarschool.edu.vn đăng nhập được
export const AUTH_TENANT = 'af9ef20a-3158-43a0-a1ab-ad72a03eb4c5';
export const SCHOOL_DOMAIN = 'hoangmaistarschool.edu.vn';

// Quản trị cao nhất (luôn có toàn quyền, kể cả khi danh sách quản trị trống).
// Phải khớp với hàm isSuper() trong firestore.rules.
export const SUPER_ADMINS = [
  'tuantm@hoangmaistarschool.edu.vn',
  'it@hoangmaistarschool.edu.vn',
];

// Đổi tên sân: kết quả BTC đã lưu trên Firestore vẫn mang tên cũ → hiển thị theo tên mới
export const VENUE_RENAME = {
  'Sân cô Bi – thầy Vũ Thành': 'Đường Pitch (Cổng 1 – Canteen)',
  'Sân thầy Vũ Thành': 'Đường Pitch (Canteen)',
  'Sân thầy Bình': 'Đường Pitch (Bể cá)',
  'Sân cô Bi': 'Đường Pitch (Cổng 1)',
  'Đường PIT trước sảnh chính': 'Đường Pitch (Trước sảnh chính)',
  'Đường PIT cạnh sân bóng đá THCS': 'Đường Pitch (Cạnh sân bóng đá THCS)',
};

// Đổi số này mỗi khi sửa các file js/*.js để trình duyệt tải bản mới (không có bước build)
export const ASSET_VER = '2026-09-29g';
