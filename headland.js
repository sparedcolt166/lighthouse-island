import * as THREE from "three";

// The west-southwest shore is clear of the jetty and the northern sand island.
const CX = -23;
const CZ = -8;
const rock = new THREE.MeshStandardMaterial({ color: 0x77735d, roughness: 1, flatShading: true });
const wood = new THREE.MeshStandardMaterial({ color: 0x776249, roughness: 1 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x514536, roughness: 1 });
const stone = new THREE.MeshStandardMaterial({ color: 0x868578, roughness: 1, flatShading: true });
const grass = new THREE.MeshStandardMaterial({ color: 0x718052, roughness: 1, side: THREE.DoubleSide });

function height(x, z) {
  const r = Math.hypot((x - CX) / 10, (z - CZ) / 8);
  return r < 0.65 ? 1.55 + 0.12 * Math.cos((x - CX) * 0.4) : 1.55 - (r - 0.65) * 5;
}

export function buildHeadland(scene, groundTargets, colliders, sampleGround) {
  const group = new THREE.Group();
  group.name = "Keeper's headland";
  scene.add(group);
  const positions = [];
  const colors = [];
  const indices = [];
  const segments = 64;
  const rings = [0, 0.25, 0.5, 0.65, 0.8, 1, 1.15];
  for (const r of rings) {
    for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments;
      const irregular = 1 + 0.045 * Math.sin(5 * a) + 0.025 * Math.cos(9 * a);
      const x = CX + Math.cos(a) * 10 * r * irregular;
      const z = CZ + Math.sin(a) * 8 * r * irregular;
      const y = height(x, z);
      positions.push(x, y, z);
      const color = new THREE.Color(r > 0.8 ? 0xa99b7d : r > 0.65 ? 0x8d8971 : 0x777e60);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * segments + i, b = j * segments + (i + 1) % segments;
    indices.push(a, b, a + segments, b, b + segments, a + segments);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  terrain.name = "Headland terrain";
  terrain.receiveShadow = true;
  group.add(terrain);
  groundTargets.push(terrain);

  // Bury the first edge in the existing shore; its sampled heights avoid a step.
  const bridgePositions = [];
  const bridgeIndices = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = -8 - 11 * t, centerZ = -3 - 4 * t;
    for (let j = 0; j <= 8; j++) {
      const z = centerZ + (j / 8 - 0.5) * (4 + 3 * t);
      const startZ = -3 + (j / 8 - 0.5) * 4;
      const start = Math.max(1.1, sampleGround(-8, startZ) ?? 1.5);
      const endZ = -7 + (j / 8 - 0.5) * 7;
      const y = THREE.MathUtils.lerp(start - 0.08, height(-19, endZ) - 0.08, t);
      bridgePositions.push(x, y, z);
    }
  }
  for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) {
    const a = i * 9 + j, b = a + 9;
    bridgeIndices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const bridgeGeo = new THREE.BufferGeometry();
  bridgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(bridgePositions, 3));
  bridgeGeo.setIndex(bridgeIndices);
  bridgeGeo.computeVertexNormals();
  const bridge = new THREE.Mesh(bridgeGeo, new THREE.MeshStandardMaterial({ color: 0x85836b, roughness: 1, side: THREE.DoubleSide }));
  bridge.name = "Headland land bridge";
  bridge.receiveShadow = true;
  group.add(bridge);
  groundTargets.push(bridge);
  group.updateMatrixWorld(true);

  function box(x, y, z, w, h, d, material, parent = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(x, y, z, radius, h, material, parent = group) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 8), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // The shed is a solid prop; its framed door suggests storage without an interior.
  const sx = -23, sz = -8, sy = height(sx, sz);
  box(sx, sy + 1.25, sz, 3, 2.5, 2.4, wood);
  for (let i = 0; i < 7; i++) box(sx - 1.35 + i * 0.45, sy + 2.62, sz, 0.43, 0.15, 3, i % 2 ? wood : darkWood).rotation.x = -0.08;
  box(sx, sy + 1.05, sz + 1.22, 0.9, 2.1, 0.07, darkWood);
  for (const dx of [-0.52, 0.52]) box(sx + dx, sy + 1.1, sz + 1.27, 0.09, 2.2, 0.1, stone);
  box(sx, sy + 2.2, sz + 1.27, 1.13, 0.1, 0.1, stone);
  colliders.push({ x: sx, z: sz, radius: 1.75 });
  for (const [x, z] of [[-20.8, -8.3], [-20.9, -9.2]]) {
    const y = height(x, z);
    box(x, y + 0.35, z, 0.7, 0.7, 0.7, darkWood);
    colliders.push({ x, z, radius: 0.5 });
  }
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffcf77, emissive: 0xb86b20, emissiveIntensity: 0.8 });
  box(sx + 1.1, sy + 1.75, sz + 1.35, 0.24, 0.35, 0.2, lanternMat);
  box(sx + 1.1, sy + 1.96, sz + 1.35, 0.3, 0.06, 0.26, darkWood);

  const bx = -27, bz = -9, by = height(bx, bz);
  box(bx, by + 0.55, bz, 1.8, 0.14, 0.55, wood);
  box(bx, by + 1.02, bz + 0.26, 1.8, 0.8, 0.12, wood);
  for (const dx of [-0.7, 0.7]) box(bx + dx, by + 0.25, bz, 0.12, 0.5, 0.45, darkWood);
  colliders.push({ x: bx, z: bz, radius: 0.9 });
  const fx = -27, fz = -5, fy = height(fx, fz);
  cylinder(fx, fy + 2.3, fz, 0.07, 4.6, darkWood);
  colliders.push({ x: fx, z: fz, radius: 0.15 });
  const flagGeo = new THREE.PlaneGeometry(1.8, 0.9, 12, 3);
  flagGeo.translate(0.9, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: 0xb65c49, side: THREE.DoubleSide, roughness: 1 }));
  flag.position.set(fx, fy + 4.05, fz);
  group.add(flag);
  const initialFlag = flagGeo.attributes.position.array.slice();
  const cairnX = -30, cairnZ = -8, cairnY = height(cairnX, cairnZ);
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), stone);
    mesh.scale.set(0.7 - i * 0.12, 0.25, 0.55 - i * 0.09);
    mesh.position.set(cairnX + (i % 2) * 0.08, cairnY + 0.2 + i * 0.4, cairnZ);
    group.add(mesh);
  }
  colliders.push({ x: cairnX, z: cairnZ, radius: 0.7 });

  // Pebbles and small pools occupy the low southern cove above the sea surface.
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x559a99, roughness: 0.25, metalness: 0.1 });
  const coral = new THREE.MeshStandardMaterial({ color: 0xc67960, roughness: 1 });
  for (const [x, z, size] of [[-22, -12.4, 0.7], [-25, -12.2, 0.55], [-20, -11.5, 0.45]]) {
    const y = height(x, z);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(size, 20), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, y + 0.04, z);
    group.add(pool);
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5, radius = i % 2 ? 0.07 : 0.18;
      if (i === 0) starShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else starShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    starShape.closePath();
    const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape), coral);
    star.rotation.x = -Math.PI / 2;
    star.position.set(x + 0.12, y + 0.07, z);
    group.add(star);
  }
  const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 65; i++) {
    const x = -19 - (i * 1.73 % 9), z = -12 - ((i * 2.17) % 2);
    const y = height(x, z);
    if (y < 0.2) continue;
    const pebble = new THREE.Mesh(pebbleGeo, stone);
    const size = 0.07 + (i % 4) * 0.025;
    pebble.scale.set(size, size * 0.45, size * 0.8);
    pebble.position.set(x, y + 0.03, z);
    group.add(pebble);
  }
  const flower = new THREE.MeshStandardMaterial({ color: 0xe4d4a2, roughness: 1 });
  for (let i = 0; i < 45; i++) {
    const x = -18 - (i * 2.37 % 12), z = -4 - (i * 3.13 % 7);
    if (Math.hypot(x - sx, z - sz) < 2.4) continue;
    const y = height(x, z);
    if (y < 0.8) continue;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.36, 4), grass);
    tuft.position.set(x, y + 0.18, z);
    group.add(tuft);
    if (i % 3 === 0) {
      const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), flower);
      blossom.position.set(x, y + 0.38, z);
      group.add(blossom);
    }
  }
  return {
    update(elapsed) {
      try {
        const attr = flagGeo.attributes.position;
        for (let i = 0; i < attr.count; i++) {
          const x = initialFlag[i * 3];
          attr.setZ(i, Math.sin(elapsed * 3 + x * 3) * x * 0.09);
        }
        attr.needsUpdate = true;
        flagGeo.computeVertexNormals();
      } catch (error) {
        // A decorative flag must never stop the game loop.
      }
    },
  };
}
