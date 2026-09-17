/**
 * Reduced Motion detection and subscription utility (am-a11y-baseline-1cg5).
 *
 * Checks both system media query (`prefers-reduced-motion: reduce`)
 * and the user's explicit reading settings on the site.
 */

export type MotionListener = (reduced: boolean) => void;

/**
 * Checks if reduced motion is preferred either by system setting or site override.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // 1. Check DOM data attribute set by prepaint reading settings
  if (document.documentElement.getAttribute("data-reduced-motion") === "true") {
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
 * Subscribes to changes in system reduced-motion preferences.
 * Returns an unsubscription callback.
 */
export function onReducedMotionChange(listener: MotionListener): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = (event: MediaQueryListEvent) => {
    // If site has explicit override, it takes precedence
    if (document.documentElement.getAttribute("data-reduced-motion") === "true") {
      listener(true);
    } else {
      listener(event.matches);
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  } else if ("addListener" in mediaQuery) {
    // Older Safari / WebKit support
    (mediaQuery as any).addListener(handler);
    return () => (mediaQuery as any).removeListener(handler);
  }

  return () => {};
}
