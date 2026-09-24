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
 *   a readiness point instead of guessing from the web view's URL.
 */

import { BRIDGE_VERSION, MESSAGE_HANDLER_NAME, NATIVE_EVENT_NAMES } from "./schemas.ts";

/** What the app offers in version 1; the page may branch on these strings. */
export const BRIDGE_CAPABILITIES: readonly string[] = ["route", "share", "print", "find"];

export function installBridge(
  handlerName: string,
  version: number,
  capabilities: readonly string[],
  eventNames: readonly string[],
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reportRoute, { once: true });
  } else {
    reportRoute();
  }
  window.addEventListener("hashchange", reportRoute);
  window.addEventListener("popstate", reportRoute);
}

export const BRIDGE_USER_SCRIPT_SOURCE = `(${installBridge.toString()})(${JSON.stringify(
  MESSAGE_HANDLER_NAME,
)},${JSON.stringify(BRIDGE_VERSION)},${JSON.stringify(BRIDGE_CAPABILITIES)},${JSON.stringify(
  NATIVE_EVENT_NAMES,
)});`;
