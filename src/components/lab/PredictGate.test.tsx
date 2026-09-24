import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { decodeTapePermalink } from "../../experiments/permalink/codec.ts";
import { writeGlobalPredictEntry } from "../../experiments/predict/predictEntry.ts";
import {
  getStoredPrompt,
  markVisited,
  readPredictionsDocument,
  writePredictionsDocument,
} from "../../experiments/predict/predictStorage.ts";
import type { PreparedSr10Example } from "../../experiments/sr10/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR11_EXAMPLE } from "../../experiments/sr11/session.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import rawSr10Example from "../../generated/sr10-example.json";
import { createStorageContext } from "../../platform/storage/store.ts";
import { applyReaderPrepaint } from "../../reader/detail/prepaint.ts";
import {
  DETAIL_STORAGE_KEY,
  FACES,
  NOTATION_STORAGE_KEY,
  parseDetail,
  parseNotation,
} from "../../reader/navigation/state.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { LightComplexLab } from "./sr10/LightComplexLab.tsx";
import { MovingMirrorLab } from "./sr11/MovingMirrorLab.tsx";

/**
 * Predict mode hides a laboratory's result until the reader answers (am-inst-predict-mode-ti7m).
 *
 * With JavaScript: the status line and the results wait while the question is unanswered; choosing
 * a candidate, saying "I have one in mind", or skipping shows them. Without JavaScript nothing is
 * hidden, since the panel's controls could not work: the markup carries the result, and the only
 * rule that hides it applies under the reader pre-paint's data-detail, which only a running script
 * sets. SR-10 and SR-11 are the first two laboratories drawn from their manifests' prompts.
 */
const LABS: readonly (readonly [string, () => ReactElement])[] = [
  [
    "sr-10",
    () =>
      createElement(LightComplexLab, { example: rawSr10Example as unknown as PreparedSr10Example }),
  ],
  ["sr-11", () => createElement(MovingMirrorLab, { example: SR11_EXAMPLE })],
];

type Handlers = Record<string, ((...args: unknown[]) => void) | undefined>;
/** Under this happy-dom harness a dispatched event does not reach React, so handlers are called. */
function handlers(el: Element | null | undefined): Handlers {
  if (!el) return {};
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$")) ?? "";
  return (el as unknown as Record<string, Handlers>)[key] ?? {};
}

function responses(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-predict-response]")].map(
    (el) => el.getAttribute("data-predict-response") ?? "",
  );
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

async function mounted(
  element: ReactElement,
  run: (container: HTMLElement) => Promise<void>,
): Promise<void> {
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(element);
    });
    await settle();
    await run(container);
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
}

function button(container: HTMLElement, text: string): Element | undefined {
  return [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
}

describe("with JavaScript, a first-time reader answers before the result shows", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  for (const [lab, element] of LABS) {
    const prompt = PREDICT_PROMPTS[lab]?.[0];
    const supported = prompt?.candidates.find((c) => c.id === prompt.supportedCandidateId);
    const other = prompt?.candidates.find((c) => c.id !== prompt.supportedCandidateId);

    test(`${lab}: the status line and the results wait, and the question is asked`, async () => {
      expect(prompt).toBeDefined();
      await mounted(element(), async (container) => {
        const waiting = responses(container);
        // The status line and the results, both waiting.
        expect(waiting.length).toBeGreaterThanOrEqual(2);
        expect(waiting.every((s) => s === "awaiting")).toBe(true);
        expect(
          container.querySelector("[data-predict-gate]")?.getAttribute("data-predict-gate"),
        ).toBe("awaiting");
        expect(container.querySelector("[data-predict-waiting]")).not.toBeNull();
        expect(container.textContent).toContain(prompt?.question ?? "missing");
        expect(
          container.querySelectorAll(`input[name="${prompt?.promptId}-candidate"]`).length,
        ).toBe(prompt?.candidates.length ?? -1);
      });
    });

    test(`${lab}: choosing the supported candidate shows the result, says so, records it, and a shared link carries it`, async () => {
      await mounted(element(), async (container) => {
        const radio = container.querySelector(
          `input[name="${prompt?.promptId}-candidate"][value="${supported?.id}"]`,
        );
        await act(async () => {
          handlers(radio).onChange?.();
        });
        await settle();
        expect(responses(container).every((s) => s === "shown")).toBe(true);
        expect(container.querySelector("[data-predict-waiting]")).toBeNull();
        expect(
          container
            .querySelector("[data-predict-adjudication]")
            ?.getAttribute("data-predict-adjudication"),
        ).toBe("match");
        const stored = getStoredPrompt(
          readPredictionsDocument(createStorageContext()),
          lab,
          prompt?.promptId ?? "",
        );
        expect(stored).toEqual({
          status: "predicted",
          prediction: { form: "candidate", candidateId: supported?.id ?? "" },
        });
        // The share control encodes after hydration; its link carries the prediction as an event.
        let link = "";
        for (let i = 0; i < 100 && !link; i++) {
          await settle();
          link =
            container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value ??
            "";
        }
        const decoded = decodeTapePermalink(link);
        expect(decoded.kind).toBe("success");
        if (decoded.kind === "success")
          expect(decoded.tape.predictions).toEqual([
            {
              promptId: prompt?.promptId ?? "",
              form: "candidate",
              payload: { candidateId: supported?.id ?? "" },
            },
          ]);
      });
    });

    test(`${lab}: another candidate shows the result with that candidate's assumption, in no words of judgement`, async () => {
      await mounted(element(), async (container) => {
        const radio = container.querySelector(
          `input[name="${prompt?.promptId}-candidate"][value="${other?.id}"]`,
        );
        await act(async () => {
          handlers(radio).onChange?.();
        });
        await settle();
        expect(responses(container).every((s) => s === "shown")).toBe(true);
        const verdict = container.querySelector("[data-predict-adjudication]");
        expect(verdict?.getAttribute("data-predict-adjudication")).toBe("not-close");
        expect(verdict?.textContent).toContain(other?.separatingAssumption ?? "missing");
        const panel = container.querySelector("[data-predict-gate]")?.textContent ?? "";
        expect(panel).not.toMatch(/\b(wrong|incorrect|failed|mistake|sorry)\b/i);
      });
    });

    test(`${lab}: skipping always shows the result, and records no prediction`, async () => {
      await mounted(element(), async (container) => {
        const skip = button(container, "Skip prediction");
        expect(skip).toBeDefined();
        await act(async () => {
          handlers(skip).onClick?.();
        });
        await settle();
        expect(responses(container).every((s) => s === "shown")).toBe(true);
        expect(container.querySelector("[data-predict-adjudication]")).toBeNull();
        expect(
          getStoredPrompt(
            readPredictionsDocument(createStorageContext()),
            lab,
            prompt?.promptId ?? "",
          ),
        ).toEqual({ status: "skipped" });
      });
    });

    test(`${lab}: "I have one in mind" shows the result and stores nothing it could compare`, async () => {
      await mounted(element(), async (container) => {
        await act(async () => {
          handlers(button(container, "I have one in mind")).onClick?.();
        });
        await settle();
        expect(responses(container).every((s) => s === "shown")).toBe(true);
        expect(container.textContent).toContain(
          "Nothing was stored. Compare the one you have in mind with the result.",
        );
        expect(
          getStoredPrompt(
            readPredictionsDocument(createStorageContext()),
            lab,
            prompt?.promptId ?? "",
          ),
        ).toEqual({ status: "predicted-unrecorded" });
      });
    });

    test(`${lab}: a reader who answered on an earlier visit is not asked again`, async () => {
      const ctx = createStorageContext();
      writePredictionsDocument(
        ctx,
        markVisited(readPredictionsDocument(ctx), lab, prompt?.promptId ?? ""),
      );
      await mounted(element(), async (container) => {
        expect(responses(container).every((s) => s === "shown")).toBe(true);
      });
    });

    test(`${lab}: a reader who chose to explore directly is not asked`, async () => {
      writeGlobalPredictEntry(createStorageContext(), "explore-directly");
      await mounted(element(), async (container) => {
        expect(responses(container).every((s) => s === "shown")).toBe(true);
      });
    });
  }
});

describe("without JavaScript, nothing is hidden", () => {
  const css = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "predict.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");
  const selectorsOf = (needle: string) =>
    [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selector]) => selector?.includes(needle))
      .map(([, selector, body]) => ({ selector: (selector ?? "").trim(), body: body ?? "" }));

  for (const [lab, element] of LABS) {
    test(`${lab}: the server markup carries the result beside the waiting attribute`, () => {
      const html = renderToStaticMarkup(element());
      expect(html).toContain('data-predict-response="awaiting"');
      expect(html).toContain("Values at these settings");
      expect(html).toContain('class="status-line"');
    });
  }

  test("the only rules that hide the result or the panel depend on the pre-paint's data-detail", () => {
    const hideResult = selectorsOf('[data-predict-response="awaiting"]');
    const hidePanel = selectorsOf("[data-predict-gate]");
    expect(hideResult.length).toBeGreaterThan(0);
    expect(hidePanel.length).toBeGreaterThan(0);
    for (const rule of hideResult)
      expect(rule.selector.startsWith("html[data-detail] ")).toBe(true);
    for (const rule of hidePanel)
      expect(rule.selector.startsWith("html:not([data-detail]) ")).toBe(true);
  });

  test("the reader pre-paint sets data-detail on a page with no query and no stored choice", async () => {
    await installDom();
    try {
      delete document.documentElement.dataset.detail;
      applyReaderPrepaint(
        DETAIL_STORAGE_KEY,
        parseDetail,
        FACES,
        NOTATION_STORAGE_KEY,
        parseNotation,
      );
      expect(document.documentElement.dataset.detail).toBe("1");
    } finally {
      await uninstallDom();
    }
  });
});
