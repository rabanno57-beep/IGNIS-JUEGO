// Formato de la partida: versión, estado por defecto, validación y checksum.
export const SAVE_VERSION = 2;

export const DEFAULT_CONTROLS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  interact: 'KeyE', camo: 'KeyC', hook: 'KeyQ', ambush: 'KeyF', pause: 'Escape',
};

export function defaultState() {
  return {
    started: true,
    zone: 'tzakan',
    pos: { x: 96, y: 300 },
    chapter: 1,
    flags: {},
    quests: { active: [], done: [] },
    player: { level: 1, xp: 0, hp: 40, maxHp: 40, energy: 6, maxEnergy: 6, atk: 8, def: 2 },
    skills: ['strike'],
    inventory: { hierba: 2 },
    chests: [],
    secrets: [],
    defeated: [],
    savepoints: [],
    settings: { volume: 0.5, muted: false, controls: { ...DEFAULT_CONTROLS } },
    playtime: 0,
  };
}

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const strArr = (a) => (Array.isArray(a) ? a.filter((s) => typeof s === 'string') : []);
const fail = (error) => ({ ok: false, error });

/** Valida y completa un estado. No muta la entrada. opts.zones: lista de zonas válidas. */
export function normalize(raw, opts = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('el estado no es un objeto');
  const d = defaultState();
  if (typeof raw.zone !== 'string' || !raw.zone) return fail('zona inválida');
  if (opts.zones && !opts.zones.includes(raw.zone)) return fail(`zona desconocida: ${raw.zone}`);
  if (!raw.pos || !isNum(raw.pos.x) || !isNum(raw.pos.y)) return fail('posición inválida');
  const p = raw.player;
  if (!p || typeof p !== 'object') return fail('falta el jugador');
  for (const k of ['level', 'xp', 'hp', 'maxHp', 'energy', 'maxEnergy', 'atk', 'def']) {
    if (!isNum(p[k]) || p[k] < 0) return fail(`estadística inválida: ${k}`);
  }
  if (p.level < 1 || p.maxHp < 1) return fail('estadísticas fuera de rango');

  const inventory = {};
  if (raw.inventory && typeof raw.inventory === 'object' && !Array.isArray(raw.inventory)) {
    for (const [k, v] of Object.entries(raw.inventory)) if (isNum(v) && v > 0) inventory[k] = Math.floor(v);
  } else return fail('inventario inválido');

  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const controls = { ...DEFAULT_CONTROLS };
  if (s.controls && typeof s.controls === 'object') {
    for (const k of Object.keys(controls)) if (typeof s.controls[k] === 'string') controls[k] = s.controls[k];
  }
  const state = {
    started: true,
    zone: raw.zone,
    pos: { x: raw.pos.x, y: raw.pos.y },
    chapter: isNum(raw.chapter) ? raw.chapter : d.chapter,
    flags: raw.flags && typeof raw.flags === 'object' && !Array.isArray(raw.flags) ? { ...raw.flags } : {},
    quests: {
      active: strArr(raw.quests?.active),
      done: strArr(raw.quests?.done),
    },
    player: {
      level: Math.floor(p.level), xp: p.xp,
      hp: Math.min(Math.max(1, p.hp), p.maxHp), maxHp: p.maxHp,
      energy: Math.min(p.energy, p.maxEnergy), maxEnergy: p.maxEnergy,
      atk: p.atk, def: p.def,
    },
    skills: [...new Set(['strike', ...strArr(raw.skills)])],
    inventory,
    chests: strArr(raw.chests),
    secrets: strArr(raw.secrets),
    defeated: strArr(raw.defeated),
    savepoints: strArr(raw.savepoints),
    settings: {
      volume: isNum(s.volume) ? Math.min(1, Math.max(0, s.volume)) : d.settings.volume,
      muted: !!s.muted,
      controls,
    },
    playtime: isNum(raw.playtime) ? raw.playtime : 0,
  };
  return { ok: true, state };
}

/** Un estado "vacío": recién creado, sin ningún progreso. */
export function isPristine(state) {
  const p = state.player;
  return (
    p.level === 1 && p.xp === 0 &&
    state.chests.length === 0 && state.defeated.length === 0 &&
    state.secrets.length === 0 && state.savepoints.length === 0 &&
    state.quests.done.length === 0 && state.skills.length <= 1 &&
    Object.keys(state.flags).length === 0
  );
}

/** FNV-1a de 32 bits sobre el JSON de los datos (detecta corrupción accidental, no manipulación). */
export function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
