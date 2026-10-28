import * as THREE from "three";

// Day/night can use this factor after setting its own base light intensities:
// sun *= 1 - 0.4 * weatherDim; hemisphere *= 1 - 0.25 * weatherDim.
export let weatherDim = 0;

export function createWeather(scene, camera, cloudMaterial, sampleGround, roomFloor, towerRadius, testRain) {
  const random = (min, max) => min + Math.random() * (max - min);
  let phase = testRain ? "shower" : "clear";
  let remaining = testRain ? random(90, 180) : random(180, 360);
  weatherDim = testRain ? 1 : 0;
  const fogNear = scene.fog?.near, fogFar = scene.fog?.far;
  const count = 1500, width = 24, height = 18;
  const positions = new Float32Array(count * 6);
  const drops = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    drops[i * 3] = random(-width / 2, width / 2);
    drops[i * 3 + 1] = random(-5, height - 5);
    drops[i * 3 + 2] = random(-width / 2, width / 2);
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.LineBasicMaterial({ color: 0xb8cbd0, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  scene.add(rain);

  const cloudGroup = new THREE.Group();
  const darkGeometry = new THREE.IcosahedronGeometry(1, 1);
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x66757e, transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Mesh(darkGeometry, darkMaterial);
    const angle = i * Math.PI * 2 / 7;
    cloud.position.set(Math.cos(angle) * 100, random(55, 70), Math.sin(angle) * 100);
    cloud.scale.set(random(20, 30), random(4, 7), random(11, 18));
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);
  // A translucent dome dims the sky without changing the day/night sky material.
  const skyOverlay = new THREE.Mesh(new THREE.SphereGeometry(410, 24, 12), new THREE.MeshBasicMaterial({
    color: 0x56646c, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false,
  }));
  skyOverlay.renderOrder = 0;
  scene.add(skyOverlay);

  const ringGeometry = new THREE.RingGeometry(0.8, 1, 16);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc2d4d5, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  const rings = [];
  for (let i = 0; i < 32; i++) {
    const mesh = new THREE.Mesh(ringGeometry, ringMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    rings.push({ mesh, age: 1 });
  }
  let nextRing = 0, ringIndex = 0;
  let context = null, master = null, filter = null, noise = null, muted = false, playing = false;
  let volume = 1;
  let nextTick = 0, nextThunder = 0;
  function start() {
    playing = true;
    try {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext();
        noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.min(1, i / 2000, (data.length - i) / 2000);
        const source = context.createBufferSource();
        source.buffer = noise;
        source.loop = true;
        filter = context.createBiquadFilter();
        filter.type = "lowpass";
        master = context.createGain();
        master.gain.value = 0;
        source.connect(filter).connect(master).connect(context.destination);
        source.start();
        nextThunder = context.currentTime + random(35, 80);
      }
      if (context.state === "suspended") context.resume().catch(() => {});
    } catch { context = null; }
  }
  function soundEvent(thunder, strength) {
    const now = context.currentTime;
    const source = context.createBufferSource();
    const tone = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noise;
    tone.type = thunder ? "lowpass" : "bandpass";
    tone.frequency.value = thunder ? 110 : random(1800, 4000);
    const duration = thunder ? 3 : 0.06;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime((thunder ? 0.18 : 0.025) * strength, now + (thunder ? 0.6 : 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(tone).connect(gain).connect(master);
    source.start(now);
    source.stop(now + duration);
  }
  function update(dt, feet, active) {
    try {
      remaining -= dt;
      if (remaining <= 0) {
        phase = phase === "clear" ? "shower" : "clear";
        remaining = phase === "clear" ? random(180, 360) : random(90, 180);
      }
      weatherDim = THREE.MathUtils.clamp(weatherDim + (phase === "shower" ? dt : -dt) / 20, 0, 1);
      const dim = weatherDim * weatherDim * (3 - 2 * weatherDim);
      // daynight.js owns the cloud colour and greys it by weatherDim.
      darkMaterial.opacity = dim * 0.75;
      cloudGroup.rotation.y += dt * 0.002;
      skyOverlay.material.opacity = dim * 0.38;
      if (scene.fog && fogNear !== undefined) {
        scene.fog.near = fogNear * (1 - 0.35 * dim);
        scene.fog.far = fogFar * (1 - 0.35 * dim);
      }
      const inside = active && feet.y >= roomFloor - 0.3 && feet.y < roomFloor + 12 &&
        feet.x * feet.x + feet.z * feet.z < towerRadius * towerRadius * 0.64;
      rain.visible = dim > 0.001 && !inside;
      rainMaterial.opacity = dim * 0.35;
      rain.position.copy(camera.position);
      if (rain.visible) {
        for (let i = 0; i < count; i++) {
          const d = i * 3, p = i * 6;
          drops[d + 1] -= dt * 13;
          drops[d] += dt * 1.2;
          if (drops[d + 1] < -5) drops[d + 1] += height;
          if (drops[d] > width / 2) drops[d] -= width;
          positions[p] = drops[d]; positions[p + 1] = drops[d + 1]; positions[p + 2] = drops[d + 2];
          positions[p + 3] = drops[d] - 0.08; positions[p + 4] = drops[d + 1] + 0.9; positions[p + 5] = drops[d + 2];
        }
        rainGeometry.attributes.position.needsUpdate = true;
      }
      nextRing -= dt;
      if (active && !inside && dim > 0.1 && nextRing <= 0) {
        nextRing = random(0.08, 0.2) / dim;
        const x = camera.position.x + random(-8, 8), z = camera.position.z + random(-8, 8);
        const ground = sampleGround(x, z, camera.position.y + 5);
        const y = Math.max(0, ground ?? 0);
        if (y < camera.position.y + 2 && Math.hypot(x, z) > towerRadius * 1.2) {
          const ring = rings[ringIndex++ % rings.length];
          ring.age = 0;
          ring.mesh.position.set(x, y + 0.035, z);
        }
      }
      for (const ring of rings) {
        ring.age += dt;
        ring.mesh.visible = active && !inside && ring.age < 0.8 && dim > 0.01;
        if (ring.mesh.visible) ring.mesh.scale.setScalar(0.04 + ring.age * 0.32);
      }
      if (context && master) {
        const now = context.currentTime;
        master.gain.setTargetAtTime(playing && !muted ? volume * dim * (inside ? 0.025 : 0.11) : 0, now, 0.4);
        filter.frequency.setTargetAtTime(inside ? 700 : 3500, now, 0.5);
        if (playing && !muted && dim > 0.2 && now >= nextTick) {
          soundEvent(false, dim); nextTick = now + random(0.15, 0.55);
        }
        if (playing && !muted && dim > 0.5 && now >= nextThunder) {
          soundEvent(true, dim); nextThunder = now + random(55, 120);
        }
      }
    } catch {
      // Weather is cosmetic; an audio or geometry failure must not stop rendering.
    }
  }
  return { update, start, pause() { playing = false; }, setMuted(value) { muted = value; }, setVolume(value) { volume = value; } };
}
