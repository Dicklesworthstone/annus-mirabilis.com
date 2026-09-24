/**
 * The app's settings, known before the page's first paint (bead am-app-settings-prepaint-tydj,
 * requirement 1). The bridge is asynchronous and a pre-paint read cannot wait for it, so the app
 * injects this fixed script at document start, ahead of the bridge, with one JSON value in place
 * of the placeholder. The edition export records the template's SHA-256; the app checks it
 * before filling it in, and fills in only JSON it encoded from enumerated values. The script
 * then keeps only the fields it knows, with the values it allows, so no other value reaches the
 * page whatever the app sends.
 *
 * Version 1 carries one setting: `typeSize`, the edition's type size in percent, which the app
 * maps from the reader's system text size (Dynamic Type).
 */

import { storageKeyRegistry } from "../storage/keys.ts";

/** The site's own type-size setting: its stored key and its steps (src/platform/storage/keys.ts). */
export const SITE_TYPE_SCALE_KEY = "am:settings:v1:typeScale";

export const SITE_TYPE_SIZES: readonly number[] = (
  storageKeyRegistry.settings().find((entry) => entry.key === SITE_TYPE_SCALE_KEY)?.allowedValues ??
  []
).map(Number);

/** The one span of the template the app replaces. It is a valid expression on its own. */
export const SETTINGS_SNAPSHOT_PLACEHOLDER = "null /* am-app-settings */";

export function installSettingsSnapshot(snapshot: unknown, typeSizes: readonly number[]): void {
  const settings: { typeSize?: number } = {};
  if (snapshot !== null && typeof snapshot === "object") {
    const typeSize = (snapshot as { typeSize?: unknown }).typeSize;
    if (typeof typeSize === "number" && typeSizes.indexOf(typeSize) !== -1) {
      settings.typeSize = typeSize;
    }
  }
  try {
    Object.defineProperty(window, "__AM_APP_SETTINGS__", {
      value: Object.freeze(settings),
      writable: false,
      configurable: false,
      enumerable: false,
    });
  } catch {
    /* Already defined: the first snapshot stands. */
  }
}

export const SETTINGS_SNAPSHOT_TEMPLATE = `(${installSettingsSnapshot.toString()})(${SETTINGS_SNAPSHOT_PLACEHOLDER},${JSON.stringify(
  SITE_TYPE_SIZES,
)});`;
