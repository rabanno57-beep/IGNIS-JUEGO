// Efectos de sonido sintetizados (WebAudio). Respeta state.settings.volume / muted.
import { game } from './state.js';

let ctx = null;
const getCtx = () => {
  if (!ctx) { try { ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)(); } catch { ctx = false; } }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

function tone(freq, dur, { type = 'square', vol = 0.15, slide = 0, delay = 0 } = {}) {
  const c = getCtx();
  const s = game.state.settings;
  if (!c || s.muted || s.volume <= 0) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
  g.gain.setValueAtTime(vol * s.volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur);
}

export const sfx = {
  hit: () => tone(180, 0.12, { type: 'sawtooth', slide: -80 }),
  shot: () => { tone(900, 0.08, { type: 'square', slide: -700, vol: 0.2 }); },
  block: () => tone(300, 0.08, { type: 'triangle' }),
  select: () => tone(520, 0.05),
  save: () => { tone(660, 0.1, { type: 'triangle' }); tone(880, 0.15, { type: 'triangle', delay: 0.1 }); },
  item: () => { tone(500, 0.08, { type: 'triangle' }); tone(750, 0.12, { type: 'triangle', delay: 0.08 }); },
  alert: () => { tone(700, 0.1); tone(500, 0.15, { delay: 0.1 }); },
  level: () => [440, 554, 659, 880].forEach((f, i) => tone(f, 0.15, { type: 'triangle', delay: i * 0.1 })),
  error: () => tone(120, 0.3, { type: 'sawtooth' }),
  water: () => tone(260, 0.3, { type: 'sine', slide: -120, vol: 0.25 }),
  leaf: () => tone(620, 0.1, { type: 'sine', slide: 200 }),
};
