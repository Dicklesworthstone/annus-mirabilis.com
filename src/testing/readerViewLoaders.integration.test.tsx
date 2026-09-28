/**
 * THE PRODUCTION LOADER MAP, THROUGH THE REAL KIND AND THE REAL DISPATCHER
 * (am-read-return-stack-oxa, dispatch 376).
 *
 * WHICH HALF OF THE QUESTION THIS ANSWERS. It answers whether an `instrument-view` opened with NO
 * injected map now resolves a loader and mounts the laboratory, where until 2026-09-28 every
 * registered instrument resolved nothing and rendered the in-preparation surface. It does NOT
 * answer what a reader sees in a browser: this renders through jsdom, so it says the component
 * mounts and not that its chunk is fetched, styled, or usable. That is a browser measurement and
 * it is not this file.
 *
 * ITS SIBLING, instrumentViewKind.integration.test.ts, INJECTS a fixture map and is the reason the
 * mounted path was tested while never being taken in production. This one passes no map on purpose:
 * if the wiring in kinds.ts is removed, the assertions below fall back to the in-preparation
 * surface and fail, which is the negative the fixture version cannot provide.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ViewLoaders } from "../experiments/dispatch.tsx";
import { READER_VIEW_LOADERS } from "../experiments/views/readerViewLoaders.ts";
import { getClarificationKind } from "../reader/stack/kinds.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

const INJECTED: ViewLoaders = { "sr-01": () => import("../experiments/views/sr01View.tsx") };

async function renderOpen(rawId: string, viewLoaders?: ViewLoaders): Promise<string> {
  const definition = getClarificationKind("instrument-view");
  if (!definition) throw new Error("instrument-view is not registered");
  const parsed = definition.parseId(rawId);
  if (!parsed) throw new Error(`the kind refused the id ${rawId}`);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      definition.render?.({
        parsed,
        instanceId: `${rawId}:test`,
        ...(viewLoaders !== undefined ? { viewLoaders } : {}),
      }),
    );
  });
  // The dispatcher's Suspense fallback IS InPreparationNotice, so a chunk that has not resolved
  // looks exactly like an instrument with no loader. Ticks until the lazy import settles, or the
  // assertion below would be about the fallback rather than about the wiring.
  for (let tick = 0; tick < 20; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (!container.innerHTML.includes('data-testid="in-preparation-notice"')) break;
  }
  return container.innerHTML;
}

describe("the reader stack's view loaders", () => {
  test("the production map carries sr-01 and mounts it through the lazy boundary", async () => {
    // The re-landing of dispatch 385, asserted rather than described. The entry hands out a
    // component ./lazyClarificationViews.tsx has already made lazy, which is the boundary that
    // keeps the laboratory's chunk out of every paper route's initial JavaScript; the budget
    // measurement for that is in the commit, and this is the half a test can hold.
    expect(Object.keys(READER_VIEW_LOADERS)).toEqual(["sr-01"]);
    const html = await renderOpen("sr-01");
    expect(html).not.toContain('data-testid="in-preparation-notice"');
    expect(html).toContain('class="laboratory-shell"');
  });

  test("with a loader injected, sr-01 mounts its laboratory rather than the placeholder", async () => {
    const html = await renderOpen("sr-01", INJECTED);
    // The discriminator, and it is the same one the live measurement used: the placeholder every
    // registered instrument showed until now.
    expect(html).not.toContain('data-testid="in-preparation-notice"');
    // The laboratory's own markup. ClockSyncLab renders the round-trip ledger's heading.
    expect(html).toContain('data-instrument-id="sr-01"');
    // The discriminator is the laboratory's own shell, not the absence of the placeholder: the
    // dispatcher's Suspense fallback IS the placeholder, so "no placeholder" alone would also be
    // true of a chunk that failed to load into nothing.
    expect(html).toContain('class="laboratory-shell"');
    expect(html).toContain('aria-label="Clock synchronization with the event ledger"');
    expect(html).toMatch(/data-run-id="sr01-[^"]+\/run\/1"/);
  });

  test("an unknown id still refuses explicitly, in the same run", async () => {
    const html = await renderOpen("me-99", INJECTED);
    expect(html).toContain('data-testid="unknown-experiment-notice"');
    expect(html).toContain("me-99");
    expect(html).not.toContain('data-instrument-id="sr-01"');
  });

  test("reading-only ON defers it, and turning it off restores it without a re-render", async () => {
    // The first measurement anyone can take of am-a11y-reading-only-6wwd's gate against a REAL
    // view. Until this wiring existed ReadingOnlyView wrapped the in-preparation placeholder, so
    // there was nothing for it to defer and a green reading of "no worker" meant nothing.
    // parseReadingOnly accepts "on" and "off" only, and readReadingOnlyFlag swallows anything
    // else as false, so the wrong spelling here would read as a passing gate that never turned on.
    document.documentElement.dataset.readingOnly = "on";
    const definition = getClarificationKind("instrument-view");
    if (!definition) throw new Error("instrument-view is not registered");
    const parsed = definition.parseId("sr-01");
    if (!parsed) throw new Error("the kind refused sr-01");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let workers = 0;
    const previousWorker = (globalThis as { Worker?: unknown }).Worker;
    (globalThis as { Worker?: unknown }).Worker = class {
      constructor() {
        workers += 1;
      }
      terminate() {}
      postMessage() {}
      addEventListener() {}
    };
    try {
      await act(async () => {
        root.render(
          definition.render?.({
            parsed,
            instanceId: "sr-01:reading-only",
            viewLoaders: INJECTED,
          }),
        );
      });
      for (let tick = 0; tick < 20; tick += 1)
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
      const deferred = container.innerHTML;
      expect(deferred).toContain('data-reading-only-instrument="on"');
      expect(deferred).toContain("data-load-experiment");
      expect(deferred).not.toContain('class="laboratory-shell"');
      expect(workers).toBe(0);

      // Turned off at the document root, with no reload and no new render of this subtree: the
      // component's own MutationObserver is the mechanism under test.
      document.documentElement.dataset.readingOnly = "off";
      for (let tick = 0; tick < 20; tick += 1) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
        if (container.innerHTML.includes('class="laboratory-shell"')) break;
      }
      expect(container.innerHTML).toContain('data-reading-only-instrument="off"');
      expect(container.innerHTML).toContain('class="laboratory-shell"');
    } finally {
      if (previousWorker === undefined) (globalThis as { Worker?: unknown }).Worker = undefined;
      else (globalThis as { Worker?: unknown }).Worker = previousWorker;
      delete document.documentElement.dataset.readingOnly;
    }
  });

  test("an instrument with no entry in the map still shows the placeholder, and says so", async () => {
    // With the production map empty this is every registered instrument, all 37 of them. A reader
    // opening one of those gets the same surface as before, which is why the map's size is
    // reported rather than left to be inferred.
    const html = await renderOpen("bm-01");
    expect(html).toContain('data-testid="in-preparation-notice"');
  });
});
