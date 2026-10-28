import * as THREE from "three";
import { PointerLockControls } from "./vendor/controls/PointerLockControls.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { buildDock } from "./dock.js";
import { buildIslands } from "./islands.js";
import { buildHeadland } from "./headland.js";
import { buildFisherman } from "./fisherman.js";
import { buildBrunson, buildBrunsonShrine } from "./brunson.js";
import { buildFishing } from "./fishing.js";
import { buildTinny } from "./tinny.js";
import { buildSeagulls } from "./seagulls.js";
import { buildShips } from "./ships.js";
import { createAmbientAudio } from "./audio.js";
import { getTestSetup, isRainTest } from "./dev-test.js";
import { settleGround } from "./ground.js";
import { createWaterSystem } from "./water.js";
import { createWaterGraphics, setQuality, getQuality } from "./water-graphics.js";
import { showToast } from "./toast.js";
import { createAttractCamera } from "./attract.js";
import { createBookCover } from "./book-cover.js";
import { buildUpperRoom } from "./upper-room.js";
import { buildDayNight } from "./daynight.js";
import { createWeather } from "./weather.js";
import { buildBlackjack } from "./blackjack.js";
import { buildWildlife } from "./wildlife.js";

// ---------------------------------------------------------------------------
// Page bits
// ---------------------------------------------------------------------------

const canvas = document.querySelector("#view");
const overlay = document.querySelector("#overlay");
const enterButton = document.querySelector("#enter");
const statusLine = document.querySelector("#status");
const crosshair = document.querySelector("#crosshair");
const hud = document.querySelector("#hud");
const lookHint = document.querySelector("#look-hint");
const interact = document.querySelector("#interact");
const interactLabel = document.querySelector("#interact-label");
const startPrompt = document.querySelector("#start-prompt");

// The Blender scene was modelled at roughly half human scale (the front door is
// only 0.76m tall). Scale the whole island up so a normal-sized person can walk
// through the door and the lighthouse reads at a believable size.
const WORLD_SCALE = 2.5;

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
renderer.setClearColor(0x0b1f27, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd3d1c5, 95, 430);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.08,
  900,
);

// Drives the title flyover until the player starts walking.
const attract = createAttractCamera(camera);

// ---------------------------------------------------------------------------
// Sky dome + environment
// ---------------------------------------------------------------------------

function makeSkyTexture() {
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 8;
  skyCanvas.height = 512;
  const context = skyCanvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0.0, "#245a83");
  gradient.addColorStop(0.3, "#4e80a8");
  gradient.addColorStop(0.44, "#8fb9cc");
  gradient.addColorStop(0.485, "#ccdfe2");
  gradient.addColorStop(0.505, "#f3d8b5");
  gradient.addColorStop(0.53, "#edc7a8");
  gradient.addColorStop(0.57, "#b7cbd0");
  gradient.addColorStop(0.66, "#87999b");
  gradient.addColorStop(0.8, "#5b6f73");
  gradient.addColorStop(1.0, "#354a51");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 8, 512);

  const texture = new THREE.CanvasTexture(skyCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const skyGeometry = new THREE.SphereGeometry(420, 32, 18);
const skyMaterial = new THREE.MeshBasicMaterial({
  map: makeSkyTexture(),
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  toneMapped: false,
});
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
sky.renderOrder = -1;
scene.add(sky);

// A small warm sun halo high above the left shoulder of the island.
function makeRadialTexture() {
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const context = glowCanvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255, 247, 225, 1)");
  gradient.addColorStop(0.12, "rgba(255, 232, 190, 0.9)");
  gradient.addColorStop(0.32, "rgba(255, 205, 150, 0.35)");
  gradient.addColorStop(1, "rgba(255, 190, 130, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(glowCanvas);
}

const sunDirection = new THREE.Vector3(-12, 20, 16).normalize();
const sunSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeRadialTexture(),
    color: 0xffe5bd,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
  }),
);
sunSprite.position.copy(sunDirection).multiplyScalar(360);
sunSprite.scale.setScalar(52);
sunSprite.renderOrder = 1;
scene.add(sunSprite);

// Use the sky colours for image based lighting and water reflections.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const environmentScene = new THREE.Scene();
environmentScene.add(new THREE.Mesh(skyGeometry, skyMaterial));
const environmentTarget = pmremGenerator.fromScene(environmentScene, 0.03, 0.1, 800);
scene.environment = environmentTarget.texture;
scene.environmentIntensity = 0.85;
pmremGenerator.dispose();

// ---------------------------------------------------------------------------
// A little weather, borrowed from the render
// ---------------------------------------------------------------------------

const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
const cloudMaterial = new THREE.MeshStandardMaterial({
  color: 0xfff4e8,
  emissive: 0xffeeda,
  emissiveIntensity: 0.42,
  roughness: 1,
  metalness: 0,
  flatShading: true,
});
const cloudLobes = [
  [0, 0, 0, 5.2, 2.7, 2.5],
  [4.1, 0.4, 0.3, 3.5, 1.9, 2.1],
  [-4.2, 0.2, 0.4, 3.7, 2, 1.9],
  [1.1, 1.5, 0.7, 3.1, 2.1, 1.9],
  [-1.2, 1.2, -0.5, 2.5, 1.7, 1.6],
  [0.5, -0.9, 0.3, 3.4, 1.7, 1.8],
];

function addCloud(x, y, z, scale, rotationY) {
  const cloud = new THREE.Group();
  cloud.position.set(x, y, z);
  cloud.rotation.y = rotationY;

  for (const [index, [lx, ly, lz, sx, sy, sz]] of cloudLobes.entries()) {
    const lobe = new THREE.Mesh(cloudGeometry, cloudMaterial);
    lobe.position.set(lx, ly, lz).multiplyScalar(scale);
    lobe.scale.set(sx, sy, sz).multiplyScalar(scale);
    lobe.rotation.set(index * 0.3, index * 0.9, index * 0.2);
    cloud.add(lobe);
  }

  scene.add(cloud);
}

addCloud(-140, 60, -80, 1.9, 0.4);
addCloud(-52, 77, -190, 1.5, 2.1);
addCloud(153, 67, 108, 1.6, 1.4);
addCloud(126, 59, -108, 1.4, -0.7);

// ---------------------------------------------------------------------------
// Animated water
// ---------------------------------------------------------------------------

function makeWaterNormalTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const tau = Math.PI * 2;
  const waves = [
    [3, 1, 0.42, 0.0],
    [1, 4, 0.3, 1.8],
    [-2, 3, 0.24, 3.7],
    [4, -3, 0.18, 5.2],
    [7, 2, 0.12, 2.5],
    [-5, 6, 0.09, 0.7],
    [8, -7, 0.06, 4.1],
  ];

  const height = (u, v) => {
    let result = 0;
    for (const [kx, ky, amplitude, phase] of waves) {
      result += amplitude * Math.sin(tau * (kx * u + ky * v) + phase);
    }
    return result;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const base = height(u, v);
      const dx = height((x + 1) / size, v) - base;
      const dy = height(u, (y + 1) / size) - base;
      const strength = 2.7;
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const inverseLength = 1 / Math.hypot(nx, ny, nz);
      nx *= inverseLength;
      ny *= inverseLength;
      nz *= inverseLength;
      const index = (y * size + x) * 4;
      data[index] = Math.round((nx * 0.5 + 0.5) * 255);
      data[index + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[index + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(46, 46);
  texture.needsUpdate = true;
  return texture;
}

const waterNormal = makeWaterNormalTexture();
const waterMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color("#0a4b61"),
  roughness: 0.21,
  metalness: 0.02,
  clearcoat: 0.55,
  clearcoatRoughness: 0.18,
  normalMap: waterNormal,
  normalScale: new THREE.Vector2(0.2, 0.2),
  envMapIntensity: 0.9,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), waterMaterial);
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
water.receiveShadow = true;
scene.add(water);

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

const sunLight = new THREE.DirectionalLight(0xffd0a0, 2.8);
sunLight.position.set(-30, 50, 40);
sunLight.target.position.set(0, 5.5, 0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -34;
sunLight.shadow.camera.right = 34;
sunLight.shadow.camera.top = 38;
sunLight.shadow.camera.bottom = -38;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 140;
// The island is made of large flat faces, so a generous normal bias is what
// keeps the low sun from striping the path and the porch step.
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.25;
scene.add(sunLight, sunLight.target);

const hemisphereLight = new THREE.HemisphereLight(0xbdd9ef, 0x62584a, 0.8);
scene.add(hemisphereLight);

const lanternLight = new THREE.PointLight(0xffb35e, 200, 55, 2);
lanternLight.position.set(0, 7.65 * WORLD_SCALE, 0);
scene.add(lanternLight);

const lanternGlowMaterial = new THREE.SpriteMaterial({
  map: makeRadialTexture(),
  color: 0xffbd72,
  transparent: true,
  opacity: 0.62,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: false,
  fog: false,
  toneMapped: false,
});
const lanternGlow = new THREE.Sprite(lanternGlowMaterial);
lanternGlow.position.set(0, 7.62 * WORLD_SCALE, 0);
lanternGlow.scale.setScalar(2.9 * WORLD_SCALE);
lanternGlow.renderOrder = 20;
scene.add(lanternGlow);

// ---------------------------------------------------------------------------
// First person player
// ---------------------------------------------------------------------------

// The Blender scene was modelled at roughly half human scale (the front door is
// only 0.76m tall). WORLD_SCALE, declared above, brings it up to human scale.
const EYE_HEIGHT = 1.64;
const PLAYER_RADIUS = 0.32;
const WALK_SPEED = 3.4;
const RUN_SPEED = 5.8;
const STEP_HEIGHT = 0.72;
const GRAVITY = 18;
const JUMP_SPEED = 5.6;
const SPAWN = new THREE.Vector3(2.35 * WORLD_SCALE, 0, 2.35 * WORLD_SCALE);
const SPAWN_LOOK = new THREE.Vector3(0, 5.6, 0);

const TOWER_RADIUS = 0.98 * WORLD_SCALE;
const ROOM_FLOOR = 4.8;
const ROOM_RADIUS = 1.96;
const ROOM_TOP_RADIUS = 1.76;
const ROOM_HEIGHT = 3.8;
const ROOM_CEILING = ROOM_FLOOR + ROOM_HEIGHT;
const INTERIOR_MARGIN = 0.1;

const player = {
  feet: new THREE.Vector3(),
  velocityY: 0,
  grounded: true,
  eyeY: 0,
  bobTime: 0,
  bobAmount: 0,
  started: false,
  ready: false,
};

const controls = new PointerLockControls(camera, canvas);
controls.pointerSpeed = 0.9;

// Tree trunks and boulders that the player cannot walk through. The tower is
// handled separately so its doorway can open.
const colliders = [
  { x: -1.25 * WORLD_SCALE, z: -0.87 * WORLD_SCALE, radius: 0.5 * WORLD_SCALE },
  { x: 1.44 * WORLD_SCALE, z: -0.58 * WORLD_SCALE, radius: 0.56 * WORLD_SCALE },
  { x: -1.45 * WORLD_SCALE, z: 0.58 * WORLD_SCALE, radius: 0.4 * WORLD_SCALE },
];

const groundRay = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
const groundOrigin = new THREE.Vector3();
const groundTargets = [];
let lastGroundHit = null;
const sea = createWaterSystem(scene, groundTargets);
let islands = null;
let headland = null;
let wildlife = null;
let dock = null;
let fisherman = null;
let brunson = null;
let brunsonShrine = null;
let fishing = null;
let tinny = null;
let seagulls = null;
let ships = null;
const ambientAudio = createAmbientAudio();
const weather = createWeather(scene, camera, cloudMaterial, sampleGround, ROOM_FLOOR, TOWER_RADIUS, isRainTest());
let testSetup = null;
let dayNight = null;
let waterGraphics = null;
const keys = new Set();
let jumpQueued = false;
let model = null;
let walkMode = false;
let pointerLook = false;
let dragLook = false;
let pointerLockBlocked = false;
let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

// Door + lighthouse interior state, filled in once the GLB has loaded.
let doorPivot = null;
let doorOpen = false;
let doorTarget = 0;
let doorReady = false;
let doorCenter = new THREE.Vector3();
let doorDir = new THREE.Vector2(0, 1);
let doorWidth = 1.07;
let doorOpenAngle = -1.92;
let doorAzimuth = Math.PI / 4;
let interiorGroup = null;
let upperRoom = null;
let blackjack = null;

const cameraEuler = new THREE.Euler(0, 0, 0, "YXZ");
const moveDirection = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

function sampleGround(x, z, fromY = 20) {
  if (groundTargets.length === 0) return null;
  groundRay.set(groundOrigin.set(x, fromY, z), DOWN);
  groundRay.far = fromY + 40;
  const hits = groundRay.intersectObjects(groundTargets, false);
  lastGroundHit = hits[0] || null;
  return lastGroundHit ? lastGroundHit.point.y : null;
}

// Do not let the upper floor's raycast hide the floor beneath it.
function samplePlayerGround(x, z, feetY) {
  if (upperRoom && feetY >= upperRoom.ceilingY - 0.05 && feetY < upperRoom.ceilingY + 0.3 && Math.hypot(x, z) < 1.5) return upperRoom.ceilingY;
  let fromY = feetY + 3.2;
  if (upperRoom && Math.hypot(x, z) < 2 && feetY >= upperRoom.floorY - 1 && feetY < upperRoom.ceilingY - 0.05) {
    fromY = Math.min(fromY, upperRoom.ceilingY - 0.05);
  }
  return sampleGround(x, z, fromY);
}

function isNearDoor() {
  if (!doorReady) return false;
  const dx = player.feet.x - doorCenter.x;
  const dz = player.feet.z - doorCenter.z;
  return dx * dx + dz * dz < 3.4 * 3.4;
}

// The near-door radius reaches into the round room, so being close is not
// enough: the door prompt and E only work while you are looking at the door.
const lookFlat = new THREE.Vector2();
function isFacingDoor() {
  cameraEuler.setFromQuaternion(camera.quaternion);
  lookFlat.set(-Math.sin(cameraEuler.y), -Math.cos(cameraEuler.y));
  const dx = doorCenter.x - player.feet.x;
  const dz = doorCenter.z - player.feet.z;
  const distance = Math.hypot(dx, dz);
  // Standing in the doorway itself, the direction to the panel's centre swings
  // wildly, so judge by whether you are looking along the doorway instead.
  if (distance < 0.6) {
    return Math.abs(lookFlat.x * doorDir.x + lookFlat.y * doorDir.y) > 0.7;
  }
  // cos(40°): the door has to be roughly in the middle of the view.
  return (lookFlat.x * dx + lookFlat.y * dz) / distance > 0.77;
}

function canUseDoor() {
  return doorReady && isNearDoor() && isFacingDoor();
}

function inDoorway(x, z) {
  const along = x * doorDir.x + z * doorDir.y;
  if (along < 0.6 || along > TOWER_RADIUS + 1.2) return false;
  const sideways = Math.abs(x * doorDir.y - z * doorDir.x);
  return sideways < Math.max(0.48, doorWidth * 0.42);
}

function solidAt(x, z) {
  if (upperRoom && player.feet.y >= upperRoom.ceilingY - 0.2) return upperRoom.blocks(x, z, player.feet.y);
  for (const collider of colliders) {
    const reach = collider.radius + PLAYER_RADIUS;
    const dx = x - collider.x;
    const dz = z - collider.z;
    if (dx * dx + dz * dz < reach * reach) return true;
  }

  // The tower is a ring. You can only pass through the ring when the door is
  // open and you are lined up with the doorway.
  const radius = Math.hypot(x, z);
  if (radius < TOWER_RADIUS + PLAYER_RADIUS && radius > ROOM_RADIUS - PLAYER_RADIUS) {
    const passable = doorPivot !== null && Math.abs(doorPivot.rotation.y) > 0.9;
    if (!passable || !inDoorway(x, z)) return true;
  }

  return false;
}

function canStandAt(x, z, feetY) {
  if (tinny && player.grounded && !jumpQueued && tinny.blocksExit(player.feet, x, z)) return false;
  if (solidAt(x, z)) return false;
  const floor = samplePlayerGround(x, z, feetY);
  if (floor === null) return false;
  // Treat anything more than a low step as a wall.
  return floor <= feetY + STEP_HEIGHT;
}

function placePlayer(position = SPAWN, fromY = 20, lookAt = SPAWN_LOOK) {
  const floor = sampleGround(position.x, position.z, fromY);
  player.feet.set(
    position.x,
    floor ?? 1.8,
    position.z,
  );
  player.velocityY = 0;
  player.grounded = true;
  player.eyeY = player.feet.y + EYE_HEIGHT;
  player.bobTime = 0;
  player.bobAmount = 0;
  camera.position.set(player.feet.x, player.eyeY, player.feet.z);
  camera.lookAt(lookAt);
  player.started = true;
}

function placeAtStart() {
  if (testSetup) placePlayer(testSetup.position, testSetup.fromY ?? 20, testSetup.lookAt);
  else placePlayer(SPAWN);
}
function resetPlayer() {
  sea.reset();
  if (upperRoom) upperRoom.reset();
  if (tinny) tinny.reset();
  placeAtStart();
  player.started = true;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

window.addEventListener("keydown", (event) => {
  if (blackjack && blackjack.key(event)) return;
  if (event.code === "Escape" && walkMode && !pointerLook) {
    pauseWalkabout();
    return;
  }
  // Before the first walk the menu is hidden; Esc brings it up.
  if (event.code === "Escape" && !walkMode) {
    overlay.classList.remove("hidden");
    return;
  }
  // On the title flyover any key starts the walk. A keypress counts as a user
  // gesture, so pointer lock can still be requested from here.
  if (attract.active && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
    enterWalkabout();
    return;
  }
  if (walkMode && ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (event.code === "Space" && !event.repeat && walkMode) jumpQueued = true;
  if (event.code === "KeyE" && !event.repeat && walkMode) {
    // Same priority as the prompt in updateDoor: the boat first only while rowing.
    if (tinny && tinny.isRowing()) tinny.interact(player, camera);
    else if (canUseDoor()) toggleDoor();
    else if (fishing && fishing.canInteract(camera)) fishing.interact();
    else if (fisherman && fisherman.canInteract(camera)) fisherman.interact(player.feet);
    else if (brunson && brunson.canInteract(camera)) brunson.interact();
    else if (upperRoom && upperRoom.prompt(player, camera)) upperRoom.interact(player, camera);
    else if (blackjack && blackjack.canInteract(camera)) blackjack.interact();
    else if (tinny && tinny.canInteract(camera)) tinny.interact(player, camera);
  }
  if (event.code === "KeyR" && walkMode) resetPlayer();
  if (event.code === "KeyT" && !event.repeat && testSetup && dayNight) showToast(`Time speed: ${dayNight.toggleSpeed()}x`, 2500);
  if (event.code === "KeyM" && !event.repeat && walkMode) {
    const muted = ambientAudio.toggleMute();
    weather.setMuted(muted);
    showToast(muted ? "Sound muted" : "Sound on", 2500);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
  jumpQueued = false;
});

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

function updatePlayer(dt) {
  if (!walkMode || !player.ready || blackjack?.open) return;

  cameraEuler.setFromQuaternion(camera.quaternion);
  if (testSetup) {
    const turn = (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
    const tilt = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
    cameraEuler.y += turn * 1.5 * dt;
    cameraEuler.x = THREE.MathUtils.clamp(cameraEuler.x + tilt * 1.2 * dt, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    camera.quaternion.setFromEuler(cameraEuler);
  }
  const startX = player.feet.x, startY = player.feet.y, startZ = player.feet.z;
  const yaw = cameraEuler.y;

  forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  right.set(Math.cos(yaw), 0, -Math.sin(yaw));

  const forwardInput =
    (keys.has("KeyW") || (!testSetup && keys.has("ArrowUp")) ? 1 : 0) -
    (keys.has("KeyS") || (!testSetup && keys.has("ArrowDown")) ? 1 : 0);
  const sideInput =
    (keys.has("KeyD") || (!testSetup && keys.has("ArrowRight")) ? 1 : 0) -
    (keys.has("KeyA") || (!testSetup && keys.has("ArrowLeft")) ? 1 : 0);

  moveDirection.set(0, 0, 0);
  moveDirection.addScaledVector(forward, forwardInput);
  moveDirection.addScaledVector(right, sideInput);
  const wantsToMove = moveDirection.lengthSq() > 0;
  if (wantsToMove) moveDirection.normalize();

  if (tinny && tinny.updateRowing(player, camera, forwardInput, sideInput, dt)) {
    jumpQueued = false;
    return;
  }

  if (upperRoom && upperRoom.update(player, forward, forwardInput, jumpQueued, dt, camera)) {
    jumpQueued = false;
    if (player.feet.y !== startY) ambientAudio.movementSound("climb", player.feet.y - startY);
    player.eyeY = THREE.MathUtils.damp(player.eyeY, player.feet.y + EYE_HEIGHT, 16, dt);
    camera.position.set(player.feet.x, player.eyeY, player.feet.z);
    return;
  }

  const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
  if (sea.swim(player, moveDirection, wantsToMove, running, keys, EYE_HEIGHT, dt, sampleGround, solidAt, camera)) {
    jumpQueued = false;
    return;
  }
  const speed = (running ? RUN_SPEED : WALK_SPEED) * sea.speedFactor(player.feet.y);

  // Move each horizontal axis on its own so walls can be slid along.
  const stepX = moveDirection.x * speed * dt;
  const stepZ = moveDirection.z * speed * dt;
  if (stepX !== 0 && canStandAt(player.feet.x + stepX, player.feet.z, player.feet.y)) {
    player.feet.x += stepX;
  }
  if (stepZ !== 0 && canStandAt(player.feet.x, player.feet.z + stepZ, player.feet.y)) {
    player.feet.z += stepZ;
  }

  const push = sea.boundaryPush(player.feet.x, player.feet.z, dt);
  if (canStandAt(player.feet.x + push.x, player.feet.z, player.feet.y)) player.feet.x += push.x;
  if (canStandAt(player.feet.x, player.feet.z + push.z, player.feet.y)) player.feet.z += push.z;

  let floor = samplePlayerGround(player.feet.x, player.feet.z, player.feet.y);

  if (player.grounded) {
    if (floor !== null && floor >= player.feet.y - 0.7 && floor <= player.feet.y + STEP_HEIGHT) {
      player.feet.y = floor;
      player.velocityY = 0;
    } else if (floor === null || floor < player.feet.y - 0.7) {
      player.grounded = false;
      player.velocityY = 0;
    }
  }

  if (jumpQueued) {
    if (player.grounded) {
      player.velocityY = JUMP_SPEED * sea.jumpFactor(player.feet.y);
      player.grounded = false;
    }
    jumpQueued = false;
  }

  if (!player.grounded) {
    player.velocityY -= GRAVITY * dt;
    player.feet.y += player.velocityY * dt;
    floor = samplePlayerGround(player.feet.x, player.feet.z, player.feet.y);
    if (floor !== null && player.velocityY <= 0 && player.feet.y <= floor) {
      ambientAudio.movementSound("land", lastGroundHit, player.feet, -player.velocityY);
      player.feet.y = floor;
      player.velocityY = 0;
      player.grounded = true;
    }
    if (player.feet.y < -15) resetPlayer();
  }

  const moving = wantsToMove && player.grounded;
  const targetBobAmount = moving ? (running ? 1 : 0.7) : 0;
  player.bobAmount = THREE.MathUtils.damp(player.bobAmount, targetBobAmount, 9, dt);
  if (moving) {
    const previousBob = player.bobTime;
    player.bobTime += dt * (running ? 12.5 : 8.6);
    // A trough occurs at three halves of pi in each bob cycle.
    if ((Math.abs(player.feet.x - startX) + Math.abs(player.feet.z - startZ) > 0.00001) &&
        Math.floor((previousBob - Math.PI * 1.5) / (Math.PI * 2)) < Math.floor((player.bobTime - Math.PI * 1.5) / (Math.PI * 2))) {
      samplePlayerGround(player.feet.x, player.feet.z, player.feet.y);
      ambientAudio.movementSound("step", lastGroundHit, player.feet);
    }
  }
  const bob = Math.sin(player.bobTime) * 0.042 * player.bobAmount;
  player.eyeY = THREE.MathUtils.damp(player.eyeY, player.feet.y + EYE_HEIGHT + bob + sea.surfaceBob(player.feet.y, EYE_HEIGHT), 16, dt);
  camera.position.set(player.feet.x, player.eyeY, player.feet.z);
}

// ---------------------------------------------------------------------------
// Load the exported lighthouse
// ---------------------------------------------------------------------------

const loader = new GLTFLoader();

function prepareModel(root) {
  const glowMaterialNames = new Set(["Lantern Glow", "Window Lit"]);
  const foamMaterialNames = new Set(["Sea Foam"]);

  // The tower is stacked from capped cylinders. Seen from inside the room those
  // horizontal caps would slice across the space like floors, so open the bands
  // into tubes by dropping their flat faces.
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();

  root.traverse((object) => {
    if (object.isMesh && /^Tower_Band/.test(object.name)) {
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      const position = geometry.getAttribute("position");
      const kept = [];
      for (let index = 0; index < position.count; index += 3) {
        a.fromBufferAttribute(position, index);
        b.fromBufferAttribute(position, index + 1);
        c.fromBufferAttribute(position, index + 2);
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        normal.crossVectors(ab, ac);
        const length = normal.length();
        if (length > 0 && Math.abs(normal.y) > length * 0.9) continue;
        kept.push(index, index + 1, index + 2);
      }
      geometry.setIndex(kept);
      object.geometry = geometry;
    }
  });

  root.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = object.name !== "Foam";
    object.receiveShadow = true;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.9;

      // The tower is a solid shell. Culling its back faces lets us stand
      // inside it and look out through the doorway instead of seeing the
      // inside of the masonry. Foam is the one thing that needs both sides.
      if (foamMaterialNames.has(material.name)) {
        material.side = THREE.DoubleSide;
      } else if (material.side !== undefined) {
        material.side = THREE.FrontSide;
      }

      if (glowMaterialNames.has(material.name)) {
        material.emissiveIntensity = material.name === "Lantern Glow" ? 2.6 : 1.8;
      }

      if (foamMaterialNames.has(material.name)) {
        material.transparent = true;
        material.opacity = 0.62;
        material.depthWrite = false;
        material.roughness = 1;
      }

      if (material.name === "Window Glass") {
        material.metalness = 0.55;
        material.roughness = 0.08;
        if ("envMapIntensity" in material) material.envMapIntensity = 2.1;
      }
    }

    if (
      object.name.startsWith("Island_Mesh") ||
      object.name === "Grass_Cap" ||
      object.name.startsWith("Boulder_") ||
      object.name.startsWith("Path_Stone_") ||
      object.name.startsWith("Plinth_")
    ) {
      groundTargets.push(object);
    }
  });

  root.updateMatrixWorld(true);
}

// ---------------------------------------------------------------------------
// The lighthouse door and its little round room
// ---------------------------------------------------------------------------

function setupDoorAndInterior(root) {
  const panel = root.getObjectByName("Door_Panel");
  const knob = root.getObjectByName("Door_Knob");
  const threshold = root.getObjectByName("Door_Threshold");
  const towerBand = root.getObjectByName("Tower_Band_01");

  if (!panel || !knob || !threshold || !towerBand) {
    console.warn("Door meshes missing from the lighthouse model.");
    return;
  }

  root.updateMatrixWorld(true);

  const thresholdBox = new THREE.Box3().setFromObject(threshold);
  const floorY = thresholdBox.max.y;

  panel.geometry.computeBoundingBox();
  const panelScale = panel.getWorldScale(new THREE.Vector3());
  const panelSize = panel.geometry.boundingBox
    .getSize(new THREE.Vector3())
    .multiply(panelScale);
  doorWidth = panelSize.x;

  doorCenter.copy(panel.getWorldPosition(new THREE.Vector3()));
  doorAzimuth = Math.atan2(doorCenter.x, doorCenter.z);
  doorDir.set(doorCenter.x, doorCenter.z).normalize();

  const towerBox = new THREE.Box3().setFromObject(towerBand);
  const towerBaseRadius = Math.max(towerBox.max.x, towerBox.max.z);
  const roomRadius = towerBaseRadius - 0.14;

  // The exported panel sits about 0.2m proud of the tower, so from the side
  // the door and its surround looked like a slab standing in front of a gap.
  // Find where the wall really is at door height and set the door into it.
  const out = new THREE.Vector3(doorDir.x, 0, doorDir.y);
  const towerBands = [];
  root.traverse((object) => {
    if (object.isMesh && /^Tower_Band/.test(object.name)) towerBands.push(object);
  });
  const wallRay = new THREE.Raycaster(
    doorCenter.clone().addScaledVector(out, 3),
    out.clone().negate(),
    0,
    6,
  );
  const wallHit = wallRay.intersectObjects(towerBands, false)[0];
  const doorCenterRadius = Math.hypot(doorCenter.x, doorCenter.z);
  const wallRadius = wallHit
    ? Math.hypot(wallHit.point.x, wallHit.point.z)
    : doorCenterRadius;
  // Keep the panel's outer face a touch behind the wall face, like a real
  // recessed door.
  const doorInset = wallRadius - 0.06 - doorCenterRadius;

  // Work out which edge of the panel carries the hinge: it is the edge away
  // from the knob.
  const localX = new THREE.Vector3(1, 0, 0)
    .applyQuaternion(panel.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
  const knobLocal = panel.worldToLocal(knob.getWorldPosition(new THREE.Vector3()));
  const hingeSign = knobLocal.x > 0 ? -1 : 1;
  const hinge = doorCenter.clone().addScaledVector(localX, (hingeSign * doorWidth) / 2);

  // Swing outward, away from the room, so the panel never cuts through the
  // curved interior wall.
  const freeEdge = doorCenter.clone().sub(hinge).setY(0).normalize();
  const inward = new THREE.Vector3(-doorCenter.x, 0, -doorCenter.z).normalize();
  const turned = new THREE.Vector3(freeEdge.z, 0, -freeEdge.x);
  const turnsInward = turned.dot(inward) > 0 ? 1 : -1;
  doorOpenAngle = -turnsInward * 1.92;

  doorPivot = new THREE.Group();
  doorPivot.name = "Door Pivot";
  doorPivot.position.copy(hinge);
  scene.add(doorPivot);
  doorPivot.updateMatrixWorld(true);
  doorPivot.attach(panel);

  // The porthole and handle are separate meshes in the source scene. Put them
  // on the pivot so they swing with the door instead of floating in place.
  const porthole = root.getObjectByName("Porthole");
  const portholeGlass = root.getObjectByName("Porthole_Glass");
  for (const part of [porthole, portholeGlass, knob]) {
    if (part) doorPivot.attach(part);
  }
  doorPivot.position.addScaledVector(out, doorInset);
  doorCenter.addScaledVector(out, doorInset);
  if (portholeGlass?.material) portholeGlass.material.side = THREE.DoubleSide;

  // The exported "frame" is actually a solid slab, so it would block the
  // doorway once the door swings. Hide it and build stone posts and a lintel
  // around a real opening instead.
  const doorFrame = root.getObjectByName("Door_Frame");
  const frameMaterial = doorFrame?.material ?? threshold.material;
  if (doorFrame) doorFrame.visible = false;

  const frameGroup = new THREE.Group();
  frameGroup.name = "Door Frame";
  scene.add(frameGroup);
  const across = new THREE.Vector3(doorDir.y, 0, -doorDir.x);
  // Sink the surround mostly into the wall so its posts plug the clipped
  // doorway edges and only a shallow lip stands proud.
  const frameRadius = wallRadius - 0.06;
  const stone = (width, height, depth, offset, y) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      frameMaterial,
    );
    mesh.position.set(
      out.x * frameRadius + across.x * offset,
      y,
      out.z * frameRadius + across.z * offset,
    );
    mesh.rotation.y = doorAzimuth;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    frameGroup.add(mesh);
  };
  for (const side of [-1, 1]) stone(0.16, 2.14, 0.38, side * 0.64, floorY + 1.07);
  stone(1.44, 0.16, 0.38, 0, floorY + 1.99);

  // Clip a doorway-shaped hole through the stacked tower bands. The six planes
  // describe the inside of a box around the door; clipIntersection removes only
  // where all six agree, i.e. the box itself, leaving the rest of the tower.
  const bottom = floorY - 0.03;
  const top = floorY + 2.05;
  // Match the outside width of the stone surround, so its posts cover the
  // cut edges from every approach angle.
  const halfWidth = 0.72;
  const clipPlanes = [
    new THREE.Plane(new THREE.Vector3(0, -1, 0), bottom),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -top),
    // Reach well past the inside face of the tower so the curved side edges
    // are cut cleanly instead of leaving thin red/white slivers.
    new THREE.Plane(new THREE.Vector3(-out.x, 0, -out.z), 1.0),
    new THREE.Plane(new THREE.Vector3(out.x, 0, out.z), -2.8),
    new THREE.Plane(new THREE.Vector3(-across.x, 0, -across.z), -halfWidth),
    new THREE.Plane(new THREE.Vector3(across.x, 0, across.z), -halfWidth),
  ];
  root.traverse((object) => {
    if (!object.isMesh || !/^Tower_Band/.test(object.name)) return;
    const material = object.material.clone();
    material.clippingPlanes = clipPlanes;
    material.clipIntersection = true;
    material.clipShadows = true;
    object.material = material;
  });

  doorReady = true;

  buildInterior(floorY, roomRadius);
}

function buildInterior(floorY, roomRadius) {
  const group = new THREE.Group();
  group.name = "Lighthouse Interior";
  scene.add(group);
  interiorGroup = group;

  const azimuth = doorAzimuth;
  const gap = 0.72;
  const height = ROOM_HEIGHT;
  const ceilingY = floorY + height;
  const topRadius = roomRadius - 0.2;
  const radiusAt = (localY) =>
    roomRadius + (topRadius - roomRadius) * (localY / height);

  // DoubleSide so the plaster still reads as a wall when the room is seen
  // through the doorway from outside. The shell itself is FrontSide, so from
  // indoors the tower disappears and the doorway opens onto the sea.
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xcbb596,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const plasterMaterial = wallMaterial.clone();
  plasterMaterial.side = THREE.FrontSide;
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b4933,
    roughness: 0.88,
    flatShading: true,
  });
  const darkWoodMaterial = new THREE.MeshStandardMaterial({
    color: 0x433025,
    roughness: 0.9,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  darkWoodMaterial.shadowSide = THREE.DoubleSide;
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x9a7448,
    roughness: 0.72,
    flatShading: true,
  });
  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0xc59a55,
    roughness: 0.34,
    metalness: 0.7,
    flatShading: true,
  });
  const ironMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c3033,
    roughness: 0.62,
    metalness: 0.45,
    flatShading: true,
  });
  const rugMaterial = new THREE.MeshStandardMaterial({
    color: 0x8c3a31,
    roughness: 1,
    flatShading: true,
  });
  const rugTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0xd7c5a6,
    roughness: 1,
    flatShading: true,
  });
  const paperMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9dfc7,
    roughness: 0.95,
    flatShading: true,
  });

  function addMesh(geometry, material, position, rotation = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  const floor = addMesh(
    new THREE.CircleGeometry(roomRadius, 40),
    woodMaterial,
    new THREE.Vector3(0, floorY, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  floor.name = "Interior Floor";
  floor.castShadow = false;
  groundTargets.push(floor);

  const thresholdFloor = addMesh(
    new THREE.BoxGeometry(1.2, 0.06, 0.62),
    trimMaterial,
    new THREE.Vector3(
      Math.sin(azimuth) * 2.12,
      floorY - 0.01,
      Math.cos(azimuth) * 2.12,
    ),
    new THREE.Euler(0, azimuth, 0),
  );
  thresholdFloor.name = "Interior Threshold";
  groundTargets.push(thresholdFloor);

  // A worn stone step between the path and the plinth, so the climb to the
  // doorway is a gentle series of steps rather than one tall hop.
  const porchStep = addMesh(
    new THREE.BoxGeometry(1.64, 0.36, 0.66),
    new THREE.MeshStandardMaterial({
      color: 0xb3a48b,
      roughness: 0.98,
      flatShading: true,
    }),
    new THREE.Vector3(
      Math.sin(azimuth) * 2.95,
      floorY - 0.68,
      Math.cos(azimuth) * 2.95,
    ),
    new THREE.Euler(0, azimuth, 0),
  );
  porchStep.name = "Porch Step";
  porchStep.castShadow = false;
  groundTargets.push(porchStep);

  addMesh(
    new THREE.RingGeometry(roomRadius - 0.16, roomRadius - 0.02, 40),
    darkWoodMaterial,
    new THREE.Vector3(0, floorY + 0.006, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );

  addMesh(
    new THREE.CircleGeometry(1.02, 32),
    rugMaterial,
    new THREE.Vector3(0, floorY + 0.014, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  addMesh(
    new THREE.RingGeometry(0.86, 1.02, 32),
    rugTrimMaterial,
    new THREE.Vector3(0, floorY + 0.02, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  addMesh(
    new THREE.RingGeometry(0.48, 0.54, 28),
    rugTrimMaterial,
    new THREE.Vector3(0, floorY + 0.02, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );

  const wall = addMesh(
    new THREE.CylinderGeometry(
      topRadius,
      roomRadius,
      height,
      40,
      1,
      true,
      azimuth + gap / 2,
      Math.PI * 2 - gap,
    ),
    wallMaterial,
    new THREE.Vector3(0, floorY + height / 2, 0),
  );
  wall.castShadow = false;

  const headerHeight = height - 1.9;
  addMesh(
    new THREE.CylinderGeometry(
      topRadius,
      radiusAt(1.9),
      headerHeight,
      16,
      1,
      true,
      azimuth - gap / 2,
      gap,
    ),
    wallMaterial,
    new THREE.Vector3(0, floorY + 1.9 + headerHeight / 2, 0),
  ).castShadow = false;

  // Wooden lining around the doorway opening.
  addMesh(
    new THREE.BoxGeometry(1.34, 0.14, 0.17),
    darkWoodMaterial,
    new THREE.Vector3(
      Math.sin(azimuth) * radiusAt(1.9),
      floorY + 1.94,
      Math.cos(azimuth) * radiusAt(1.9),
    ),
    new THREE.Euler(0, azimuth, 0),
  );
  for (const side of [-1, 1]) {
    const angle = azimuth + (side * gap) / 2;
    addMesh(
      new THREE.BoxGeometry(0.12, 1.95, 0.14),
      darkWoodMaterial,
      new THREE.Vector3(
        Math.sin(angle) * radiusAt(0.975),
        floorY + 0.975,
        Math.cos(angle) * radiusAt(0.975),
      ),
      new THREE.Euler(0, angle, 0),
    );
  }

  for (const angle of [azimuth, azimuth + Math.PI / 2]) {
    addMesh(
      new THREE.BoxGeometry(topRadius * 1.94, 0.12, 0.16),
      darkWoodMaterial,
      new THREE.Vector3(0, ceilingY - 0.1, 0),
      new THREE.Euler(0, angle, 0),
    );
  }
  addMesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.16, 12),
    brassMaterial,
    new THREE.Vector3(0, ceilingY - 0.12, 0),
  );

  // Hanging lamp.
  addMesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6),
    ironMaterial,
    new THREE.Vector3(0, ceilingY - 0.34, 0),
  );
  addMesh(
    new THREE.ConeGeometry(0.36, 0.26, 14, 1, true),
    ironMaterial,
    new THREE.Vector3(0, ceilingY - 0.72, 0),
  );
  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe2b3,
    emissive: 0xffb861,
    emissiveIntensity: 3.2,
    roughness: 0.4,
    toneMapped: false,
  });
  const bulb = addMesh(
    new THREE.SphereGeometry(0.085, 12, 10),
    bulbMaterial,
    new THREE.Vector3(0, ceilingY - 0.83, 0),
  );
  bulb.castShadow = false;

  const lampLight = new THREE.PointLight(0xffc487, 4.4, 12, 2);
  lampLight.position.set(0, ceilingY - 0.85, 0);
  group.add(lampLight);

  // A soft warm fill near the floor keeps the lower half of the room from
  // falling into pitch black away from the lamp.
  const fillLight = new THREE.PointLight(0xffdcb0, 0.75, 7, 2);
  fillLight.position.set(0, floorY + 1.5, 0);
  group.add(fillLight);

  // Little work table against the back wall.
  const backAngle = azimuth + Math.PI;
  const tableRadius = 1.22;
  const table = new THREE.Group();
  table.position.set(
    Math.sin(backAngle) * tableRadius,
    floorY,
    Math.cos(backAngle) * tableRadius,
  );
  table.rotation.y = backAngle;
  group.add(table);

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.5), woodMaterial);
  tableTop.position.set(0, 0.79, 0);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  table.add(tableTop);

  for (const x of [-0.41, 0.41]) {
    for (const z of [-0.17, 0.17]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), darkWoodMaterial);
      leg.position.set(x, 0.39, z);
      leg.castShadow = true;
      table.add(leg);
    }
  }

  const book = new THREE.Group();
  book.position.set(-0.16, 0.855, 0.05);
  book.rotation.y = 0.36 + Math.PI;
  table.add(book);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.28), paperMaterial);
  pages.castShadow = true;
  book.add(pages);
  const cover = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.28),
    new THREE.MeshStandardMaterial({ map: createBookCover(), roughness: 0.95 }),
  );
  cover.rotation.x = -Math.PI / 2;
  cover.position.y = 0.023;
  book.add(cover);

  const mugMaterial = new THREE.MeshStandardMaterial({ color: 0xe8dfc9, roughness: 0.75 });
  const coffeeMaterial = new THREE.MeshStandardMaterial({ color: 0x452516, roughness: 0.55 });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.1, 12, 1, true), mugMaterial);
  cup.position.set(0.25, 0.88, -0.08);
  cup.castShadow = true;
  table.add(cup);

  // The pale rim, dark surface, and handle keep the drink legible at a distance.
  const mugRim = new THREE.Mesh(new THREE.TorusGeometry(0.051, 0.005, 6, 12), mugMaterial);
  mugRim.rotation.x = Math.PI / 2;
  mugRim.position.set(0.25, 0.93, -0.08);
  table.add(mugRim);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.047, 12), coffeeMaterial);
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(0.25, 0.925, -0.08);
  table.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 6, 12), mugMaterial);
  handle.position.set(0.308, 0.885, -0.08);
  handle.castShadow = true;
  table.add(handle);

  // A stool beside it.
  const stool = new THREE.Group();
  stool.position.set(
    Math.sin(backAngle + 0.55) * 0.92,
    floorY,
    Math.cos(backAngle + 0.55) * 0.92,
  );
  group.add(stool);
  const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 12), woodMaterial);
  stoolSeat.position.y = 0.46;
  stoolSeat.castShadow = true;
  stool.add(stoolSeat);
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.05), darkWoodMaterial);
    leg.position.set(Math.cos(angle) * 0.13, 0.23, Math.sin(angle) * 0.13);
    leg.rotation.z = Math.cos(angle) * 0.12;
    leg.rotation.x = Math.sin(angle) * 0.12;
    stool.add(leg);
  }

  // Shelf with a few books, above the table.
  const shelf = new THREE.Group();
  shelf.position.set(
    Math.sin(backAngle) * 1.63,
    floorY + 2.02,
    Math.cos(backAngle) * 1.63,
  );
  shelf.rotation.y = backAngle;
  group.add(shelf);
  const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.05, 0.22), darkWoodMaterial);
  shelfBoard.castShadow = true;
  shelf.add(shelfBoard);
  const bookColors = [0x7c4d3a, 0x3d5a58, 0xb08a4a];
  for (let index = 0; index < 3; index += 1) {
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.24 - index * 0.02, 0.16),
      new THREE.MeshStandardMaterial({
        color: bookColors[index],
        roughness: 0.9,
        flatShading: true,
      }),
    );
    spine.position.set(-0.2 + index * 0.075, 0.145 - index * 0.01, 0);
    spine.castShadow = true;
    shelf.add(spine);
  }

  // A little brass barometer on the back wall.
  const barometer = new THREE.Group();
  barometer.position.set(
    Math.sin(backAngle) * 1.72,
    floorY + 1.55,
    Math.cos(backAngle) * 1.72,
  );
  barometer.rotation.y = forWallFacing(backAngle);
  group.add(barometer);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24), brassMaterial);
  rim.castShadow = true;
  barometer.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.155, 24), paperMaterial);
  face.position.z = 0.005;
  barometer.add(face);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.008), ironMaterial);
  needle.position.z = 0.012;
  needle.position.y = 0.035;
  needle.rotation.z = 0.5;
  barometer.add(needle);

  // Barrel and crates, tucked out of the doorway path.
  const barrelAngle = azimuth + 1.45;
  const barrel = new THREE.Group();
  barrel.position.set(
    Math.sin(barrelAngle) * 1.47,
    floorY,
    Math.cos(barrelAngle) * 1.47,
  );
  group.add(barrel);
  const barrelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.78, 12), woodMaterial);
  barrelBody.position.y = 0.39;
  barrelBody.castShadow = true;
  barrel.add(barrelBody);
  for (const ringY of [0.12, 0.66]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.035, 12), ironMaterial);
    ring.position.y = ringY;
    barrel.add(ring);
  }

  const crateAngle = azimuth - 1.3;
  const crate = new THREE.Group();
  crate.position.set(
    Math.sin(crateAngle) * 1.43,
    floorY,
    Math.cos(crateAngle) * 1.43,
  );
  crate.rotation.y = crateAngle + 0.2;
  group.add(crate);
  const crateBig = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 0.5), woodMaterial);
  crateBig.position.y = 0.25;
  crateBig.castShadow = true;
  crateBig.receiveShadow = true;
  crate.add(crateBig);
  const crateLid = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.045, 0.54), trimMaterial);
  crateLid.position.y = 0.52;
  crateLid.castShadow = true;
  crate.add(crateLid);
  const crateSmall = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.36), woodMaterial);
  crateSmall.position.set(0.12, 0.7, 0.05);
  crateSmall.rotation.y = -0.3;
  crateSmall.castShadow = true;
  crate.add(crateSmall);

  upperRoom = buildUpperRoom(scene, groundTargets, azimuth, floorY, ceilingY);
  blackjack = buildBlackjack(scene, azimuth, ceilingY, () => {
    keys.clear(); jumpQueued = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }, () => { keys.clear(); enableDragLook(true); });

  // The furniture is solid so the room feels like a room, not a stage set.
  const addInteriorCollider = (angle, distance, radius) => {
    colliders.push({
      x: Math.sin(angle) * distance,
      z: Math.cos(angle) * distance,
      radius,
    });
  };
  addInteriorCollider(backAngle, tableRadius, 0.46);
  addInteriorCollider(barrelAngle, 1.47, 0.34);
  addInteriorCollider(crateAngle, 1.43, 0.42);
  brunsonShrine = buildBrunsonShrine(group, azimuth, floorY, roomRadius, colliders);
}

function forWallFacing(angle) {
  // A plane whose default normal is +Z has to be turned around to face the
  // middle of the room from a wall at this angle.
  return angle + Math.PI;
}

function onModelLoaded(gltf) {
  model = gltf.scene;
  model.name = "Lighthouse Island";
  model.scale.setScalar(WORLD_SCALE);
  scene.add(model);
  model.updateMatrixWorld(true);
  prepareModel(model);
  settleGround(model);
  const grassSkirt = model.getObjectByName("Grass_Skirt");
  if (grassSkirt) groundTargets.push(grassSkirt);
  setupDoorAndInterior(model);

  // dock.js finds the end of the beach by walking outward until the ground
  // drops below its default minGround (1.3m, the island's old waterline).
  islands = buildIslands(scene, groundTargets, colliders, sampleGround);
  dock = buildDock(scene, groundTargets, colliders, { sampleGround });
  headland = buildHeadland(scene, groundTargets, colliders, sampleGround);
  try { wildlife = buildWildlife(scene, sampleGround, (position) => ambientAudio.wildlifeSplash(position)); }
  catch (error) { console.warn("Wildlife unavailable", error); }
  waterGraphics = createWaterGraphics({ scene, camera, renderer, water, waterMaterial, sunLight, dock });
  fisherman = buildFisherman(dock, colliders);
  brunson = buildBrunson(dock, colliders);
  fishing = buildFishing(scene, camera, dock, canvas, () => walkMode);
  tinny = buildTinny(dock, groundTargets, sea, solidAt);
  seagulls = buildSeagulls(scene, model);
  ships = buildShips(scene);
  testSetup = getTestSetup({ dock, tinny, doorAzimuth, roomFloor: ROOM_FLOOR, spawn: SPAWN, spawnLook: SPAWN_LOOK });
  if (testSetup?.fishing) fishing.giveRod();
  dayNight = buildDayNight({ scene, skyMaterial, sunSprite, sunLight, hemisphereLight, cloudMaterial, waterMaterial, lanternLight, lanternGlowMaterial, model, testSetup });

  player.ready = true;
  enterButton.disabled = false;
  enterButton.textContent = "Step onto the island";
  statusLine.textContent = "";
  // The menu starts hidden, so tell people how to begin and where it went.
  // Wait for the first frames to draw: compiling the island's shaders can
  // stall the page for seconds, which would eat the hint's 5s on screen.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    attract.start();
    startPrompt.classList.add("visible");
    showToast("Press Esc for controls or to pause", 5000);
  }));

  if (window.__lighthouse) {
    window.__lighthouse.model = model;
    window.__lighthouse.doorPivot = doorPivot;
    window.__lighthouse.interior = interiorGroup;
    window.__lighthouse.dock = dock;
    window.__lighthouse.seagulls = seagulls;
  }
}

function onModelProgress(event) {
  if (event.total > 0) {
    const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
    statusLine.textContent = `Carving the island… ${percent}%`;
  } else {
    statusLine.textContent = "Carving the island…";
  }
  showToast(statusLine.textContent);
}

function onModelError(error) {
  console.error(error);
  enterButton.textContent = "The island could not load";
  statusLine.textContent = "Start the local server with start.cmd, then reload this page.";
  showToast("The island could not load", 5000);
  overlay.classList.remove("hidden");
}

loader.load("./lighthouse.glb", onModelLoaded, onModelProgress, onModelError);

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

function toggleDoor() {
  doorOpen = !doorOpen;
  doorTarget = doorOpen ? doorOpenAngle : 0;
  ambientAudio.movementSound("door");
}

function updateDoor(dt) {
  if (doorPivot) {
    doorPivot.rotation.y = THREE.MathUtils.damp(
      doorPivot.rotation.y,
      doorTarget,
      5.5,
      dt,
    );
  }

  const near = walkMode && canUseDoor();
  const fishingAction = walkMode && !near && fishing && fishing.canInteract(camera);
  const nearFisherman = walkMode && !near && !fishingAction && fisherman && fisherman.canInteract(camera);
  const nearBrunson = walkMode && !near && !fishingAction && !nearFisherman && brunson && brunson.canInteract(camera);
  const ladderPrompt = walkMode && !near && upperRoom ? upperRoom.prompt(player, camera) : "";
  const nearBlackjack = walkMode && !near && !ladderPrompt && blackjack && !blackjack.open && blackjack.canInteract(camera);
  // The boat is moored right beside the fisherman, so it only takes the
  // prompt first while rowing; on foot, whatever you're looking at wins.
  const rowing = tinny && tinny.isRowing();
  const nearTinny = walkMode && tinny && (rowing || (!near && !fishingAction && !nearFisherman && !nearBrunson && !ladderPrompt && !nearBlackjack)) && tinny.canInteract(camera);
  interact.classList.toggle("visible", !!(near || fishingAction || nearFisherman || nearBrunson || ladderPrompt || nearBlackjack || nearTinny));
  interact.querySelector("kbd").hidden = !rowing && !near && !fishingAction && !nearFisherman && !nearBrunson && ladderPrompt.startsWith("W/S");
  if (rowing && nearTinny) interactLabel.textContent = "Leave the boat";
  else if (near) interactLabel.textContent = doorOpen ? "Close the door" : "Open the door";
  else if (fishingAction) interactLabel.textContent = fishingAction === "pickup" ? "Pick up the rod" : fishingAction === "return" ? "Put back the rod" : "Put fish in the bucket";
  else if (nearFisherman) interactLabel.textContent = "Bother the fisherman";
  else if (nearBrunson) interactLabel.textContent = "Talk to Jalen";
  else if (ladderPrompt) interactLabel.textContent = ladderPrompt;
  else if (nearBlackjack) interactLabel.textContent = "Play blackjack";
  else if (nearTinny) interactLabel.textContent = "Row the boat";
}

// ---------------------------------------------------------------------------
// Overlay, pointer lock, and a drag-to-look fallback
// ---------------------------------------------------------------------------

function setPlayingUI() {
  overlay.classList.add("hidden");
  crosshair.classList.add("visible");
  hud.classList.add("visible");
  statusLine.textContent = "";
}

function enableDragLook(quiet = false) {
  pointerLook = false;
  dragLook = true;
  pointerLockBlocked = true;
  canvas.classList.add("drag-look");
  lookHint.innerHTML = testSetup ? "<kbd>Arrows</kbd> look" : "<kbd>Drag</kbd> look";
  setPlayingUI();
  if (!quiet) console.warn("Pointer lock unavailable; using drag-to-look.");
}

function enterWalkabout() {
  if (!player.ready) return;

  if (!player.started) {
    placeAtStart();
  }

  attract.stop();
  startPrompt.classList.remove("visible");
  keys.clear();
  jumpQueued = false;
  walkMode = true;
  ambientAudio.start();
  weather.start();
  setPlayingUI();

  if (pointerLockBlocked || testSetup) {
    enableDragLook(Boolean(testSetup));
    return;
  }

  try {
    // requestPointerLock returns a promise in newer browsers; swallow its
    // rejection so a blocked lock falls back quietly instead of logging an
    // unhandled rejection.
    const request = canvas.requestPointerLock?.();
    if (request && typeof request.catch === "function") {
      request.catch(() => enableDragLook());
    }
  } catch {
    enableDragLook();
  }
}

function pauseWalkabout(message = "Paused. The lamp will wait.") {
  walkMode = false;
  ambientAudio.pause();
  weather.pause();
  keys.clear();
  jumpQueued = false;
  dragging = false;
  if (!player.started) return;

  overlay.classList.remove("hidden");
  crosshair.classList.remove("visible");
  hud.classList.remove("visible");
  enterButton.textContent = "Back to the island";
  statusLine.textContent = message;
}

enterButton.addEventListener("click", enterWalkabout);

canvas.addEventListener("click", () => {
  if (player.ready && !walkMode) enterWalkabout();
});

controls.addEventListener("lock", () => {
  pointerLook = true;
  dragLook = false;
  walkMode = true;
  canvas.classList.remove("drag-look");
  lookHint.innerHTML = "<kbd>Mouse</kbd> look";
  setPlayingUI();
});

controls.addEventListener("unlock", () => {
  if (!walkMode || blackjack?.open) return;
  pointerLook = false;
  pauseWalkabout();
});

document.addEventListener("pointerlockerror", () => {
  if (walkMode) enableDragLook();
});

// Fallback look control: click and drag the canvas when pointer lock is
// blocked by the embedding browser or by a permissions policy.
canvas.addEventListener("pointerdown", (event) => {
  if (!walkMode || !dragLook || event.button !== 0) return;
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is a nicety, not a requirement.
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging || !walkMode || !dragLook) return;

  const dx = event.movementX || event.clientX - lastPointerX;
  const dy = event.movementY || event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  cameraEuler.setFromQuaternion(camera.quaternion);
  cameraEuler.y -= dx * 0.0024;
  cameraEuler.x -= dy * 0.0024;
  cameraEuler.x = THREE.MathUtils.clamp(
    cameraEuler.x,
    -Math.PI / 2 + 0.02,
    Math.PI / 2 - 0.02,
  );
  camera.quaternion.setFromEuler(cameraEuler);
});

function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  if (event.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

canvas.addEventListener("contextmenu", (event) => {
  if (walkMode) event.preventDefault();
});

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

camera.position.set(14.5, 8.5, 18.5);
camera.lookAt(0, 8.4, 0);

const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  const frameTime = clock.getDelta();
  const dt = Math.min(frameTime, 0.05);
  elapsed += dt;

  attract.update(dt);
  updatePlayer(dt);
  if (fisherman) fisherman.update(dt, elapsed, player.feet);
  if (brunson) brunson.update(dt, elapsed, player.feet);
  if (brunsonShrine) brunsonShrine.update(elapsed);
  if (fishing) fishing.update(dt, elapsed);
  if (blackjack) blackjack.update(elapsed, camera);
  if (tinny) tinny.update(elapsed);
  if (seagulls) seagulls.update(dt, elapsed, player.feet);
  if (ships) ships.update(dt, elapsed);
  if (islands) islands.update(elapsed);
  if (headland) headland.update(elapsed);
  if (wildlife) wildlife.update(dt, elapsed, player.feet, dayNight ? dayNight.getDaylight() : 1);
  if (walkMode) ambientAudio.update(camera, player.feet, seagulls?.gulls, ROOM_FLOOR, TOWER_RADIUS);
  sea.update(camera.position.y, dt);
  updateDoor(dt);
  weather.update(dt, player.feet, walkMode);

  waterNormal.offset.x = (waterNormal.offset.x + dt * 0.012) % 1;
  waterNormal.offset.y = (waterNormal.offset.y - dt * 0.008 + 1) % 1;

  if (dayNight) dayNight.update(dt);
  if (waterGraphics) waterGraphics.update(elapsed, dayNight ? dayNight.getDaylight() : 1, frameTime);

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (waterGraphics) waterGraphics.resize();
  else renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handy for poking at the scene from the browser console.
window.__lighthouse = {
  THREE,
  setQuality,
  getQuality,
  scene,
  camera,
  controls,
  player,
  model,
  spawn: SPAWN,
  groundTargets,
  renderer,
  sampleGround,
  canStandAt,
  solidAt,
  resetPlayer,
  toggleDoor,
  isNearDoor,
  isFacingDoor,
  doorPivot,
  doorCenter,
  doorDir,
  interior: interiorGroup,
};

