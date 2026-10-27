import * as THREE from "three";

// Animation tuning: speeds are radians/second, distances are metres.
const TUNING = {
  breathSpeed: 1.65,
  breathDepth: 0.045,
  sighInterval: 9.5,
  sighDuration: 3.0,
  legSpeed: 1.45,
  legSwing: 0.16,
  idleMin: 6,
  idleMax: 15,
  idleDuration: 3.2,
  lookDistance: 4,
  lookEase: 2.2,
  rodAngle: 1.2,
  rodSway: 0.035,
  floatBob: 0.035,
};

export function buildFisherman(dock, colliders) {
  const material = (color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.93, flatShading: true,
  });
  const coat = material(0xb39a49);
  const trousers = material(0x454b4b);
  const skin = material(0xc89572);
  const beard = material(0x777063);
  const hat = material(0x706e52);
  const boots = material(0x343b39);
  const rodMaterial = material(0x5c4933);
  const red = material(0xa94b3e);
  const white = material(0xd4c5a5);
  const sphere = new THREE.SphereGeometry(1, 8, 6);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 7);
  const mesh = (parent, geometry, mat, position, scale) => {
    const part = new THREE.Mesh(geometry, mat);
    part.position.set(...position);
    part.scale.set(...scale);
    part.castShadow = true;
    part.receiveShadow = true;
    parent.add(part);
    return part;
  };
  const joint = (parent, x, y, z) => {
    const result = new THREE.Group();
    result.position.set(x, y, z);
    parent.add(result);
    return result;
  };

  // Pick the side opposite the barrels; the hips rest on the deck surface.
  const barrelX = dock.barrelPositions.reduce((sum, p) => sum + p.x, 0);
  const x = barrelX >= 0 ? -0.58 : 0.58;
  const hips = joint(dock.group, x, dock.deckY, dock.deckEnd - 0.31);
  hips.name = "Fisherman";
  mesh(hips, sphere, trousers, [0, 0.13, 0], [0.32, 0.14, 0.25]);
  const torso = joint(hips, 0, 0.21, -0.02);
  mesh(torso, sphere, coat, [0, 0.33, 0], [0.31, 0.37, 0.24]);
  const belly = mesh(torso, sphere, coat, [0, 0.24, 0.15], [0.28, 0.24, 0.20]);
  const head = joint(torso, 0, 0.68, 0);
  mesh(head, sphere, skin, [0, 0.23, 0], [0.25, 0.26, 0.24]);
  mesh(head, sphere, beard, [0, 0.12, 0.14], [0.22, 0.15, 0.15]);
  mesh(head, sphere, skin, [0, 0.25, 0.23], [0.075, 0.08, 0.10]);
  for (const side of [-1, 1]) {
    mesh(head, sphere, boots, [side * 0.09, 0.29, 0.213], [0.022, 0.025, 0.015]);
  }
  const hatJoint = joint(head, 0, 0.43, 0);
  mesh(hatJoint, cylinder, hat, [0, 0.06, 0], [0.24, 0.16, 0.24]);
  mesh(hatJoint, cylinder, hat, [0, -0.015, 0], [0.30, 0.045, 0.30]);

  const legs = [];
  for (const side of [-1, 1]) {
    const upper = joint(hips, side * 0.17, 0.12, 0.04);
    mesh(upper, box, trousers, [0, 0, 0.16], [0.22, 0.20, 0.38]);
    const lower = joint(upper, 0, 0, 0.34);
    mesh(lower, box, trousers, [0, -0.18, 0], [0.18, 0.38, 0.18]);
    const boot = joint(lower, 0, -0.38, 0);
    mesh(boot, box, boots, [0, -0.04, 0.055], [0.21, 0.16, 0.30]);
    legs.push(lower);
  }

  // The rod and hands share a moving grip; each arm is a two-joint puppet.
  const rod = joint(torso, 0, 0.38, 0.37);
  rod.rotation.x = TUNING.rodAngle;
  mesh(rod, cylinder, rodMaterial, [0, 0.98, 0], [0.022, 2.25, 0.022]);
  const tip = joint(rod, 0, 2.105, 0);
  const grips = [-0.07, 0.24].map((y) => joint(rod, 0, y, 0));
  const arms = [-1, 1].map((side) => {
    const shoulder = joint(torso, side * 0.28, 0.54, 0);
    const upperMesh = mesh(shoulder, cylinder, coat, [0, -0.14, 0], [0.105, 0.28, 0.105]);
    const elbow = joint(shoulder, 0, -0.28, 0);
    const lowerMesh = mesh(elbow, cylinder, coat, [0, -0.13, 0], [0.09, 0.26, 0.09]);
    const hand = joint(elbow, 0, -0.26, 0);
    mesh(hand, sphere, skin, [0, 0, 0], [0.115, 0.11, 0.11]);
    return { shoulder, upperMesh, elbow, lowerMesh, hand, side };
  });
  const float = joint(dock.group, x, 0, dock.deckEnd + 3.1);
  mesh(float, sphere, white, [0, 0.035, 0], [0.10, 0.12, 0.10]);
  mesh(float, sphere, red, [0, 0.11, 0], [0.085, 0.075, 0.085]);
  const lineGeometry = new THREE.BufferGeometry();
  const linePositions = new Float32Array(3 * 13);
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xb8ad92 }));
  line.frustumCulled = false;
  dock.group.add(line);

  dock.group.updateMatrixWorld(true);
  const world = dock.group.localToWorld(new THREE.Vector3(x, dock.deckY, dock.deckEnd - 0.31));
  colliders.push({ x: world.x, z: world.z, radius: 0.38 });

  let seed = 0x8a31b;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const nextDelay = () => TUNING.idleMin + random() * (TUNING.idleMax - TUNING.idleMin);
  let nextIdle = nextDelay();
  let idleStart = -100;
  let idleType = 0;
  let look = 0;
  const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const envelope = (t) => smooth(t / 0.22) * (1 - smooth((t - 0.72) / 0.28));
  const up = new THREE.Vector3(0, -1, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const playerLocal = new THREE.Vector3();
  const orient = (jointPart, meshPart, endpoint) => {
    const length = endpoint.length();
    jointPart.quaternion.setFromUnitVectors(up, endpoint.normalize());
    meshPart.position.y = -length / 2;
    meshPart.scale.y = length;
    return length;
  };

  function update(delta, elapsed, playerPosition) {
    if (elapsed >= nextIdle) {
      idleStart = elapsed;
      idleType = Math.floor(random() * 4);
      nextIdle = elapsed + nextDelay();
    }
    const progress = (elapsed - idleStart) / TUNING.idleDuration;
    const idle = progress >= 0 && progress <= 1 ? envelope(progress) : 0;
    const sighPhase = (elapsed % TUNING.sighInterval) / TUNING.sighDuration;
    const sigh = sighPhase <= 1 ? envelope(sighPhase) : 0;
    const breath = Math.sin(elapsed * TUNING.breathSpeed);
    torso.scale.set(1 + breath * TUNING.breathDepth, 1 + breath * TUNING.breathDepth * 0.5, 1 + breath * TUNING.breathDepth);
    belly.scale.z = 0.20 * (1 + breath * TUNING.breathDepth * 2 + sigh * 0.06);
    torso.position.y = 0.21 + breath * 0.012 - sigh * 0.035;
    head.position.y = 0.68 + breath * 0.014 - sigh * 0.025;
    head.rotation.x = sigh * 0.16 + (idleType === 1 ? -0.32 * idle : 0);
    playerLocal.copy(playerPosition);
    dock.group.worldToLocal(playerLocal);
    const dx = playerLocal.x - x;
    const dz = playerLocal.z - (dock.deckEnd - 0.31);
    const near = Math.hypot(dx, dz) < TUNING.lookDistance;
    const targetLook = near ? THREE.MathUtils.clamp(Math.atan2(dx, dz), -2.5, 2.5) : (idleType === 0 ? idle * 0.65 : 0);
    look = THREE.MathUtils.damp(look, targetLook, TUNING.lookEase, delta);
    head.rotation.y = look;
    legs.forEach((leg, index) => { leg.rotation.x = Math.sin(elapsed * TUNING.legSpeed + index * 1.3) * TUNING.legSwing; });
    const nibble = idleType === 3 ? idle * Math.sin(Math.PI * smooth((progress - 0.32) / 0.35)) : 0;
    rod.rotation.x = TUNING.rodAngle + Math.sin(elapsed * 0.7) * TUNING.rodSway - nibble * 0.30;
    rod.rotation.z = Math.sin(elapsed * 0.5) * TUNING.rodSway;
    float.position.y = Math.sin(elapsed * 1.5) * TUNING.floatBob - (idleType === 3 ? idle * Math.pow(Math.sin(progress * Math.PI * 4), 8) * 0.09 : 0);

    torso.updateWorldMatrix(true, true);
    arms.forEach((arm, index) => {
      grips[index].getWorldPosition(a);
      torso.worldToLocal(a);
      if (index === 1 && idleType === 2) a.lerp(c.set(0.22, 0.92, 0.16), idle);
      if (index === 1 && idleType === 1) a.lerp(c.set(0.55, 0.85, 0.30), idle);
      b.set(arm.side * 0.36, 0.30, 0.20).lerp(a, 0.25);
      const shoulderPos = arm.shoulder.position;
      const upperLength = orient(arm.shoulder, arm.upperMesh, c.copy(b).sub(shoulderPos));
      arm.elbow.position.set(0, -upperLength, 0);
      arm.shoulder.updateWorldMatrix(true, true);
      c.copy(a);
      torso.localToWorld(c);
      arm.shoulder.worldToLocal(c);
      c.sub(arm.elbow.position);
      const lowerLength = orient(arm.elbow, arm.lowerMesh, c);
      arm.hand.position.set(0, -lowerLength, 0);
    });
    tip.getWorldPosition(a);
    dock.group.worldToLocal(a);
    b.copy(float.position).add(c.set(0, 0.17, 0));
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      c.copy(a).lerp(b, t);
      c.y -= Math.sin(Math.PI * t) * 0.14;
      linePositions.set([c.x, c.y, c.z], i * 3);
    }
    lineGeometry.attributes.position.needsUpdate = true;
  }
  return { update };
}
