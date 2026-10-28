import * as THREE from "three";

const LEVELS = ["low", "medium", "high"];
const SETTINGS = {
  low: { segments: 32, pixelRatio: 1, shadow: 512, sparkle: 0.35, foam: 0.45 },
  medium: { segments: 64, pixelRatio: 1.35, shadow: 1024, sparkle: 0.7, foam: 0.7 },
  high: { segments: 96, pixelRatio: 2, shadow: 2048, sparkle: 1, foam: 1 },
};
let quality = (window.devicePixelRatio || 1) > 1.5 ? "medium" : "high";
let applyQuality = null;
let manualQuality = false;

export function getQuality() { return quality; }
export function setQuality(level) {
  if (!LEVELS.includes(level)) return false;
  quality = level;
  manualQuality = true;
  if (applyQuality) applyQuality();
  return true;
}

export function createWaterGraphics({ scene, camera, renderer, water, waterMaterial, sunLight, dock }) {
  const halfSize = 40;
  const uniforms = {
    seaTime: { value: 0 }, seaCenter: { value: new THREE.Vector2() },
    seaPatch: { value: 0 }, seaLight: { value: 1 }, seaSparkle: { value: 1 },
    seaSun: { value: new THREE.Vector2(-0.6, 0.8) },
  };
  waterMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
      uniform float seaTime; uniform float seaPatch;
      varying vec3 seaWorld;
    `).replace("#include <begin_vertex>", `#include <begin_vertex>
      if (seaPatch > 0.5) {
        vec2 worldXZ = (modelMatrix * vec4(position, 1.0)).xz;
        float edge = 1.0 - smoothstep(30.0, 40.0, max(abs(position.x), abs(position.y)));
        transformed.z += edge * (0.045 * sin(worldXZ.x * 0.15 + worldXZ.y * 0.09 + seaTime * 1.15)
          + 0.018 * sin(worldXZ.x * 0.44 - worldXZ.y * 0.31 + seaTime * 1.9));
      }
      seaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
      uniform float seaTime; uniform vec2 seaCenter; uniform float seaPatch;
      uniform float seaLight; uniform float seaSparkle; uniform vec2 seaSun;
      varying vec3 seaWorld;
    `).replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
      if (seaPatch < 0.5 && max(abs(seaWorld.x - seaCenter.x), abs(seaWorld.z - seaCenter.y)) < 39.99) discard;
    `).replace("#include <color_fragment>", `#include <color_fragment>
      float shore = max(1.0 - smoothstep(12.5, 28.0, length(seaWorld.xz)),
                        1.0 - smoothstep(8.0, 19.0, length(seaWorld.xz - vec2(0.0, 71.0))));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.65, 1.38, 1.23), shore * 0.65);
    `).replace("#include <dithering_fragment>", `
      vec2 toPoint = seaWorld.xz - cameraPosition.xz;
      float dist = length(toPoint);
      vec2 ray = toPoint / max(dist, 0.001);
      float sunPath = pow(max(dot(ray, normalize(seaSun)), 0.0), 32.0);
      vec2 moonDirection = normalize(vec2(210.0, -215.0));
      float moonPath = pow(max(dot(ray, moonDirection), 0.0), 56.0);
      float fleck = pow(max(0.0, sin(seaWorld.x * 2.8 + seaTime * 1.4) * sin(seaWorld.z * 3.4 - seaTime)), 12.0);
      float golden = 1.0 + 2.0 * (1.0 - abs(seaLight * 2.0 - 1.0));
      vec3 glint = vec3(1.0, 0.76, 0.47) * sunPath * seaLight * golden * 0.14
        + vec3(0.48, 0.65, 1.0) * moonPath * (1.0 - seaLight) * 0.09;
      gl_FragColor.rgb += glint * fleck * seaSparkle * smoothstep(2.0, 12.0, dist);
      #include <dithering_fragment>
    `);
  };
  waterMaterial.customProgramCacheKey = () => "island-water-graphics-v1";
  waterMaterial.needsUpdate = true;
  water.onBeforeRender = () => { uniforms.seaPatch.value = 0; };
  const patchMaterial = waterMaterial.clone();
  patchMaterial.onBeforeCompile = waterMaterial.onBeforeCompile;
  patchMaterial.customProgramCacheKey = waterMaterial.customProgramCacheKey;
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 64, 64), patchMaterial);
  patch.rotation.x = -Math.PI / 2;
  patch.frustumCulled = false;
  patch.receiveShadow = true;
  patch.onBeforeRender = () => { uniforms.seaPatch.value = 1; };
  scene.add(patch);

  // A soft radial alpha avoids hard white outlines against the shore.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.78, "rgba(255,255,255,0)");
  gradient.addColorStop(0.9, "rgba(255,255,255,0.65)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const foamTexture = new THREE.CanvasTexture(canvas);
  const foamMaterial = new THREE.MeshBasicMaterial({ map: foamTexture, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const foam = new THREE.Group();
  const foamGeometry = new THREE.PlaneGeometry(2, 2);
  function addFoam(x, z, radius, parent = foam) {
    const ring = new THREE.Mesh(foamGeometry, foamMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.075, z);
    ring.scale.setScalar(radius);
    parent.add(ring);
  }
  addFoam(0, 0, 13.2);
  addFoam(0, 71, 8.3);
  for (let z = dock.deckStart + 0.4; z <= dock.deckEnd - 0.15; z += 1.8) {
    for (const x of [-1.08, 1.08]) {
      const point = dock.group.localToWorld(new THREE.Vector3(x, 0, z));
      addFoam(point.x, point.z, 0.48);
    }
  }
  scene.add(foam);
  let sampleTime = 0, sampleFrames = 0, sampleDone = false;
  applyQuality = () => {
    const settings = SETTINGS[quality];
    const old = patch.geometry;
    patch.geometry = new THREE.PlaneGeometry(halfSize * 2, halfSize * 2, settings.segments, settings.segments);
    old.dispose();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (sunLight.shadow.mapSize.x !== settings.shadow) {
      sunLight.shadow.mapSize.set(settings.shadow, settings.shadow);
      if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
    }
    uniforms.seaSparkle.value = settings.sparkle;
    foamMaterial.opacity = 0.55 * settings.foam;
  };
  applyQuality();
  return {
    resize() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SETTINGS[quality].pixelRatio)); },
    update(elapsed, daylight, dt) {
      try {
        patch.position.set(camera.position.x, 0, camera.position.z);
        uniforms.seaCenter.value.set(camera.position.x, camera.position.z);
        uniforms.seaTime.value = elapsed;
        uniforms.seaLight.value = daylight;
        patchMaterial.color.copy(waterMaterial.color);
        uniforms.seaSun.value.set(sunLight.position.x, sunLight.position.z);
        foamMaterial.opacity = 0.55 * SETTINGS[quality].foam * (0.82 + 0.18 * Math.sin(elapsed * 0.8));
        if (!sampleDone && !manualQuality && document.visibilityState === "visible") {
          sampleTime += dt; sampleFrames++;
          if (sampleTime >= 4) {
            sampleDone = true;
            if (sampleFrames / sampleTime < 40 && quality !== "low") {
              quality = LEVELS[LEVELS.indexOf(quality) - 1];
              applyQuality();
            }
          }
        }
      } catch (error) { console.warn("Water graphics update failed", error); }
    },
  };
}
