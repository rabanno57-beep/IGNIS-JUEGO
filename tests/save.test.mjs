// Ejecutar: node tests/save.test.mjs
import assert from 'node:assert/strict';
import { SaveManager, KEYS } from '../src/save/SaveManager.js';
import { MemoryAdapter } from '../src/save/storage.js';
import { defaultState, SAVE_VERSION, checksum } from '../src/save/schema.js';

const ZONES = ['tzakan', 'bosque', 'excavacion', 'templo'];
let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};
const make = () => { const a = new MemoryAdapter(); return { a, sm: new SaveManager(a, { zones: ZONES }) }; };
const progressed = () => {
  const s = defaultState();
  s.zone = 'bosque'; s.pos = { x: 200, y: 150 }; s.player.level = 3; s.player.xp = 12;
  s.skills.push('hook', 'roots'); s.inventory = { hierba: 4, savia: 1 };
  s.chests = ['b_cofre1']; s.defeated = ['b_raso1']; s.flags = { suit: true };
  s.quests = { active: ['q_tala'], done: ['q_escrito'] }; s.savepoints = ['tz_fuente'];
  return s;
};

console.log('SaveManager');
test('sin partida: status none', () => { assert.equal(make().sm.inspect().status, 'none'); });
test('round-trip conserva todo el progreso', () => {
  const { sm } = make(); const s = progressed();
  assert.equal(sm.save(s, 'test').ok, true);
  const r = sm.load();
  assert.equal(r.ok, true);
  assert.deepEqual(r.state, s);
  assert.ok(r.savedAt > 0);
});
test('un estado vacío NO sobrescribe una partida con progreso', () => {
  const { sm } = make(); sm.save(progressed());
  const r = sm.save(defaultState(), 'auto');
  assert.equal(r.ok, false);
  assert.equal(sm.load().state.player.level, 3);
});
test('allowReset (nueva partida) sí lo permite y conserva .bak', () => {
  const { sm, a } = make(); sm.save(progressed());
  assert.equal(sm.save(defaultState(), 'newgame', { allowReset: true }).ok, true);
  assert.equal(sm.load().state.player.level, 1);
  assert.equal(sm.parse(a.read(KEYS.bak)).state.player.level, 3);
});
test('estado inválido (null, zona rara, NaN) se rechaza', () => {
  const { sm } = make(); sm.save(progressed());
  assert.equal(sm.save(null).ok, false);
  assert.equal(sm.save({ ...progressed(), zone: 'narnia' }).ok, false);
  const bad = progressed(); bad.player.hp = NaN;
  assert.equal(sm.save(bad).ok, false);
  assert.equal(sm.load().state.zone, 'bosque');
});
test('JSON corrupto sin copia: status corrupt y el texto se conserva', () => {
  const { sm, a } = make(); a.write(KEYS.main, '{"version":2,"da');
  assert.equal(sm.inspect().status, 'corrupt');
  assert.equal(a.read(KEYS.corrupt), '{"version":2,"da');
  assert.equal(sm.load().ok, false);
});
test('checksum incorrecto = corrupto', () => {
  const { sm, a } = make(); sm.save(progressed());
  const env = JSON.parse(a.read(KEYS.main)); env.data.player.level = 99;
  a.write(KEYS.main, JSON.stringify(env));
  assert.equal(sm.inspect().status, 'corrupt');
});
test('principal corrupto + copia buena: se recupera de .bak', () => {
  const { sm, a } = make(); sm.save(progressed());
  const s2 = progressed(); s2.player.level = 4; sm.save(s2);          // .bak = nivel 3
  a.write(KEYS.main, 'basura');
  const r = sm.load();
  assert.equal(r.ok, true); assert.equal(r.recovered, true); assert.equal(r.state.player.level, 3);
});
test('migración desde v1 (inventario como lista, sin ajustes)', () => {
  const { sm, a } = make();
  const v1 = progressed(); delete v1.settings; v1.inventory = ['hierba', 'hierba', 'savia'];
  a.write(KEYS.main, JSON.stringify({ version: 1, savedAt: 1, checksum: checksum(JSON.stringify(v1)), data: v1 }));
  const r = sm.load();
  assert.equal(r.ok, true); assert.equal(r.migrated, true);
  assert.deepEqual(r.state.inventory, { hierba: 2, savia: 1 });
  assert.equal(r.state.settings.volume, 0.5);
});
test('versión futura: no se carga ni se sobrescribe', () => {
  const { sm, a } = make();
  const raw = JSON.stringify({ version: SAVE_VERSION + 1, savedAt: 1, checksum: 'x', data: {} });
  a.write(KEYS.main, raw);
  assert.equal(sm.inspect().status, 'future');
  assert.equal(sm.save(progressed()).ok, false);
  assert.equal(a.read(KEYS.main), raw);
});
test('almacenamiento lleno: error controlado y el guardado anterior sigue intacto', () => {
  const { sm, a } = make(); sm.save(progressed());
  const orig = a.write.bind(a);
  a.write = (k, v) => { if (k === KEYS.tmp) throw new Error('QuotaExceededError'); orig(k, v); };
  const s2 = progressed(); s2.player.level = 9;
  const r = sm.save(s2);
  assert.equal(r.ok, false); assert.match(r.error, /Quota/);
  assert.equal(sm.load().state.player.level, 3);
});
test('almacenamiento que lanza al leer: unavailable, sin excepción', () => {
  const a = new MemoryAdapter(); a.read = () => { throw new Error('SecurityError'); };
  const sm = new SaveManager(a, { zones: ZONES });
  assert.equal(sm.inspect().status, 'unavailable');
  assert.equal(sm.save(progressed()).ok, false);
});
test('eventos save:start / save:done / save:error', () => {
  const log = []; const a = new MemoryAdapter();
  const sm = new SaveManager(a, { zones: ZONES, emit: (e) => log.push(e) });
  sm.save(progressed()); sm.save(null);
  assert.deepEqual(log, ['save:start', 'save:done', 'save:start', 'save:error']);
});
test('deleteSave borra la partida', () => {
  const { sm } = make(); sm.save(progressed()); sm.deleteSave();
  assert.equal(sm.inspect().status, 'none');
});

console.log(`\n${passed} pruebas OK${process.exitCode ? ' (con fallos)' : ''}`);
