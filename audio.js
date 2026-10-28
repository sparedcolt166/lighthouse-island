import { createFootsteps } from "./footsteps.js";
import * as THREE from "three";

// Peaks land around -10 dBFS: audible on laptop speakers, never clipping.
const MASTER_VOLUME = 0.9;

export function createAmbientAudio() {
  let context = null;
  let master, musicGain, effectsGain, outside, outsideFilter;
  let masterVolume = 1, musicVolume = 1, effectsVolume = 1;
  let muted = false;
  let nextGull = 0, nextNote = 0, nextPad = 0, nextListener = 0;
  let footsteps = null;
  let sheltered = false;
  let broken = false;
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const notes = [220, 246.94, 293.66, 329.63, 369.99, 440, 493.88, 587.33];
  const random = (min, max) => min + Math.random() * (max - min);

  function makeBed(buffer, frequency, gain, swellRate, swellDepth) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const volume = context.createGain();
    const swell = context.createOscillator();
    const depth = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    volume.gain.value = gain;
    swell.frequency.value = swellRate;
    depth.gain.value = swellDepth;
    source.connect(filter).connect(volume).connect(outsideFilter);
    swell.connect(depth).connect(volume.gain);
    source.start();
    swell.start();
  }

  function initialize() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME * masterVolume;
    master.connect(context.destination);
    musicGain = context.createGain(); musicGain.gain.value = musicVolume; musicGain.connect(master);
    effectsGain = context.createGain(); effectsGain.gain.value = effectsVolume; effectsGain.connect(master);
    outside = context.createGain();
    outside.gain.value = 1;
    outside.connect(effectsGain);
    outsideFilter = context.createBiquadFilter();
    outsideFilter.type = "lowpass";
    outsideFilter.frequency.value = 6000;
    outsideFilter.connect(outside);
    const noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    // Fade both ends to silence so the noise loop cannot click at its seam.
    const fadeSamples = Math.floor(context.sampleRate * 0.04);
    for (let i = 0; i < fadeSamples; i++) {
      const fade = i / fadeSamples;
      samples[i] *= fade;
      samples[samples.length - 1 - i] *= fade;
    }
    footsteps = createFootsteps(context, effectsGain, noise);
    // Two slow, independent swells keep the repeating noise bed unobtrusive.
    makeBed(noise, 650, 0.16, 0.075, 0.10);
    makeBed(noise, 1800, 0.035, 0.043, 0.018);
    nextGull = context.currentTime + random(8, 16);
    nextNote = context.currentTime + 2;
    nextPad = context.currentTime + 0.5;
    return true;
  }

  function tone(frequency, start, duration, volume, type) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + (type === "sine" ? 0.06 : 2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(musicGain);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function gullCall(gull, now) {
    const position = gull.root.position;
    const panner = context.createPanner();
    panner.panningModel = "equalpower";
    panner.distanceModel = "inverse";
    panner.refDistance = 12;
    panner.rolloffFactor = 0.7;
    if (panner.positionX) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }
    panner.connect(outsideFilter);
    const count = Math.random() < 0.5 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const start = now + i * 0.37;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "triangle";
      const pitch = random(620, 850);
      oscillator.frequency.setValueAtTime(pitch, start);
      oscillator.frequency.linearRampToValueAtTime(pitch * 1.35, start + 0.12);
      oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.72, start + 0.3);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(0.12, start + 0.05);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      oscillator.connect(envelope).connect(panner);
      oscillator.start(start);
      oscillator.stop(start + 0.33);
    }
  }

  function update(camera, feet, gulls, roomFloor, towerRadius) {
    if (!context || context.state !== "running") return;
    const now = context.currentTime;
    const inside = feet.y >= roomFloor - 0.3 && feet.y < roomFloor + 12 &&
      feet.x * feet.x + feet.z * feet.z < towerRadius * towerRadius * 0.64;
    if (inside !== sheltered) {
      sheltered = inside;
      outside.gain.setTargetAtTime(inside ? 0.32 : 1, now, 0.8);
      outsideFilter.frequency.setTargetAtTime(inside ? 700 : 6000, now, 0.8);
    }
    if (now >= nextListener) {
      const listener = context.listener;
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      // Firefox has no AudioListener.positionX & co., only the older setters.
      if (listener.positionX) {
        listener.positionX.value = camera.position.x;
        listener.positionY.value = camera.position.y;
        listener.positionZ.value = camera.position.z;
        listener.forwardX.value = forward.x;
        listener.forwardY.value = forward.y;
        listener.forwardZ.value = forward.z;
        listener.upX.value = up.x;
        listener.upY.value = up.y;
        listener.upZ.value = up.z;
      } else {
        listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
        listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
      }
      nextListener = now + 0.2;
    }
    if (now >= nextGull && gulls && gulls.length) {
      gullCall(gulls[Math.floor(Math.random() * gulls.length)], now);
      nextGull = now + random(10, 30);
    }
    if (now >= nextNote) {
      tone(notes[Math.floor(Math.random() * notes.length)], now, random(2.2, 3.5), 0.05, "sine");
      nextNote = now + random(2.8, 6.5);
    }
    if (now >= nextPad) {
      const root = notes[Math.floor(Math.random() * 4)] / 2;
      tone(root, now, 10, 0.025, "triangle");
      tone(root * 1.5, now, 10, 0.016, "triangle");
      nextPad = now + random(8, 12);
    }
  }

  return {
    movementSound(action, ...args) {
      try {
        if (footsteps) footsteps[action](...args);
      } catch (error) {
        console.warn("Movement audio unavailable", error);
        footsteps = null;
      }
    },
    start() {
      try {
        if (!context && !initialize()) return;
        context.resume().catch(() => {});
      } catch (error) {
        console.warn("Ambient audio unavailable", error);
      }
    },
    pause() {
      if (context) context.suspend().catch(() => {});
    },
    getMuted: () => muted,
    setMuted(value) { muted = Boolean(value); if (context) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME * masterVolume, context.currentTime, 0.05); },
    setVolumes(settings) {
      masterVolume = settings.master; musicVolume = settings.music; effectsVolume = settings.effects;
      if (context && master && musicGain && effectsGain) { master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME * masterVolume, context.currentTime, 0.05); musicGain.gain.setTargetAtTime(musicVolume, context.currentTime, 0.05); effectsGain.gain.setTargetAtTime(effectsVolume, context.currentTime, 0.05); }
    },
    toggleMute() {
      muted = !muted;
      if (context) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME * masterVolume, context.currentTime, 0.05);
      return muted;
    },
    // This runs inside the render loop, so a browser quirk here must never
    // stop the frame: give up on ambience instead of freezing the game.
    update(...args) {
      if (broken) return;
      try {
        update(...args);
      } catch (error) {
        broken = true;
        console.warn("Ambient audio stopped updating", error);
      }
    },
  };
}
