// Combate contra Marck — sistema separado del de los mercenarios.
// Mecánicas propias: reserva de agua (el río), presión acumulada, esquiva/bloqueo, el despertar
// del poder vegetal (Troncos y Sauces) y los sauces que absorben el agua. Marck nunca muere:
// al perder toda su vida se retira por el río (final fiel al libro).
import { game, unlockSkill, setFlag, flag } from '../core/state.js';
import { drawPerson, OUTLINE } from '../ui/sprites.js';
import { pixelPanel, pixelBar, FONT } from '../ui/scenery.js';
import { dialog } from '../ui/ui.js';
import { sfx } from '../core/audio.js';
import { rnd, wait } from './battle.js';

const MAX_WATER = 100, MAX_PRESSURE = 100;

export function createMarckFight() {
  return {
    id: 'marck',
    intro: 'Marck alza las manos: el amuleto brilla azul marino y el río se levanta.',

    setup(b) {
      const hp = 170;
      b.enemies = [{
        uid: 9999, id: null, cls: 'marck', name: 'Marck', maxHp: hp, hp, atk: 14, def: 3, xp: 60, boss: true, lvl: 1,
        status: { stun: 0, bound: 0, guard: false, noGuard: 0, buff: 0 }, aim: false, callIn: -1, phase: 1, step: 0, flash: 0,
        intent: null, x: 450, y: 190, water: MAX_WATER, pressure: 0, revealed: false,
      }];
      b.marck = b.enemies[0];
      b.willows = 0;
      b.awakened = flag('awakened');
    },

    skillOk(b, id) { return id !== 'willows' || b.awakened; },

    plan(b, e) {
      const I = (label, kind, extra = {}) => ({ label, kind, warn: false, ...extra });
      if (e.hp <= 0) return null;
      if (e.pressure >= MAX_PRESSURE) return I('¡Aplastamiento!', 'crush', { warn: true });
      if (b.willows > 0 && Math.random() < 0.4) return I('Corta un sauce', 'cut');
      if (e.water <= 0) return I(Math.random() < 0.5 ? 'Golpe seco (sin agua)' : 'Golpe', 'weak', { warn: false });
      const cycle = ['fist', 'blades', 'pressure', 'blades', 'fist', 'pressure'];
      const k = cycle[e.step++ % cycle.length];
      if (k === 'fist') return I('Puño de agua', 'fist', { warn: true });
      if (k === 'blades') return I('Cuchillas de agua ×4', 'blades', { warn: true });
      return I('Aumenta la presión', 'pressure');
    },

    async perform(b, e) {
      const it = e.intent;
      if (!it) return;
      let kind = it.kind;
      const needs = { fist: 15, blades: 18, crush: 10 }[kind] ?? 0;
      if (needs && e.water < needs && kind !== 'crush') kind = 'weak'; // sin agua suficiente
      switch (kind) {
        case 'fist':
          sfx.water(); b.say('Marck: Puño de agua. Un puño enorme cae sobre ti.'); e.lunge = 0.3;
          b.hitPlayer(e, 2.0, { label: 'te aplasta con el puño de agua' }); e.water -= 15; await wait(650); break;
        case 'blades':
          sfx.water(); b.say('Marck separa el agua en cuchillas…'); e.water -= 18;
          for (let i = 0; i < 4; i++) { b.hitPlayer(e, 0.55, { ranged: true, label: 'cuchilla de agua' }); await wait(380); if (b.p.hp <= 0) return; }
          break;
        case 'pressure':
          sfx.water(); e.pressure = Math.min(MAX_PRESSURE, e.pressure + 35);
          b.say(`La presión del agua sube (${e.pressure}/${MAX_PRESSURE}). Con ${MAX_PRESSURE} te aplastará.`); await wait(650); break;
        case 'crush':
          sfx.water(); b.say('¡Toneladas de agua caen sobre ti!');
          b.hitPlayer(e, 2.6, { pierce: true, label: 'te aplasta bajo el agua' }); e.pressure = 0; e.water = Math.max(0, e.water - 10); await wait(750); break;
        case 'cut':
          b.willows = Math.max(0, b.willows - 1); sfx.leaf(); b.say('Marck corta uno de los sauces.'); await wait(600); break;
        default:
          b.say('Marck, sin agua, ataca a puñetazos.'); e.lunge = 0.3; b.hitPlayer(e, 0.9, { label: 'te golpea' }); await wait(550);
      }
    },

    modifyHit(b, e, dmg, verb) {
      const m = b.marck;
      if (m.water <= 0) return { dmg, msg: ' — sin agua, no puede esquivar' };
      if (verb === 'Gancho' || verb === 'Lianas' || m.revealed) {
        m.revealed = verb === 'Gancho';
        return { dmg, msg: verb === 'Gancho' ? ' — lo desequilibras: no podrá esquivar el siguiente golpe' : '' };
      }
      const r = Math.random(), dodge = verb === 'Dos troncos aplastan' ? 0.15 : 0.3;
      if (r < dodge) return { cancel: true, msg: 'Marck esquiva usando el agua como impulso.' };
      if (r < dodge + 0.2) return { dmg: dmg * 0.5, msg: ' (Marck bloquea con una pared de agua)' };
      return { dmg };
    },

    async playerAction(b, id) {
      if (id !== 'willows') return false;
      sfx.leaf();
      if (b.willows >= 3) { b.say('Ya hay tres sauces: no caben más.'); b.p.energy += 3; return true; }
      b.willows++;
      b.marck.water = Math.max(0, b.marck.water - 20);
      b.say(`Brota un sauce (${b.willows}/3): absorbe agua del río. Reserva de Marck: ${b.marck.water}.`);
      await wait(700); return true;
    },

    checkWin(b) { return b.marck.hp <= 0; },

    async roundEnd(b) {
      const m = b.marck;
      if (b.willows > 0 && m.water >= 0) {
        const drain = 10 * b.willows;
        m.water = Math.max(0, m.water - drain); m.pressure = Math.max(0, m.pressure - 12 * b.willows);
        b.say(`Los sauces absorben agua (−${drain}). Reserva de Marck: ${m.water}.`);
      } else m.water = Math.min(MAX_WATER, m.water + 6); // el río lo repone si no hay sauces
      if (!b.awakened && b.round >= 3) await this.awaken(b);
      if (m.water <= 0 && !m.dryNoted) { m.dryNoted = true; b.say('¡Marck casi no tiene agua! No puede esquivar ni usar sus ataques mayores.'); }
    },

    async awaken(b) {
      b.awakened = true;
      sfx.level();
      await dialog([
        { text: 'Mi pecho empieza a brillar de un fuerte color verde. Me siento diferente, más fuerte… y siento algo en mis manos.', thought: true },
        { who: 'Eduardo', text: '—Entonces, ¿yo también tengo un amuleto? Me serviría mucho ahorita mismo.' },
        { text: 'Me concentro y del suelo crece una rama que me eleva, sacándome del agua. El amuleto me da la capacidad de crear plantas.', thought: true },
        { who: 'Marck', text: '—Así que decidiste pelear, entonces. No me culpes por la decisión que tomaste.' },
      ]);
      setFlag('awakened');
      unlockSkill('trunks'); unlockSkill('willows');
      b.p.energy = b.p.maxEnergy;
      b.say('¡El poder vegetal despierta! Nuevas habilidades: Troncos y Sauces. Savia restaurada.');
      b.say('Idea: los sauces son esponjas naturales. ¡Absorberán el agua de Marck!');
    },

    drawBackground(b, c, t) {
      // río con orilla de piedra y ondas que corren
      c.fillStyle = '#0a0d16'; c.fillRect(0, 282, 640, 4);
      c.fillStyle = '#4a5674'; c.fillRect(0, 282, 640, 2);
      c.fillStyle = '#1d4f8a'; c.fillRect(0, 286, 640, 34);
      c.fillStyle = '#173f70'; for (let x = 0; x < 640; x += 64) c.fillRect(x + 20, 306, 30, 2);
      c.fillStyle = '#3f86d0'; for (let x = -40; x < 640; x += 40) c.fillRect(Math.round((x + t / 30) % 680 / 2) * 2, 294, 20, 2);
      c.fillStyle = '#7ab8ee'; for (let x = -60; x < 640; x += 60) c.fillRect(Math.round((x + t / 22) % 700 / 2) * 2, 300, 8, 2);
      // sauces
      for (let i = 0; i < b.willows; i++) {
        const x = 250 + i * 44, sw = (k) => Math.round(Math.sin(t / 300 + k) * 2) * 2;
        c.fillStyle = OUTLINE; c.fillRect(x + 6, 198, 12, 74); c.fillRect(x - 8, 166, 40, 26);
        c.fillStyle = '#4a3320'; c.fillRect(x + 8, 200, 8, 70); c.fillStyle = '#6a4a2e'; c.fillRect(x + 8, 200, 2, 70);
        c.fillStyle = '#3f8a42'; c.fillRect(x - 6, 168, 36, 22); c.fillStyle = '#5aa452'; c.fillRect(x - 4, 168, 20, 4);
        for (let k = 0; k < 5; k++) { // ramas colgantes
          const h = 32 + ((k * 7) % 12) + sw(k);
          c.fillStyle = OUTLINE; c.fillRect(x - 8 + k * 8, 188, 6, h + 2);
          c.fillStyle = k % 2 ? '#4f9a50' : '#3f8a42'; c.fillRect(x - 6 + k * 8, 188, 2, h);
          c.fillStyle = '#7cc46a'; c.fillRect(x - 6 + k * 8, 188 + h - 4, 2, 2);
        }
      }
    },

    drawEnemy(b, c, e, ox, sc, t) {
      const m = b.marck;
      if (m.water > 0) { // orbes de agua (círculos pixelados)
        const r = 6 + Math.round((m.water / 100) * 4) * 2;
        for (let i = 0; i < 4; i++) {
          const a = t / 500 + i * 1.57, cx = Math.round((e.x + Math.cos(a) * 70) / 2) * 2, cy = Math.round((e.feet - 90 + Math.sin(a) * 36) / 2) * 2;
          for (let dy = -r; dy <= r; dy += 2) {
            const hw = Math.round(Math.sqrt(r * r - dy * dy) / 2) * 2;
            c.fillStyle = dy < -r / 3 ? 'rgba(170,220,255,.8)' : 'rgba(80,170,240,.7)'; c.fillRect(cx - hw, cy + dy, hw * 2, 2);
          }
          c.fillStyle = '#ffffff'; c.fillRect(cx - r / 2, cy - r / 2, 2, 2);
        }
      }
      drawPerson(c, e.x + ox, e.feet, sc, 'marck', { face: 'w', aura: m.water > 0 });
    },

    drawOverlay(b, c) {
      const m = b.marck, x = 176, y = 20; // centrado: a la derecha va la intención de Marck
      pixelPanel(c, x - 8, y - 8, 216, 60, '#4aa0e0', '#0e1a2a');
      c.fillStyle = '#fff'; c.font = `12px ${FONT}`; c.fillText('Agua del río', x, y + 6);
      pixelBar(c, x, y + 12, 200, 8, m.water / MAX_WATER, '#4aa0e0', '#12304f');
      c.fillStyle = '#fff'; c.fillText('Presión', x, y + 32);
      pixelBar(c, x, y + 38, 200, 8, m.pressure / MAX_PRESSURE, m.pressure >= 70 ? '#ff6040' : '#d0a040', '#3a2a12');
    },
  };
}
