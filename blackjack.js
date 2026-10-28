import * as THREE from "three";
import { LADDER_OFFSET } from "./upper-room.js";

export function buildBlackjack(scene, azimuth, floorY, onOpen, onClose) {
  const angle = azimuth + LADDER_OFFSET;
  const group = new THREE.Group();
  group.position.y = floorY; group.rotation.y = angle; scene.add(group);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const wood = material(0x4c3023), skin = material(0xb87955), black = material(0x1b2023), shirt = material(0xe9e4d8), hair = material(0x28201b);
  function box(w, h, d, mat, x, y, z, parent = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function oval(x, y, z, sx, sy, sz, mat, parent) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }
  function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    draw(canvas.getContext("2d"), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
  }
  const feltMap = texture((ctx, w, h) => {
    ctx.fillStyle = "#195440"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#d1b779"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, h * 0.68, 75, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillStyle = "#e1ca8b"; ctx.font = "bold 23px Georgia";
    ctx.fillText("BLACKJACK PAYS 3 TO 2", w / 2, h * 0.32);
    ctx.font = "18px Georgia"; ctx.fillText("DEALER MUST STAND ON 17", w / 2, h * 0.41);
  });
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.69, 0.09, 32, 1, false, 0, Math.PI), wood);
  table.rotation.y = Math.PI / 2; table.position.set(0, 0.78, -0.65); group.add(table);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.015, 32, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ map: feltMap, roughness: 1 }));
  top.rotation.y = Math.PI / 2; top.position.set(0, 0.835, -0.65); group.add(top);
  box(0.12, 0.75, 0.12, wood, 0, 0.38, -0.65);
  // The shoe sits at the dealer's right and is the origin of every card slide.
  box(0.19, 0.09, 0.27, black, -0.43, 0.89, -0.85);
  box(0.15, 0.025, 0.19, shirt, -0.43, 0.945, -0.85);
  const dealer = new THREE.Group(); dealer.position.set(0, 0, -1.18); group.add(dealer);
  oval(0, 1.18, 0, 0.25, 0.32, 0.14, shirt, dealer);
  oval(0, 1.15, 0.03, 0.21, 0.27, 0.13, black, dealer);
  box(0.105, 0.33, 0.02, shirt, 0, 1.22, 0.16, dealer);
  box(0.14, 0.045, 0.025, black, 0, 1.38, 0.18, dealer);
  const arm = new THREE.Group(); arm.position.set(-0.22, 1.34, 0); dealer.add(arm);
  oval(0, -0.2, 0, 0.07, 0.24, 0.07, shirt, arm); oval(0, -0.41, 0.02, 0.065, 0.075, 0.065, skin, arm);
  const otherArm = new THREE.Group(); otherArm.position.set(0.22, 1.34, 0); dealer.add(otherArm);
  oval(0, -0.2, 0, 0.07, 0.24, 0.07, shirt, otherArm); oval(0, -0.41, 0.02, 0.065, 0.075, 0.065, skin, otherArm);
  const head = new THREE.Group(); head.position.y = 1.62; dealer.add(head);
  oval(0, 0, 0, 0.16, 0.19, 0.14, skin, head); oval(0, 0.145, -0.025, 0.16, 0.08, 0.14, hair, head);
  for (const x of [-0.065, 0.065]) {
    oval(x, 0.025, 0.132, 0.017, 0.018, 0.008, black, head);
    box(0.047, 0.01, 0.012, hair, x, 0.065, 0.132, head);
  }
  box(0.06, 0.009, 0.012, hair, 0, -0.065, 0.139, head);
  const backMap = texture((ctx, w, h) => {
    ctx.fillStyle = "#f2e9d6"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#773437"; ctx.fillRect(12, 12, w - 24, h - 24);
    ctx.strokeStyle = "#d9b8a8"; ctx.lineWidth = 2;
    for (let x = -h; x < w + h; x += 22) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x + h, h - 12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, h - 12); ctx.lineTo(x + h, 12); ctx.stroke(); }
  }, 256, 360);
  const backMat = new THREE.MeshBasicMaterial({ map: backMap });
  const faceCache = new Map();
  function faceMaterial(card) {
    const key = card.rank + card.suit;
    if (faceCache.has(key)) return faceCache.get(key);
    const map = texture((ctx, w, h) => {
      ctx.fillStyle = "#fffaf0"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = card.suit === "♥" || card.suit === "♦" ? "#b72834" : "#20252a";
      const rank = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][card.rank];
      ctx.font = "bold 48px Georgia"; ctx.textAlign = "left"; ctx.fillText(rank, 15, 53); ctx.font = "40px Georgia"; ctx.fillText(card.suit, 18, 94);
      ctx.save(); ctx.translate(w, h); ctx.rotate(Math.PI); ctx.font = "bold 48px Georgia"; ctx.fillText(rank, 15, 53); ctx.font = "40px Georgia"; ctx.fillText(card.suit, 18, 94); ctx.restore();
      ctx.textAlign = "center";
      if (card.rank >= 2 && card.rank <= 10) {
        ctx.font = "44px Georgia";
        const positions = [[0, 0], [-1, -1], [1, 1], [1, -1], [-1, 1], [-1, 0], [1, 0], [0, -1], [0, 1], [0, -0.5]];
        for (const [x, y] of positions.slice(0, card.rank)) ctx.fillText(card.suit, w / 2 + x * 48, h / 2 + y * 72 + 14);
      } else { ctx.font = "100px Georgia"; ctx.fillText(card.suit, w / 2, h / 2 + 34); }
    }, 256, 360);
    const mat = new THREE.MeshBasicMaterial({ map }); faceCache.set(key, mat); return mat;
  }
  const cardGeometry = new THREE.PlaneGeometry(0.14, 0.2);
  function makeCard(card, down) {
    const pivot = new THREE.Group(); pivot.rotation.x = -Math.PI / 2; pivot.rotation.y = down ? Math.PI : 0;
    const face = new THREE.Mesh(cardGeometry, faceMaterial(card)); face.position.z = 0.001; pivot.add(face);
    const back = new THREE.Mesh(cardGeometry, backMat); back.rotation.y = Math.PI; back.position.z = -0.001; pivot.add(back);
    group.add(pivot); return pivot;
  }
  const chipMaterials = [0xe8dfca, 0xb63d39, 0x315eaa, 0x3c8d5a].map(color => material(color));
  function chipStack(x, z, count, color) {
    const stack = new THREE.Group(); stack.position.set(x, 0.85, z); group.add(stack);
    for (let i = 0; i < count; i++) {
      const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 24), chipMaterials[color]); chip.position.y = i * 0.013; stack.add(chip);
      for (let j = 0; j < 4; j++) { const stripe = box(0.012, 0.013, 0.012, shirt, Math.sin(j * Math.PI / 2) * 0.042, i * 0.013, Math.cos(j * Math.PI / 2) * 0.042, stack); stripe.rotation.y = j * Math.PI / 2; }
    }
    return stack;
  }
  for (let i = 0; i < 4; i++) chipStack(0.34 + i * 0.1, -0.91, 4 + i, i);
  let wagerStack = null, prizeStack = null;
  const hud = document.createElement("div"); hud.className = "blackjack-hud"; hud.hidden = true;
  const status = document.createElement("div"), message = document.createElement("div"), controls = document.createElement("div");
  status.className = "blackjack-status"; message.className = "blackjack-message"; message.setAttribute("aria-live", "polite"); controls.className = "blackjack-controls";
  hud.append(status, message, controls); document.body.append(hud);
  let balance = 100, bet = 10, wager = 0, deck = [], playerHand = [], dealerHand = [], cardMeshes = [], phase = "bet", result = "Place your bet.", holeRevealed = false;
  let active = false, transition = null, animation = null, queue = [], lastElapsed = 0;
  const savedPosition = new THREE.Vector3(), savedRotation = new THREE.Quaternion();
  const seatPosition = new THREE.Vector3(), seatRotation = new THREE.Quaternion();
  function shuffle() {
    deck = [];
    for (let n = 0; n < 6; n++) for (const suit of ["♠", "♥", "♦", "♣"]) for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  }
  function total(hand) { let sum = 0, aces = 0; for (const card of hand) { sum += Math.min(card.rank, 10); if (card.rank === 1) aces++; } while (aces-- > 0 && sum + 10 <= 21) sum += 10; return sum; }
  function render() {
    status.textContent = `CHIPS ${balance}   ·   BET ${phase === "bet" ? bet : wager}   ·   YOU ${playerHand.length ? total(playerHand) : "–"}   ·   DEALER ${dealerHand.length ? (holeRevealed ? total(dealerHand) : total(dealerHand.slice(0, 1)) + " + ?") : "–"}`;
    message.textContent = result;
  }
  function enqueue(duration, step, done = () => {}) { queue.push({ duration, step, done, time: 0 }); }
  function slideCard(hand, down = false) {
    const card = deck.pop(); hand.push(card);
    const mesh = makeCard(card, down); cardMeshes.push(mesh);
    const index = hand.length - 1, target = new THREE.Vector3(-0.18 + index * 0.12, 0.858 + index * 0.002, hand === playerHand ? -0.43 : -0.86);
    const start = new THREE.Vector3(-0.43, 0.96, -0.85); mesh.position.copy(start);
    enqueue(0.42, t => { mesh.position.lerpVectors(start, target, t); mesh.position.y += Math.sin(t * Math.PI) * 0.06; arm.rotation.x = -Math.sin(t * Math.PI) * 1.1; }, () => { arm.rotation.x = 0; render(); });
  }
  function reveal() {
    const mesh = cardMeshes[3];
    if (!mesh || holeRevealed) return;
    enqueue(0.4, t => { mesh.rotation.y = Math.PI * (1 - t); mesh.position.y = 0.86 + Math.sin(Math.PI * t) * 0.08; }, () => { mesh.position.y = 0.86; holeRevealed = true; render(); });
  }
  function finish(text, payout) {
    phase = "busy"; result = text; render();
    if (wagerStack) {
      const stack = wagerStack, from = stack.position.clone(), to = new THREE.Vector3(payout ? 0.1 : 0.42, 0.85, payout ? -0.24 : -0.91);
      if (payout > wager) { const prize = chipStack(0.42, -0.91, 5, 2); prizeStack = prize; const prizeStart = prize.position.clone(); enqueue(0.5, t => prize.position.lerpVectors(prizeStart, new THREE.Vector3(0.22, 0.85, -0.24), t), () => { group.remove(prize); prizeStack = null; }); }
      enqueue(0.5, t => stack.position.lerpVectors(from, to, t), () => { group.remove(stack); wagerStack = null; });
    }
    enqueue(0.1, () => {}, () => { balance += payout; phase = "bet"; if (balance > 0) bet = Math.min(bet, balance); render(); });
  }
  function dealerTurn() {
    phase = "busy"; result = "Dealer reveals the hand."; reveal();
    enqueue(0.05, () => {}, () => {
      while (total(dealerHand) < 17) slideCard(dealerHand);
      const p = total(playerHand), d = total(dealerHand);
      enqueue(0.05, () => {}, () => finish(d > 21 ? "Dealer busts. You win!" : p > d ? "You win!" : p === d ? "Push." : "Dealer wins.", d > 21 || p > d ? wager * 2 : p === d ? wager : 0));
    }); render();
  }
  function deal() {
    if (transition || phase !== "bet" || balance < bet || bet < 1) return;
    if (deck.length < 60) shuffle();
    for (const mesh of cardMeshes) group.remove(mesh); cardMeshes = []; playerHand = []; dealerHand = []; holeRevealed = false;
    wager = bet; balance -= wager; phase = "busy"; result = "Good luck."; wagerStack = chipStack(0, -0.33, 5, 1);
    slideCard(playerHand); slideCard(dealerHand); slideCard(playerHand); slideCard(dealerHand, true);
    enqueue(0.05, () => {}, () => {
      const p = total(playerHand), d = total(dealerHand);
      if (p === 21 || d === 21) { reveal(); enqueue(0.05, () => {}, () => finish(p === 21 && d === 21 ? "Both have blackjack. Push." : p === 21 ? "Blackjack pays 3 to 2!" : "Dealer has blackjack.", p === 21 && d === 21 ? wager : p === 21 ? wager * 2.5 : 0)); }
      else { phase = "play"; result = "Hit, stand, or double?"; render(); }
    }); render();
  }
  function hit(doubled = false) {
    if (phase !== "play") return; phase = "busy"; slideCard(playerHand);
    enqueue(0.05, () => {}, () => { if (total(playerHand) > 21) { reveal(); enqueue(0.05, () => {}, () => finish("Bust. Dealer wins.", 0)); } else if (doubled || total(playerHand) === 21) dealerTurn(); else { phase = "play"; render(); } });
  }
  function double() { if (phase !== "play" || playerHand.length !== 2 || balance < wager) return; balance -= wager; wager *= 2; hit(true); render(); }
  function adjust(amount) { if (phase === "bet" && balance > 0) { bet = Math.max(1, Math.min(balance, bet + amount)); render(); } }
  function refill() { if (phase === "bet" && balance <= 0) { balance = 100; bet = 10; result = "The house spots you 100 chips."; render(); } }
  function close() {
    if (transition) return;
    if (phase !== "bet") { queue = []; animation = null; arm.rotation.x = 0; phase = "bet"; result = "Hand forfeited."; if (prizeStack) { group.remove(prizeStack); prizeStack = null; } if (wagerStack) { group.remove(wagerStack); wagerStack = null; } }
    transition = { time: 0, leaving: true }; hud.hidden = true;
  }
  function button(label, action) { const el = document.createElement("button"); el.type = "button"; el.textContent = label; el.addEventListener("click", action); controls.append(el); }
  button("←/→ Bet", () => adjust(1)); button("Enter Deal / refill", () => { if (balance <= 0) refill(); else deal(); }); button("H Hit", () => hit()); button("S Stand", () => { if (phase === "play") dealerTurn(); }); button("D Double", double); button("Esc Leave", close);
  render();
  return {
    getState: () => ({ balance }),
    setState(value) { if (value && Number.isFinite(value.balance) && value.balance >= 0 && value.balance <= 100000000) { balance = value.balance; bet = Math.max(1, Math.min(10, balance)); render(); } },
    get open() { return active; },
    canInteract(camera) { const dx = camera.position.x - Math.sin(angle) * -0.65, dz = camera.position.z - Math.cos(angle) * -0.65; return Math.abs(camera.position.y - (floorY + 1.6)) < 1 && Math.hypot(dx, dz) < 1.5; },
    interact(camera) {
      if (active) return; active = true; savedPosition.copy(camera.position); savedRotation.copy(camera.quaternion);
      group.updateMatrixWorld(true); seatPosition.copy(group.localToWorld(new THREE.Vector3(0, 1.3, 0.1)));
      const target = group.localToWorld(new THREE.Vector3(0, 1.05, -0.85));
      const view = camera.clone(); view.position.copy(seatPosition); view.lookAt(target); seatRotation.copy(view.quaternion);
      transition = { time: 0, leaving: false }; hud.hidden = false; onOpen(); render();
    },
    key(event) {
      if (!active) return false;
      if (event.code === "KeyM") return false;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) { if (event.code === "Escape") close(); else if (!transition) { if (event.code === "Enter") { if (balance <= 0) refill(); else deal(); } else if (event.code === "KeyH") hit(); else if (event.code === "KeyS" && phase === "play") dealerTurn(); else if (event.code === "KeyD") double(); else if (event.code === "ArrowLeft" || event.code === "ArrowDown") adjust(-1); else if (event.code === "ArrowRight" || event.code === "ArrowUp") adjust(1); } }
      return true;
    },
    update(elapsed, camera) {
      try {
        const dt = Math.min(0.05, Math.max(0, elapsed - lastElapsed)); lastElapsed = elapsed;
        dealer.position.y = Math.sin(elapsed * 1.7) * 0.008;
        if (transition) {
          transition.time += dt; const t = Math.min(1, transition.time / 0.55); const smooth = t * t * (3 - 2 * t);
          camera.position.lerpVectors(transition.leaving ? seatPosition : savedPosition, transition.leaving ? savedPosition : seatPosition, smooth);
          camera.quaternion.slerpQuaternions(transition.leaving ? seatRotation : savedRotation, transition.leaving ? savedRotation : seatRotation, smooth);
          if (t === 1) { const leaving = transition.leaving; transition = null; if (leaving) { active = false; onClose(); } }
        }
        if (active && !transition) {
          if (!animation && queue.length) animation = queue.shift();
          if (animation) { animation.time += dt; const t = Math.min(1, animation.time / animation.duration); animation.step(t); if (t === 1) { const done = animation.done; animation = null; done(); } }
        }
      } catch (error) { console.error("Blackjack animation failed", error); queue = []; animation = null; phase = "bet"; }
    },
  };
}
