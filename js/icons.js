// Biểu tượng SVG (vẽ theo phong cách hình khối của bộ nhận diện Olympic NSHM)
const svg = (body, vb = '0 0 24 24', cls = '') => `<svg class="ic ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

// Biểu tượng môn: emoji (máy nào cũng có sẵn, màu sắc đúng môn)
const emo = (ch, label) => `<span class="ic emo" role="img" aria-label="${label}">${ch}</span>`;
export const SPORT_ICON = {
  bongda: emo('⚽', 'Bóng đá'),
  bongro: emo('🏀', 'Bóng rổ'),
  keoco: `<svg class="ic emo-svg" viewBox="0 0 24 24" role="img" aria-label="Kéo co"><circle cx="2.9" cy="7.2" r="2.2" fill="#1d4ed8"/><path d="M4.2 9.8L6.8 15.6L8.8 21.2M6.8 15.6L6.2 21.4" stroke="#1d4ed8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4.8 11.2L9.8 12.4" stroke="#1d4ed8" stroke-width="2" stroke-linecap="round"/><circle cx="21.1" cy="7.2" r="2.2" fill="#e0243b"/><path d="M19.8 9.8L17.2 15.6L15.3 21.2M17.2 15.6L17.8 21.4" stroke="#e0243b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M19.2 11.2L14.2 12.4" stroke="#e0243b" stroke-width="2" stroke-linecap="round"/><path d="M0.8 12.4H23.2" stroke="#a86b2a" stroke-width="1.7" stroke-linecap="round"/><path d="M12 12.4l-1.5 4.6h3z" fill="#f5b400"/></svg>`, // dây kéo co + dải cờ giữa (không có emoji kéo co)
  caulong: emo('🏸', 'Cầu lông'),
  karate: emo('🥋', 'Karate'),
};

export const I = {
  home: svg(`<path d="M3.5 10.5L12 3.8l8.5 6.7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" ${S}/>`),
  cal: svg(`<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" ${S}/><path d="M3.5 10h17M8 3v4M16 3v4" ${S}/>`),
  trophy: svg(`<path d="M7 4h10v5a5 5 0 0 1-10 0z" ${S}/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3.5M8.5 20.5h7M9.5 17.5h5" ${S}/>`),
  medal: svg(`<circle cx="12" cy="14.5" r="5.5" ${S}/><path d="M8.5 10L5.5 3.5h4L12 8.5l2.5-5h4L15.5 10" ${S}/><path d="M12 12v5" ${S}/>`),
  users: svg(`<circle cx="9" cy="8" r="3.5" ${S}/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" ${S}/><circle cx="17" cy="9" r="2.6" ${S}/><path d="M17.5 14.4c2.3.3 3.7 1.9 4 4.6" ${S}/>`),
  book: svg(`<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H12v17H5.5A1.5 1.5 0 0 1 4 18.5zM20 4.5A1.5 1.5 0 0 0 18.5 3H12v17h6.5a1.5 1.5 0 0 0 1.5-1.5z" ${S}/>`),
  gear: svg(`<circle cx="12" cy="12" r="3.2" ${S}/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.5z" ${S}/>`),
  search: svg(`<circle cx="10.5" cy="10.5" r="6.5" ${S}/><path d="M15.5 15.5L21 21" ${S}/>`),
  clock: svg(`<circle cx="12" cy="12" r="8.5" ${S}/><path d="M12 7.5V12l3 2" ${S}/>`),
  pin: svg(`<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" ${S}/><circle cx="12" cy="10" r="2.3" ${S}/>`),
  left: svg(`<path d="M15 5l-7 7 7 7" ${S}/>`),
  right: svg(`<path d="M9 5l7 7-7 7" ${S}/>`),
  down: svg(`<path d="M5 9l7 7 7-7" ${S}/>`),
  x: svg(`<path d="M6 6l12 12M18 6L6 18" ${S}/>`),
  check: svg(`<path d="M4.5 12.5l5 5L19.5 7" ${S}/>`),
  plus: svg(`<path d="M12 5v14M5 12h14" ${S}/>`),
  edit: svg(`<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" ${S}/><path d="M13.5 6.5l4 4" ${S}/>`),
  trash: svg(`<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13" ${S}/>`),
  download: svg(`<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15" ${S}/>`),
  upload: svg(`<path d="M12 20V9M7 13.5l5-5 5 5M4.5 4h15" ${S}/>`),
  bell: svg(`<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" ${S}/><path d="M10 20.5a2 2 0 0 0 4 0" ${S}/>`),
  logout: svg(`<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10" ${S}/>`),
  list: svg(`<path d="M9 6h11M9 12h11M9 18h11" ${S}/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>`),
  bracket: svg(`<path d="M3 5h5v5H3M3 14h5v5H3M8 7.5h3v9H8M11 12h4M15 9.5h6v5h-6z" ${S}/>`),
  print: svg(`<path d="M7 9V3.5h10V9M7 17H4.5A1.5 1.5 0 0 1 3 15.5v-5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17" ${S}/><path d="M7 14h10v6.5H7z" ${S}/>`),
  info: svg(`<circle cx="12" cy="12" r="8.5" ${S}/><path d="M12 11v5.5M12 7.8v.2" ${S}/>`),
  refresh: svg(`<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 13a8 8 0 0 0 14.3 4.5L20 15.5M4 4v4.5h4.5M20 20v-4.5h-4.5" ${S}/>`),
  whistle: svg(`<path d="M3 10.5a4.5 4.5 0 0 0 9 1.5h8.5V8H9.5A4.5 4.5 0 0 0 3 10.5z" ${S}/><circle cx="7.5" cy="11.5" r="1.3" fill="currentColor"/>`),
  star: svg(`<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" ${S}/>`),
  share: svg(`<circle cx="6" cy="12" r="2.5" ${S}/><circle cx="18" cy="6" r="2.5" ${S}/><circle cx="18" cy="18" r="2.5" ${S}/><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6" ${S}/>`),
};

// Mảng hình khối trang trí (gợi lại key visual: bóng, lưới, dây kéo co, cầu lông, đường chạy)
export function heroArt() {
  const N = '#083586', R = '#ED213C', Y = '#FDD132', G = '#3FA856', K = '#41BBFF', W = '#ffffff', B = '#0249DF';
  return `<svg class="hero-art" viewBox="0 0 480 360" aria-hidden="true" focusable="false">
  <defs><clipPath id="hc1"><rect x="0" y="0" width="120" height="120"/></clipPath><clipPath id="hc9"><rect x="240" y="240" width="120" height="120"/></clipPath></defs>
  <rect width="480" height="360" fill="${N}"/>
  <!-- bóng rổ -->
  <g clip-path="url(#hc1)"><rect width="120" height="120" fill="${N}"/><circle cx="60" cy="60" r="50" fill="${R}"/><path d="M10 60h100M60 10v100M24 26c14 10 20 22 20 34s-6 24-20 34M96 26C82 36 76 48 76 60s6 24 20 34" stroke="${N}" stroke-width="5" fill="none"/></g>
  <!-- bán nguyệt đỏ -->
  <rect x="120" y="0" width="120" height="120" fill="${N}"/><path d="M130 0a110 110 0 0 1 0 220z" fill="${R}" transform="scale(1 .545)"/>
  <path d="M150 30l24 24M150 50l24 24M150 70l24 24" stroke="${W}" stroke-width="3" opacity=".9"/>
  <!-- sân bóng -->
  <rect x="240" y="0" width="120" height="120" fill="${G}"/><path d="M262 18h76v84h-76zM262 60h76M300 60m-16 0a16 16 0 1 0 32 0a16 16 0 1 0-32 0" stroke="${W}" stroke-width="3" fill="none"/>
  <!-- tam giác xanh trời -->
  <rect x="360" y="0" width="120" height="120" fill="${N}"/><path d="M360 0h120L360 120z" fill="${K}"/><path d="M480 120V40l-40 80z" fill="${Y}"/>
  <!-- quả cầu vàng -->
  <rect x="0" y="120" width="120" height="120" fill="${Y}"/><path d="M0 240a120 120 0 0 1 120-120v120z" fill="${W}"/><circle cx="84" cy="200" r="22" fill="${R}"/>
  <!-- lưới -->
  <rect x="120" y="120" width="240" height="60" fill="${R}"/><g stroke="${W}" stroke-width="2.2">${Array.from({ length: 13 }, (_, i) => `<path d="M${132 + i * 18} 124v52"/>`).join('')}<path d="M122 136h236M122 152h236M122 168h236"/></g>
  <!-- dây kéo co -->
  <rect x="120" y="180" width="240" height="60" fill="${N}"/><path d="M120 210c10-16 20-16 30 0s20 16 30 0 20-16 30 0 20 16 30 0 20-16 30 0 20 16 30 0 20-16 30 0 20 16 30 0" stroke="${Y}" stroke-width="12" fill="none"/><path d="M120 210c10 16 20 16 30 0s20-16 30 0 20 16 30 0 20-16 30 0 20 16 30 0 20-16 30 0 20 16 30 0 20-16 30 0" stroke="${W}" stroke-width="12" fill="none"/>
  <!-- mục tiêu -->
  <rect x="360" y="120" width="120" height="120" fill="${B}"/><circle cx="420" cy="180" r="48" fill="${K}"/><circle cx="420" cy="180" r="32" fill="${N}"/><circle cx="420" cy="180" r="18" fill="${W}"/><path d="M420 180l40-40" stroke="${R}" stroke-width="6"/>
  <!-- bóng đá -->
  <rect x="0" y="240" width="120" height="120" fill="${G}"/><path d="M0 240h120L0 360z" fill="${R}"/><circle cx="60" cy="300" r="44" fill="${W}"/><path d="M60 280l17 12-6 20H49l-6-20z" fill="${N}"/><path d="M60 280v-22M77 292l20-7M71 312l12 17M49 312l-12 17M43 292l-20-7" stroke="${N}" stroke-width="4"/>
  <!-- cầu lông -->
  <rect x="120" y="240" width="120" height="120" fill="${B}"/><path d="M160 256h40l-8 60h-24z" fill="${W}"/><path d="M170 256l2 60M180 256v60M190 256l-2 60" stroke="${B}" stroke-width="3"/><path d="M166 318h28v10a14 14 0 0 1-28 0z" fill="${K}"/>
  <!-- đường chạy -->
  <g clip-path="url(#hc9)"><rect x="240" y="240" width="120" height="120" fill="${R}"/><g stroke="${W}" stroke-width="2.4">${Array.from({ length: 7 }, (_, i) => `<path d="M240 ${254 + i * 16}h120"/>`).join('')}</g></g>
  <!-- tam giác -->
  <rect x="360" y="240" width="120" height="120" fill="${N}"/><path d="M360 360l120-120v120z" fill="${Y}"/><path d="M420 360l60-60v60z" fill="${G}"/>
</svg>`;
}
