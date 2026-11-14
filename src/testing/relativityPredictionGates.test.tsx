import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { LorentzMapLab } from "../components/lab/sr04/LorentzMapLab.tsx";
import { MovingClocksLab } from "../components/lab/sr05/MovingClocksLab.tsx";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { type LabTapeBinding, tapeForSettings } from "../experiments/permalink/sessionTape.ts";
import { predictionForLink } from "../experiments/predict/authoredChoice.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../experiments/predict/localPredictPersistence.ts";
import { writeGlobalPredictEntry } from "../experiments/predict/predictEntry.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../experiments/predict/predictPersistence.ts";
import { readPredictionsDocument } from "../experiments/predict/predictStorage.ts";
import { ALL_CONSTRAINTS, joinConstraints, SR04_DEFAULTS } from "../experiments/sr04/definition.ts";
import { evaluateSr04 } from "../experiments/sr04/session.ts";
import { SR04_TAPE } from "../experiments/sr04/tape.ts";
import { SR05_DEFAULTS } from "../experiments/sr05/definition.ts";
import { evaluateSr05, type PreparedSr05Example } from "../experiments/sr05/session.ts";
import { SR05_TAPE } from "../experiments/sr05/tape.ts";
import { type GeneratedPredictPrompt, PREDICT_PROMPTS } from "../generated/predict-prompts.ts";
import rawSr05Example from "../generated/sr05-example.json";
import { createStorageContext } from "../platform/storage/store.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

const AWAITING = '[data-predict-response="awaiting"]';

type Case = Readonly<{
  id: string;
  element(): ReactElement;
  binding: LabTapeBinding;
  changed: object;
  field: string;
}>;

const LABS: readonly Case[] = [
  {
    id: "sr-04",
    element: () => createElement(LorentzMapLab, { restoreFromLocation: true }),
    binding: SR04_TAPE,
    changed: { ...SR04_DEFAULTS, vOverC: 0.3 },
    field: "vOverC",
  },
  {
    id: "sr-05",
    element: () =>
      createElement(MovingClocksLab, {
        example: rawSr05Example as PreparedSr05Example,
        restoreFromLocation: true,
        highlightPaper: true,
      }),
    binding: SR05_TAPE,
    changed: { ...SR05_DEFAULTS, speed: 0.3 },
    field: "speed",
  },
];

type Handlers = {
  onChange?: (event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => void;
  onSubmit?: (event: { preventDefault(): void }) => void;
};

/** Happy DOM form proxies hide React's key from enumeration; ordinary inputs expose it. */
function handlers(container: HTMLElement, target: Element): Handlers {
  const input = container.querySelector('input[name="speed"], input[name="vOverC"]');
  assert.ok(input, "The real laboratory input must be present.");
  const key =
    Object.keys(target).find((name) => name.startsWith("__reactProps$")) ??
    Object.keys(input).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The mounted control must carry React handlers.");
  const record = (target as unknown as Record<string, Handlers>)[key];
  assert.ok(record, "The mounted control's handler record must be available.");
  return record;
}

async function mounted(element: ReactElement, run: (container: HTMLElement) => Promise<void>) {
  const container = createContainer();
  const paper = document.createElement("main");
  container.replaceWith(paper);
  paper.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(element));
    await run(container);
  } finally {
    await act(async () => root.unmount());
    removeContainer(container);
    paper.remove();
  }
}

/** Restoration includes a dynamic codec import and decompression, not just a React microtask. */
async function until(ready: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!ready()) {
    assert.ok(Date.now() < deadline, "The real tape restore did not finish.");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

function share(container: HTMLElement) {
  return decodeTapePermalink(
    container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value ?? "",
  );
}

function authored(lab: string, promptId?: string): GeneratedPredictPrompt {
  const prompt = promptId
    ? PREDICT_PROMPTS[lab]?.find((candidate) => candidate.promptId === promptId)
    : PREDICT_PROMPTS[lab]?.[0];
  assert.ok(prompt, "The exercised prompt must exist in the generated authored data.");
  return prompt;
}

function close(actual: number, expected: number) {
  // These fixtures are O(1) quantities; 1e-12 covers binary evaluation, not model disagreement.
  expect(withinTolerance(actual, expected, { relative: 1e-12, absolute: 1e-15 }).ok).toBe(true);
}

describe("relativity predictions preserve access to controls and the accepted run", () => {
  beforeEach(async () => {
    await installDom();
    installPredictPersistence(LOCAL_PREDICT_PERSISTENCE);
    writeGlobalPredictEntry(createStorageContext(), "predict-first");
  });

  afterEach(async () => {
    installPredictPersistence(REMEMBERS_NOTHING);
    await uninstallDom();
  });

  for (const lab of LABS) {
    test(
      lab.id +
        ": results, readings and source wait while controls and a typed refusal stay visible",
      async () => {
        await mounted(lab.element(), async (container) => {
          const surface = container.querySelector<HTMLElement>(
            '[data-instrument-id="' + lab.id + '"]',
          );
          assert.ok(surface);
          const responses = [...surface.querySelectorAll("[data-predict-response]")];
          expect(responses.length).toBeGreaterThan(5);
          expect(responses.every((response) => response.matches(AWAITING))).toBe(true);
          expect(
            surface.querySelector("[data-predict-gate]")?.getAttribute("data-predict-gate"),
          ).toBe("awaiting");

          const form = surface.querySelector("form");
          assert.ok(form);
          expect(form.closest(AWAITING)).toBeNull();
          const chrome = surface.querySelector(".execution-chrome");
          assert.ok(chrome);
          expect(chrome.closest(AWAITING)).toBeNull();
          const readings = [...surface.querySelectorAll(":scope > p[data-detail]")];
          expect(readings.length).toBe(3);
          expect(readings.every((reading) => reading.matches(AWAITING))).toBe(true);
          const margin = surface.querySelector(".lab-margin p span");
          assert.ok(margin);
          expect(margin.matches(AWAITING)).toBe(true);
          for (const table of surface.querySelectorAll("table"))
            expect(table.closest(AWAITING)).not.toBeNull();
          for (const summary of surface.querySelectorAll(".status-line, .sr05-bars"))
            expect(summary.closest(AWAITING)).not.toBeNull();

          // Accepted readings stay intact; a refused request must hide its old live source evidence.
          const currentSourceWeave = () =>
            lab.id === "sr-05"
              ? surface.querySelector<HTMLDetailsElement>("[data-result-weave]")
              : null;
          const sourceLinks = () =>
            [...(currentSourceWeave()?.querySelectorAll(".result-weave-links a") ?? [])].map(
              (link) => link.getAttribute("href"),
            );
          let sourceSentence: HTMLElement | null = null;
          if (lab.id === "sr-05") {
            const sourceWeave = currentSourceWeave();
            assert.ok(sourceWeave, "The moving-clock result must expose its real source weave.");
            const sourceResponse = sourceWeave.closest("[data-predict-response]");
            assert.ok(sourceResponse);
            expect(responses).toContain(sourceResponse);
            expect(sourceWeave.querySelector("[data-weave-snapshot]")).not.toBeNull();
            expect(sourceWeave.querySelector('[data-weave-lit="true"]')).not.toBeNull();
            expect(sourceWeave.querySelector("[data-weave-row] dl")).not.toBeNull();
            expect(sourceLinks().length).toBeGreaterThan(0);
            expect(sourceWeave.querySelector("[data-weave-snapshot]")?.textContent).toContain(
              "Prepared worked example",
            );
            expect(sourceLinks()).toEqual([
              "/papers/special-relativity/view/german/#s4-p9-s2",
              "/papers/special-relativity/view/english/#s4-p9-s2",
            ]);
            history.replaceState({}, "", "/papers/special-relativity/s4/");
            sourceSentence = document.createElement("span");
            sourceSentence.className = "source-sentence";
            sourceSentence.dataset.sentenceId = "s4-p9-s2";
            sourceSentence.textContent = "The moving clock's loss per second.";
            container.before(sourceSentence);
            await act(async () => {
              sourceWeave.open = true;
              sourceWeave.dispatchEvent(new Event("toggle"));
            });
            expect(sourceSentence.hasAttribute("data-live-weave-owner")).toBe(false);
            expect(sourceWeave.querySelector('[aria-live="polite"]')?.textContent).toBe("");
          }
          const linksBefore = sourceLinks();
          const acceptedText = () => {
            const sourceResponse = currentSourceWeave()?.closest("[data-predict-response]") ?? null;
            return [...surface.querySelectorAll("[data-predict-response]")]
              .filter((response) => response !== sourceResponse)
              .map((response) => response.textContent);
          };
          const before = acceptedText();
          const runId = surface.getAttribute("data-run-id");
          assert.ok(runId, "The accepted run must have a real identity.");
          const input = form.querySelector<HTMLInputElement>('input[name="' + lab.field + '"]');
          assert.ok(input);
          const change = handlers(container, input).onChange;
          assert.ok(change);
          await act(async () => {
            input.value = "1";
            change({ target: input, currentTarget: input });
          });
          // Read the new render's submit closure after the draft change has committed.
          const submit = handlers(container, form).onSubmit;
          assert.ok(submit);
          await act(async () => submit({ preventDefault() {} }));

          const refusal = surface.querySelector('[data-refusal-code="invalid-parameter"]');
          assert.ok(refusal, "The real parameter validator must refuse a light-speed clock/frame.");
          expect(refusal.closest(AWAITING)).toBeNull();
          for (const currency of surface.querySelectorAll("[data-currency-state]"))
            expect(currency.closest(AWAITING)).toBeNull();
          expect(surface.getAttribute("data-run-id")).toBe(runId);
          expect(acceptedText()).toEqual(before);
          const currentResponses = [...surface.querySelectorAll("[data-predict-response]")];
          expect(currentResponses).toHaveLength(responses.length);
          expect(currentResponses.every((response) => response.matches(AWAITING))).toBe(true);
          if (lab.id === "sr-05") {
            const sourceWeave = currentSourceWeave();
            assert.ok(sourceWeave, "The live source weave must remain present after refusal.");
            expect(sourceWeave.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
            expect(sourceWeave.querySelector("[data-weave-snapshot]")).toBeNull();
            expect(sourceWeave.querySelector("[data-weave-context]")).toBeNull();
            expect(sourceWeave.querySelector('[data-weave-lit="true"]')).toBeNull();
            expect(sourceWeave.querySelector("[data-weave-row] dl")).toBeNull();
            expect(sourceWeave.closest(AWAITING)).not.toBeNull();
            expect(sourceLinks()).toEqual(linksBefore);
            assert.ok(sourceSentence);
            expect(sourceSentence.hasAttribute("data-live-weave-owner")).toBe(false);
            expect(sourceWeave.querySelector('[aria-live="polite"]')?.textContent).toBe("");
          }
        });
      },
    );

    test(
      lab.id +
        ": a verified shared prediction restores with its settings " +
        "and preserves the private original",
      async () => {
        const prompt = authored(lab.id);
        assert.ok(prompt.supportedCandidateId);
        const other = prompt.candidates.find(
          (candidate) => candidate.id !== prompt.supportedCandidateId,
        );
        assert.ok(other);
        const original = { form: "candidate" as const, candidateId: prompt.supportedCandidateId };
        const incoming = { form: "candidate" as const, candidateId: other.id };
        LOCAL_PREDICT_PERSISTENCE.record(lab.id, prompt.promptId, original);
        const privateBefore = readPredictionsDocument(createStorageContext());
        const tape = tapeForSettings(lab.binding, lab.changed);
        assert.ok(tape, "The real owner must accept the shared settings.");
        const prediction = predictionForLink(prompt.promptId, incoming);
        history.replaceState(
          {},
          "",
          "/lab/" +
            lab.id +
            "/?tape=" +
            encodeTapePermalink({ ...tape, predictions: [prediction] }),
        );

        await mounted(lab.element(), async (container) => {
          await until(() => {
            const decoded = share(container);
            return (
              container.querySelector<HTMLInputElement>('input[name="' + lab.field + '"]')
                ?.value === "0.3" &&
              decoded.kind === "success" &&
              JSON.stringify(decoded.tape.predictions) === JSON.stringify([prediction])
            );
          });
          const responses = [...container.querySelectorAll("[data-predict-response]")];
          expect(responses.length).toBeGreaterThan(5);
          expect(
            responses.every(
              (response) => response.getAttribute("data-predict-response") === "shown",
            ),
          ).toBe(true);
          const adjudication = container.querySelector("[data-predict-adjudication]");
          expect(adjudication?.getAttribute("data-predict-adjudication")).toBe("not-close");
          expect(adjudication?.textContent).toContain(other.separatingAssumption);
          expect(readPredictionsDocument(createStorageContext())).toEqual(privateBefore);
        });

        // The shared choice is a record for this visit. A later ordinary visit still shows our own.
        history.replaceState({}, "", "/lab/" + lab.id + "/");
        await mounted(lab.element(), async (container) => {
          expect(
            container
              .querySelector("[data-predict-adjudication]")
              ?.getAttribute("data-predict-adjudication"),
          ).toBe("match");
          expect(readPredictionsDocument(createStorageContext())).toEqual(privateBefore);
        });
      },
    );
  }
});

describe("the authored alternatives match the existing relativity owners", () => {
  test("SR04 separates two light conditions, reciprocity, and completion of the map", () => {
    const lightPrompt = authored("sr-04", "sr-04-predict-light-constraints");
    const reciprocalPrompt = authored("sr-04", "sr-04-predict-map-fixed");
    expect(lightPrompt.supportedCandidateId).toBe("b-equals-a");
    expect(reciprocalPrompt.supportedCandidateId).toBe("one-free-function");
    const light = evaluateSr04({
      ...SR04_DEFAULTS,
      enabledConstraints: joinConstraints(["right-moving-light", "left-moving-light"]),
    }).family;
    assert.ok(light.status === "underdetermined");
    expect(light.relations).toEqual(["b = a", "d = -a*v/(c*c)"]);
    const reciprocal = evaluateSr04({
      ...SR04_DEFAULTS,
      enabledConstraints: joinConstraints([
        "right-moving-light",
        "left-moving-light",
        "reciprocity",
      ]),
    }).family;
    assert.ok(reciprocal.status === "underdetermined");
    expect(reciprocal.neededInformation).toEqual(["isotropy", "identity-branch"]);
    const fixed = evaluateSr04({
      ...SR04_DEFAULTS,
      enabledConstraints: joinConstraints(ALL_CONSTRAINTS),
    }).family;
    assert.ok(fixed.status === "value");
    close(fixed.value.a, 1.25);
    close(fixed.value.b, 1.25);
  });

  test("SR04's ordinary change of frame distinguishes the two ray directions", () => {
    expect(authored("sr-04", "sr-04-predict-galilean-light").supportedCandidateId).toBe(
      "ordinary-subtraction",
    );
    const result = evaluateSr04(SR04_DEFAULTS);
    assert.ok(result.rightRayFraction.status === "value");
    assert.ok(result.leftRayFraction.status === "value");
    close(result.rightRayFraction.value, 0.4);
    close(result.leftRayFraction.value, -1.6);
  });

  test("SR05's supported return reading comes from the existing accepted outputs", () => {
    expect(authored("sr-05").supportedCandidateId).toBe("eight-seconds");
    const results = evaluateSr05(SR05_DEFAULTS);
    for (const [quantityId, expected] of [
      ["properTime", 8],
      ["coordinateTime", 10],
      ["reunionExactLag", 2],
    ] as const) {
      const result = results.find((candidate) => candidate.quantityId === quantityId);
      assert.ok(result?.status === "value" && typeof result.value === "number");
      close(result.value, expected);
    }
  });
});
