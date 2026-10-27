import * as THREE from "three";

// A little aluminium dinghy, in the dock's local frame. The high sides and
// shallow bottom leave the gunwales visible above the water as it bobs.
export function buildTinny(dock, groundTargets) {
  const group = new THREE.Group();
  group.name = "Tinny boat";
  group.position.set(-2.45, 0, dock.deckEnd - 0.2);
  group.scale.set(1.25, 1, 1.25);
  dock.group.add(group);

  const metal = new THREE.MeshStandardMaterial({
    color: 0x8b9691, roughness: 0.8, metalness: 0.22,
    flatShading: true, side: THREE.DoubleSide,
  });
  const inside = new THREE.MeshStandardMaterial({
    color: 0xa4aaa1, roughness: 1, metalness: 0,
    flatShading: true, side: THREE.DoubleSide,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: 0x806d50, roughness: 0.95, flatShading: true,
  });
  const add = (geometry, material, name) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Six-sided outline: broad square stern and a pointed bow, with a narrower
  // bottom so the sides flare out like folded sheet metal.
  const rim = [
    [-0.56, -1.12], [0.56, -1.12], [0.62, 0.55],
    [0.35, 1.04], [0, 1.22], [-0.35, 1.04], [-0.62, 0.55],
  ];
  const bottom = rim.map(([x, z]) => [x * 0.72, z * 0.82]);
  const vertices = [];
  for (let i = 0; i < rim.length; i += 1) {
    const next = (i + 1) % rim.length;
    const a = [rim[i][0], 0.27, rim[i][1]];
    const b = [rim[next][0], 0.27, rim[next][1]];
    const c = [bottom[next][0], -0.18, bottom[next][1]];
    const d = [bottom[i][0], -0.18, bottom[i][1]];
    vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  hullGeometry.computeVertexNormals();
  add(hullGeometry, metal, "Tinny hull");

  // Follow the flared hull at floor height. The small overlap closes gaps,
  // and the height keeps the interior dry throughout the rocking motion.
  const floorY = 0.12;
  const floorOutline = rim.map(([x, z], i) => [
    (bottom[i][0] + (x - bottom[i][0]) * (2 / 3)) * 1.01,
    (bottom[i][1] + (z - bottom[i][1]) * (2 / 3)) * 1.01,
  ]);
  const floorVertices = [];
  for (let i = 0; i < floorOutline.length; i += 1) {
    const next = (i + 1) % floorOutline.length;
    floorVertices.push(0, floorY, 0, floorOutline[i][0], floorY, floorOutline[i][1], floorOutline[next][0], floorY, floorOutline[next][1]);
  }
  const floorGeometry = new THREE.BufferGeometry();
  floorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(floorVertices, 3));
  floorGeometry.computeVertexNormals();
  groundTargets.push(add(floorGeometry, inside, "Tinny floor"));

  for (const [z, width] of [[-0.62, 1.10], [0.35, 1.17]]) {
    const seat = add(new THREE.BoxGeometry(width, 0.07, 0.24), wood, "Tinny bench");
    seat.position.set(0, 0.19, z);
    groundTargets.push(seat);
  }
  // A single wooden oar rests lengthwise across the two benches.
  const oar = new THREE.Group();
  oar.name = "Oar";
  oar.position.set(0.20, 0.25, 0);
  oar.rotation.y = -0.12;
  group.add(oar);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.65, 6), wood);
  shaft.rotation.x = Math.PI / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  oar.add(shaft);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.43), wood);
  blade.position.z = 0.95;
  blade.castShadow = true;
  blade.receiveShadow = true;
  oar.add(blade);
  for (let i = 0; i < rim.length; i += 1) {
    const next = (i + 1) % rim.length;
    const start = new THREE.Vector3(rim[i][0], 0.275, rim[i][1]);
    const end = new THREE.Vector3(rim[next][0], 0.275, rim[next][1]);
    const edge = add(new THREE.CylinderGeometry(0.025, 0.025, start.distanceTo(end), 5), metal, "Tinny rim");
    edge.position.copy(start).add(end).multiplyScalar(0.5);
    edge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  }

  const localFeet = new THREE.Vector3();
  const localNext = new THREE.Vector3();
  const insideFloor = (point) => {
    let inside = false;
    for (let i = 0, j = floorOutline.length - 1; i < floorOutline.length; j = i++) {
      const [xi, zi] = floorOutline[i];
      const [xj, zj] = floorOutline[j];
      if ((zi > point.z) !== (zj > point.z) &&
          point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };

  return {
    blocksExit(feet, x, z) {
      localFeet.copy(feet);
      group.worldToLocal(localFeet);
      localNext.set(x, feet.y, z);
      group.worldToLocal(localNext);
      return localFeet.y >= floorY - 0.1 && localFeet.y <= 0.4 &&
        insideFloor(localFeet) && !insideFloor(localNext);
    },
    update(elapsed) {
      group.position.y = Math.sin(elapsed * 1.15) * 0.035;
      group.rotation.z = Math.sin(elapsed * 0.8) * 0.025;
      group.rotation.x = Math.sin(elapsed * 0.65 + 1) * 0.018;
      group.updateWorldMatrix(true, true);
    },
  };
}
