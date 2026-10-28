import * as THREE from "three";

// A little aluminium dinghy, in the dock's local frame. The high sides and
// shallow bottom leave the gunwales visible above the water as it bobs.
export function buildTinny(dock, groundTargets, sea, solidAt) {
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
  // Pivot each oar at the gunwale so the blades sweep and lift together.
  const oars = [];
  const shaftGeometry = new THREE.CylinderGeometry(0.025, 0.03, 1.7, 6);
  const bladeGeometry = new THREE.BoxGeometry(0.43, 0.035, 0.17);
  for (const side of [-1, 1]) {
    const oar = new THREE.Group();
    oar.position.set(side * 0.58, 0.28, 0.05);
    group.add(oar);
    const shaft = new THREE.Mesh(shaftGeometry, wood);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = side * 0.55;
    oar.add(shaft);
    const blade = new THREE.Mesh(bladeGeometry, wood);
    blade.position.x = side * 1.4;
    oar.add(blade);
    oars.push(oar);
  }
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

  const terrainTargets = groundTargets.filter((target) => {
    let parent = target;
    while (parent) {
      if (parent === dock.group) return false;
      parent = parent.parent;
    }
    return true;
  });
  const exitTargets = groundTargets.filter((target) => target.parent !== group);
  const ray = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const point = new THREE.Vector3();
  const dockPoint = new THREE.Vector3();
  const pushTarget = new THREE.Vector3();
  const world = new THREE.Vector3();
  const seat = new THREE.Vector3();
  let rowing = false;
  let speed = 0;
  let turnSpeed = 0;
  let stroke = 0;
  const groundAt = (x, z, targets) => {
    ray.set(rayOrigin.set(x, 20, z), down);
    ray.far = 60;
    const hits = ray.intersectObjects(targets, false);
    return hits.length ? hits[0].point.y : null;
  };
  const hullSamples = [[0, 0], [-0.7, -1.25], [0.7, -1.25], [-0.7, 0.7], [0.7, 0.7], [0, 1.5]];
  const blocked = (x, z, angle) => {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    // The hull's footprint catches shore and dock before its centre does.
    for (const [side, along] of hullSamples) {
      point.set(x + side * cos + along * sin, 0, z - side * sin + along * cos);
      dock.group.localToWorld(point);
      if ((groundAt(point.x, point.z, terrainTargets) ?? -10) > 0) return true;
      dockPoint.copy(point);
      dock.group.worldToLocal(dockPoint);
      if (Math.abs(dockPoint.x) < 1.4 && dockPoint.z > -0.25 && dockPoint.z < dock.deckEnd) return true;
    }
    return false;
  };
  const placeSeated = (player, camera) => {
    seat.set(0, 0.19, 0.35);
    group.localToWorld(seat);
    player.feet.copy(seat);
    player.velocityY = 0;
    player.grounded = true;
    player.eyeY = seat.y + 0.85;
    camera.position.set(seat.x, player.eyeY, seat.z);
  };

  return {
    group,
    canInteract(camera) {
      if (rowing) return true;
      group.getWorldPosition(world);
      return Math.hypot(camera.position.x - world.x, camera.position.z - world.z) < 2.7 &&
        Math.abs(camera.position.y - world.y) < 3;
    },
    interact(player, camera) {
      if (!rowing) {
        rowing = true;
        placeSeated(player, camera);
        return;
      }
      group.getWorldPosition(world);
      let best = null;
      // Prefer a nearby dry landing; otherwise step into the water beside the hull.
      // The hull stops a few metres short of a sloping beach, so search out to
      // ~4.7 m and accept knee-deep shallows as well as dry sand.
      for (let radius = 1.3; radius <= 4.7; radius += 0.4) {
        for (let i = 0; i < 16; i++) {
          const angle = i * Math.PI / 8;
          const x = world.x + Math.sin(angle) * radius;
          const z = world.z + Math.cos(angle) * radius;
          const y = groundAt(x, z, exitTargets);
          if (y !== null && y >= -0.5 && y < 1.5 && !solidAt(x, z)) {
            best = { x, y, z };
            break;
          }
        }
        if (best) break;
      }
      if (!best) {
        point.set(-1.3, 0, 0);
        group.localToWorld(point);
        best = { x: point.x, y: -0.5, z: point.z };
      }
      rowing = false;
      player.feet.set(best.x, best.y, best.z);
      player.velocityY = 0;
      player.grounded = best.y >= -0.5;
      player.eyeY = best.y + 1.65;
      camera.position.set(best.x, player.eyeY, best.z);
    },
    isRowing() { return rowing; },
    reset() { rowing = false; speed = 0; turnSpeed = 0; },
    updateRowing(player, camera, forwardInput, sideInput, dt) {
      if (!rowing) return false;
      try {
        speed = THREE.MathUtils.clamp(speed + forwardInput * 1.5 * dt, -1.8, 3.2);
        speed *= Math.exp(-0.42 * dt);
        turnSpeed += (sideInput * 1.8 - turnSpeed * 2.3) * dt;
        const angle = group.rotation.y + turnSpeed * dt;
        if (!blocked(group.position.x, group.position.z, angle)) group.rotation.y = angle;
        else turnSpeed *= 0.5;
        const dx = Math.sin(group.rotation.y) * speed * dt;
        const dz = Math.cos(group.rotation.y) * speed * dt;
        if (!blocked(group.position.x + dx, group.position.z, group.rotation.y)) group.position.x += dx;
        else speed *= 0.5;
        if (!blocked(group.position.x, group.position.z + dz, group.rotation.y)) group.position.z += dz;
        else speed *= 0.5;
        group.getWorldPosition(world);
        const push = sea.boundaryPush(world.x, world.z, dt);
        // blocked() reuses `point` for its hull samples, so the pushed
        // position needs its own vector or the boat lands on a sample.
        pushTarget.set(world.x + push.x, world.y, world.z + push.z);
        dock.group.worldToLocal(pushTarget);
        if (!blocked(pushTarget.x, pushTarget.z, group.rotation.y)) {
          group.position.x = pushTarget.x;
          group.position.z = pushTarget.z;
        }
        if (forwardInput || sideInput) stroke += dt * 5;
        const sweep = (forwardInput || sideInput) ? Math.sin(stroke) : 0;
        oars[0].rotation.y = sweep * 0.35;
        oars[1].rotation.y = -sweep * 0.35;
        const dip = (forwardInput || sideInput) ? Math.max(0, Math.sin(stroke)) * 0.18 : 0;
        oars[0].rotation.z = -dip;
        oars[1].rotation.z = dip;
        group.updateWorldMatrix(true, true);
        placeSeated(player, camera);
      } catch (error) {
        console.error("Tinny rowing update failed", error);
        rowing = false;
      }
      return true;
    },
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
