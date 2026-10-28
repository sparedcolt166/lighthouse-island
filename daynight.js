import * as THREE from "three";
import { weatherDim } from "./weather.js";

// A long afternoon, a short dusk, and roughly three minutes of night.
const CYCLE_SECONDS = 720;
const STOPS = [0, 0.3, 0.44, 0.485, 0.505, 0.53, 0.57, 0.66, 0.8, 1];
const GOLD = ["#245a83", "#4e80a8", "#8fb9cc", "#ccdfe2", "#f3d8b5", "#edc7a8", "#b7cbd0", "#87999b", "#5b6f73", "#354a51"];
const DAY = ["#286b9b", "#619bc1", "#a6cbdc", "#d5e4e4", "#e9e1cf", "#d7d9cc", "#b4cbd0", "#879da1", "#5b7176", "#354a51"];
const SUNSET = ["#283e70", "#735f87", "#d18b82", "#f2b78e", "#f5c28f", "#d79680", "#85919f", "#526477", "#344a59", "#263740"];
const NIGHT = ["#071329", "#101f3b", "#1b3150", "#294461", "#38516a", "#30465b", "#21374d", "#192c3e", "#122332", "#0c1a28"];
const DUSK = ["#101c3b", "#293459", "#5b6680", "#a18291", "#d09a87", "#a17d7d", "#52657a", "#344a60", "#203747", "#142838"];
const phases = [
  { t: 0, sky: GOLD, daylight: 1, sun: 2.8, hemi: 0.8, fog: 0xd3d1c5, water: 0x0a4b61, cloud: 0xfff4e8 },
  { t: 0.12, sky: SUNSET, daylight: 0.72, sun: 1.9, hemi: 0.65, fog: 0xc49b91, water: 0x124052, cloud: 0xe7ad9d },
  { t: 0.2, sky: DUSK, daylight: 0.3, sun: 0.55, hemi: 0.42, fog: 0x67758a, water: 0x17384c, cloud: 0x8991aa },
  { t: 0.26, sky: NIGHT, daylight: 0, sun: 0.12, hemi: 0.32, fog: 0x273c55, water: 0x102b40, cloud: 0x50647c },
  { t: 0.51, sky: NIGHT, daylight: 0, sun: 0.12, hemi: 0.32, fog: 0x273c55, water: 0x102b40, cloud: 0x50647c },
  { t: 0.59, sky: DUSK, daylight: 0.3, sun: 0.55, hemi: 0.42, fog: 0x67758a, water: 0x17384c, cloud: 0x8991aa },
  { t: 0.67, sky: SUNSET, daylight: 0.72, sun: 1.9, hemi: 0.65, fog: 0xc49b91, water: 0x124052, cloud: 0xe7ad9d },
  { t: 0.77, sky: DAY, daylight: 1, sun: 3.2, hemi: 0.9, fog: 0xcbd5d4, water: 0x0d5269, cloud: 0xfff4e8 },
  { t: 1, sky: GOLD, daylight: 1, sun: 2.8, hemi: 0.8, fog: 0xd3d1c5, water: 0x0a4b61, cloud: 0xfff4e8 },
];

export function buildDayNight({ scene, skyMaterial, sunSprite, sunLight, hemisphereLight, cloudMaterial, waterMaterial, lanternLight, lanternGlowMaterial, model, testSetup }) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const skyTexture = new THREE.CanvasTexture(canvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  skyTexture.minFilter = THREE.LinearFilter;
  skyTexture.magFilter = THREE.LinearFilter;
  const originalSky = skyMaterial.map;
  skyMaterial.map = skyTexture;

  const starsGeometry = new THREE.BufferGeometry();
  const positions = [];
  // A deterministic distribution keeps the same constellations on every visit.
  let seed = 741;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 420; i++) {
    const y = 0.04 + random() * 0.95;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - y * y) * 395;
    positions.push(Math.cos(angle) * radius, y * 395, Math.sin(angle) * radius);
  }
  starsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: 0xd7e7ff, size: 1.1, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
  scene.add(new THREE.Points(starsGeometry, starsMaterial));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd9e6f3, fog: false, toneMapped: false }));
  moon.position.set(210, 235, -215);
  scene.add(moon);

  const beamGroup = new THREE.Group();
  beamGroup.position.copy(lanternLight.position);
  scene.add(beamGroup);
  const length = 130;
  const beamGeometry = new THREE.ConeGeometry(17, length, 24, 8, true);
  beamGeometry.rotateZ(Math.PI / 2);
  beamGeometry.translate(length / 2, 0, 0);
  const beamPositions = beamGeometry.getAttribute("position");
  const colors = [];
  for (let i = 0; i < beamPositions.count; i++) {
    const fade = Math.pow(1 - Math.max(0, beamPositions.getX(i)) / length, 1.5);
    colors.push(fade, fade * 0.77, fade * 0.46);
  }
  beamGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const beamMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false, toneMapped: false });
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  const oppositeBeam = new THREE.Mesh(beamGeometry, beamMaterial);
  oppositeBeam.rotation.y = Math.PI;
  beamGroup.add(beam, oppositeBeam);
  const spot = new THREE.SpotLight(0xffdfa8, 0, 150, 0.16, 0.65, 2);
  spot.position.copy(lanternLight.position);
  scene.add(spot, spot.target);

  const windows = new Set();
  model.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (material && material.name === "Window Lit") windows.add(material);
    }
  });
  const c1 = new THREE.Color();
  const c2 = new THREE.Color();
  const direction = new THREE.Vector3();
  const skyColor = new THREE.Color();
  const initialDirection = new THREE.Vector3(-12, 0, 16).normalize();
  let phase = testSetup && new URLSearchParams(window.location.search).get("test") === "night" ? 0.35 : 0;
  let speed = 1;
  let skyTimer = 1;
  let daylight = 1;
  let elapsed = 0;

  function update(dt) {
    try {
      elapsed += dt;
      phase = (phase + dt * speed / CYCLE_SECONDS) % 1;
      let index = 0;
      while (index < phases.length - 2 && phase > phases[index + 1].t) index++;
      const a = phases[index];
      const b = phases[index + 1];
      const raw = (phase - a.t) / (b.t - a.t);
      const mix = raw * raw * (3 - 2 * raw);
      const blend = THREE.MathUtils.lerp;
      daylight = blend(a.daylight, b.daylight, mix);
      skyTimer += dt;
      if (skyTimer >= 1) {
        skyTimer = 0;
        const gradient = context.createLinearGradient(0, 0, 0, 512);
        for (let i = 0; i < STOPS.length; i++) {
          c1.set(a.sky[i]).lerp(c2.set(b.sky[i]), mix);
          gradient.addColorStop(STOPS[i], `#${c1.getHexString()}`);
        }
        context.fillStyle = gradient;
        context.fillRect(0, 0, 8, 512);
        skyTexture.needsUpdate = true;
      }
      const altitude = Math.asin(20 / Math.sqrt(12 * 12 + 20 * 20 + 16 * 16)) - phase * Math.PI * 2;
      direction.set(initialDirection.x * Math.cos(altitude), Math.sin(altitude), initialDirection.z * Math.cos(altitude));
      sunSprite.position.copy(direction).multiplyScalar(360);
      sunSprite.material.opacity = 0.7 * THREE.MathUtils.smoothstep(direction.y, -0.05, 0.15);
      // Keep the shadow camera centred on the island as the light travels.
      if (direction.y > 0.02) sunLight.position.copy(direction).multiplyScalar(70).add(sunLight.target.position);
      else sunLight.position.set(25, 65, -25).add(sunLight.target.position);
      sunLight.intensity = blend(a.sun, b.sun, mix);
      sunLight.color.set(0xffd0a0).lerp(c1.set(0x8eaddb), 1 - daylight);
      hemisphereLight.intensity = blend(a.hemi, b.hemi, mix);
      hemisphereLight.color.set(0xbdd9ef).lerp(c1.set(0x7696c5), 1 - daylight);
      skyColor.set(a.sky[4]).lerp(c1.set(b.sky[4]), mix);
      scene.fog.color.set(a.fog).lerp(c1.set(b.fog), mix);
      waterMaterial.color.set(a.water).lerp(c1.set(b.water), mix);
      cloudMaterial.color.set(a.cloud).lerp(c1.set(b.cloud), mix);
      // Showers dim on top of the time of day, as weather.js describes: this
      // runs after it each frame, so the base values here would otherwise win.
      const shower = weatherDim * weatherDim * (3 - 2 * weatherDim);
      cloudMaterial.color.lerp(c1.set(0x6f777d).multiplyScalar(0.35 + 0.65 * daylight), shower * 0.7);
      sunLight.intensity *= 1 - 0.4 * shower;
      hemisphereLight.intensity *= 1 - 0.25 * shower;
      cloudMaterial.emissiveIntensity = 0.42 * (0.2 + 0.8 * daylight);
      scene.environmentIntensity = 0.85 * (0.3 + 0.7 * daylight);
      const night = 1 - daylight;
      starsMaterial.opacity = night * (0.8 + 0.12 * Math.sin(elapsed * 1.7));
      moon.visible = night > 0.05;
      moon.material.color.set(0xd9e6f3).multiplyScalar(night);
      const flicker = 0.94 + Math.sin(elapsed * 7.3) * 0.035 + Math.sin(elapsed * 13.1 + 1.7) * 0.02;
      lanternLight.intensity = (200 + 240 * night) * flicker;
      lanternGlowMaterial.opacity = (0.58 + 0.3 * night) * flicker;
      for (const material of windows) material.emissiveIntensity = 1.8 + 2.4 * night;
      beamGroup.rotation.y = elapsed * Math.PI * 2 / 9;
      beamMaterial.opacity = 0.065 * night;
      spot.intensity = 18000 * night;
      spot.target.position.set(Math.cos(beamGroup.rotation.y) * 100, 0, -Math.sin(beamGroup.rotation.y) * 100);
    } catch (error) {
      // Lighting must never stop movement or rendering on a browser with missing features.
      console.warn("Day/night update failed", error);
    }
  }
  update(0);
  originalSky.dispose();
  return {
    update,
    getDaylight: () => daylight,
    getSkyColor: () => skyColor,
    getFogColor: () => scene.fog.color,
    toggleSpeed: () => { speed = speed === 1 ? 60 : 1; return speed; },
  };
}
