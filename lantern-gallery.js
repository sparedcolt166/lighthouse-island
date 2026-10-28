import * as THREE from "three";
import { LADDER_OFFSET } from "./upper-room.js";

export function buildLanternGallery(scene, model, groundTargets, azimuth, upperFloor) {
  const deck = model.getObjectByName("Gallery_Deck");
  const base = model.getObjectByName("Lantern_Base");
  const corbel = model.getObjectByName("Gallery_Corbel");
  const glass = model.getObjectByName("Lantern_Glass");
  const deckBox = deck ? new THREE.Box3().setFromObject(deck) : null;
  const floorY = deckBox ? deckBox.max.y : 17.99;
  // Replace the solid exported deck and base with a floor containing a hatch.
  if (deck) deck.visible = false;
  if (base) base.visible = false;
  if (corbel) corbel.visible = false;
  if (glass) glass.visible = false;
  const angle = azimuth + LADDER_OFFSET - Math.PI / 2;
  const ox = Math.sin(angle), oz = Math.cos(angle);
  const hx = ox * 0.9, hz = oz * 0.9;
  const doorAngle = angle + Math.PI;
  const dx = Math.sin(doorAngle), dz = Math.cos(doorAngle);
  const group = new THREE.Group();
  group.name = "Lantern room and gallery";
  scene.add(group);
  const brass = new THREE.MeshStandardMaterial({ color: 0x9d773b, metalness: 0.7, roughness: 0.35 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x66503b, roughness: 0.9, side: THREE.DoubleSide });
  const pane = new THREE.MeshStandardMaterial({ color: 0xb9e4e7, transparent: true, opacity: 0.16, roughness: 0.12, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const lens = new THREE.MeshStandardMaterial({ color: 0xffd78a, emissive: 0xffad43, emissiveIntensity: 0.5, transparent: true, opacity: 0.35, metalness: 0.2, roughness: 0.15 });
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 2.43, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(hx, -hz, 0.4, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64), wood);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  group.add(floor);
  groundTargets.push(floor);
  // This lining hides the back of the tapered tower during the long climb.
  const shaftMaterial = new THREE.MeshStandardMaterial({ color: 0xb9aa90, roughness: 1, side: THREE.BackSide });
  const shaftHeight = floorY - (upperFloor + 3.1);
  if (shaftHeight > 0) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.46, shaftHeight, 32, 1, true), shaftMaterial);
    shaft.position.y = upperFloor + 3.1 + shaftHeight / 2;
    group.add(shaft);
  }
  const ladder = new THREE.Group();
  ladder.position.set(hx, upperFloor, hz);
  ladder.rotation.y = angle;
  group.add(ladder);
  const height = floorY - upperFloor;
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, height + 0.35, 0.07), wood);
    rail.position.set(side * 0.25, height / 2, 0);
    ladder.add(rail);
  }
  for (let y = 0.25; y < height + 0.2; y += 0.4) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.07), brass);
    rung.position.y = y;
    ladder.add(rung);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 6, 32), brass);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(hx, floorY + 0.02, hz);
  group.add(rim);
  // One panel is omitted to leave a usable opening towards the gallery.
  const panels = 16;
  for (let i = 0; i < panels; i++) {
    const a = i * Math.PI * 2 / panels;
    if (Math.cos(a - doorAngle) > 0.92) continue;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 1.55), pane);
    panel.position.set(Math.sin(a) * 1.18, floorY + 1.05, Math.cos(a) * 1.18);
    panel.rotation.y = a;
    group.add(panel);
  }
  const frame = new THREE.Group();
  frame.position.set(dx * 1.18, floorY, dz * 1.18);
  frame.rotation.y = doorAngle;
  group.add(frame);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.65, 0.07), brass);
    post.position.set(side * 0.4, 0.82, 0);
    frame.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.07), brass);
  lintel.position.y = 1.65;
  frame.add(lintel);
  // A small pair of brass tools rests beside the mechanism.
  for (let i = 0; i < 2; i++) {
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), brass);
    tool.position.set(-0.35 + i * 0.1, floorY + 0.17, 0.25);
    tool.rotation.z = 0.45 + i * 0.3;
    group.add(tool);
  }
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.55, 16), brass);
  pedestal.position.y = floorY + 0.275;
  group.add(pedestal);
  for (let i = 0; i < 8; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3 + 0.08 * Math.sin(i * Math.PI / 7), 0.035, 8, 32), lens);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = floorY + 0.58 + i * 0.12;
    group.add(ring);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), lens);
  core.position.y = floorY + 1;
  group.add(core);
  let climbing = false, released = false, descending = false;
  const view = new THREE.Vector3();
  function prompt(player, camera) {
    if (climbing) return "W/S to climb, Space to let go";
    const radial = player.feet.x * ox + player.feet.z * oz;
    const side = player.feet.x * oz - player.feet.z * ox;
    camera.getWorldDirection(view);
    if (player.feet.y >= floorY - 0.15 && player.feet.y < floorY + 0.3 && Math.hypot(player.feet.x - hx, player.feet.z - hz) < 1 && view.y < -0.2 && view.x * ox + view.z * oz > 0.2) return "Climb down";
    if (player.feet.y >= upperFloor - 0.2 && player.feet.y < upperFloor + 0.4 && Math.abs(side) < 0.5 && radial > 0.35 && radial < 1.4 && view.x * ox + view.z * oz > 0.35) return "Climb up";
    return "";
  }
  return {
    floorY, angle, doorAngle,
    reset() { climbing = false; released = false; descending = false; },
    prompt,
    interact(player, camera) {
      const label = prompt(player, camera);
      if (released) return;
      if (label === "Climb down") { climbing = true; descending = true; player.feet.y = floorY - 0.1; }
      else if (label === "Climb up") { climbing = true; descending = false; }
    },
    blocks(x, z) {
      const radius = Math.hypot(x, z);
      if (radius > 2.03) return true;
      const along = x * dx + z * dz;
      const sideways = Math.abs(x * dz - z * dx);
      // The doorway is the only crossing through the glazed wall.
      return radius > 0.88 && radius < 1.47 && !(along > 0 && sideways < 0.42);
    },
    update(player, forward, input, jump, dt, camera) {
      try {
        if (released && input === 0) released = false;
        if (climbing && jump) { climbing = false; released = true; player.grounded = false; return false; }
        if (!climbing && !released && input > 0) {
          const label = prompt(player, camera);
          if (label === "Climb up" && forward.x * ox + forward.z * oz > 0.45) { climbing = true; descending = false; }
          else if (label === "Climb down") { climbing = true; descending = true; player.feet.y = floorY - 0.1; }
        }
        if (!climbing) return false;
        player.feet.x = hx; player.feet.z = hz;
        const speed = descending && camera.getWorldDirection(view).y < -0.2 && input > 0 ? -1 : input;
        player.feet.y += speed * 1.7 * dt;
        player.velocityY = 0; player.grounded = false;
        if (player.feet.y >= floorY + 0.08) {
          player.feet.set(ox * 0.25, floorY, oz * 0.25);
          player.grounded = true; climbing = false; released = true;
        } else if (player.feet.y <= upperFloor) {
          player.feet.set(ox * 0.6, upperFloor, oz * 0.6);
          player.grounded = true; climbing = false; released = true;
        }
        return true;
      } catch (error) { console.warn("Gallery ladder update failed", error); climbing = false; return false; }
    },
    canLight(player, dayNight) {
      return !!dayNight && !dayNight.isLampLit() && dayNight.getDaylight() < 0.65 && player.feet.y >= floorY - 0.2 && Math.hypot(player.feet.x, player.feet.z) < 0.9;
    },
  };
}
