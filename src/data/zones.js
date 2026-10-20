// Zonas del juego. Unidades en tiles (32px). Los tiles se generan con rectángulos.
export const TS = 32;
// Tiles: 0 hierba, 1 árbol(sólido), 2 agua(sólido), 3 sendero, 4 arbusto(oculta), 5 piedra, 6 muro(sólido), 7 tierra, 8 foso(sólido)
export const SOLID_TILES = new Set([1, 2, 6, 8]);

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function build(w, h, { base = 0, border = 1, ops = [], scatter = [] }) {
  const t = Array.from({ length: h }, () => Array(w).fill(base));
  const rect = (tile, x, y, rw, rh) => {
    for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (t[j]?.[i] !== undefined) t[j][i] = tile;
  };
  ops.forEach((o) => rect(...o));
  const protectedTiles = new Set(ops.filter((o) => o[0] !== 1 && o[0] !== 4).map((o) => o.join(',')));
  void protectedTiles;
  for (const sc of scatter) { // {tile, n, seed, only: tileId, avoid:[[x,y,w,h]]}
    const r = rng(sc.seed);
    let placed = 0, guard = 0;
    while (placed < sc.n && guard++ < sc.n * 30) {
      const x = 1 + Math.floor(r() * (w - 2)), y = 1 + Math.floor(r() * (h - 2));
      if (t[y][x] !== (sc.only ?? base)) continue;
      if ((sc.avoid ?? []).some(([ax, ay, aw, ah]) => x >= ax && x < ax + aw && y >= ay && y < ay + ah)) continue;
      t[y][x] = sc.tile; placed++;
    }
  }
  if (border !== null) {
    rect(border, 0, 0, w, 1); rect(border, 0, h - 1, w, 1); rect(border, 0, 0, 1, h); rect(border, w - 1, 0, 1, h);
  }
  return t;
}

const ZONES = {};

/* ───────────── 1. TZAKAN ───────────── */
ZONES.tzakan = {
  name: 'Tzakan', w: 26, h: 18, mood: 'town',
  tiles: build(26, 18, {
    ops: [[3, 1, 10, 24, 2], [3, 12, 2, 2, 14], [5, 21, 12, 4, 5], [4, 2, 2, 3, 2], [4, 20, 2, 2, 1]],
    scatter: [{ tile: 1, n: 45, seed: 11, avoid: [[2, 4, 22, 13], [1, 1, 24, 3]] }, { tile: 4, n: 5, seed: 4, avoid: [[1, 8, 24, 5]] }],
  }),
  spawn: [3, 9],
  props: [
    { type: 'house', x: 6, y: 5, w: 4, h: 3, label: 'La Ceiba', color: '#9c6b3e' },
    { type: 'house', x: 16, y: 5, w: 4, h: 3, label: 'El Fogón de Tzakan', color: '#a8553a' },
    { type: 'house', x: 3, y: 13, w: 4, h: 3, label: 'Casa de Eduardo', color: '#8c7a55' },
    { type: 'fountain', x: 12, y: 8, w: 2, h: 2, label: 'Fuente' },
    { type: 'stele', x: 23, y: 13, w: 1, h: 1, label: 'Estela' },
  ],
  npcs: [
    { id: 'ximon', name: 'Ximón', x: 10, y: 10, color: '#4a6fa5' },
    { id: 'aldeano', name: 'Doña Rosa', x: 15, y: 12, color: '#b0508a' },
  ],
  savepoints: [{ id: 'tz_fuente', name: 'Fuente de Tzakan', x: 15, y: 10 }],
  secrets: [{ id: 's_tz_glifo', x: 3, y: 2, label: 'Revisar arbustos', loot: { fragmento_glifo: 1 } }],
  interact: [{ id: 'inscription', x: 23, y: 14, label: 'Descifrar el escrito' }],
  chests: [{ id: 'tz_cofre', x: 5, y: 3, loot: { hierba: 2 } }],
  mercs: [], hooks: [], exits: [],
};

/* ───────────── 2. BOSQUE + CAMPAMENTO ───────────── */
ZONES.bosque = {
  name: 'Bosque sagrado — Campamento de Marck', w: 40, h: 26, mood: 'forest',
  tiles: build(40, 26, {
    ops: [
      [2, 1, 5, 38, 3],                                   // río norte
      [3, 2, 21, 13, 2], [3, 13, 13, 2, 10], [3, 13, 13, 14, 2], [3, 36, 13, 3, 2],
      [7, 22, 8, 14, 9],                                  // campamento
      [4, 4, 12, 3, 2], [4, 9, 17, 3, 2], [4, 16, 8, 2, 3], [4, 6, 20, 2, 2], [4, 18, 17, 3, 2],
    ],
    scatter: [
      { tile: 1, n: 170, seed: 7, avoid: [[1, 19, 16, 5], [12, 12, 16, 11], [21, 7, 17, 10], [17, 1, 7, 5], [8, 15, 6, 4], [3, 11, 5, 4], [30, 12, 10, 5]] },
      { tile: 4, n: 10, seed: 21, avoid: [[21, 7, 17, 10]] },
    ],
  }),
  spawn: [3, 21],
  props: [
    { type: 'tent', x: 23, y: 9, w: 3, h: 3, label: 'Tienda' },
    { type: 'tent', x: 28, y: 9, w: 3, h: 3, label: 'Tienda' },
    { type: 'machine', x: 32, y: 9, w: 3, h: 3, label: 'Excavadora' },
    { type: 'crate', x: 26, y: 15, w: 1, h: 1 }, { type: 'crate', x: 27, y: 15, w: 1, h: 1 },
    { type: 'crate', x: 24, y: 15, w: 2, h: 1 }, { type: 'sign', x: 21, y: 11, w: 1, h: 1, label: '“Propiedad de M. — Prohibido el paso”' },
    { type: 'barricade', x: 36, y: 12, w: 1, h: 4, label: 'Barricada', blockedUntil: 'camp_cleared' },
  ],
  npcs: [],
  savepoints: [{ id: 'b_arbol', name: 'Árbol viejo', x: 15, y: 20 }],
  secrets: [{ id: 's_b_savia', x: 5, y: 13, label: 'Buscar entre las hojas', loot: { savia: 2, fragmento_glifo: 1 } }],
  chests: [
    { id: 'b_cofre1', x: 33, y: 15, loot: { tonico: 1, hierba: 2 } },
    { id: 'b_cofre_rio', x: 20, y: 3, loot: { fragmento_glifo: 1, savia: 1 } },
    { id: 'b_cofre2', x: 9, y: 23, loot: { hierba: 2 } },
  ],
  interact: [],
  hooks: [
    { x: 20, y: 8, tx: 20, ty: 4, label: 'Gancho hacia la otra orilla' },
    { x: 20, y: 4, tx: 20, ty: 8, label: 'Gancho de regreso' },
  ],
  mercs: [
    { id: 'b_raso3', cls: 'raso', x: 9, y: 17, lvl: 1, route: [[9, 17], [12, 17]] },
    { id: 'b_raso1', cls: 'raso', x: 16, y: 14, lvl: 1, route: [[16, 14], [21, 14]] },
    { id: 'b_explor1', cls: 'explorador', x: 14, y: 19, lvl: 1, route: [[14, 19], [14, 15], [20, 14]] },
    { id: 'b_raso2', cls: 'raso', x: 25, y: 13, lvl: 1 },
    { id: 'b_armado1', cls: 'armado', x: 29, y: 13, lvl: 1, face: 'w' },
    { id: 'b_defensa1', cls: 'defensa', x: 31, y: 14, lvl: 1 },
  ],
  exits: [{ x: 38, y: 13, w: 1, h: 2, to: 'excavacion', spawn: [2, 11], needFlag: 'camp_cleared', msg: 'La barricada de Marck bloquea el camino. Derrota a los mercenarios del campamento.' }],
};

/* ───────────── 3. EXCAVACIÓN ───────────── */
ZONES.excavacion = {
  name: 'Excavación de Marck', w: 36, h: 22, mood: 'forest',
  tiles: build(36, 22, {
    ops: [
      [7, 9, 3, 25, 17], [3, 1, 10, 10, 2], [7, 9, 10, 2, 2],
      [8, 16, 7, 8, 8],                                    // foso
      [6, 34, 8, 2, 6], [5, 33, 10, 1, 2],                // fachada del templo
      [4, 2, 4, 3, 2], [4, 3, 15, 3, 2],
    ],
    scatter: [{ tile: 1, n: 60, seed: 5, avoid: [[1, 9, 12, 3], [9, 3, 25, 17]] }],
  }),
  spawn: [2, 11],
  props: [
    { type: 'tent', x: 11, y: 4, w: 3, h: 2, label: 'Tienda' },
    { type: 'tent', x: 11, y: 14, w: 3, h: 2, label: 'Tienda' },
    { type: 'machine', x: 26, y: 4, w: 3, h: 3, label: 'Perforadora' },
    { type: 'machine', x: 26, y: 15, w: 3, h: 3, label: 'Perforadora' },
    { type: 'crate', x: 20, y: 17, w: 2, h: 1 }, { type: 'crate', x: 18, y: 4, w: 1, h: 1 },
    { type: 'door', x: 34, y: 10, w: 1, h: 2, label: 'Puerta del templo', blockedUntil: 'temple_open' },
  ],
  npcs: [],
  savepoints: [{ id: 'e_campamento', name: 'Campamento abandonado', x: 4, y: 9 }],
  secrets: [{ id: 's_e_grieta', x: 4, y: 5, label: 'Examinar la grieta', loot: { tonico: 1 } }],
  chests: [
    { id: 'e_cofre1', x: 12, y: 19, loot: { tonico: 1, savia: 2 } },
    { id: 'e_cofre2', x: 31, y: 4, loot: { fragmento_glifo: 1, hierba: 2 } },
  ],
  interact: [],
  hooks: [{ x: 15, y: 11, tx: 25, ty: 11, label: 'Gancho: cruzar el foso' }, { x: 25, y: 11, tx: 15, ty: 11, label: 'Gancho: cruzar el foso' }],
  mercs: [
    { id: 'e_vet1', cls: 'veterano', x: 10, y: 8, lvl: 1.3, route: [[10, 8], [10, 18]] },
    { id: 'e_explor1', cls: 'explorador', x: 14, y: 17, lvl: 1.3, route: [[14, 18], [26, 19], [14, 18]] },
    { id: 'e_armado1', cls: 'armado', x: 20, y: 5, lvl: 1.3 },
    { id: 'e_defensa1', cls: 'defensa', x: 25, y: 10, lvl: 1.3 },
    { id: 'e_elite1', cls: 'elite', x: 24, y: 6, lvl: 1.3 },
    { id: 'e_elite2', cls: 'elite', x: 24, y: 16, lvl: 1.3 },
    { id: 'e_vet2', cls: 'veterano', x: 29, y: 8, lvl: 1.3, route: [[29, 5], [29, 17]] },
    { id: 'e_escolta1', cls: 'armado', x: 31, y: 8, lvl: 1.1 },
    { id: 'e_escolta2', cls: 'armado', x: 31, y: 13, lvl: 1.1 },
    { id: 'e_comandante', cls: 'comandante', x: 32, y: 10, lvl: 1.2, boss: true, name: 'Comandante Duarte' },
  ],
  exits: [],
};

/* ───────────── 4. TEMPLO SUBTERRÁNEO ───────────── */
ZONES.templo = {
  name: 'Templo subterráneo', w: 30, h: 24, mood: 'temple',
  tiles: build(30, 24, {
    base: 6, border: 6,
    ops: [
      [5, 2, 2, 6, 2], [5, 6, 3, 2, 10], [5, 6, 11, 12, 2], [5, 16, 5, 2, 8], [5, 16, 5, 8, 2], [5, 22, 5, 2, 12],
      [5, 10, 13, 2, 5], [5, 2, 11, 4, 2],
      [5, 12, 17, 16, 6], [2, 12, 17, 1, 6], [2, 27, 17, 1, 6], [2, 12, 22, 16, 1],
    ],
  }),
  spawn: [3, 3],
  props: [
    { type: 'altar', x: 19, y: 17, w: 2, h: 1, label: 'Altar del amuleto' },
    { type: 'stairs', x: 17, y: 18, w: 6, h: 2, solid: false },
  ],
  npcs: [],
  savepoints: [{ id: 't_piedra', name: 'Piedra de memoria', x: 22, y: 14 }],
  secrets: [{ id: 's_t_glifo', x: 3, y: 12, label: 'Leer los grabados', loot: { savia: 2 } }],
  chests: [{ id: 't_cofre1', x: 10, y: 17, loot: { tonico: 2, savia: 2 } }],
  interact: [
    { id: 'escrito1', x: 3, y: 2, label: 'Leer el escrito' },
    { id: 'escrito2', x: 17, y: 8, label: 'Leer el escrito' },
  ],
  hooks: [],
  mercs: [
    { id: 't_vet1', cls: 'veterano', x: 16, y: 7, lvl: 1.5, route: [[16, 6], [16, 11]] },
    { id: 't_elite1', cls: 'elite', x: 23, y: 8, lvl: 1.5, route: [[23, 6], [23, 13]] },
  ],
  exits: [],
  marck: { x: 20, y: 19 },
};

export const ZONES_DATA = ZONES;
export const ZONE_IDS = Object.keys(ZONES);
