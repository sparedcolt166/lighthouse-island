import * as THREE from "three";
import { mergeGeometries } from "./vendor/utils/BufferGeometryUtils.js";

// ---------------------------------------------------------------------------
// The little wooden jetty by the spawn
// ---------------------------------------------------------------------------
//
// Everything is built in metres in the dock's local frame:
//   +Z runs straight out from the island, away from the lighthouse
//   +X runs across the deck
//   Y is world height, so the deck sits a little above the water at y = 0.
//
// To move the dock, change DOCK_AZIMUTH (radians clockwise from +Z) or the
// search range. To make it longer, wider or taller, change DECK_LENGTH,
// DOCK_WIDTH or DECK_Y. The shore end finds its own height with sampleGround.

const DOCK_AZIMUTH = Math.PI / 4;
const DOCK_WIDTH = 2.8;
const DECK_Y = 0.72;
const DECK_LENGTH = 10;
const DECK_PLANK_HEIGHT = 0.09;
const DECK_PLANK_GAP = 0.012;
const EDGE_BEAM_HEIGHT = 0.18;
const EDGE_BEAM_WIDTH = 0.16;
const POST_SPACING = 1.8;
const STAIR_TREAD = 0.34;
const STAIR_LANDING = 0.38;
const SHORE_SEARCH_FROM = 6;
const SHORE_SEARCH_TO = 24;

const COLORS = {
  plankLight: 0x8a7152,
  plankDark: 0x705a42,
  subDeck: 0x4e4032,
  beam: 0x5b4937,
  post: 0x4b3e30,
  waterline: 0x3d4a3d,
  stair: 0x81684c,
  barrel: 0x76563a,
  barrelBand: 0x33302b,
  net: 0x272b26,
  rope: 0xa2865f,
  floatWarm: 0xb86a45,
  floatPale: 0xc3ad7d,
  cleat: 0x544534,
};

function makeMaterial(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
    ...extra,
  });
}

export function buildDock(scene, groundTargets, colliders, options = {}) {
  const sampleGround = options.sampleGround;
  const minGround = options.minGround ?? 1.3;
  const dirX = Math.sin(DOCK_AZIMUTH);
  const dirZ = Math.cos(DOCK_AZIMUTH);

  // Find the last place along the spawn direction where the island is still
  // high enough to stand on. That is the effective shoreline for the player.
  let shoreRadius = null;
  let shoreHeight = null;
  if (sampleGround) {
    for (let radius = SHORE_SEARCH_FROM; radius <= SHORE_SEARCH_TO; radius += 0.05) {
      const y = sampleGround(dirX * radius, dirZ * radius);
      if (y === null) break;
      if (y < minGround + 0.005) break;
      shoreRadius = radius;
      shoreHeight = y;
    }
    if (shoreRadius !== null) {
      shoreRadius = Math.max(SHORE_SEARCH_FROM, shoreRadius - 0.15);
      shoreHeight = sampleGround(dirX * shoreRadius, dirZ * shoreRadius) ?? shoreHeight;
    }
  }
  if (shoreRadius === null) shoreRadius = 9.2;
  if (shoreHeight === null) shoreHeight = minGround + 0.1;

  // Check the ground across the width as well, so the landing board does not
  // sit below a high corner of the beach.
  let landingHeight = shoreHeight;
  if (sampleGround) {
    const sideX = dirZ;
    const sideZ = -dirX;
    for (const offset of [-DOCK_WIDTH / 2 + 0.1, DOCK_WIDTH / 2 - 0.1]) {
      const y = sampleGround(
        dirX * shoreRadius + sideX * offset,
        dirZ * shoreRadius + sideZ * offset,
      );
      if (y !== null) landingHeight = Math.max(landingHeight, y);
    }
  }
  const topY = landingHeight + 0.02;

  const drop = Math.max(0.2, topY - DECK_Y);
  const stepCount = Math.max(2, Math.ceil(drop / 0.22));
  // The landing runs from z = -0.2 to z = 0.18, then the treads follow.
  const stairRun = STAIR_LANDING - 0.2 + stepCount * STAIR_TREAD;
  const deckStart = stairRun;
  const deckEnd = deckStart + DECK_LENGTH;

  const group = new THREE.Group();
  group.name = "Dock";
  group.position.set(dirX * shoreRadius, 0, dirZ * shoreRadius);
  group.rotation.y = DOCK_AZIMUTH;
  scene.add(group);

  // -------------------------------------------------------------------------
  // Materials
  // -------------------------------------------------------------------------

  const plankLightMaterial = makeMaterial(COLORS.plankLight, { roughness: 0.96 });
  const plankDarkMaterial = makeMaterial(COLORS.plankDark, { roughness: 0.96 });
  const subDeckMaterial = makeMaterial(COLORS.subDeck, { roughness: 1 });
  const beamMaterial = makeMaterial(COLORS.beam, { roughness: 0.95 });
  const postMaterial = makeMaterial(COLORS.post, { roughness: 0.98 });
  const waterlineMaterial = makeMaterial(COLORS.waterline, {
    roughness: 0.9,
    metalness: 0.03,
  });
  const stairMaterial = makeMaterial(COLORS.stair, { roughness: 0.94 });
  const barrelMaterial = makeMaterial(COLORS.barrel, { roughness: 0.9 });
  const barrelBandMaterial = makeMaterial(COLORS.barrelBand, {
    roughness: 0.55,
    metalness: 0.42,
  });
  const ropeMaterial = makeMaterial(COLORS.rope, { roughness: 1 });
  const floatWarmMaterial = makeMaterial(COLORS.floatWarm, { roughness: 0.86 });
  const floatPaleMaterial = makeMaterial(COLORS.floatPale, { roughness: 0.9 });
  const cleatMaterial = makeMaterial(COLORS.cleat, { roughness: 0.92 });
  const netMaterial = new THREE.LineBasicMaterial({
    color: COLORS.net,
    transparent: true,
    opacity: 0.92,
  });

  const addMesh = (mesh, parent = group) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const addTarget = (mesh) => {
    if (mesh) groundTargets.push(mesh);
    return mesh;
  };

  const matrices = {
    box: [],
    cylinder: [],
    waterline: [],
    stairLight: [],
    stairDark: [],
  };

  const pushBox = (list, width, height, depth, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
    matrix.setPosition(x, y, z);
    geometry.applyMatrix4(matrix);
    list.push(geometry);
  };

  const pushCylinder = (list, radius, height, x, y, z, segments = 6) => {
    const geometry = new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      segments,
      1,
      true,
    );
    geometry.translate(x, y, z);
    list.push(geometry);
  };

  const mergedMesh = (geometries, material, name, parent = group) => {
    if (geometries.length === 0) return null;
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    geometries.length = 0;
    if (!merged) return null;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    return addMesh(mesh, parent);
  };

  // -------------------------------------------------------------------------
  // Deck: planks over a solid dark sub-deck, so the ray never falls between
  // planks when sampleGround() is looking for a place to stand.
  // -------------------------------------------------------------------------

  const plankCount = Math.max(2, Math.round(DECK_LENGTH / 0.23));
  const plankPitch = DECK_LENGTH / plankCount;
  const plankLength = Math.max(0.08, plankPitch - DECK_PLANK_GAP);
  const plankLight = [];
  const plankDark = [];

  for (let index = 0; index < plankCount; index += 1) {
    const centerZ = deckStart + (index + 0.5) * plankPitch;
    const wear = ((index * 37) % 11) / 11;
    const top = DECK_Y + (wear > 0.82 ? 0.0025 : 0);
    const target = (index * 7) % 12 < 4 ? plankDark : plankLight;
    pushBox(
      target,
      DOCK_WIDTH,
      DECK_PLANK_HEIGHT,
      plankLength,
      0,
      top - DECK_PLANK_HEIGHT / 2,
      centerZ,
      0,
      (wear - 0.5) * 0.003,
      0,
    );
  }

  const planksLightMesh = addTarget(
    mergedMesh(plankLight, plankLightMaterial, "Dock Planks Light"),
  );
  const planksDarkMesh = addTarget(
    mergedMesh(plankDark, plankDarkMaterial, "Dock Planks Dark"),
  );

  // Its top is only 5mm under the planks, so a foot ray that slips through a
  // plank gap still lands on the deck rather than dipping towards the water.
  const subDeck = new THREE.Mesh(
    new THREE.BoxGeometry(
      DOCK_WIDTH - 0.02,
      0.04,
      DECK_LENGTH,
    ),
    subDeckMaterial,
  );
  subDeck.position.set(0, DECK_Y - 0.025, deckStart + DECK_LENGTH / 2);
  subDeck.name = "Dock Sub-deck";
  addTarget(addMesh(subDeck));

  // Raised edge beams. They are walk-on targets too, so the player can step
  // over the little curb instead of clipping through it.
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(
        EDGE_BEAM_WIDTH,
        EDGE_BEAM_HEIGHT,
        DECK_LENGTH + 0.08,
      ),
      beamMaterial,
    );
    beam.position.set(
      side * (DOCK_WIDTH / 2 - EDGE_BEAM_WIDTH / 2),
      DECK_Y + EDGE_BEAM_HEIGHT / 2,
      deckStart + DECK_LENGTH / 2,
    );
    beam.name = side < 0 ? "Dock Edge Beam Left" : "Dock Edge Beam Right";
    addTarget(addMesh(beam));
  }

  // Three longitudinal stringers under the wider planks.
  for (const x of [-0.9, 0, 0.9]) {
    pushBox(
      matrices.box,
      0.16,
      0.16,
      DECK_LENGTH,
      x,
      DECK_Y - DECK_PLANK_HEIGHT - 0.08,
      deckStart + DECK_LENGTH / 2,
    );
  }

  // -------------------------------------------------------------------------
  // Posts, cross-heads and a dark waterline band on each post.
  // -------------------------------------------------------------------------

  const postZ = [];
  for (
    let z = deckStart + 0.4;
    z <= deckEnd - 0.15;
    z += POST_SPACING
  ) {
    postZ.push(z);
  }

  for (const z of postZ) {
    pushBox(
      matrices.box,
      DOCK_WIDTH - 0.16,
      0.12,
      0.12,
      0,
      DECK_Y - DECK_PLANK_HEIGHT - 0.14,
      z,
    );
    for (const side of [-1, 1]) {
      const x = side * 1.08;
      pushCylinder(matrices.cylinder, 0.12, 1.15, x, 0.025, z, 6);
      pushCylinder(matrices.waterline, 0.13, 0.14, x, 0.04, z, 6);
    }
  }

  mergedMesh(matrices.cylinder, postMaterial, "Dock Posts");
  mergedMesh(matrices.waterline, waterlineMaterial, "Dock Waterline");

  // -------------------------------------------------------------------------
  // Steps down the beach to the deck. Each tread is a little walk-on target.
  // -------------------------------------------------------------------------

  const landingCenter = -0.2 + STAIR_LANDING / 2;
  pushBox(
    matrices.stairLight,
    DOCK_WIDTH,
    0.08,
    STAIR_LANDING,
    0,
    topY - 0.04,
    landingCenter,
  );

  const stepRise = drop / (stepCount + 1);
  for (let index = 0; index < stepCount; index += 1) {
    const top = topY - stepRise * (index + 1);
    const centerZ =
      STAIR_LANDING - 0.2 + (index + 0.5) * STAIR_TREAD;
    pushBox(
      index % 2 === 0 ? matrices.stairLight : matrices.stairDark,
      DOCK_WIDTH,
      0.075,
      STAIR_TREAD + 0.01,
      0,
      top - 0.0375,
      centerZ,
    );
  }

  const stairLightMesh = addTarget(
    mergedMesh(matrices.stairLight, stairMaterial, "Dock Stairs Light"),
  );
  const stairDarkMesh = addTarget(
    mergedMesh(matrices.stairDark, plankDarkMaterial, "Dock Stairs Dark"),
  );

  // Side boards following the slope of the steps.
  const stairDrop = topY - DECK_Y;
  const stairBoardRun = stepCount * STAIR_TREAD;
  const stairBoardLength = Math.hypot(stairBoardRun, stairDrop);
  const stairBoardAngle = Math.atan2(stairDrop, stairBoardRun);
  for (const side of [-1, 1]) {
    pushBox(
      matrices.box,
      0.06,
      0.16,
      stairBoardLength,
      side * (DOCK_WIDTH / 2 - 0.02),
      (topY + DECK_Y) / 2 - 0.06,
      STAIR_LANDING - 0.2 + stairBoardRun / 2,
      stairBoardAngle,
      0,
      0,
    );
  }
  mergedMesh(matrices.box, beamMaterial, "Dock Understructure");

  // -------------------------------------------------------------------------
  // Barrels
  // -------------------------------------------------------------------------

  const barrelHeight = 0.9;
  const barrelRadius = 0.31;
  const barrelProfile = [
    [0, 0.2],
    [0.05, 0.265],
    [0.19, 0.295],
    [0.45, barrelRadius],
    [0.71, 0.295],
    [0.85, 0.265],
    [0.9, 0.2],
  ];
  const barrelRadiusAt = (height) => {
    const clamped = Math.max(0, Math.min(barrelHeight, height));
    for (let index = 0; index < barrelProfile.length - 1; index += 1) {
      const [y0, r0] = barrelProfile[index];
      const [y1, r1] = barrelProfile[index + 1];
      if (clamped <= y1) {
        const t = (clamped - y0) / (y1 - y0 || 1);
        return r0 + (r1 - r0) * t;
      }
    }
    return barrelProfile[barrelProfile.length - 1][1];
  };

  function createBarrel(name) {
    const barrel = new THREE.Group();
    barrel.name = name;

    const bodyGeometry = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.2, 0),
        new THREE.Vector2(0.265, 0.05),
        new THREE.Vector2(0.295, 0.19),
        new THREE.Vector2(barrelRadius, 0.45),
        new THREE.Vector2(0.295, 0.71),
        new THREE.Vector2(0.265, 0.85),
        new THREE.Vector2(0.2, barrelHeight),
        new THREE.Vector2(0, barrelHeight),
      ],
      10,
    );
    bodyGeometry.translate(0, -barrelHeight / 2, 0);
    const body = new THREE.Mesh(bodyGeometry, barrelMaterial);
    body.name = `${name} Body`;
    addMesh(body, barrel);

    const bandGeometries = [];
    for (const [bandY, bandRadius] of [
      [0.12, 0.272],
      [0.45, 0.318],
      [0.78, 0.272],
    ]) {
      const band = new THREE.CylinderGeometry(
        bandRadius,
        bandRadius,
        0.045,
        10,
        1,
        true,
      );
      band.translate(0, bandY - barrelHeight / 2, 0);
      bandGeometries.push(band);
    }
    const bands = new THREE.Mesh(
      mergeGeometries(bandGeometries, false),
      barrelBandMaterial,
    );
    for (const geometry of bandGeometries) geometry.dispose();
    bands.name = `${name} Bands`;
    addMesh(bands, barrel);

    const bung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.025, 8),
      barrelBandMaterial,
    );
    bung.position.set(0.08, barrelHeight / 2 + 0.005, 0.04);
    bung.name = `${name} Bung`;
    addMesh(bung, barrel);

    return barrel;
  }

  const barrelSpecs = [
    { x: 0.82, z: deckStart + 8.5, lying: false, radius: 0.33 },
    { x: 0.92, z: deckStart + 9.55, lying: false, radius: 0.33 },
    { x: 0.92, z: deckStart + 7.15, lying: true, radius: 0.45 },
  ];

  for (const [index, spec] of barrelSpecs.entries()) {
    const barrel = createBarrel(`Barrel ${index + 1}`);
    if (spec.lying) {
      barrel.position.set(spec.x, DECK_Y + barrelRadius, spec.z);
      barrel.rotation.x = Math.PI / 2;
      barrel.rotation.z = 0.05;
    } else {
      barrel.position.set(spec.x, DECK_Y + barrelHeight / 2, spec.z);
      barrel.rotation.y = index * 0.7;
    }
    group.add(barrel);

    const worldX = dirX * shoreRadius + spec.x * dirZ + spec.z * dirX;
    const worldZ = dirZ * shoreRadius - spec.x * dirX + spec.z * dirZ;
    colliders.push({ x: worldX, z: worldZ, radius: spec.radius });
  }

  // Small chocks under the barrel that is lying on its side.
  const lyingBarrel = barrelSpecs[2];
  for (const chockZ of [lyingBarrel.z - 0.26, lyingBarrel.z + 0.26]) {
    for (const chockSide of [-1, 1]) {
      const chock = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.09, 0.14),
        beamMaterial,
      );
      chock.position.set(
        lyingBarrel.x + chockSide * 0.2,
        DECK_Y + 0.04,
        chockZ,
      );
      chock.rotation.z = chockSide * 0.16;
      chock.name = "Barrel Chock";
      addMesh(chock);
    }
  }

  // -------------------------------------------------------------------------
  // Fishing net draped over the outer barrel and the deck edge
  // -------------------------------------------------------------------------

  const netBarrel = barrelSpecs[0];
  const netTop = DECK_Y + barrelHeight;
  const netZ = netBarrel.z;
  const edgeX = DOCK_WIDTH / 2;
  const beamTop = DECK_Y + EDGE_BEAM_HEIGHT;

  // Tuning in metres: standoff hugs the barrel, while loose sag and the
  // overhang depth control how much the free end bunches and hangs down.
  const NET_STANDOFF = 0.028;
  const NET_LOOSENESS = 0.025;
  const NET_HANG_DEPTH = 0.58;
  const NET_SPREAD = 0.40;
  const NET_ROWS = 18;
  const NET_COLUMNS = 11;
  const netGrid = [];
  const noise = (row, column) => {
    const value = Math.sin(row * 127.1 + column * 311.7 + 19.3) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  };
  const lerp = THREE.MathUtils.lerp;

  for (let row = 0; row < NET_ROWS; row += 1) {
    const points = [];
    for (let column = 0; column < NET_COLUMNS; column += 1) {
      const across = column / (NET_COLUMNS - 1) * 2 - 1;
      const angle = across * 1.03 + noise(row, column) * 0.025;
      const wobble = noise(row + 31, column + 17);
      let x;
      let y;
      let z;
      if (row <= 4) {
        // Fan across the lid to an arc on its rim instead of a square top.
        const t = row / 4;
        const radius = barrelRadiusAt(barrelHeight) + NET_STANDOFF;
        x = lerp(netBarrel.x - 0.12, netBarrel.x + Math.cos(angle) * radius, t);
        z = netZ + lerp(across * 0.15, Math.sin(angle) * radius, t);
        y = netTop + NET_STANDOFF + 0.003 * Math.abs(wobble);
      } else if (row <= 12) {
        // The first barrel is upright: angle and height follow its lathed side.
        const t = (row - 4) / 8;
        const height = barrelHeight - t * (barrelHeight - 0.06);
        const radius = barrelRadiusAt(height) + NET_STANDOFF + Math.abs(wobble) * 0.006;
        x = netBarrel.x + Math.cos(angle) * radius;
        z = netZ + Math.sin(angle) * radius;
        y = DECK_Y + height;
      } else {
        const t = (row - 12) / (NET_ROWS - 13);
        const startRadius = barrelRadiusAt(0.06) + NET_STANDOFF;
        const startX = netBarrel.x + Math.cos(angle) * startRadius;
        const startZ = netZ + Math.sin(angle) * startRadius;
        // The centre trails over the edge; the corners pool on the planks.
        const overhang = THREE.MathUtils.smoothstep(0.78 - Math.abs(across), 0, 0.35);
        const endX = lerp(1.18, edgeX + 0.075, overhang) + wobble * 0.014;
        x = lerp(startX, endX, t);
        z = lerp(startZ, netZ + across * NET_SPREAD, t)
          + Math.sin(t * Math.PI * 2 + across * 5) * NET_LOOSENESS * t;
        const folds = Math.abs(Math.sin(t * 10 + across * 6 + wobble)) * NET_LOOSENESS;
        y = DECK_Y + 0.008 + folds * t;
        // The edge beam sits higher than the planks. Let the mesh rest on it.
        if (x > edgeX - EDGE_BEAM_WIDTH && x <= edgeX + 0.015) {
          y = Math.max(y, beamTop + 0.01);
        }
        if (x > edgeX + 0.015) {
          const drop = THREE.MathUtils.clamp((x - edgeX - 0.015) / 0.055, 0, 1);
          y = lerp(beamTop + 0.01, beamTop - NET_HANG_DEPTH * (0.75 + 0.25 * overhang), drop);
        }
      }
      points.push(new THREE.Vector3(x, y, z));
    }
    netGrid.push(points);
  }

  // Keep every sampled strand outside the barrel and above the deck and beam.
  // Sampling the spans as well as their endpoints avoids cutting corners.
  const clearNetPoint = (point, clearance = 0.012) => {
    if (point.x < edgeX - EDGE_BEAM_WIDTH) {
      point.y = Math.max(point.y, DECK_Y + clearance);
    } else if (point.x <= edgeX + clearance) {
      point.y = Math.max(point.y, beamTop + clearance);
    }
    const height = point.y - DECK_Y;
    if (height >= 0 && height < barrelHeight) {
      const dx = point.x - netBarrel.x;
      const dz = point.z - netZ;
      const distance = Math.hypot(dx, dz);
      const radius = barrelRadiusAt(height) + clearance;
      if (distance < radius && distance > 0.0001) {
        point.x = netBarrel.x + dx * radius / distance;
        point.z = netZ + dz * radius / distance;
      }
    }
    // A barrel correction can move a point onto the raised edge beam.
    if (point.x >= edgeX - EDGE_BEAM_WIDTH && point.x <= edgeX + clearance) {
      point.y = Math.max(point.y, beamTop + clearance);
    }
    return point;
  };

  const netPositions = [];
  const addNetSegment = (a, b, loose) => {
    let previous = clearNetPoint(a.clone());
    for (let sample = 1; sample <= 4; sample += 1) {
      const t = sample / 4;
      const point = a.clone().lerp(b, t);
      if (loose) point.y -= Math.sin(Math.PI * t) * NET_LOOSENESS * 0.35;
      clearNetPoint(point);
      netPositions.push(previous.x, previous.y, previous.z, point.x, point.y, point.z);
      previous = point;
    }
  };
  for (let row = 0; row < NET_ROWS; row += 1) {
    for (let column = 0; column < NET_COLUMNS; column += 1) {
      if (column + 1 < NET_COLUMNS) {
        addNetSegment(netGrid[row][column], netGrid[row][column + 1], row > 12 && netGrid[row][column].x > edgeX);
      }
      if (row + 1 < NET_ROWS) {
        addNetSegment(netGrid[row][column], netGrid[row + 1][column], row > 12 && netGrid[row][column].x > edgeX);
      }
    }
  }

  const netGeometry = new THREE.BufferGeometry();
  netGeometry.setAttribute("position", new THREE.Float32BufferAttribute(netPositions, 3));
  const net = new THREE.LineSegments(netGeometry, netMaterial);
  net.name = "Fishing Net";
  group.add(net);

  // Each border follows the actual irregular edge rather than a rigid rail.
  const borders = [
    netGrid.map((row) => row[0]),
    netGrid.map((row) => row[NET_COLUMNS - 1]),
    netGrid[0],
    netGrid[NET_ROWS - 1],
  ];
  for (const points of borders) {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const geometry = new THREE.TubeGeometry(curve, 64, 0.006, 4, false);
    const positions = geometry.getAttribute("position");
    const vertex = new THREE.Vector3();
    for (let index = 0; index < positions.count; index += 1) {
      vertex.fromBufferAttribute(positions, index);
      clearNetPoint(vertex, 0.008);
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    const rope = new THREE.Mesh(geometry, ropeMaterial);
    rope.name = "Net Border Rope";
    addMesh(rope);
  }

  // Two cork floats caught in the net, hanging outside the deck.
  function addFloat(x, y, z, material, name) {
    const float = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), material);
    float.position.set(x, y, z);
    float.scale.set(1, 0.86, 0.92);
    float.name = name;
    addMesh(float);
  }
  const floatA = netGrid[NET_ROWS - 1][4];
  const floatB = netGrid[NET_ROWS - 1][7];
  addFloat(floatA.x, floatA.y, floatA.z, floatWarmMaterial, "Net Float");
  addFloat(floatB.x, floatB.y, floatB.z, floatPaleMaterial, "Net Float 2");

  // -------------------------------------------------------------------------
  // Coiled rope, a loose rope end and a cleat
  // -------------------------------------------------------------------------

  const coil = new THREE.Group();
  coil.name = "Coiled Rope";
  coil.position.set(-0.95, DECK_Y + 0.012, deckStart + 9.3);
  group.add(coil);
  for (let index = 0; index < 3; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.15 + index * 0.032, 0.024, 4, 14),
      ropeMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = index * 0.35;
    ring.position.set(index * 0.012, 0.018 + index * 0.019, (index % 2 ? 0.02 : -0.015));
    ring.name = `Rope Coil ${index + 1}`;
    addMesh(ring, coil);
  }

  // Loose rope curling from the coil over to a cleat on the left edge beam.
  const looseRope = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.9, DECK_Y + 0.05, deckStart + 9.18),
    new THREE.Vector3(-0.72, DECK_Y + 0.045, deckStart + 9.0),
    new THREE.Vector3(-0.95, DECK_Y + 0.045, deckStart + 8.84),
    new THREE.Vector3(-1.18, DECK_Y + 0.052, deckStart + 8.82),
    new THREE.Vector3(
      -DOCK_WIDTH / 2 + EDGE_BEAM_WIDTH / 2,
      DECK_Y + EDGE_BEAM_HEIGHT + 0.035,
      deckStart + 8.95,
    ),
  ]);
  const looseRopeMesh = new THREE.Mesh(
    new THREE.TubeGeometry(looseRope, 18, 0.016, 4, false),
    ropeMaterial,
  );
  looseRopeMesh.name = "Loose Rope";
  addMesh(looseRopeMesh);

  const cleat = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.045, 0.055),
    cleatMaterial,
  );
  cleat.position.set(
    -(DOCK_WIDTH / 2 - EDGE_BEAM_WIDTH / 2),
    DECK_Y + EDGE_BEAM_HEIGHT + 0.0225,
    deckStart + 8.95,
  );
  cleat.name = "Dock Cleat";
  addMesh(cleat);

  // -------------------------------------------------------------------------
  // The geometry is in place; make sure the raycasts see it.
  // -------------------------------------------------------------------------

  group.updateMatrixWorld(true);

  // Simple local-rectangle test for the walkable dock footprint. main.js uses
  // this to allow the low deck below its usual MIN_GROUND shoreline height,
  // while still refusing to let the player walk onto the water.
  const halfWidth = DOCK_WIDTH / 2 + 0.02;
  const localMinZ = -0.25;
  const localMaxZ = deckEnd + 0.02;
  const cos = Math.cos(DOCK_AZIMUTH);
  const sin = Math.sin(DOCK_AZIMUTH);
  const originX = group.position.x;
  const originZ = group.position.z;

  const isOnDock = (x, z) => {
    const dx = x - originX;
    const dz = z - originZ;
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    return (
      Math.abs(localX) <= halfWidth &&
      localZ >= localMinZ &&
      localZ <= localMaxZ
    );
  };

  return {
    group,
    isOnDock,
    deckY: DECK_Y,
    deckStart,
    deckEnd,
    shoreRadius,
    topY,
    stepCount,
    barrelPositions: barrelSpecs.map((spec) => ({ x: spec.x, z: spec.z })),
    meshes: {
      planksLight: planksLightMesh,
      planksDark: planksDarkMesh,
      stairLight: stairLightMesh,
      stairDark: stairDarkMesh,
    },
  };
}
