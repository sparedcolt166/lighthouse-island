import * as THREE from "three";

export const LADDER_OFFSET = 2.05;

export function buildUpperRoom(scene, groundTargets, azimuth, floorY, ceilingY) {
  const angle = azimuth + LADDER_OFFSET;
  const outwardX = Math.sin(angle);
  const outwardZ = Math.cos(angle);
  const group = new THREE.Group();
  group.name = "Upper room";
  scene.add(group);
  const wood = new THREE.MeshStandardMaterial({ color: 0x765138, roughness: 0.9, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x473025, roughness: 0.9 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xcbb99d, roughness: 1, side: THREE.BackSide });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x69766d, roughness: 1 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xe5d8bb, roughness: 1 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc69b58, metalness: 0.6, roughness: 0.4 });
  function box(w, h, d, material, x, y, z, rotation = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // The opening sits inside the tapered wall, with enough room for the player.
  const hatchRadius = 1.12;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 1.73, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(outwardX * hatchRadius, -outwardZ * hatchRadius, 0.4, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), wood);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = ceilingY;
  floor.receiveShadow = true;
  group.add(floor);
  groundTargets.push(floor);

  // Narrow strips suggest plank seams without adding more floor collision meshes.
  const seam = new THREE.LineBasicMaterial({ color: 0x503828 });
  for (let x = -1.5; x <= 1.5; x += 0.3) {
    const points = [];
    const limit = Math.sqrt(1.7 * 1.7 - x * x);
    for (let z = -limit; z < limit; z += 0.06) {
      const next = Math.min(z + 0.06, limit);
      if (Math.hypot(x - outwardX * hatchRadius, z - outwardZ * hatchRadius) < 0.43 ||
          Math.hypot(x - outwardX * hatchRadius, next - outwardZ * hatchRadius) < 0.43) continue;
      points.push(x, ceilingY + 0.005, z, x, ceilingY + 0.005, next);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.LineSegments(geometry, seam));
  }

  // The room follows the tower taper and stays below the gallery.
  const windowAngle = azimuth - 0.25;
  const windowWidth = 0.5;
  function wallSection(bottom, top, start, length) {
    const lowerRadius = 1.73 - 0.16 * bottom / 3.1;
    const upperRadius = 1.73 - 0.16 * top / 3.1;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(upperRadius, lowerRadius, top - bottom, 40, 1, true, start, length), plaster);
    wall.position.y = ceilingY + (bottom + top) / 2;
    group.add(wall);
  }
  wallSection(0, 3.1, windowAngle + windowWidth / 2, Math.PI * 2 - windowWidth);
  wallSection(0, 1.2, windowAngle - windowWidth / 2, windowWidth);
  wallSection(2.15, 3.1, windowAngle - windowWidth / 2, windowWidth);
  const windowFrame = new THREE.Group();
  windowFrame.position.set(Math.sin(windowAngle) * 1.64, ceilingY + 1.675, Math.cos(windowAngle) * 1.64);
  windowFrame.rotation.y = windowAngle;
  group.add(windowFrame);
  for (const x of [-0.39, 0.39]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.02, 0.08), dark);
    post.position.x = x;
    windowFrame.add(post);
  }
  for (const y of [-0.48, 0, 0.48]) {
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.06, 0.08), dark);
    crossbar.position.y = y;
    windowFrame.add(crossbar);
  }
  const roof = new THREE.Mesh(new THREE.CircleGeometry(1.57, 40), wood);
  roof.position.y = ceilingY + 3.1;
  roof.rotation.x = Math.PI / 2;
  group.add(roof);

  const ladder = new THREE.Group();
  ladder.position.set(outwardX * 1.48, floorY, outwardZ * 1.48);
  ladder.rotation.y = angle;
  group.add(ladder);
  const railGeometry = new THREE.BoxGeometry(0.07, ceilingY - floorY + 0.45, 0.07);
  const rungGeometry = new THREE.BoxGeometry(0.54, 0.045, 0.05);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeometry, dark);
    rail.position.set(side * 0.25, (ceilingY - floorY + 0.45) / 2, 0);
    ladder.add(rail);
  }
  for (let y = 0.28; y < ceilingY - floorY + 0.35; y += 0.4) {
    const rung = new THREE.Mesh(rungGeometry, wood);
    rung.position.y = y;
    ladder.add(rung);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 6, 32), brass);
  ring.position.set(outwardX * hatchRadius, ceilingY + 0.01, outwardZ * hatchRadius);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Furniture is kept inside the curved wall and clear of the hatch.
  const furniture = new THREE.Group();
  furniture.rotation.y = angle;
  group.add(furniture);
  function furnishing(w, h, d, material, x, y, z) {
    const mesh = box(w, h, d, material, x, ceilingY + y, z);
    group.remove(mesh);
    furniture.add(mesh);
    return mesh;
  }
  // A compact lamp shelf leaves the center open for the card table.
  furnishing(0.42, 0.5, 0.35, dark, 1.05, 0.25, 0.15);
  const lamp = furnishing(0.12, 0.2, 0.12, brass, 1.05, 0.65, 0.15);
  const light = new THREE.PointLight(0xffbd70, 3, 6, 2);
  light.position.set(1.05, ceilingY + 0.85, 0.15);
  furniture.add(light);
  lamp.material = new THREE.MeshStandardMaterial({ color: 0xffc77b, emissive: 0xffa743, emissiveIntensity: 1.5 });

  const hatchX = outwardX * hatchRadius;
  const hatchZ = outwardZ * hatchRadius;
  let climbing = false;
  let released = false;
  let descending = false;
  const viewDirection = new THREE.Vector3();
  function prompt(player, camera) {
    if (climbing) return "W/S to climb, Space to let go";
    const radial = player.feet.x * outwardX + player.feet.z * outwardZ;
    const sideways = player.feet.x * outwardZ - player.feet.z * outwardX;
    const direction = viewDirection;
    camera.getWorldDirection(direction);
    if (player.feet.y >= ceilingY - 0.15 && player.feet.y < ceilingY + 0.3 &&
        Math.hypot(player.feet.x - hatchX, player.feet.z - hatchZ) < 1.05 &&
        direction.y < -0.2 && direction.x * outwardX + direction.z * outwardZ > 0.2) return "Climb down";
    if (player.feet.y < ceilingY - 0.4 && Math.abs(sideways) < 0.55 && radial > 0.65 && radial < 1.5) return "Climb the ladder";
    return "";
  }
  return {
    floorY, ceilingY,
    reset() { climbing = false; released = false; descending = false; },
    prompt,
    interact(player, camera) {
      const label = prompt(player, camera);
      if (label === "Climb down" && !released) { climbing = true; descending = true; player.feet.y = ceilingY - 0.1; }
      else if (label === "Climb the ladder" && !released) { climbing = true; descending = false; }
    },
    blocks(x, z, y) {
      if (y < ceilingY - 0.2) return false;
      const localX = x * Math.cos(angle) - z * Math.sin(angle);
      const localZ = x * Math.sin(angle) + z * Math.cos(angle);
      return Math.hypot(x, z) > 1.4 || Math.hypot(x - hatchX, z - hatchZ) < 0.65 ||
        (Math.abs(localX - 1.05) < 0.4 && Math.abs(localZ - 0.15) < 0.36) ||
        (Math.abs(localX) < 0.8 && localZ < -0.38);
    },
    update(player, forward, forwardInput, jump, dt, camera) {
      const radial = player.feet.x * outwardX + player.feet.z * outwardZ;
      const sideways = player.feet.x * outwardZ - player.feet.z * outwardX;
      const facing = forward.x * outwardX + forward.z * outwardZ;
      if (released && forwardInput === 0) released = false;
      if (climbing && jump) { climbing = false; released = true; player.grounded = false; return false; }
      if (!climbing && !released) {
        if (player.feet.y < ceilingY - 0.15 && Math.abs(sideways) < 0.38 && radial > 0.85 && radial < 1.5 && forwardInput > 0 && facing > 0.45) {
          climbing = true; descending = false;
        } else if (forwardInput > 0 && prompt(player, camera) === "Climb down") {
          climbing = true; descending = true; player.feet.y = ceilingY - 0.1;
        }
      }
      if (!climbing) return false;
      player.feet.x = hatchX;
      player.feet.z = hatchZ;
      const downInput = descending && camera.getWorldDirection(viewDirection).y < -0.2 && forwardInput > 0 ? -1 : forwardInput;
      player.feet.y += downInput * 1.7 * dt;
      player.velocityY = 0;
      player.grounded = false;
      if (player.feet.y >= ceilingY + 0.08) {
        player.feet.set(outwardX * 0.35, ceilingY, outwardZ * 0.35);
        player.grounded = true; climbing = false; released = true;
      } else if (player.feet.y <= floorY) {
        player.feet.y = floorY; climbing = false; released = true; player.grounded = true;
      }
      return true;
    },
  };
}
