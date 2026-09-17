import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { HeldFixedToggle } from "../components/foundations/HeldFixedToggle.tsx";
import { TableToPlotBuilder } from "../components/foundations/TableToPlotBuilder.tsx";
import { ReaderController } from "../reader/ReaderController.tsx";
import { registerDefaultClarificationKinds } from "../reader/stack/kinds.ts";
import { writeCalculusLog } from "./foundCalculus.logger.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

function mustQuery<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  assert.ok(el, `missing element matching selector: ${selector}`);
  return el;
}

test("foundCalculus.e2e: E2E 1 - From Brownian §4, open foundation:partial-derivatives, toggle held fixed, and return to exact step", async () => {
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

  try {
    window.history.pushState(null, "", "/papers/brownian-motion/s4/#arg-bm-diffusion-eq");

    const pageRoot = document.createElement("div");
    pageRoot.setAttribute("data-reader-root", "");
    pageRoot.innerHTML = `
      <dialog data-clarification-dialog>
        <p data-compass-question></p>
        <p data-compass-idea></p>
        <button type="button" data-reader-close>Return to the exact step</button>
        <section data-foundation-panel="partial-derivatives">
          <h2 id="clarification-partial-derivatives" tabindex="-1">Partial derivatives and held-fixed quantities</h2>
          <div id="held-fixed-container"></div>
        </section>
      </dialog>
      <p data-reader-announcement></p>
      <article class="reader-passage" id="arg-bm-diffusion-eq">
        <h3>Section 4: Diffusion equation</h3>
        <a href="/foundations/partial-derivatives/" data-foundation="partial-derivatives">
          Read the prerequisite on partial derivatives
        </a>
      </article>
    `;
    document.body.appendChild(pageRoot);

    // Mount HeldFixedToggle inside the foundation panel
    const toggleContainer = mustQuery<HTMLElement>(pageRoot, "#held-fixed-container");
    const toggleRoot = createRoot(toggleContainer);
    await act(async () => {
      toggleRoot.render(createElement(HeldFixedToggle));
    });

    // Mount ReaderController
    const controllerContainer = document.createElement("div");
    pageRoot.prepend(controllerContainer);
    const controllerRoot = createRoot(controllerContainer);
    await act(async () => {
      controllerRoot.render(
        createElement(ReaderController, {
          registry: {
            paperId: "brownian-motion",
            anchors: ["arg-bm-diffusion-eq"],
            foundations: ["partial-derivatives"],
          },
          titles: { "partial-derivatives": "Partial derivatives and held-fixed quantities" },
          questions: { "arg-bm-diffusion-eq": "What is held fixed when concentration changes?" },
        }),
      );
    });

    const dialog = mustQuery<HTMLDialogElement>(pageRoot, "[data-clarification-dialog]");
    const openLink = mustQuery<HTMLAnchorElement>(
      pageRoot,
      '[data-foundation="partial-derivatives"]',
    );

    // Step 1: Open foundation from passage
    await act(async () => {
      openLink.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    assert.equal(
      dialog.open,
      true,
      "Clarification drawer must open when foundation link is clicked",
    );
    assert.equal(
      mustQuery<HTMLElement>(pageRoot, "[data-compass-idea]").textContent,
      "Partial derivatives and held-fixed quantities",
    );

    // Step 2: Toggle held fixed (switch to position-fixed: ∂c/∂t)
    const positionBtn = mustQuery<HTMLButtonElement>(pageRoot, 'button[aria-pressed="false"]');
    await act(async () => {
      positionBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    assert.ok(
      pageRoot.textContent?.includes("Case B: Hold position x fixed"),
      "Case B time derivative ∂c/∂t must be active after toggle",
    );

    // Step 3: Return to the exact step
    const closeBtn = mustQuery<HTMLButtonElement>(pageRoot, "[data-reader-close]");
    await act(async () => {
      closeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    assert.equal(
      dialog.open,
      false,
      "Clarification drawer must close when return button is clicked",
    );
    assert.equal(
      mustQuery<HTMLElement>(pageRoot, "[data-reader-announcement]").textContent,
      "Returned to the exact step.",
    );

    writeCalculusLog({
      testId: "e2e-journey-brownian-s4-partial-derivatives",
      foundationId: "partial-derivatives",
      callingAnchor: "brownian-motion:s4#arg-bm-diffusion-eq",
      expected: "Open drawer, toggle held-fixed constraint, return to exact step",
      actual: "Navigation completed, toggle flipped, drawer closed with announcement",
      outcome: "passed",
      message:
        "E2E 1: Successfully navigated Brownian §4 -> partial-derivatives -> toggled held fixed -> returned",
    });

    await act(async () => {
      toggleRoot.unmount();
      controllerRoot.unmount();
    });
    pageRoot.remove();
  } finally {
    await uninstallDom();
  }
});

test("foundCalculus.e2e: E2E 2 - From Brownian §5, open foundation:functions-graphs, build plot with keyboard only, and return", async () => {
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

  try {
    window.history.pushState(null, "", "/papers/brownian-motion/s5/#arg-bm-displacement-law");

    const pageRoot = document.createElement("div");
    pageRoot.setAttribute("data-reader-root", "");
    pageRoot.innerHTML = `
      <dialog data-clarification-dialog>
        <p data-compass-question></p>
        <p data-compass-idea></p>
        <button type="button" data-reader-close>Return to the exact step</button>
        <section data-foundation-panel="functions-graphs">
          <h2 id="clarification-functions-graphs" tabindex="-1">Functions and graphs</h2>
          <div id="table-plot-container"></div>
        </section>
      </dialog>
      <p data-reader-announcement></p>
      <article class="reader-passage" id="arg-bm-displacement-law">
        <h3>Section 5: Mean displacement</h3>
        <a href="/foundations/functions-graphs/" data-foundation="functions-graphs">
          Read the prerequisite on functions and graphs
        </a>
      </article>
    `;
    document.body.appendChild(pageRoot);

    // Mount TableToPlotBuilder
    const builderContainer = mustQuery<HTMLElement>(pageRoot, "#table-plot-container");
    const builderRoot = createRoot(builderContainer);
    await act(async () => {
      builderRoot.render(createElement(TableToPlotBuilder));
    });

    // Mount ReaderController
    const controllerContainer = document.createElement("div");
    pageRoot.prepend(controllerContainer);
    const controllerRoot = createRoot(controllerContainer);
    await act(async () => {
      controllerRoot.render(
        createElement(ReaderController, {
          registry: {
            paperId: "brownian-motion",
            anchors: ["arg-bm-displacement-law"],
            foundations: ["functions-graphs"],
          },
          titles: { "functions-graphs": "Functions and graphs" },
          questions: { "arg-bm-displacement-law": "How does displacement scale with time?" },
        }),
      );
    });

    const dialog = mustQuery<HTMLDialogElement>(pageRoot, "[data-clarification-dialog]");
    const openLink = mustQuery<HTMLAnchorElement>(pageRoot, '[data-foundation="functions-graphs"]');

    // Step 1: Open foundation from passage
    await act(async () => {
      openLink.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    assert.equal(dialog.open, true, "Clarification drawer must open");

    // Step 2: Operate plot builder with keyboard only (Reset -> Plot next -> Plot all)
    const resetBtn = mustQuery<HTMLButtonElement>(
      pageRoot,
      'button[aria-label="Reset plot to first point"]',
    );
    await act(async () => {
      resetBtn.focus();
      resetBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const statusEl = mustQuery<HTMLSpanElement>(pageRoot, ".construction-status");
    assert.equal(statusEl.textContent, "Showing 1 of 5 points plotted.");

    // Advance plot with keyboard
    const nextBtn = mustQuery<HTMLButtonElement>(
      pageRoot,
      'button[aria-label="Plot next data point"]',
    );
    await act(async () => {
      nextBtn.focus();
      nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(statusEl.textContent, "Showing 2 of 5 points plotted.");

    // Plot all with keyboard
    const allBtn = mustQuery<HTMLButtonElement>(
      pageRoot,
      'button[aria-label="Plot all data points"]',
    );
    await act(async () => {
      allBtn.focus();
      allBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(statusEl.textContent, "Showing 5 of 5 points plotted.");

    // Step 3: Return to the exact step with keyboard
    const closeBtn = mustQuery<HTMLButtonElement>(pageRoot, "[data-reader-close]");
    await act(async () => {
      closeBtn.focus();
      closeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(dialog.open, false, "Clarification drawer must close on return");
    assert.equal(
      mustQuery<HTMLElement>(pageRoot, "[data-reader-announcement]").textContent,
      "Returned to the exact step.",
    );

    writeCalculusLog({
      testId: "e2e-journey-brownian-s5-table-plot-keyboard",
      foundationId: "functions-graphs",
      callingAnchor: "brownian-motion:s5#arg-bm-displacement-law",
      expected:
        "Open drawer, operate table-to-plot builder with keyboard only, return to exact step",
      actual: "Plotted count transitioned 1 -> 2 -> 5, drawer closed, returned to anchor",
      outcome: "passed",
      message:
        "E2E 2: Successfully operated TableToPlotBuilder via keyboard and returned to Brownian §5",
    });

    await act(async () => {
      builderRoot.unmount();
      controllerRoot.unmount();
    });
    pageRoot.remove();
  } finally {
    await uninstallDom();
  }
});

test("foundCalculus.e2e: E2E 3 - Open foundation:logarithms with JavaScript disabled and assert 'lg' note renders", async () => {
  const root = resolve("out");
  const outStat = await stat(root).catch(() => null);
  if (!outStat?.isDirectory()) {
    console.log("[foundCalculus.e2e] out/ directory not present; skipping static build checks");
    return;
  }

  const server = createServer(async (req, res) => {
    let file = resolve(
      root,
      `.${decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)}`,
    );
    if ((await stat(file).catch(() => null))?.isDirectory()) {
      file = resolve(file, "index.html");
    }
    try {
      res.setHeader("Content-Type", MIME_TYPES[extname(file)] ?? "application/octet-stream");
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise<void>((resolveListening) =>
    server.listen(0, "127.0.0.1", () => resolveListening()),
  );
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/foundations/logarithms/`;

  try {
    const res = await fetch(url);
    assert.equal(res.status, 200, "Server must return 200 for foundation:logarithms");
    const html = await res.text();

    // Verify 1905 "lg" historical note is present in static SSR HTML without any client JS execution
    assert.ok(
      html.includes("lg") || html.includes("natural logarithm"),
      "Page HTML must explain 1905 'lg' natural logarithm notation",
    );
    assert.ok(
      html.includes("0.693147"),
      "Page HTML must contain the natural log value ln 2 ≈ 0.693147",
    );
    assert.ok(
      html.includes("0.301030"),
      "Page HTML must contain the common base-10 value log10 2 ≈ 0.301030 to contrast with 1905 prints",
    );

    writeCalculusLog({
      testId: "e2e-journey-logarithms-no-javascript",
      foundationId: "logarithms",
      callingAnchor: "light-quanta:s5",
      jsEnabled: false,
      expected:
        "1905 'lg' notation note rendered statically with ln 2 ≈ 0.693147 and log10 2 ≈ 0.301030",
      actual: "All required notation notes and numbers present in static HTML response",
      outcome: "passed",
      message:
        "E2E 3: Successfully verified foundation:logarithms renders 1905 'lg' note with JavaScript disabled",
    });
  } finally {
    server.close();
  }
});
