/** The authored passage action, the real reading controller, and the live clarification agree. */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { PassageActionsBar } from "../reader/actions/PassageActionsBar.tsx";
import { validatePassageActions } from "../reader/actions/passageActions.schema.ts";
import { ReaderController } from "../reader/ReaderController.tsx";
import { closeDirectOpenDialog } from "../reader/stack/mountDirectOpen.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

const PASSAGE = "arg-bm-osmotic-suspended";
let controller: Root | undefined;

beforeEach(async () => {
  await installDom();
  if (typeof HTMLDialogElement.prototype.showModal !== "function") {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  }
});

afterEach(async () => {
  await act(async () => {
    closeDirectOpenDialog(document);
    controller?.unmount();
  });
  controller = undefined;
  await uninstallDom();
});

async function readingPage() {
  history.replaceState(
    { unrelated: "retained" },
    "",
    "/papers/brownian-motion/?detail=2&lens=modern&notation=modern#arg-earlier",
  );
  document.documentElement.dataset.notation = "modern";
  const page = document.createElement("div");
  page.dataset.readerRoot = "";
  page.dataset.view = "reading";
  page.innerHTML =
    "<dialog data-clarification-dialog></dialog><p data-reader-announcement></p>" +
    '<article id="arg-earlier" class="reader-passage">An earlier passage.</article>' +
    `<article id="${PASSAGE}" data-unit="${PASSAGE}" class="reader-passage">` +
    '<h2 class="passage-question">What counts in osmotic pressure?</h2>' +
    renderToStaticMarkup(
      <PassageActionsBar
        paperId="brownian-motion"
        passageId={PASSAGE}
        passageLabel="What counts in osmotic pressure?"
        actions={validatePassageActions({ hard: false, tryIt: { instrumentId: "bm-02" } })}
      />,
    ) +
    "</article>";
  document.body.append(page);
  const host = document.createElement("div");
  page.prepend(host);
  controller = createRoot(host);
  await act(async () => {
    controller?.render(
      <ReaderController
        registry={{
          paperId: "brownian-motion",
          anchors: ["arg-earlier", PASSAGE],
          foundations: [],
        }}
        titles={{}}
        questions={{}}
      />,
    );
  });
  const trigger = page.querySelector<HTMLAnchorElement>(
    '[data-clarification-open="instrument-view:bm-02"]',
  );
  if (!trigger) throw new Error("The authored Try it action was not rendered.");
  trigger.getBoundingClientRect = () => ({ top: 180, bottom: 200, height: 20 }) as DOMRect;
  trigger.getClientRects = () => [trigger.getBoundingClientRect()] as unknown as DOMRectList;
  return trigger;
}

async function settleUntil(done: () => boolean) {
  for (let tick = 0; tick < 100; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    if (done()) return;
  }
}

describe("Try it from an authored reading passage", () => {
  test("opens the real laboratory in place and retains the interruption and reading axes", async () => {
    const trigger = await readingPage();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    await act(async () => {
      trigger.dispatchEvent(click);
    });
    await settleUntil(
      () => document.querySelector('[data-instance-id="instrument-view:bm-02"]') !== null,
    );
    expect(click.defaultPrevented).toBe(true);
    expect(trigger.getAttribute("href")).toBe("/lab/bm-02/");
    expect(window.location.pathname).toBe("/papers/brownian-motion/");
    expect(window.location.hash).toBe(`#${PASSAGE}`);
    expect(new URLSearchParams(window.location.search).get("open")).toBe("instrument-view:bm-02");
    expect(history.state.unrelated).toBe("retained");
    expect(history.state.annusClarification.stack.frames[0]).toMatchObject({
      anchor: PASSAGE,
      face: "reading",
      detail: 2,
      perspective: "modern",
      notation: "modern",
      triggerId: trigger.id,
      clarification: { kind: "instrument-view", id: "bm-02" },
    });
    const dialog = document.querySelector<HTMLDialogElement>(
      "[data-instrument-clarification-dialog]",
    );
    expect(dialog?.open).toBe(true);
    expect(
      dialog?.querySelector(
        '[data-instrument-id="bm-02"][data-instance-id="instrument-view:bm-02"]',
      ),
    ).not.toBeNull();
    expect(dialog?.querySelector("[data-compass-question]")?.textContent).toBe(
      "What counts in osmotic pressure?",
    );
  });

  test("a modified click keeps the standalone link's browser behavior", async () => {
    const trigger = await readingPage();
    // Let the reading controller inspect the event before preventing native test-DOM navigation.
    let interceptedAtReader = true;
    document.addEventListener(
      "click",
      (event) => {
        interceptedAtReader = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    await act(async () => {
      trigger.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true }),
      );
    });
    expect(interceptedAtReader).toBe(false);
    expect(document.querySelector("[data-instrument-clarification-dialog]")).toBeNull();
    expect(new URLSearchParams(window.location.search).has("open")).toBe(false);
    expect(trigger.getAttribute("href")).toBe("/lab/bm-02/");
  });
});
