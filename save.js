const KEY = "lighthouse-save-v1";
export function readSave() {
  try { const value = JSON.parse(localStorage.getItem(KEY)); return value && value.version === 1 ? value : null; } catch { return null; }
}
export function writeSave(value) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...value, version: 1 })); } catch { /* The walk remains playable without storage. */ }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* Storage may be unavailable. */ }
}
