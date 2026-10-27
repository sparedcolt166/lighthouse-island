import * as THREE from "three";

// Title-screen camera: once the island loads, glide in from out at sea, then
// circle the lighthouse slowly with a gentle bob until the player starts.

// Starts far enough out that the island emerges from the fog (fog begins at 95).
const FLY_IN_SECONDS = 7;
const START_RADIUS = 150;
const START_HEIGHT = 42;
const ORBIT_RADIUS = 24;
const ORBIT_HEIGHT = 9.5;
// About 2.5 minutes per lap: slow enough to read as drifting, not spinning.
const ORBIT_SPEED = 0.042;
const BOB_HEIGHT = 0.45;
const BOB_SPEED = 0.7;
const LOOK_AT = new THREE.Vector3(0, 8.2, 0);

export function createAttractCamera(camera) {
  // Begin on the same bearing as the static view shown while loading.
  let angle = Math.atan2(camera.position.x, camera.position.z);
  let time = 0;
  let active = false;
  const lookTarget = new THREE.Vector3();

  function update(dt) {
    if (!active) return;
    time += dt;
    angle += ORBIT_SPEED * dt;

    // Ease out so the approach decelerates into the orbit instead of stopping.
    const t = Math.min(time / FLY_IN_SECONDS, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const radius = THREE.MathUtils.lerp(START_RADIUS, ORBIT_RADIUS, ease);
    const height = THREE.MathUtils.lerp(START_HEIGHT, ORBIT_HEIGHT, ease);
    const bob = Math.sin(time * BOB_SPEED) * BOB_HEIGHT * ease;

    camera.position.set(Math.sin(angle) * radius, height + bob, Math.cos(angle) * radius);
    // The look point bobs a little less than the camera, so the view tilts
    // slightly like it's riding on the air.
    lookTarget.copy(LOOK_AT);
    lookTarget.y += bob * 0.4;
    camera.lookAt(lookTarget);
  }

  return {
    start() {
      active = true;
    },
    stop() {
      active = false;
    },
    get active() {
      return active;
    },
    update,
  };
}
