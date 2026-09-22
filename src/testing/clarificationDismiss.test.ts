/**
 * The owner's rule for every overlay on the paper pages: "any modal should be able to be closed by
 * clicking/tapping anywhere outside of it, and should always have an X button in the upper right
 * corner". The registered clarification dialog (instrument views, missing steps) opens from
 * ?open= and had neither; Escape was its only way out besides the compass's own link.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ReaderController } from "../reader/ReaderController.tsx";
import { registerDefaultClarificationKinds } from "../reader/stack/kinds.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

beforeEach(async () => {
  await installDom();
  registerDefaultClarificationKinds();
});
afterEach(uninstallDom);

const REGISTRY = Object.freeze({
  paperId: "brownian-motion",
  anchors: Object.freeze(["s1"]),
  foundations: Object.freeze([]),
});

async function openInstrumentView() {
  window.history.pushState(null, "", "/papers/brownian-motion/?open=instrument-view:bm-01#s1");
  const pageRoot = document.createElement("div");
  pageRoot.setAttribute("data-reader-root", "");
  pageRoot.innerHTML = `
    <dialog data-clarification-dialog></dialog>
    <p data-reader-announcement></p>
    <p id="s1">The passage.</p>
  `;
  document.body.appendChild(pageRoot);
  const container = document.createElement("div");
  pageRoot.prepend(container);
  const reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(
      createElement(ReaderController, { registry: REGISTRY, titles: {}, questions: {} }),
    );
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  const dialog = document.querySelector<HTMLDialogElement>(
    "[data-instrument-clarification-dialog]",
  );
  return { dialog, unmount: () => act(() => reactRoot.unmount()) };
}

describe("the clarification dialog closes the owner's two ways", () => {
  test("it has an X, first, named for what it does", async () => {
    const { dialog, unmount } = await openInstrumentView();
    expect(dialog?.open).toBe(true);
    const close = dialog?.querySelector<HTMLButtonElement>("[data-clarification-close]");
    expect(close).not.toBeNull();
    expect(close?.getAttribute("aria-label")).toBe("Close and return to the passage");
    expect(dialog?.firstElementChild).toBe(close ?? null);
    unmount();
  });

  test("the X closes it", async () => {
    const { dialog, unmount } = await openInstrumentView();
    dialog?.querySelector<HTMLButtonElement>("[data-clarification-close]")?.click();
    expect(dialog?.open).toBe(false);
    unmount();
  });

  test("a press on the backdrop (the dialog element itself) closes it", async () => {
    const { dialog, unmount } = await openInstrumentView();
    expect(dialog?.open).toBe(true);
    const at = { bubbles: true, clientX: 1, clientY: 1, button: 0, isPrimary: true, pointerId: 1 };
    dialog?.dispatchEvent(new window.PointerEvent("pointerdown", at));
    dialog?.dispatchEvent(new window.PointerEvent("pointerup", at));
    dialog?.dispatchEvent(new window.MouseEvent("click", at));
    expect(dialog?.open).toBe(false);
    unmount();
  });

  test("a press inside the panel does not", async () => {
    const { dialog, unmount } = await openInstrumentView();
    const inside = dialog?.querySelector<HTMLElement>("[data-instrument-clarification-mount]");
    const at = { bubbles: true, clientX: 1, clientY: 1, button: 0, isPrimary: true, pointerId: 1 };
    inside?.dispatchEvent(new window.PointerEvent("pointerdown", at));
    inside?.dispatchEvent(new window.PointerEvent("pointerup", at));
    inside?.dispatchEvent(new window.MouseEvent("click", at));
    expect(dialog?.open).toBe(true);
    unmount();
  });
});
