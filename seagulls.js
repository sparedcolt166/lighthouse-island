import * as THREE from "three";

// ---------------------------------------------------------------------------
// A few gulls that circle the island and now and then perch on the gallery rail
// ---------------------------------------------------------------------------
//
// Each gull is always in one of four states:
//   circling  looping the island on its own slowly wobbling orbit
//   landing   following a curve from its orbit down onto the top rail
//   perched   standing on the rail, looking about
//   takeoff   following a curve from the rail back out to its orbit
// Distances are metres in world space, times are seconds, angles radians.

const TUNING = {
  count: 3,
  scale: 1.15,
  orbitRadiusMin: 8,
  orbitRadiusMax: 17,
  orbitHeightMin: 13,
  orbitHeightMax: 25,
  flySpeed: 5.2,
  landSpeed: 4.2,
  takeoffSpeed: 4.6,
  circleMin: 12,
  circleMax: 30,
  perchMin: 8,
  perchMax: 20,
  // Two gulls never share a stretch of rail narrower than this.
  perchSpacing: 0.75,
  // A gull leaves the rail if the player gets this close.
  spookDistance: 2.6,
  flapSpeed: 10,
  flapAmount: 0.7,
  bank: 0.4,
};

const UP = new THREE.Vector3(0, 1, 0);

function findRailing(model) {
  const byName = (name) =>
    model.getObjectByName(name) ?? model.getObjectByName(name.replace(/ /g, "_"));
  const top = byName("Railing Top");
  const post = byName("Railing Post 1");

  // Fallback numbers come from the Blender scene at the game's 2.5x scale.
  const rail = { center: new THREE.Vector3(0, 0, 0), radius: 2.26, topY: 18.9 };
  if (top) {
    const box = new THREE.Box3().setFromObject(top);
    box.getCenter(rail.center);
    rail.topY = box.max.y;
  }
  if (post) {
    const p = post.getWorldPosition(new THREE.Vector3());
    rail.radius = Math.hypot(p.x - rail.center.x, p.z - rail.center.z);
  }
  rail.center.y = 0;
  return rail;
}

function buildGull(materials) {
  const sphere = new THREE.SphereGeometry(1, 7, 5);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 5);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 5);
  const part = (parent, geometry, material, position, scale, rotation) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Built facing +Z with the origin between the feet, so a perched gull's
  // position is simply the point on the rail it stands on.
  const root = new THREE.Group();
  root.name = "Seagull";
  part(root, sphere, materials.white, [0, 0.14, 0], [0.085, 0.08, 0.2]);
  part(root, sphere, materials.grey, [0, 0.175, -0.03], [0.075, 0.04, 0.16]);
  part(root, box, materials.grey, [0, 0.15, -0.22], [0.1, 0.02, 0.1]);

  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.15);
  root.add(head);
  part(head, sphere, materials.white, [0, 0.025, 0.01], [0.06, 0.06, 0.065]);
  part(head, cone, materials.beak, [0, 0.015, 0.09], [0.017, 0.07, 0.017], [Math.PI / 2, 0, 0]);
  part(head, sphere, materials.eye, [0.04, 0.04, 0.04], [0.009, 0.009, 0.009]);
  part(head, sphere, materials.eye, [-0.04, 0.04, 0.04], [0.009, 0.009, 0.009]);

  // Three-jointed wings so they can both flap and fold flat along the back:
  // inner wing back, forearm forward over it, black tip back again.
  const wings = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.065, 0.17, 0.03);
    // Roll about the span first, then flap, then fold back, so a folded wing
    // stands upright against the flank instead of lying flat like a shelf.
    shoulder.rotation.order = "YZX";
    root.add(shoulder);
    part(shoulder, box, materials.grey, [side * 0.12, 0, 0], [0.24, 0.014, 0.13]);
    const elbow = new THREE.Group();
    elbow.position.set(side * 0.24, 0.006, 0);
    shoulder.add(elbow);
    part(elbow, box, materials.grey, [side * 0.1, 0, -0.01], [0.2, 0.012, 0.11]);
    const wrist = new THREE.Group();
    wrist.position.set(side * 0.2, 0.006, -0.01);
    elbow.add(wrist);
    part(wrist, box, materials.tip, [side * 0.06, 0, -0.01], [0.12, 0.011, 0.08]);
    return { side, shoulder, elbow, wrist };
  });

  const legs = new THREE.Group();
  root.add(legs);
  for (const side of [-1, 1]) {
    part(legs, cylinder, materials.beak, [side * 0.03, 0.05, 0], [0.008, 0.1, 0.008]);
  }

  root.scale.setScalar(TUNING.scale);
  return { root, head, wings, legs };
}

export function buildSeagulls(scene, model) {
  const rail = findRailing(model);
  const material = (color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.85, flatShading: true,
  });
  const materials = {
    white: material(0xeeebe2),
    grey: material(0xa6adb1),
    tip: material(0x2b2d2e),
    beak: material(0xd9a43a),
    eye: material(0x161616),
  };

  const random = (min, max) => min + Math.random() * (max - min);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const targetQuaternion = new THREE.Quaternion();
  const helper = new THREE.Object3D();

  const gulls = [];
  for (let index = 0; index < TUNING.count; index += 1) {
    const gull = buildGull(materials);
    scene.add(gull.root);
    Object.assign(gull, {
      state: "circling",
      // Stagger the first landings so they don't all head for the rail at once.
      timer: random(4, 10) + index * 9,
      orbit: {
        angle: random(0, Math.PI * 2),
        radius: random(TUNING.orbitRadiusMin, TUNING.orbitRadiusMax),
        height: random(TUNING.orbitHeightMin, TUNING.orbitHeightMax),
        dir: Math.random() < 0.5 ? -1 : 1,
        phase: random(0, Math.PI * 2),
      },
      curve: null,
      curveT: 0,
      curveLength: 1,
      perchAngle: 0,
      // Leftover gap between the end of a takeoff curve and the orbit, eased out.
      joinOffset: new THREE.Vector3(),
      flapPhase: random(0, Math.PI * 2),
      roll: 0,
      fold: 0,
      lookTimer: random(1, 3),
      lookYaw: 0,
      headYaw: 0,
    });
    gulls.push(gull);
  }

  // The orbit breathes in radius and height so the loops never look canned.
  const orbitPoint = (gull, angle, time, target) => {
    const o = gull.orbit;
    const radius = o.radius + Math.sin(time * 0.13 + o.phase) * 2.2;
    const height = o.height + Math.sin(time * 0.21 + o.phase * 1.7) * 1.6;
    return target.set(
      rail.center.x + Math.cos(angle) * radius,
      height,
      rail.center.z + Math.sin(angle) * radius,
    );
  };

  for (const gull of gulls) orbitPoint(gull, gull.orbit.angle, 0, gull.root.position);

  const perchPoint = (angle, target) => target.set(
    rail.center.x + Math.cos(angle) * rail.radius,
    rail.topY,
    rail.center.z + Math.sin(angle) * rail.radius,
  );

  const outward = (angle, target) => target.set(Math.cos(angle), 0, Math.sin(angle));

  const angleGap = (x, y) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y)));

  // Pick a spot on the rail near where this gull is, away from other gulls.
  const choosePerch = (gull) => {
    const p = gull.root.position;
    const near = Math.atan2(p.z - rail.center.z, p.x - rail.center.x);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = near + random(-0.9, 0.9);
      const taken = gulls.some((other) =>
        other !== gull &&
        (other.state === "landing" || other.state === "perched") &&
        angleGap(other.perchAngle, angle) < TUNING.perchSpacing);
      if (!taken) return angle;
    }
    return null;
  };

  const startLanding = (gull, angle) => {
    const p0 = gull.root.position.clone();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(gull.root.quaternion);
    const p3 = perchPoint(angle, new THREE.Vector3());
    const out = outward(angle, new THREE.Vector3());
    const p1 = p0.clone().addScaledVector(forward, 6);
    // Come in from outside the rail and slightly above, like a gull dropping
    // onto a post into the wind.
    const p2 = p3.clone().addScaledVector(out, 3).addScaledVector(UP, 1.4);
    gull.curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
    gull.curveLength = gull.curve.getLength();
    gull.curveT = 0;
    gull.perchAngle = angle;
    gull.state = "landing";
  };

  const startTakeoff = (gull, time) => {
    const o = gull.orbit;
    o.radius = random(TUNING.orbitRadiusMin, TUNING.orbitRadiusMax);
    o.height = random(TUNING.orbitHeightMin, TUNING.orbitHeightMax);
    o.dir = Math.random() < 0.5 ? -1 : 1;
    const p0 = gull.root.position.clone();
    const out = outward(gull.perchAngle, new THREE.Vector3());
    const p1 = p0.clone().addScaledVector(out, 2.5).addScaledVector(UP, 1.2);
    const entryAngle = gull.perchAngle + o.dir * 0.9;
    // Aim at where the orbit will be when the gull gets there, so joining it
    // doesn't jump. Two passes: rough duration first, then the real curve.
    let p3 = orbitPoint(gull, entryAngle, time + 4, new THREE.Vector3());
    const tangent = new THREE.Vector3(-Math.sin(entryAngle), 0, Math.cos(entryAngle))
      .multiplyScalar(o.dir);
    for (let pass = 0; pass < 2; pass += 1) {
      const p2 = p3.clone().addScaledVector(tangent, -5);
      gull.curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
      gull.curveLength = gull.curve.getLength();
      p3 = orbitPoint(gull, entryAngle, time + gull.curveLength / TUNING.takeoffSpeed, p3.clone());
    }
    gull.curveT = 0;
    o.angle = entryAngle;
    gull.state = "takeoff";
  };

  // Point the gull along a direction, rolling into the turn.
  const face = (gull, direction, targetRoll, dt, ease = 6) => {
    if (direction.lengthSq() < 1e-8) return;
    helper.position.copy(gull.root.position);
    helper.lookAt(lookTarget.copy(gull.root.position).add(direction));
    gull.roll = THREE.MathUtils.damp(gull.roll, targetRoll, 3, dt);
    helper.rotateZ(gull.roll);
    gull.root.quaternion.slerp(helper.quaternion, 1 - Math.exp(-ease * dt));
  };

  // Roll so the top of the bird tilts toward the centre of its circle.
  const bankToward = (gull, direction) => {
    b.set(1, 0, 0).applyQuaternion(gull.root.quaternion);
    c.subVectors(rail.center, gull.root.position).setY(0);
    const side = Math.sign(b.dot(c)) || 1;
    return -side * TUNING.bank;
  };

  const flapWings = (gull, dt, amount, speed, lift = 0.12) => {
    gull.flapPhase += dt * speed;
    const beat = Math.sin(gull.flapPhase);
    const lag = Math.sin(gull.flapPhase - 0.7);
    for (const wing of gull.wings) {
      const s = wing.side;
      wing.shoulder.position.x = s * (0.065 + 0.03 * gull.fold);
      wing.shoulder.position.y = 0.17 - 0.035 * gull.fold;
      wing.shoulder.rotation.set(
        -1.35 * gull.fold,
        s * (Math.PI / 2) * gull.fold,
        s * (lift + beat * amount),
      );
      wing.elbow.rotation.set(0, s * Math.PI * gull.fold, s * lag * amount * 0.5 * (1 - gull.fold));
      wing.wrist.rotation.set(0, s * Math.PI * 0.94 * gull.fold, s * lag * amount * 0.35 * (1 - gull.fold));
    }
  };

  function update(dt, time, playerFeet) {
    for (const gull of gulls) {
      const p = gull.root.position;

      if (gull.state === "circling") {
        const o = gull.orbit;
        o.angle += (o.dir * TUNING.flySpeed * dt) / o.radius;
        const before = a.copy(p);
        orbitPoint(gull, o.angle, time, p);
        gull.joinOffset.multiplyScalar(Math.exp(-1.5 * dt));
        p.add(gull.joinOffset);
        const direction = before.subVectors(p, before);
        face(gull, direction, bankToward(gull, direction), dt);
        gull.fold = THREE.MathUtils.damp(gull.fold, 0, 4, dt);
        // Gulls mostly glide and put in a few strong beats now and then.
        const flapping = Math.sin(time * 0.55 + o.phase * 3) > 0.25;
        flapWings(gull, dt, flapping ? TUNING.flapAmount : 0.06,
          TUNING.flapSpeed * (flapping ? 1 : 0.35));
        gull.legs.visible = false;

        gull.timer -= dt;
        if (gull.timer <= 0) {
          const angle = choosePerch(gull);
          if (angle === null) gull.timer = random(4, 8);
          else startLanding(gull, angle);
        }
      } else if (gull.state === "landing" || gull.state === "takeoff") {
        const landing = gull.state === "landing";
        // Landing slows right down at the end; takeoff starts slow and speeds up.
        const ease = landing
          ? 0.3 + 0.7 * (1 - gull.curveT)
          : 0.45 + 0.55 * gull.curveT;
        const speed = landing ? TUNING.landSpeed : TUNING.takeoffSpeed;
        gull.curveT = Math.min(1, gull.curveT + (speed * ease * dt) / gull.curveLength);
        gull.curve.getPoint(gull.curveT, p);
        const tangent = gull.curve.getTangent(gull.curveT, b);
        if (landing && gull.curveT > 0.85) tangent.setY(tangent.y * 0.3);
        face(gull, tangent, 0, dt, 8);
        gull.fold = THREE.MathUtils.damp(gull.fold, 0, 6, dt);
        // Near the rail the wings go up high and flutter to brake.
        const braking = landing && gull.curveT > 0.75;
        flapWings(gull, dt,
          braking ? 0.35 : TUNING.flapAmount,
          TUNING.flapSpeed * (braking ? 1.7 : 1.15),
          braking ? 0.65 : 0.12);
        gull.legs.visible = landing ? gull.curveT > 0.6 : gull.curveT < 0.25;

        if (gull.curveT >= 1) {
          if (landing) {
            gull.state = "perched";
            gull.timer = random(TUNING.perchMin, TUNING.perchMax);
            gull.lookYaw = random(-0.5, 0.5);
          } else {
            gull.joinOffset.subVectors(p, orbitPoint(gull, gull.orbit.angle, time, a));
            gull.state = "circling";
            gull.timer = random(TUNING.circleMin, TUNING.circleMax);
          }
        }
      } else if (gull.state === "perched") {
        perchPoint(gull.perchAngle, p);
        // Turn to face out to sea, with a little personal angle.
        outward(gull.perchAngle, a).applyAxisAngle(UP, gull.lookYaw);
        helper.position.copy(p);
        helper.lookAt(b.copy(p).add(a));
        targetQuaternion.copy(helper.quaternion);
        gull.root.quaternion.slerp(targetQuaternion, 1 - Math.exp(-3 * dt));
        gull.roll = 0;
        gull.fold = THREE.MathUtils.damp(gull.fold, 1, 5, dt);
        flapWings(gull, dt, 0, 0, 0);
        gull.legs.visible = true;

        // Glance about every few seconds.
        gull.lookTimer -= dt;
        if (gull.lookTimer <= 0) {
          gull.lookTimer = random(1.2, 3.5);
          gull.headYaw = random(-1.1, 1.1);
        }
        gull.head.rotation.y = THREE.MathUtils.damp(gull.head.rotation.y, gull.headYaw, 8, dt);

        gull.timer -= dt;
        const spooked = playerFeet && playerFeet.distanceTo(p) < TUNING.spookDistance;
        if (gull.timer <= 0 || spooked) {
          gull.head.rotation.y = 0;
          startTakeoff(gull, time);
        }
      }

      if (gull.state !== "perched") {
        gull.head.rotation.y = THREE.MathUtils.damp(gull.head.rotation.y, 0, 6, dt);
      }
    }
  }

  return { update, gulls, rail };
}
