/**
 * The exact text the app injects in a UI-test launch, run in a sandbox: inert
 * without the app's message handler; in the app, the page's console, its
 * uncaught errors and its DOM changes reach the app as schema-valid messages,
 * and the page's own console still prints.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { validateEditionMessage } from "./schemas.ts";
import {
  TEST_CONSOLE_USER_SCRIPT_SOURCE,
  TEST_LOG_MAX_MESSAGE,
  TEST_SNAPSHOT_INTERVAL_MS,
} from "./testConsole.ts";

type Message = { v: number; type: string; body: Record<string, unknown> };
type Listener = (event: unknown) => void;

function sandbox(inApp: boolean) {
  const posted: Message[] = [];
  const printed: string[] = [];
  const listeners = new Map<string, Listener[]>();
  const timers: { run: () => void; ms: number }[] = [];
  const observers: (() => void)[] = [];
  const window: Record<string, unknown> = {
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  if (inApp) {
    window.webkit = {
      messageHandlers: {
        amEdition: { postMessage: (message: Message) => posted.push(message) },
      },
    };
  }
  const console = {
    log: (...values: unknown[]) => printed.push(`log ${values.join(" ")}`),
    warn: (...values: unknown[]) => printed.push(`warn ${values.join(" ")}`),
    error: (...values: unknown[]) => printed.push(`error ${values.join(" ")}`),
  };
  class MutationObserver {
    readonly callback: () => void;
    constructor(callback: () => void) {
      this.callback = callback;
    }
    observe() {
      observers.push(this.callback);
    }
  }
  const context: Record<string, unknown> = {
    window,
    console,
    location: { pathname: "/papers/brownian-motion/", search: "?view=source" },
    document: { documentElement: {} },
    MutationObserver,
    setTimeout: (run: () => void, ms: number) => timers.push({ run, ms }),
  };
  Object.assign(window, context);
  return {
    context,
    window,
    console,
    posted,
    printed,
    timers,
    run: () => runInNewContext(TEST_CONSOLE_USER_SCRIPT_SOURCE, context),
    fire: (type: string, event: unknown) => {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    mutate: () => {
      for (const observer of observers) observer();
    },
  };
}

function assertValid(messages: readonly Message[]) {
  assert.ok(messages.length > 0, "nothing was posted");
  for (const message of messages) {
    const verdict = validateEditionMessage(message);
    assert.equal(verdict.ok, true, verdict.ok ? "" : verdict.detail);
  }
}

describe("the test console", () => {
  it("does nothing in a browser, where the app's message handler does not exist", () => {
    const page = sandbox(false);
    const log = page.console.log;
    page.run();
    assert.equal(page.window.__AM_TEST_CONSOLE__, undefined);
    assert.equal(page.console.log, log);
    assert.equal(page.timers.length, 0);
  });

  it("says it was installed, and on which route", () => {
    const page = sandbox(true);
    page.run();
    // Objects made inside the sandbox have its prototypes: compared as the JSON they post.
    assert.deepEqual(JSON.parse(JSON.stringify(page.posted)), [
      {
        v: 1,
        type: "test.log",
        body: {
          level: "log",
          message: "test console installed on /papers/brownian-motion/?view=source",
        },
      },
    ]);
  });

  it("forwards each console level to the app, and the page's console still prints", () => {
    const page = sandbox(true);
    page.run();
    page.posted.length = 0;
    const pageConsole = page.context.console as typeof page.console;
    pageConsole.log("ready", 3);
    pageConsole.warn({ theme: "annalen" });
    pageConsole.error("a refusal");
    assert.deepEqual(
      page.posted.map((m) => [m.body.level, m.body.message]),
      [
        ["log", "ready 3"],
        ["warn", '{"theme":"annalen"}'],
        ["error", "a refusal"],
      ],
    );
    assert.deepEqual(page.printed, ["log ready 3", "warn [object Object]", "error a refusal"]);
    assertValid(page.posted);
  });

  it("clips a long line to the schema's limit, which the schema accepts and one more it refuses", () => {
    const page = sandbox(true);
    page.run();
    page.posted.length = 0;
    (page.context.console as typeof page.console).log("x".repeat(TEST_LOG_MAX_MESSAGE * 2));
    assert.equal(page.posted[0]?.body.message, "x".repeat(TEST_LOG_MAX_MESSAGE));
    assertValid(page.posted);
    const over = validateEditionMessage({
      v: 1,
      type: "test.log",
      body: { level: "log", message: "x".repeat(TEST_LOG_MAX_MESSAGE + 1) },
    });
    assert.equal(over.ok, false, "the constant is below the schema's limit, not at it");
  });

  it("reports an uncaught error and an unhandled rejection, each with a snapshot of the page", () => {
    const page = sandbox(true);
    page.run();
    page.posted.length = 0;
    page.fire("error", { message: "boom", filename: "app.js", lineno: 7 });
    page.fire("unhandledrejection", { reason: "no network" });
    assert.deepEqual(
      page.posted.map((m) => [m.type, m.body.level ?? m.body.route, m.body.message]),
      [
        ["test.log", "error", "uncaught: boom (app.js:7)"],
        ["test.snapshot", "/papers/brownian-motion/?view=source", undefined],
        ["test.log", "error", "unhandled rejection: no network"],
        ["test.snapshot", "/papers/brownian-motion/?view=source", undefined],
      ],
    );
    assertValid(page.posted);
  });

  it("asks for one snapshot per interval however often the document changes", () => {
    const page = sandbox(true);
    page.run();
    page.posted.length = 0;
    page.mutate();
    page.mutate();
    page.mutate();
    assert.equal(page.timers.length, 1);
    assert.equal(page.timers[0]?.ms, TEST_SNAPSHOT_INTERVAL_MS);
    assert.equal(page.posted.length, 0, "the snapshot waits for the interval");
    page.timers[0]?.run();
    assert.deepEqual(
      page.posted.map((m) => m.type),
      ["test.snapshot"],
    );
    page.mutate();
    assert.equal(page.timers.length, 2, "a change after the snapshot schedules the next one");
    assertValid(page.posted);
  });

  it("installs once, however often it is injected", () => {
    const page = sandbox(true);
    page.run();
    page.run();
    const pageConsole = page.context.console as typeof page.console;
    page.posted.length = 0;
    pageConsole.log("once");
    assert.equal(page.posted.length, 1);
  });
});
