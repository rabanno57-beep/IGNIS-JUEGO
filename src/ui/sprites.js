// Sprites pixel-art dibujados con rectángulos (sin archivos de imagen).
// Cada personaje se "hornea" una sola vez a escala 1 en un lienzo pequeño (con volumen en los bordes
// y contorno oscuro) y luego se dibuja ampliado sin suavizado: píxeles nítidos a cualquier escala.
// Cada clase de mercenario tiene una silueta distinta para reconocerla de un vistazo.
const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
export const OUTLINE = '#140f0b';

const SW = 50, SH = 40, OX = 25, OY = 37; // lienzo de cada sprite y posición de los pies
const baked = new Map();

/** Dibuja un personaje de ~16x24 "píxeles" escalados por s. (x,y) = pies centrados. */
export function drawPerson(c, x, y, s, kind, o = {}) {
  if (kind === 'comandante') s *= 1.15; // el jefe es más grande
  const key = `${kind}|${o.face === 'w' ? 'w' : 'e'}|${o.pose ?? ''}|${o.step ?? -1}|${o.camo ? 1 : 0}`;
  let spr = baked.get(key);
  if (!spr) baked.set(key, (spr = bake(kind, o)));
  c.save();
  c.imageSmoothingEnabled = false;
  if (o.alpha != null) c.globalAlpha = o.alpha;
  const sx = (v) => Math.round(x + v * s), sy = (v) => Math.round(y + v * s);
  const shadow = (dx, dy, w, h) => c.fillRect(sx(dx), sy(dy), sx(dx + w) - sx(dx), sy(dy + h) - sy(dy));
  c.fillStyle = 'rgba(0,0,0,.28)'; // sombra elíptica
  shadow(-5, -3, 10, 1); shadow(-7, -2, 14, 2); shadow(-5, 0, 10, 1);
  const dx = sx(-OX), dy = sy(-OY);
  if (o.aura) {
    spr.glow ??= glow(spr.src, '#4aa0e0');
    const a = c.globalAlpha;
    c.globalAlpha = a * (0.5 + Math.sin(performance.now() / 260) * 0.2);
    c.drawImage(spr.glow, dx, dy, SW * s, SH * s);
    c.globalAlpha = a;
  }
  c.drawImage(spr, dx, dy, SW * s, SH * s);
  c.restore();
}

function bake(kind, o) {
  const cv = canvas(SW, SH), c = cv.getContext('2d', { willReadFrequently: true });
  const f = o.face === 'w' ? -1 : 1; // sólo espeja armas
  const px = (col, dx, dy, w, h) => R(c, col, OX + dx * f - (f < 0 ? w : 0), OY + dy, w, h);
  const flat = (col, dx, dy, w, h) => R(c, col, OX + dx, OY + dy, w, h);
  let camo = false;
  switch (kind) {
    case 'eduardo': eduardo(px, o.step); break;
    case 'rootknight': rootknight(px, o.step); camo = o.camo; break;
    case 'ximon': person(flat, '#c99a6b', '#c9a23a', '#3a3f55', '#1d1d1d'); break;
    case 'aldeano': person(flat, '#d9a877', '#b0508a', '#5a3f55', '#999'); break;
    case 'raso': case 'armado': case 'defensa': case 'explorador': case 'veterano': case 'comandante': case 'elite':
      soldier(px, LOOK[kind], o.pose, o.step); break;
    case 'marck': marck(px, o.step); break;
    default: person(flat, '#999', '#666', '#333', '#222');
  }
  if (camo) { // el traje se funde con el verde del bosque
    c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.45;
    c.fillStyle = '#2f6b3a'; c.fillRect(0, 0, SW, SH);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  shade(c);
  return outline(cv);
}

/** Volumen: aclara los bordes de arriba/izquierda y oscurece los de abajo/derecha de cada pieza. */
function shade(c) {
  const img = c.getImageData(0, 0, SW, SH), d = img.data, src = new Uint8ClampedArray(d);
  const solid = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH && src[(y * SW + x) * 4 + 3] > 0;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    if (!solid(x, y)) continue;
    const k = !solid(x + 1, y) || !solid(x, y + 1) ? 0.74 : !solid(x - 1, y) || !solid(x, y - 1) ? 1.2 : 1;
    if (k === 1) continue;
    const i = (y * SW + x) * 4;
    for (let j = 0; j < 3; j++) d[i + j] = Math.min(255, src[i + j] * k);
  }
  c.putImageData(img, 0, 0);
}

function tinted(src, col) {
  const cv = canvas(SW, SH), c = cv.getContext('2d');
  c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = col; c.fillRect(0, 0, SW, SH);
  return cv;
}

/** Contorno de 1 píxel alrededor de la silueta. Guarda el sprite sin contorno para el halo. */
function outline(src) {
  const sil = tinted(src, OUTLINE), cv = canvas(SW, SH), c = cv.getContext('2d');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.drawImage(sil, dx, dy);
  c.drawImage(src, 0, 0);
  cv.src = src;
  return cv;
}

/** Halo de ~3 píxeles alrededor de la silueta (aura del amuleto). */
function glow(src, col) {
  const t = tinted(src, col), cv = canvas(SW, SH), c = cv.getContext('2d');
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) <= 4) c.drawImage(t, dx, dy);
  return cv;
}

function person(flat, skin, shirt, pants, hair, k = 1) {
  flat(pants, -4 * k, -9, 3 * k, 9); flat(pants, 1 * k, -9, 3 * k, 9);
  flat(shirt, -5 * k, -19, 10 * k, 11);
  flat(shirt, -7 * k, -18, 2 * k, 8); flat(shirt, 5 * k, -18, 2 * k, 8);
  flat(skin, -4 * k, -26, 8 * k, 7);
  flat(hair, -4 * k, -27, 8 * k, 3);
}

/** Eduardo, civil (según sprites/eduardo.jpg): pelo negro, camisa celeste, pantalón caqui. step 0/1 = caminata. */
function eduardo(px, step = -1) {
  const SK = '#f0c8a0', HAIR = '#161616', SH = '#a8d0f0', SHD = '#80a8d0', PA = '#c8b48a', SHOE = '#1a1a1a';
  const a = step === 0 ? 1 : 0, b = step === 1 ? 1 : 0;
  px(PA, -4, -9 + a, 3, 8 - a); px(SHOE, -4, -2, 4, 2);
  px(PA, 1, -9 + b, 3, 8 - b); px(SHOE, 1, -2, 4, 2);
  px(SH, -5, -19, 10, 9); px('#3a2a1a', -5, -10, 10, 1); // camisa + cinturón
  px(SHD, -2, -19, 4, 1); px(SHD, 0, -17, 1, 1); px(SHD, 0, -14, 1, 1); px(SHD, 0, -12, 1, 1); // cuello y botones
  px(SH, -7, -18 + b, 2, 7); px(SHD, -7, -12 + b, 2, 1); px(SK, -7, -11 + b, 2, 2);
  px(SH, 5, -18 + a, 2, 7); px(SHD, 5, -12 + a, 2, 1); px(SK, 5, -11 + a, 2, 2);
  px(SK, -4, -26, 8, 7);
  px(HAIR, -5, -29, 10, 3); px(HAIR, -5, -26, 2, 4); px(HAIR, -3, -26, 4, 1); px(HAIR, 3, -27, 2, 1); // pelo con volumen
  px(HAIR, -1, -23, 1, 2); px(HAIR, 2, -23, 1, 2); px('#b07a5a', 0, -20, 2, 1);
}

/** Root Knight (según sprites/Root-Knight.png): capucha y capa verdes, máscara con visor ámbar, traje de camuflaje. */
function rootknight(px, step = -1) {
  const CL = '#3d6b2a', CLD = '#2a4a1d', BR = '#5a3a22', GR = '#4a6a2a', OR = '#9a5a20', BOOT = '#2a1d14', MASK = '#3a3530', VIS = '#f0a020';
  const a = step === 0 ? 1 : 0, b = step === 1 ? 1 : 0;
  px(CLD, -7, -20, 14, 17); px(CL, -7, -20, 2, 16); // capa
  px(BR, -4, -9 + a, 3, 8 - a); px(GR, -4, -6 + a, 2, 2); px(BOOT, -4, -2, 3, 2);
  px(BR, 1, -9 + b, 3, 8 - b); px(OR, 2, -7 + b, 2, 2); px(BOOT, 1, -2, 3, 2);
  px(BR, -5, -19, 10, 10); // traje de camuflaje
  px(GR, -4, -18, 3, 2); px(OR, 1, -16, 2, 2); px(GR, -2, -13, 3, 2); px('#6a4020', 2, -12, 2, 2); px(GR, -1, -19, 2, 4);
  px(CL, -7, -18 + b, 2, 7); px(BOOT, -7, -11 + b, 2, 2);
  px(CL, 5, -18 + a, 2, 7); px(BOOT, 5, -11 + a, 2, 2);
  px(CLD, -6, -30, 12, 11); px(CL, -5, -31, 9, 2); px(CL, -6, -29, 1, 8); // capucha
  px(MASK, -4, -27, 8, 7); px(VIS, -2, -26, 6, 2); px(VIS, 0, -24, 2, 2); px('#ffd060', -1, -26, 2, 1); // máscara y visor
}

/** Marck (según sprites/marck.png): pelo rubio oscuro, ojos azules, traje negro, camisa blanca y corbata roja. */
function marck(px, step = -1) {
  const SK = '#f8d8c0', HAIR = '#c49a60', HAIRL = '#dcb878', HAIRD = '#9a7440', SUIT = '#26262e', SUITL = '#3c3c48', PA = '#1e1e26', SHOE = '#0e0e12';
  const a = step === 0 ? 1 : 0, b = step === 1 ? 1 : 0;
  px(PA, -4, -9 + a, 3, 8 - a); px(SHOE, -4, -2, 4, 2);
  px(PA, 1, -9 + b, 3, 8 - b); px(SHOE, 1, -2, 4, 2);
  px(SUIT, -5, -19, 10, 11); px(SUITL, -5, -19, 1, 10); px(SUITL, 4, -19, 1, 10); px(SUITL, -1, -13, 2, 1); // saco con solapas
  px('#f0f0f0', -2, -19, 4, 2); px('#d02828', -1, -19, 2, 5); px('#a01818', -1, -15, 2, 1); // camisa y corbata
  px('#4aa0e0', 2, -15, 2, 2); // amuleto
  px(SUIT, -7, -18 + b, 2, 8); px(SK, -7, -10 + b, 2, 2);
  px(SUIT, 5, -18 + a, 2, 8); px(SK, 5, -10 + a, 2, 2);
  px(SK, -5, -28, 10, 9);
  px(HAIR, -6, -31, 12, 3); px(HAIR, -6, -28, 1, 5); px(HAIR, 5, -28, 1, 5); px(HAIR, -5, -28, 6, 1); // pelo con flequillo
  px(HAIRL, -3, -31, 3, 1); px(HAIRL, 1, -30, 2, 1); px(HAIRD, -2, -27, 1, 1);
  px('#2a6ad0', -3, -25, 2, 2); px('#6aa8f0', -3, -24, 2, 1); px('#2a6ad0', 2, -25, 2, 2); px('#6aa8f0', 2, -24, 2, 1); // ojos azules
  px('#c07868', -1, -21, 2, 1);
}

// Aspecto de cada clase de mercenario (según las hojas de sprites/).
const KHAKI = '#b8a070', BOOT = '#6a5a35', OLIVE = '#4a5240', OLIVE_L = '#5a6450', DARK = '#3a2418', DBEARD = '#1a100a';
const LOOK = {
  raso: { skin: '#c99a6b', beret: '#2f6b2f', beretL: '#3d8a3d', shirt: '#5a9a5a', shirtD: '#467a46', gun: 'rifle', charge: true },
  armado: { skin: '#c99a6b', beret: OLIVE, beretL: OLIVE_L, shirt: '#5a5f55', shirtD: '#4a4e45', gun: 'rifle', scope: true },
  defensa: { skin: '#c99a6b', beret: OLIVE, beretL: OLIVE_L, shirt: '#5a5f55', shirtD: '#4a4e45', shield: true },
  explorador: { skin: '#c99a6b', beret: OLIVE, beretL: OLIVE_L, shirt: '#d8c8a0', shirtD: '#c0b088', pants: '#a8986a', gun: 'smg', radio: true, binoculars: true },
  veterano: { skin: '#b98a5b', beard: '#e8e8e8', beret: OLIVE, beretL: OLIVE_L, shirt: '#1d1d1d', shirtD: '#141414', vest: '#7a6a45', vestD: '#5a4d30', pack: '#8a7a50', gun: 'ar' },
  comandante: { skin: DARK, eyes: '#0a0604', beard: DBEARD, beret: OLIVE, beretL: OLIVE_L, shirt: '#1d1d1d', shirtD: '#141414', sleeve: '#d03a30', vest: '#7a6a45', vestD: '#5a4d30', pack: '#8a7a50', gun: 'ar' },
  elite: { skin: DARK, eyes: '#0a0604', beard: DBEARD, beret: OLIVE, beretL: OLIVE_L, shirt: '#3a2a20', shirtD: '#2e2018', sleeve: '#5a5f65', vest: '#4a3428', vestD: '#2e2018', pads: '#7a7f85', pack: '#8a7a50', gun: 'ar' },
};

/**
 * Mercenario con boina. pose: 'charge' (prepara embestida) | 'aim' (apunta) | 'strike' (ataca) | 'guard' (se cubre)
 * | 'radio' (habla por radio) | 'search' (busca); step 0/1 = caminata.
 */
function soldier(px, L, pose, step = -1) {
  const SK = L.skin, SH = L.shirt, AR = L.sleeve || L.shirt, PA = L.pants || KHAKI, GUN = '#5a5a5a', GUND = '#3a3a3a', BLK = '#2a2a2a';
  if (pose === 'search') pose = L.binoculars ? 'binoculars' : 'radio';
  if (pose === 'charge' && !L.charge) pose = 'aim';
  if (L.shield && (pose === 'aim' || pose === 'radio')) pose = null;
  if (pose === 'guard' && !L.shield) pose = 'aim'; // sin escudo se cubre agachado
  const head = (dx, dy) => {
    px(SK, dx - 4, dy - 26, 8, 7);
    if (L.beard) { px(L.beard, dx - 4, dy - 21, 8, 2); px(L.beard, dx - 4, dy - 23, 1, 2); px(L.beard, dx + 3, dy - 23, 1, 2); }
    px(L.eyes || '#3a2a1a', dx - 1, dy - 23, 1, 2); px(L.eyes || '#3a2a1a', dx + 2, dy - 23, 1, 2);
    px(L.beret, dx - 5, dy - 29, 10, 3); px(L.beretL, dx - 4, dy - 30, 7, 1); px(L.beret, dx + 3, dy - 27, 3, 2); // boina caída al frente
  };
  const torso = (dx, dy) => {
    if (L.pack) { px(L.pack, dx - 8, dy - 18, 3, 9); px(L.vestD, dx - 8, dy - 14, 3, 1); }
    if (L.radio) { px('#4a4a30', dx - 8, dy - 18, 3, 7); px(BLK, dx - 8, dy - 23, 1, 5); }
    px(SH, dx - 5, dy - 19, 10, 11); px(L.shirtD, dx - 5, dy - 10, 10, 2);
    if (L.vest) { px(L.vest, dx - 4, dy - 18, 8, 9); px(L.vestD, dx - 3, dy - 15, 6, 1); px(L.vestD, dx - 3, dy - 12, 2, 2); px(L.vestD, dx + 1, dy - 12, 2, 2); }
  };
  const pads = (dx, dy) => { if (L.pads) { px(L.pads, dx - 6, dy - 19, 3, 3); px(L.pads, dx + 3, dy - 19, 3, 3); } };
  const gun = (dx, dy) => { // arma en horizontal hacia el frente
    if (L.gun === 'rifle') { px(GUND, dx - 6, dy - 15, 4, 3); px(GUN, dx - 2, dy - 15, 18, 2); if (L.scope) px(GUND, dx + 4, dy - 17, 4, 2); }
    else if (L.gun === 'smg') { px(BLK, dx, dy - 15, 10, 2); px(BLK, dx + 4, dy - 13, 2, 3); px(BLK, dx + 1, dy - 13, 1, 2); }
    else if (L.gun === 'ar') { px(BLK, dx - 5, dy - 15, 3, 3); px(BLK, dx - 2, dy - 15, 16, 2); px(BLK, dx + 5, dy - 13, 2, 3); px(BLK, dx + 3, dy - 17, 3, 1); px(BLK, dx + 14, dy - 15, 3, 1); }
  };
  const shield = (dx, dy, h) => { px('#a8c4dc', dx, dy, 7, h); px('#4a6a8a', dx + 1, dy + 1, 5, h - 2); px('#c8d0d8', dx + 2, dy + h / 2 - 1, 3, 2); px('#c8d0d8', dx + 2, dy + h / 2 - 2, 1, 1); px('#c8d0d8', dx + 4, dy + h / 2 - 2, 1, 1); };
  const kneel = () => { px(PA, -5, -6, 4, 6); px(PA, 1, -6, 4, 4); px(BOOT, -5, -1, 4, 1); px(BOOT, 3, -2, 3, 2); if (L.pads) px(L.pads, 2, -6, 3, 2); };
  const lunge = () => {
    px(PA, -7, -6, 4, 3); px(PA, -4, -8, 4, 4); px(BOOT, -8, -4, 2, 2);
    px(PA, 1, -9, 3, 5); px(PA, 3, -5, 3, 5); px(BOOT, 3, -1, 4, 1); if (L.pads) px(L.pads, 3, -5, 3, 2);
  };

  if (pose === 'guard' || (pose === 'strike' && L.shield)) { // agachado tras el escudo (o empujándolo)
    const k = pose === 'strike' ? 2 : 0;
    if (k) lunge(); else kneel();
    torso(k, 3); head(k, 3); px(AR, k + 3, -14, 3, 3);
    shield(k + 4, -23, 22);
    return;
  }
  if (pose === 'charge') { // agachado, fusil cruzado apuntando abajo-adelante
    kneel(); torso(0, 3); head(0, 3);
    px(GUND, -7, -8, 4, 3); px(GUN, -4, -10, 6, 2); px(GUN, 2, -12, 6, 2); px(GUN, 8, -14, 4, 2);
    px(AR, -6, -14, 3, 6); px(SK, -4, -9, 2, 2); px(AR, 3, -15, 3, 4); px(SK, 5, -13, 2, 2);
    return;
  }
  if (pose === 'aim' || pose === 'strike') { // apunta rodilla en tierra / dispara en estocada
    const st = pose === 'strike', dx = st ? 2 : 0, dy = st ? 0 : 3;
    if (st) lunge(); else kneel();
    torso(dx, dy); head(dx, dy);
    gun(dx - 2, dy);
    px(AR, dx - 5, dy - 17, 3, 4); px(SK, dx - 2, dy - 15, 2, 2); px(AR, dx + 2, dy - 17, 5, 3); px(SK, dx + 7, dy - 15, 2, 2);
    pads(dx, dy);
    if (st && L.gun) { const mx = L.gun === 'smg' ? dx + 8 : L.gun === 'ar' ? dx + 15 : dx + 14; px('#ffd23a', mx, dy - 16, 3, 3); px('#fff3b0', mx + 1, dy - 15, 1, 1); }
    return;
  }

  // reposo / caminata (también radio y binoculares, de pie)
  if (L.gun === 'rifle' || L.gun === 'ar') { px(L.gun === 'ar' ? BLK : GUN, -7, -21, 2, 14); px(GUND, -7, -9, 2, 2); }
  const a = step === 0 ? 1 : 0, b = step === 1 ? 1 : 0;
  px(PA, -4, -9 + a, 3, 8 - a); px(BOOT, -4, -2, 3, 2);
  px(PA, 1, -9 + b, 3, 8 - b); px(BOOT, 1, -2, 3, 2);
  if (L.pads) { px(L.pads, -4, -6 + a, 3, 2); px(L.pads, 1, -6 + b, 3, 2); }
  torso(0, 0);
  if (L.gun === 'smg') { px(BLK, 2, -11, 6, 2); px(BLK, 4, -9, 2, 2); }
  px(AR, -7, -18 + b, 2, 7); px(SK, -7, -11 + b, 2, 2);
  if (pose === 'radio') { px(AR, 4, -20, 3, 5); px(SK, 3, -23, 2, 2); px(BLK, 3, -26, 2, 4); px(BLK, 3, -29, 1, 3); }
  else if (pose !== 'binoculars') { px(AR, 5, -18 + a, 2, 7); px(SK, 5, -11 + a, 2, 2); }
  pads(0, 0);
  head(0, 0);
  if (pose === 'binoculars') { px(AR, -6, -19, 3, 3); px(AR, 4, -19, 3, 3); px(SK, -4, -22, 2, 2); px(SK, 3, -22, 2, 2); px(BLK, -3, -24, 7, 3); px('#6ac0e0', -2, -24, 2, 2); px('#6ac0e0', 2, -24, 2, 2); }
  if (L.shield) shield(4, -19, 16);
}

/* ── Objetos del mundo, en píxeles de arte de 2 px (la misma escala que los personajes en el mapa) ── */
const OL = OUTLINE;

/** Pinceles relativos a (x,y) con unidad u: P = rectángulo, box = con contorno, blob = esquinas redondeadas. */
export function painter(c, x, y, u = 2) {
  const P = (col, dx, dy, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x + Math.round(dx) * u, y + Math.round(dy) * u, w * u, h * u); };
  const box = (col, dx, dy, w, h) => { P(OL, dx - 1, dy - 1, w + 2, h + 2); P(col, dx, dy, w, h); };
  const blob = (col, bx, by, bw, bh, k = 2) => {
    for (let i = 0; i < bh; i++) { const s = Math.max(0, k - i, k - (bh - 1 - i)); P(col, bx + s, by + i, bw - 2 * s, 1); }
  };
  const oblob = (col, bx, by, bw, bh, k = 2) => { blob(OL, bx - 1, by - 1, bw + 2, bh + 2, k); blob(col, bx, by, bw, bh, k); };
  return { P, box, blob, oblob };
}

/** Aclara (k>0) u oscurece (k<0) un color #rrggbb. */
function tone(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
const SHADOW = 'rgba(0,0,0,.25)';

export function drawChest(c, x, y, open) {
  const { P, box } = painter(c, x, y);
  P(SHADOW, 2, 14, 12, 2);
  if (open) { box('#6b4423', 3, 2, 10, 4); P('#8a5a2e', 3, 2, 10, 1); }
  box('#8a5a2e', 2, 7, 12, 7); P('#a8723a', 2, 7, 12, 1); P('#6b4423', 2, 12, 12, 2);
  P('#d8b048', 4, 7, 1, 7); P('#d8b048', 11, 7, 1, 7);
  if (open) { P('#24160a', 3, 7, 10, 2); P('#ffe9a0', 6, 7); P('#ffe9a0', 9, 8); }
  else {
    box('#9a6634', 2, 4, 12, 3); P('#b88048', 2, 4, 12, 1); P('#d8b048', 4, 4, 1, 3); P('#d8b048', 11, 4, 1, 3);
    box('#f0d060', 7, 6, 2, 2); P('#6a4a10', 7, 7, 1, 1);
  }
}

export function drawSavepoint(c, x, y, on, t) {
  const { P, box } = painter(c, x, y), col = on ? '#7dff9a' : '#3f9f5a', g = on ? '125,255,154' : '63,159,90';
  P(SHADOW, 3, 14, 10, 2);
  box('#6c727c', 4, 11, 8, 4); P('#8a8f99', 4, 11, 8, 1);
  const fy = Math.sin(t / 300) * 1.5, a = 0.18 + Math.sin(t / 250) * 0.08;
  P(`rgba(${g},${a.toFixed(2)})`, 3, fy - 1, 10, 11); P(`rgba(${g},${(a * 1.6).toFixed(2)})`, 5, fy + 1, 6, 7);
  P(OL, 7, fy, 2, 1); P(OL, 6, fy + 1, 4, 1); P(OL, 5, fy + 2, 6, 4); P(OL, 6, fy + 6, 4, 1); P(OL, 7, fy + 7, 2, 1);
  P(col, 7, fy + 1, 2, 1); P(col, 6, fy + 2, 4, 4); P(col, 7, fy + 6, 2, 1);
  P('#eafff0', 7, fy + 2, 1, 2); P('rgba(0,0,0,.2)', 8, fy + 3, 2, 3);
}

export function drawHook(c, x, y, t) {
  const { P, box, oblob } = painter(c, x, y);
  P(SHADOW, 5, 14, 6, 2);
  box('#5a3c22', 7, 6, 2, 9); P('#7a5432', 7, 6, 1, 9);
  oblob('#3f8f4a', 4, 0, 8, 7, 2); P('#5ab060', 5, 1, 3, 1);
  P(`rgba(210,250,210,${(0.6 + Math.sin(t / 250) * 0.4).toFixed(2)})`, 7, 2, 2, 3);
}

/** Destello en cruz centrado en (x,y). */
export function drawSparkle(c, x, y, a, col = '#fff6a0') {
  const { P } = painter(c, Math.round(x / 2) * 2, Math.round(y / 2) * 2);
  c.save(); c.globalAlpha = Math.max(0, Math.min(1, a));
  P(col, 0, -2, 1, 5); P(col, -2, 0, 5, 1); P('#ffffff', 0, 0);
  c.restore();
}

const GLYPH = { '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['##.', '..#', '.#.', '...', '.#.'] };
/** Globo de "!" o "?" sobre un personaje; (x,y) = centro inferior aproximado. */
export function drawBubble(c, x, y, ch, col) {
  const { P, box } = painter(c, Math.round(x) - 7, Math.round(y) - 20);
  box('#fffaf0', 0, 0, 7, 8);
  P('#fffaf0', 3, 8); P(OL, 3, 9);
  GLYPH[ch].forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') P(col, 2 + i, 1 + j + 1); }));
}

export function drawProp(c, p, t) {
  const g = painter(c, p.x * 32, p.y * 32), w = p.w * 16, h = p.h * 16;
  switch (p.type) {
    case 'house': house(g, p.color, w, h); break;
    case 'fountain': fountain(g, w, h, t); break;
    case 'tent': tent(g, w, h); break;
    case 'machine': machine(g, w, h, t); break;
    case 'crate': for (let i = 0; i < p.w; i++) for (let j = 0; j < p.h; j++) crate(g, i * 16, j * 16); break;
    case 'sign': sign(g); break;
    case 'barricade': barricade(g, w, h); break;
    case 'door': door(g, w, h, t); break;
    case 'stele': stele(g); break;
    case 'altar': altar(g, w, h, t); break;
    case 'stairs': stairs(g, w, h); break;
    default: g.box('#888', 0, 0, w, h);
  }
}

function house({ P, box }, col, w, h) {
  const top = 18, dk = tone(col, -0.28), lt = tone(col, 0.18);
  P(SHADOW, 1, h - 1, w - 2, 2);
  box('#7a6a60', w - 18, -4, 5, 10); P('#958478', w - 18, -4, 5, 1); // chimenea
  box(col, 2, top, w - 4, h - top - 1);
  for (let yy = top + 4; yy < h - 1; yy += 4) P(dk, 2, yy, w - 4, 1); // tablones
  P(lt, 2, top, 1, h - top - 1);
  for (const wx of [7, w - 16]) { // ventanas iluminadas
    box('#f4e2a0', wx, top + 7, 9, 7); P('#e0c070', wx, top + 11, 9, 3);
    P(OL, wx, top + 10, 9, 1); P(OL, wx + 4, top + 7, 1, 7); P(dk, wx - 1, top + 15, 11, 1);
  }
  const dx = (w >> 1) - 5; // puerta
  box('#5a3420', dx, h - 16, 10, 15); P('#744828', dx + 1, h - 15, 3, 14); P('#3a2010', dx + 5, h - 16, 1, 15); P('#e8c860', dx + 7, h - 9);
  for (let i = 0; i < 20; i++) { // tejado de tejas
    const s = Math.max(0, 9 - i), x0 = -3 + s, rw = w + 6 - 2 * s;
    P(OL, x0 - 1, i, rw + 2, 1);
    P(i < 2 ? '#c06848' : i % 4 === 3 ? '#6e2f1c' : '#94452c', x0, i, rw, 1);
    if (i % 4 === 1) for (let sx = x0 + ((i >> 2) % 2) * 3 + 2; sx < x0 + rw - 1; sx += 6) P('#7a3622', sx, i, 1, 2);
  }
  P(OL, 5, -1, w - 10, 1); P(OL, -4, 20, w + 8, 1);
  P('rgba(0,0,0,.3)', 2, 21, w - 4, 2); // sombra del alero
}

function fountain({ P, box, blob, oblob }, w, h, t) {
  P(SHADOW, 2, h - 2, w - 4, 2);
  oblob('#a4aab4', 1, 10, w - 2, h - 12, 4);
  blob('#7c828c', 2, h - 8, w - 4, 5, 3);
  blob('#2a64a8', 4, 12, w - 8, h - 21, 3);
  const k = (t / 140) | 0;
  P('#5aa0e0', 6 + (k % 6), 15, 3, 1); P('#5aa0e0', 19 - (k % 5), 19, 4, 1);
  box('#8a909a', 14, 4, 4, 13); P('#a4aab4', 14, 4, 1, 13);
  oblob('#a4aab4', 11, 3, 10, 3, 1);
  for (let i = 0; i < 6; i++) { // gotas del chorro
    const q = (t / 600 + i / 6) % 1, side = i % 2 ? -1 : 1;
    P('#9ad0f5', 15.5 + side * (1 + q * 6), 2 - Math.sin(q * Math.PI) * 4 + q * 9);
  }
  P('#cfe8fa', 15, -1 + Math.sin(t / 180), 2, 4);
}

function tent({ P }, w, h) {
  const H = h - 3, cx = w >> 1, eh = (H * 0.55) | 0;
  P(SHADOW, 1, H, w - 2, 3);
  P('#5a4020', cx - 1, -3, 2, 3); P(OL, cx - 2, -1, 4, 1);
  for (let i = 0; i < H; i++) {
    const hw = Math.round(((i + 1) / H) * (cx - 2)) + 1;
    P(OL, cx - hw - 1, i, hw * 2 + 2, 1);
    P('#8e8e60', cx - hw, i, hw, 1); P('#6c6c46', cx, i, hw, 1);
    if (i > 2) P('#a4a470', cx - hw, i);
  }
  P(OL, 0, H, w, 1);
  for (let i = 0; i < eh; i++) { const hw = Math.max(1, Math.round(((i + 1) / eh) * (w / 7))); P('#2a2414', cx - hw, H - eh + i, hw * 2, 1); }
  P('#b8b080', cx - 1, 0, 1, H - eh); // costura
  P('#d8d0b0', 0, H - 2, 1, 2); P('#d8d0b0', w - 1, H - 2, 1, 2); // estacas
}

function machine({ P, box, oblob }, w, h, t) {
  const b = h - 2;
  P(SHADOW, 1, b, w - 2, 2);
  oblob('#3a3a3e', 2, b - 9, 34, 9, 3); P('#55555a', 4, b - 9, 30, 1); // orugas
  for (let k = 0; k < 4; k++) { P('#6a6a70', 5 + k * 8, b - 6, 4, 4); P('#2a2a2e', 6 + k * 8, b - 5, 2, 2); }
  box('#d8a828', 4, b - 22, 30, 12); P('#f0c848', 4, b - 22, 30, 2); P('#a87c18', 4, b - 12, 30, 2);
  for (let k = 0; k < 5; k++) P('#2a2a2a', 6 + k * 6, b - 17, 3, 2); // franjas de peligro
  box('#d8a828', 20, b - 34, 13, 12); P('#f0c848', 20, b - 34, 13, 1); // cabina
  box('#7ab4c8', 23, b - 31, 8, 6); P('#d8f0f8', 24, b - 30, 3, 2);
  box('#555', 7, b - 30, 2, 8); // escape y humo
  const sm = (t / 500) % 1; P(`rgba(200,200,200,${(0.5 * (1 - sm)).toFixed(2)})`, 6 - sm * 2, b - 33 - sm * 8, 3, 2);
  for (let k = 0; k < 12; k++) P(OL, 33 + k, b - 23 - k * 1.5, 3, 3); // brazo
  for (let k = 0; k < 12; k++) P('#c89820', 34 + k, b - 22 - k * 1.5, 2, 2);
  box('#6a6a70', 42, b - 42, 5, 6); P('#cccccc', 42, b - 36); P('#cccccc', 45, b - 36);
}

function crate({ P, box }, ox, oy) {
  P(SHADOW, ox + 1, oy + 14, 14, 2);
  box('#a07840', ox + 1, oy + 2, 14, 12);
  P('#c09858', ox + 1, oy + 2, 14, 1); P('#6a4a22', ox + 1, oy + 13, 14, 1);
  P('#7a5a2e', ox + 1, oy + 2, 1, 12); P('#7a5a2e', ox + 14, oy + 2, 1, 12);
  for (let k = 0; k < 10; k++) P('#7a5a2e', ox + 3 + k, oy + 3 + k);
}

function sign({ P, box }) {
  P(SHADOW, 4, 14, 8, 2);
  box('#5a3c22', 7, 8, 2, 7);
  box('#c8a868', 1, 1, 14, 8); P('#e0c488', 1, 1, 14, 1); P('#9a7a48', 1, 8, 14, 1);
  P('#6a4a2a', 3, 3, 9, 1); P('#6a4a2a', 3, 5, 6, 1); P('#888888', 2, 2); P('#888888', 13, 2);
}

function barricade({ P, box }, w, h) {
  for (const x of [1, 11]) { box('#5a3c22', x, 2, 3, h - 3); P('#7a5432', x, 2, 1, h - 3); P('#5a3c22', x + 1, 0, 1, 2); }
  for (let y = 6; y < h - 4; y += 12) { box('#8a6a3a', 0, y, w, 4); P('#a8844e', 0, y, w, 1); P('#c8a070', 0, y + 1, 1, 2); P('#c8a070', w - 1, y + 1, 1, 2); }
  for (let y = 12; y < h - 4; y += 12) for (let x = 0; x < w; x += 3) P('#b8b8b8', x, y + ((x / 3) % 2), 2, 1); // alambre
}

function door({ P, box }, w, h, t) {
  box('#5a5f69', 0, 0, w, h); P('#7a808a', 0, 0, w, 1); P('#454a54', w - 1, 0, 1, h);
  box('#2e2620', 3, 4, w - 6, h - 4); P('#3e342a', 3, 4, 1, h - 4);
  const gl = `rgba(90,200,255,${(0.55 + Math.sin(t / 400) * 0.35).toFixed(2)})`; // glifos que brillan
  P(gl, 6, 10, 4, 1); P(gl, 6, 11, 1, 4); P(gl, 9, 11, 1, 2); P(gl, 7, 14, 3, 1); P(gl, 7, 18, 2, 6); P(gl, 5, 20, 6, 1);
}

function stele({ P, oblob }) {
  P(SHADOW, 3, 14, 11, 2);
  oblob('#8a8f99', 3, 0, 10, 15, 2); P('#a4aab4', 4, 1, 1, 13); P('#6c727c', 11, 2, 1, 12);
  for (const [gx, gy, gw] of [[5, 3, 5], [5, 6, 3], [5, 9, 5], [6, 12, 3]]) P('#4a4f59', gx, gy, gw, 1);
  P('#4a8a3a', 3, 13, 3, 2); P('#5aa048', 4, 12);
}

function altar({ P, box }, w, h, t) {
  box('#5a5f69', 2, 6, w - 4, h - 6); P('#7a808a', 2, 6, w - 4, 1); P('#454a54', 2, h - 2, w - 4, 2);
  for (let x = 5; x < w - 5; x += 6) P('#454a54', x, 9, 3, 2);
  const gy = Math.round(Math.sin(t / 300) * 1.5), cx = w / 2 - 1; // gema flotante
  P('rgba(74,160,224,.22)', cx - 4, gy - 5, 10, 10); P('rgba(74,160,224,.3)', cx - 2, gy - 3, 6, 6);
  P(OL, cx, gy - 3, 2, 1); P('#4aa0e0', cx, gy - 2, 2, 1); P('#4aa0e0', cx - 1, gy - 1, 4, 2);
  P('#2a70b0', cx + 1, gy, 2, 1); P('#4aa0e0', cx, gy + 1, 2, 1); P('#cfeaff', cx, gy - 1);
}

function stairs({ P }, w, h) {
  const n = 4, sh = h / n;
  for (let i = 0; i < n; i++) {
    const s = i * 4, y = i * sh, ww = w - 2 * s;
    P(OL, s - 1, y, ww + 2, sh);
    P('#7f848d', s, y, ww, sh); P('#a0a5ae', s, y, ww, 1); P('#5f646d', s, y + sh - 3, ww, 3);
  }
}
