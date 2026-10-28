const KEY = "lighthouse-settings-v1";
const defaults = { master: 1, music: 1, effects: 1, sensitivity: 1, fov: 72, invertY: false, quality: "high" };
export function createSettings(apply) {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* Storage may be unavailable. */ }
  const values = { ...defaults };
  for (const key of ["master", "music", "effects", "sensitivity", "fov"]) {
    const limits = { master: [0, 1], music: [0, 1], effects: [0, 1], sensitivity: [0.3, 2], fov: [55, 100] }[key];
    if (typeof stored[key] === "number" && Number.isFinite(stored[key])) values[key] = Math.max(limits[0], Math.min(limits[1], stored[key]));
  }
  if (typeof stored.invertY === "boolean") values.invertY = stored.invertY;
  if (["low", "medium", "high"].includes(stored.quality)) values.quality = stored.quality;
  for (const key of Object.keys(defaults)) {
    const input = document.getElementById(`setting-${key}`);
    if (key === "invertY") input.checked = values[key]; else input.value = values[key];
    input.addEventListener("input", () => {
      values[key] = key === "invertY" ? input.checked : key === "quality" ? input.value : Number(input.value);
      apply(values);
      try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { /* Keep settings for this session. */ }
    });
  }
  apply(values);
  return values;
}
