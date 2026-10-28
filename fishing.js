import * as THREE from "three";
import { showToast } from "./toast.js";

export function buildFishing(scene, camera, dock, canvas, isWalking) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x594532, roughness: 0.85 });
  const grip = new THREE.MeshStandardMaterial({ color: 0xa48a5c, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x777d76, roughness: 0.5, metalness: 0.5 });
  const poleGeometry = new THREE.CylinderGeometry(0.009, 0.025, 1.8, 6);
  const gripGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.32, 6);
  function makeRod() {
    const rod = new THREE.Group();
    const pole = new THREE.Mesh(poleGeometry, wood);
    pole.position.y = 0.9;
    rod.add(pole);
    const handle = new THREE.Mesh(gripGeometry, grip);
    handle.position.y = 0.16;
    rod.add(handle);
    const reel = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), metal);
    reel.position.set(0.07, 0.3, 0);
    rod.add(reel);
    return rod;
  }
  const barrel = dock.barrelPositions[0];
  const spare = makeRod();
  spare.name = "Spare Fishing Rod";
  spare.position.set(barrel.x - 0.37, dock.deckY + 0.02, barrel.z - 0.16);
  spare.rotation.z = -0.18;
  dock.group.add(spare);
  const held = makeRod();
  held.position.set(0.38, -0.43, -0.6);
  held.rotation.set(-0.78, 0, 0.18);
  held.scale.setScalar(0.65);
  held.visible = false;
  camera.add(held);
  scene.add(camera);

  const float = new THREE.Group();
  const floatGeometry = new THREE.SphereGeometry(0.1, 8, 6);
  const white = new THREE.MeshStandardMaterial({ color: 0xe9e1ce, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb8332e, roughness: 0.7 });
  const bottom = new THREE.Mesh(floatGeometry, white);
  bottom.scale.set(1, 0.8, 1);
  float.add(bottom);
  const top = new THREE.Mesh(floatGeometry, red);
  top.scale.set(0.85, 0.65, 0.85);
  top.position.y = 0.09;
  float.add(top);
  float.visible = false;
  scene.add(float);
  const linePositions = new Float32Array(13 * 3);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xd0c9b6 }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  const hud = document.createElement("div");
  hud.className = "fishing-hud";
  const instruction = document.createElement("div");
  const meter = document.createElement("div");
  meter.className = "fishing-meter";
  const fill = document.createElement("div");
  fill.className = "fishing-meter-fill";
  meter.appendChild(fill);
  const tally = document.createElement("div");
  tally.className = "fishing-tally";
  hud.append(instruction, meter, tally);
  document.body.appendChild(hud);

  const local = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const target = new THREE.Vector3();
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const point = new THREE.Vector3();
  let holding = false;
  let state = "idle";
  let pressed = false;
  let source = "";
  let time = 0;
  let power = 0;
  let wait = 0;
  let tension = 0;
  let progress = 0;
  let fishCount = 0;
  let total = 0;
  let deposited = 0;

  function lookingAt(object, height, distance = 2.5) {
    object.getWorldPosition(target);
    target.y += height;
    target.sub(camera.position);
    const length = target.length();
    if (length > distance || length < 0.01) return false;
    camera.getWorldDirection(direction);
    return direction.dot(target) / length > 0.88;
  }
  function canInteract() {
    const bucket = dock.group.getObjectByName("Fish Bucket");
    if (bucket && fishCount && lookingAt(bucket, 0.3)) return "bucket";
    if (lookingAt(spare, 0.65)) return holding ? "return" : "pickup";
    return null;
  }
  function cancel() {
    state = "idle";
    pressed = false;
    source = "";
    float.visible = false;
    line.visible = false;
  }
  function putAway() {
    cancel();
    holding = false;
    held.visible = false;
    spare.visible = true;
  }
  function interact() {
    const action = canInteract();
    if (action === "bucket") {
      deposited += fishCount;
      showToast(`You put ${fishCount} fish in the bucket.`, 3500);
      fishCount = 0;
    } else if (action === "return") {
      putAway();
    } else if (action === "pickup") {
      holding = true;
      held.visible = true;
      spare.visible = false;
      showToast("Face the water near the edge. Hold F to cast; Q puts the rod away.", 5000);
    }
  }
  function canCast() {
    local.copy(camera.position);
    dock.group.worldToLocal(local);
    if (!dock.isOnDock(camera.position.x, camera.position.z) || Math.abs(camera.position.y - dock.deckY - 1.64) > 1.2 || local.z < dock.deckStart + 1) return false;
    camera.getWorldDirection(direction);
    direction.y = 0;
    if (direction.lengthSq() < 0.01) return false;
    direction.normalize();
    // Project a short step ahead into dock coordinates to ensure the cast faces water.
    target.copy(camera.position).addScaledVector(direction, 1.8);
    dock.group.worldToLocal(target);
    return Math.abs(target.x) > 1.4 || target.z > dock.deckEnd;
  }
  function begin(input) {
    if (!holding || !isWalking() || pressed) return;
    if (state === "idle") {
      if (!canCast()) {
        showToast("Stand near the dock edge and face the water to cast.", 3000);
        return;
      }
      state = "charging";
      power = 0;
    } else if (state === "bite") {
      state = "reeling";
      tension = 0.32;
      progress = 0;
      time = 0;
    } else if (state !== "reeling") return;
    pressed = true;
    source = input;
  }
  function release(input) {
    if (!pressed || source !== input) return;
    pressed = false;
    source = "";
    if (state !== "charging") return;
    if (!canCast()) { cancel(); return; }
    start.copy(camera.position);
    start.y = 1.2;
    end.copy(camera.position).addScaledVector(direction, 3 + power * 7);
    end.y = 0.04;
    float.position.copy(start);
    float.visible = true;
    line.visible = true;
    state = "casting";
    time = 0;
  }
  window.addEventListener("keydown", (event) => {
    if (event.repeat || !isWalking()) return;
    if (event.code === "KeyF") { event.preventDefault(); begin("key"); }
    if (event.code === "KeyQ" && holding) { putAway(); showToast("Rod put away.", 2200); }
  });
  window.addEventListener("keyup", (event) => { if (event.code === "KeyF") release("key"); });
  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 0 && document.pointerLockElement === canvas) begin("mouse");
  });
  window.addEventListener("mouseup", (event) => { if (event.button === 0) release("mouse"); });
  window.addEventListener("blur", () => { if (state === "charging") cancel(); pressed = false; source = ""; });

  function catchFish() {
    const roll = Math.random();
    const type = roll < 0.04 ? ["golden fish", 0.4, 1.5] : roll < 0.25 ? ["snapper", 0.8, 3] : roll < 0.6 ? ["bream", 0.4, 1.8] : ["mackerel", 0.3, 1.4];
    const weight = (type[1] + Math.random() * (type[2] - type[1])).toFixed(1);
    fishCount += 1;
    total += 1;
    showToast(`You caught a ${weight} kg ${type[0]}!`, 4500);
    cancel();
  }
  function update(dt, elapsed) {
    try {
      if (!isWalking()) { if (state === "charging") cancel(); pressed = false; source = ""; }
      const active = isWalking();
      if (active && state === "charging") power = Math.min(1, power + dt / 2);
      if (active && state === "casting") {
        time += dt;
        const t = Math.min(1, time / 0.8);
        float.position.lerpVectors(start, end, t);
        float.position.y += Math.sin(Math.PI * t) * (1.5 + power);
        if (t === 1) { state = "waiting"; time = 0; wait = 5 + Math.random() * 15; }
      } else if (active && state === "waiting") {
        time += dt;
        if (time >= wait) { state = "bite"; time = 0; }
      } else if (active && state === "bite") {
        time += dt;
        if (time > 2.5) { showToast("The fish got away.", 2500); cancel(); }
      } else if (active && state === "reeling") {
        time += dt;
        // Bursts force the player to alternate reeling and letting the line slacken.
        const pull = Math.max(0, Math.sin(time * 2.4) - 0.35) * 0.36;
        tension = THREE.MathUtils.clamp(tension + dt * (pressed ? 0.24 + pull : -0.32 + pull), 0, 1);
        if (pressed) progress += dt * 0.13;
        if (tension >= 1) { showToast("The line snapped!", 2500); cancel(); }
        else if (progress >= 1) catchFish();
      }
      if (float.visible && state !== "casting") {
        float.position.y = 0.04 + Math.sin(elapsed * 2) * 0.025 - (state === "bite" ? 0.10 * (0.5 + 0.5 * Math.sin(elapsed * 14)) : 0);
      }
      if (line.visible) {
        held.localToWorld(tip.set(0, 1.8, 0));
        for (let i = 0; i <= 12; i += 1) {
          const t = i / 12;
          point.lerpVectors(tip, float.position, t);
          point.y -= Math.sin(Math.PI * t) * 0.15;
          linePositions[i * 3] = point.x;
          linePositions[i * 3 + 1] = point.y;
          linePositions[i * 3 + 2] = point.z;
        }
        lineGeometry.attributes.position.needsUpdate = true;
      }
      hud.style.display = active && (holding || fishCount) ? "block" : "none";
      instruction.textContent = state === "charging" ? "Cast power" : state === "bite" ? "Bite! Press F to strike" : state === "reeling" ? `Reel: hold F, release to ease tension (${Math.floor(progress * 100)}%)` : state === "waiting" ? "Waiting for a bite..." : holding ? "Hold F to cast · Q put away" : "Take your fish to the bucket";
      meter.style.display = state === "charging" || state === "reeling" ? "block" : "none";
      meter.classList.toggle("tension", state === "reeling");
      fill.style.width = `${Math.round((state === "charging" ? power : tension) * 100)}%`;
      fill.style.background = state === "reeling" && tension > 0.75 ? "#c45445" : "#c1b18b";
      tally.textContent = `Fish: ${fishCount} carried · ${total} caught · ${deposited} in bucket`;
    } catch (error) {
      cancel();
      console.warn("Fishing update stopped:", error);
    }
  }
  function giveRod() { holding = true; held.visible = true; spare.visible = false; }
  return { update, canInteract, interact, giveRod,
    reset() { putAway(); fishCount = 0; total = 0; deposited = 0; },
    getState: () => ({ fishCount, total, deposited }),
    setState(value) {
      if (!value) return;
      for (const key of ["fishCount", "total", "deposited"]) if (!Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > 1000000) return;
      fishCount = value.fishCount; total = value.total; deposited = value.deposited;
    },
  };
}
