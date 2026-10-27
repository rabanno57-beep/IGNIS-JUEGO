// Motor de combate por turnos. Los mercenarios usan la IA integrada (planIntent/perform);
// jefes con reglas propias (Marck) se enchufan con un `controller` (ver marck.js).
import { game, hasSkill, markDefeated, addItem, gainXp, useConsumable, setFlag } from '../core/state.js';
import { SKILLS, ITEMS } from '../data/content.js';
import { MERC } from '../data/mercenaries.js';
import { drawPerson } from '../ui/sprites.js';
import { el, $ } from '../ui/ui.js';
import { sfx } from '../core/audio.js';
import { bus } from '../core/events.js';

export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let uidc = 0;

export function makeEnemy(d) {
  const base = MERC[d.cls];
  const l = d.lvl ?? 1;
  const maxHp = Math.round(base.hp * l);
  return {
    uid: ++uidc, id: d.id ?? null, cls: d.cls, name: d.name ?? base.name, maxHp, hp: maxHp,
    atk: Math.round(base.atk * (1 + (l - 1) * 0.7)), def: Math.round(base.def * (1 + (l - 1) * 0.5)),
    xp: Math.round(base.xp * l), boss: !!base.boss, lvl: l,
    status: { stun: 0, bound: 0, guard: false, noGuard: 0, buff: 0 },
    aim: false, callIn: base.alerts ? 3 : -1, phase: 1, step: 0, flash: 0, intent: null, x: 0, y: 0,
  };
}

const W = 640, H = 320;

export class Battle {
  /**
   * @param {{enemies:object[], ambush?:boolean, hooked?:boolean, controller?:object, canFlee?:boolean,
   *          onEnd:(res:{result:string, ids:string[]})=>void}} o
   */
  constructor(o) {
    this.o = o; this.ctrl = o.controller ?? null;
    this.descs = o.enemies;
    this.enemies = o.enemies.map(makeEnemy);
    this.p = game.state.player;
    this.snapshot = JSON.parse(JSON.stringify({ player: this.p, inventory: game.state.inventory }));
    this.ps = { defending: false, shield: 0, shieldTurns: 0, blind: 0, ambushBonus: !!o.ambush };
    this.round = 1; this.busy = true; this.alive = true; this.logs = []; this.fx = []; this.shake = 0; this.t = 0;
    this.canFlee = o.canFlee !== false && !this.enemies.some((e) => e.boss) && !this.ctrl;
    this.layout();
  }

  layout() {
    const n = this.enemies.length;
    this.enemies.forEach((e, i) => {
      const big = e.cls === 'comandante' || e.cls === 'marck';
      e.sc = n === 1 || (big && n <= 2) ? (big ? 4.5 : 4) : n <= 3 ? 3 : 2.6;
      e.feet = n === 1 ? 250 : 250 - (i % 2) * 10;
      e.x = n === 1 ? 450 : 300 + (i + 0.5) * (300 / n) + 20;
      e.y = e.feet - 50;
    });
  }
  living() { return this.enemies.filter((e) => e.hp > 0); }

  /* ── Ciclo ── */
  async start() {
    game.scene = 'battle';
    this.ui = el('div', { class: 'battle-ui' }, this.logEl = el('div', { class: 'b-log', 'aria-live': 'polite' }), this.menuEl = el('div', { class: 'b-menu' }));
    $('#battle-layer').replaceChildren(this.ui);
    $('#battle-layer').classList.add('on');
    this.keyH = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && !this.busy) this.menuEl.querySelectorAll('button:not([disabled])')[n - 1]?.click(); };
    addEventListener('keydown', this.keyH);
    this.ctrl?.setup?.(this);
    this.layout();
    this.say(this.ctrl?.intro ?? (this.enemies.length > 1 ? '¡Una patrulla de mercenarios te ataca!' : `¡${this.enemies[0].name} te ha encontrado!`));
    if (this.o.ambush) {
      this.living().forEach((e) => { if (!e.boss) e.status.stun = 1; });
      this.say(this.o.hooked ? 'El gancho lo atrae: ¡queda aturdido! Tu primer golpe será más fuerte.' : '¡Emboscada! Tu primer golpe será más fuerte.');
    }
    this.planAll();
    await wait(500);
    this.playerTurn();
  }

  destroy() {
    this.alive = false;
    removeEventListener('keydown', this.keyH);
    $('#battle-layer').classList.remove('on');
    $('#battle-layer').replaceChildren();
  }

  say(text) {
    this.logs.push(text); if (this.logs.length > 4) this.logs.shift();
    this.logEl.replaceChildren(...this.logs.map((l, i) => el('div', { class: i === this.logs.length - 1 ? 'last' : '' }, l)));
  }

  planAll() { for (const e of this.living()) e.intent = this.ctrl?.plan ? this.ctrl.plan(this, e) : this.planIntent(e); }

  playerTurn() {
    if (!this.alive) return;
    this.busy = false; this.ps.defending = false;
    this.renderMenu();
  }

  /* ── Menús ── */
  btn(label, fn, { disabled = false, title = '' } = {}) {
    return el('button', { class: 'btn small', disabled, title, onclick: () => { if (this.busy) return; sfx.select(); fn(); } }, label);
  }

  renderMenu() {
    const p = this.p, m = [];
    const act = (id, label) => {
      const s = SKILLS[id], extra = this.ctrl?.skillOk ? this.ctrl.skillOk(this, id) : true;
      if (!hasSkill(id) || !extra) return;
      m.push(this.btn(`${m.length + 1}. ${label ?? s.name}${s.cost ? ` (${s.cost})` : ''}`, () => this.pickTarget(id), { disabled: p.energy < s.cost, title: s.desc }));
    };
    act('strike', 'Golpear'); act('macuahuitl'); act('hook'); act('roots'); act('vines'); act('trunks');
    if (this.ctrl) act('willows');
    m.push(this.btn(`${m.length + 1}. Objeto`, () => this.itemMenu()));
    m.push(this.btn(`${m.length + 1}. Defender`, () => this.doAction('defend', null)));
    if (this.canFlee) m.push(this.btn(`${m.length + 1}. Huir`, () => this.doAction('flee', null)));
    this.menuEl.replaceChildren(el('div', { class: 'b-title' }, `Turno ${this.round} — savia ${p.energy}/${p.maxEnergy}`), ...m);
    this.menuEl.querySelector('button:not([disabled])')?.focus();
  }

  pickTarget(id) {
    const noTarget = ['roots', 'willows'];
    const live = this.living();
    if (noTarget.includes(id) || live.length === 1) return this.doAction(id, live[0]);
    this.menuEl.replaceChildren(el('div', { class: 'b-title' }, 'Elige objetivo'),
      ...live.map((e, i) => this.btn(`${i + 1}. ${e.name} (${e.hp}/${e.maxHp})`, () => this.doAction(id, e))),
      this.btn('Cancelar', () => this.renderMenu()));
  }

  itemMenu() {
    const inv = game.state.inventory;
    const items = Object.keys(inv).filter((k) => ITEMS[k]?.type === 'consumible');
    this.menuEl.replaceChildren(el('div', { class: 'b-title' }, 'Objetos'),
      ...(items.length ? items.map((k, i) => this.btn(`${i + 1}. ${ITEMS[k].name} ×${inv[k]}`, () => this.doAction('item', k), { title: ITEMS[k].desc })) : [el('div', { class: 'b-empty' }, 'No tienes consumibles.')]),
      this.btn('Volver', () => this.renderMenu()));
  }

  /* ── Acciones del jugador ── */
  async doAction(id, target) {
    this.busy = true; this.menuEl.replaceChildren();
    const p = this.p, s = SKILLS[id];
    if (s) p.energy -= s.cost;
    let spent = true;
    if (this.ctrl?.playerAction && await this.ctrl.playerAction(this, id, target)) { /* manejado por el jefe */ } else {
      switch (id) {
        case 'strike': sfx.hit(); await this.hitEnemy(target, 1, 'Golpeas'); break;
        case 'macuahuitl': sfx.hit(); await this.hitEnemy(target, 1.7, 'Macuahuitl', { pierceGuard: 0.5 }); break;
        case 'trunks': sfx.leaf(); await this.hitEnemy(target, 2.1, 'Dos troncos aplastan', { pierceGuard: 0.5 }); break;
        case 'hook':
          sfx.leaf(); await this.hitEnemy(target, 0.5, 'Gancho');
          if (target.hp > 0) {
            if (target.aim) { target.aim = false; this.say(`El gancho interrumpe el apunte de ${target.name}.`); }
            if (target.status.guard) { target.status.guard = false; target.status.noGuard = 1; this.say('¡Su guardia se rompe!'); }
            if (target.boss) this.say(`${target.name} resiste el tirón.`); else { target.status.stun = 1; this.say(`${target.name} queda aturdido.`); }
          }
          break;
        case 'vines':
          sfx.leaf(); await this.hitEnemy(target, 0.6, 'Lianas');
          if (target.hp > 0) {
            target.status.bound = target.boss ? 1 : 2; target.aim = false;
            if (target.status.guard) { target.status.guard = false; target.status.noGuard = 1; this.say('¡Las lianas rompen su guardia!'); }
            this.say(`${target.name} queda atado.`);
          }
          break;
        case 'roots':
          sfx.leaf(); this.ps.shield = 12 + p.level * 4; this.ps.shieldTurns = 3;
          this.say(`Raíces protectoras: un muro absorbe hasta ${this.ps.shield} de daño.`); this.floatAtPlayer('Raíces', '#7dff9a'); await wait(500); break;
        case 'defend': this.ps.defending = true; sfx.block(); this.say('Te cubres con el traje: recibirás menos daño.'); await wait(450); break;
        case 'item': {
          const r = useConsumable(target);
          if (!r) { this.say('No hace falta usarlo ahora.'); spent = false; this.busy = false; this.renderMenu(); return; }
          sfx.item(); this.say(`Usas ${ITEMS[target].name}: ${r}.`); this.floatAtPlayer(r, '#7dff9a'); await wait(500); break;
        }
        case 'flee':
          if (Math.random() < 0.65) { this.say('¡Escapas entre los árboles!'); await wait(500); return this.finish('flee'); }
          this.say('No logras escapar.'); await wait(500); break;
      }
    }
    if (!this.alive) return;
    this.ps.ambushBonus = false;
    if (spent) await this.afterPlayer();
  }

  async afterPlayer() {
    this.sweepDead();
    if (this.ctrl?.checkWin ? await this.ctrl.checkWin(this) : this.living().length === 0) return this.victory();
    await this.enemyPhase();
  }

  sweepDead() {
    for (const e of this.enemies) if (e.hp <= 0 && !e.removed) { e.removed = true; this.say(`${e.name} cae derrotado.`); }
  }

  async hitEnemy(e, mult, verb, { pierceGuard = 0 } = {}) {
    if (this.ps.blind > 0 && Math.random() < 0.5) { this.say('El humo te desorienta: fallas.'); this.ps.blind--; await wait(450); return; }
    let dmg = this.p.atk * mult * rnd(0.9, 1.1);
    if (this.ps.ambushBonus) dmg *= 1.5;
    let note = '';
    if (this.ctrl?.modifyHit) { const r = this.ctrl.modifyHit(this, e, dmg, verb); if (r.cancel) { this.say(r.msg); await wait(500); return; } dmg = r.dmg; note = r.msg ?? ''; }
    if (e.status.guard) { dmg *= 1 - (0.75 * (1 - pierceGuard)); note = ' (bloqueado en parte)'; }
    dmg = Math.max(1, Math.round(dmg - e.def * (e.status.guard ? 0.5 : 1)));
    e.hp = Math.max(0, e.hp - dmg); e.flash = 0.25; this.shake = 6;
    this.floatAt(e, `-${dmg}`, '#ffd24a');
    this.say(`${verb} a ${e.name}: ${dmg} de daño${note}.`);
    await wait(550);
  }

  /* ── Daño al jugador ── */
  hitPlayer(e, mult, { ranged = false, pierce = false, label = 'ataca' } = {}) {
    let dmg = e.atk * mult * (e.status.buff > 0 ? 1.3 : 1) * rnd(0.9, 1.1) - this.p.def * 0.5;
    if (this.ps.defending) dmg *= ranged ? 0.4 : 0.5; // la defensa funciona mejor contra disparos
    if (this.ps.defending && pierce) dmg = dmg / (ranged ? 0.4 : 0.5) * 0.7;
    dmg = Math.max(1, Math.round(dmg));
    let absorbed = 0;
    if (this.ps.shield > 0) {
      absorbed = Math.min(this.ps.shield, Math.round(dmg * (pierce ? 0.5 : 1)));
      this.ps.shield -= absorbed; dmg -= absorbed;
    }
    if (ranged) { this.fx.push({ type: 'shot', x1: e.x - 20, y1: e.feet - 40, x2: 150, y2: 240, t: 0 }); sfx.shot(); } else sfx.hit();
    this.p.hp = Math.max(0, this.p.hp - dmg); this.shake = dmg > 0 ? 8 : 0;
    if (dmg > 0) this.floatAtPlayer(`-${dmg}`, '#ff6b6b'); else this.floatAtPlayer('Bloqueado', '#7dff9a');
    this.say(`${e.name} ${label}: ${dmg} de daño${absorbed ? ` (raíces absorben ${absorbed})` : ''}${this.ps.defending ? ' (te defiendes)' : ''}.`);
    return dmg;
  }

  floatAt(e, text, color) { this.fx.push({ type: 'text', x: e.x, y: e.feet - 28 * e.sc, text, color, t: 0 }); }
  floatAtPlayer(text, color) { this.fx.push({ type: 'text', x: 150, y: 190, text, color, t: 0 }); }

  /* ── Fase enemiga ── */
  async enemyPhase() {
    for (const e of [...this.living()]) {
      if (!this.alive) return;
      if (e.status.stun > 0) { e.status.stun--; this.say(`${e.name} está aturdido y pierde el turno.`); await wait(450); continue; }
      if (e.status.bound > 0) { e.status.bound--; this.say(`${e.name} forcejea con las lianas.`); await wait(450); continue; }
      if (this.ctrl?.perform) await this.ctrl.perform(this, e); else await this.perform(e);
      if (this.p.hp <= 0) return this.defeat();
      await wait(350);
    }
    if (!this.alive) return;
    // fin de ronda
    for (const e of this.living()) if (e.status.buff > 0) e.status.buff--;
    if (this.ps.shieldTurns > 0 && --this.ps.shieldTurns === 0 && this.ps.shield > 0) { this.ps.shield = 0; this.say('Las raíces se desvanecen.'); }
    this.p.energy = Math.min(this.p.maxEnergy, this.p.energy + 1);
    this.round++;
    await this.ctrl?.roundEnd?.(this);
    if (this.p.hp <= 0) return this.defeat();
    this.planAll();
    this.playerTurn();
  }

  /* ── IA de mercenarios (una diferencia funcional por clase) ── */
  planIntent(e) {
    const I = (label, kind, extra = {}) => ({ label, kind, mult: 1, hits: 1, ...extra });
    const st = e.status;
    switch (e.cls) {
      case 'raso': return Math.random() < 0.3 ? I('Embestida', 'attack', { mult: 1.5, warn: true }) : I('Golpe', 'attack');
      case 'armado': return e.aim ? I('¡Disparo!', 'attack', { mult: 1.9, ranged: true, warn: true }) : I('Apuntando…', 'aim');
      case 'defensa':
        if (st.noGuard > 0) { st.noGuard--; return I('Golpe de escudo', 'attack', { mult: 1.1 }); }
        return st.guard ? I('Golpe de escudo', 'attack', { mult: 1.1 }) : I('Se cubre (guardia)', 'guard');
      case 'explorador': {
        if (e.callIn > 0) {
          e.callIn--;
          if (e.callIn === 0) return I('¡Silbato: refuerzos!', 'call', { warn: true });
          return I(`Golpe débil · silbato en ${e.callIn}`, 'attack', { mult: 0.8 });
        }
        return I('Golpe débil', 'attack', { mult: 0.8 });
      }
      case 'veterano': return (e.step++ % 2 === 0) ? I('Culatazo (drena savia)', 'attack', { mult: 1.5, drain: 2, warn: true }) : I('Ráfaga (3 disparos)', 'attack', { mult: 0.62, hits: 3, ranged: true, warn: true });
      case 'elite': {
        const k = e.step++ % 3;
        if (k === 0) return I('Disparo de precisión', 'attack', { mult: 1.8, ranged: true, pierce: true, warn: true });
        if (k === 1) return st.noGuard > 0 ? (st.noGuard--, I('Golpe', 'attack', { mult: 1.1 })) : I('Guardia táctica', 'guard');
        return I('Golpe', 'attack', { mult: 1.1 });
      }
      case 'comandante': {
        if (e.phase === 1 && e.hp <= e.maxHp / 2) { e.phase = 2; e.step = 0; this.say(`¡${e.name} se enfurece!`); }
        const cycle = e.phase === 1 ? ['order', 'shoot', 'call', 'shoot'] : ['cross', 'smoke', 'cross', 'order'];
        const k = cycle[e.step++ % cycle.length];
        if (k === 'order') return I('Dar órdenes (+ataque aliados)', 'order');
        if (k === 'shoot') return I('Disparo de pistola', 'attack', { mult: 1.5, ranged: true, warn: true });
        if (k === 'call') return this.living().length < 3 ? I('Pide refuerzos', 'call') : I('Disparo de pistola', 'attack', { mult: 1.5, ranged: true, warn: true });
        if (k === 'cross') return I('Fuego cruzado', 'attack', { mult: 0.95, hits: 2, ranged: true, warn: true });
        return I('Granada de humo', 'smoke');
      }
    }
    return I('Golpe', 'attack');
  }

  async perform(e) {
    const it = e.intent;
    if (!it) return;
    if (e.cls === 'defensa' || e.cls === 'elite') if (it.kind !== 'guard') e.status.guard = false;
    switch (it.kind) {
      case 'attack':
        for (let i = 0; i < it.hits; i++) {
          this.say(`${e.name}: ${it.label}`); e.lunge = 0.3;
          this.hitPlayer(e, it.mult, it);
          if (it.drain) { this.p.energy = Math.max(0, this.p.energy - it.drain); this.say(`Pierdes ${it.drain} de savia.`); }
          await wait(520);
          if (this.p.hp <= 0) return;
        }
        if (e.cls === 'armado') e.aim = false;
        break;
      case 'aim': e.aim = true; this.say(`${e.name} te apunta con el arma… ¡el próximo turno disparará!`); await wait(600); break;
      case 'guard': e.status.guard = true; this.say(`${e.name} levanta la guardia: recibirá mucho menos daño.`); sfx.block(); await wait(600); break;
      case 'call': {
        if (this.living().length >= 4) break;
        const r = makeEnemy({ cls: 'raso', lvl: e.lvl, name: 'Refuerzo' });
        this.enemies.push(r); r.intent = this.planIntent(r); this.layout();
        sfx.alert(); this.say(`¡${e.name} pide refuerzos! Llega un mercenario.`); await wait(700); break;
      }
      case 'order': for (const o of this.living()) if (o !== e) o.status.buff = 2; sfx.alert(); this.say(`${e.name} grita órdenes: los suyos atacan con más fuerza.`); await wait(700); break;
      case 'smoke': this.ps.blind = 2; this.say('Una granada de humo te ciega: tus golpes pueden fallar.'); await wait(700); break;
    }
  }

  /* ── Fin ── */
  async victory() {
    const live = this.enemies; // todos derrotados
    const xp = live.reduce((s, e) => s + e.xp, 0);
    const loot = {};
    for (const e of live) {
      const drop = e.cls === 'comandante' ? 'tonico' : e.cls === 'elite' ? (Math.random() < 0.5 ? 'tonico' : null) : (Math.random() < 0.3 ? 'hierba' : null);
      if (drop) loot[drop] = (loot[drop] ?? 0) + 1;
    }
    const ids = live.map((e) => e.id).filter(Boolean);
    this.p.energy = Math.min(this.p.maxEnergy, this.p.energy + 3);
    const lvl0 = this.p.level;
    markDefeated(ids);
    gainXp(xp);
    for (const [k, n] of Object.entries(loot)) addItem(k, n);
    for (const e of live) bus.emit('merc:defeated', { id: e.id, cls: e.cls });
    this.say(`¡Victoria! +${xp} XP${this.p.level > lvl0 ? ` — ¡nivel ${this.p.level}!` : ''}`);
    if (this.p.level > lvl0) sfx.level();
    await wait(400);
    const lootTxt = Object.entries(loot).map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ');
    this.menuEl.replaceChildren(el('div', { class: 'b-title' }, 'Victoria'), el('div', {}, `+${xp} XP${lootTxt ? ` · Botín: ${lootTxt}` : ''}`),
      el('button', { class: 'btn small', onclick: () => this.finish('win', ids) }, 'Continuar'));
    this.menuEl.querySelector('button').focus();
  }

  defeat() {
    if (!this.alive || this.ended) return;
    this.ended = true; this.busy = true;
    this.say('Caes al suelo… El traje se apaga.');
    this.menuEl.replaceChildren(
      el('div', { class: 'b-title lose' }, 'Derrota'),
      this.btn('Reintentar combate', () => this.finish('retry')),
      this.btn('Cargar último guardado', () => this.finish('load')),
      this.btn('Menú principal', () => this.finish('title')));
    this.busy = false;
    this.menuEl.querySelector('button').focus();
  }

  restoreSnapshot() {
    Object.assign(game.state.player, this.snapshot.player);
    game.state.inventory = this.snapshot.inventory;
    // Para no dejar al jugador atascado con muy poca vida: al reintentar recupera al menos el 60 %.
    const p = game.state.player;
    p.hp = Math.max(p.hp, Math.ceil(p.maxHp * 0.6)); p.energy = p.maxEnergy;
  }

  finish(result, ids = []) {
    if (this.finished) return; this.finished = true;
    if (result === 'retry') this.restoreSnapshot();
    this.destroy();
    this.o.onEnd({ result, ids, descs: this.descs });
  }

  /* ── Dibujo ── */
  update(dt) {
    this.t += dt;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.type === 'shot' ? 0.25 : 1));
    for (const e of this.enemies) { if (e.flash > 0) e.flash -= dt; if (e.lunge > 0) e.lunge -= dt; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    this.ctrl?.update?.(this, dt);
  }

  draw(c) {
    const t = this.t * 1000;
    c.save();
    if (this.shake > 0) c.translate(rnd(-this.shake, this.shake) / 2, rnd(-this.shake, this.shake) / 2);
    const temple = this.ctrl?.id === 'marck' || game.state.zone === 'templo';
    const g = c.createLinearGradient(0, 0, 0, H);
    if (temple) { g.addColorStop(0, '#0e1a2a'); g.addColorStop(1, '#1f2f45'); } else { g.addColorStop(0, '#14301c'); g.addColorStop(1, '#2d5a31'); }
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = temple ? '#2a3550' : '#3a6b3a'; c.fillRect(0, 232, W, 88);
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x < W; x += 48) c.fillRect(x, 232, 24, 88);
    if (!temple) { c.fillStyle = '#1d4020'; for (let x = 0; x < W; x += 70) { c.fillRect(x + 20, 40, 14, 190); c.fillStyle = '#245c2a'; c.fillRect(x - 6, 20, 60, 70); c.fillStyle = '#1d4020'; } }
    this.ctrl?.drawBackground?.(this, c, t);

    drawPerson(c, 150, 248, 4, game.state.flags.suit ? 'rootknight' : 'eduardo', { face: 'e' });
    if (this.ps.shield > 0) { c.fillStyle = 'rgba(80,180,90,.5)'; for (let i = 0; i < 6; i++) c.fillRect(196, 160 + i * 16 + Math.sin(t / 200 + i) * 2, 10, 14); }
    if (this.ps.defending) { c.strokeStyle = '#9be89b'; c.lineWidth = 3; c.strokeRect(100, 136, 100, 118); }

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const ox = e.lunge > 0 ? -30 : 0;
      c.save(); if (e.flash > 0) c.globalAlpha = 0.5 + Math.sin(t / 30) * 0.4;
      const sc = e.sc;
      if (this.ctrl?.drawEnemy) this.ctrl.drawEnemy(this, c, e, ox, sc, t); else drawPerson(c, e.x + ox, e.feet, sc, e.cls, { face: 'w', pose: this.enemyPose(e) });
      c.restore();
      this.drawEnemyHud(c, e);
      if (e.aim) { c.strokeStyle = '#ff4040'; c.lineWidth = 2; c.beginPath(); c.arc(150, 210, 22 + Math.sin(t / 100) * 3, 0, 7); c.moveTo(120, 210); c.lineTo(180, 210); c.moveTo(150, 180); c.lineTo(150, 240); c.stroke(); }
      if (e.status.guard) { c.fillStyle = 'rgba(180,200,230,.55)'; c.fillRect(e.x - 14 * e.sc * 0.5 - 10, e.feet - 22 * e.sc * 0.75, 8, 20 * e.sc * 0.75); }
      if (e.status.stun > 0) { c.fillStyle = '#ffe070'; c.font = '16px monospace'; c.fillText('✦ ✦', e.x - 18, e.feet - 28 * e.sc - 4 + Math.sin(t / 90) * 3); }
      if (e.status.bound > 0) { c.strokeStyle = '#55c060'; c.lineWidth = 3; c.strokeRect(e.x - 8 * e.sc, e.feet - 26 * e.sc, 16 * e.sc, 28 * e.sc); }
    }
    for (const f of this.fx) {
      if (f.type === 'text') { c.globalAlpha = 1 - f.t; c.fillStyle = f.color; c.font = 'bold 22px monospace'; c.fillText(f.text, f.x - 20, f.y - f.t * 40); c.globalAlpha = 1; } else if (f.type === 'shot') {
        const k = f.t / 0.25; c.strokeStyle = '#ffe9a0'; c.lineWidth = 3; c.beginPath();
        c.moveTo(f.x1 + (f.x2 - f.x1) * Math.max(0, k - 0.3), f.y1 + (f.y2 - f.y1) * Math.max(0, k - 0.3)); c.lineTo(f.x1 + (f.x2 - f.x1) * k, f.y1 + (f.y2 - f.y1) * k); c.stroke();
      }
    }
    this.drawPlayerHud(c);
    this.ctrl?.drawOverlay?.(this, c, t);
    c.restore();
  }

  /** Pose del sprite según lo que hace o anuncia el mercenario. */
  enemyPose(e) {
    const it = e.intent;
    if (e.lunge > 0) return 'strike';
    if (e.status.guard) return 'guard';
    if (!it || e.status.stun > 0 || e.status.bound > 0) return null;
    if (it.label === 'Embestida') return 'charge';
    if (it.kind === 'aim' || (it.ranged && it.warn)) return 'aim';
    if (it.kind === 'call' || it.kind === 'order') return 'radio';
    return null;
  }

  drawEnemyHud(c, e) {
    const w = 96, x = e.x - w / 2, y = e.feet - 28 * e.sc - 44 - (e.cls === 'comandante' ? 12 : 0);
    c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x - 2, y - 2, w + 4, 30);
    c.fillStyle = '#3a1a1a'; c.fillRect(x, y + 14, w, 8);
    c.fillStyle = '#d04a4a'; c.fillRect(x, y + 14, w * (e.hp / e.maxHp), 8);
    c.fillStyle = '#fff'; c.font = '11px monospace'; c.fillText(e.name.replace(/^Mercenario (de )?/, '').replace(/^./, (m) => m.toUpperCase()).slice(0, 16), x, y + 10);
    const it = e.intent;
    if (it && this.busy === false) {
      const label = e.status.stun > 0 ? 'Aturdido' : e.status.bound > 0 ? 'Atado' : it.label;
      c.font = 'bold 11px monospace'; const tw = Math.min(190, c.measureText(label).width + 12);
      c.fillStyle = it.warn && !(e.status.stun || e.status.bound) ? 'rgba(160,30,30,.9)' : 'rgba(40,40,60,.9)';
      const bx = Math.max(4, Math.min(W - 4 - tw, e.x - tw / 2));
      c.fillRect(bx, y - 22, tw, 16);
      c.fillStyle = '#fff'; c.fillText(label, bx + 6, y - 10, tw - 8);
    }
    if (e.status.buff > 0) { c.fillStyle = '#ffb040'; c.fillText('▲', x + w - 10, y + 10); }
  }

  drawPlayerHud(c) {
    const p = this.p, x = 20, y = 272;
    c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x - 4, y - 4, 190, 48);
    c.fillStyle = '#fff'; c.font = '12px monospace'; c.fillText(`${game.state.flags.suit ? 'Root Knight' : 'Eduardo'} Nv${p.level}`, x, y + 10);
    c.fillStyle = '#3a1a1a'; c.fillRect(x, y + 16, 180, 8); c.fillStyle = '#4ad06a'; c.fillRect(x, y + 16, 180 * (p.hp / p.maxHp), 8);
    c.fillStyle = '#1a2a3a'; c.fillRect(x, y + 28, 180, 6); c.fillStyle = '#4aa0e0'; c.fillRect(x, y + 28, 180 * (p.energy / p.maxEnergy), 6);
    c.fillStyle = '#fff'; c.fillText(`${p.hp}/${p.maxHp}`, x + 130, y + 10);
    if (this.ps.blind > 0) { c.fillStyle = '#bbb'; c.fillText('Cegado', x + 80, y + 10); }
  }
}
