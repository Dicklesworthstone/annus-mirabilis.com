/**
 * Shared accessibility live-region announcement utility (am-a11y-baseline-1cg5).
 *
 * Provides polite live-region announcements for committed user actions
 * and on-demand accessible descriptions. Never floods live regions at 60Hz.
 */

export type Politeness = "polite" | "assertive" | "off";

export interface AnnounceOptions {
  readonly politeness?: Politeness | undefined;
  readonly debounceMs?: number | undefined;
  readonly atomic?: boolean | undefined;
}

let liveRegionElement: HTMLElement | null = null;
let currentAnnouncement = "";
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let announcementCount = 0;

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
 * Returns the total number of committed announcements made during this session.
 */
export function getAnnouncementCount(): number {
  return announcementCount;
}

/**
 * Clears the active announcement and resets live region text.
 */
export function clearAnnouncement(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  currentAnnouncement = "";
  if (liveRegionElement) {
    liveRegionElement.textContent = "";
  }
}

/**
 * Announces a message through the live region.
 * Supports debouncing and politeness levels.
 */
export function announce(message: string, options: AnnounceOptions | Politeness = "polite"): void {
  if (!message || message.trim().length === 0) return;
  const trimmed = message.trim();

  const opts: AnnounceOptions = typeof options === "string" ? { politeness: options } : options;
  const politeness: Politeness = opts.politeness ?? "polite";
  const debounceMs = opts.debounceMs ?? 0;
  const atomic = opts.atomic ?? true;

  if (politeness === "off") return;

  currentAnnouncement = trimmed;
  announcementCount++;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const executeDomUpdate = () => {
    if (typeof document !== "undefined") {
      if (!liveRegionElement) {
        let el = document.getElementById("a11y-live-region");
        if (!el) {
          el = document.createElement("div");
          el.id = "a11y-live-region";
          el.className = "sr-only";
          el.setAttribute("aria-live", politeness);
          el.setAttribute("aria-atomic", String(atomic));
          document.body.appendChild(el);
        }
        liveRegionElement = el;
      }

      liveRegionElement.setAttribute("aria-live", politeness);
      liveRegionElement.setAttribute("aria-atomic", String(atomic));
      liveRegionElement.textContent = "";
      setTimeout(() => {
        if (liveRegionElement) {
          liveRegionElement.textContent = currentAnnouncement;
        }
      }, 10);
    }
  };

  if (debounceMs > 0) {
    debounceTimer = setTimeout(executeDomUpdate, debounceMs);
  } else {
    executeDomUpdate();
  }
}
