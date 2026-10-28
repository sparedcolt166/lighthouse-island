import * as THREE from "three";
import { LADDER_OFFSET } from "./upper-room.js";

export function isRainTest() {
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get("test") === "rain";
}

// Shortcuts are deliberately unavailable on the public GitHub Pages site.
export function getTestSetup({ dock, tinny, doorAzimuth, roomFloor, spawn, spawnLook }) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return null;
  const scenario = new URLSearchParams(window.location.search).get("test");
  if (scenario === "controls" || scenario === "night" || scenario === "rain") return { position: spawn.clone(), lookAt: spawnLook.clone() };
  if (scenario === "fishing") {
    return {
      position: dock.group.localToWorld(new THREE.Vector3(-0.8, dock.deckY, dock.deckEnd - 3)),
      lookAt: dock.group.localToWorld(new THREE.Vector3(-4, dock.deckY, dock.deckEnd - 3)),
      fishing: true,
    };
  }
  if (scenario === "water") {
    return {
      position: dock.group.localToWorld(new THREE.Vector3(0, dock.deckY, dock.deckEnd - 1)),
      lookAt: dock.group.localToWorld(new THREE.Vector3(0, 0, dock.deckEnd + 12)),
    };
  }
  if (scenario === "dock") {
    return {
      position: dock.group.localToWorld(new THREE.Vector3(0, dock.deckY, dock.deckEnd - 3)),
      lookAt: dock.group.localToWorld(new THREE.Vector3(-0.58, dock.deckY + 0.8, dock.deckEnd)),
    };
  }
  if (scenario === "boat" && tinny) {
    return {
      position: tinny.group.localToWorld(new THREE.Vector3(0, 0.4, -0.1)),
      lookAt: tinny.group.localToWorld(new THREE.Vector3(0, 0.1, 1)),
    };
  }
  if (scenario === "blackjack") {
    const angle = doorAzimuth + LADDER_OFFSET;
    return {
      position: new THREE.Vector3(Math.sin(angle) * 0.25, roomFloor + 3.8, Math.cos(angle) * 0.25),
      lookAt: new THREE.Vector3(-Math.sin(angle), roomFloor + 4.8, -Math.cos(angle)),
      fromY: roomFloor + 4.1,
    };
  }
  if (scenario === "ladder") {
    const angle = doorAzimuth + LADDER_OFFSET;
    return {
      position: new THREE.Vector3(Math.sin(angle) * 0.65, roomFloor, Math.cos(angle) * 0.65),
      lookAt: new THREE.Vector3(Math.sin(angle) * 1.7, roomFloor + 1.8, Math.cos(angle) * 1.7),
      fromY: roomFloor + 2,
    };
  }
  return null;
}
