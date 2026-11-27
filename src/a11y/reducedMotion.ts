/**
 * Reduced Motion detection and subscription utility (am-a11y-baseline-1cg5).
 *
 * Checks both system media query (`prefers-reduced-motion: reduce`)
 * and the user's explicit reading settings on the site.
 */

export type MotionListener = (reduced: boolean) => void;

function hasMotionOverride(root: HTMLElement): boolean {
  return (
    root.getAttribute("data-reduced-motion") === "true" ||
    root.getAttribute("data-reading-only") === "on"
  );
}

/**
 * Checks if reduced motion is preferred either by system setting or site override.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // 1. Check DOM data attribute set by prepaint reading settings
  if (hasMotionOverride(document.documentElement)) {
    return true;
  }

  // 2. Check system media query
  try {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    return mediaQuery.matches;
  } catch {
    return false;
  }
}

/**
 * Returns true if animations are permitted (i.e. reduced motion is NOT preferred).
 */
export function shouldAnimate(overrideSetting?: boolean): boolean {
  if (overrideSetting !== undefined) {
    return !overrideSetting;
  }
  return !isReducedMotionPreferred();
}

/**
 * Reports the current preference, then follows system, embed and reading-only changes.
 * Removing one pause source never overrides another. The subscriber decides how to pause;
 * returning to an unrestricted preference is not an instruction to resume playback.
 */
export function onReducedMotionChange(listener: MotionListener): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const root = document.documentElement;
  let mediaQuery: MediaQueryList | undefined;
  try {
    mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  } catch {
    // A missing media-query API cannot disable the reader's explicit document preference.
  }
  let systemReduced = mediaQuery?.matches ?? false;
  let disposed = false;
  let previous: boolean | undefined;
  const update = () => {
    if (disposed) return;
    const reduced = systemReduced || hasMotionOverride(root);
    if (reduced === previous) return;
    previous = reduced;
    listener(reduced);
  };
  const handler = (event: MediaQueryListEvent) => {
    systemReduced =
      typeof event.matches === "boolean" ? event.matches : (mediaQuery?.matches ?? false);
    update();
  };

  let removeMediaListener = () => {};
  if (typeof mediaQuery?.addEventListener === "function") {
    mediaQuery.addEventListener("change", handler);
    const query = mediaQuery;
    removeMediaListener = () => query.removeEventListener("change", handler);
  } else if (typeof mediaQuery?.addListener === "function") {
    mediaQuery.addListener(handler);
    const query = mediaQuery;
    removeMediaListener = () => query.removeListener(handler);
  }

  const observer =
    typeof window.MutationObserver === "function" ? new window.MutationObserver(update) : null;
  observer?.observe(root, {
    attributes: true,
    attributeFilter: ["data-reduced-motion", "data-reading-only"],
  });
  update();
  return () => {
    disposed = true;
    observer?.disconnect();
    removeMediaListener();
  };
}
