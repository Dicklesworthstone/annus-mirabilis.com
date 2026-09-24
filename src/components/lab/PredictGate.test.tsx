import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { PreparedBm04Example } from "../../experiments/bm04/session.ts";
import type { PreparedBm05Example } from "../../experiments/bm05/session.ts";
import type { PreparedBm07Example } from "../../experiments/bm07/session.ts";
import type { PreparedBm08Example } from "../../experiments/bm08/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as ME01_EXAMPLE } from "../../experiments/me01/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as ME02_EXAMPLE } from "../../experiments/me02/session.ts";
import { decodeTapePermalink } from "../../experiments/permalink/codec.ts";
import { writeGlobalPredictEntry } from "../../experiments/predict/predictEntry.ts";
import {
  getStoredPrompt,
  markVisited,
  readPredictionsDocument,
  writePredictionsDocument,
} from "../../experiments/predict/predictStorage.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR02_EXAMPLE } from "../../experiments/sr02/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR06_EXAMPLE } from "../../experiments/sr06/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR08_EXAMPLE } from "../../experiments/sr08/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR09_EXAMPLE } from "../../experiments/sr09/session.ts";
import type { PreparedSr10Example } from "../../experiments/sr10/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR11_EXAMPLE } from "../../experiments/sr11/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR12_EXAMPLE } from "../../experiments/sr12/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as SR13_EXAMPLE } from "../../experiments/sr13/session.ts";
import rawBm04Example from "../../generated/bm04-example.json";
import rawBm05Example from "../../generated/bm05-example.json";
import rawBm07Example from "../../generated/bm07-example.json";
import rawBm08Example from "../../generated/bm08-example.json";
import { type GeneratedPredictPrompt, PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
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
import { ConfigurationLab } from "./bm03/ConfigurationLab.tsx";
import { CameraLab } from "./CameraLab.tsx";
import { CoefficientLab } from "./CoefficientLab.tsx";
import { DriftDiffusionLab } from "./DriftDiffusionLab.tsx";
import { InferenceLab } from "./InferenceLab.tsx";
import { IndependentConfigurationsLab } from "./lq05/IndependentConfigurationsLab.tsx";
import { CoefficientMatchLab } from "./lq06/CoefficientMatchLab.tsx";
import { IonizationLab } from "./lq09/IonizationLab.tsx";
import { MagnetConductorLab } from "./MagnetConductorLab.tsx";
import { TwoLedgersLab } from "./me01/TwoLedgersLab.tsx";
import { BoundaryLedgerLab } from "./me03/BoundaryLedgerLab.tsx";
import { presentedOrder } from "./PredictGate.tsx";
import { ClockSyncLab } from "./sr01/ClockSyncLab.tsx";
import { VelocityCompositionLab } from "./sr06/VelocityCompositionLab.tsx";
import { FieldFrameChangeLab } from "./sr08/FieldFrameChangeLab.tsx";
import { DopplerAberrationLab } from "./sr09/DopplerAberrationLab.tsx";
import { LightComplexLab } from "./sr10/LightComplexLab.tsx";
import { MovingMirrorLab } from "./sr11/MovingMirrorLab.tsx";
import { ChargeCurrentLab } from "./sr12/ChargeCurrentLab.tsx";
import { ElectronDynamicsLab } from "./sr13/ElectronDynamicsLab.tsx";
import { WalkLab } from "./WalkLab.tsx";

/**
 * Predict mode hides a laboratory's result until the reader answers (am-inst-predict-mode-ti7m).
 *
 * With JavaScript: the status line and the results wait while the question is unanswered; choosing
 * a candidate, saying "I have one in mind", or skipping shows them. Without JavaScript nothing is
 * hidden, since the panel's controls could not work: the markup carries the result, and the only
 * rule that hides it applies under the reader pre-paint's data-detail, which only a running script
 * sets. Each row names a lab and a piece of its result's text, which the server markup must carry.
 */
/**
 * The gated labs. `result` is text from each lab's result that the server markup must carry.
 * `sharesTape`: whether the lab offers a ?tape= link to carry a prediction. BM-04, BM-05, BM-07 and BM-08
 * share none (their worker runner is not written); BM-03, LQ-09, ME-01 and SR-01 have none yet, their bindings waiting
 * in a worktree (dispatch 145). `statusLine`: whether the lab has a status line; BM-04, LQ-06 and ME-02 have none.
 */
type GatedLab = Readonly<{
  lab: string;
  element: () => ReactElement;
  result: string;
  sharesTape: boolean;
  statusLine: boolean;
}>;

const LABS: readonly GatedLab[] = [
  {
    lab: "bm-03",
    element: () => createElement(ConfigurationLab, {}),
    result: "One accepted calculation",
    sharesTape: false,
    statusLine: true,
  },
  {
    lab: "bm-04",
    element: () =>
      createElement(DriftDiffusionLab, {
        example: rawBm04Example as unknown as PreparedBm04Example,
      }),
    result: "Inspect and export the accepted dataset",
    sharesTape: false,
    statusLine: false,
  },
  {
    lab: "bm-05",
    element: () =>
      createElement(WalkLab, { example: rawBm05Example as unknown as PreparedBm05Example }),
    result: "Step law and whole-ensemble spread",
    sharesTape: false,
    statusLine: true,
  },
  {
    lab: "bm-07",
    element: () =>
      createElement(InferenceLab, { example: rawBm07Example as unknown as PreparedBm07Example }),
    result: "What the data identify",
    sharesTape: false,
    statusLine: true,
  },
  {
    lab: "bm-08",
    element: () =>
      createElement(CameraLab, { example: rawBm08Example as unknown as PreparedBm08Example }),
    result: "Four estimates, different assumptions",
    sharesTape: false,
    statusLine: true,
  },
  {
    lab: "lq-05",
    element: () => createElement(IndependentConfigurationsLab, {}),
    result: "Calculated microstate and entropy outputs",
    sharesTape: true,
    statusLine: true,
  },
  {
    lab: "lq-06",
    element: () => createElement(CoefficientMatchLab, {}),
    result: "Values at these settings",
    sharesTape: true,
    statusLine: false,
  },
  {
    lab: "lq-09",
    element: () => createElement(IonizationLab, {}),
    result: "Values at these settings",
    sharesTape: false,
    statusLine: true,
  },
  {
    lab: "me-01",
    element: () => createElement(TwoLedgersLab, { example: ME01_EXAMPLE }),
    result: "Derivation steps",
    sharesTape: false,
    statusLine: true,
  },
  {
    lab: "me-02",
    element: () => createElement(CoefficientLab, { example: ME02_EXAMPLE }),
    result: "Named-speed comparison (worked example)",
    sharesTape: true,
    statusLine: false,
  },
  {
    lab: "me-03",
    element: () => createElement(BoundaryLedgerLab, {}),
    result: "Cited energy-source boundary facts",
    sharesTape: true,
    statusLine: true,
  },
  {
    lab: "sr-01",
    element: () => createElement(ClockSyncLab, {}),
    result: "Event ledger",
    sharesTape: false,
    statusLine: true,
  },
  {
    lab: "sr-02",
    element: () => createElement(MagnetConductorLab, { example: SR02_EXAMPLE }),
    result: "Accepted snapshot",
    sharesTape: true,
    statusLine: true,
  },
  {
    lab: "sr-06",
    element: () => createElement(VelocityCompositionLab, { example: SR06_EXAMPLE }),
    result: "Accepted composition",
    sharesTape: true,
    statusLine: true,
  },
  {
    lab: "sr-08",
    element: () => createElement(FieldFrameChangeLab, { example: SR08_EXAMPLE }),
    result: "Transformation ledger",
    sharesTape: true,
    statusLine: true,
  },
  {
    lab: "sr-09",
    element: () => createElement(DopplerAberrationLab, { example: SR09_EXAMPLE }),
    result: "Values at these settings",
    sharesTape: true,
    statusLine: true,
  },
  {
    lab: "sr-10",
    element: () =>
      createElement(LightComplexLab, { example: rawSr10Example as unknown as PreparedSr10Example }),
    result: "Values at these settings",
    sharesTape: true,
    statusLine: true,
  },
  {
    lab: "sr-11",
    element: () => createElement(MovingMirrorLab, { example: SR11_EXAMPLE }),
    result: "Values at these settings",
    sharesTape: true,
    statusLine: true,
  },
  {
    lab: "sr-12",
    element: () => createElement(ChargeCurrentLab, { example: SR12_EXAMPLE }),
    result: "Charge and current density telemetry across frames",
    sharesTape: true,
    statusLine: true,
  },
  {
    lab: "sr-13",
    element: () => createElement(ElectronDynamicsLab, { example: SR13_EXAMPLE }),
    result: "Values at these settings",
    sharesTape: true,
    statusLine: true,
  },
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

/** Prompt text as the page shows it: a braced script's letters stand inline in textContent. */
function shownText(text: string): string {
  return text.replace(/[_^]\{([^{}]*)\}/g, "$1");
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

  for (const { lab, element, sharesTape, statusLine } of LABS) {
    const prompt = PREDICT_PROMPTS[lab]?.[0];
    const supported = prompt?.candidates.find((c) => c.id === prompt.supportedCandidateId);
    const other = prompt?.candidates.find((c) => c.id !== prompt.supportedCandidateId);

    test(`${lab}: the status line and the results wait, and the question is asked`, async () => {
      expect(prompt).toBeDefined();
      await mounted(element(), async (container) => {
        const waiting = responses(container);
        expect(waiting.length).toBeGreaterThan(0);
        expect(waiting.every((s) => s === "awaiting")).toBe(true);
        // Every status line states the result, so each one waits, itself or inside a waiting region.
        const lines = [...container.querySelectorAll(".status-line")];
        expect(lines.length > 0).toBe(statusLine);
        for (const line of lines) expect(line.closest("[data-predict-response]")).not.toBeNull();
        expect(
          container.querySelector("[data-predict-gate]")?.getAttribute("data-predict-gate"),
        ).toBe("awaiting");
        expect(container.querySelector("[data-predict-waiting]")).not.toBeNull();
        expect(container.textContent).toContain(shownText(prompt?.question ?? "missing"));
        expect(
          container.querySelectorAll(`input[name="${prompt?.promptId}-candidate"]`).length,
        ).toBe(prompt?.candidates.length ?? -1);
      });
    });

    test(`${lab}: before the answer each candidate is drawn by its label, never by the reasoning that names the supported one`, async () => {
      await mounted(element(), async (container) => {
        const panel = container.querySelector("[data-predict-gate]")?.textContent ?? "";
        for (const c of prompt?.candidates ?? []) {
          expect(panel).toContain(shownText(c.label));
          if (!c.label.includes(c.description)) expect(panel).not.toContain(c.description);
        }
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
        if (prompt?.explanation)
          expect(container.textContent).toContain(shownText(prompt.explanation));
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
        // A lab with no ?tape= link offers no share control to carry a prediction.
        if (!sharesTape) {
          expect(container.querySelector('[data-testid="selectable-url"]')).toBeNull();
          return;
        }
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
        expect(verdict?.textContent).toContain(shownText(other?.separatingAssumption ?? "missing"));
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
        if (prompt?.explanation)
          expect(container.textContent).toContain(shownText(prompt.explanation));
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

/**
 * What a gated lab's reader can see of its prompts: the question, the labels, the explanation, and
 * the assumption of any candidate the model does not support (shown after that choice).
 */
function readerCopy(prompt: GeneratedPredictPrompt): string[] {
  return [
    prompt.question,
    ...(prompt.explanation ? [prompt.explanation] : []),
    ...prompt.candidates.map((c) => c.label),
    ...prompt.candidates
      .filter((c) => c.id !== prompt.supportedCandidateId)
      .map((c) => c.separatingAssumption),
  ];
}

describe("a gated lab's prompts judge no choice and speak the paper's vocabulary", () => {
  // A wrong prediction is a starting point, never a judgement (AGENTS.md, predict mode). Four
  // assumptions said "incorrectly", "mistakenly", "is confused with" or "Misapplies" until 5fa26651.
  // "naive" is left out: BM-08 names an estimator "naive D", a statistics term, not a verdict.
  const judging =
    /\b(?:wrong(?:ly)?|incorrect(?:ly)?|mistaken(?:ly)?|confus(?:ed|es|ion)|misappl\w*|foolish)\b/i;
  for (const { lab } of LABS) {
    test(`${lab}: no judging word, and no "photon", in anything a reader can see`, () => {
      const copy = (PREDICT_PROMPTS[lab] ?? []).flatMap(readerCopy);
      expect(copy.length).toBeGreaterThan(0);
      expect(copy.filter((t) => judging.test(t))).toEqual([]);
      expect(copy.filter((t) => /\bphotons?\b/i.test(t))).toEqual([]);
    });
  }
});

describe("the order a gate draws candidates in", () => {
  const all = Object.values(PREDICT_PROMPTS).flat();

  test("is each prompt's own candidates, in the same order on every call", () => {
    expect(all.length).toBeGreaterThan(0);
    for (const prompt of all) {
      const once = presentedOrder(prompt).candidates.map((c) => c.id);
      expect([...once].sort()).toEqual(prompt.candidates.map((c) => c.id).sort());
      expect(presentedOrder(prompt).candidates.map((c) => c.id)).toEqual(once);
    }
  });

  test("does not depend on which candidate the model supports", () => {
    for (const prompt of all) {
      const order = presentedOrder(prompt).candidates.map((c) => c.id);
      for (const c of prompt.candidates) {
        expect(
          presentedOrder({ ...prompt, supportedCandidateId: c.id }).candidates.map((x) => x.id),
        ).toEqual(order);
      }
    }
  });
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

  for (const { lab, element, result: resultText, statusLine } of LABS) {
    test(`${lab}: the server markup carries the result beside the waiting attribute`, () => {
      const html = renderToStaticMarkup(element());
      expect(html).toContain('data-predict-response="awaiting"');
      expect(html).toContain(resultText);
      if (statusLine) expect(html).toMatch(/class="[^"]*\bstatus-line\b/);
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
