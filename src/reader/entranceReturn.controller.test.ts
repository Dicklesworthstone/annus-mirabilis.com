/**
 * A first encounter's lesson link opens the lesson beside the text and comes back to the
 * encounter. The light-quanta, relativity and mass-energy entrances are .reader-passage sections,
 * so ReaderController already took them as the place to return to. The Brownian one is a plain
 * element, and its link had no data-foundation, so it left the page; given one, the drawer would
 * have named whichever passage the reader was last in. Outside a passage the controller now
 * returns to the nearest enclosing element the page registers as an anchor, and PaperReader
 * registers the entrance.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { ReaderController } from "./ReaderController.tsx";
import { registerDefaultClarificationKinds } from "./stack/kinds.ts";
import "./actions/kindRegistration.ts";

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

const ENTRY = "entry-brownian-motion";
const QUESTIONS = {
  [ENTRY]: "Do particles that wander in all directions ever get anywhere?",
  "arg-bm-observable": "What can we measure when left and right cancel?",
};

function buildPage(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-reader-root", "");
  root.innerHTML = `
    <dialog data-clarification-dialog>
      <p data-compass-question></p>
      <p data-compass-idea></p>
      <button type="button" data-reader-close>Return</button>
      <section data-foundation-panel="mean-variance-rms">
        <h2 id="clarification-mean-variance-rms" tabindex="-1">Mean, variance, and RMS</h2>
      </section>
    </dialog>
    <p data-reader-announcement></p>
    <section class="reader-entrance-section" aria-label="First encounter">
      <div id="${ENTRY}" data-encounter-id="entrance-brownian-motion" class="encounter">
        <a id="entrance-lesson" href="/foundations/mean-variance-rms/" data-foundation="mean-variance-rms">
          Open the lesson on mean, variance and RMS
        </a>
      </div>
    </section>
    <article class="reader-passage" id="arg-bm-observable">
      <a id="passage-lesson" href="/foundations/mean-variance-rms/" data-foundation="mean-variance-rms">
        Open the explanation
      </a>
    </article>
  `;
  document.body.appendChild(root);
  return root;
}

async function mount(pageRoot: HTMLElement, anchors: readonly string[]) {
  const container = document.createElement("div");
  pageRoot.prepend(container);
  const reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(
      createElement(ReaderController, {
        registry: { paperId: "brownian-motion", anchors, foundations: ["mean-variance-rms"] },
        titles: { "mean-variance-rms": "Mean, variance, and RMS" },
        questions: QUESTIONS,
      }),
    );
  });
  return () => act(() => reactRoot.unmount());
}

async function click(pageRoot: HTMLElement, selector: string) {
  const el = pageRoot.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
}

describe("a first encounter is the place its lesson link returns to", () => {
  test("from the Brownian entrance, the drawer names the entrance and the address holds it", async () => {
    // The reader was last in a passage further down; the entrance must win over that.
    window.history.pushState(null, "", "/papers/brownian-motion/#arg-bm-observable");
    const pageRoot = buildPage();
    const unmount = await mount(pageRoot, [ENTRY, "arg-bm-observable"]);
    await click(pageRoot, "#entrance-lesson");
    const dialog = pageRoot.querySelector<HTMLDialogElement>("[data-clarification-dialog]");
    expect(dialog?.open).toBe(true);
    expect(pageRoot.querySelector("[data-compass-question]")?.textContent).toBe(QUESTIONS[ENTRY]);
    expect(window.location.hash).toBe(`#${ENTRY}`);
    await click(pageRoot, "[data-reader-close]");
    expect(dialog?.open).toBe(false);
    expect(window.location.hash).toBe(`#${ENTRY}`);
    unmount();
  });

  test("an enclosing element the page does not register is not a place to return to", async () => {
    // The registry decides, not the markup: unregistered, the entrance falls back to where the
    // reader was, as every link outside a passage did before.
    window.history.pushState(null, "", "/papers/brownian-motion/#arg-bm-observable");
    const pageRoot = buildPage();
    const unmount = await mount(pageRoot, ["arg-bm-observable"]);
    await click(pageRoot, "#entrance-lesson");
    expect(pageRoot.querySelector("[data-compass-question]")?.textContent).toBe(
      QUESTIONS["arg-bm-observable"],
    );
    expect(window.location.hash).toBe("#arg-bm-observable");
    unmount();
  });

  test("a link inside a passage still returns to its passage", async () => {
    window.history.pushState(null, "", `/papers/brownian-motion/#${ENTRY}`);
    const pageRoot = buildPage();
    const unmount = await mount(pageRoot, [ENTRY, "arg-bm-observable"]);
    await click(pageRoot, "#passage-lesson");
    expect(pageRoot.querySelector("[data-compass-question]")?.textContent).toBe(
      QUESTIONS["arg-bm-observable"],
    );
    expect(window.location.hash).toBe("#arg-bm-observable");
    unmount();
  });
});
