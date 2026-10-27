import * as THREE from "three";

// The shore is roughly 10 m from the centre; these rings keep the beach clear.
const SHORE_RADIUS = 10;
const SHORE_DEPTH = 0.18;
const MID_RADIUS = SHORE_RADIUS + 8;
const MID_DEPTH = 2;
const DEEP_RADIUS = 35;
const DEEP_DEPTH = 6;
const SEABED_RADIUS = 56;
const BOUNDARY_START = 40;
const BOUNDARY_STRENGTH = 1.8;
const WAIST_DEPTH = 0.85;
const WAIST_SPEED = 0.6;
const DEEP_SPEED = 0.45;
const WATER_JUMP = 0.35;
const UNDERWATER_FOG_COLOR = 0x164b56;
const UNDERWATER_FOG_NEAR = 1;
const UNDERWATER_FOG_FAR = 22;
const SURFACE_HYSTERESIS = 0.12;

function seabedHeight(radius) {
  if (radius <= SHORE_RADIUS) return -SHORE_DEPTH;
  if (radius <= MID_RADIUS) {
    return -THREE.MathUtils.lerp(SHORE_DEPTH, MID_DEPTH, (radius - SHORE_RADIUS) / (MID_RADIUS - SHORE_RADIUS));
  }
  if (radius <= DEEP_RADIUS) {
    return -THREE.MathUtils.lerp(MID_DEPTH, DEEP_DEPTH, (radius - MID_RADIUS) / (DEEP_RADIUS - MID_RADIUS));
  }
  return -DEEP_DEPTH;
}

function makeSeabed() {
  const segments = 96;
  // Extra rings make the shallow slope gradual without adding a dense mesh.
  const rings = [0, 4, 8, 10, 12, 14, 16, 18, 22, 26, 30, 35, 45, SEABED_RADIUS];
  const positions = [];
  const indices = [];
  for (const radius of rings) {
    for (let i = 0; i < segments; i++) {
      const angle = i * Math.PI * 2 / segments;
      positions.push(Math.cos(angle) * radius, seabedHeight(radius), Math.sin(angle) * radius);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = ring * segments + i;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + i;
      const d = (ring + 1) * segments + next;
      indices.push(a, d, c, a, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0xb8a477, roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Sandy seabed";
  mesh.receiveShadow = true;
  return mesh;
}

export function createWaterSystem(scene, groundTargets) {
  const seabed = makeSeabed();
  scene.add(seabed);
  groundTargets.push(seabed);
  seabed.updateMatrixWorld();

  const aboveFog = scene.fog;
  const underwaterFog = new THREE.Fog(UNDERWATER_FOG_COLOR, UNDERWATER_FOG_NEAR, UNDERWATER_FOG_FAR);
  const tint = document.createElement("div");
  Object.assign(tint.style, {
    position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2",
    background: "rgba(4, 48, 56, 0.34)", opacity: "0", transition: "opacity 0.2s",
  });
  document.body.appendChild(tint);
  let underwater = false;
  let time = 0;

  return {
    speedFactor(feetY) {
      const depth = Math.max(0, -feetY);
      if (depth <= WAIST_DEPTH) return THREE.MathUtils.lerp(1, WAIST_SPEED, depth / WAIST_DEPTH);
      return THREE.MathUtils.lerp(WAIST_SPEED, DEEP_SPEED, THREE.MathUtils.clamp((depth - WAIST_DEPTH) / 1.5, 0, 1));
    },
    jumpFactor(feetY) {
      return THREE.MathUtils.lerp(1, WATER_JUMP, THREE.MathUtils.clamp(-feetY / WAIST_DEPTH, 0, 1));
    },
    surfaceBob(feetY, eyeHeight) {
      const head = feetY + eyeHeight;
      const nearSurface = 1 - THREE.MathUtils.clamp(Math.abs(head) / 0.6, 0, 1);
      return Math.sin(time * 2.2) * 0.035 * nearSurface;
    },
    boundaryPush(x, z, dt) {
      const radius = Math.hypot(x, z);
      const push = Math.max(0, radius - BOUNDARY_START) * BOUNDARY_STRENGTH * dt;
      return radius ? { x: -x / radius * push, z: -z / radius * push } : { x: 0, z: 0 };
    },
    update(cameraY, dt) {
      time += dt;
      // Separate entry and exit thresholds prevent the look flickering at y = 0.
      if (!underwater && cameraY < -SURFACE_HYSTERESIS) underwater = true;
      else if (underwater && cameraY > SURFACE_HYSTERESIS) underwater = false;
      scene.fog = underwater ? underwaterFog : aboveFog;
      tint.style.opacity = underwater ? "1" : "0";
    },
  };
}
