import * as THREE from "three";

// ---------------------------------------------------------------------------
// Tidying the hilltop around the lighthouse
// ---------------------------------------------------------------------------
//
// The Blender export has two awkward spots, fixed here at load time so the
// .glb stays untouched:
//
// - Grass_Cap is a flat disc on the plateau, so from the slope you see bare
//   rock right up to a thin green lip. A grass "skirt" copies the gentle upper
//   faces of the island rock and lays the grass material over them, so the
//   green rolls down over the shoulder of the hill.
// - The Path_Stone_* slabs are level boxes stepping down a slope: buried on
//   the uphill side and hanging in the air on the downhill side. Each vertex is
//   dropped onto the terrain below it (keeping the slab's thickness), so the
//   stones lie on the hill instead.
//
// Call after the model is scaled and its world matrices are up to date.

// Faces of the island rock whose lowest corner is above this height (world
// metres) get grass. Lower it to push the grass further down the hill.
const GRASS_SKIRT_MIN_Y = 2.5;
// Only fairly flat faces get grass, so the cliffs stay rock. 1 = level ground.
const GRASS_SKIRT_MIN_UP = 0.6;
// How far the skirt floats above the rock, to stop the two flickering.
const GRASS_SKIRT_LIFT = 0.03;
// How deep each path stone sinks into the ground. Alternate stones sink a
// little more, so where two stones overlap they don't flicker into each other.
const PATH_STONE_SINK = 0.03;
const PATH_STONE_SINK_STEP = 0.035;

const DOWN = new THREE.Vector3(0, -1, 0);

export function settleGround(model) {
  const terrain = [];
  const rock = [];
  const stones = [];
  let grassCap = null;

  model.traverse((object) => {
    if (!object.isMesh) return;
    if (object.name.startsWith("Island_Mesh")) terrain.push(object);
    // Island_Mesh_2 is the wet rock below the waterline, which never gets grass.
    if (object.name === "Island_Mesh" || object.name === "Island_Mesh_1") rock.push(object);
    if (object.name === "Grass_Cap") {
      grassCap = object;
      terrain.push(object);
    }
    if (object.name.startsWith("Path_Stone_")) stones.push(object);
  });

  if (grassCap) addGrassSkirt(model, rock, grassCap.material);
  settlePathStones(stones, terrain);
}

function addGrassSkirt(model, rock, material) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const positions = [];

  for (const mesh of rock) {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const position = geometry.getAttribute("position");
    for (let index = 0; index < position.count; index += 3) {
      a.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, index + 1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, index + 2).applyMatrix4(mesh.matrixWorld);
      if (Math.min(a.y, b.y, c.y) < GRASS_SKIRT_MIN_Y) continue;
      normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize();
      if (normal.y < GRASS_SKIRT_MIN_UP) continue;
      // Lift straight up rather than along each face's normal, so neighbouring
      // faces still share their edges and no rock shows through the creases.
      for (const corner of [a, b, c]) {
        positions.push(corner.x, corner.y + GRASS_SKIRT_LIFT, corner.z);
      }
    }
  }

  if (positions.length === 0) return;

  // Built in world space, then parented to the model without its scale, so it
  // moves with the island if the island ever moves.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const skirt = new THREE.Mesh(geometry, material);
  skirt.name = "Grass_Skirt";
  skirt.receiveShadow = true;
  skirt.matrixAutoUpdate = false;
  skirt.matrix.copy(model.matrixWorld).invert();
  model.add(skirt);
  skirt.updateMatrixWorld(true);
}

function settlePathStones(stones, terrain) {
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const toLocal = new THREE.Matrix4();

  stones.sort((left, right) => left.name.localeCompare(right.name));

  stones.forEach((stone, stoneIndex) => {
    // Non-indexed so the normals can be recomputed flat for the new tilt.
    const geometry = stone.geometry.index ? stone.geometry.toNonIndexed() : stone.geometry.clone();
    geometry.deleteAttribute("normal");
    const position = geometry.getAttribute("position");
    toLocal.copy(stone.matrixWorld).invert();

    let bottom = Infinity;
    for (let index = 0; index < position.count; index++) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(stone.matrixWorld);
      bottom = Math.min(bottom, vertex.y);
    }

    const sink = PATH_STONE_SINK + (stoneIndex % 2) * PATH_STONE_SINK_STEP;
    for (let index = 0; index < position.count; index++) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(stone.matrixWorld);
      ray.set(origin.set(vertex.x, bottom + 10, vertex.z), DOWN);
      const hit = ray.intersectObjects(terrain, false)[0];
      if (!hit) continue;
      vertex.y = hit.point.y + (vertex.y - bottom) - sink;
      vertex.applyMatrix4(toLocal);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    stone.geometry = geometry;
  });
}
