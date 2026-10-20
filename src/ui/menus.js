// Pantallas: título, pausa, inventario, habilidades, misiones, mercenarios y opciones.
import { game, hasSkill, useConsumable, questProgress, xpForNext } from '../core/state.js';
import { ITEMS, SKILLS, QUESTS } from '../data/content.js';
import { MERC } from '../data/mercenaries.js';
import { ZONES_DATA } from '../data/zones.js';
import { DEFAULT_CONTROLS } from '../save/schema.js';
import { input, ACTION_LABELS, keyName } from '../core/input.js';
import { el, showScreen, menuButton, toast } from './ui.js';
import { sfx } from '../core/audio.js';

const fmtDate = (ts) => new Date(ts).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const fmtTime = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

export function titleScreen(info, cb) {
  // info: resultado de SaveManager.inspect()
  const ok = info.status === 'ok';
  const sub = ok
    ? `${ZONES_DATA[info.state.zone]?.name ?? info.state.zone} · Nv ${info.state.player.level} · ${fmtDate(info.savedAt)}`
    : '';
  let warn = null;
  if (info.status === 'corrupt') warn = 'La partida guardada está dañada y no se pudo recuperar. Se conservó una copia del dato dañado; puedes iniciar una partida nueva.';
  else if (info.status === 'future') warn = 'La partida pertenece a una versión más nueva del juego. No se modificará.';
  else if (info.status === 'unavailable') warn = 'El navegador no permite guardar (¿modo privado o almacenamiento bloqueado?). Podrás jugar, pero no se guardará el progreso.';
  else if (info.recovered) warn = 'La partida principal estaba dañada; se recuperó la copia de seguridad anterior.';

  showScreen(el('div', { class: 'title panel' },
    el('h1', {}, 'ROOT KNIGHT'), el('h2', {}, 'El secreto del bosque'),
    warn ? el('p', { class: 'warn', role: 'alert' }, warn) : null,
    el('div', { class: 'col' },
      menuButton('Nueva partida', cb.newGame),
      menuButton('Continuar', cb.continueGame, { disabled: !ok, sub: ok ? sub : 'No hay partida guardada' }),
      menuButton('Mercenarios de Marck', () => bestiary(() => titleScreen(info, cb)), {})),
    el('p', { class: 'fine' }, 'El progreso se guarda solo en este navegador (LocalStorage). Si borras los datos del sitio, se pierde. No hay sincronización en la nube.')), 'dim');
}

export function pauseMenu(cb) {
  const back = () => pauseMenu(cb);
  const s = game.state;
  showScreen(el('div', { class: 'pause panel' },
    el('h2', {}, 'Pausa'),
    el('p', { class: 'fine' }, `${ZONES_DATA[s.zone].name} · ${fmtTime(s.playtime)} de juego`),
    el('div', { class: 'col' },
      menuButton('Continuar', cb.resume),
      menuButton('Guardar partida', cb.save, { sub: 'Guarda en este navegador' }),
      menuButton('Inventario', () => inventory(back)),
      menuButton('Habilidades', () => skills(back)),
      menuButton('Misiones', () => quests(back)),
      menuButton('Mercenarios', () => bestiary(back)),
      menuButton('Opciones', () => options(back, cb)),
      menuButton('Salir al título', cb.toTitle))), 'dim');
}

function listScreen(title, back, ...content) {
  showScreen(el('div', { class: 'panel list' }, el('h2', {}, title), ...content, el('div', { class: 'row' }, menuButton('Volver', back))), 'dim');
}

export function inventory(back) {
  const inv = game.state.inventory, p = game.state.player;
  const keys = Object.keys(inv);
  listScreen('Inventario', back,
    el('p', { class: 'fine' }, `Vida ${p.hp}/${p.maxHp} · Savia ${p.energy}/${p.maxEnergy} · Ataque ${p.atk} · Defensa ${p.def} · XP ${p.xp}/${xpForNext(p.level)}`),
    keys.length ? el('ul', { class: 'items' }, keys.map((k) => el('li', {},
      el('div', {}, el('b', {}, `${ITEMS[k]?.name ?? k} ×${inv[k]}`), el('small', {}, ITEMS[k]?.desc ?? '')),
      ITEMS[k]?.type === 'consumible' ? menuButton('Usar', () => {
        const r = useConsumable(k);
        if (r) { sfx.item(); toast(`${ITEMS[k].name}: ${r}`, 'good'); } else toast('No hace falta ahora.', 'info');
        inventory(back);
      }, { cls: 'small' }) : null))) : el('p', {}, 'Vacío.'));
}

export function skills(back) {
  listScreen('Habilidades', back, el('ul', { class: 'items' }, Object.entries(SKILLS).filter(([id]) => hasSkill(id) || ['roots', 'vines'].includes(id)).map(([id, s]) =>
    el('li', { class: hasSkill(id) ? '' : 'locked' }, el('div', {}, el('b', {}, `${s.name}${s.cost ? ` (${s.cost} savia)` : ''}`),
      el('small', {}, hasSkill(id) ? s.desc : `Se desbloquea al nivel ${s.unlockLevel}.`))))));
}

export function quests(back) {
  const q = game.state.quests;
  listScreen('Misiones', back,
    el('h3', {}, 'Activas'),
    q.active.length ? el('ul', { class: 'items' }, q.active.map((id) => el('li', {}, el('div', {}, el('b', {}, `${QUESTS[id].title} ${questProgress(id)}`), el('small', {}, QUESTS[id].desc))))) : el('p', {}, 'Ninguna.'),
    el('h3', {}, 'Completadas'),
    q.done.length ? el('ul', { class: 'items done' }, q.done.map((id) => el('li', {}, el('div', {}, el('b', {}, `✔ ${QUESTS[id].title}`))))) : el('p', {}, 'Ninguna todavía.'));
}

export function bestiary(back) {
  listScreen('Mercenarios de Marck', back,
    el('p', { class: 'fine' }, 'Los trabajadores armados que protegen la búsqueda del artefacto. Marck es otro asunto.'),
    el('ul', { class: 'items' }, Object.values(MERC).map((m) => el('li', {}, el('div', {}, el('b', {}, m.name), el('small', {}, m.desc), el('small', { class: 'tip' }, `Estrategia: ${m.strategy}`))))));
}

export function options(back, cb) {
  const s = game.state.settings;
  const vol = el('input', { type: 'range', min: 0, max: 100, value: Math.round(s.volume * 100), 'aria-label': 'Volumen', oninput: (e) => { s.volume = e.target.value / 100; } });
  vol.addEventListener('change', () => { sfx.select(); cb.settingsChanged?.(); });
  const mute = el('input', { type: 'checkbox', onchange: (e) => { s.muted = e.target.checked; cb.settingsChanged?.(); } });
  mute.checked = s.muted;
  const rows = Object.keys(DEFAULT_CONTROLS).map((a) => {
    const b = el('button', { class: 'btn small key', onclick: async () => {
      b.textContent = 'Pulsa una tecla…';
      const code = await input.nextKey();
      if (code !== 'Escape') {
        const clash = Object.entries(s.controls).find(([k, v]) => v === code && k !== a);
        if (clash) s.controls[clash[0]] = s.controls[a]; // intercambia en vez de dejar dos acciones en la misma tecla
        s.controls[a] = code;
      }
      cb.settingsChanged?.(); options(back, cb);
    } }, keyName(s.controls[a]));
    return el('div', { class: 'ctl' }, el('span', {}, ACTION_LABELS[a]), b);
  });
  listScreen('Opciones', back,
    el('label', { class: 'ctl' }, el('span', {}, 'Volumen'), vol),
    el('label', { class: 'ctl' }, el('span', {}, 'Silenciar'), mute),
    el('h3', {}, 'Controles'), ...rows,
    el('div', { class: 'row' }, menuButton('Restablecer controles', () => { s.controls = { ...DEFAULT_CONTROLS }; cb.settingsChanged?.(); options(back, cb); })),
    el('p', { class: 'fine' }, 'Las opciones se guardan con la partida.'));
}

export function gameOverlay(title, text, buttons) {
  showScreen(el('div', { class: 'panel end' }, el('h1', {}, title), el('p', {}, text), el('div', { class: 'col' }, buttons.map(([l, f]) => menuButton(l, f)))), 'dim');
}
