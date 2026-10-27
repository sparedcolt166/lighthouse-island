import * as THREE from "three";

// A painted, simplified cover keeps the title legible on the small in-game book.
export function createBookCover() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const context = canvas.getContext("2d");

  context.fillStyle = "#e9d7a7";
  context.fillRect(0, 0, 512, 768);
  context.strokeStyle = "#806849";
  context.lineWidth = 8;
  context.strokeRect(12, 12, 488, 744);

  function title(text, y, size) {
    context.font = `bold ${size}px Georgia, serif`;
    context.textAlign = "center";
    context.lineWidth = 3;
    context.strokeStyle = "#352b27";
    context.fillStyle = "#4b4b55";
    context.strokeText(text, 256, y, 470);
    context.fillText(text, 256, y, 470);
  }
  title("LONESOME", 110, 74);
  title("DOVE", 204, 110);
  context.font = "italic 25px Georgia, serif";
  context.fillStyle = "#4a352c";
  context.fillText("A Novel", 355, 244);

  // The western landscape echoes the cover's riding scene without relying on
  // an external image or network request.
  context.fillStyle = "#c0a17a";
  context.fillRect(16, 265, 480, 245);
  context.fillStyle = "#88775a";
  context.beginPath();
  context.moveTo(16, 355);
  context.lineTo(130, 315);
  context.lineTo(250, 350);
  context.lineTo(360, 320);
  context.lineTo(496, 350);
  context.lineTo(496, 410);
  context.lineTo(16, 410);
  context.fill();
  context.fillStyle = "#79533d";
  context.fillRect(16, 390, 480, 120);
  context.fillStyle = "#46352b";
  // Horse and rider silhouettes.
  for (const [x, scale] of [[195, 1], [325, 0.75]]) {
    context.save();
    context.translate(x, 405);
    context.scale(scale, scale);
    context.beginPath();
    context.ellipse(0, 0, 51, 20, 0, 0, Math.PI * 2);
    context.fill();
    context.fillRect(-34, 8, 9, 56);
    context.fillRect(22, 8, 9, 56);
    context.beginPath();
    context.moveTo(35, -7);
    context.lineTo(60, -38);
    context.lineTo(73, -30);
    context.lineTo(55, 6);
    context.fill();
    context.fillRect(-5, -45, 15, 36);
    context.beginPath();
    context.arc(2, -53, 10, 0, Math.PI * 2);
    context.fill();
    context.fillRect(-12, -65, 29, 5);
    context.restore();
  }
  title("LARRY", 610, 86);
  title("McMURTRY", 703, 78);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
