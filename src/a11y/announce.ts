/**
 * Shared accessibility live-region announcement utility (am-a11y-baseline-1cg5).
 *
 * Provides polite live-region announcements for committed user actions
 * and on-demand accessible descriptions. Never floods live regions at 60Hz.
 */

let liveRegionElement: HTMLElement | null = null;
let currentAnnouncement = "";

/**
 * Attaches or configures a DOM element as the site live region.
 */
export function setLiveRegionElement(el: HTMLElement | null): void {
  liveRegionElement = el;
}

/**
 * Gets the most recent announcement text.
 */
export function getLastAnnouncement(): string {
  return currentAnnouncement;
}

/**
 * Announces a message through the live region.
 */
export function announce(message: string, politeness: "polite" | "assertive" = "polite"): void {
  if (!message || message.trim().length === 0) return;
  currentAnnouncement = message.trim();

  if (typeof document !== "undefined") {
    if (!liveRegionElement) {
      let el = document.getElementById("a11y-live-region");
      if (!el) {
        el = document.createElement("div");
        el.id = "a11y-live-region";
        el.className = "sr-only";
        el.setAttribute("aria-live", politeness);
        el.setAttribute("aria-atomic", "true");
        document.body.appendChild(el);
      }
      liveRegionElement = el;
    }

    liveRegionElement.setAttribute("aria-live", politeness);
    // Clear and set to trigger screen reader announcement reliably
    liveRegionElement.textContent = "";
    setTimeout(() => {
      if (liveRegionElement) {
        liveRegionElement.textContent = currentAnnouncement;
      }
    }, 50);
  }
}
