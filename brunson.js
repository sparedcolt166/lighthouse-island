import * as THREE from "three";
import { showToast } from "./toast.js";

export const SHRINE_ANGLE_OFFSET = 0.85;

function basketballMaterial() {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#c76724"; ctx.fillRect(0, 0, 512, 256);
  // Repeatable tiny speckles suggest the pebbled leather without extra geometry.
  for (let i = 0; i < 6000; i++) {
    const x = (i * 137.508) % 512, y = (i * 73.31) % 256;
    ctx.fillStyle = i % 2 ? "#dc8137" : "#a84f1b"; ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.strokeStyle = "#30221b"; ctx.lineWidth = 4;
  for (const x of [0, 128, 256, 384, 512]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(512, 128); ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 });
}
function makeBasketball(parent, x, y, z, radius = 0.12) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), basketballMaterial());
  ball.position.set(x, y, z); ball.castShadow = true; parent.add(ball); return ball;
}

export function buildBrunson(dock, colliders) {
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
  const white = mat(0xf3f0e7), blue = mat(0x006bb6), orange = mat(0xf58426);
  const skin = mat(0x825036), hair = mat(0x211b19), wood = mat(0x70472b);
  const silver = mat(0xcbd2d5, { metalness: 0.86, roughness: 0.2 });
  const gold = mat(0xd8a735, { metalness: 0.75, roughness: 0.25 });
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const mesh = (parent, geometry, material, position, scale) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(...position); part.scale.set(...scale);
    part.castShadow = true; part.receiveShadow = true; parent.add(part);
    return part;
  };
  const joint = (parent, x, y, z) => {
    const part = new THREE.Group(); part.position.set(x, y, z); parent.add(part); return part;
  };
  const addCollider = (x, z, radius) => {
    const world = dock.group.localToWorld(new THREE.Vector3(x, 0, z));
    colliders.push({ x: world.x, z: world.z, radius });
    return world;
  };
  const textTexture = (back) => {
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3f0e7"; ctx.fillRect(0, 0, 256, 256);
    ctx.textAlign = "center"; ctx.fillStyle = "#006bb6";
    ctx.font = "bold 32px sans-serif"; ctx.fillText(back ? "BRUNSON" : "NEW YORK", 128, 72);
    ctx.font = "bold 130px sans-serif"; ctx.strokeStyle = "#f58426"; ctx.lineWidth = 7;
    ctx.strokeText("11", 128, 203); ctx.fillText("11", 128, 203);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  };
  const jerseyMaterials = [white, white, white, white,
    new THREE.MeshStandardMaterial({ map: textTexture(false), roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: textTexture(true), roughness: 0.9 })];
  const x = -0.85, z = dock.deckStart + 2.1;
  const figure = joint(dock.group, x, dock.deckY, z); figure.name = "Jalen Brunson Tribute";
  const world = addCollider(x, z, 0.35);
  const torso = joint(figure, 0, 0.94, 0);
  // Rounded jersey body with separate flat lettering panels keeps type legible.
  mesh(torso, sphere, white, [0, 0.34, 0], [0.30, 0.38, 0.18]);
  for (const side of [-1, 1]) {
    const panel = mesh(torso, new THREE.PlaneGeometry(0.42, 0.48), jerseyMaterials[side === 1 ? 4 : 5], [0, 0.35, side * 0.177], [1, 1, 1]);
    if (side < 0) panel.rotation.y = Math.PI;
    mesh(torso, sphere, skin, [side * 0.285, 0.57, 0], [0.105, 0.105, 0.105]);
  }
  mesh(torso, box, blue, [0, 0.04, 0], [0.57, 0.045, 0.32]);
  mesh(torso, box, orange, [0, 0.09, 0], [0.57, 0.035, 0.32]);
  mesh(figure, sphere, white, [0, 0.88, 0], [0.29, 0.18, 0.18]);
  for (const side of [-1, 1]) {
    mesh(figure, box, blue, [side * 0.268, 0.89, 0], [0.035, 0.24, 0.33]);
    mesh(figure, sphere, skin, [side * 0.15, 0.48, 0], [0.105, 0.31, 0.105]);
    mesh(figure, cylinder, white, [side * 0.15, 0.19, 0], [0.108, 0.18, 0.108]);
    mesh(figure, sphere, white, [side * 0.15, 0.085, 0.06], [0.12, 0.09, 0.20]);
    mesh(figure, box, blue, [side * 0.15, 0.035, 0.06], [0.23, 0.045, 0.37]);
    for (const laceZ of [0.06, 0.12, 0.18]) mesh(figure, box, blue, [side * 0.15, 0.16, laceZ], [0.12, 0.012, 0.018]);
  }
  const head = joint(torso, 0, 0.71, 0);
  mesh(head, sphere, skin, [0, 0.20, 0], [0.23, 0.26, 0.21]);
  mesh(head, sphere, hair, [0, 0.38, -0.01], [0.23, 0.13, 0.21]);
  mesh(head, sphere, hair, [0, 0.08, 0.13], [0.20, 0.11, 0.12]);
  mesh(head, sphere, skin, [0, 0.22, 0.20], [0.06, 0.07, 0.07]);
  for (const side of [-1, 1]) {
    mesh(head, sphere, skin, [side * 0.225, 0.20, 0], [0.045, 0.07, 0.035]);
    mesh(head, sphere, white, [side * 0.085, 0.26, 0.187], [0.045, 0.029, 0.025]);
    mesh(head, sphere, hair, [side * 0.085, 0.26, 0.208], [0.018, 0.021, 0.012]);
    mesh(head, sphere, hair, [side * 0.085, 0.31, 0.185], [0.05, 0.012, 0.014]);
  }
  mesh(head, sphere, hair, [0, 0.12, 0.219], [0.065, 0.012, 0.009]);
  const arms = [-1, 1].map((side) => {
    const arm = joint(torso, side * 0.32, 0.56, 0);
    mesh(arm, sphere, skin, [0, -0.22, 0], [0.09, 0.25, 0.09]);
    mesh(arm, sphere, skin, [0, -0.44, 0], [0.095, 0.095, 0.075]);
    for (const finger of [-1, 0, 1]) mesh(arm, sphere, skin, [finger * 0.045, -0.51, 0], [0.022, 0.065, 0.025]);
    return arm;
  });
  arms[0].rotation.z = -0.18; arms[1].rotation.z = 0.3;
  const ball = makeBasketball(figure, 0.45, 0.12, 0);

  // A narrow plinth on the same side keeps the middle of the dock open.
  const trophyZ = z + 1.15;
  const trophy = joint(dock.group, -1.02, dock.deckY, trophyZ); trophy.name = "NBA Cup Tribute";
  addCollider(-1.02, trophyZ, 0.22);
  mesh(trophy, box, wood, [0, 0.16, 0], [0.42, 0.32, 0.42]);
  mesh(trophy, cylinder, silver, [0, 0.35, 0], [0.20, 0.07, 0.20]);
  mesh(trophy, cylinder, silver, [0, 0.48, 0], [0.07, 0.22, 0.07]);
  mesh(trophy, new THREE.CylinderGeometry(0.22, 0.08, 0.30, 12, 1, true), silver, [0, 0.73, 0], [1, 1, 1]);
  mesh(trophy, new THREE.TorusGeometry(0.22, 0.018, 5, 12), gold, [0, 0.88, 0], [1, 1, 1]).rotation.x = Math.PI / 2;
  mesh(trophy, cylinder, gold, [0, 0.63, 0], [0.11, 0.035, 0.11]);

  const facing = new THREE.Vector3(), toFigure = new THREE.Vector3(), local = new THREE.Vector3();
  let celebration = 0, look = 0;
  const lines = ["Captain Clutch at your service.", "Knicks in 5.", "Let's go New York!", "Keep that light shining!"];
  function canInteract(camera) {
    toFigure.set(world.x - camera.position.x, 0, world.z - camera.position.z);
    const distance = toFigure.length();
    if (distance > 2.8 || distance < 0.01) return false;
    camera.getWorldDirection(facing); facing.y = 0; facing.normalize();
    return facing.dot(toFigure) / distance > 0.77;
  }
  function interact() { celebration = 2; showToast(lines[Math.floor(Math.random() * lines.length)], 4000); }
  function update(delta, elapsed, playerPosition) {
    try {
      const bounce = (1 - Math.cos(elapsed * 6.6)) / 2;
      ball.position.y = 0.12 + bounce * 0.70;
      const squash = Math.max(0, 1 - bounce * 8) * 0.22;
      ball.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      ball.position.y -= 0.12 * squash;
      arms[1].rotation.x = 0;
      arms[1].rotation.z = 0.3 + bounce * 0.04;
      celebration = Math.max(0, celebration - delta);
      const cheer = celebration > 0 ? Math.sin(Math.PI * (1 - celebration / 2)) : Math.max(0, Math.sin(elapsed * 0.22) - 0.94) * 8;
      arms[0].rotation.z = -0.18 - cheer * 2.3;
      figure.rotation.z = Math.sin(elapsed * 0.6) * 0.015 + cheer * 0.04;
      local.copy(playerPosition); dock.group.worldToLocal(local);
      const dx = local.x - x, dz = local.z - z;
      const target = Math.hypot(dx, dz) < 4 ? THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.5, 1.5) : 0;
      look = THREE.MathUtils.damp(look, target, 2.2, delta); head.rotation.y = look;
    } catch (error) { /* Animation must not stop the walkabout. */ }
  }
  return { update, canInteract, interact };
}

// The altar faces inward and stays close to the wall, clear of the door path.
export function buildBrunsonShrine(interior, azimuth, floorY, roomRadius, colliders) {
  const angle = azimuth + SHRINE_ANGLE_OFFSET;
  const distance = roomRadius - 0.27;
  const shrine = new THREE.Group(); shrine.name = "Brunson Shrine";
  shrine.position.set(Math.sin(angle) * distance, floorY, Math.cos(angle) * distance);
  shrine.rotation.y = angle + Math.PI; interior.add(shrine);
  colliders.push({ x: shrine.position.x, z: shrine.position.z, radius: 0.31 });
  const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const wood = mat(0x70472b), white = mat(0xf3f0e7);
  const box = new THREE.BoxGeometry(1, 1, 1), cylinder = new THREE.CylinderGeometry(1, 1, 1, 10), sphere = new THREE.SphereGeometry(1, 12, 8);
  const mesh = (parent, geometry, material, position, scale) => {
    const part = new THREE.Mesh(geometry, material); part.position.set(...position); part.scale.set(...scale);
    part.castShadow = true; part.receiveShadow = true; parent.add(part); return part;
  };
    for (const side of [-1, 1]) mesh(shrine, box, wood, [side * 0.33, 0.38, 0], [0.09, 0.76, 0.32]);
    mesh(shrine, box, wood, [0, 0.72, 0], [0.85, 0.10, 0.40]);
    mesh(shrine, box, wood, [0, 0.42, 0], [0.78, 0.08, 0.36]);
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 320;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#006bb6"; ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = "#f58426"; ctx.beginPath(); ctx.arc(128, 93, 42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(46, 225); ctx.lineTo(65, 155); ctx.lineTo(96, 135); ctx.lineTo(160, 135); ctx.lineTo(191, 155); ctx.lineTo(210, 225); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.font = "bold 55px sans-serif"; ctx.fillText("11", 128, 205);
    ctx.font = "bold 29px sans-serif"; ctx.fillText("BRUNSON", 128, 280);
    const portrait = new THREE.CanvasTexture(canvas); portrait.colorSpace = THREE.SRGBColorSpace;
    mesh(shrine, box, wood, [0, 1.07, -0.08], [0.49, 0.65, 0.08]);
    mesh(shrine, new THREE.PlaneGeometry(0.41, 0.56), new THREE.MeshBasicMaterial({ map: portrait }), [0, 1.07, -0.035], [1, 1, 1]);
    const flames = [];
    for (const side of [-1, 1]) {
      mesh(shrine, cylinder, white, [side * 0.32, 0.83, 0.08], [0.045, 0.17, 0.045]);
      const flame = mesh(shrine, sphere, new THREE.MeshBasicMaterial({ color: 0xffb52e }), [side * 0.32, 0.95, 0.08], [0.035, 0.07, 0.035]); flames.push(flame);
    }
    const light = new THREE.PointLight(0xffa344, 0.7, 3); light.position.set(0, 1.05, 0.2); shrine.add(light);
    makeBasketball(shrine, -0.20, 0.555, 0, 0.095); makeBasketball(shrine, 0.20, 0.555, 0, 0.095);
    mesh(shrine, cylinder, wood, [0.42, 1.13, 0], [0.018, 0.8, 0.018]);
    const flagShape = new THREE.BufferGeometry();
    flagShape.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.28, 0, 0.35, 0.14, 0], 3)); flagShape.computeVertexNormals();
    mesh(shrine, flagShape, new THREE.MeshStandardMaterial({ color: 0x006bb6, side: THREE.DoubleSide }), [0.42, 1.25, 0], [1, 1, 1]);
  return { update(elapsed) {
    try {
      flames.forEach((flame, i) => { flame.scale.y = 0.07 * (0.8 + 0.2 * Math.sin(elapsed * 9 + i * 2)); });
      light.intensity = 0.65 + Math.sin(elapsed * 8) * 0.08;
    } catch (error) { /* Keep the walkabout running if a decorative light fails. */ }
  } };
}
