import * as THREE from "three";

const random = (min, max) => min + Math.random() * (max - min);

export function buildWildlife(scene, sampleGround, splashSound) {
  const crabMat = new THREE.MeshStandardMaterial({ color: 0xc94d27, roughness: 0.85, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x262c2d, roughness: 0.8 });
  const crabBody = new THREE.SphereGeometry(0.16, 8, 5);
  const limbGeo = new THREE.BoxGeometry(0.19, 0.035, 0.035);
  const crabs = [];
  // Both rings are safely above the zero-height water surface.
  for (const [cx, cz, radius, angle] of [[0, 0, 11.3, 0.1], [0, 0, 11.3, 2.5], [0, 0, 11.3, 4.4], [0, 71, 5.7, 0.3], [0, 71, 5.7, 2.5], [0, 71, 5.7, 4.5]]) {
    const root = new THREE.Group();
    const body = new THREE.Mesh(crabBody, crabMat);
    body.scale.set(1.35, 0.55, 1);
    body.position.y = 0.12;
    root.add(body);
    const legs = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(limbGeo, crabMat);
        leg.position.set(side * 0.21, 0.08, (i - 1) * 0.1);
        root.add(leg);
        legs.push(leg);
      }
      const claw = new THREE.Mesh(crabBody, crabMat);
      claw.scale.set(0.55, 0.45, 0.55);
      claw.position.set(side * 0.24, 0.13, 0.2);
      root.add(claw);
      const eye = new THREE.Mesh(crabBody, darkMat);
      eye.scale.setScalar(0.12);
      eye.position.set(side * 0.08, 0.2, 0.12);
      root.add(eye);
    }
    const x = cx + Math.cos(angle) * radius, z = cz + Math.sin(angle) * radius;
    const y = sampleGround(x, z);
    if (y === null || y < 0.3) continue;
    root.position.set(x, y, z);
    scene.add(root);
    crabs.push({ root, legs, cx, cz, radius, angle, timer: random(1, 4), moving: false, hidden: 0, phase: random(0, 6) });
  }

  const fishGeo = new THREE.ConeGeometry(0.08, 0.42, 5);
  fishGeo.rotateX(Math.PI / 2);
  const fishMat = new THREE.MeshStandardMaterial({ color: 0xb9d3d2, metalness: 0.45, roughness: 0.38, flatShading: true });
  const fishCount = 30;
  const fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, fishCount);
  fishMesh.frustumCulled = false;
  scene.add(fishMesh);
  const fish = [];
  const centers = [[15, 17], [-18, 3], [8, 59]];
  for (let i = 0; i < fishCount; i++) {
    const center = centers[Math.floor(i / 10)];
    fish.push({ x: center[0] + random(-2, 2), z: center[1] + random(-2, 2), vx: random(-0.4, 0.4), vz: random(-0.4, 0.4), cx: center[0], cz: center[1], depth: random(-1.3, -0.55), phase: random(0, 6) });
  }
  const dummy = new THREE.Object3D();

  const dolphinMat = new THREE.MeshStandardMaterial({ color: 0x718e95, roughness: 0.65, flatShading: true });
  const dolphinBody = new THREE.SphereGeometry(1, 10, 6);
  const finGeo = new THREE.ConeGeometry(0.22, 0.55, 4);
  const pod = [];
  const splashMat = new THREE.MeshBasicMaterial({ color: 0xd9f6f4, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
  const ringGeo = new THREE.RingGeometry(0.7, 1, 16);
  for (let i = 0; i < 4; i++) {
    const root = new THREE.Group();
    const body = new THREE.Mesh(dolphinBody, dolphinMat);
    body.scale.set(0.42, 0.4, 1.25);
    root.add(body);
    const nose = new THREE.Mesh(dolphinBody, dolphinMat);
    nose.scale.set(0.16, 0.12, 0.42);
    nose.position.z = 1.13;
    root.add(nose);
    const fin = new THREE.Mesh(finGeo, dolphinMat);
    fin.position.set(0, 0.45, -0.1);
    root.add(fin);
    const tail = new THREE.Mesh(dolphinBody, dolphinMat);
    tail.scale.set(0.65, 0.07, 0.24);
    tail.position.z = -1.1;
    root.add(tail);
    root.visible = false;
    scene.add(root);
    const ring = new THREE.Mesh(ringGeo, splashMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    ring.visible = false;
    scene.add(ring);
    pod.push({ root, ring, sounded: false });
  }
  let podTimer = random(60, 180), podTime = -1, podCount = 0, podX = 0, podZ = 0, podAngle = 0;

  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x77766a, roughness: 1, flatShading: true }));
  rock.scale.set(1.15, 0.55, 0.8);
  rock.position.set(-6.4, 0.25, 71);
  scene.add(rock);
  const seal = new THREE.Group();
  const sealMat = new THREE.MeshStandardMaterial({ color: 0x706e67, roughness: 0.95, flatShading: true });
  const sealBody = new THREE.Mesh(dolphinBody, sealMat);
  sealBody.scale.set(0.42, 0.35, 0.95);
  seal.add(sealBody);
  const head = new THREE.Group();
  head.position.set(0, 0.12, 0.65);
  const headMesh = new THREE.Mesh(dolphinBody, sealMat);
  headMesh.scale.set(0.27, 0.25, 0.3);
  head.add(headMesh);
  const nose = new THREE.Mesh(dolphinBody, darkMat);
  nose.scale.setScalar(0.055);
  nose.position.set(0, 0.05, 0.28);
  head.add(nose);
  seal.add(head);
  for (const side of [-1, 1]) {
    const flipper = new THREE.Mesh(dolphinBody, sealMat);
    flipper.scale.set(0.34, 0.07, 0.18);
    flipper.position.set(side * 0.4, -0.17, -0.3);
    seal.add(flipper);
  }
  seal.position.set(-6.4, 0.85, 71);
  seal.rotation.y = -Math.PI / 2;
  scene.add(seal);
  let failed = false;
  return {
    update(dt, elapsed, feet, daylight) {
      if (failed) return;
      try {
        for (const crab of crabs) {
          const dx = feet.x - crab.root.position.x, dz = feet.z - crab.root.position.z;
          if (crab.hidden > 0) {
            crab.hidden -= dt;
            crab.root.visible = false;
            if (crab.hidden <= 0 && dx * dx + dz * dz > 16) crab.root.visible = true;
            else if (crab.hidden <= 0) crab.hidden = 1;
            continue;
          }
          if (dx * dx + dz * dz < 2.25) { crab.hidden = random(8, 15); crab.root.visible = false; continue; }
          crab.timer -= dt;
          if (crab.timer <= 0) { crab.moving = !crab.moving; crab.timer = crab.moving ? random(0.5, 1.5) : random(1, 4); }
          if (crab.moving) {
            const nextAngle = crab.angle + dt * 0.06;
            const x = crab.cx + Math.cos(nextAngle) * crab.radius, z = crab.cz + Math.sin(nextAngle) * crab.radius;
            const y = sampleGround(x, z);
            if (y !== null && y > 0.3) { crab.angle = nextAngle; crab.root.position.set(x, y, z); }
            crab.root.rotation.y = -crab.angle;
          }
          for (let i = 0; i < crab.legs.length; i++) crab.legs[i].rotation.y = crab.moving ? Math.sin(elapsed * 15 + i * 2 + crab.phase) * 0.5 : 0;
        }
        for (let i = 0; i < fish.length; i++) {
          const f = fish[i];
          let ax = (f.cx - f.x) * 0.12, az = (f.cz - f.z) * 0.12, avx = 0, avz = 0, nx = 0, nz = 0, count = 0;
          const start = Math.floor(i / 10) * 10;
          for (let j = start; j < start + 10; j++) {
            if (i === j) continue;
            const other = fish[j], dx = other.x - f.x, dz = other.z - f.z, d2 = dx * dx + dz * dz;
            if (d2 < 9) { nx += dx; nz += dz; avx += other.vx; avz += other.vz; count++; if (d2 < 0.3) { ax -= dx * 2; az -= dz * 2; } }
          }
          if (count) { ax += nx / count * 0.15 + (avx / count - f.vx) * 0.7; az += nz / count * 0.15 + (avz / count - f.vz) * 0.7; }
          const px = f.x - feet.x, pz = f.z - feet.z, pd = px * px + pz * pz;
          if (feet.y < 0 && pd < 16 && pd > 0.001) { ax += px * 3 / pd; az += pz * 3 / pd; }
          f.vx += ax * dt; f.vz += az * dt;
          const speed = Math.hypot(f.vx, f.vz) || 1, target = Math.min(1.5, Math.max(0.45, speed));
          f.vx *= target / speed; f.vz *= target / speed;
          f.x += f.vx * dt; f.z += f.vz * dt;
          dummy.position.set(f.x, f.depth + Math.sin(elapsed * 2 + f.phase) * 0.07, f.z);
          dummy.rotation.set(0, Math.atan2(-f.vx, -f.vz), 0);
          dummy.updateMatrix(); fishMesh.setMatrixAt(i, dummy.matrix);
        }
        fishMesh.instanceMatrix.needsUpdate = true;
        if (podTime < 0) {
          podTimer -= dt * (daylight < 0.3 ? 0.4 : 1);
          if (podTimer <= 0) { podTime = 0; podCount = Math.floor(random(2, 5)); podAngle = random(0, Math.PI * 2); const a = random(Math.PI, Math.PI * 2); podX = Math.cos(a) * 55; podZ = Math.sin(a) * 55; for (const d of pod) d.sounded = false; }
        } else {
          podTime += dt;
          for (let i = 0; i < pod.length; i++) {
            const d = pod[i], t = podTime - i * 0.45;
            d.root.visible = i < podCount && t >= 0 && t < 3;
            d.ring.visible = i < podCount && t >= 2.5 && t < 3.8;
            if (d.root.visible) {
              const along = (t - 1.5) * 4, across = (i - 1.5) * 2.5;
              d.root.position.set(podX + Math.sin(podAngle) * along + Math.cos(podAngle) * across, -0.5 + Math.sin(t / 3 * Math.PI) * 3, podZ + Math.cos(podAngle) * along - Math.sin(podAngle) * across);
              d.root.rotation.set(Math.cos(t / 3 * Math.PI) * 0.65, podAngle, 0);
            }
            if (d.ring.visible) {
              if (!d.sounded) { d.sounded = true; splashSound(d.root.position); }
              d.ring.position.set(d.root.position.x, 0.025, d.root.position.z);
              d.ring.scale.setScalar(0.5 + (t - 2.5) * 1.4);
            }
          }
          if (podTime > 5.5) { podTime = -1; podTimer = random(60, 180); }
        }
        head.rotation.x = -0.18 - Math.max(0, Math.sin(elapsed * 0.19)) * 0.35;
        seal.rotation.z = Math.sin(elapsed * 0.27) * 0.09;
      } catch (error) { failed = true; console.warn("Wildlife stopped updating", error); }
    },
  };
}
