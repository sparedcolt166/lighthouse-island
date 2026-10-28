import * as THREE from "three";
import { showToast } from "./toast.js";

export function buildBrunson(dock, colliders, sampleGround) {
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
  const white = mat(0xf3f0e7), blue = mat(0x006bb6), orange = mat(0xf58426);
  const skin = mat(0x825036), hair = mat(0x211b19), wood = mat(0x70472b);
  const silver = mat(0xcbd2d5, { metalness: 0.86, roughness: 0.2 });
  const gold = mat(0xd8a735, { metalness: 0.75, roughness: 0.25 });
  const sphere = new THREE.SphereGeometry(1, 10, 8);
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
  mesh(torso, box, jerseyMaterials, [0, 0.34, 0], [0.56, 0.64, 0.31]);
  mesh(torso, box, blue, [0, 0.04, 0], [0.57, 0.045, 0.32]);
  mesh(torso, box, orange, [0, 0.09, 0], [0.57, 0.035, 0.32]);
  mesh(figure, box, white, [0, 0.88, 0], [0.55, 0.27, 0.32]);
  for (const side of [-1, 1]) {
    mesh(figure, box, blue, [side * 0.268, 0.89, 0], [0.035, 0.24, 0.33]);
    mesh(figure, cylinder, skin, [side * 0.15, 0.43, 0], [0.105, 0.68, 0.105]);
    mesh(figure, box, white, [side * 0.15, 0.075, 0.06], [0.22, 0.15, 0.36]);
    mesh(figure, box, blue, [side * 0.15, 0.035, 0.06], [0.23, 0.045, 0.37]);
  }
  const head = joint(torso, 0, 0.71, 0);
  mesh(head, sphere, skin, [0, 0.20, 0], [0.23, 0.26, 0.21]);
  mesh(head, sphere, hair, [0, 0.38, -0.01], [0.23, 0.13, 0.21]);
  mesh(head, sphere, hair, [0, 0.08, 0.13], [0.20, 0.11, 0.12]);
  mesh(head, sphere, skin, [0, 0.22, 0.20], [0.06, 0.07, 0.07]);
  for (const side of [-1, 1]) mesh(head, sphere, hair, [side * 0.085, 0.26, 0.19], [0.022, 0.025, 0.018]);
  const arms = [-1, 1].map((side) => {
    const arm = joint(torso, side * 0.32, 0.56, 0);
    mesh(arm, cylinder, skin, [0, -0.22, 0], [0.09, 0.43, 0.09]);
    mesh(arm, sphere, skin, [0, -0.44, 0], [0.095, 0.095, 0.095]);
    return arm;
  });
  arms[0].rotation.z = -0.18; arms[1].rotation.z = 0.3;
  const ballMaterial = mat(0xcc641e);
  const ballGeometry = new THREE.SphereGeometry(0.12, 12, 8);
  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0x3c2418 });
  const makeBall = (parent, bx, by, bz) => {
    const ball = joint(parent, bx, by, bz);
    mesh(ball, ballGeometry, ballMaterial, [0, 0, 0], [1, 1, 1]);
    for (const angle of [0, Math.PI / 2]) {
      const seam = mesh(ball, new THREE.TorusGeometry(0.121, 0.004, 4, 20), seamMaterial, [0, 0, 0], [1, 1, 1]); seam.rotation.y = angle;
    }
    const seam = mesh(ball, new THREE.TorusGeometry(0.121, 0.004, 4, 20), seamMaterial, [0, 0, 0], [1, 1, 1]); seam.rotation.x = Math.PI / 2;
    return ball;
  };
  const ball = makeBall(figure, 0.49, 0.12, 0.15);

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

  // Find a beach position beside the landing, avoiding the stair ground targets.
  let shrineX = 2.5, shrineZ = -0.8, ground = null;
  for (const candidate of [[2.5, -0.8], [2.2, -1.5], [-2.5, -0.8], [-2.2, -1.5]]) {
    const point = dock.group.localToWorld(new THREE.Vector3(candidate[0], 0, candidate[1]));
    const height = sampleGround(point.x, point.z);
    if (height !== null && height >= 1.3) { shrineX = candidate[0]; shrineZ = candidate[1]; ground = height; break; }
  }
  if (ground !== null) {
    const shrine = joint(dock.group, shrineX, ground, shrineZ); shrine.name = "Brunson Shrine";
    shrine.rotation.y = shrineX > 0 ? -0.55 : 0.55;
    addCollider(shrineX, shrineZ, 0.48);
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
    makeBall(shrine, -0.24, 0.13, 0.28); makeBall(shrine, 0.20, 0.13, 0.31);
    mesh(shrine, cylinder, wood, [0.42, 1.13, 0], [0.018, 0.8, 0.018]);
    const flagShape = new THREE.BufferGeometry();
    flagShape.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.28, 0, 0.35, 0.14, 0], 3)); flagShape.computeVertexNormals();
    mesh(shrine, flagShape, new THREE.MeshStandardMaterial({ color: 0x006bb6, side: THREE.DoubleSide }), [0.42, 1.25, 0], [1, 1, 1]);
    shrine.userData.flames = flames; shrine.userData.light = light;
    figure.userData.shrine = shrine;
  }
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
      const bounce = Math.abs(Math.sin(elapsed * 3.3));
      ball.position.y = 0.12 + bounce * 0.68;
      const squash = Math.max(0, 1 - bounce * 8) * 0.22;
      ball.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      arms[1].rotation.x = -0.35 - bounce * 0.45;
      celebration = Math.max(0, celebration - delta);
      const cheer = celebration > 0 ? Math.sin(Math.PI * (1 - celebration / 2)) : Math.max(0, Math.sin(elapsed * 0.22) - 0.94) * 8;
      arms[0].rotation.z = -0.18 - cheer * 2.3;
      figure.rotation.z = Math.sin(elapsed * 0.6) * 0.015 + cheer * 0.04;
      local.copy(playerPosition); dock.group.worldToLocal(local);
      const dx = local.x - x, dz = local.z - z;
      const target = Math.hypot(dx, dz) < 4 ? THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.5, 1.5) : 0;
      look = THREE.MathUtils.damp(look, target, 2.2, delta); head.rotation.y = look;
      const shrine = figure.userData.shrine;
      if (shrine) {
        shrine.userData.flames.forEach((flame, i) => { flame.scale.y = 0.07 * (0.8 + 0.2 * Math.sin(elapsed * 9 + i * 2)); });
        shrine.userData.light.intensity = 0.65 + Math.sin(elapsed * 8) * 0.08;
      }
    } catch (error) { /* Animation must not stop the walkabout. */ }
  }
  return { update, canInteract, interact };
}
