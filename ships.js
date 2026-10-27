import * as THREE from "three";

// Ships travel along chords of the distant sea, with their closest point well
// clear of both the swim boundary and any islands near the main island.
const LANE_RADIUS = 385;
const box = new THREE.BoxGeometry(1, 1, 1);
const mast = new THREE.CylinderGeometry(1, 1, 1, 6);

function skullTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#17191a";
  ctx.fillRect(0, 0, 128, 80);
  ctx.strokeStyle = "#eee9d7";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(46, 50); ctx.lineTo(82, 68);
  ctx.moveTo(82, 50); ctx.lineTo(46, 68);
  ctx.stroke();
  ctx.fillStyle = "#eee9d7";
  ctx.beginPath();
  ctx.arc(64, 32, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(55, 40, 18, 9);
  ctx.fillStyle = "#17191a";
  ctx.beginPath();
  ctx.arc(58, 32, 3, 0, Math.PI * 2);
  ctx.arc(70, 32, 3, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildShips(scene) {
  const flagTexture = skullTexture();
  const colors = {
    hull: 0x303b42, redHull: 0x873f35, deck: 0x7b817d,
    white: 0xd5d6ca, dark: 0x252b2d, wood: 0x49352b,
    sail: 0xc8bca1, red: 0xa4533f, blue: 0x536f7a,
    ochre: 0xb19a68, green: 0x687e68,
  };

  function makeShip(type) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    root.name = type === "liner" ? "Distant container ship" : "Distant pirate ship";
    const materials = {};
    for (const name in colors) {
      materials[name] = new THREE.MeshStandardMaterial({ color: colors[name], roughness: 0.9, transparent: true });
    }
    const flagMaterial = new THREE.MeshStandardMaterial({ map: flagTexture, side: THREE.DoubleSide, roughness: 1, transparent: true });
    materials.flag = flagMaterial;
    const part = (parent, geometry, material, x, y, z, sx, sy, sz) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
      return mesh;
    };
    const sails = [];
    if (type === "liner") {
      // The lower half of the hull sits below the flat water plane.
      part(body, box, materials.redHull, 0, 0.5, 0, 39, 3, 7);
      part(body, box, materials.hull, 0, 2.5, 0, 39, 1.5, 7.2);
      part(body, box, materials.deck, 0, 3.35, 0, 39, 0.25, 7.2);
      const containerColors = ["red", "blue", "ochre", "green"];
      for (let x = -12; x <= 12; x += 4) {
        for (let z = -2; z <= 2; z += 2) {
          for (let level = 0; level < 2; level++) {
            const color = containerColors[(Math.round(x / 4) + z + level + 12) % containerColors.length];
            part(body, box, materials[color], x, 4.25 + level * 1.75, z, 3.8, 1.65, 1.85);
          }
        }
      }
      part(body, box, materials.white, -16.5, 6, 0, 5, 5.2, 6);
      part(body, box, materials.dark, -16.5, 8.3, 0, 5.2, 0.65, 6.2);
      part(body, box, materials.redHull, -18, 9.7, 0, 1.5, 2.4, 1.6);
      part(body, box, materials.dark, -18, 10.9, 0, 1.55, 0.25, 1.65);
    } else {
      part(body, box, materials.wood, 0, 0.55, 0, 22, 3.2, 5.5);
      part(body, box, materials.dark, 0, 2.2, 0, 22.5, 0.55, 5.7);
      part(body, box, materials.wood, -8, 3, 0, 5, 2, 5.5);
      for (const x of [-5, 4]) {
        part(body, mast, materials.wood, x, 9, 0, 0.22, 14, 0.22);
        const sail = new THREE.Group();
        sail.position.set(x, 9.5, 0);
        body.add(sail);
        part(sail, box, materials.sail, 0, 0, 0, 0.18, 7, 7);
        part(sail, mast, materials.wood, 0, 3.6, 0, 0.12, 7.5, 0.12).rotation.x = Math.PI / 2;
        sails.push(sail);
      }
      part(body, box, materials.flag, -5, 16, 1.5, 0.08, 1.8, 3);
    }
    scene.add(root);
    return { root, body, sails, materials, type, active: false, delay: 0 };
  }

  // Reuse the same three ships and their geometry instead of allocating during
  // the animation. Each slot can choose either silhouette for its next trip.
  const slots = Array.from({ length: 3 }, () => ({
    liner: makeShip("liner"), pirate: makeShip("pirate"), ship: null, delay: 0,
  }));
  for (const slot of slots) {
    slot.liner.root.visible = false;
    slot.pirate.root.visible = false;
  }

  function start(slot, type, progress) {
    const ship = slot[type];
    slot.ship = ship;
    ship.root.visible = true;
    const angle = Math.random() * Math.PI * 2;
    const direction = Math.random() < 0.5 ? -1 : 1;
    const distance = 185 + Math.random() * 35;
    ship.dirX = -Math.sin(angle) * direction;
    ship.dirZ = Math.cos(angle) * direction;
    ship.baseX = Math.cos(angle) * distance;
    ship.baseZ = Math.sin(angle) * distance;
    ship.halfLength = Math.sqrt(LANE_RADIUS * LANE_RADIUS - distance * distance);
    ship.travel = -ship.halfLength + 2 * ship.halfLength * progress;
    ship.speed = type === "liner" ? 1.35 : 2.1;
    ship.phase = Math.random() * Math.PI * 2;
    ship.root.rotation.y = Math.atan2(-ship.dirZ, ship.dirX);
  }

  start(slots[0], "liner", 0.38);
  start(slots[1], "pirate", 0.62);
  slots[2].delay = 15 + Math.random() * 25;

  return {
    update(dt, elapsed) {
      for (const slot of slots) {
        const ship = slot.ship;
        if (!ship) {
          slot.delay -= dt;
          if (slot.delay <= 0) start(slot, Math.random() < 0.5 ? "liner" : "pirate", 0);
          continue;
        }
        ship.travel += ship.speed * dt;
        if (ship.travel >= ship.halfLength) {
          ship.root.visible = false;
          slot.ship = null;
          slot.delay = 15 + Math.random() * 35;
          continue;
        }
        ship.root.position.set(ship.baseX + ship.dirX * ship.travel, 0, ship.baseZ + ship.dirZ * ship.travel);
        const fade = THREE.MathUtils.clamp((ship.halfLength - Math.abs(ship.travel)) / 45, 0, 1);
        for (const name in ship.materials) ship.materials[name].opacity = fade;
        const wave = elapsed + ship.phase;
        ship.body.position.y = Math.sin(wave * 0.7) * 0.12;
        ship.body.rotation.x = Math.sin(wave * 0.55) * (ship.type === "pirate" ? 0.025 : 0.008);
        ship.body.rotation.z = Math.sin(wave * 0.42) * (ship.type === "pirate" ? 0.018 : 0.005);
        for (const sail of ship.sails) sail.rotation.y = Math.sin(wave * 0.65) * 0.08;
      }
    },
  };
}
