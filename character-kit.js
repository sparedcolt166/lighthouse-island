import * as THREE from "three";

// Shared, softly faceted shapes keep small characters readable at a distance.
const ball = new THREE.SphereGeometry(1, 16, 12);
const limbShape = new THREE.SphereGeometry(0.5, 12, 10);

export function characterPart(parent, material, position, scale) {
  const part = new THREE.Mesh(ball, material);
  part.position.set(...position);
  part.scale.set(...scale);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

// The unit-height limb can be stretched by a puppet rig between its joints.
export function roundedLimb(parent, material, radius, length) {
  const part = new THREE.Mesh(limbShape, material);
  part.position.y = -length / 2;
  part.scale.set(radius * 2, length, radius * 2);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

export function characterHand(parent, skin, side = 1) {
  const hand = new THREE.Group();
  parent.add(hand);
  characterPart(hand, skin, [0, 0, 0], [0.09, 0.105, 0.075]);
  const thumb = characterPart(hand, skin, [side * 0.075, 0.015, 0.025], [0.037, 0.065, 0.04]);
  thumb.rotation.z = -side * 0.55;
  return hand;
}

// The face points along local +Z so a head joint can turn it as one piece.
export function characterFace(parent, { skin, beard, eyeWhite, pupil, brow, mouth }) {
  characterPart(parent, skin, [0, 0.23, 0], [0.235, 0.26, 0.215]);
  for (const side of [-1, 1]) {
    characterPart(parent, skin, [side * 0.227, 0.23, 0], [0.052, 0.075, 0.035]);
    characterPart(parent, eyeWhite, [side * 0.087, 0.295, 0.192], [0.044, 0.034, 0.024]);
    characterPart(parent, pupil, [side * 0.087, 0.293, 0.213], [0.019, 0.023, 0.011]);
    const eyebrow = characterPart(parent, brow, [side * 0.087, 0.349, 0.189], [0.058, 0.014, 0.018]);
    eyebrow.rotation.z = side * 0.13;
  }
  characterPart(parent, beard, [0, 0.12, 0.125], [0.211, 0.148, 0.14]);
  characterPart(parent, skin, [0, 0.245, 0.215], [0.055, 0.065, 0.065]);
  characterPart(parent, mouth, [0, 0.143, 0.263], [0.052, 0.012, 0.008]);
  for (const side of [-1, 1]) {
    const moustache = characterPart(parent, beard, [side * 0.053, 0.166, 0.259], [0.063, 0.025, 0.025]);
    moustache.rotation.z = -side * 0.18;
  }
}
