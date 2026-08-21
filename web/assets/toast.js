// Lightweight toast notifications — no dependencies, used across pages.
let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

const ICONS = {
  success: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="M6.5 10.5l2.2 2.2L14 8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="M10 6v5" stroke-linecap="round"/><circle cx="10" cy="13.5" r="0.9" fill="currentColor" stroke="none"/></svg>`,
};

export function showToast(message, type = "success", duration = 3800) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `${ICONS[type] || ICONS.success}<span>${message}</span>`;
  ensureContainer().appendChild(el);

  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 220);
  }, duration);
}
