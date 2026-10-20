import { chromium } from 'playwright-core';
const URL = 'http://localhost:8123/index.html';
const log = (...a) => console.log(...a);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
await ctx.addInitScript(() => { const o = window.setTimeout; window.setTimeout = (f, ms, ...a) => o(f, (ms ?? 0) / 8, ...a); }); // acelera las esperas del combate
const errors = [];
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
await p.goto(URL); await p.waitForTimeout(400);
await p.click('button:has-text("Nueva partida")'); await p.waitForTimeout(300);
for (let i = 0; i < 4; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(60); }

const prep = (lvl, hpFrac = 1) => p.evaluate(async ([lvl, hpFrac]) => {
  const st = await import('/src/core/state.js');
  const rk = window.rootKnight; const pl = rk.game.state.player;
  st.setFlag('suit'); st.checkSkillUnlocks();
  while (pl.level < lvl) st.gainXp(st.xpForNext(pl.level));
  st.addItem('tonico', 3); st.addItem('savia', 3);
  pl.hp = Math.ceil(pl.maxHp * hpFrac); pl.energy = pl.maxEnergy;
  rk.game.scene = 'world';
  document.querySelector('#overlay').className = '';
}, [lvl, hpFrac]);

async function fight(label, descs, { lvl = 3, strat = 'smart', hp = 1, marck = false, loseThenRetry = false } = {}) {
  await p.evaluate(() => window.rootKnight.abortBattle());
  await prep(lvl, hp);
  await p.evaluate(([descs, marck]) => { const rk = window.rootKnight; marck ? rk.world.cb.onMarck() : rk.world.cb.onEncounter(descs, {}); }, [descs, marck]);
  let rounds = 0, result = '?', lost = false, retried = false;
  for (let guard = 0; guard < 600; guard++) {
    await p.waitForTimeout(40);
    if (await p.locator('#dialog-layer .dialog').count()) { await p.keyboard.press('Space'); continue; }
    const state = await p.evaluate(() => ({ b: !!window.rootKnight.battle, scene: window.rootKnight.game.scene }));
    if (!state.b && state.scene !== 'cutscene') { result = lost && !retried ? 'perdió y salió' : 'terminó'; break; }
    const texts = await p.locator('.b-menu button:not([disabled])').allInnerTexts();
    if (!texts.length) continue;
    const find = (re) => texts.findIndex((t) => re.test(t));
    const pick = async (i) => p.locator('.b-menu button:not([disabled])').nth(i).click();
    if (find(/Continuar/) >= 0) { await pick(find(/Continuar/)); result = 'victoria'; await p.waitForTimeout(200); if (marck) { /* diálogos finales */ for (let k = 0; k < 40; k++) { await p.keyboard.press('Space'); await p.waitForTimeout(40); } } break; }
    if (find(/Reintentar/) >= 0) { lost = true; if (loseThenRetry && !retried) { retried = true; await pick(find(/Reintentar/)); continue; } result = 'derrota (pantalla Game Over mostrada con 3 opciones)'; break; }
    const hpNow = await p.evaluate(() => window.rootKnight.game.state.player.hp / window.rootKnight.game.state.player.maxHp);
    rounds++;
    if (strat === 'passive') { const i = find(/Defender/); if (i >= 0) await pick(i); continue; }
    if (texts.some((t) => /Volver|Cancelar/.test(t)) && !texts.some((t) => /Golpear/.test(t))) { // submenú: objetivo o items
      const i = texts.findIndex((t) => /Tónico|Hierba|^\d+\. (?!Volver|Cancelar)/.test(t)); await pick(Math.max(0, i)); continue;
    }
    if (hpNow < 0.4 && find(/Objeto/) >= 0) { await pick(find(/Objeto/)); continue; }
    for (const re of [/Sauces/, /Troncos/, /Macuahuitl/, /Lianas/, /Gancho/, /Golpear/]) { const i = find(re); if (i >= 0) { await pick(i); break; } }
  }
  const hpEnd = await p.evaluate(() => window.rootKnight.game.state.player.hp);
  const tail = await p.evaluate(() => window.rootKnight.battle?.logs?.slice(-3).join(' | ') ?? '');
  if (/derrota/.test(result)) log('   últimas líneas:', tail);
  log(`${label.padEnd(24)} ${result.padEnd(48)} turnos≈${rounds} vida final=${hpEnd}`);
}

const M = (cls, extra = {}) => ({ id: null, cls, lvl: 1, ...extra });
log('— Cada clase de mercenario —');
for (const cls of ['raso', 'armado', 'defensa', 'explorador', 'veterano', 'elite']) await fight(cls, [M(cls)], { lvl: cls === 'elite' || cls === 'veterano' ? 5 : 3 });
for (const l of [4, 5, 5, 6]) await fight('comandante lvl'+l, [M('comandante', { id: 'e_comandante', boss: true, lvl: 1.2 }), M('armado', { lvl: 1.1 }), M('armado', { lvl: 1.1 })], { lvl: l });
log('— Derrota sin bloqueo —');
await fight('raso (pasivo, vida 1)', [M('veterano', { lvl: 2 })], { lvl: 1, strat: 'passive', hp: 0.05 });
await fight('derrota→reintentar', [M('veterano', { lvl: 2 })], { lvl: 1, strat: 'passive', hp: 0.05, loseThenRetry: true });
log('— Marck —');
await p.evaluate(async () => { const rk = window.rootKnight; rk.world.enter('templo', null); rk.game.state.zone = 'templo'; });
await fight('Marck', [], { lvl: 5, marck: true });
const f = await p.evaluate(() => ({ flags: window.rootKnight.game.state.flags, skills: window.rootKnight.game.state.skills, quests: window.rootKnight.game.state.quests }));
log('flags', JSON.stringify(f.flags)); log('skills', f.skills.join(',')); log('misiones', JSON.stringify(f.quests));
await p.screenshot({ path: 'shot_end.png' });
log('errores:', errors.length ? errors : 'ninguno');
await browser.close();
