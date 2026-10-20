// Mundo explorable: movimiento, colisiones, interacción, patrullas y detección de mercenarios.
import { game, flag, hasSkill } from '../core/state.js';
import { input } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { ZONES_DATA, TS, SOLID_TILES } from '../data/zones.js';
import { MERC } from '../data/mercenaries.js';
import { drawPerson, drawChest, drawProp } from '../ui/sprites.js';
import { setHint, toast } from '../ui/ui.js';

export const VIEW_W = 640, VIEW_H = 480;
const SEARCH_TIME = 3, GIVE_UP_TIME = 2.5;

const hash = (x, y) => { let h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

export class World {
  /** cb: { onEncounter(enemies, opts), onInteract(kind, obj), onExit(exit), onMarck() } */
  constructor(canvas, cb) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.cb = cb;
    this.ctx.imageSmoothingEnabled = false;
    this.t = 0; this.pl = { x: 0, y: 0, face: 's', camo: false, moving: false };
    this.zone = null; this.mercs = []; this.cam = { x: 0, y: 0 }; this.lockUntil = 0; this.alertShown = false;
  }

  enter(zoneId, pos = null) {
    const z = ZONES_DATA[zoneId];
    this.zoneId = zoneId; this.zone = z;
    game.state.zone = zoneId;
    const [sx, sy] = z.spawn;
    this.pl.x = pos ? pos.x : sx * TS + TS / 2;
    this.pl.y = pos ? pos.y : sy * TS + TS - 4;
    this.pl.camo = false;
    this.bg = this.#renderTiles(z);
    this.mercs = z.mercs.filter((m) => !game.state.defeated.includes(m.id)).map((m) => this.#spawn(m));
    this.alertShown = false;
    this.lockUntil = this.t + 1; // un segundo de gracia al entrar
  }

  #spawn(m) {
    const d = MERC[m.cls];
    const hx = m.x * TS + TS / 2, hy = m.y * TS + TS - 4;
    return { ...m, def: d, x: hx, y: hy, hx, hy, ang: m.face === 'w' ? Math.PI : m.face === 'n' ? -Math.PI / 2 : 0,
      state: m.route ? 'patrol' : 'guard', wp: 0, timer: 0, grace: 0, last: null, sweep: Math.random() * 6 };
  }

  removeMerc(id) { this.mercs = this.mercs.filter((m) => m.id !== id); }

  /* ── Colisiones ── */
  propSolid(p) { return p.solid !== false && !(p.blockedUntil && flag(p.blockedUntil)); }
  solidAt(px, py) {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    const t = this.zone.tiles[ty]?.[tx];
    if (t === undefined || SOLID_TILES.has(t)) return true;
    for (const p of this.zone.props) if (this.propSolid(p) && tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h) return true;
    for (const n of this.zone.npcs) if (Math.abs(px - (n.x * TS + 16)) < 10 && Math.abs(py - (n.y * TS + 28)) < 8) return true;
    return false;
  }
  blocked(x, y, r = 7) {
    return this.solidAt(x - r, y) || this.solidAt(x + r, y) || this.solidAt(x - r, y - 8) || this.solidAt(x + r, y - 8);
  }
  los(ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 12);
    for (let i = 1; i < n; i++) {
      const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n;
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      if (this.zone.tiles[ty]?.[tx] === 1 || this.zone.tiles[ty]?.[tx] === 6) return false;
      for (const p of this.zone.props) {
        if ((p.type === 'tent' || p.type === 'machine' || p.type === 'house' || p.type === 'door') && this.propSolid(p) &&
          tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h) return false;
      }
    }
    return true;
  }
  #move(o, dx, dy, r = 7) {
    if (!this.blocked(o.x + dx, o.y, r)) o.x += dx;
    if (!this.blocked(o.x, o.y + dy, r)) o.y += dy;
  }
  tileUnder(x, y) { return this.zone.tiles[Math.floor((y - 2) / TS)]?.[Math.floor(x / TS)]; }

  /* ── Actualización ── */
  update(dt) {
    this.t += dt;
    const pl = this.pl, s = game.state;
    if (this.travel) { this.updateTravel(); s.pos.x = pl.x; s.pos.y = pl.y; return; }
    let dx = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    let dy = (input.held('down') ? 1 : 0) - (input.held('up') ? 1 : 0);
    pl.moving = dx !== 0 || dy !== 0;
    if (input.hit('camo') && hasSkill('camouflage')) { pl.camo = !pl.camo; sfx.leaf(); toast(pl.camo ? 'Camuflaje activado' : 'Camuflaje desactivado', 'info', 1200); }
    if (pl.moving) {
      const len = Math.hypot(dx, dy); const sp = (pl.camo ? 58 : 105) * dt;
      this.#move(pl, (dx / len) * sp, (dy / len) * sp);
      pl.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
    }
    s.pos.x = pl.x; s.pos.y = pl.y;
    s.playtime += dt;

    this.#updateMercs(dt);
    this.#interactions();
    this.cam.x = Math.max(0, Math.min(this.zone.w * TS - VIEW_W, pl.x - VIEW_W / 2));
    this.cam.y = Math.max(0, Math.min(this.zone.h * TS - VIEW_H, pl.y - VIEW_H / 2 - 20));
    if (this.zone.w * TS < VIEW_W) this.cam.x = -(VIEW_W - this.zone.w * TS) / 2;
    if (this.zone.h * TS < VIEW_H) this.cam.y = -(VIEW_H - this.zone.h * TS) / 2;
  }

  detectRange(m) {
    const pl = this.pl; let r = m.def.vision;
    if (pl.camo) r *= 0.35;
    if (this.tileUnder(pl.x, pl.y) === 4) r *= pl.camo ? 0.5 : 0.75;
    if (!pl.moving) r *= 0.8;
    return r;
  }

  #updateMercs(dt) {
    const pl = this.pl;
    for (const m of this.mercs) {
      if (m.grace > 0) m.grace -= dt;
      const dist = Math.hypot(pl.x - m.x, pl.y - m.y);
      const seen = this.#canSee(m, dist);
      if (m.state !== 'chase' && m.grace <= 0 && this.t > this.lockUntil && seen) this.#alert(m);
      switch (m.state) {
        case 'patrol': this.#patrol(m, dt); break;
        case 'guard': m.sweep += dt; m.ang = (m.face === 'w' ? Math.PI : m.face === 'n' ? -Math.PI / 2 : 0) + Math.sin(m.sweep * 0.7) * 0.6; break;
        case 'chase': this.#chase(m, dt, dist, seen); break;
        case 'search': {
          if (m.last && Math.hypot(m.last.x - m.x, m.last.y - m.y) > 8) this.#step(m, m.last.x, m.last.y, m.def.speed * 0.6, dt);
          m.timer -= dt; if (m.timer <= 0) m.state = 'return';
          break;
        }
        case 'return': {
          const tx = m.route ? m.route[m.wp][0] * TS + 16 : m.hx, ty = m.route ? m.route[m.wp][1] * TS + TS - 4 : m.hy;
          if (Math.hypot(tx - m.x, ty - m.y) < 6) m.state = m.route ? 'patrol' : 'guard'; else this.#step(m, tx, ty, 50, dt);
          break;
        }
      }
    }
  }

  #canSee(m, dist) {
    if (dist > this.detectRange(m) && !(dist < 28 && !this.pl.camo)) return false;
    if (!this.los(m.x, m.y - 14, this.pl.x, this.pl.y - 14)) return false;
    if (dist < 28) return true;
    let diff = Math.atan2(this.pl.y - m.y, this.pl.x - m.x) - m.ang;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.abs(diff) < 1.05 || m.state === 'chase'; // cono de ~120°
  }

  #alert(m) {
    m.state = 'chase'; m.timer = 0;
    sfx.alert();
    if (!this.alertShown) { toast('¡Te vieron! Esconde el traje o pelea.', 'warn'); this.alertShown = true; }
    if (m.def.alerts) { // los exploradores avisan a sus compañeros cercanos
      for (const o of this.mercs) if (o !== m && o.state !== 'chase' && Math.hypot(o.x - m.x, o.y - m.y) < 280) { o.state = 'chase'; o.timer = 0; }
      toast('¡Un explorador dio la alarma!', 'warn');
    }
  }

  #step(m, tx, ty, speed, dt) {
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
    m.ang = Math.atan2(dy, dx);
    const sx = (dx / d) * speed * dt, sy = (dy / d) * speed * dt;
    const bx = m.x, by = m.y;
    this.#move(m, sx, sy, 6);
    if (m.x === bx && m.y === by) { this.#move(m, Math.sign(dx) * speed * dt, 0, 6); this.#move(m, 0, Math.sign(dy) * speed * dt, 6); }
  }

  #patrol(m, dt) {
    const [wx, wy] = m.route[m.wp], tx = wx * TS + 16, ty = wy * TS + TS - 4;
    if (Math.hypot(tx - m.x, ty - m.y) < 5) m.wp = (m.wp + 1) % m.route.length;
    else this.#step(m, tx, ty, 45, dt);
  }

  #chase(m, dt, dist, seen) {
    const pl = this.pl;
    if (seen) { m.last = { x: pl.x, y: pl.y }; m.timer = GIVE_UP_TIME; } else m.timer -= dt;
    if (m.timer <= 0) { m.state = 'search'; m.timer = SEARCH_TIME; return; }
    const ranged = m.def.ranged;
    if (dist < 22 || (ranged && dist < 150 && seen)) { this.#engage(m, { rangedOpen: ranged && dist >= 22 }); return; }
    this.#step(m, m.last?.x ?? pl.x, m.last?.y ?? pl.y, m.def.speed, dt);
  }

  /* ── Encuentros ── */
  #group(trigger) {
    const list = [trigger];
    const radius = trigger.def.boss ? 300 : 190;
    for (const o of this.mercs) {
      if (o === trigger || list.length >= (trigger.def.boss ? 4 : 3)) continue;
      const near = Math.hypot(o.x - trigger.x, o.y - trigger.y) < radius;
      if (near && (o.state === 'chase' || o.state === 'guard' && Math.hypot(o.x - this.pl.x, o.y - this.pl.y) < 220 || trigger.def.boss)) list.push(o);
    }
    return list;
  }

  #engage(m, opts = {}) {
    const group = this.#group(m);
    this.cb.onEncounter(group.map((g) => ({ id: g.id, cls: g.cls, lvl: g.lvl, name: g.name, boss: g.boss })), { ...opts, trigger: m.id });
  }

  /** Tras un combate: vence → quita; huye → los mercenarios vuelven a su puesto con un margen de gracia. */
  afterBattle(result, groupIds) {
    if (result === 'win') groupIds.forEach((id) => this.removeMerc(id));
    else if (result === 'flee') {
      for (const m of this.mercs) { m.x = m.hx; m.y = m.hy; m.state = m.route ? 'patrol' : 'guard'; m.grace = 4; }
      this.lockUntil = this.t + 1;
    }
  }

  #nearestMerc(maxD, filter) {
    let best = null, bd = maxD;
    for (const m of this.mercs) {
      const d = Math.hypot(m.x - this.pl.x, m.y - this.pl.y);
      if (d < bd && filter(m)) { best = m; bd = d; }
    }
    return best;
  }

  /* ── Interacciones ── */
  #interactions() {
    const pl = this.pl, z = this.zone, s = game.state;
    const near = (e, r = 38) => Math.hypot(pl.x - (e.x * TS + 16), pl.y - (e.y * TS + 24)) < r;
    let hint = null, action = null;

    for (const n of z.npcs) if (near(n, 46)) { hint = `E: Hablar con ${n.name}`; action = () => this.cb.onInteract('npc', n); }
    for (const c of z.chests) if (!s.chests.includes(c.id) && near(c)) { hint = 'E: Abrir cofre'; action = () => this.cb.onInteract('chest', c); }
    for (const sc of z.secrets) if (!s.secrets.includes(sc.id) && near(sc, 34)) { hint = `E: ${sc.label}`; action = () => this.cb.onInteract('secret', sc); }
    for (const sp of z.savepoints) if (near(sp, 44)) { hint = 'E: Punto de guardado'; action = () => this.cb.onInteract('savepoint', sp); }
    for (const it of z.interact) if (near(it, 44)) { hint = `E: ${it.label}`; action = () => this.cb.onInteract('interact', it); }

    // Gancho: viaje entre puntos de anclaje, o atraer a un mercenario desprevenido
    let hookAct = null;
    if (hasSkill('hook')) {
      const a = z.hooks.find((h) => near(h, 60));
      const target = this.#nearestMerc(170, (m) => m.state !== 'chase' && this.los(pl.x, pl.y - 14, m.x, m.y - 14));
      if (a) { hint ??= `Q: ${a.label}`; hookAct = () => this.#hookTravel(a); }
      else if (target) { hint ??= 'Q: Gancho — atraer al mercenario  ·  F: Emboscada cuerpo a cuerpo'; hookAct = () => this.#engage(target, { ambush: true, hooked: true }); }
    }
    const amb = this.#nearestMerc(50, (m) => m.state !== 'chase');
    if (amb && !hint?.includes('F:')) hint = (hint ? hint + '  ·  ' : '') + 'F: Emboscada';

    if (this.t > this.lockUntil) {
      if (input.hit('interact') && action) action();
      else if (input.hit('hook') && hookAct) hookAct();
      else if (input.hit('ambush') && amb) this.#engage(amb, { ambush: true });
    }
    setHint(hint);

    for (const ex of z.exits) {
      const inside = pl.x >= ex.x * TS && pl.x < (ex.x + ex.w) * TS && pl.y >= ex.y * TS && pl.y < (ex.y + ex.h) * TS + 8;
      if (inside) {
        if (ex.needFlag && !flag(ex.needFlag)) { if (this.t > (this._exitMsg ?? 0)) { toast(ex.msg, 'warn'); this._exitMsg = this.t + 3; } } else this.cb.onExit(ex);
      }
    }
    if (z.marck && !flag('marck_defeated') && Math.hypot(pl.x - (z.marck.x * TS + 16), pl.y - (z.marck.y * TS + 24)) < 110) this.cb.onMarck();
  }

  #hookTravel(a) {
    sfx.leaf();
    const pl = this.pl, tx = a.tx * TS + 16, ty = a.ty * TS + TS - 4;
    this.lockUntil = this.t + 0.6;
    const sx = pl.x, sy = pl.y, t0 = this.t;
    this.travel = { sx, sy, tx, ty, t0, dur: 0.5 };
  }

  updateTravel() {
    if (!this.travel) return;
    const tr = this.travel, k = Math.min(1, (this.t - tr.t0) / tr.dur);
    this.pl.x = tr.sx + (tr.tx - tr.sx) * k; this.pl.y = tr.sy + (tr.ty - tr.sy) * k - Math.sin(k * Math.PI) * 24;
    if (k >= 1) { this.pl.y = tr.ty; this.travel = null; }
  }

  /* ── Dibujo ── */
  #renderTiles(z) {
    const cv = document.createElement('canvas'); cv.width = z.w * TS; cv.height = z.h * TS;
    const c = cv.getContext('2d');
    const pal = z.mood === 'temple'
      ? { 0: '#2a2a33', 3: '#3a3a44', 5: '#4a4a55', 6: '#1b1b22', 7: '#3a3a44' }
      : { 0: '#3e7a3a', 3: '#a8895a', 5: '#8a8f99', 7: '#8c6d46', 6: '#555a63' };
    for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
      const t = z.tiles[y][x], X = x * TS, Y = y * TS, h = hash(x, y);
      const base = t === 1 || t === 4 ? pal[0] : t === 2 ? '#2f6fb0' : t === 8 ? '#1a1208' : pal[t] ?? pal[0];
      c.fillStyle = base; c.fillRect(X, Y, TS, TS);
      if (t === 0 || t === 1 || t === 4) { c.fillStyle = z.mood === 'temple' ? '#33333d' : '#468a42'; for (let i = 0; i < 4; i++) c.fillRect(X + ((h * 97 * (i + 1)) % 28), Y + ((h * 53 * (i + 2)) % 28), 3, 3); }
      if (t === 3 || t === 7) { c.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 3; i++) c.fillRect(X + ((h * 91 * (i + 1)) % 28), Y + ((h * 47 * (i + 2)) % 28), 4, 3); }
      if (t === 5) { c.strokeStyle = 'rgba(0,0,0,.25)'; c.strokeRect(X + 0.5, Y + 0.5, TS - 1, TS - 1); }
      if (t === 6) { c.fillStyle = '#2b2b33'; c.fillRect(X, Y + TS - 6, TS, 6); c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(X, Y, TS, 3); }
      if (t === 2) { c.fillStyle = '#5aa0e0'; c.fillRect(X + 4 + h * 10, Y + 8, 10, 2); c.fillRect(X + 16, Y + 20 + h * 4, 9, 2); }
      if (t === 8) { c.fillStyle = '#2a1c0e'; c.fillRect(X + 3, Y + 3, TS - 6, TS - 6); }
      if (t === 1) { // árbol
        c.fillStyle = '#4a3320'; c.fillRect(X + 12, Y + 14, 8, 18);
        c.fillStyle = '#245c2a'; c.fillRect(X + 1, Y - 6, 30, 26); c.fillStyle = '#2f7a35'; c.fillRect(X + 5, Y - 10, 22, 14); c.fillStyle = '#3c8f42'; c.fillRect(X + 9, Y - 8, 8, 6);
      }
      if (t === 4) { c.fillStyle = '#2c6a30'; c.fillRect(X + 3, Y + 8, 26, 20); c.fillStyle = '#3d8a42'; c.fillRect(X + 6, Y + 4, 20, 14); c.fillStyle = '#9b4a6a'; c.fillRect(X + 10, Y + 10, 3, 3); c.fillRect(X + 20, Y + 14, 3, 3); }
    }
    return cv;
  }

  draw() {
    const c = this.ctx, z = this.zone, cam = this.cam, t = this.t * 1000;
    c.fillStyle = '#0b130d'; c.fillRect(0, 0, VIEW_W, VIEW_H);
    c.save(); c.translate(-Math.round(cam.x), -Math.round(cam.y));
    c.drawImage(this.bg, 0, 0);
    for (const p of z.props) if (!(p.blockedUntil && flag(p.blockedUntil))) drawProp(c, p, t);
    for (const sp of z.savepoints) {
      const on = game.state.savepoints.includes(sp.id), X = sp.x * TS, Y = sp.y * TS;
      c.fillStyle = '#4a4f59'; c.fillRect(X + 8, Y + 8, 16, 22);
      c.fillStyle = on ? '#7dff9a' : '#3f8f55'; c.globalAlpha = 0.7 + Math.sin(t / 250) * 0.3; c.fillRect(X + 12, Y + 2 + Math.sin(t / 300) * 2, 8, 12); c.globalAlpha = 1;
    }
    for (const ch of z.chests) drawChest(c, ch.x * TS, ch.y * TS, game.state.chests.includes(ch.id));
    for (const a of z.hooks) { c.fillStyle = '#c8e8c8'; c.fillRect(a.x * TS + 12, a.y * TS + 4, 8, 8); c.fillStyle = '#2f6b3a'; c.fillRect(a.x * TS + 14, a.y * TS + 12, 4, 16); }
    for (const sc of z.secrets) if (!game.state.secrets.includes(sc.id) && Math.hypot(this.pl.x - sc.x * TS - 16, this.pl.y - sc.y * TS - 16) < 130) {
      c.fillStyle = '#fff6a0'; c.globalAlpha = 0.5 + Math.sin(t / 150) * 0.5; c.fillRect(sc.x * TS + 14, sc.y * TS + 10 + Math.sin(t / 400) * 3, 4, 4); c.globalAlpha = 1;
    }
    if (z.interact) for (const it of z.interact) { c.fillStyle = '#ffe9a0'; c.globalAlpha = 0.5 + Math.sin(t / 300) * 0.4; c.fillRect(it.x * TS + 12, it.y * TS + 6, 8, 8); c.globalAlpha = 1; }

    const ents = [];
    for (const n of z.npcs) ents.push({ y: n.y * TS + 28, f: () => drawPerson(c, n.x * TS + 16, n.y * TS + 28, 2, n.id === 'ximon' ? 'ximon' : 'aldeano') });
    for (const m of this.mercs) ents.push({ y: m.y, f: () => this.#drawMerc(c, m, t) });
    if (z.marck && !flag('marck_defeated')) ents.push({ y: z.marck.y * TS + 28, f: () => drawPerson(c, z.marck.x * TS + 16, z.marck.y * TS + 28, 2, 'marck', { aura: true }) });
    ents.push({ y: this.pl.y, f: () => drawPerson(c, this.pl.x, this.pl.y, 2, flag('suit') ? 'rootknight' : 'eduardo', { camo: this.pl.camo, alpha: this.pl.camo ? 0.6 : 1, face: this.pl.face === 'w' ? 'w' : 'e' }) });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.f());
    c.restore();

    if (z.mood === 'temple') this.#vignette(c, 0.88, 150);
    else if (z.mood === 'forest') { c.fillStyle = 'rgba(10,30,15,.10)'; c.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.pl.camo) { c.strokeStyle = 'rgba(120,230,120,.35)'; c.lineWidth = 6; c.strokeRect(3, 3, VIEW_W - 6, VIEW_H - 6); }
  }

  #vignette(c, a, r) {
    const px = this.pl.x - this.cam.x, py = this.pl.y - this.cam.y - 14;
    const g = c.createRadialGradient(px, py, r * 0.4, px, py, r * 1.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,10,${a})`);
    c.fillStyle = g; c.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  #drawMerc(c, m, t) {
    const face = Math.cos(m.ang) < 0 ? 'w' : 'e';
    drawPerson(c, m.x, m.y, m.def.boss ? 2 : 2, m.cls, { face });
    if (m.state === 'chase') { c.fillStyle = '#ff4040'; c.font = 'bold 18px monospace'; c.fillText('!', m.x - 3, m.y - 62 + Math.sin(t / 80) * 2); }
    else if (m.state === 'search') { c.fillStyle = '#ffd040'; c.font = 'bold 18px monospace'; c.fillText('?', m.x - 4, m.y - 62); }
    if (m.state !== 'chase' && m.grace <= 0 && Math.hypot(m.x - this.pl.x, m.y - this.pl.y) < 340) { // cono de visión tenue
      const r = this.detectRange(m);
      c.fillStyle = 'rgba(255,230,120,.07)'; c.beginPath(); c.moveTo(m.x, m.y - 14);
      c.arc(m.x, m.y - 14, r, m.ang - 1.05, m.ang + 1.05); c.closePath(); c.fill();
    }
  }
}
