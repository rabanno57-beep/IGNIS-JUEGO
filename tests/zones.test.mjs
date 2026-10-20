// Ejecutar: node tests/zones.test.mjs — valida que los mapas sean jugables.
import assert from 'node:assert/strict';
import { ZONES_DATA, SOLID_TILES } from '../src/data/zones.js';
import { MERC } from '../src/data/mercenaries.js';

let bad = 0;
const check = (cond, msg) => { if (!cond) { bad++; console.error('  FAIL', msg); } };

for (const [zid, z] of Object.entries(ZONES_DATA)) {
  const solidProp = new Set();
  for (const p of z.props) {
    if (p.solid === false) continue;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) solidProp.add(`${p.x + i},${p.y + j}`);
  }
  const blocked = (x, y) => SOLID_TILES.has(z.tiles[y]?.[x] ?? 1) || solidProp.has(`${x},${y}`);
  // Alcanzabilidad desde el spawn (las barricadas/puertas con blockedUntil se consideran abiertas).
  const openProps = new Set();
  for (const p of z.props) if (p.blockedUntil) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) openProps.add(`${p.x + i},${p.y + j}`);
  const walk = (x, y) => (SOLID_TILES.has(z.tiles[y]?.[x] ?? 1) ? false : !solidProp.has(`${x},${y}`) || openProps.has(`${x},${y}`));
  const [sx, sy] = z.spawn;
  check(walk(sx, sy), `${zid}: spawn bloqueado`);
  const seen = new Set([`${sx},${sy}`]); const q = [[sx, sy]];
  const links = new Map();
  for (const h of z.hooks) { const k = `${h.x},${h.y}`; links.set(k, [...(links.get(k) ?? []), [h.tx, h.ty]]); }
  while (q.length) {
    const [x, y] = q.shift();
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], ...(links.get(`${x},${y}`) ?? [])];
    for (const [nx, ny] of nb) if (!seen.has(`${nx},${ny}`) && walk(nx, ny)) { seen.add(`${nx},${ny}`); q.push([nx, ny]); }
  }
  const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
  const ents = [
    ...(z.chests ?? []).map((e) => ['cofre ' + e.id, e]), ...(z.secrets ?? []).map((e) => ['secreto ' + e.id, e]),
    ...(z.savepoints ?? []).map((e) => ['savepoint ' + e.id, e]), ...(z.npcs ?? []).map((e) => ['npc ' + e.id, e]),
    ...(z.interact ?? []).map((e) => ['interacción ' + e.id, e]), ...(z.exits ?? []).map((e) => ['salida', e]),
  ];
  for (const [n, e] of ents) check(near(e.x, e.y), `${zid}: ${n} inalcanzable (${e.x},${e.y})`);
  for (const m of z.mercs) {
    check(MERC[m.cls], `${zid}: clase desconocida ${m.cls}`);
    check(walk(m.x, m.y), `${zid}: ${m.id} sobre tile bloqueado`);
    for (const [wx, wy] of m.route ?? []) check(walk(wx, wy), `${zid}: ${m.id} ruta bloqueada en ${wx},${wy}`);
    const r = m.route ?? [];
    for (let i = 0; i < r.length - 1; i++) { // la línea recta entre waypoints debe estar libre
      const [ax, ay] = r[i], [bx, by] = r[i + 1];
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 4;
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + ((bx - ax) * k) / n), y = Math.round(ay + ((by - ay) * k) / n);
        if (!walk(x, y)) { check(false, `${zid}: ${m.id} ruta cruza obstáculo en ${x},${y}`); break; }
      }
    }
  }
  console.log(`${zid}: ${seen.size} tiles alcanzables, ${z.mercs.length} mercenarios, ${z.chests.length} cofres`);
}
if (bad) process.exitCode = 1; else console.log('mapas OK');
