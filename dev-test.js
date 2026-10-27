import * as THREE from "three";
import { LADDER_OFFSET } from "./upper-room.js";

// Shortcuts are deliberately unavailable on the public GitHub Pages site.
export function getTestSetup({ dock, tinny, doorAzimuth, roomFloor, spawn, spawnLook }) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return null;
  const scenario = new URLSearchParams(window.location.search).get("test");
  if (scenario === "controls") return { position: spawn.clone(), lookAt: spawnLook.clone() };
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
