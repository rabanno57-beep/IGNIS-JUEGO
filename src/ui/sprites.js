// Sprites pixel-art dibujados con rectángulos (sin archivos de imagen).
// Cada clase de mercenario tiene una silueta distinta para reconocerla de un vistazo.
const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };

/** Dibuja un personaje de ~16x24 "píxeles" escalados por s. (x,y) = pies centrados. */
export function drawPerson(c, x, y, s, kind, o = {}) {
  const f = o.face === 'w' ? -1 : 1; // sólo espeja armas
  const px = (col, dx, dy, w, h) => R(c, col, x + dx * s * f - (f < 0 ? w * s : 0), y + dy * s, w * s, h * s);
  const flat = (col, dx, dy, w, h) => R(c, col, x + dx * s, y + dy * s, w * s, h * s);
  c.save();
  if (o.alpha != null) c.globalAlpha = o.alpha;
  flat('rgba(0,0,0,.28)', -7, -2, 14, 3); // sombra
  switch (kind) {
    case 'eduardo': person(flat, '#d9a877', '#5a7aa0', '#3a3f55', '#4a2f1d'); break;
    case 'rootknight': {
      person(flat, '#2f6b3a', '#3d8a4a', '#25552e', '#2f6b3a');
      flat('#6fcf6f', -5, -24, 10, 3); flat('#1d3d22', -4, -17, 8, 2); // capucha de hojas + máscara
      flat('#9be89b', -3, -14, 2, 1); flat('#9be89b', 1, -14, 2, 1);
      if (o.camo) { c.globalAlpha = 0.45; flat('#2f6b3a', -9, -26, 18, 26); }
      break;
    }
    case 'ximon': person(flat, '#c99a6b', '#c9a23a', '#3a3f55', '#1d1d1d'); break;
    case 'aldeano': person(flat, '#d9a877', '#b0508a', '#5a3f55', '#999'); break;
    case 'raso': person(flat, '#c99a6b', '#8a6a3a', '#4a4030', '#3a2f1a'); flat('#6a4f25', -5, -24, 10, 3); px('#7a5230', 6, -14, 2, 8); break;
    case 'armado': person(flat, '#c99a6b', '#5b7b4a', '#3a4a30', '#2c3a22'); px('#222', 3, -13, 11, 2); px('#444', 3, -15, 3, 2); break;
    case 'defensa': person(flat, '#c99a6b', '#707a85', '#444a52', '#555'); px('#9aa4af', 3, -18, 6, 14); px('#c8d0d8', 4, -17, 4, 4); break;
    case 'explorador': person(flat, '#c99a6b', '#b09a5a', '#6a5a30', '#8a7a40'); flat('#8a7a40', -6, -25, 12, 3); px('#333', 4, -17, 3, 3); break;
    case 'veterano': person(flat, '#b98a5b', '#8a3b3b', '#3a2a2a', '#6a1f1f'); flat('#6a1f1f', -6, -24, 12, 3); flat('#d8c060', -4, -10, 2, 2); flat('#d8c060', 0, -10, 2, 2); px('#222', 3, -13, 11, 2); break;
    case 'comandante': person(flat, '#c99a6b', '#2a2a33', '#1a1a20', '#15151a', 1.15); flat('#d8c060', -8, -19, 4, 2); flat('#d8c060', 4, -19, 4, 2); flat('#15151a', -7, -28, 14, 4); flat('#d8c060', -2, -27, 4, 1); break;
    case 'elite': person(flat, '#222', '#1d1d22', '#101014', '#1a1a1e'); flat('#e03030', -4, -20, 8, 2); px('#222', 3, -13, 12, 2); px('#e03030', 14, -13, 1, 2); break;
    case 'marck': {
      person(flat, '#c99a6b', '#1f3f7a', '#15294f', '#0f1a33', 1.25);
      flat('#4aa0e0', -9, -30, 18, 2); flat('#4aa0e0', -2, -14, 4, 4); // amuleto
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
