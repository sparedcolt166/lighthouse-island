// A separate, slowly repeating theme leaves the island's generative music room
// to take over as the player steps ashore.
export function createTitleMusic(ambientAudio) {
  let context, volume, timer;
  let mode = "title";
  let nextPhrase = 0;
  let phrase = 0;
  let button;

  function setLevel() {
    if (!context || !volume) return;
    const target = mode === "title" ? 0.7 : mode === "pause" ? 0.24 : 0;
    volume.gain.setTargetAtTime(target, context.currentTime, 1);
  }

  function note(frequency, start, duration, level, type, attack) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(level, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(volume);
    envelope.connect(reverb);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  let reverb;
  function initialize() {
    const output = ambientAudio.titleOutput();
    if (!output) return false;
    context = output.context;
    volume = context.createGain();
    volume.gain.value = 0;
    volume.connect(output.master);
    reverb = context.createConvolver();
    const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 2.4), context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.003;
      }
    }
    reverb.buffer = impulse;
    reverb.connect(volume);

    // A filtered, gently breathing noise bed suggests distant water without a
    // rhythmic loop or a distracting foreground wave.
    const noise = context.createBuffer(1, context.sampleRate * 6, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const fade = Math.min(1, i / (context.sampleRate * 0.1), (samples.length - 1 - i) / (context.sampleRate * 0.1));
      samples[i] = (Math.random() * 2 - 1) * fade;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const swell = context.createGain();
    const lfo = context.createOscillator();
    const depth = context.createGain();
    source.buffer = noise;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    swell.gain.value = 0.035;
    lfo.frequency.value = 0.055;
    depth.gain.value = 0.018;
    source.connect(filter).connect(swell).connect(volume);
    lfo.connect(depth).connect(swell.gain);
    source.start();
    lfo.start();
    timer = window.setInterval(schedule, 500);
    setLevel();
    return true;
  }

  function schedule() {
    try {
      if (!context || context.state !== "running" || mode === "game") return;
      const now = context.currentTime;
      if (nextPhrase > now + 0.5) return;
      const start = Math.max(now + 0.05, nextPhrase);
      const chords = [[146.83, 174.61, 220], [130.81, 164.81, 196], [110, 164.81, 220], [130.81, 174.61, 220]];
      const melody = [[440, 523.25, 493.88], [392, 440, 329.63], [440, 493.88, 523.25], [392, 349.23, 329.63]];
      const index = phrase++ % chords.length;
      chords[index].forEach(frequency => note(frequency, start, 12, 0.018, "triangle", 2.5));
      melody[index].forEach((frequency, i) => note(frequency, start + 1 + i * 2.2, 4, 0.032, "sine", 0.06));
      nextPhrase = start + 9;
    } catch (error) {
      window.clearInterval(timer);
      console.warn("Title music stopped", error);
    }
  }

  function updateButton() {
    if (button) button.hidden = mode !== "title" || !context || context.state === "running";
  }

  function start() {
    try {
      if (!context && !initialize()) return;
      setLevel();
      // Autoplay may be allowed; otherwise the title button supplies a gesture.
      const resumed = context.resume();
      if (resumed && typeof resumed.then === "function") resumed.then(updateButton, updateButton);
      updateButton();
      schedule();
    } catch (error) {
      console.warn("Title music unavailable", error);
    }
  }

  button = document.createElement("button");
  button.type = "button";
  button.textContent = "Sound on";
  button.setAttribute("aria-label", "Turn on title music");
  button.hidden = true;
  Object.assign(button.style, {
    position: "fixed", right: "24px", bottom: "24px", zIndex: "6",
    padding: "9px 13px", border: "1px solid rgba(243, 230, 210, 0.5)",
    borderRadius: "3px", background: "rgba(5, 19, 25, 0.75)",
    color: "#f3e6d2", font: "600 11px system-ui, sans-serif",
    letterSpacing: "0.08em", cursor: "pointer",
  });
  button.addEventListener("keydown", event => event.stopPropagation());
  button.addEventListener("click", event => { event.stopPropagation(); start(); });
  document.body.appendChild(button);

  return {
    start,
    setMode(nextMode) {
      try {
        mode = nextMode;
        if (context) setLevel();
        updateButton();
        if (mode !== "game") start();
      } catch (error) {
        console.warn("Title music transition unavailable", error);
      }
    },
  };
}
