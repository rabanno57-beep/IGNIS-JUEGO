import { chromium } from 'playwright-core';
const log = (...a) => console.log(...a);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const errors = [];
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(400);
await p.click('button:has-text("Nueva partida")'); await p.waitForTimeout(300);
const space = async (n = 6) => { for (let i = 0; i < n; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(60); } };
await space(4);
const rk = (fn, arg) => p.evaluate(fn, arg);
const scene = () => rk(() => window.rootKnight.game.scene);
const flagsOf = () => rk(() => JSON.stringify(window.rootKnight.game.state.flags));

// 1) Flujo real: Ximón → inscripción → transformación
await rk(() => { const w = window.rootKnight.world; w.pl.x = 10 * 32 + 16 + 30; w.pl.y = 10 * 32 + 28; });
await p.waitForTimeout(1300); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await space(6);
log('tras hablar con Ximón: flags', await flagsOf(), '| misiones', await rk(() => JSON.stringify(window.rootKnight.game.state.quests.active)));
await rk(() => { const w = window.rootKnight.world; w.pl.x = 23 * 32 + 16; w.pl.y = 14 * 32 + 28; });
await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(900); await space(12); await p.waitForTimeout(300);
log('tras la inscripción: zona', await rk(() => window.rootKnight.game.state.zone), '| suit', (await flagsOf()).includes('suit'), '| habilidades', await rk(() => window.rootKnight.game.state.skills.join(',')));
await p.screenshot({ path: 'w_bosque.png' });

// 2) Camuflaje reduce la detección: mismo punto, con y sin camuflaje
const detect = (camo) => rk(async (camo) => {
  const w = window.rootKnight.world; w.enter('bosque', null); const m = w.mercs.find((x) => x.id === 'b_raso1');
  w.pl.camo = camo; w.pl.x = m.x + 100; w.pl.y = m.y; m.ang = Math.PI; w.lockUntil = 0; w.t = 5;
  return { range: Math.round(w.detectRange(m)), canSee: w.pl.x - m.x < w.detectRange(m) };
}, camo);
log('detección sin camuflaje a 100px:', JSON.stringify(await detect(false)), '| con camuflaje:', JSON.stringify(await detect(true)));

// 3) Detección real → persecución → combate automático
await rk(() => { const w = window.rootKnight.world; w.enter('bosque', null); const m = w.mercs.find((x) => x.id === 'b_raso1'); w.pl.x = m.x + 90; w.pl.y = m.y; m.ang = 0; w.lockUntil = 0; window.rootKnight.game.scene = 'world'; });
let engaged = false; const states = new Set();
for (let i = 0; i < 80 && !engaged; i++) { await p.waitForTimeout(100); states.add(await rk(() => window.rootKnight.world.mercs.find((x) => x.id === 'b_raso1')?.state)); engaged = (await scene()) === 'battle'; }
log('estados del raso:', [...states].join('→'), '| combate iniciado:', engaged);
await p.waitForTimeout(500); await p.screenshot({ path: 'w_battle.png' });
await rk(() => window.rootKnight.abortBattle());

// 4) Explorador alerta a los compañeros
await rk(() => { const w = window.rootKnight.world; w.enter('bosque', null); const e = w.mercs.find((x) => x.id === 'b_explor1'); w.pl.x = e.x + 20; w.pl.y = e.y - 120; e.ang = -Math.PI / 2; w.lockUntil = 0; window.rootKnight.game.scene = 'world'; });
await p.waitForTimeout(400);
log('explorador dio la alarma → otros en persecución:', await rk(() => window.rootKnight.world.mercs.filter((m) => m.state === 'chase').map((m) => m.id).join(',')));
await rk(() => window.rootKnight.abortBattle());

// 5) Cofre, secreto, savepoint, barricada, derrotados persistentes
await rk(() => { const w = window.rootKnight.world; w.enter('bosque', null); w.mercs.length = 0; window.rootKnight.game.scene = 'world'; w.lockUntil = 0; w.pl.x = 9 * 32 + 16; w.pl.y = 23 * 32 + 30; });
await p.waitForTimeout(200); await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
log('cofre b_cofre2 abierto:', await rk(() => window.rootKnight.game.state.chests.includes('b_cofre2')));
await rk(() => { const w = window.rootKnight.world; w.pl.x = 15 * 32 + 16; w.pl.y = 20 * 32 + 30; window.rootKnight.game.state.player.hp = 5; });
await p.waitForTimeout(200); await p.keyboard.press('KeyE'); await p.waitForTimeout(500);
log('savepoint → vida', await rk(() => window.rootKnight.game.state.player.hp), '| activado', await rk(() => window.rootKnight.game.state.savepoints.join(',')), '| guardado en LS:', await rk(() => !!localStorage.getItem('rootknight.save')));
await rk(() => { const w = window.rootKnight.world; w.pl.x = 37 * 32; w.pl.y = 13 * 32 + 20; });
await p.waitForTimeout(300);
log('barricada bloquea salida (zona sigue bosque):', await rk(() => window.rootKnight.game.state.zone));
// misión tala: derrotar a los 4 clave → barricada desaparece y salida abre
await rk(async () => { const st = await import('/src/core/state.js'); st.startQuest('q_tala'); st.markDefeated(['b_raso1', 'b_armado1', 'b_defensa1', 'b_explor1']); });
await p.waitForTimeout(500);
log('q_tala: flags camp_cleared =', (await flagsOf()).includes('camp_cleared'), '| activa ahora:', await rk(() => window.rootKnight.game.state.quests.active.join(',')));
await rk(() => { const w = window.rootKnight.world; w.pl.x = 38 * 32 + 16; w.pl.y = 13 * 32 + 20; w.lockUntil = 0; });
for (let i=0;i<4;i++){ await p.keyboard.press('Space'); await p.waitForTimeout(300);}
log('salida abierta → zona', await rk(() => window.rootKnight.game.state.zone));
await rk(() => { const w = window.rootKnight.world; w.mercs.length; });
await p.screenshot({ path: 'w_exc.png' });
// los derrotados no reaparecen tras recargar
await p.reload(); await p.waitForTimeout(500); await p.click('button:has-text("Continuar")'); await p.waitForTimeout(500);
log('tras recargar: zona', await rk(() => window.rootKnight.game.state.zone), '| derrotados en estado', await rk(() => window.rootKnight.game.state.defeated.length), '| b_raso1 vivo en mapa:', await rk(() => window.rootKnight.world.mercs.some((m) => m.id === 'b_raso1')));
log('errores:', errors.length ? errors : 'ninguno');
await browser.close();
