/**
 * The reader's status line is out of sight (reader.css), so a copied passage link is confirmed
 * on the button itself: "Link copied" for two seconds, then the original text. The status line
 * still carries the announcement for assistive technology, and the button's accessible name does
 * not change.
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

async function mount() {
  const pageRoot = document.createElement("div");
  pageRoot.setAttribute("data-reader-root", "");
  pageRoot.innerHTML = `
    <dialog data-clarification-dialog></dialog>
    <p data-reader-announcement></p>
    <p data-compass-question></p>
    <p data-compass-idea></p>
    <label data-copy-fallback hidden><input /></label>
    <p id="s1">The passage.</p>
    <button type="button" data-copy-passage="s1" data-passage-label="The passage"
      aria-label="Copy a link to this passage: The passage">Copy a link</button>
  `;
  document.body.appendChild(pageRoot);
  const container = document.createElement("div");
  pageRoot.prepend(container);
  const reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(
      createElement(ReaderController, { registry: REGISTRY, titles: {}, questions: {} }),
    );
  });
  return { pageRoot, reactRoot };
}

describe("a copied passage link is confirmed on the button", () => {
  test("the button says Link copied, then returns to its text; the status line announces", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/");
    const written: string[] = [];
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void written.push(text) },
    });
    const { pageRoot, reactRoot } = await mount();
    const button = pageRoot.querySelector<HTMLButtonElement>("[data-copy-passage]");
    if (!button) throw new Error("no copy button in the fixture");
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      await Promise.resolve();
    });
    expect(written.length).toBe(1);
    expect(written[0]).toContain("/papers/brownian-motion/#s1");
    expect(button.textContent).toBe("Link copied");
    expect(button.getAttribute("aria-label")).toBe("Copy a link to this passage: The passage");
    expect(pageRoot.querySelector("[data-reader-announcement]")?.textContent).toBe(
      "Link to The passage copied.",
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });
    expect(button.textContent).toBe("Copy a link");
    act(() => {
      reactRoot.unmount();
    });
  });
});
