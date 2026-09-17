/**
 * am-read-return-stack-oxa. Integration test for ReaderController.tsx's new, additive
 * instrument-view/term direct-open wiring (openFromSearch/closeDirectOpenDialog from
 * src/reader/stack/mountDirectOpen.ts). No prior test file existed for ReaderController.tsx;
 * this one is scoped to the wiring this bead added, plus a baseline regression check that the
 * existing foundation-only behavior still mounts and renders without error.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ReaderController } from "./../reader/ReaderController.tsx";
import "../reader/stack/kinds.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

const REGISTRY = Object.freeze({
  paperId: "brownian-motion",
  anchors: Object.freeze(["s1"]),
  // Empty on purpose: the foundation kind is registered by a different, unlanded bead
  // (am-found-library-infra-002t). No foundation ever opens in this test, so this exercises
  // only this bead's own addition without depending on that bead's content.
  foundations: Object.freeze([]),
});

function buildPageDom(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-reader-root", "");
  root.innerHTML = `
    <dialog data-clarification-dialog></dialog>
    <p data-reader-announcement></p>
    <p data-compass-question></p>
    <p data-compass-idea></p>
    <label data-copy-fallback hidden><input /></label>
    <a data-view-link="reading" href="?view=reading">Reading</a>
    <a data-view-link="results" href="?view=results">Results</a>
    <p id="s1">The passage.</p>
  `;
  document.body.appendChild(root);
  return root;
}

describe("ReaderController: baseline (regression check, no prior test existed)", () => {
  test("mounts and renders with no ?open= value and no error", async () => {
    const pageRoot = buildPageDom();
    const container = document.createElement("div");
    pageRoot.prepend(container);
    const reactRoot = createRoot(container);
    await act(async () => {
      reactRoot.render(
        createElement(ReaderController, { registry: REGISTRY, titles: {}, questions: {} }),
      );
    });
    expect(pageRoot.dataset.enhanced).toBe("true");
    expect(pageRoot.dataset.ready).toBe("true");
    act(() => {
      reactRoot.unmount();
    });
  });
});

describe("ReaderController: the direct-open wiring this bead added", () => {
  test("?open=instrument-view:<id> in the URL mounts the instrument clarification dialog on load", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/?open=instrument-view:bm-01#s1");
    const pageRoot = buildPageDom();
    const container = document.createElement("div");
    pageRoot.prepend(container);
    const reactRoot = createRoot(container);
    await act(async () => {
      reactRoot.render(
        createElement(ReaderController, { registry: REGISTRY, titles: {}, questions: {} }),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    const instrumentDialog = document.querySelector("[data-instrument-clarification-dialog]");
    expect(instrumentDialog).not.toBeNull();
    // The existing foundation dialog is untouched: this bead's kind never opens it.
    const foundationDialog = pageRoot.querySelector<HTMLDialogElement>(
      "[data-clarification-dialog]",
    );
    expect(foundationDialog?.open).toBe(false);
    act(() => {
      reactRoot.unmount();
    });
  });

  test("no ?open= value: no instrument dialog is created", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/#s1");
    const pageRoot = buildPageDom();
    const container = document.createElement("div");
    pageRoot.prepend(container);
    const reactRoot = createRoot(container);
    await act(async () => {
      reactRoot.render(
        createElement(ReaderController, { registry: REGISTRY, titles: {}, questions: {} }),
      );
    });
    expect(document.querySelector("[data-instrument-clarification-dialog]")).toBeNull();
    act(() => {
      reactRoot.unmount();
    });
  });
});
