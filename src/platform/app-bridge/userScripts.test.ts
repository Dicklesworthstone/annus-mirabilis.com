/**
 * The exact text the app injects, run in a sandbox: inert without the app's
 * message handler, and every message it posts passes the bridge schema.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { NATIVE_EVENT_NAMES, validateEditionMessage } from "./schemas.ts";
import { BRIDGE_CAPABILITIES, BRIDGE_USER_SCRIPT_SOURCE } from "./userScripts.ts";

type Listener = (event: unknown) => void;

function sandbox(options: {
  inApp: boolean;
  readyState?: string;
  hash?: string;
  throwOnPost?: boolean;
}) {
  const posted: unknown[] = [];
  const windowListeners = new Map<string, Listener[]>();
  const documentListeners = new Map<string, Listener[]>();
  const dispatched: { type: string; detail: unknown }[] = [];
  const location = {
    pathname: "/papers/brownian-motion/",
    search: "?detail=2",
    hash: options.hash ?? "",
  };
  const document = {
    readyState: options.readyState ?? "complete",
    title: "Brownian motion",
    addEventListener: (type: string, listener: Listener) => {
      documentListeners.set(type, [...(documentListeners.get(type) ?? []), listener]);
    },
  };
  class CustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init: { detail: unknown }) {
      this.type = type;
      this.detail = init.detail;
    }
  }
  const window: Record<string, unknown> = {
    addEventListener: (type: string, listener: Listener) => {
      windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener]);
    },
    dispatchEvent: (event: { type: string; detail: unknown }) => {
      dispatched.push({ type: event.type, detail: event.detail });
      return true;
    },
  };
  if (options.inApp) {
    window.webkit = {
      messageHandlers: {
        amEdition: {
          postMessage: (message: unknown) => {
            if (options.throwOnPost) {
              throw new TypeError("handler gone");
            }
            posted.push(JSON.parse(JSON.stringify(message)));
          },
        },
      },
    };
  }
  const context = { window, document, location, CustomEvent, decodeURIComponent };
  const run = () => runInNewContext(BRIDGE_USER_SCRIPT_SOURCE, context);
  const fire = (target: "window" | "document", type: string) => {
    for (const listener of (target === "window" ? windowListeners : documentListeners).get(type) ??
      []) {
      listener({ type });
    }
  };
  return { window, location, posted, dispatched, run, fire };
}

describe("the bridge user script", () => {
  it("does nothing at all in a browser, where the app's handler does not exist", () => {
    const page = sandbox({ inApp: false });
    page.run();
    assert.equal(page.window.__AM_APP__, undefined);
    assert.deepEqual(page.posted, []);
  });

  it("defines a frozen __AM_APP__ and reports the route, anchor and title when the page is ready", () => {
    const page = sandbox({ inApp: true, hash: "#s4-p2" });
    page.run();
    const app = page.window.__AM_APP__ as { bridgeVersion: number; capabilities: string[] };
    assert.equal(app.bridgeVersion, 1);
    assert.deepEqual([...app.capabilities], [...BRIDGE_CAPABILITIES]);
    assert.equal(Object.isFrozen(app), true);
    assert.deepEqual(page.posted, [
      {
        v: 1,
        type: "route.changed",
        body: {
          route: "/papers/brownian-motion/?detail=2",
          anchor: "s4-p2",
          title: "Brownian motion",
        },
      },
    ]);
  });

  it("waits for DOMContentLoaded while the document is still loading, then reports on anchor changes", () => {
    const page = sandbox({ inApp: true, readyState: "loading" });
    page.run();
    assert.equal(page.posted.length, 0);
    page.fire("document", "DOMContentLoaded");
    assert.equal(page.posted.length, 1);
    page.location.hash = "#eq-5";
    page.fire("window", "hashchange");
    assert.equal((page.posted[1] as { body: { anchor: string } }).body.anchor, "eq-5");
  });

  it("posts only messages the schema accepts", () => {
    const page = sandbox({ inApp: true, hash: "#s1" });
    page.run();
    page.fire("window", "popstate");
    assert.ok(page.posted.length >= 2);
    for (const message of page.posted) {
      const verdict = validateEditionMessage(message);
      assert.equal(verdict.ok, true, verdict.ok ? "" : verdict.detail);
    }
  });

  it("re-emits only the enumerated native events", () => {
    const page = sandbox({ inApp: true });
    page.run();
    const app = page.window.__AM_APP__ as { dispatch: (name: string, payload: unknown) => boolean };
    assert.equal(app.dispatch(NATIVE_EVENT_NAMES[0], { theme: "annalen" }), true);
    assert.equal(app.dispatch("eval", "alert(1)"), false);
    assert.deepEqual(page.dispatched, [
      { type: `am-app:${NATIVE_EVENT_NAMES[0]}`, detail: { theme: "annalen" } },
    ]);
  });

  it("installs once, and a failing handler never throws into the page", () => {
    const page = sandbox({ inApp: true, throwOnPost: true });
    assert.doesNotThrow(() => page.run());
    const first = page.window.__AM_APP__;
    assert.doesNotThrow(() => page.run());
    assert.equal(page.window.__AM_APP__, first);
  });
});
