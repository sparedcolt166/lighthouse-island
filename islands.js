import * as THREE from "three";

// The far shore is close enough to see from the jetty, with room to wade onto it.
// It sits 45 degrees round from the jetty's heading, off to the right of the
// view down the pier rather than straight ahead of it.
const ISLAND_X = 0;
const ISLAND_Z = 71;

function terrain(rings, segments, height, color) {
  const positions = [];
  const colors = [];
  const indices = [];
  const tint = new THREE.Color();
  for (let ring = 0; ring < rings.length; ring++) {
    for (let i = 0; i < segments; i++) {
      const angle = i * Math.PI * 2 / segments;
      const radius = rings[ring];
      const y = height(radius, angle, i);
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      tint.set(color(radius, y));
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < segments; i++) {
      const a = ring * segments + i;
      const b = ring * segments + (i + 1) % segments;
      const c = a + segments;
      const d = b + segments;
      indices.push(a, d, c, a, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

export function buildIslands(scene, groundTargets, colliders, sampleGround) {
  const segments = 96;
  const innerHeights = [];
  for (let i = 0; i < segments; i++) {
    const angle = i * Math.PI * 2 / segments;
    innerHeights.push(sampleGround(Math.cos(angle) * 7, Math.sin(angle) * 7) ?? 1.8);
  }
  // The inner edge is buried in the original rock; the outer rings slope into the sea.
  const extension = terrain([7, 9, 11, 13, 14], segments, (r, angle, i) => {
    const top = Math.max(1.3, innerHeights[i] - 0.08);
    if (r <= 9) return THREE.MathUtils.lerp(top, 1.55, (r - 7) / 2);
    if (r <= 13) return THREE.MathUtils.lerp(1.55, -0.18, (r - 9) / 4);
    return -0.18 - (r - 13) * 0.35;
  }, (r) => r < 9 ? 0x77735d : r < 11 ? 0x9c9072 : 0xb8a477);
  extension.name = "Extended island shore";
  scene.add(extension);
  groundTargets.push(extension);
  extension.updateMatrixWorld();

  const sand = terrain([0, 2, 4, 6, 8, 10, 12, 14], 64, (r) => {
    if (r <= 8) return 1.3 * (1 - r * r / 64);
    return -(r - 8);
  }, (r, y) => {
    const dry = new THREE.Color(0xd9c48d);
    const wet = new THREE.Color(0x988768);
    return dry.lerp(wet, THREE.MathUtils.clamp((0.65 - y) / 1.4, 0, 1));
  });
  sand.name = "Sandy island";
  sand.position.set(ISLAND_X, 0, ISLAND_Z);
  scene.add(sand);
  groundTargets.push(sand);
  sand.updateMatrixWorld();

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x806044, roughness: 1, flatShading: true });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x477b3e, roughness: 1, side: THREE.DoubleSide });
  const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.21, 1, 7);
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 0.32, -0.18, 0.9, 0, -0.65, 2.2,
    0, 0, 0, 0, -0.65, 2.2, -0.32, -0.18, 0.9,
  ], 3));
  leafGeometry.computeVertexNormals();
  const crowns = [];
  for (const [x, z, height, lean] of [[-2, -1, 5, 0.12], [1.5, 0.4, 5.8, -0.11], [0, 3, 4.6, 0.14], [3, -2.5, 5.2, -0.09]]) {
    const base = 1.3 * (1 - (x * x + z * z) / 64);
    const palm = new THREE.Group();
    palm.position.set(ISLAND_X + x, base, ISLAND_Z + z);
    scene.add(palm);
    const count = 6;
    for (let i = 0; i < count; i++) {
      const segment = new THREE.Mesh(trunkGeometry, trunkMaterial);
      segment.scale.y = height / count;
      segment.position.set(lean * height * (i + 0.5) * (i + 0.5) / (count * count), height * (i + 0.5) / count, 0);
      segment.rotation.z = -lean * (i + 0.5) / count * 2;
      segment.castShadow = true;
      palm.add(segment);
    }
    const crown = new THREE.Group();
    crown.position.set(lean * height, height, 0);
    palm.add(crown);
    for (let i = 0; i < 8; i++) {
      const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
      leaf.rotation.y = i * Math.PI / 4;
      crown.add(leaf);
    }
    crowns.push(crown);
    colliders.push({ x: ISLAND_X + x, z: ISLAND_Z + z, radius: 0.23 });
  }
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x77766a, roughness: 1, flatShading: true });
  const coconutGeometry = new THREE.SphereGeometry(0.17, 7, 5);
  const coconutMaterial = new THREE.MeshStandardMaterial({ color: 0x63432b, roughness: 1 });
  for (const [x, z, size] of [[-4, 1, 0.7], [3, 3.8, 0.5]]) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.scale.set(size, size * 0.6, size * 0.8);
    rock.position.set(ISLAND_X + x, 1.3 * (1 - (x * x + z * z) / 64), ISLAND_Z + z);
    scene.add(rock);
  }
  for (const [x, z] of [[-1.3, -1.5], [2, 0.8]]) {
    const coconut = new THREE.Mesh(coconutGeometry, coconutMaterial);
    coconut.position.set(ISLAND_X + x, 1.3 * (1 - (x * x + z * z) / 64) + 0.12, ISLAND_Z + z);
    scene.add(coconut);
  }
  return {
    update(elapsed) {
      for (let i = 0; i < crowns.length; i++) {
        crowns[i].rotation.z = Math.sin(elapsed * 0.8 + i) * 0.035;
        crowns[i].rotation.x = Math.sin(elapsed * 0.65 + i * 2) * 0.025;
      }
    },
  };
}
