/**
 * The exact text the app injects, run in a sandbox: inert without the app's
 * message handler, and every message it posts passes the bridge schema.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { NATIVE_EVENT_NAMES, validateEditionMessage } from "./schemas.ts";
import {
  SETTINGS_SNAPSHOT_PLACEHOLDER,
  SETTINGS_SNAPSHOT_TEMPLATE,
  SITE_TYPE_SCALE_KEY,
  SITE_TYPE_SIZES,
} from "./settingsSnapshot.ts";
import {
  BRIDGE_CAPABILITIES,
  BRIDGE_USER_SCRIPT_SOURCE,
  MAX_SNAPSHOT_LENGTH,
  SITE_STORAGE_PREFIX,
  SITE_THEME_FOLLOW_SYSTEM,
  SITE_THEME_IDS,
  SITE_THEME_KEY,
} from "./userScripts.ts";

type Listener = (event: unknown) => void;
type Message = { v: number; type: string; body: Record<string, unknown> };

/** A small Web Storage, enough for the script: the prototype is what it wraps. */
class FakeStorage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}

function sandbox(options: {
  inApp: boolean;
  readyState?: string;
  hash?: string;
  throwOnPost?: boolean;
  theme?: string;
  stored?: Record<string, string>;
  session?: Record<string, string>;
  replies?: Record<string, unknown>;
  /** <html>'s data-type-scale at document start; null means <html> exists without it. */
  typeScale?: string | null;
  /** The JSON the app fills into the settings snapshot, which then runs before the bridge. */
  appSettings?: string;
}) {
  // Each sandbox gets its own Storage class, since the script wraps the prototype.
  class Storage extends FakeStorage {}
  const localStorage = new Storage();
  for (const [key, value] of Object.entries(options.stored ?? {}))
    localStorage.data.set(key, value);
  const sessionStorage = new Storage();
  for (const [key, value] of Object.entries(options.session ?? {}))
    sessionStorage.data.set(key, value);

  const posted: Message[] = [];
  const windowListeners = new Map<string, Listener[]>();
  const documentListeners = new Map<string, Listener[]>();
  const dispatched: { type: string; detail: unknown }[] = [];
  let reloads = 0;
  const location = {
    origin: "am-edition://edition",
    pathname: "/papers/brownian-motion/",
    search: "?detail=2",
    hash: options.hash ?? "",
    reload: () => {
      reloads++;
    },
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
  const theme = { value: options.theme ?? null };
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
  const attributes = new Map<string, string>();
  if (typeof options.typeScale === "string") attributes.set("data-type-scale", options.typeScale);
  const documentElement =
    options.theme === undefined && options.typeScale === undefined
      ? undefined
      : {
          getAttribute: (name: string) =>
            name === "data-theme" ? theme.value : (attributes.get(name) ?? null),
          setAttribute: (name: string, value: string) => {
            attributes.set(name, String(value));
          },
        };
  const document = {
    readyState: options.readyState ?? "complete",
    title: "Brownian motion",
    visibilityState: "visible",
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
  const timers: (() => void)[] = [];
  const window: Record<string, unknown> = {
    addEventListener: (type: string, listener: Listener) => {
      windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener]);
    },
    dispatchEvent: (event: { type: string; detail: unknown }) => {
      dispatched.push({ type: event.type, detail: event.detail });
      for (const listener of windowListeners.get(event.type) ?? []) listener(event);
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
            const copy = JSON.parse(JSON.stringify(message)) as Message;
            posted.push(copy);
            return Promise.resolve(options.replies?.[copy.type]);
          },
        },
      },
    };
  }
  const context = {
    window,
    document,
    location,
    navigator,
    localStorage,
    sessionStorage,
    Storage,
    CustomEvent,
    MutationObserver,
    decodeURIComponent,
    setTimeout: (callback: () => void) => timers.push(callback),
    clearTimeout: () => {},
  };
  const run = () => {
    if (options.appSettings !== undefined) {
      runInNewContext(
        SETTINGS_SNAPSHOT_TEMPLATE.replace(SETTINGS_SNAPSHOT_PLACEHOLDER, options.appSettings),
        context,
      );
    }
    runInNewContext(BRIDGE_USER_SCRIPT_SOURCE, context);
  };
  /** The site's pre-paint (or its settings panel) sets <html>'s type size; observers then run. */
  const setTypeScale = (value: string) => {
    attributes.set("data-type-scale", value);
    for (const observer of observers) observer();
  };
  const typeScale = () => attributes.get("data-type-scale") ?? null;
  const fire = (target: "window" | "document", type: string) => {
    for (const listener of (target === "window" ? windowListeners : documentListeners).get(type) ??
      []) {
      listener({ type });
    }
  };
  const setTheme = (value: string, stored?: string) => {
    theme.value = value;
    if (stored !== undefined) localStorage.data.set(SITE_THEME_KEY, stored);
    for (const observer of observers) observer();
  };
  /** Runs the timers the script set, as the event loop would. */
  const tick = () => {
    for (const timer of timers.splice(0)) timer();
  };
  /** Lets the script's promise callbacks run. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const of = (type: string) => posted.filter((message) => message.type === type);
  return {
    window,
    location,
    navigator,
    localStorage,
    sessionStorage,
    copied,
    shared,
    posted,
    dispatched,
    run,
    fire,
    setTheme,
    setTypeScale,
    typeScale,
    tick,
    settle,
    of,
    reloads: () => reloads,
  };
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
    assert.deepEqual(page.of("route.changed"), [
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
    assert.equal(page.of("route.changed").length, 0);
    page.fire("document", "DOMContentLoaded");
    assert.equal(page.of("route.changed").length, 1);
    page.location.hash = "#eq-5";
    page.fire("window", "hashchange");
    assert.equal(page.of("route.changed")[1]?.body.anchor, "eq-5");
  });

  it("posts only messages the schema accepts", async () => {
    const page = sandbox({
      inApp: true,
      hash: "#s1",
      theme: "annalen",
      stored: { "am:notebook:v1": "[]" },
    });
    page.run();
    page.fire("window", "popstate");
    page.localStorage.setItem("am:predictions:v1:bm-01", "{}");
    page.tick();
    await page.settle();
    assert.ok(page.posted.length >= 4);
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
    assert.deepEqual(JSON.parse(JSON.stringify(page.dispatched)), [
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

describe("theme", () => {
  const themes = (page: ReturnType<typeof sandbox>) =>
    page.of("settings.changed").map((message) => message.body.theme);

  it("reports 'system' while the page follows the device, and the theme once the reader chooses", () => {
    const page = sandbox({ inApp: true, theme: "annalen" });
    page.run();
    assert.deepEqual(themes(page), ["system"]);
    page.setTheme("kramgasse-night");
    assert.deepEqual(themes(page), ["system"], "a device change is still 'system'");
    page.setTheme("kramgasse-night", "kramgasse-night");
    page.setTheme("kramgasse-night");
    assert.deepEqual(themes(page), ["system", "kramgasse-night"], "the choice once, not repeated");
    page.setTheme("annalen", "annalen");
    assert.deepEqual(themes(page), ["system", "kramgasse-night", "annalen"]);
  });

  it("treats the stored follow-system value and an unknown value as no choice", () => {
    for (const stored of ["follow-system", "slate"]) {
      const page = sandbox({ inApp: true, theme: "annalen", stored: { [SITE_THEME_KEY]: stored } });
      page.run();
      assert.deepEqual(themes(page), ["system"], stored);
    }
  });

  it("sends no theme when the page has none", () => {
    const page = sandbox({ inApp: true });
    page.run();
    assert.deepEqual(themes(page), []);
  });

  // The site's modules import without extensions, which Node's loader refuses; Bun,
  // the lane this file runs in, resolves them. Under Node the comparison is skipped, not faked.
  it("uses the site's own theme key and values", {
    skip: "Bun" in globalThis ? false : "the site's theme module does not load in Node",
  }, async () => {
    const site = await import("../../app/theme/themeInit.inline.ts");
    assert.equal(SITE_THEME_KEY, site.THEME_STORAGE_KEY);
    assert.equal(SITE_THEME_FOLLOW_SYSTEM, site.THEME_FOLLOW_SYSTEM);
    assert.deepEqual([...SITE_THEME_IDS], [...site.KNOWN_THEME_IDS]);
    assert.ok(site.THEME_STORAGE_KEY.startsWith(SITE_STORAGE_PREFIX));
  });
});

describe("links the page copies or shares", () => {
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

describe("the reader's data mirrored into the app", () => {
  const snapshots = (page: ReturnType<typeof sandbox>) =>
    page
      .of("storage.write")
      .map((message) => JSON.parse(String(message.body.value)) as Record<string, string>);

  it("mirrors the site's keys, and only those, after a write settles", () => {
    const page = sandbox({ inApp: true, stored: { "am:notebook:v1": "[1]", "other-site": "x" } });
    page.run();
    page.tick();
    page.localStorage.setItem("am:predictions:v1:bm-01", "{}");
    page.tick();
    assert.deepEqual(snapshots(page), [
      { "am:notebook:v1": "[1]" },
      { "am:notebook:v1": "[1]", "am:predictions:v1:bm-01": "{}" },
    ]);
    for (const message of page.of("storage.write")) {
      assert.deepEqual([message.body.namespace, message.body.key], ["localStorage", "snapshot"]);
    }
  });

  it("mirrors a removal and a clear, and sends nothing when nothing changed", () => {
    const page = sandbox({ inApp: true, stored: { "am:notebook:v1": "[1]", "am:tours:v1": "x" } });
    page.run();
    page.tick();
    page.localStorage.setItem("am:notebook:v1", "[1]");
    page.tick();
    page.localStorage.removeItem("am:tours:v1");
    page.tick();
    page.localStorage.clear();
    page.tick();
    assert.deepEqual(snapshots(page), [
      { "am:notebook:v1": "[1]", "am:tours:v1": "x" },
      { "am:notebook:v1": "[1]" },
      {},
    ]);
  });

  it("mirrors at once when the page is hidden, without waiting for the timer", () => {
    const page = sandbox({ inApp: true, stored: { "am:notebook:v1": "[1]" } });
    page.run();
    page.localStorage.setItem("am:notebook:v1", "[2]");
    page.fire("window", "pagehide");
    assert.deepEqual(snapshots(page).at(-1), { "am:notebook:v1": "[2]" });
  });

  it("does not mirror a snapshot too large for one message", () => {
    const page = sandbox({
      inApp: true,
      stored: { "am:notebook:v1": "x".repeat(MAX_SNAPSHOT_LENGTH) },
    });
    page.run();
    page.tick();
    assert.deepEqual(page.of("storage.write"), []);
  });

  it("restores a snapshot into an empty store and loads the page once more, and only once", async () => {
    const snapshot = JSON.stringify({
      [SITE_THEME_KEY]: "kramgasse-night",
      "am:notebook:v1": "[1]",
      "evil:key": "x",
    });
    const replies = { "storage.read": { status: "ok", value: snapshot } };
    const page = sandbox({ inApp: true, replies });
    page.run();
    await page.settle();
    assert.deepEqual(
      page.of("storage.read").map((message) => message.body),
      [{ namespace: "localStorage", key: "snapshot" }],
    );
    assert.equal(page.localStorage.getItem(SITE_THEME_KEY), "kramgasse-night");
    assert.equal(page.localStorage.getItem("am:notebook:v1"), "[1]");
    assert.equal(page.localStorage.getItem("evil:key"), null, "only the site's own keys come back");
    assert.equal(page.reloads(), 1);

    const again = sandbox({ inApp: true, replies, session: { "am-app:restored": "1" } });
    again.run();
    await again.settle();
    assert.equal(again.reloads(), 0, "a second restore in the same session never reloads");
  });

  it("does not ask for a snapshot when the page already has its data, or reload when there is none", async () => {
    const withData = sandbox({ inApp: true, stored: { "am:notebook:v1": "[1]" } });
    withData.run();
    await withData.settle();
    assert.deepEqual(withData.of("storage.read"), []);

    const missing = sandbox({ inApp: true, replies: { "storage.read": { status: "missing" } } });
    missing.run();
    await missing.settle();
    assert.equal(missing.reloads(), 0);
    assert.equal(missing.localStorage.length, 0);
  });
});

describe("the type size the app maps from the reader's system text size", () => {
  const sizes = (page: ReturnType<typeof sandbox>) =>
    page
      .of("settings.changed")
      .flatMap((message) => (message.body.typeSize === undefined ? [] : [message.body.typeSize]));
  const settingsOf = (page: ReturnType<typeof sandbox>) =>
    JSON.parse(JSON.stringify((page.window.__AM_APP__ as { settings: unknown }).settings));

  it("is the site's own four steps, from its registry", () => {
    assert.deepEqual([...SITE_TYPE_SIZES], [100, 112, 125, 150]);
  });

  it("fills in for a reader who chose no size, and is put back after the site's pre-paint", () => {
    const page = sandbox({ inApp: true, typeScale: null, appSettings: '{"typeSize":150}' });
    page.run();
    assert.equal(page.typeScale(), "150");
    // The site's pre-paint then writes its default; the observer runs before the first paint.
    page.setTypeScale("100");
    assert.equal(page.typeScale(), "150");
    assert.deepEqual(sizes(page), [150]);
    assert.deepEqual(settingsOf(page), { typeSize: 150 });
  });

  it("leaves a size the reader chose in the page alone, and reports that one", () => {
    const page = sandbox({
      inApp: true,
      typeScale: null,
      appSettings: '{"typeSize":150}',
      stored: { [SITE_TYPE_SCALE_KEY]: "112" },
    });
    page.run();
    page.setTypeScale("112");
    assert.equal(page.typeScale(), "112");
    assert.deepEqual(sizes(page), [112]);
  });

  it("follows a new system text size live, through settings.changed", () => {
    const page = sandbox({ inApp: true, typeScale: null, appSettings: '{"typeSize":100}' });
    page.run();
    page.setTypeScale("100");
    const app = page.window.__AM_APP__ as { dispatch: (name: string, payload: unknown) => boolean };
    assert.equal(app.dispatch("settings.changed", { typeSize: 125 }), true);
    assert.equal(page.typeScale(), "125");
    // A size the site does not have is ignored.
    app.dispatch("settings.changed", { typeSize: 300 });
    assert.equal(page.typeScale(), "125");
    assert.deepEqual(sizes(page), [100, 125]);
  });

  it("keeps only a size the site has: anything else in the snapshot never reaches the page", () => {
    for (const json of ['{"typeSize":133}', '{"typeSize":"150"}', '{"theme":"x"}', "7", "null"]) {
      const page = sandbox({ inApp: true, typeScale: null, appSettings: json });
      page.run();
      page.setTypeScale("100");
      assert.equal(page.typeScale(), "100", json);
      assert.deepEqual(settingsOf(page), {}, json);
    }
  });

  it("without the app's snapshot, the page's own size stands and is reported", () => {
    const page = sandbox({ inApp: true, typeScale: null });
    page.run();
    page.setTypeScale("125");
    assert.equal(page.typeScale(), "125");
    assert.deepEqual(sizes(page), [125]);
  });
});
