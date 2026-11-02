// Ambientación pixel-art: partículas del mundo, fondos de combate y de la pantalla de título, y los
// paneles/barras que se dibujan en el lienzo. Las capas fijas se pintan una vez en un lienzo aparte;
// cada cuadro solo añade lo animado (luciérnagas, hojas, antorchas, estrellas).
import { hash } from './tiles.js';

export const FONT = '"Pixelify Sans", ui-monospace, monospace';
const W = 640;
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const P = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const snap = (v) => Math.round(v / 2) * 2;
const wrap = (v, m) => ((v % m) + m) % m;
const cache = {};
const layer = (key, h, paint) => (cache[key] ??= (() => { const cv = canvas(W, h); paint(cv.getContext('2d')); return cv; })());

/* ── Partículas ── */

/** Motas flotantes (luciérnagas, polvo, polen). rgb = "r,g,b"; glow añade un halo tenue. */
export function motes(c, t, cam, vw, vh, n, rgb, { glow = false, rise = 0, seed = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const h1 = hash(i, 5 + seed), h2 = hash(i, 9 + seed);
    const x = snap(wrap(h1 * vw + Math.sin(t / (900 + h2 * 600) + i) * 30 - cam.x * 0.4, vw));
    const y = snap(wrap(h2 * vh + Math.cos(t / (1100 + h1 * 500) + i) * 24 - t * rise - cam.y * 0.4, vh));
    const a = 0.3 + 0.7 * Math.max(0, Math.sin(t / 500 + i * 1.7));
    if (glow) P(c, `rgba(${rgb},${(a * 0.22).toFixed(2)})`, x - 2, y - 2, 6, 6);
    P(c, `rgba(${rgb},${a.toFixed(2)})`, x, y, 2, 2);
  }
}

function rays(c, cam, t, vw, vh) {
  c.fillStyle = 'rgba(255,240,180,.035)';
  for (let i = 0; i < 3; i++) {
    const x = wrap(i * 260 - cam.x * 0.15 + Math.sin(t / 4000 + i) * 20, vw + 300) - 200;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 70, 0); c.lineTo(x + 250, vh); c.lineTo(x + 180, vh); c.fill();
  }
}

function leaves(c, cam, t, vw, vh) {
  for (let i = 0; i < 7; i++) {
    const h1 = hash(i, 11), h2 = hash(i, 23);
    const x = snap(wrap(h1 * vw + Math.sin(t / 700 + i * 2) * 18 + t * 0.012 - cam.x * 0.6, vw));
    const y = snap(wrap(h2 * vh + t * (0.02 + h2 * 0.02) - cam.y * 0.6, vh));
    c.fillStyle = i % 3 ? '#5aa452' : '#c8a040';
    c.fillRect(x, y, 4, 2); c.fillRect(x + (Math.sin(t / 300 + i) > 0 ? 2 : 0), y + 2, 2, 2);
  }
}

/** Capa de ambiente sobre el mundo según el "mood" de la zona. cam = desplazamiento de la cámara. */
export function drawAmbient(c, mood, t, cam, vw, vh) {
  if (mood === 'forest') {
    rays(c, cam, t, vw, vh); leaves(c, cam, t, vw, vh);
    motes(c, t, cam, vw, vh, 9, '255,240,140', { glow: true });
  } else if (mood === 'town') {
    P(c, 'rgba(255,225,160,.05)', 0, 0, vw, vh);
    motes(c, t, cam, vw, vh, 10, '255,250,220', { rise: 0.01 });
  } else if (mood === 'temple') {
    motes(c, t, cam, vw, vh, 14, '140,200,255', { glow: true, rise: 0.006 });
  }
}

/* ── Piezas de escenario ── */

/** Degradado en franjas, con un tramado de damero en cada cambio de color. */
function bands(c, cols, y0, y1) {
  const h = (y1 - y0) / cols.length;
  cols.forEach((col, i) => P(c, col, 0, Math.round(y0 + i * h), W, Math.ceil(h) + 1));
  for (let i = 1; i < cols.length; i++) {
    const y = Math.round(y0 + i * h) - 2;
    c.fillStyle = cols[i]; for (let x = (i % 2) * 2; x < W; x += 4) c.fillRect(x, y, 2, 2);
    c.fillStyle = cols[i - 1]; for (let x = ((i + 1) % 2) * 2; x < W; x += 4) c.fillRect(x, y + 2, 2, 2);
  }
}

function hills(c, col, base, amp, f1, f2, bottom, seed) {
  for (let x = 0; x < W; x += 4) {
    const y = Math.round((base + Math.sin(x / f1 + seed) * amp + Math.sin(x / f2 + seed * 2) * amp * 0.4) / 4) * 4;
    P(c, col, x, y, 4, bottom - y);
  }
}

/** Abeto escalonado de tres pisos con la punta en (x,y). */
function pine(c, x, y, h, col, u = 4) {
  const rows = Math.round(h / u), tier = Math.ceil(rows / 3);
  for (let i = 0; i < rows; i++) {
    const hw = Math.round(((i % tier) + 1 + Math.floor(i / tier) * 1.5) * 0.7) * u;
    P(c, col, x - hw, y + i * u, hw * 2, u);
  }
  P(c, col, x - u, y + rows * u, u * 2, u * 3);
}

function circle(c, col, cx, cy, r, u = 4) {
  for (let dy = -r; dy <= r; dy += u) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) / u) * u;
    P(c, col, cx - hw, cy + dy, hw * 2, u);
  }
}

function tufts(c, n, y0, y1, light, dark, seed) {
  for (let i = 0; i < n; i++) {
    const x = snap(hash(i, seed) * W), y = snap(y0 + hash(i, seed + 1) * (y1 - y0));
    P(c, light, x, y, 2, 4); P(c, light, x + 4, y + 2, 2, 2); P(c, dark, x, y + 4, 6, 2);
  }
}

/* ── Fondos de combate (640x320; el panel de órdenes tapa el resto) ── */

function frameTree(c, x) { // árbol cercano que enmarca la escena
  P(c, '#140d08', x - 14, 0, 28, 240);
  P(c, '#3a2616', x - 12, 0, 24, 238); P(c, '#5a3c22', x - 12, 0, 6, 238); P(c, '#24160c', x + 8, 0, 4, 238);
  P(c, '#3a2616', x - 20, 228, 10, 8); P(c, '#3a2616', x + 10, 230, 10, 6);
  circle(c, '#0f2a14', x, 10, 76); circle(c, '#1f5426', x, 6, 72); circle(c, '#2a6e30', x - 8, -4, 56); circle(c, '#3d8a40', x - 18, -14, 34);
  for (let i = 0; i < 6; i++) P(c, '#5aa452', snap(x - 50 + hash(i, x) * 70), snap(10 + hash(i, x + 1) * 40), 4, 4);
}

function forestBattle(c) {
  bands(c, ['#0e2418', '#123020', '#173b26', '#1d472c', '#245433'], 0, 232);
  hills(c, '#1a3a24', 150, 14, 60, 23, 232, 1);
  for (let i = 0; i < 18; i++) pine(c, i * 38 + ((hash(i, 3) * 20) | 0), 104 + ((hash(i, 4) * 36) | 0), 100 + ((hash(i, 5) * 30) | 0), '#163220');
  hills(c, '#1d4028', 196, 8, 40, 17, 236, 4);
  for (let i = 0; i < 12; i++) pine(c, i * 58 + ((hash(i, 7) * 24) | 0) - 10, 142 + ((hash(i, 8) * 30) | 0), 84, '#12291a');
  P(c, '#3a6b3a', 0, 232, W, 88); // suelo
  for (let i = 0; i < 260; i++) P(c, hash(i, 6) < 0.5 ? '#33603a' : '#447a42', snap(hash(i, 1) * W), snap(236 + hash(i, 2) * 84), 2 + ((hash(i, 4) * 3) | 0) * 2, 2);
  for (let x = 0; x < W; x += 2) P(c, '#4f8a48', x, hash(x, 9) < 0.3 ? 228 : 230, 2, 4);
  P(c, '#2b522c', 0, 234, W, 2);
  for (let i = 0; i < 9; i++) P(c, 'rgba(255,240,180,.05)', 120 + i * 4 * (i < 5 ? 1 : 0), 248 + i * 4, 420 - i * 8 * (i < 5 ? 1 : 0), 4); // claro iluminado
  tufts(c, 40, 240, 312, '#5c9e4c', '#2e5e2c', 30);
  for (let i = 0; i < 8; i++) { const x = snap(hash(i, 40) * W), y = snap(244 + hash(i, 41) * 64); P(c, i % 2 ? '#e8e070' : '#c890e0', x, y, 2, 2); }
  frameTree(c, 18); frameTree(c, 622);
}

function pillar(c, x) {
  P(c, '#0a0d16', x - 22, 20, 44, 214);
  P(c, '#3a4560', x - 20, 22, 40, 210); P(c, '#4a5674', x - 20, 22, 8, 210); P(c, '#2a3248', x + 12, 22, 8, 210);
  P(c, '#2e3850', x - 6, 40, 2, 180); P(c, '#2e3850', x + 4, 40, 2, 180);
  P(c, '#0a0d16', x - 28, 12, 56, 18); P(c, '#4a5674', x - 26, 14, 52, 14); P(c, '#5c6a8a', x - 26, 14, 52, 2);
  P(c, '#0a0d16', x - 28, 222, 56, 14); P(c, '#4a5674', x - 26, 224, 52, 10); P(c, '#5c6a8a', x - 26, 224, 52, 2);
  P(c, '#0a0d16', x - 4, 114, 8, 14); P(c, '#6a5a3a', x - 2, 116, 4, 10); // soporte de antorcha
}
const PILLARS = [70, 250, 390, 570];

function templeBattle(c) {
  P(c, '#141a2a', 0, 0, W, 232);
  for (let row = 0; row < 29; row++) { // muro de bloques
    const y = row * 8, off = row % 2 ? 12 : 0;
    P(c, '#0e1220', 0, y + 7, W, 1);
    for (let x = off - 24; x < W; x += 24) { P(c, '#0e1220', x, y, 2, 7); if (hash(x, row) < 0.15) P(c, 'rgba(255,255,255,.035)', x + 2, y, 22, 7); }
  }
  P(c, '#0a0d16', 0, 94, W, 20); P(c, '#232c44', 0, 96, W, 16); // friso de glifos
  for (let x = 8; x < W; x += 32) { P(c, '#3a4a6a', x, 100, 10, 2); P(c, '#3a4a6a', x, 100, 2, 8); P(c, '#3a4a6a', x + 8, 104, 2, 4); P(c, '#3a4a6a', x + 16, 102, 6, 6); }
  PILLARS.forEach((x) => pillar(c, x));
  for (let y = 232, h = 8, row = 0; y < 320; y += h, h += 4, row++) { // losas del suelo
    P(c, row % 2 ? '#2a3550' : '#2e3a56', 0, y, W, h); P(c, '#1a2238', 0, y, W, 2); P(c, '#3c4a6c', 0, y + 2, W, 1);
    const step = 40 + row * 14;
    for (let x = (row % 2) * (step >> 1); x < W; x += step) P(c, '#1a2238', x, y, 2, h);
  }
}

function torches(c, t) {
  for (const [i, x] of PILLARS.entries()) {
    const f = Math.sin(t / 90 + i * 2) > 0 ? 2 : 0, a = 0.1 + Math.sin(t / 140 + i) * 0.03;
    circle(c, `rgba(90,170,255,${a.toFixed(3)})`, x, 104, 44); circle(c, `rgba(90,170,255,${(a * 1.4).toFixed(3)})`, x, 104, 24);
    P(c, '#2a6ad0', x - 4, 102 - f, 8, 12 + f); P(c, '#6ab4ff', x - 2, 98 - f, 4, 14 + f); P(c, '#e0f2ff', x - 2, 106, 4, 6);
  }
}

/** Fondo de un combate: bosque, o templo con antorchas de fuego azul. */
export function drawBattleBackdrop(c, temple, t) {
  if (temple) {
    c.drawImage(layer('temple', 320, templeBattle), 0, 0);
    torches(c, t);
    motes(c, t, { x: 0, y: 0 }, W, 320, 12, '140,200,255', { glow: true, rise: 0.006 });
  } else {
    c.drawImage(layer('forest', 320, forestBattle), 0, 0);
    drawAmbient(c, 'forest', t, { x: 0, y: 0 }, W, 300);
  }
}

/* ── Pantalla de título (bosque nocturno) ── */

function titleScene(c) {
  bands(c, ['#070f14', '#0a1619', '#0d1f1c', '#11291f', '#153322', '#1a3d26'], 0, 360);
  circle(c, 'rgba(232,240,216,.05)', 120, 92, 60); circle(c, 'rgba(232,240,216,.08)', 120, 92, 44); // luna
  circle(c, '#e8f0d8', 120, 92, 28); circle(c, '#c8d4b8', 110, 84, 6, 2); circle(c, '#d4dec4', 132, 102, 5, 2); circle(c, '#d4dec4', 124, 76, 3, 2);
  hills(c, '#10261a', 250, 22, 90, 31, 480, 2);
  for (let i = 0; i < 22; i++) pine(c, i * 32 + ((hash(i, 13) * 16) | 0), 214 + ((hash(i, 14) * 40) | 0), 110, '#0d2116');
  hills(c, '#0c1f14', 330, 12, 50, 19, 480, 5);
  for (let i = 0; i < 14; i++) pine(c, i * 50 + ((hash(i, 15) * 20) | 0), 262 + ((hash(i, 16) * 40) | 0), 150, '#0a1a10');
  P(c, '#081409', 0, 424, W, 56);
  for (let x = 0; x < W; x += 2) P(c, '#0e2214', x, hash(x, 3) < 0.35 ? 418 : 422, 2, 6);
  pine(c, 36, 120, 320, '#050d07', 6); pine(c, 616, 150, 300, '#050d07', 6);
}

export function drawTitleScene(c, t) {
  c.drawImage(layer('title', 480, titleScene), 0, 0);
  for (let i = 0; i < 40; i++) { // estrellas que titilan
    const x = snap(hash(i, 70) * W), y = snap(hash(i, 71) * 220);
    if (Math.hypot(x - 120, y - 92) < 64) continue;
    const a = 0.35 + 0.65 * Math.max(0, Math.sin(t / (600 + hash(i, 72) * 900) + i));
    P(c, `rgba(232,240,216,${a.toFixed(2)})`, x, y, 2, 2);
    if (hash(i, 73) < 0.15 && a > 0.8) { P(c, 'rgba(232,240,216,.4)', x - 2, y, 6, 2); P(c, 'rgba(232,240,216,.4)', x, y - 2, 2, 6); }
  }
  motes(c, t, { x: 0, y: 0 }, W, 480, 16, '200,255,140', { glow: true, seed: 3 });
}

/* ── Interfaz en el lienzo ── */

/** Panel con esquinas recortadas y borde de 2 px, como los paneles HTML. */
export function pixelPanel(c, x, y, w, h, line = '#4b7a52', fill = '#101c14') {
  P(c, '#050906', x + 2, y - 2, w - 4, h + 4); P(c, '#050906', x - 2, y + 2, w + 4, h - 4); P(c, '#050906', x, y, w, h);
  P(c, line, x, y + 2, w, h - 4); P(c, line, x + 2, y, w - 4, h);
  P(c, fill, x + 2, y + 2, w - 4, h - 4);
}

/** Barra de vida/energía con brillo superior. */
export function pixelBar(c, x, y, w, h, frac, col, back = '#1a1210') {
  const f = Math.round((w * Math.max(0, Math.min(1, frac))) / 2) * 2;
  P(c, '#050906', x - 2, y - 2, w + 4, h + 4); P(c, back, x, y, w, h);
  P(c, col, x, y, f, h); P(c, 'rgba(255,255,255,.28)', x, y, f, 2); P(c, 'rgba(0,0,0,.25)', x, y + h - 2, f, 2);
}
