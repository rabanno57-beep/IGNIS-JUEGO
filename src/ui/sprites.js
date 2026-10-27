// Sprites pixel-art dibujados con rectángulos (sin archivos de imagen).
// Cada clase de mercenario tiene una silueta distinta para reconocerla de un vistazo.
const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };

/** Dibuja un personaje de ~16x24 "píxeles" escalados por s. (x,y) = pies centrados. */
export function drawPerson(c, x, y, s, kind, o = {}) {
  const f = o.face === 'w' ? -1 : 1; // sólo espeja armas
  if (kind === 'comandante') s *= 1.15; // el jefe es más grande
  const px = (col, dx, dy, w, h) => R(c, col, x + dx * s * f - (f < 0 ? w * s : 0), y + dy * s, w * s, h * s);
  const flat = (col, dx, dy, w, h) => R(c, col, x + dx * s, y + dy * s, w * s, h * s);
  c.save();
  if (o.alpha != null) c.globalAlpha = o.alpha;
  flat('rgba(0,0,0,.28)', -7, -2, 14, 3); // sombra
  switch (kind) {
    case 'eduardo': eduardo(px, o.step); break;
    case 'rootknight': {
      rootknight(px, o.step);
      if (o.camo) { c.globalAlpha = 0.45; flat('#2f6b3a', -9, -32, 18, 32); }
      break;
    }
    case 'ximon': person(flat, '#c99a6b', '#c9a23a', '#3a3f55', '#1d1d1d'); break;
    case 'aldeano': person(flat, '#d9a877', '#b0508a', '#5a3f55', '#999'); break;
    case 'raso': case 'armado': case 'defensa': case 'explorador': case 'veterano': case 'comandante': case 'elite':
      soldier(px, LOOK[kind], o.pose, o.step); break;
    case 'marck': {
      marck(px, o.step);
      if (o.aura) { c.globalAlpha = 0.25; flat('#4aa0e0', -14, -36, 28, 36); }
      break;
    }
    default: person(flat, '#999', '#666', '#333', '#222');
  }
  c.restore();
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

export function drawChest(c, x, y, open) {
  R(c, '#6b4423', x + 4, y + 12, 24, 14); R(c, '#8a5a2e', x + 4, y + 12, 24, 4);
  R(c, open ? '#222' : '#d8c060', x + 14, y + 16, 4, 4);
  if (open) R(c, '#8a5a2e', x + 4, y + 6, 24, 6);
}

export function drawProp(c, p, t) {
  const x = p.x * 32, y = p.y * 32, w = p.w * 32, h = p.h * 32;
  switch (p.type) {
    case 'house': R(c, p.color, x, y + 16, w, h - 16); R(c, '#5a2f1d', x - 4, y, w + 8, 20); R(c, '#2a1a10', x + w / 2 - 8, y + h - 24, 16, 24); R(c, '#e8d9a0', x + 8, y + 28, 12, 12); break;
    case 'fountain': R(c, '#8a8f99', x, y, w, h); R(c, '#4aa0e0', x + 6, y + 6, w - 12, h - 12); R(c, '#9bd4f5', x + w / 2 - 3, y + 8 + Math.sin(t / 200) * 2, 6, 14); break;
    case 'tent': R(c, '#7a7a52', x, y + 12, w, h - 12); R(c, '#5a5a38', x + 8, y, w - 16, 14); R(c, '#2a2a1a', x + w / 2 - 6, y + h - 20, 12, 20); break;
    case 'machine': R(c, '#c9a227', x, y + 12, w, h - 12); R(c, '#555', x + 6, y + h - 14, w - 12, 14); R(c, '#333', x + w - 22, y, 12, 28); R(c, '#e0e0e0', x + 8, y + 18, 20, 12); break;
    case 'crate': R(c, '#8a6a3a', x + 2, y + 4, w - 4, h - 4); R(c, '#6a4a22', x + 2, y + 4, w - 4, 4); R(c, '#6a4a22', x + w / 2 - 1, y + 4, 2, h - 4); break;
    case 'sign': R(c, '#6a4a22', x + 14, y + 8, 4, 22); R(c, '#c8b27a', x + 2, y + 2, 28, 14); break;
    case 'barricade': R(c, '#6a4a22', x + 4, y, 8, h); R(c, '#8a6a3a', x + 12, y + 4, 8, h - 8); R(c, '#aaa', x, y + h / 2, w, 3); break;
    case 'door': R(c, '#3a3a40', x, y, w, h); R(c, '#6a5a3a', x + 4, y + 4, w - 8, h - 8); R(c, '#d8c060', x + w - 10, y + h / 2, 4, 4); break;
    case 'stele': R(c, '#8a8f99', x + 6, y + 2, 20, 28); R(c, '#5a5f69', x + 10, y + 6, 12, 3); R(c, '#5a5f69', x + 10, y + 12, 12, 3); R(c, '#5a5f69', x + 10, y + 18, 8, 3); break;
    case 'altar': R(c, '#5a5f69', x, y, w, h); R(c, '#4aa0e0', x + w / 2 - 6, y + 6 + Math.sin(t / 300) * 2, 12, 12); break;
    case 'stairs': for (let i = 0; i < 4; i++) R(c, i % 2 ? '#6f747d' : '#7f848d', x + 8 * i, y + i * 8, w - 16 * i, 8); break;
    default: R(c, '#888', x, y, w, h);
  }
}
