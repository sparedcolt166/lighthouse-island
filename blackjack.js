import * as THREE from "three";
import { LADDER_OFFSET } from "./upper-room.js";

export function buildBlackjack(scene, azimuth, floorY, onOpen, onClose) {
  const angle = azimuth + LADDER_OFFSET;
  const group = new THREE.Group();
  group.position.y = floorY;
  group.rotation.y = angle;
  scene.add(group);
  const wood = new THREE.MeshStandardMaterial({ color: 0x4c3023, roughness: 0.9 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x245c43, roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb87955, roughness: 1 });
  const vest = new THREE.MeshStandardMaterial({ color: 0x253238, roughness: 1 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xe4d9c5, roughness: 1 });
  function box(w, h, d, mat, x, y, z, parent = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  // The semicircle faces the room, leaving a clear path to the hatch.
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.69, 0.09, 24, 1, false, 0, Math.PI), wood);
  table.rotation.y = Math.PI / 2;
  table.position.set(0, 0.78, -0.65); group.add(table);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.015, 24, 1, false, 0, Math.PI), felt);
  top.rotation.y = Math.PI / 2; top.position.set(0, 0.835, -0.65); group.add(top);
  box(0.12, 0.75, 0.12, wood, 0, 0.38, -0.65);
  const dealer = new THREE.Group(); dealer.position.set(0, 0, -1.18); group.add(dealer);
  box(0.38, 0.54, 0.21, vest, 0, 1.15, 0, dealer);
  box(0.15, 0.38, 0.22, shirt, 0, 1.19, 0.01, dealer);
  box(0.18, 0.06, 0.04, wood, 0, 1.38, 0.13, dealer);
  box(0.12, 0.72, 0.13, vest, -0.12, 0.52, 0, dealer);
  box(0.12, 0.72, 0.13, vest, 0.12, 0.52, 0, dealer);
  box(0.11, 0.45, 0.11, shirt, -0.25, 1.12, 0, dealer).rotation.z = -0.3;
  box(0.11, 0.45, 0.11, shirt, 0.25, 1.12, 0, dealer).rotation.z = 0.3;
  const head = new THREE.Group(); head.position.y = 1.58; dealer.add(head);
  box(0.3, 0.34, 0.28, skin, 0, 0, 0, head);
  box(0.31, 0.09, 0.29, wood, 0, 0.17, 0, head);
  const eye = new THREE.MeshStandardMaterial({ color: 0x1a1a19 });
  for (const x of [-0.08, 0.08]) box(0.025, 0.025, 0.012, eye, x, 0.03, 0.145, head);

  const overlay = document.createElement("div"); overlay.className = "blackjack-overlay"; overlay.hidden = true;
  const panel = document.createElement("section"); panel.className = "blackjack-panel"; overlay.append(panel);
  const title = document.createElement("h2"); title.textContent = "Lighthouse Blackjack"; panel.append(title);
  const status = document.createElement("p"); status.className = "blackjack-status"; panel.append(status);
  const dealerCards = document.createElement("p"); const playerCards = document.createElement("p");
  dealerCards.className = playerCards.className = "blackjack-cards"; panel.append(dealerCards, playerCards);
  const message = document.createElement("p"); message.setAttribute("aria-live", "polite"); panel.append(message);
  const controls = document.createElement("div"); controls.className = "blackjack-controls"; panel.append(controls);
  const buttons = {};
  function button(key, text, action) {
    const el = document.createElement("button"); el.type = "button"; el.textContent = text;
    el.addEventListener("click", action); controls.append(el); buttons[key] = el;
  }
  let balance = 100, bet = 10, wager = 0, deck = [], playerHand = [], dealerHand = [], phase = "bet", result = "Place your bet.";
  function shuffle() {
    deck = [];
    for (const suit of ["♠", "♥", "♦", "♣"]) for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  }
  function total(hand) {
    let sum = 0, aces = 0;
    for (const card of hand) { sum += Math.min(card.rank, 10); if (card.rank === 1) aces++; }
    while (aces-- > 0 && sum + 10 <= 21) sum += 10;
    return sum;
  }
  function cards(hand) { return hand.map(c => `${["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][c.rank]}${c.suit}`).join("  "); }
  function render() {
    status.textContent = `Chips: ${balance}   ·   Bet: ${phase === "play" ? wager : bet}`;
    dealerCards.textContent = `Dealer: ${phase === "play" ? cards(dealerHand.slice(0, 1)) + "  🂠" : cards(dealerHand)}`;
    playerCards.textContent = `You: ${cards(playerHand)}${playerHand.length ? `  (${total(playerHand)})` : ""}`;
    message.textContent = result;
    buttons.minus.disabled = phase === "play" || bet <= 1;
    buttons.plus.disabled = phase === "play" || bet >= balance;
    buttons.deal.disabled = phase === "play" || balance < bet || balance < 1;
    buttons.refill.hidden = balance > 0 || phase === "play";
    buttons.hit.disabled = buttons.stand.disabled = phase !== "play";
    buttons.double.disabled = phase !== "play" || playerHand.length !== 2 || balance < wager;
  }
  function finish(text, payout) { balance += payout; phase = "bet"; result = text; if (balance > 0) bet = Math.min(bet, balance); render(); }
  function deal() {
    if (phase === "play" || balance < bet || balance < 1) return;
    if (deck.length < 35) shuffle();
    wager = bet; balance -= wager; playerHand = [deck.pop(), deck.pop()]; dealerHand = [deck.pop(), deck.pop()]; phase = "play";
    const p = total(playerHand), d = total(dealerHand);
    if (p === 21 || d === 21) {
      if (p === 21 && d === 21) finish("Both have blackjack. Push.", wager);
      else if (p === 21) finish("Blackjack! Pays 3:2.", wager * 2.5);
      else finish("Dealer has blackjack.", 0);
    } else { result = "Hit, stand, or double."; render(); }
  }
  function stand() {
    if (phase !== "play") return;
    while (total(dealerHand) < 17) dealerHand.push(deck.pop());
    const p = total(playerHand), d = total(dealerHand);
    if (d > 21 || p > d) finish(d > 21 ? "Dealer busts. You win!" : "Dealer stands. You win!", wager * 2);
    else if (p === d) finish("Dealer stands. Push.", wager);
    else finish("Dealer stands. Dealer wins.", 0);
  }
  function hit() { if (phase !== "play") return; playerHand.push(deck.pop()); if (total(playerHand) > 21) finish("Bust. Dealer wins.", 0); else render(); }
  function double() { if (phase !== "play" || playerHand.length !== 2 || balance < wager) return; balance -= wager; wager *= 2; hit(); if (phase === "play") stand(); }
  function close() { if (phase === "play") { result = "Hand forfeited."; phase = "bet"; if (balance > 0) bet = Math.min(bet, balance); } overlay.hidden = true; onClose(); }
  button("minus", "− Bet", () => { if (phase !== "play") { bet = Math.max(1, bet - 1); render(); } });
  button("plus", "+ Bet", () => { if (phase !== "play") { bet = Math.min(balance, bet + 1); render(); } });
  button("deal", "Deal · Enter", deal); button("hit", "Hit · H", hit); button("stand", "Stand · S", stand); button("double", "Double · D", double); button("leave", "Leave · Esc", close);
  // Only shown once the player is broke, so a bad run never ends the game.
  button("refill", "Refill chips", () => { if (phase !== "play" && balance <= 0) { balance = 100; bet = 10; result = "The house spots you 100 chips."; render(); } });
  document.body.append(overlay); render();
  return {
    getState: () => ({ balance }),
    setState(value) { if (value && Number.isFinite(value.balance) && value.balance >= 0 && value.balance <= 100000000) { balance = value.balance; bet = Math.max(1, Math.min(10, balance)); render(); } },
    get open() { return !overlay.hidden; },
    canInteract(camera) {
      const dx = camera.position.x - Math.sin(angle) * -0.65, dz = camera.position.z - Math.cos(angle) * -0.65;
      return Math.abs(camera.position.y - (floorY + 1.6)) < 1 && Math.hypot(dx, dz) < 1.5;
    },
    interact() { overlay.hidden = false; onOpen(); render(); buttons.leave.focus(); },
    key(event) {
      if (!this.open) return false;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) { if (event.code === "Escape") close(); else if (event.code === "Enter") deal(); else if (event.code === "KeyH") hit(); else if (event.code === "KeyS") stand(); else if (event.code === "KeyD") double(); }
      return true;
    },
    update(elapsed, camera) {
      try { head.rotation.y = Math.max(-0.8, Math.min(0.8, Math.atan2(camera.position.x, camera.position.z) - angle)); dealer.position.y = Math.sin(elapsed * 1.7) * 0.01; } catch { /* Animation must never stop the walkabout. */ }
    },
  };
}
