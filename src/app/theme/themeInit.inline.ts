/**
 * The theme pre-paint script (am-design-themes-typography-288q): sets
 * `data-theme` on `<html>` before first paint, so no wrong theme flashes.
 *
 * `initTheme` is a real, directly testable function. `THEME_INIT_SOURCE`
 * derives the exact injected string from `initTheme.toString()`, never a
 * hand-copied literal, with its free variables substituted by value --
 * the same pattern as `src/reader/rootArming.inline.ts` -- because an
 * inline `<script>` cannot `import` a module, and a Content-Security-Policy
 * hash is over exact bytes.
 *
 * `THEME_STORAGE_KEY` is read directly from the real storage namespace
 * registry (`storageKeyRegistry`), rather than a second hardcoded copy of
 * "am:settings:v1:theme": am-plat-local-storage-km8f's own build-step key
 * injection (which the bead text describes) does not exist yet, so this is
 * the most correct thing available today -- one definition, re-derived,
 * not duplicated. themeInit.test.ts asserts this constant equals the
 * registry's own key for "theme".
 */
import { SETTINGS_KEY_PREFIX, storageKeyRegistry } from "../../platform/storage/keys";
import { FOLLOW_SYSTEM_VALUE, THEME_IDS } from "./tokens";

const registration = storageKeyRegistry.get(`${SETTINGS_KEY_PREFIX}theme`);
if (!registration) {
  throw new Error(`Storage registry has no entry for "${SETTINGS_KEY_PREFIX}theme".`);
}
export const THEME_STORAGE_KEY: string = registration.key;
export const THEME_FOLLOW_SYSTEM = FOLLOW_SYSTEM_VALUE;
export const KNOWN_THEME_IDS: readonly string[] = THEME_IDS;

export function initTheme(
  storageKey: string,
  followSystem: string,
  knownThemeIds: readonly string[],
): void {
  try {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      /* Reading works without storage. */
    }
    let resolved: string | undefined;
    if (stored === followSystem) {
      resolved =
        typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
          ? "kramgasse-night"
          : "annalen";
    } else if (stored !== null && knownThemeIds.indexOf(stored) !== -1) {
      resolved = stored;
    }
    if (resolved === undefined) {
      const routeDefault = document.documentElement.getAttribute("data-route-theme");
      resolved =
        routeDefault !== null && knownThemeIds.indexOf(routeDefault) !== -1
          ? routeDefault
          : "annalen";
    }
    document.documentElement.dataset.theme = resolved;
  } catch {
    document.documentElement.dataset.theme = "annalen";
  }
}

export const THEME_INIT_SOURCE = `(${initTheme.toString()})(${JSON.stringify(
  THEME_STORAGE_KEY,
)},${JSON.stringify(THEME_FOLLOW_SYSTEM)},${JSON.stringify(KNOWN_THEME_IDS)});`;
