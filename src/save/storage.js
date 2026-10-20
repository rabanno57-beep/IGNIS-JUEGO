// Adaptadores de almacenamiento. SaveManager solo conoce esta interfaz:
//   read(key) -> string|null, write(key, str), remove(key)
// Un futuro CloudAdapter (no implementado) debe cumplir la misma interfaz.

export class LocalStorageAdapter {
  constructor(store = globalThis.localStorage) {
    this.store = store;
  }
  read(key) { return this.store.getItem(key); }
  write(key, value) { this.store.setItem(key, value); }
  remove(key) { this.store.removeItem(key); }
  available() {
    try {
      const k = '__rk_probe__';
      this.store.setItem(k, '1');
      this.store.removeItem(k);
      return true;
    } catch { return false; }
  }
}

// Para pruebas en Node y como último recurso si LocalStorage no existe.
export class MemoryAdapter {
  constructor() { this.map = new Map(); }
  read(key) { return this.map.has(key) ? this.map.get(key) : null; }
  write(key, value) { this.map.set(key, String(value)); }
  remove(key) { this.map.delete(key); }
  available() { return true; }
}
