// Estado de juego único y serializable + operaciones que emiten eventos.
// Los eventos son los que disparan el guardado automático (ver main.js).
import { bus } from './events.js';
import { defaultState } from '../save/schema.js';
import { ITEMS, SKILLS, QUESTS } from '../data/content.js';

export const game = {
  state: defaultState(),
  scene: 'title', // title | world | battle | dialog | menu
};

export const xpForNext = (lvl) => 20 + lvl * 15;
export const hasSkill = (id) => game.state.skills.includes(id);
export const flag = (f) => !!game.state.flags[f];

export function setFlag(f, v = true) {
  if (game.state.flags[f] === v) return;
  game.state.flags[f] = v;
  bus.emit('flag', { flag: f, value: v });
  evalQuests();
}

export function addItem(id, n = 1) {
  const inv = game.state.inventory;
  inv[id] = (inv[id] ?? 0) + n;
  bus.emit('item:gain', { id, n });
  evalQuests();
}

export function removeItem(id, n = 1) {
  const inv = game.state.inventory;
  if ((inv[id] ?? 0) < n) return false;
  inv[id] -= n;
  if (inv[id] <= 0) delete inv[id];
  return true;
}

export function unlockSkill(id) {
  if (hasSkill(id)) return false;
  game.state.skills.push(id);
  bus.emit('skill:unlock', { id });
  return true;
}

export function checkSkillUnlocks() {
  const p = game.state.player;
  for (const [id, s] of Object.entries(SKILLS)) {
    if (hasSkill(id)) continue;
    if ((s.unlockLevel && p.level >= s.unlockLevel) || (s.unlockFlag && flag(s.unlockFlag))) unlockSkill(id);
  }
}

export function gainXp(n) {
  const p = game.state.player;
  p.xp += n;
  while (p.xp >= xpForNext(p.level)) {
    p.xp -= xpForNext(p.level);
    p.level++;
    p.maxHp += 8; p.atk += 2; p.def += 1; p.maxEnergy += 2;
    p.hp = p.maxHp; p.energy = p.maxEnergy;
    bus.emit('level:up', { level: p.level });
  }
  checkSkillUnlocks();
}

export function healPlayer(n) {
  const p = game.state.player;
  p.hp = Math.min(p.maxHp, p.hp + n);
}
export function restoreAll() {
  const p = game.state.player;
  p.hp = p.maxHp; p.energy = p.maxEnergy;
}

/** Usa un consumible. Devuelve el texto del efecto o null si no se pudo. */
export function useConsumable(id) {
  const it = ITEMS[id];
  const p = game.state.player;
  if (!it || it.type !== 'consumible' || !(game.state.inventory[id] > 0)) return null;
  if (it.heal && p.hp >= p.maxHp && !it.energy) return null;
  removeItem(id, 1);
  if (it.heal) healPlayer(it.heal);
  if (it.energy) p.energy = Math.min(p.maxEnergy, p.energy + it.energy);
  return it.heal ? `+${it.heal} de vida` : `+${it.energy} de savia`;
}

export function startQuest(id) {
  const q = game.state.quests;
  if (!QUESTS[id] || q.active.includes(id) || q.done.includes(id)) return;
  q.active.push(id);
  bus.emit('quest:start', { id });
  evalQuests();
}

function goalMet(g) {
  const s = game.state;
  if (g.type === 'flag') return !!s.flags[g.flag];
  if (g.type === 'defeat') return g.ids.every((i) => s.defeated.includes(i));
  if (g.type === 'item') return (s.inventory[g.id] ?? 0) >= g.n;
  return false;
}

export function questProgress(id) {
  const g = QUESTS[id].goal;
  const s = game.state;
  if (g.type === 'defeat') return `${g.ids.filter((i) => s.defeated.includes(i)).length}/${g.ids.length}`;
  if (g.type === 'item') return `${Math.min(s.inventory[g.id] ?? 0, g.n)}/${g.n}`;
  return '';
}

let evaluating = false;
export function evalQuests() {
  if (evaluating) return;
  evaluating = true;
  try {
    const q = game.state.quests;
    let changed = true;
    while (changed) { // las recompensas pueden completar o iniciar otras misiones
      changed = false;
      for (const id of [...q.active]) {
        const def = QUESTS[id];
        if (!def || !goalMet(def.goal)) continue;
        changed = true;
        q.active = q.active.filter((x) => x !== id);
        q.done.push(id);
        if (def.reward?.xp) gainXp(def.reward.xp);
        for (const [it, n] of Object.entries(def.reward?.items ?? {})) addItem(it, n);
        if (def.setFlag) setFlag(def.setFlag);
        bus.emit('quest:complete', { id });
        if (def.next && !q.active.includes(def.next) && !q.done.includes(def.next)) {
          q.active.push(def.next);
          bus.emit('quest:start', { id: def.next });
        }
      }
    }
  } finally { evaluating = false; }
}

export function markDefeated(ids) {
  for (const id of ids) if (!game.state.defeated.includes(id)) game.state.defeated.push(id);
  evalQuests();
}

export function openChest(id, loot) {
  if (game.state.chests.includes(id)) return false;
  game.state.chests.push(id);
  for (const [it, n] of Object.entries(loot)) addItem(it, n);
  bus.emit('chest:open', { id, loot });
  return true;
}
