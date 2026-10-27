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
  furnishing(0.72, 0.3, 1.65, dark, -1.05, 0.3, -0.15);
  furnishing(0.66, 0.16, 1.52, cloth, -1.05, 0.53, -0.15);
  furnishing(0.58, 0.12, 0.3, paper, -1.05, 0.67, -0.72);
  furnishing(0.78, 0.08, 0.48, wood, 0.9, 0.78, -0.65);
  for (const x of [0.58, 1.22]) for (const z of [-0.82, -0.48]) furnishing(0.06, 0.75, 0.06, dark, x, 0.38, z);
  furnishing(0.3, 0.035, 0.24, paper, 0.82, 0.84, -0.65);
  furnishing(0.65, 0.48, 0.42, dark, 0.85, 0.24, 0.35);
  furnishing(0.68, 0.06, 0.45, wood, 0.85, 0.51, 0.35);
  const lamp = furnishing(0.12, 0.2, 0.12, brass, 1.14, 0.92, -0.65);
  const light = new THREE.PointLight(0xffbd70, 3, 6, 2);
  light.position.set(1.14, ceilingY + 1.1, -0.65);
  furniture.add(light);
  lamp.material = new THREE.MeshStandardMaterial({ color: 0xffc77b, emissive: 0xffa743, emissiveIntensity: 1.5 });

  // The hatch is fenced off upstairs: the player faces the ladder when they
  // step off the top, so a held W would otherwise walk them straight back
  // down the hole. They climb down by backing onto the ladder with S instead.
  const hatchX = outwardX * hatchRadius;
  const hatchZ = outwardZ * hatchRadius;
  const hatchBlockRadius = 0.65;
  let climbing = false;
  let released = false;
  return {
    floorY, ceilingY,
    reset() { climbing = false; released = false; },
    blocks(x, z, y) {
      if (y < ceilingY - 0.2) return false;
      return Math.hypot(x, z) > 1.4 || Math.hypot(x - hatchX, z - hatchZ) < hatchBlockRadius;
    },
    update(player, forward, forwardInput, jump, dt) {
      const radial = player.feet.x * outwardX + player.feet.z * outwardZ;
      const sideways = player.feet.x * outwardZ - player.feet.z * outwardX;
      const facing = forward.x * outwardX + forward.z * outwardZ;
      const fromHatch = Math.hypot(player.feet.x - hatchX, player.feet.z - hatchZ);
      if (released && forwardInput === 0) released = false;
      if (climbing && jump) { climbing = false; released = true; player.grounded = false; return false; }
      if (!climbing && !released) {
        if (player.feet.y < ceilingY - 0.15 && Math.abs(sideways) < 0.38 && radial > 0.85 && radial < 1.5 &&
            forwardInput > 0 && facing > 0.45 ||
            player.feet.y >= ceilingY - 0.15 && player.feet.y < ceilingY + 0.2 && fromHatch < 0.95 &&
            forwardInput < 0 && facing < -0.3) {
          climbing = true;
          if (player.feet.y >= ceilingY - 0.15) player.feet.y = ceilingY - 0.1;
        }
      }
      if (!climbing) return false;
      player.feet.x = outwardX * hatchRadius;
      player.feet.z = outwardZ * hatchRadius;
      player.feet.y += forwardInput * 1.7 * dt;
      player.velocityY = 0;
      player.grounded = false;
      if (player.feet.y >= ceilingY + 0.08) {
        // Far enough in that the player clears the fenced hatch.
        player.feet.set(outwardX * 0.3, ceilingY, outwardZ * 0.3);
        player.grounded = true;
        climbing = false;
        released = true;
      } else if (player.feet.y <= floorY) {
        player.feet.y = floorY;
        climbing = false;
        released = true;
        player.grounded = true;
      }
      return true;
    },
  };
}
