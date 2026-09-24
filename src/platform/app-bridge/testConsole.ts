/**
 * The test console: a document-start user script the iPhone app injects only in
 * its DEBUG build and only in a UI-test launch (bead am-app-test-harness-da6e,
 * requirement 5). Like the bridge script, it is this function compiled to a
 * string with its arguments, and the app injects it only when its SHA-256 matches
 * the one the edition export recorded.
 *
 * It gives a failing UI test the page's side of the story:
 * - every console.log, console.warn and console.error, an uncaught error and an
 *   unhandled rejection is posted as `test.log`, clipped to the schema's length;
 * - `test.snapshot` asks the app to keep the page's DOM as it is now: after an
 *   error, and at most once per interval while the document keeps changing;
 * - one `test.log` line says it was installed and on which route, so an evidence
 *   folder with no console lines means a quiet page, not a missing script.
 *
 * Without the app's message handler it returns at once and changes nothing.
 */

import { BRIDGE_VERSION, MAX_SHARE_URL_LENGTH, MESSAGE_HANDLER_NAME } from "./schemas.ts";

/** The `test.log` body's limit in schemas.ts; testConsole.test.ts holds the two equal. */
export const TEST_LOG_MAX_MESSAGE = 8192;

/** At most one DOM snapshot per this many milliseconds while the document changes. */
export const TEST_SNAPSHOT_INTERVAL_MS = 2000;

export function installTestConsole(
  handlerName: string,
  version: number,
  maxMessage: number,
  maxRoute: number,
  snapshotIntervalMs: number,
): void {
  const w = window as unknown as {
    __AM_TEST_CONSOLE__?: unknown;
    webkit?: { messageHandlers?: Record<string, { postMessage: (message: unknown) => unknown }> };
  };
  const handler = w.webkit?.messageHandlers?.[handlerName];
  if (handler === undefined || w.__AM_TEST_CONSOLE__ !== undefined) {
    return;
  }
  Object.defineProperty(window, "__AM_TEST_CONSOLE__", { value: true });
  const post = (type: string, body: Record<string, unknown>) => {
    try {
      handler.postMessage({ v: version, type, body });
    } catch {
      /* Evidence never breaks the page. */
    }
  };
  const route = () => (location.pathname + location.search).slice(0, maxRoute);
  const text = (values: readonly unknown[]) =>
    values
      .map((value) => {
        if (typeof value === "string") return value;
        if (value instanceof Error) return `${value.name}: ${value.message}`;
        try {
          return JSON.stringify(value) ?? String(value);
        } catch {
          return String(value);
        }
      })
      .join(" ");
  const log = (level: string, message: string) =>
    post("test.log", { level, message: message.slice(0, maxMessage) });
  const snapshot = () => post("test.snapshot", { route: route() });

  const target = console as unknown as Record<string, unknown>;
  for (const level of ["log", "warn", "error"]) {
    const original = target[level];
    if (typeof original !== "function") continue;
    target[level] = (...values: unknown[]) => {
      log(level, text(values));
      (original as (...values: unknown[]) => void).apply(console, values);
    };
  }
  window.addEventListener("error", (event) => {
    const error = event as ErrorEvent;
    log("error", `uncaught: ${error.message} (${error.filename}:${error.lineno})`);
    snapshot();
  });
  window.addEventListener("unhandledrejection", (event) => {
    log("error", `unhandled rejection: ${text([(event as PromiseRejectionEvent).reason])}`);
    snapshot();
  });
  let due = false;
  try {
    new MutationObserver(() => {
      if (due) return;
      due = true;
      setTimeout(() => {
        due = false;
        snapshot();
      }, snapshotIntervalMs);
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  } catch {
    /* No document element to watch: the snapshots after errors still come. */
  }
  log("log", `test console installed on ${route()}`);
}

export const TEST_CONSOLE_USER_SCRIPT_SOURCE = `(${installTestConsole.toString()})(${[
  MESSAGE_HANDLER_NAME,
  BRIDGE_VERSION,
  TEST_LOG_MAX_MESSAGE,
  MAX_SHARE_URL_LENGTH,
  TEST_SNAPSHOT_INTERVAL_MS,
]
  .map((argument) => JSON.stringify(argument))
  .join(",")});`;
