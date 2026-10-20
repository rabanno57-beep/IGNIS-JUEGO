// Arranque, bucle principal, escenas y autoguardado.
import { game, setFlag, flag, startQuest, openChest, addItem, restoreAll, checkSkillUnlocks, hasSkill } from './core/state.js';
import { bus } from './core/events.js';
import { input } from './core/input.js';
import { sfx } from './core/audio.js';
import { defaultState } from './save/schema.js';
import { SaveManager } from './save/SaveManager.js';
import { LocalStorageAdapter, MemoryAdapter } from './save/storage.js';
import { ZONE_IDS, TS } from './data/zones.js';
import { ITEMS, SKILLS, QUESTS } from './data/content.js';
import { npcDialog, SCENES } from './data/story.js';
import { World, VIEW_W, VIEW_H } from './world/world.js';
import { Battle } from './combat/battle.js';
import { createMarckFight } from './combat/marck.js';
import { drawPerson } from './ui/sprites.js';
import { $, toast, setSaving, dialog, confirmBox, hideScreen, updateHud, setHint, fadeTo } from './ui/ui.js';
import { titleScreen, pauseMenu, gameOverlay } from './ui/menus.js';

/* ── Almacenamiento ── */
let adapter = null, persistent = true;
try { adapter = new LocalStorageAdapter(); if (!adapter.available()) throw new Error('no disponible'); } catch { adapter = new MemoryAdapter(); persistent = false; }

const save = new SaveManager(adapter, {
  zones: ZONE_IDS,
  emit(evt, p) {
    if (evt === 'save:start') setSaving(true);
    else if (evt === 'save:done') { setSaving(false); sfx.save(); toast('✔ Partida guardada', 'good', 1800); }
    else if (evt === 'save:error') { setSaving(false); sfx.error(); toast(`No se pudo guardar: ${p.error}`, 'bad', 5000); }
  },
});

const canvas = $('#screen');
const world = new World(canvas, {
  onEncounter: (enemies, opts) => startBattle(enemies, opts),
  onInteract: (kind, obj) => interact(kind, obj),
  onExit: (ex) => changeZone(ex.to, ex.spawn),
  onMarck: () => startMarckFight(),
});
let battle = null;

/* ── Guardado ── */
function doSave(reason, opts) {
  if (game.scene === 'title' || !persistent) return null;
  return save.save(game.state, reason, opts);
}
let saveTimer = null, pendingReason = null;
function autosave(reason) {
  if (game.scene === 'title') return;
  pendingReason = reason;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushAutosave, 200); // agrupa varios eventos seguidos
}
function flushAutosave() {
  if (!pendingReason) return;
  if (game.scene === 'battle') return; // no guardar a mitad de combate; se guarda al terminar
  const r = pendingReason; pendingReason = null;
  doSave(`auto:${r}`);
}
for (const evt of ['quest:complete', 'item:gain', 'skill:unlock', 'level:up', 'chest:open', 'zone:change', 'secret:found', 'merc:defeated', 'savepoint']) {
  bus.on(evt, () => autosave(evt));
}
bus.on('quest:complete', ({ id }) => { sfx.level(); toast(`Misión completada: ${QUESTS[id].title}`, 'good', 3500); });
bus.on('quest:start', ({ id }) => toast(`Nueva misión: ${QUESTS[id].title}`, 'info', 3500));
bus.on('level:up', ({ level }) => toast(`¡Nivel ${level}!`, 'good', 3000));
bus.on('skill:unlock', ({ id }) => toast(`Habilidad: ${SKILLS[id].name}`, 'good', 3000));
bus.on('item:gain', ({ id, n }) => { if (ITEMS[id]) toast(`+${n} ${ITEMS[id].name}`, 'item', 1800); });
addEventListener('pagehide', () => { if (game.scene !== 'title' && game.scene !== 'battle') doSave('exit'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.scene !== 'title' && game.scene !== 'battle') doSave('hidden'); });

/* ── Escenas ── */
async function toTitle() {
  battle?.destroy(); battle = null;
  hideScreen(); setHint(null);
  game.scene = 'title';
  showTitle();
}
function showTitle() {
  const info = persistent ? save.inspect() : { status: 'unavailable' };
  titleScreen(info, { newGame: newGame, continueGame: continueGame });
  if (!persistent) toast('Sin almacenamiento: el progreso no se guardará.', 'bad', 6000);
}

async function newGame() {
  const info = save.inspect();
  if (info.status === 'future') { toast('Hay una partida de una versión más nueva; no se sobrescribirá.', 'bad', 5000); return; }
  if (info.status === 'ok' || info.recovered) {
    const ok = await confirmBox('¿Empezar una partida nueva?', 'Ya tienes una partida guardada. Si continúas, será reemplazada por la nueva (se conserva solo una copia de seguridad anterior).', 'Sí, reemplazar', 'Cancelar');
    if (!ok) return;
  }
  game.state = defaultState();
  game.scene = 'world';
  if (persistent) { const r = save.save(game.state, 'newgame', { allowReset: true }); if (!r.ok) toast(r.error, 'bad', 5000); }
  hideScreen();
  enterWorld(game.state.zone, null);
  await dialog(SCENES.intro);
  autosave('newgame');
}

function continueGame() {
  const r = save.load();
  if (!r.ok) { toast('No hay una partida válida para continuar.', 'bad'); showTitle(); return; }
  game.state = r.state;
  game.scene = 'world';
  hideScreen();
  enterWorld(game.state.zone, game.state.pos);
  if (r.recovered) toast('Se recuperó la copia de seguridad de tu partida.', 'warn', 5000);
  if (r.migrated) toast('Partida actualizada al formato nuevo.', 'info', 3000);
  toast('Partida cargada', 'good', 1500);
}

function enterWorld(zoneId, pos) {
  world.enter(zoneId, pos);
  if (pos && world.blocked(world.pl.x, world.pl.y)) world.enter(zoneId, null); // el mapa pudo cambiar entre versiones
  game.scene = 'world';
  updateHud();
}

async function changeZone(to, spawn) {
  if (game.scene !== 'world') return;
  game.scene = 'cutscene';
  await fadeTo(() => {
    world.enter(to, spawn ? { x: spawn[0] * TS + 16, y: spawn[1] * TS + TS - 4 } : null);
    world.pl.camo = false;
  });
  game.scene = 'world';
  bus.emit('zone:change', { to });
}

function openPause() {
  game.scene = 'menu';
  setHint(null);
  pauseMenu({
    resume: closePause,
    save: () => { doSave('manual'); },
    toTitle: async () => { doSave('exit'); toTitle(); },
    settingsChanged: () => {},
  });
}
function closePause() { hideScreen(); game.scene = 'world'; }

/* ── Interacciones ── */
async function interact(kind, o) {
  if (game.scene !== 'world') return;
  const s = game.state;
  switch (kind) {
    case 'npc': {
      const d = npcDialog(o.id);
      await dialog(d.lines);
      if (d.flagSet) setFlag(d.flagSet);
      if (d.quest) startQuest(d.quest);
      if (!s.quests.active.includes('q_escrito') && !s.quests.done.includes('q_escrito') && o.id === 'ximon') startQuest('q_escrito');
      break;
    }
    case 'chest':
      openChest(o.id, o.loot); sfx.item();
      break;
    case 'secret':
      s.secrets.push(o.id);
      for (const [k, n] of Object.entries(o.loot)) addItem(k, n);
      sfx.item(); bus.emit('secret:found', { id: o.id });
      toast('¡Descubriste un secreto!', 'good');
      break;
    case 'savepoint':
      if (!s.savepoints.includes(o.id)) s.savepoints.push(o.id);
      restoreAll();
      bus.emit('savepoint', { id: o.id });
      toast(`${o.name}: vida y savia restauradas`, 'good', 2200);
      doSave('savepoint');
      pendingReason = null; clearTimeout(saveTimer);
      break;
    case 'interact':
      if (o.id === 'inscription') return inscriptionScene();
      await dialog(SCENES[o.id] ?? [{ text: '…' }]);
      break;
  }
}

async function inscriptionScene() {
  if (flag('suit')) { await dialog([{ text: 'El escrito habla del trato entre el pueblo y el guardián del bosque.', thought: true }]); return; }
  if (!flag('met_ximon')) { await dialog([{ text: 'Antes debería hablar con Ximón, que me estaba buscando.', thought: true }]); return; }
  await dialog(SCENES.inscription);
  game.scene = 'cutscene';
  await fadeTo(() => {
    game.state.chapter = 2;
    setFlag('suit');
    checkSkillUnlocks();
    world.enter('bosque', null);
  }, 500);
  game.scene = 'world';
  await dialog(SCENES.suit);
  bus.emit('zone:change', { to: 'bosque' });
}

/* ── Combate ── */
async function startBattle(descs, opts = {}) {
  if (game.scene !== 'world' || battle) return;
  game.scene = 'cutscene'; setHint(null);
  if (descs.some((d) => d.id === 'e_comandante') && !flag('commander_met')) { setFlag('commander_met'); await dialog(SCENES.commanderIntro); }
  battle = new Battle({ enemies: descs, ambush: !!opts.ambush, hooked: !!opts.hooked, onEnd: (res) => battleEnd(res, descs, opts) });
  battle.start();
}

async function battleEnd({ result, ids }, descs, opts) {
  battle = null;
  game.scene = 'world';
  if (result === 'win') {
    world.afterBattle('win', ids);
    toast('Mercenarios derrotados', 'good', 1800);
    if (ids.includes('e_comandante')) await commanderDown();
    flushAutosave();
  } else if (result === 'flee') {
    world.afterBattle('flee'); toast('Huiste del combate.', 'info');
  } else if (result === 'retry') {
    startBattle(descs, { ...opts, ambush: false });
  } else if (result === 'load') {
    if (save.hasValidSave()) continueGame(); else toTitle();
  } else toTitle();
}

async function commanderDown() {
  game.scene = 'cutscene';
  setFlag('temple_open');
  await dialog(SCENES.marckFall);
  game.state.chapter = 3;
  await fadeTo(() => world.enter('templo', null), 600);
  game.scene = 'world';
  bus.emit('zone:change', { to: 'templo' });
}

async function startMarckFight() {
  if (game.scene !== 'world' || battle) return;
  game.scene = 'cutscene'; setHint(null);
  if (!flag('marck_met')) { setFlag('marck_met'); await dialog(SCENES.marckIntro); }
  battle = new Battle({ enemies: [], controller: createMarckFight(), onEnd: (res) => marckEnd(res) });
  battle.start();
}

async function marckEnd({ result }) {
  battle = null;
  game.scene = 'world';
  if (result === 'win') {
    game.scene = 'cutscene';
    await dialog(SCENES.marckEnd);
    setFlag('marck_defeated');
    game.state.chapter = 4;
    game.state.player.hp = Math.max(game.state.player.hp, Math.ceil(game.state.player.maxHp * 0.5));
    game.scene = 'world';
    doSave('marck'); pendingReason = null;
    gameOverlay('FIN', 'Has protegido el amuleto… por ahora. Tu partida quedó guardada; puedes seguir explorando.',
      [['Seguir explorando', () => { hideScreen(); game.scene = 'world'; }], ['Volver al título', toTitle]]);
    game.scene = 'menu';
  } else if (result === 'retry') startMarckFight();
  else if (result === 'load') { if (save.hasValidSave()) continueGame(); else toTitle(); } else toTitle();
}

/* ── Bucle ── */
let last = performance.now(), hudT = 0;
function drawTitleBackdrop(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#0d2316'); g.addColorStop(1, '#2d5a31');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#143a1f';
  for (let x = -20; x < VIEW_W; x += 64) ctx.fillRect(x, 0, 18, VIEW_H);
  drawPerson(ctx, 500, 430, 7, 'rootknight');
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  try {
    if (game.scene === 'title') drawTitleBackdrop(ctx, now);
    else {
      if (game.scene === 'world') {
        world.update(dt);
        if (input.hit('pause') && game.scene === 'world') openPause();
        campCheck();
      } else if (game.scene === 'menu' && input.hit('pause') && $('#overlay').classList.contains('show') && !document.querySelector('.modal-back')) {
        if (!$('#overlay').querySelector('.end')) closePause();
      }
      if (battle) { battle.update(dt); ctx.fillStyle = '#10151a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); battle.draw(ctx); } else world.draw();
      hudT -= dt; if (hudT <= 0) { hudT = 0.2; updateHud(); }
    }
  } catch (e) { console.error(e); }
  input.endFrame();
  requestAnimationFrame(frame);
}

async function campCheck() {
  if (world.zoneId === 'bosque' && !flag('camp_seen') && world.pl.x > 17 * TS && world.pl.y < 18 * TS) {
    setFlag('camp_seen');
    game.scene = 'cutscene';
    await dialog(SCENES.campOverheard);
    game.scene = 'world';
  }
}

function fit() {
  const k = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
  const app = $('#app');
  app.style.transform = `translate(-50%,-50%) scale(${k})`;
}
addEventListener('resize', fit);
fit();

// Acceso para pruebas manuales / automatizadas desde la consola del navegador.
globalThis.rootKnight = {
  game, save, world, bus, get battle() { return battle; }, autosave, doSave, persistent,
  abortBattle() { battle?.destroy(); battle = null; game.scene = 'world'; }, // solo para pruebas
};

showTitle();
requestAnimationFrame(frame);
