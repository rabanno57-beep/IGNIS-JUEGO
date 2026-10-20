// Teclado con controles reasignables (state.settings.controls).
import { game } from './state.js';

const down = new Set();
const pressed = new Set();

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (!down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => down.clear());

const keys = (action) => {
  const c = game.state.settings.controls[action];
  const extra = {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    interact: ['Space', 'Enter'], pause: ['KeyP'],
  }[action] ?? [];
  return [c, ...extra];
};

export const input = {
  held: (action) => keys(action).some((k) => down.has(k)),
  hit: (action) => keys(action).some((k) => pressed.has(k)),
  endFrame() { pressed.clear(); },
  /** Para reasignar teclas: devuelve la próxima tecla pulsada. */
  nextKey() {
    return new Promise((res) => {
      const h = (e) => { e.preventDefault(); removeEventListener('keydown', h, true); res(e.code); };
      addEventListener('keydown', h, true);
    });
  },
};

export const ACTION_LABELS = {
  up: 'Arriba', down: 'Abajo', left: 'Izquierda', right: 'Derecha',
  interact: 'Interactuar', camo: 'Camuflaje', hook: 'Gancho', ambush: 'Emboscada', pause: 'Pausa',
};
export const keyName = (code) => code.replace('Key', '').replace('Arrow', '↔ ').replace('Escape', 'Esc');
