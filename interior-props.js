import * as THREE from "three";

export function buildInteriorProps(group, floorY, ceilingY, azimuth, table, book, shelf, colliders, audio, onOpen, onClose) {
  const iron = new THREE.MeshStandardMaterial({ color: 0x292b2b, metalness: 0.65, roughness: 0.65 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb28a4c, metalness: 0.65, roughness: 0.45 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x533527, roughness: 0.9 });
  const ember = new THREE.MeshStandardMaterial({ color: 0x9f2c08, emissive: 0xff4308, emissiveIntensity: 2 });
  function mesh(parent, geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  }
  // The stove sits between the existing crate and table, away from the ladder and reserved wall.
  const angle = azimuth - 2.15, radius = 1.52;
  const stove = new THREE.Group(); stove.position.set(Math.sin(angle) * radius, floorY, Math.cos(angle) * radius); stove.rotation.y = angle + Math.PI; group.add(stove);
  colliders.push({ x: stove.position.x, z: stove.position.z, radius: 0.3 });
  mesh(stove, new THREE.SphereGeometry(0.3, 16, 12), iron, 0, 0.45, 0).scale.set(1, 1.16, 1);
  mesh(stove, new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), iron, 0, 0.77, 0);
  mesh(stove, new THREE.CylinderGeometry(0.085, 0.085, ceilingY - floorY - 0.78, 12), iron, 0, (ceilingY - floorY + 0.78) / 2, -0.08);
  for (const x of [-0.19, 0.19]) for (const z of [-0.16, 0.16]) mesh(stove, new THREE.BoxGeometry(0.07, 0.2, 0.07), iron, x, 0.1, z);
  mesh(stove, new THREE.BoxGeometry(0.3, 0.22, 0.025), ember, 0, 0.43, 0.281);
  for (const x of [-0.12, -0.06, 0, 0.06, 0.12]) mesh(stove, new THREE.BoxGeometry(0.018, 0.24, 0.025), iron, x, 0.43, 0.3);
  const fireLight = new THREE.PointLight(0xff6d26, 1.6, 4, 2); fireLight.position.set(0, 0.55, 0.4); stove.add(fireLight);
  const flameCanvas = document.createElement("canvas"); flameCanvas.width = 32; flameCanvas.height = 64;
  const ctx = flameCanvas.getContext("2d");
  const gradient = ctx.createRadialGradient(16, 43, 1, 16, 39, 25); gradient.addColorStop(0, "rgba(255,235,125,0.9)"); gradient.addColorStop(0.45, "rgba(255,100,10,0.65)"); gradient.addColorStop(1, "rgba(255,60,0,0)"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 64);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(flameCanvas), transparent: true, depthWrite: false })); flame.position.set(-0.055, 0.47, 0.29); flame.scale.set(0.17, 0.3, 1); stove.add(flame);
  const secondFlame = new THREE.Sprite(flame.material.clone()); secondFlame.position.set(0.06, 0.46, 0.295); secondFlame.scale.set(0.16, 0.24, 1); stove.add(secondFlame);
  const kettle = new THREE.Group(); kettle.position.set(0.12, 0.81, 0.03); stove.add(kettle);
  mesh(kettle, new THREE.SphereGeometry(0.12, 12, 8), iron, 0, 0.1, 0).scale.y = 0.8;
  mesh(kettle, new THREE.CylinderGeometry(0.06, 0.08, 0.025, 12), brass, 0, 0.19, 0);
  const handle = mesh(kettle, new THREE.TorusGeometry(0.105, 0.012, 6, 16, Math.PI), iron, 0, 0.14, 0); handle.rotation.z = 0;
  const steamCanvas = document.createElement("canvas"); steamCanvas.width = steamCanvas.height = 32;
  const steamContext = steamCanvas.getContext("2d"); const mist = steamContext.createRadialGradient(16, 16, 0, 16, 16, 16);
  mist.addColorStop(0, "rgba(235,235,225,0.8)"); mist.addColorStop(1, "rgba(235,235,225,0)"); steamContext.fillStyle = mist; steamContext.fillRect(0, 0, 32, 32);
  const steam = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(steamCanvas), transparent: true, opacity: 0, depthWrite: false })); steam.position.set(0.12, 1.05, 0.03); stove.add(steam);

  const radio = new THREE.Group(); radio.position.set(0.25, 0.14, 0); shelf.add(radio);
  mesh(radio, new THREE.BoxGeometry(0.35, 0.22, 0.16), wood, 0, 0, 0);
  const dialMat = new THREE.MeshStandardMaterial({ color: 0xb99c62, emissive: 0xffae43, emissiveIntensity: 0 });
  mesh(radio, new THREE.BoxGeometry(0.25, 0.065, 0.01), dialMat, 0, 0.035, -0.086);
  for (const x of [-0.1, 0.1]) { const knob = mesh(radio, new THREE.CylinderGeometry(0.022, 0.022, 0.015, 10), brass, x, -0.055, -0.09); knob.rotation.x = Math.PI / 2; }

  // Wall dressing stays above walking height and clear of the reserved shrine.
  const wallAngle = azimuth - 0.85;
  const hook = new THREE.Group(); hook.position.set(Math.sin(wallAngle) * 1.76, floorY + 1.8, Math.cos(wallAngle) * 1.76); hook.rotation.y = wallAngle + Math.PI; group.add(hook);
  mesh(hook, new THREE.BoxGeometry(0.34, 0.07, 0.05), wood, 0, 0, 0);
  mesh(hook, new THREE.BoxGeometry(0.36, 0.65, 0.09), new THREE.MeshStandardMaterial({ color: 0x857449, roughness: 1 }), 0, -0.39, 0.08);
  mesh(hook, new THREE.SphereGeometry(0.035, 8, 6), brass, 0, -0.04, 0.08);
  const chartAngle = azimuth - 2.65;
  const chart = new THREE.Group(); chart.position.set(Math.sin(chartAngle) * 1.72, floorY + 1.65, Math.cos(chartAngle) * 1.72); chart.rotation.y = chartAngle + Math.PI; group.add(chart);
  mesh(chart, new THREE.BoxGeometry(0.62, 0.43, 0.04), wood, 0, 0, 0);
  mesh(chart, new THREE.BoxGeometry(0.54, 0.35, 0.01), new THREE.MeshStandardMaterial({ color: 0xd6c7a1 }), 0, 0, 0.025);
  for (let i = 0; i < 4; i++) { const line = mesh(chart, new THREE.BoxGeometry(0.34 - i * 0.04, 0.008, 0.005), brass, 0, -0.1 + i * 0.055, 0.032); line.rotation.z = 0.12 * i; }
  const rope = new THREE.Group(); rope.position.set(Math.sin(azimuth - 1.75) * 1.63, floorY + 0.035, Math.cos(azimuth - 1.75) * 1.63); group.add(rope);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xad9164, roughness: 1 });
  for (let i = 0; i < 3; i++) { const loop = mesh(rope, new THREE.TorusGeometry(0.12 + i * 0.035, 0.018, 6, 24), ropeMat, 0, i * 0.007, 0); loop.rotation.x = Math.PI / 2; }

  const overlay = document.createElement("div"); overlay.className = "logbook-overlay"; overlay.hidden = true;
  const panel = document.createElement("section"); panel.className = "logbook-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", "Keeper's logbook"); overlay.append(panel);
  const title = document.createElement("h2"); title.textContent = "The Keeper's Log"; panel.append(title);
  const page = document.createElement("p"); page.className = "logbook-page"; page.setAttribute("aria-live", "polite"); panel.append(page);
  const count = document.createElement("p"); panel.append(count);
  const controls = document.createElement("div"); controls.className = "logbook-controls"; panel.append(controls);
  const entries = ["12 March — A squall came in before dawn. The lamp held steady, though the panes rattled until breakfast.", "4 June — The fisherman brought a silver catch and stayed for tea. He says the tide has a memory longer than ours.", "19 August — Two ships passed after midnight without a sound. By morning there was no trace of them in the mist.", "2 October — Landed on the sandy island at low water. Found only shells, a length of rope, and footprints leading back to the sea.", "31 December — Trim the lantern before the dark arrives. Its light reaches further when the glass is clean and the keeper is patient."];
  let pageIndex = 0, radioOn = false, nextNote = 0, noteIndex = 0, nextCrackle = 0, updateBroken = false;
  function render() { page.textContent = entries[pageIndex]; count.textContent = `Page ${pageIndex + 1} of ${entries.length}`; prev.disabled = pageIndex === 0; next.disabled = pageIndex === entries.length - 1; }
  function button(label, action) { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.addEventListener("click", action); controls.append(b); return b; }
  function close() { overlay.hidden = true; onClose(); }
  const prev = button("← Previous", () => { pageIndex = Math.max(0, pageIndex - 1); render(); });
  const next = button("Next →", () => { pageIndex = Math.min(entries.length - 1, pageIndex + 1); render(); });
  const closeButton = button("Close · E / Esc", close); document.body.append(overlay); render();
  const target = new THREE.Vector3(), direction = new THREE.Vector3(), view = new THREE.Vector3();
  function aimed(camera, object, range) { object.getWorldPosition(target); direction.subVectors(target, camera.position); const distance = direction.length(); camera.getWorldDirection(view); return distance < range && distance > 0 && view.dot(direction.normalize()) > 0.94; }
  function action(camera) { if (!overlay.hidden) return ""; if (aimed(camera, book, 1.8)) return "book"; if (aimed(camera, radio, 2.2)) return "radio"; return ""; }
  function tone(context, music, frequency, duration, volume, type) { const osc = context.createOscillator(), gain = context.createGain(), now = context.currentTime; osc.type = type; osc.frequency.value = frequency; gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration); osc.connect(gain).connect(master); osc.start(now); osc.stop(now + duration); }
  return {
    get open() { return !overlay.hidden; },
    prompt(camera) { try { const a = action(camera); return a === "book" ? "Read the keeper's log" : a === "radio" ? (radioOn ? "Turn off the radio" : "Turn on the radio") : ""; } catch { return ""; } },
    interact(camera) { const a = action(camera); if (a === "book") { overlay.hidden = false; onOpen(); render(); closeButton.focus(); } else if (a === "radio") { radioOn = !radioOn; dialMat.emissiveIntensity = radioOn ? 1.5 : 0; nextNote = 0; } },
    key(event) { if (overlay.hidden || event.code === "KeyM") return false; event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) { if (event.code === "Escape" || event.code === "KeyE") close(); else if (event.code === "ArrowLeft") prev.click(); else if (event.code === "ArrowRight") next.click(); } return true; },
    update(elapsed, camera, playing) { if (updateBroken) return; try {
      const flicker = 0.75 + 0.25 * Math.sin(elapsed * 11) * Math.sin(elapsed * 4.3); fireLight.intensity = 1.2 + flicker * 0.8; ember.emissiveIntensity = 1.3 + flicker; flame.scale.y = 0.25 + flicker * 0.08; secondFlame.scale.y = 0.22 + (1 - flicker) * 0.12;
      const puff = (elapsed % 7) / 7; steam.material.opacity = puff < 0.28 ? Math.sin(puff / 0.28 * Math.PI) * 0.32 : 0; steam.position.y = 1.04 + puff * 0.65; steam.scale.setScalar(0.12 + puff * 0.4);
      const chain = audio.getChain(); if (!playing || !chain || chain.context.state !== "running") return;
      const { context, effects, music } = chain; const distance = camera.position.distanceTo(stove.position);
      if (distance < 4 && elapsed >= nextCrackle) { tone(context, effects, 95 + Math.random() * 150, 0.045, 0.004 * (1 - distance / 4), "square"); nextCrackle = elapsed + 0.12 + Math.random() * 0.5; }
      radio.getWorldPosition(target); const radioDistance = camera.position.distanceTo(target);
      if (radioOn && radioDistance < 6 && elapsed >= nextNote) { const melody = [196, 247, 294, 294, 330, 294, 247, 196, 220, 247, 196, 165, 196, 0, 196, 0]; const frequency = melody[noteIndex++ % melody.length]; if (frequency) tone(context, music, frequency, 0.35, 0.012 * (1 - radioDistance / 6), "triangle"); nextNote = elapsed + 0.4; }
    } catch (error) { updateBroken = true; console.warn("Interior animation or audio unavailable", error); } },
  };
}
