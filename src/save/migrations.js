// Migraciones de formato. migrations[n] convierte datos de la versión n a n+1.
import { DEFAULT_CONTROLS } from './schema.js';

export const migrations = {
  // v1 guardaba el inventario como lista de nombres y no tenía ajustes.
  1: (d) => {
    const inv = {};
    if (Array.isArray(d.inventory)) {
      for (const name of d.inventory) if (typeof name === 'string') inv[name] = (inv[name] ?? 0) + 1;
    } else if (d.inventory && typeof d.inventory === 'object') Object.assign(inv, d.inventory);
    return {
      ...d,
      inventory: inv,
      settings: d.settings ?? { volume: 0.5, muted: false, controls: { ...DEFAULT_CONTROLS } },
      secrets: d.secrets ?? [],
      savepoints: d.savepoints ?? [],
    };
  },
};

export function migrate(data, from, to) {
  let cur = data;
  for (let v = from; v < to; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`no hay migración de v${v} a v${v + 1}`);
    cur = step(cur);
  }
  return cur;
}
