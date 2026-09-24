/**
 * The bridge's document-start user script (App plan §7.1). The iPhone app
 * injects exactly this text, and only when its SHA-256 matches the one the
 * edition export recorded; native code evaluates no other JavaScript.
 *
 * The script is `installBridge`, compiled to a string with its arguments, so the
 * function the tests run is the text the app injects. Inside a browser, where
 * `window.webkit.messageHandlers.amEdition` does not exist, it returns at once
 * and defines nothing: the website never loads it anyway.
 *
 * What it does in the app, version 1:
 * - defines a frozen `window.__AM_APP__` with bridgeVersion, capabilities, an
 *   empty settings snapshot (filled by the settings bead), and `dispatch`,
 *   which re-emits only the enumerated native events as `am-app:<name>` DOM events;
 * - posts `route.changed` (route, anchor, title) when the document is ready and
 *   on every hashchange and popstate, which gives the app the page's title and
 *   a readiness point instead of guessing from the web view's URL;
 * - posts `settings.changed` with the reader's chosen theme, or "system" while
 *   the page is following the device, when the document is ready and whenever
 *   the theme changes, so the app's chrome matches the page;
 * - rewrites the app's own origin to https://annus-mirabilis.com in text the
 *   page copies (navigator.clipboard.writeText) or shares (navigator.share),
 *   so a copied link opens for the person it is sent to;
 * - mirrors the reader's own data (every key under "am:") into the app's store
 *   and puts it back if WebKit ever comes up empty.
 */

import {
  BRIDGE_VERSION,
  MAX_MESSAGE_BYTES,
  MESSAGE_HANDLER_NAME,
  NATIVE_EVENT_NAMES,
  SITE_ORIGIN,
} from "./schemas.ts";

/**
 * The site's theme storage key, its "no choice yet" value, and its theme ids:
 * THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM and KNOWN_THEME_IDS in
 * src/app/theme/themeInit.inline.ts, which a test asserts these equal. Copied,
 * not imported, because that module's extensionless imports do not load in Node.
 */
export const SITE_THEME_KEY = "am:settings:v1:theme";
export const SITE_THEME_FOLLOW_SYSTEM = "follow-system";
export const SITE_THEME_IDS: readonly string[] = ["annalen", "kramgasse-night"];

/**
 * Every key the site stores starts with this (src/platform/storage/keys.ts and the
 * notebook, journeys, predictions and tours stores); the mirror copies exactly those.
 */
export const SITE_STORAGE_PREFIX = "am:";

/** A snapshot longer than this is not mirrored: it would not fit in one bridge message. */
export const MAX_SNAPSHOT_LENGTH = MAX_MESSAGE_BYTES - 1024;

/**
 * The one record the mirror writes: every site key and its value, as a JSON object. The app
 * reads it back from the same place to restore the page, list the reader's data and export it.
 */
export const SNAPSHOT_RECORD = { namespace: "localStorage", key: "snapshot" } as const;

/** What the app offers in version 1; the page may branch on these strings. */
export const BRIDGE_CAPABILITIES: readonly string[] = [
  "route",
  "theme",
  "share",
  "storage",
  "print",
  "find",
];

export function installBridge(
  handlerName: string,
  version: number,
  capabilities: readonly string[],
  eventNames: readonly string[],
  themeKey: string,
  followSystem: string,
  themeIds: readonly string[],
  siteOrigin: string,
  storagePrefix: string,
  maxSnapshotLength: number,
  snapshotRecord: { readonly namespace: string; readonly key: string },
): void {
  const w = window as unknown as {
    __AM_APP__?: unknown;
    webkit?: { messageHandlers?: Record<string, { postMessage: (message: unknown) => unknown }> };
  };
  const handler = w.webkit?.messageHandlers?.[handlerName];
  if (handler === undefined || w.__AM_APP__ !== undefined) {
    return;
  }
  const post = (type: string, body: Record<string, unknown>) => {
    try {
      handler.postMessage({ v: version, type, body });
    } catch {
      /* A bridge failure never reaches the page. */
    }
  };
  const request = (type: string, body: Record<string, unknown>): Promise<unknown> => {
    try {
      return Promise.resolve(handler.postMessage({ v: version, type, body }));
    } catch {
      return Promise.resolve(undefined);
    }
  };
  const dispatch = (name: string, payload: unknown): boolean => {
    if (eventNames.indexOf(name) === -1) {
      return false;
    }
    try {
      window.dispatchEvent(new CustomEvent(`am-app:${name}`, { detail: payload }));
    } catch {
      return false;
    }
    return true;
  };
  Object.defineProperty(window, "__AM_APP__", {
    value: Object.freeze({
      bridgeVersion: version,
      capabilities: Object.freeze(capabilities.slice()),
      settings: Object.freeze({}),
      dispatch,
    }),
    writable: false,
    configurable: false,
    enumerable: false,
  });
  // Links the page copies or shares name the app's own origin (the site builds
  // them from location.origin). Rewritten to the website's, they open for
  // whoever receives them; untouched, they would open nothing.
  const editionOrigin = location.origin;
  if (
    typeof editionOrigin === "string" &&
    editionOrigin !== siteOrigin &&
    editionOrigin !== "null"
  ) {
    const escaped = editionOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Not followed by a hostname character, so "am-edition://editionX" is left alone.
    const pattern = new RegExp(`${escaped}(?![A-Za-z0-9.-])`, "g");
    const toSite = (text: string) => text.replace(pattern, siteOrigin);
    const nav = navigator as Navigator & {
      clipboard?: { writeText?: (text: string) => Promise<void> };
    };
    const clipboard = nav.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      const writeText = clipboard.writeText.bind(clipboard);
      try {
        Object.defineProperty(clipboard, "writeText", {
          value: (text: string) => writeText(toSite(String(text))),
          configurable: true,
        });
      } catch {
        /* Leave the clipboard as it was. */
      }
    }
    if (typeof nav.share === "function") {
      const share = nav.share.bind(nav);
      try {
        Object.defineProperty(nav, "share", {
          value: (data: ShareData) =>
            share({
              ...data,
              ...(data?.url === undefined ? {} : { url: toSite(String(data.url)) }),
              ...(data?.text === undefined ? {} : { text: toSite(String(data.text)) }),
            }),
          configurable: true,
        });
      } catch {
        /* Leave sharing as it was. */
      }
    }
  }
  const reportRoute = () => {
    let anchor: string | null = null;
    if (location.hash.length > 1) {
      try {
        anchor = decodeURIComponent(location.hash.slice(1));
      } catch {
        anchor = location.hash.slice(1);
      }
    }
    post("route.changed", {
      route: location.pathname + location.search,
      anchor,
      title: (document.title || "").slice(0, 512),
    });
  };
  // The page's theme, so the app's own chrome (the band behind the status bar,
  // the status bar itself, native sheets) matches the page rather than the device.
  // "system" while the reader has not chosen: the page is following the device,
  // so the app must too. Only an explicit choice is reported as a theme.
  let reportedTheme: string | null = null;
  const reportTheme = () => {
    const theme = document.documentElement?.getAttribute("data-theme") ?? null;
    if (theme === null) {
      return;
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(themeKey);
    } catch {
      stored = null;
    }
    const chosen = stored !== null && stored !== followSystem && themeIds.indexOf(stored) !== -1;
    const value = chosen ? theme : "system";
    if (value === reportedTheme) {
      return;
    }
    reportedTheme = value;
    post("settings.changed", { theme: value.slice(0, 64) });
  };
  // The reader's own data (notes, predictions, journeys, settings: every key under
  // the site's prefix) is mirrored into the app's store, so it survives if WebKit
  // ever clears the page's storage. When WebKit comes up empty and the app's
  // store has a snapshot, the snapshot is put back and the page loads once more.
  const siteKeys = (): string[] => {
    const keys: string[] = [];
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key !== null && key.indexOf(storagePrefix) === 0) {
          keys.push(key);
        }
      }
    } catch {
      /* Storage blocked: nothing to mirror. */
    }
    return keys;
  };
  let mirrored: string | null = null;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const mirror = () => {
    if (pending !== undefined) {
      clearTimeout(pending);
      pending = undefined;
    }
    const data: Record<string, string> = {};
    try {
      for (const key of siteKeys()) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          data[key] = value;
        }
      }
    } catch {
      return;
    }
    const text = JSON.stringify(data);
    if (text === mirrored || text.length > maxSnapshotLength) {
      return;
    }
    mirrored = text;
    post("storage.write", { ...snapshotRecord, value: text });
  };
  const scheduleMirror = () => {
    if (pending !== undefined) {
      clearTimeout(pending);
    }
    pending = setTimeout(mirror, 300);
  };
  let setItem: ((key: string, value: string) => void) | undefined;
  try {
    const proto = Storage.prototype;
    setItem = proto.setItem;
    for (const name of ["setItem", "removeItem", "clear"] as const) {
      const original = proto[name] as (...args: unknown[]) => unknown;
      Object.defineProperty(proto, name, {
        configurable: true,
        writable: true,
        value(this: Storage, ...args: unknown[]) {
          const result = original.apply(this, args);
          try {
            if (this === localStorage) {
              scheduleMirror();
            }
          } catch {
            /* Storage blocked. */
          }
          return result;
        },
      });
    }
  } catch {
    setItem = undefined;
  }
  window.addEventListener("pagehide", mirror);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      mirror();
    }
  });
  const restore = () => {
    void request("storage.read", { ...snapshotRecord }).then(
      (reply) => {
        const result = reply as { status?: string; value?: unknown } | undefined;
        if (result?.status !== "ok" || typeof result.value !== "string" || setItem === undefined) {
          return;
        }
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(result.value) as Record<string, unknown>;
        } catch {
          return;
        }
        let restored = 0;
        for (const key of Object.keys(data)) {
          const value = data[key];
          if (
            key.indexOf(storagePrefix) === 0 &&
            typeof value === "string" &&
            localStorage.getItem(key) === null
          ) {
            setItem.call(localStorage, key, value);
            restored++;
          }
        }
        mirrored = result.value;
        if (restored === 0) {
          return;
        }
        try {
          if (sessionStorage.getItem("am-app:restored") !== null) {
            return;
          }
          sessionStorage.setItem("am-app:restored", "1");
        } catch {
          return;
        }
        location.reload();
      },
      () => {
        /* No store, no restore; the page reads as it is. */
      },
    );
  };
  const ready = () => {
    reportRoute();
    reportTheme();
    if (siteKeys().length === 0) {
      restore();
    } else {
      scheduleMirror();
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
  window.addEventListener("hashchange", reportRoute);
  window.addEventListener("popstate", reportRoute);
  if (typeof MutationObserver === "function" && document.documentElement) {
    new MutationObserver(reportTheme).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }
}

export const BRIDGE_USER_SCRIPT_SOURCE = `(${installBridge.toString()})(${[
  MESSAGE_HANDLER_NAME,
  BRIDGE_VERSION,
  BRIDGE_CAPABILITIES,
  NATIVE_EVENT_NAMES,
  SITE_THEME_KEY,
  SITE_THEME_FOLLOW_SYSTEM,
  SITE_THEME_IDS,
  SITE_ORIGIN,
  SITE_STORAGE_PREFIX,
  MAX_SNAPSHOT_LENGTH,
  SNAPSHOT_RECORD,
]
  .map((argument) => JSON.stringify(argument))
  .join(",")});`;
