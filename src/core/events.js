// Bus de eventos mínimo. El guardado automático, las misiones y la UI se
// acoplan solo a través de él.
const handlers = new Map();

export const bus = {
  on(evt, fn) {
    if (!handlers.has(evt)) handlers.set(evt, new Set());
    handlers.get(evt).add(fn);
    return () => handlers.get(evt)?.delete(fn);
  },
  emit(evt, payload) {
    for (const fn of [...(handlers.get(evt) ?? [])]) {
      try { fn(payload); } catch (e) { console.error(`[bus] ${evt}`, e); }
    }
  },
};
