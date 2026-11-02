// Suelo del mundo en pixel-art, pre-renderizado una vez por zona en dos capas:
//  bg — hierba, senderos, piedra, agua, troncos…
//  fg — copas de los árboles y el frente de los arbustos, que se dibujan encima de los personajes
//       para que pasen "detrás" de los árboles y queden medio ocultos en la maleza.
// Cada tile mide 16x16 píxeles de arte de 2 px (32 px en pantalla).
const U = 2;
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

export const hash = (x, y) => { let h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

const FOREST = {
  grass: ['#3e7a3a', '#3a7236', '#44823f'], blade: '#5c9e4c', bladeD: '#2e5e2c', flowers: ['#e8e070', '#c890e0'], flowerRate: 0.07,
  path: ['#a8895a', '#917448', '#bc9e6c'], dirt: ['#8c6d46', '#735738', '#a2845a'],
  stone: ['#8a8f99', '#6c717b', '#a8adb6', '#4e535c'], wall: ['#5a5f6a', '#444852', '#727884', '#2a2d34'], moss: '#4a7a3a',
  leaf: ['#2a6e30', '#1f5426', '#3d8a40', '#5aa452', '#0f2a14'], bush: ['#2e7232', '#215626', '#4a944a'], berry: '#c04a6a',
  water: ['#2f6fb0', '#285f9a', '#5aa0e0', '#a8d8f8'],
};
const MOODS = {
  forest: FOREST,
  town: {
    ...FOREST,
    grass: ['#5c9c48', '#559340', '#64a54f'], blade: '#80c060', bladeD: '#43803a', flowers: ['#f4d65a', '#f294b8', '#fafafa', '#9ac8f4'], flowerRate: 0.18,
    path: ['#cfac72', '#b8955e', '#e2c690'], dirt: ['#a07a4c', '#84623c', '#b89464'],
    stone: ['#9aa0aa', '#7a808a', '#bcc2ca', '#5c616b'], moss: null,
    leaf: ['#3a8a3e', '#2a6a30', '#56a852', '#7cc46a', '#163a1a'], bush: ['#3f9244', '#2c6e32', '#62b45c'], berry: '#f294b8',
    water: ['#3a7cc0', '#2f6aa8', '#68b0ea', '#c8e8fa'],
  },
  temple: {
    ...FOREST,
    grass: ['#2a2a33', '#272730', '#2e2e38'], blade: '#34343e', bladeD: '#202028', flowers: [], flowerRate: 0,
    path: ['#3a3a44', '#32323b', '#44444f'], dirt: ['#3a3a44', '#32323b', '#44444f'],
    stone: ['#4a4c5a', '#3a3c48', '#5c5f6e', '#2a2b34'], wall: ['#343646', '#272936', '#444758', '#15151c'], moss: '#2e4a40',
    water: ['#1d4f8a', '#173f70', '#3f86d0', '#7ab8ee'],
  },
};
const mood = (z) => MOODS[z.mood] ?? FOREST;

export function renderTiles(z, TS) {
  const bg = canvas(z.w * TS, z.h * TS), fg = canvas(z.w * TS, z.h * TS);
  const b = bg.getContext('2d'), f = fg.getContext('2d');
  const M = mood(z), at = (x, y) => z.tiles[y]?.[x];
  const soft = (t) => t === 0 || t === 1 || t === 4; // hierba y lo que crece sobre ella
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
    const t = at(x, y), X = x * TS, Y = y * TS, r = rng(hash(x, y) * 4294967296);
    const pen = (c) => (col, px, py, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(X + px * U, Y + py * U, w * U, h * U); };
    const p = pen(b), q = pen(f);
    const nb = (test) => ({ n: test(at(x, y - 1)), s: test(at(x, y + 1)), w: test(at(x - 1, y)), e: test(at(x + 1, y)) });
    switch (t) {
      case 3: ground(p, r, M.path, M, nb(soft)); break;
      case 7: ground(p, r, M.dirt, M, nb(soft)); break;
      case 5: stone(p, r, M); break;
      case 6: wall(p, r, M, nb((n) => n !== 6 && n !== undefined)); break;
      case 2: water(p, r, M, nb((n) => n !== 2 && n !== undefined)); break;
      case 8: pit(p, r, nb((n) => n !== 8)); break;
      default: grass(p, r, M);
    }
    if (t === 1) tree(p, q, r, M);
    if (t === 4) bush(p, q, r, M);
    if (t !== 6 && at(x, y - 1) === 6) p('rgba(0,0,0,.3)', 0, 0, 16, 3); // sombra al pie de los muros
  }
  return { bg, fg };
}

function grass(p, r, M) {
  const [g0, g1, g2] = M.grass;
  p(g0, 0, 0, 16, 16);
  for (let i = 0; i < 12; i++) p(i & 1 ? g1 : g2, (r() * 16) | 0, (r() * 16) | 0, 1 + ((r() * 2) | 0), 1);
  for (let i = 0, n = 1 + ((r() * 3) | 0); i < n; i++) { // matas de hierba
    const x = 1 + ((r() * 12) | 0), y = 3 + ((r() * 11) | 0);
    p(M.bladeD, x, y + 1, 3, 1); p(M.blade, x, y); p(M.blade, x + 2, y); p(M.blade, x + 1, y - 1);
  }
  if (r() < M.flowerRate) {
    const x = 2 + ((r() * 11) | 0), y = 2 + ((r() * 11) | 0), col = M.flowers[(r() * M.flowers.length) | 0];
    p(col, x, y - 1); p(col, x - 1, y); p(col, x + 1, y); p(col, x, y + 1); p('#f8e8a0', x, y);
  }
  if (r() < 0.1) { const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0); p(M.stone[1], x, y + 1, 2, 1); p(M.stone[2], x, y, 2, 1); }
}

function ground(p, r, [base, dark, light], M, nb) {
  p(base, 0, 0, 16, 16);
  for (let i = 0; i < 14; i++) p(r() < 0.55 ? dark : light, (r() * 16) | 0, (r() * 16) | 0);
  for (let i = 0, n = (r() * 3) | 0; i < n; i++) { // piedritas
    const x = 1 + ((r() * 13) | 0), y = 1 + ((r() * 13) | 0);
    p(dark, x, y + 1, 2, 1); p(light, x, y, 2, 1);
  }
  const g = M.grass[0];
  for (let i = 0; i < 16; i++) { // borde irregular donde empieza la hierba
    if (nb.n) { const d = 1 + ((r() * 2) | 0); p(g, i, 0, 1, d); p(dark, i, d); }
    if (nb.s) { const d = 1 + ((r() * 2) | 0); p(g, i, 16 - d, 1, d); }
    if (nb.w) { const d = 1 + ((r() * 2) | 0); p(g, 0, i, d, 1); }
    if (nb.e) { const d = 1 + ((r() * 2) | 0); p(g, 16 - d, i, d, 1); }
  }
}

function stone(p, r, M) { // losas en hileras desplazadas, continuas entre tiles
  const [base, dark, light, mortar] = M.stone;
  p(base, 0, 0, 16, 16);
  for (let row = 0; row < 2; row++) {
    const y0 = row * 8;
    for (let sx = row ? -4 : 0; sx < 16; sx += 8) {
      const x0 = Math.max(0, sx), w = Math.min(16, sx + 8) - x0, v = r();
      if (v < 0.3) p('rgba(0,0,0,.08)', x0, y0, w, 7); else if (v > 0.8) p('rgba(255,255,255,.06)', x0, y0, w, 7);
      p(light, x0, y0, w, 1); p(mortar, x0, y0 + 7, w, 1);
      if (sx >= 0) p(mortar, sx, y0, 1, 8);
      if (r() < 0.15) { const cx = x0 + 1 + ((r() * Math.max(1, w - 3)) | 0); p(dark, cx, y0 + 2, 1, 2); p(dark, cx + 1, y0 + 4, 1, 2); }
      if (M.moss && r() < 0.18) p(M.moss, x0 + ((r() * (w - 1)) | 0), y0 + 6, 2, 1);
    }
  }
}

function wall(p, r, M, open) { // open: lados que dan a un suelo
  const [face, dark, light, top] = M.wall;
  if (open.s) { // cara frontal de ladrillo
    p(face, 0, 0, 16, 16);
    for (let row = 0; row < 4; row++) {
      const y0 = row * 4, off = row % 2 ? 4 : 0;
      p(light, 0, y0, 16, 1); p(dark, 0, y0 + 3, 16, 1);
      for (let sx = off; sx < 16; sx += 8) p(dark, sx, y0, 1, 4);
      if (r() < 0.25) p('rgba(0,0,0,.12)', (r() * 12) | 0, y0 + 1, 4, 2);
    }
    p('rgba(0,0,0,.3)', 0, 14, 16, 2);
  } else { // parte superior del muro / roca maciza
    p(top, 0, 0, 16, 16);
    for (let i = 0; i < 5; i++) p('rgba(255,255,255,.035)', (r() * 14) | 0, (r() * 14) | 0, 2, 2);
  }
  if (open.n) p(light, 0, 0, 16, 1);
  if (open.w) p(light, 0, 0, 1, open.s ? 14 : 16);
  if (open.e) p(dark, 15, 0, 1, open.s ? 14 : 16);
}

function water(p, r, M, land) {
  const [base, deep, , foam] = M.water;
  p(base, 0, 0, 16, 16);
  for (let i = 0; i < 5; i++) p(deep, (r() * 13) | 0, (r() * 16) | 0, 3 + ((r() * 3) | 0), 1);
  if (land.n) p('rgba(0,0,0,.28)', 0, 0, 16, 2); // sombra de la orilla
  for (let i = 0; i < 16; i++) { // espuma
    if (land.n && r() < 0.8) p(foam, i, 2);
    if (land.s && r() < 0.8) p(foam, i, 15);
    if (land.w && r() < 0.8) p(foam, 0, i);
    if (land.e && r() < 0.8) p(foam, 15, i);
  }
}

function pit(p, r, edge) {
  p('#120c06', 0, 0, 16, 16);
  for (let i = 0; i < 6; i++) p(r() < 0.5 ? '#1e140a' : '#0c0804', (r() * 15) | 0, (r() * 15) | 0, 2, 1);
  if (r() < 0.2) { const x = 2 + ((r() * 11) | 0), y = 6 + ((r() * 8) | 0); p('#2a1e12', x, y, 3, 2); p('#3a2a1a', x, y, 2, 1); } // piedra caída
  if (edge.n) { // pared de tierra que se pierde en la oscuridad
    ['#7a5634', '#5e4228', '#4a321c', '#382614', '#281a0c', '#1c1208'].forEach((col, i) => p(col, 0, i, 16, 1));
    for (let i = 0; i < 3; i++) p('#2a1a0c', (r() * 15) | 0, 1, 1, 2 + ((r() * 3) | 0)); // raíces
  }
  if (edge.w) p('rgba(255,220,160,.08)', 0, 0, 1, 16);
  if (edge.e) p('rgba(0,0,0,.4)', 15, 0, 1, 16);
  if (edge.s) p('#3a2614', 0, 15, 16, 1);
}

// Copa: [inicio, ancho] de cada fila, 20 píxeles de ancho; sobresale del tile por arriba y a los lados.
const CANOPY = [[6, 8], [3, 14], [2, 16], [1, 18], [0, 20], [0, 20], [0, 20], [0, 20], [0, 20], [0, 20], [1, 18], [1, 18], [2, 16], [4, 12], [7, 6]];
function tree(p, q, r, M) {
  const [base, dark, light, hi, ol] = M.leaf;
  p('rgba(0,0,0,.25)', 2, 13, 13, 3);
  p('#3a2616', 6, 5, 4, 11); p('#5a3c22', 6, 5, 2, 11); p('#24160c', 9, 5, 1, 11); // tronco
  p('#3a2616', 5, 14, 1, 2); p('#3a2616', 10, 14, 1, 2);
  const L = -2, T = -7 - ((r() * 2) | 0);
  CANOPY.forEach(([s, w], i) => { q(ol, L + s - 1, T + i, w + 2, 1); q(ol, L + s, T + i - 1, w, 3); });
  CANOPY.forEach(([s, w], i) => { q(i > 9 ? dark : base, L + s, T + i, w, 1); if (i > 2) q(dark, L + s + w - 2, T + i, 2, 1); });
  for (let i = 0; i < 5; i++) { const x = L + 3 + ((r() * 10) | 0), y = T + 2 + ((r() * 6) | 0); q(light, x, y, 3, 2); q(hi, x, y); }
  for (let i = 0; i < 4; i++) q(dark, L + 3 + ((r() * 13) | 0), T + 7 + ((r() * 5) | 0), 2, 1);
}

const BUSH = [[5, 6], [3, 10], [2, 12], [1, 14], [1, 14], [1, 14], [1, 14], [2, 12], [3, 10]]; // filas desde y=6
function bush(p, q, r, M) {
  const [base, dark, light] = M.bush, ol = M.leaf[4];
  const spots = Array.from({ length: 5 }, () => [2 + ((r() * 11) | 0), 7 + ((r() * 6) | 0), r() < 0.4]);
  const draw = (P, from) => { // from: primera fila que se pinta (el frente va en la capa fg)
    BUSH.forEach(([s, w], i) => { if (i >= from) { P(ol, s - 1, 6 + i, w + 2, 1); if (i > from || !from) P(ol, s, 5 + i, w, 3); } });
    BUSH.forEach(([s, w], i) => { if (i >= from) { P(i > 5 ? dark : base, s, 6 + i, w, 1); if (i === 1 || i === 2) P(light, s + 2, 6 + i, 3, 1); } });
    spots.forEach(([x, y, berry]) => { if (y >= 6 + from) P(berry ? M.berry : light, x, y, berry ? 1 : 2, 1); });
  };
  p('rgba(0,0,0,.25)', 2, 14, 13, 2);
  draw(p, 0); draw(q, 4);
}

/** Destellos que se desplazan sobre el agua visible. */
export function drawWaterFx(c, z, TS, cam, t, vw, vh) {
  c.fillStyle = mood(z).water[2];
  const x0 = Math.max(0, Math.floor(cam.x / TS)), y0 = Math.max(0, Math.floor(cam.y / TS));
  const x1 = Math.min(z.w, Math.ceil((cam.x + vw) / TS)), y1 = Math.min(z.h, Math.ceil((cam.y + vh) / TS));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (z.tiles[y][x] !== 2) continue;
    const h = hash(x, y);
    for (let i = 0; i < 2; i++) {
      const k = (t / 2200 + h + i * 0.5) % 1;
      c.globalAlpha = Math.sin(k * Math.PI) * 0.9;
      c.fillRect(x * TS + 2 * Math.round(1 + h * 7 + k * 4), y * TS + 2 * (3 + ((((h * 97) | 0) + i * 5) % 11)), 6, 2);
    }
  }
  c.globalAlpha = 1;
}
