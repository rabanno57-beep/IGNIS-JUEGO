// Utilidades de interfaz DOM: toasts, indicador de guardado, diálogos, confirmaciones y HUD.
import { game, xpForNext } from '../core/state.js';
import { QUESTS } from '../data/content.js';
import { questProgress } from '../core/state.js';
import { ZONES_DATA } from '../data/zones.js';
import { input } from '../core/input.js';
import { sfx } from '../core/audio.js';

export const $ = (sel) => document.querySelector(sel);

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
}

/* ── Toasts e indicador de guardado ── */
export function toast(msg, kind = 'info', ms = 2600) {
  const t = el('div', { class: `toast ${kind}`, role: 'status' }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

let savingSince = 0;
export function setSaving(on) {
  const s = $('#save-indicator');
  if (on) { savingSince = performance.now(); s.classList.add('on'); } else {
    // Mantén el icono visible un instante para que se note.
    const wait = Math.max(0, 700 - (performance.now() - savingSince));
    setTimeout(() => s.classList.remove('on'), wait);
  }
}

/* ── Pantallas superpuestas ── */
export function showScreen(node, cls = '') {
  const o = $('#overlay');
  o.replaceChildren(node);
  o.className = `show ${cls}`;
  const first = node.querySelector('button:not([disabled])');
  first?.focus();
}
export function hideScreen() {
  const o = $('#overlay');
  o.replaceChildren();
  o.className = '';
}
export const screenOpen = () => $('#overlay').classList.contains('show');

export function menuButton(label, onclick, { disabled = false, sub = '', cls = '' } = {}) {
  return el('button', { class: `btn ${cls}`, disabled, onclick: () => { sfx.select(); onclick(); } },
    el('span', {}, label), sub ? el('small', {}, sub) : null);
}

/** Cuadro de confirmación (Promise<boolean>). Se dibuja sobre cualquier pantalla. */
export function confirmBox(title, text, okLabel = 'Aceptar', cancelLabel = 'Cancelar') {
  return new Promise((res) => {
    const back = el('div', { class: 'modal-back', role: 'dialog', 'aria-modal': 'true' });
    const done = (v) => { back.remove(); res(v); };
    back.append(el('div', { class: 'modal panel' },
      el('h2', {}, title), el('p', {}, text),
      el('div', { class: 'row' },
        el('button', { class: 'btn danger', onclick: () => done(true) }, okLabel),
        el('button', { class: 'btn', onclick: () => done(false) }, cancelLabel))));
    document.body.append(back);
    back.querySelectorAll('button')[1].focus();
  });
}

/* ── Diálogo ── */
export function dialog(lines) {
  return new Promise((res) => {
    const prev = game.scene;
    game.scene = 'dialog';
    let i = 0;
    const who = el('div', { class: 'who' });
    const txt = el('div', { class: 'txt' });
    const box = el('div', { class: 'dialog panel', onclick: () => next() }, who, txt, el('div', { class: 'hint' }, '▼ Espacio / clic'));
    $('#dialog-layer').replaceChildren(box);
    const show = () => {
      const l = lines[i];
      who.textContent = l.who ?? '';
      who.style.display = l.who ? '' : 'none';
      txt.textContent = l.text;
      box.classList.toggle('thought', !!l.thought);
    };
    const finish = () => {
      removeEventListener('keydown', onKey);
      $('#dialog-layer').replaceChildren();
      game.scene = prev;
      res();
    };
    const next = () => { sfx.select(); (++i >= lines.length) ? finish() : show(); };
    const onKey = (e) => { if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); next(); } };
    addEventListener('keydown', onKey);
    show();
  });
}

/* ── HUD ── */
export function updateHud() {
  const { player: p } = game.state;
  const hud = $('#hud');
  if (game.scene === 'title' || $('#battle-layer').classList.contains('on')) { hud.classList.add('hidden'); return; }
  hud.classList.remove('hidden');
  const who = game.state.flags.suit ? 'Root Knight' : 'Eduardo';
  const bar = (v, m, cls) => `<div class="bar ${cls}"><i style="width:${Math.max(0, (v / m) * 100)}%"></i><span>${Math.ceil(v)}/${m}</span></div>`;
  const q = game.state.quests.active.map((id) => {
    const pr = questProgress(id);
    return `<li><b>${QUESTS[id].title}</b>${pr ? ` <em>${pr}</em>` : ''}</li>`;
  }).join('');
  hud.innerHTML = `
    <div class="hud-left panel">
      <div class="nm">${who} <small>Nv ${p.level}</small></div>
      ${bar(p.hp, p.maxHp, 'hp')}${bar(p.energy, p.maxEnergy, 'en')}
      <div class="xp" title="Experiencia"><i style="width:${(p.xp / xpForNext(p.level)) * 100}%"></i></div>
    </div>
    <div class="hud-right panel"><div class="zn">${ZONES_DATA[game.state.zone]?.name ?? ''}</div><ul>${q}</ul></div>`;
}

export function setHint(text) {
  const h = $('#hint');
  h.textContent = text ?? '';
  h.classList.toggle('on', !!text);
}

export function fadeTo(fn, ms = 300) {
  const f = $('#fade');
  f.style.transition = `opacity ${ms}ms`;
  f.style.opacity = '1';
  return new Promise((res) => setTimeout(async () => { await fn?.(); f.style.opacity = '0'; setTimeout(res, ms); }, ms));
}

export { input };
