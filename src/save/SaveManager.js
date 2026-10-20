// Guardado con protecciones: envoltorio versionado + checksum, copia de seguridad,
// escritura verificada, rechazo de estados vacíos y conservación de datos corruptos.
import { SAVE_VERSION, normalize, isPristine, checksum } from './schema.js';
import { migrate } from './migrations.js';

export const KEYS = {
  main: 'rootknight.save',
  bak: 'rootknight.save.bak',
  tmp: 'rootknight.save.tmp',
  corrupt: 'rootknight.save.corrupt',
};

export class SaveManager {
  /** emit(evt, payload) es opcional: 'save:start' | 'save:done' | 'save:error'. */
  constructor(adapter, { zones, emit } = {}) {
    this.adapter = adapter;
    this.zones = zones;
    this.emit = emit ?? (() => {});
  }

  /** Interpreta un texto crudo. Nunca lanza. */
  parse(raw) {
    if (raw == null) return { status: 'none' };
    let env;
    try { env = JSON.parse(raw); } catch { return { status: 'corrupt', reason: 'JSON ilegible' }; }
    if (!env || typeof env !== 'object' || !Number.isInteger(env.version) || env.data === undefined) {
      return { status: 'corrupt', reason: 'envoltorio inválido' };
    }
    if (env.version > SAVE_VERSION) return { status: 'future', version: env.version };
    if (env.version < 1) return { status: 'corrupt', reason: 'versión inválida' };
    if (env.checksum !== checksum(JSON.stringify(env.data))) {
      return { status: 'corrupt', reason: 'el checksum no coincide' };
    }
    let data = env.data;
    try { data = migrate(data, env.version, SAVE_VERSION); } catch (e) {
      return { status: 'corrupt', reason: `migración fallida: ${e.message}` };
    }
    const res = normalize(data, { zones: this.zones });
    if (!res.ok) return { status: 'corrupt', reason: res.error };
    return { status: 'ok', state: res.state, savedAt: env.savedAt, version: env.version, migrated: env.version !== SAVE_VERSION };
  }

  safeRead(key) {
    try { return { raw: this.adapter.read(key) }; } catch (e) { return { raw: null, error: e }; }
  }

  /**
   * Estado de la partida guardada.
   * { status: 'none'|'ok'|'corrupt'|'future'|'unavailable', state?, savedAt?, recovered?, reason? }
   */
  inspect() {
    const main = this.safeRead(KEYS.main);
    if (main.error) return { status: 'unavailable', reason: String(main.error.message ?? main.error) };
    const a = this.parse(main.raw);
    if (a.status === 'ok' || a.status === 'future') return a;
    const bak = this.parse(this.safeRead(KEYS.bak).raw);
    if (a.status === 'corrupt') {
      this.quarantine(main.raw);
      if (bak.status === 'ok') return { ...bak, recovered: true, reason: a.reason };
      return a;
    }
    // main ausente: la copia solo se usa si el principal estaba dañado, no si no existe.
    return a;
  }

  hasValidSave() { return this.inspect().status === 'ok'; }

  /** Conserva el texto dañado para poder recuperarlo manualmente; nunca lo borra. */
  quarantine(raw) {
    try { if (raw != null && this.safeRead(KEYS.corrupt).raw == null) this.adapter.write(KEYS.corrupt, raw); } catch { /* sin espacio */ }
  }

  load() {
    const r = this.inspect();
    if (r.status !== 'ok') return { ok: false, ...r };
    return { ok: true, state: r.state, savedAt: r.savedAt, recovered: !!r.recovered, migrated: !!r.migrated };
  }

  /**
   * Guarda. opts.allowReset permite sobrescribir con un estado sin progreso (solo "Nueva partida").
   * @returns {{ok:true, savedAt:number}|{ok:false, error:string}}
   */
  save(state, reason = 'manual', opts = {}) {
    const result = this.#save(state, reason, opts);
    if (result.ok) this.emit('save:done', { reason, savedAt: result.savedAt });
    else this.emit('save:error', { reason, error: result.error });
    return result;
  }

  #save(state, reason, { allowReset = false } = {}) {
    this.emit('save:start', { reason });
    const check = normalize(state, { zones: this.zones });
    if (!check.ok) return { ok: false, error: `estado inválido (${check.error}); no se guardó` };

    const cur = this.safeRead(KEYS.main);
    if (cur.error) return { ok: false, error: 'almacenamiento no disponible' };
    const existing = this.parse(cur.raw);
    if (existing.status === 'future') return { ok: false, error: 'hay una partida de una versión más nueva; no se sobrescribe' };
    if (!allowReset && existing.status === 'ok' && isPristine(check.state) && !isPristine(existing.state)) {
      return { ok: false, error: 'se rechazó sobrescribir una partida con progreso por un estado vacío' };
    }

    const savedAt = Date.now();
    const data = check.state;
    const json = JSON.stringify(data);
    const text = JSON.stringify({ version: SAVE_VERSION, savedAt, checksum: checksum(json), data });
    try {
      if (existing.status === 'ok') this.adapter.write(KEYS.bak, cur.raw);
      else if (existing.status === 'corrupt') this.quarantine(cur.raw);
      this.adapter.write(KEYS.tmp, text);
      if (this.parse(this.adapter.read(KEYS.tmp)).status !== 'ok') throw new Error('la verificación de escritura falló');
      this.adapter.write(KEYS.main, text);
      if (this.parse(this.adapter.read(KEYS.main)).status !== 'ok') throw new Error('la verificación final falló');
      this.adapter.remove(KEYS.tmp);
    } catch (e) {
      return { ok: false, error: `no se pudo escribir (${e.message ?? e}); ¿almacenamiento lleno o bloqueado?` };
    }
    return { ok: true, savedAt };
  }

  /** Borra la partida (la copia .bak se conserva por seguridad). */
  deleteSave() {
    try { this.adapter.remove(KEYS.main); this.adapter.remove(KEYS.tmp); return true; } catch { return false; }
  }
}
