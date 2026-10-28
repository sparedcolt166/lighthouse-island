export function createFootsteps(context, destination, noise) {
  let left = false;
  let ladderDistance = 0;
  const random = (min, max) => min + Math.random() * (max - min);

  function surface(hit, feet) {
    if (feet.y < -0.08) return "water";
    if (!hit) return "stone";
    const object = hit.object;
    const material = Array.isArray(object.material) ? object.material[hit.face?.materialIndex || 0] : object.material;
    const name = `${object.name} ${material?.name || ""} ${object.parent?.name || ""}`.toLowerCase();
    if (name.includes("dock") || name.includes("interior floor") || name.includes("interior threshold") || name.includes("upper room") || name.includes("tinny")) return "wood";
    if (name.includes("sand") || name.includes("shore")) return "sand";
    if (name.includes("grass")) return "grass";
    return "stone";
  }

  function play(kind, strength = 1) {
    if (context.state !== "running") return;
    const now = context.currentTime;
    const pan = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    if (pan.pan) pan.pan.value = (left ? -1 : 1) * 0.18;
    left = !left;
    pan.connect(destination);
    const level = strength * random(0.85, 1.15);
    const duration = kind === "water" ? 0.27 : kind === "grass" ? 0.16 : 0.12;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noise;
    source.playbackRate.value = random(0.85, 1.15);
    filter.type = kind === "stone" ? "highpass" : "bandpass";
    filter.frequency.value = random(0.85, 1.15) * ({ grass: 1800, sand: 2500, wood: 800, stone: 2200, water: 950 }[kind]);
    filter.Q.value = kind === "water" ? 0.6 : 0.9;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(level * ({ grass: 0.08, sand: 0.11, wood: 0.055, stone: 0.045, water: 0.16 }[kind]), now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(pan);
    source.start(now, random(0.1, 2.5));
    source.stop(now + duration);
    if (kind === "wood" || kind === "stone" || kind === "water") {
      const tone = context.createOscillator();
      const gain = context.createGain();
      const pitch = (kind === "wood" ? 190 : kind === "stone" ? 630 : 145) * random(0.85, 1.15);
      tone.type = kind === "stone" ? "triangle" : "sine";
      tone.frequency.setValueAtTime(pitch, now);
      tone.frequency.exponentialRampToValueAtTime(pitch * 0.55, now + 0.09);
      gain.gain.setValueAtTime(level * (kind === "wood" ? 0.13 : 0.06), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      tone.connect(gain).connect(pan);
      tone.start(now);
      tone.stop(now + 0.1);
    }
  }

  return {
    step(hit, feet) { play(surface(hit, feet)); },
    land(hit, feet, speed) { if (speed > 2) play(surface(hit, feet), Math.min(1.6, 0.55 + speed * 0.12)); },
    climb(distance) {
      ladderDistance += Math.abs(distance);
      if (ladderDistance >= 0.45) { ladderDistance %= 0.45; play("wood", 0.75); }
    },
    door() {
      if (context.state !== "running") return;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(random(90, 120), now);
      oscillator.frequency.linearRampToValueAtTime(random(135, 170), now + 0.35);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      oscillator.connect(gain).connect(destination);
      oscillator.start(now);
      oscillator.stop(now + 0.5);
    },
  };
}
