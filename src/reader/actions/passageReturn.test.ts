/**
 * Product path for am-read-passage-actions-vbe: name an obstacle, open the
 * authored foundation through the existing return stack, come back to the
 * exact passage; copy a link, including the clipboard-denied fallback.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { ReaderController } from "../ReaderController.tsx";
import { registerDefaultClarificationKinds } from "../stack/kinds.ts";
import "./kindRegistration.ts";

beforeEach(async () => {
  await installDom();
  registerDefaultClarificationKinds();
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  }
});
afterEach(uninstallDom);

const REGISTRY = Object.freeze({
  paperId: "brownian-motion",
  anchors: Object.freeze(["arg-bm-observable"]),
  foundations: Object.freeze(["mean-variance-rms"]),
});

function mustQuery<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

function buildPage(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-reader-root", "");
  root.innerHTML = `
    <dialog data-clarification-dialog>
      <p data-compass-question></p>
      <p data-compass-idea></p>
      <button type="button" data-reader-close>Return to the exact step</button>
      <section data-foundation-panel="mean-variance-rms">
        <h2 id="clarification-mean-variance-rms" tabindex="-1">Mean, variance, and RMS</h2>
      </section>
    </dialog>
    <p data-reader-announcement></p>
    <label data-copy-fallback hidden>Passage link<input readonly /></label>
    <article class="reader-passage" id="arg-bm-observable">
      <a href="/foundations/mean-variance-rms/" data-foundation="mean-variance-rms">
        Open the explanation that addresses this
      </a>
      <button
        type="button"
        data-copy-passage="arg-bm-observable"
        data-passage-label="Zero average is not no movement"
      >
        Copy a link to this passage
      </button>
    </article>
  `;
  document.body.appendChild(root);
  return root;
}

async function mount(pageRoot: HTMLElement): Promise<{ unmount: () => void }> {
  const container = document.createElement("div");
  pageRoot.prepend(container);
  const reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(
      createElement(ReaderController, {
        registry: REGISTRY,
        titles: { "mean-variance-rms": "Mean, variance, and RMS" },
        questions: { "arg-bm-observable": "What can we measure when left and right cancel?" },
      }),
    );
  });
  return {
    unmount: () => {
      act(() => {
        reactRoot.unmount();
      });
    },
  };
}

describe("passage actions: return stack", () => {
  test("opening the authored foundation and closing returns to the passage", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/#arg-bm-observable");
    const pageRoot = buildPage();
    const { unmount } = await mount(pageRoot);
    const dialog = mustQuery<HTMLDialogElement>(pageRoot, "[data-clarification-dialog]");
    const link = mustQuery<HTMLAnchorElement>(pageRoot, "[data-foundation]");
    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    expect(dialog.open).toBe(true);
    expect(pageRoot.querySelector("[data-compass-idea]")?.textContent).toBe(
      "Mean, variance, and RMS",
    );
    const close = mustQuery<HTMLButtonElement>(pageRoot, "[data-reader-close]");
    await act(async () => {
      close.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    expect(dialog.open).toBe(false);
    expect(pageRoot.querySelector("[data-reader-announcement]")?.textContent).toBe(
      "Returned to the exact step.",
    );
    unmount();
  });
});

describe("passage actions: copy link", () => {
  test("a refused clipboard write reveals the labeled fallback field", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/#arg-bm-observable");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("denied")),
      },
    });
    const pageRoot = buildPage();
    const { unmount } = await mount(pageRoot);
    const button = mustQuery<HTMLButtonElement>(pageRoot, "[data-copy-passage]");
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      await Promise.resolve();
      await Promise.resolve();
    });
    const fallback = mustQuery<HTMLLabelElement>(pageRoot, "[data-copy-fallback]");
    expect(fallback.hidden).toBe(false);
    const input = mustQuery<HTMLInputElement>(fallback, "input");
    expect(input.value).toBe("http://localhost/papers/brownian-motion/#arg-bm-observable");
    expect(pageRoot.querySelector("[data-reader-announcement]")?.textContent).toBe(
      "Copy the passage link from the selected field.",
    );
    unmount();
  });

  test("a successful copy announces the passage once", async () => {
    window.history.pushState(null, "", "/papers/brownian-motion/#arg-bm-observable");
    let written = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          written = text;
          return Promise.resolve();
        },
      },
    });
    const pageRoot = buildPage();
    const { unmount } = await mount(pageRoot);
    const button = mustQuery<HTMLButtonElement>(pageRoot, "[data-copy-passage]");
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(written).toBe("http://localhost/papers/brownian-motion/#arg-bm-observable");
    expect(pageRoot.querySelector("[data-reader-announcement]")?.textContent).toBe(
      "Link to Zero average is not no movement copied.",
    );
    unmount();
  });
});
