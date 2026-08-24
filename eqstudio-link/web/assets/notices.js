// Shared notice/banner display module. Public (anon-key) reads only ever return
// active + currently-in-window notices — RLS enforces that (see migration_fasa33).
// Dismissed notices are remembered per-browser via localStorage, keyed by notice id.

import { supabase } from "/assets/supabase-client.js";

const CATEGORY_STYLE = {
  info: { bg: "var(--stamp-soft)", fg: "var(--stamp)", icon: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>' },
  warning: { bg: "var(--pending-bg)", fg: "#B45309", icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' },
  success: { bg: "var(--ok-bg)", fg: "var(--ok)", icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' },
  critical: { bg: "var(--warn-bg)", fg: "var(--warn)", icon: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>' },
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function getDismissed() {
  try { return JSON.parse(localStorage.getItem("eqstudio_dismissed_notices") || "[]"); } catch { return []; }
}
function dismiss(id) {
  const list = getDismissed();
  if (!list.includes(id)) list.push(id);
  localStorage.setItem("eqstudio_dismissed_notices", JSON.stringify(list));
}

export function renderNotice(n) {
  const style = CATEGORY_STYLE[n.category] || CATEGORY_STYLE.info;
  return `
    <div class="notice-banner" data-notice-id="${n.id}" style="background:${style.bg}; color:${style.fg};">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">${style.icon}</svg>
      <span class="notice-banner-text">${escapeHtml(n.message)}</span>
      ${n.cta_text && n.cta_url ? `<a href="${escapeHtml(n.cta_url)}" class="notice-banner-cta" style="color:${style.fg};">${escapeHtml(n.cta_text)}</a>` : ""}
      ${n.is_dismissible ? `<button type="button" class="notice-banner-dismiss" data-dismiss-id="${n.id}" aria-label="Tutup" style="color:${style.fg};"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>` : ""}
    </div>
  `;
}

/**
 * Loads and renders active notices into a container.
 * @param {Object} opts
 * @param {string} opts.containerId - id of the element to render banners into
 * @param {"landing"|"dashboard"} opts.location - which surface this is
 * @param {string} [opts.tier] - "starter"|"pro", if the viewer is a logged-in owner (dashboard only)
 * @param {boolean} [opts.isTrial] - true if the viewer is currently on trial (dashboard only)
 */
export async function loadNotices({ containerId, location, tier, isTrial }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .in("target_location", [location, "both"])
    .order("priority", { ascending: false });

  if (error || !data) return;

  const dismissed = getDismissed();
  const visible = data.filter(n => {
    if (dismissed.includes(n.id)) return false;
    if (n.target_audience === "all") return true;
    if (location !== "dashboard") return false; // audience targeting only makes sense once we know who's viewing
    if (n.target_audience === "trial") return !!isTrial;
    if (n.target_audience === "starter") return tier === "starter";
    if (n.target_audience === "pro") return tier === "pro";
    return true;
  });

  if (visible.length === 0) { container.innerHTML = ""; return; }

  container.innerHTML = visible.map(renderNotice).join("");
  container.querySelectorAll("[data-dismiss-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      dismiss(btn.dataset.dismissId);
      btn.closest(".notice-banner")?.remove();
    });
  });
}
