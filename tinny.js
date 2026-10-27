import * as THREE from "three";

// A little aluminium dinghy, in the dock's local frame. The high sides and
// shallow bottom leave the gunwales visible above the water as it bobs.
export function buildTinny(dock) {
  const group = new THREE.Group();
  group.name = "Tinny boat";
  group.position.set(2.35, 0, dock.deckEnd - 0.2);
  dock.group.add(group);

  const metal = new THREE.MeshStandardMaterial({
    color: 0x8b9691, roughness: 0.8, metalness: 0.22,
    flatShading: true, side: THREE.DoubleSide,
  });
  const inside = new THREE.MeshStandardMaterial({
    color: 0x687772, roughness: 0.9, metalness: 0.1,
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

  const floorVertices = [];
  for (let i = 0; i < bottom.length; i += 1) {
    const next = (i + 1) % bottom.length;
    floorVertices.push(0, 0.05, 0, bottom[i][0], 0.05, bottom[i][1], bottom[next][0], 0.05, bottom[next][1]);
  }
  const floorGeometry = new THREE.BufferGeometry();
  floorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(floorVertices, 3));
  floorGeometry.computeVertexNormals();
  add(floorGeometry, inside, "Tinny floor");

  for (const z of [-0.62, 0.35]) {
    const seat = add(new THREE.BoxGeometry(0.94, 0.07, 0.24), wood, "Tinny bench");
    seat.position.set(0, 0.11, z);
  }
  for (let i = 0; i < rim.length; i += 1) {
    const next = (i + 1) % rim.length;
    const start = new THREE.Vector3(rim[i][0], 0.275, rim[i][1]);
    const end = new THREE.Vector3(rim[next][0], 0.275, rim[next][1]);
    const edge = add(new THREE.CylinderGeometry(0.025, 0.025, start.distanceTo(end), 5), metal, "Tinny rim");
    edge.position.copy(start).add(end).multiplyScalar(0.5);
    edge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  }

  return {
    update(elapsed) {
      group.position.y = Math.sin(elapsed * 1.15) * 0.035;
      group.rotation.z = Math.sin(elapsed * 0.8) * 0.025;
      group.rotation.x = Math.sin(elapsed * 0.65 + 1) * 0.018;
    },
  };
}
