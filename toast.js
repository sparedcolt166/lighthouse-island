// A small one-line message near the top of the screen, used for the loading
// note and the start-up hint now that the menu stays out of the way until Esc.

const toast = document.querySelector("#toast");
let hideTimer = 0;

export function showToast(text, durationMs = 0) {
  clearTimeout(hideTimer);
  toast.textContent = text;
  toast.classList.add("visible");
  if (durationMs > 0) {
    hideTimer = setTimeout(hideToast, durationMs);
  }
}

export function hideToast() {
  clearTimeout(hideTimer);
  toast.classList.remove("visible");
}
