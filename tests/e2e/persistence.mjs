import { chromium } from 'playwright-core';
const URL = 'http://localhost:8123/index.html';
const log = (...a) => console.log(...a);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
// Un único contexto persistente simula "cerrar la pestaña y reabrir" (mismo perfil/almacenamiento).
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const errors = [];
const open = async () => { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && errors.push(m.text())); await p.goto(URL); await p.waitForTimeout(500); return p; };

let p = await open();
log('título: Continuar deshabilitado =', await p.locator('button:has-text("Continuar")').first().isDisabled());
await p.click('button:has-text("Nueva partida")');
await p.waitForTimeout(400);
await p.screenshot({ path: 'shot1.png' });
// cerrar el diálogo de intro
for (let i = 0; i < 4; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(100); }
// Provocar progreso real por las vías del juego
await p.evaluate(() => {
  const rk = window.rootKnight, s = rk.game.state;
  rk.world.pl.x = 300; rk.world.pl.y = 380;
});
await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await p.keyboard.up('KeyD');
const before = await p.evaluate(() => {
  const rk = window.rootKnight, s = rk.game.state;
  return { zone: s.zone, x: Math.round(s.pos.x), y: Math.round(s.pos.y), scene: rk.game.scene };
});
log('antes de guardar:', before);
// guardado manual vía menú de pausa
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.click('button:has-text("Guardar partida")'); await p.waitForTimeout(1200);
log('toast visible:', await p.locator('.toast:has-text("Partida guardada")').count());
// Progreso por eventos: cofre, nivel, misión → autoguardado
await p.evaluate(async () => {
  const m = await import('/src/core/state.js');
  m.addItem('tonico', 3); m.gainXp(100); m.setFlag('met_ximon'); m.startQuest('q_glifos'); m.openChest('tz_cofre', { hierba: 2 });
});
await p.waitForTimeout(800);
const saved1 = await p.evaluate(() => JSON.parse(localStorage.getItem('rootknight.save')));
log('autoguardado -> nivel', saved1.data.player.level, 'inv', JSON.stringify(saved1.data.inventory), 'cofres', saved1.data.chests, 'misiones', JSON.stringify(saved1.data.quests));
const expected = await p.evaluate(() => JSON.parse(JSON.stringify(window.rootKnight.game.state)));
await p.close(); // "cierra la pestaña"

p = await open(); // "reabre el juego"
const cont = p.locator('button:has-text("Continuar")').first();
log('tras reabrir: Continuar habilitado =', !(await cont.isDisabled()), '| texto:', (await cont.innerText()).replace(/\n/g, ' · '));
await p.screenshot({ path: 'shot2.png' });
await cont.click(); await p.waitForTimeout(600);
const after = await p.evaluate(() => JSON.parse(JSON.stringify(window.rootKnight.game.state)));
const same = (k) => JSON.stringify(after[k]) === JSON.stringify(saved1.data[k]);
for (const k of ['zone', 'chapter', 'flags', 'quests', 'player', 'skills', 'inventory', 'chests', 'secrets', 'defeated', 'savepoints', 'settings']) log(`  ${k}:`, same(k) ? 'OK' : `DIFF ${JSON.stringify(after[k])} vs ${JSON.stringify(saved1.data[k])}`);
log('  posición restaurada:', Math.round(after.pos.x), Math.round(after.pos.y), '(guardada', Math.round(saved1.data.pos.x), Math.round(saved1.data.pos.y) + ')');
await p.screenshot({ path: 'shot3.png' });

// Nueva partida con confirmación cuando existe una
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.click('button:has-text("Salir al título")'); await p.waitForTimeout(500);
await p.click('button:has-text("Nueva partida")'); await p.waitForTimeout(300);
log('confirmación de nueva partida visible:', await p.locator('.modal').count());
await p.click('.modal button:has-text("Cancelar")'); await p.waitForTimeout(200);
log('tras cancelar, el guardado sigue (nivel):', await p.evaluate(() => JSON.parse(localStorage.getItem('rootknight.save')).data.player.level));

// Corrupción real en el navegador
await p.evaluate(() => localStorage.setItem('rootknight.save', '{"version":2,"da'));
await p.reload(); await p.waitForTimeout(500);
log('guardado corrupto -> aviso:', await p.locator('.warn').count(), '| Continuar habilitado:', !(await p.locator('button:has-text("Continuar")').first().isDisabled()));
await p.screenshot({ path: 'shot4.png' });
log('errores de consola/página:', errors.length ? errors : 'ninguno');
await browser.close();
