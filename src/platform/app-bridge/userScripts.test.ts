/**
 * The exact text the app injects, run in a sandbox: inert without the app's
 * message handler, and every message it posts passes the bridge schema.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { NATIVE_EVENT_NAMES, validateEditionMessage } from "./schemas.ts";
import {
  BRIDGE_CAPABILITIES,
  BRIDGE_USER_SCRIPT_SOURCE,
  SITE_THEME_FOLLOW_SYSTEM,
  SITE_THEME_IDS,
  SITE_THEME_KEY,
} from "./userScripts.ts";

type Listener = (event: unknown) => void;

function sandbox(options: {
  inApp: boolean;
  readyState?: string;
  hash?: string;
  throwOnPost?: boolean;
  theme?: string;
  stored?: string | null;
}) {
  const posted: unknown[] = [];
  const windowListeners = new Map<string, Listener[]>();
  const documentListeners = new Map<string, Listener[]>();
  const dispatched: { type: string; detail: unknown }[] = [];
  const location = {
    origin: "am-edition://edition",
    pathname: "/papers/brownian-motion/",
    search: "?detail=2",
    hash: options.hash ?? "",
  };
  const copied: string[] = [];
  const shared: unknown[] = [];
  const navigator = {
    clipboard: {
      writeText: (text: string) => {
        copied.push(text);
        return Promise.resolve();
      },
    },
    share: (data: unknown) => {
      shared.push(data);
      return Promise.resolve();
    },
  };
  const state: { theme: string | null; stored: string | null } = {
    theme: options.theme ?? null,
    stored: options.stored ?? null,
  };
  const localStorage = {
    getItem: (key: string) => (key === "am:settings:v1:theme" ? state.stored : null),
  };
  const observers: (() => void)[] = [];
  class MutationObserver {
    callback: () => void;
    constructor(callback: () => void) {
      this.callback = callback;
    }
    observe() {
      observers.push(this.callback);
    }
  }
  const documentElement =
    options.theme === undefined
      ? undefined
      : { getAttribute: (name: string) => (name === "data-theme" ? state.theme : null) };
  const document = {
    readyState: options.readyState ?? "complete",
    title: "Brownian motion",
    documentElement,
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
  const context = {
    window,
    document,
    location,
    CustomEvent,
    MutationObserver,
    localStorage,
    navigator,
    decodeURIComponent,
  };
  const run = () => runInNewContext(BRIDGE_USER_SCRIPT_SOURCE, context);
  const fire = (target: "window" | "document", type: string) => {
    for (const listener of (target === "window" ? windowListeners : documentListeners).get(type) ??
      []) {
      listener({ type });
    }
  };
  const setTheme = (theme: string, stored?: string) => {
    state.theme = theme;
    if (stored !== undefined) {
      state.stored = stored;
    }
    for (const observer of observers) {
      observer();
    }
  };
  return { window, location, navigator, copied, shared, posted, dispatched, run, fire, setTheme };
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

  it("reports 'system' while the page follows the device, and the theme once the reader chooses", () => {
    const page = sandbox({ inApp: true, theme: "annalen" });
    page.run();
    const themes = () =>
      page.posted
        .filter((m) => (m as { type: string }).type === "settings.changed")
        .map((m) => (m as { body: { theme: string } }).body.theme);
    assert.deepEqual(themes(), ["system"]);
    page.setTheme("kramgasse-night");
    assert.deepEqual(themes(), ["system"], "a device change is still 'system'");
    page.setTheme("kramgasse-night", "kramgasse-night");
    page.setTheme("kramgasse-night");
    assert.deepEqual(themes(), ["system", "kramgasse-night"], "the choice once, not repeated");
    page.setTheme("annalen", "annalen");
    assert.deepEqual(themes(), ["system", "kramgasse-night", "annalen"]);
    for (const message of page.posted) {
      const verdict = validateEditionMessage(message);
      assert.equal(verdict.ok, true, verdict.ok ? "" : verdict.detail);
    }
  });

  it("treats the stored follow-system value and an unknown value as no choice", () => {
    for (const stored of ["follow-system", "slate"]) {
      const page = sandbox({ inApp: true, theme: "annalen", stored });
      page.run();
      const theme = page.posted.find((m) => (m as { type: string }).type === "settings.changed");
      assert.equal((theme as { body: { theme: string } }).body.theme, "system", stored);
    }
  });

  // themeInit.inline.ts imports without extensions, which Node's loader refuses; Bun,
  // the lane this file runs in, resolves them. Under Node the comparison is skipped, not faked.
  it("uses the site's own theme key and values", {
    skip: "Bun" in globalThis ? false : "the site's theme module does not load in Node",
  }, async () => {
    const site = await import("../../app/theme/themeInit.inline.ts");
    assert.equal(SITE_THEME_KEY, site.THEME_STORAGE_KEY);
    assert.equal(SITE_THEME_FOLLOW_SYSTEM, site.THEME_FOLLOW_SYSTEM);
    assert.deepEqual([...SITE_THEME_IDS], [...site.KNOWN_THEME_IDS]);
  });

  it("sends no theme when the page has none", () => {
    const page = sandbox({ inApp: true });
    page.run();
    assert.equal(
      page.posted.filter((m) => (m as { type: string }).type === "settings.changed").length,
      0,
    );
  });

  it("rewrites the app's origin to the website's in copied text, and leaves everything else alone", async () => {
    const page = sandbox({ inApp: true });
    page.run();
    await page.navigator.clipboard.writeText("am-edition://edition/lab/bm-01/?tape=abc#lab-bm-01");
    await page.navigator.clipboard.writeText(
      "see am-edition://edition and am-edition://edition/papers/",
    );
    await page.navigator.clipboard.writeText("am-edition://editionX/not-ours https://example.com/");
    assert.deepEqual(page.copied, [
      "https://annus-mirabilis.com/lab/bm-01/?tape=abc#lab-bm-01",
      "see https://annus-mirabilis.com and https://annus-mirabilis.com/papers/",
      "am-edition://editionX/not-ours https://example.com/",
    ]);
  });

  it("rewrites the url and text of a native share, keeping the title", async () => {
    const page = sandbox({ inApp: true });
    page.run();
    await page.navigator.share({
      title: "Brownian motion",
      url: "am-edition://edition/papers/brownian-motion/#s4",
    });
    // Objects built inside the vm sandbox belong to another realm; compare their JSON.
    assert.deepEqual(JSON.parse(JSON.stringify(page.shared)), [
      { title: "Brownian motion", url: "https://annus-mirabilis.com/papers/brownian-motion/#s4" },
    ]);
  });

  it("leaves the clipboard alone in a browser", async () => {
    const page = sandbox({ inApp: false });
    page.run();
    await page.navigator.clipboard.writeText("am-edition://edition/papers/");
    assert.deepEqual(page.copied, ["am-edition://edition/papers/"]);
  });
});
