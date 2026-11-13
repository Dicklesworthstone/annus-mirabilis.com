/**
 * Real light-quanta laboratories ask before revealing their accepted calculations. Controls,
 * numerical refusals, local originals and shared predictions keep their existing contracts.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { SpectrumLab } from "../components/lab/lq03/SpectrumLab.tsx";
import { EntropyWorkbenchLab } from "../components/lab/lq04/EntropyWorkbenchLab.tsx";
import { LQ03_DEFAULTS } from "../experiments/lq03/definition.ts";
import { LQ03_TAPE } from "../experiments/lq03/tape.ts";
import { LQ04_DEFAULTS } from "../experiments/lq04/definition.ts";
import { evaluateLq04 } from "../experiments/lq04/session.ts";
import { LQ04_TAPE } from "../experiments/lq04/tape.ts";
import { encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { tapeForSettings } from "../experiments/permalink/sessionTape.ts";
import { predictionForLink } from "../experiments/predict/authoredChoice.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../experiments/predict/localPredictPersistence.ts";
import { writeGlobalPredictEntry } from "../experiments/predict/predictEntry.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../experiments/predict/predictPersistence.ts";
import { getStoredPrompt, readPredictionsDocument } from "../experiments/predict/predictStorage.ts";
import { RetainedSessionProvider } from "../experiments/store/retainedSession.tsx";
import {
  createSessionRetention,
  type PreparedRetainedSession,
  type RetainedSession,
  type SessionRetention,
  type SessionRetentionIdentity,
} from "../experiments/store/sessionRetention.ts";
import { type GeneratedPredictPrompt, PREDICT_PROMPTS } from "../generated/predict-prompts.ts";
import { createStorageContext } from "../platform/storage/store.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

type LabId = "lq-03" | "lq-04";
const LABS: readonly LabId[] = ["lq-03", "lq-04"];
const PROMPT_IDS = {
  "lq-03": ["lq-03-predict-density-peak", "lq-03-predict-band-energy"],
  "lq-04": ["lq-04-predict-halving-volume"],
} as const;
const AWAITING = '[data-predict-response="awaiting"]';

let container: HTMLElement;
let root: Root | null = null;
let owner: RetainedSession | undefined;
let retention: SessionRetention;

/** Keep the actual owner observable, without mocking its methods or the browser tape decoder. */
function observedRetention(): SessionRetention {
  const cache = createSessionRetention();
  return {
    ...cache,
    prepare<T extends RetainedSession>(
      placementKey: string,
      identity: SessionRetentionIdentity,
      create: (instanceId: string) => T,
    ): PreparedRetainedSession<T> {
      const prepared = cache.prepare(placementKey, identity, create);
      owner = prepared.session;
      return prepared;
    },
  };
}

beforeEach(async () => {
  await installDom();
  container = createContainer();
  retention = observedRetention();
  owner = undefined;
  installPredictPersistence(LOCAL_PREDICT_PERSISTENCE);
  writeGlobalPredictEntry(createStorageContext(), "predict-first");
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  retention.dispose();
  removeContainer(container);
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function laboratory(lab: LabId, restoreFromLocation = false) {
  const props = { instanceId: `predict-test-${lab}`, restoreFromLocation };
  return lab === "lq-03" ? <SpectrumLab {...props} /> : <EntropyWorkbenchLab {...props} />;
}

async function mount(lab: LabId, restoreFromLocation = false) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <RetainedSessionProvider
        cache={retention}
        placementKey="light-quanta-prediction-test"
        instanceId={`predict-test-${lab}`}
        previous={null}
        onReference={() => undefined}
      >
        {laboratory(lab, restoreFromLocation)}
      </RetainedSessionProvider>,
    );
  });
}

function required<T extends Element = HTMLElement>(selector: string, scope = container): T {
  const element = scope.querySelector<T>(selector);
  assert.ok(element, `The mounted laboratory must contain ${selector}.`);
  return element;
}

function prompts(lab: LabId): readonly GeneratedPredictPrompt[] {
  const authored = PREDICT_PROMPTS[lab];
  assert.ok(authored?.length, `${lab} must have generated, authored prediction prompts.`);
  for (const id of PROMPT_IDS[lab])
    assert.ok(authored.some((prompt) => prompt.promptId === id), `Missing prompt ${id}.`);
  return authored;
}

function firstPrompt(lab: LabId): GeneratedPredictPrompt {
  const prompt = prompts(lab)[0];
  assert.ok(prompt, "The laboratory must offer a first prompt.");
  return prompt;
}

function panel(prompt: GeneratedPredictPrompt) {
  return required(`[data-predict-prompt="${prompt.promptId}"]`);
}

function original(lab: LabId, prompt: GeneratedPredictPrompt) {
  return getStoredPrompt(readPredictionsDocument(createStorageContext()), lab, prompt.promptId);
}

type Handlers = {
  onChange?: (event: unknown) => void;
  onSubmit?: (event: unknown) => void;
};

function handlers(target: Element): Handlers {
  // Happy DOM's form/select proxies hide React's own key. An ordinary input exposes the
  // same renderer key, which still addresses the mounted form/select's real handler.
  const key =
    Object.keys(target).find((name) => name.startsWith("__reactProps$")) ??
    Object.keys(required("input")).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The mounted control must have a React renderer key.");
  const value = (target as unknown as Record<string, Handlers>)[key];
  assert.ok(value, "The renderer key must address the actual control's handlers.");
  return value;
}

async function edit(selector: string, value: string) {
  const control = required<HTMLInputElement | HTMLSelectElement>(selector);
  const change = handlers(control).onChange;
  assert.ok(change, "The mounted setting must have its real change handler.");
  await act(async () => {
    control.value = value;
    change({ target: control, currentTarget: control });
  });
}

async function submit() {
  const apply = handlers(required("form")).onSubmit;
  assert.ok(apply, "The mounted laboratory form must apply settings.");
  await act(async () => apply({ preventDefault() {} }));
}

async function choose(prompt: GeneratedPredictPrompt, candidateId: string) {
  const control = required<HTMLInputElement>(
    `input[type="radio"][value="${candidateId}"]`,
    panel(prompt),
  );
  const change = handlers(control).onChange;
  assert.ok(change, "The offered prediction must be selectable.");
  await act(async () => change({ target: control, currentTarget: control }));
}

async function click(label: string, scope = container) {
  const button = [...scope.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  assert.ok(button, `The laboratory must offer "${label}".`);
  await act(async () => button.click());
}

async function waitForAcceptedSettings(settings: object) {
  const currentOwner = owner;
  assert.ok(currentOwner?.subscribe, "The mounted laboratory must expose its real owner.");
  const subscribe = currentOwner.subscribe;
  await act(async () => {
    await new Promise<void>((resolve, reject) => {
      let unsubscribe: (() => void) | undefined;
      const timeout = setTimeout(() => {
        unsubscribe?.();
        reject(new Error("The shared tape did not produce its accepted laboratory settings."));
      }, 2000);
      const check = () => {
        const accepted = currentOwner.getSnapshot().accepted?.parameters;
        if (
          !accepted ||
          !Object.entries(settings).every(([key, value]) => Object.is(accepted[key], value))
        )
          return;
        clearTimeout(timeout);
        unsubscribe?.();
        resolve();
      };
      unsubscribe = subscribe(check);
      check();
    });
  });
}

async function waitForImportedPrediction(prompt: GeneratedPredictPrompt, label: string) {
  const deadline = Date.now() + 2000;
  const expected = `Recorded prediction: ${label}`;
  while (panel(prompt).querySelector("[data-predict-original]")?.textContent?.trim() !== expected) {
    assert.ok(
      Date.now() < deadline,
      "The shared prediction did not reach the mounted laboratory's recorded choice.",
    );
    // Owner acceptance precedes the hook's restore callback. Yield one event-loop turn inside
    // act, then check after React commits; awaiting a DOM condition inside act can deadlock.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe("light-quanta prediction gates", () => {
  for (const lab of LABS) {
    test(`${lab}: results wait while controls and typed refusals remain usable`, async () => {
      await mount(lab);
      expect(required("[data-predict-gate]").getAttribute("data-predict-gate")).toBe("awaiting");
      for (const prompt of prompts(lab)) {
        const offered = panel(prompt);
        expect(offered.getAttribute("data-predict-state")).toBe("hidden");
        expect(offered.querySelectorAll('input[type="radio"]').length).toBe(3);
        expect(offered.querySelector("[data-predict-explanation]")).toBeNull();
      }
      const result = required(".lab-results");
      expect(result.matches(AWAITING)).toBe(true);
      expect(result.querySelectorAll("table").length).toBeGreaterThan(0);
      for (const table of result.querySelectorAll("table"))
        expect(table.closest(AWAITING)).not.toBeNull();
      for (const level of ["0", "1", "2"]) {
        const caption = required(`.laboratory > p[data-detail="${level}"]`);
        expect(caption.matches(AWAITING)).toBe(true);
      }
      expect(required(".lab-margin p > span").matches(AWAITING)).toBe(true);
      expect(required(".show-the-code").closest(AWAITING)).not.toBeNull();
      expect(required("[data-result-weave]").closest(AWAITING)).not.toBeNull();
      expect(container.querySelector("[data-weave-snapshot]")).toBeNull();
      expect(required('[data-result-weave] [aria-live="polite"]').textContent).toBe("");
      expect(required("form").closest(AWAITING)).toBeNull();
      expect(required(".lab-status-row").closest(AWAITING)).toBeNull();
      expect(required("form button").closest("fieldset[disabled]")).toBeNull();
      if (lab === "lq-03") expect(required(".lq03-spectrum svg").closest(AWAITING)).not.toBeNull();

      const accepted = owner?.getSnapshot().accepted;
      assert.ok(accepted, "A prediction gate must retain an actual accepted calculation.");
      await edit(lab === "lq-03" ? '[name="nu1"]' : '[id$="-ratio"]', "0");
      await submit();
      expect(owner?.getSnapshot().accepted).toBe(accepted);
      const refusal = required("[data-apply-failure]");
      expect(refusal.closest(AWAITING)).toBeNull();
      expect(refusal.getAttribute("data-refusal-code")).toBe("invalid-parameter");
      expect(required("[data-predict-gate]").getAttribute("data-predict-gate")).toBe("awaiting");
    });

    test(`${lab}: revealing and revisiting preserve the original prediction`, async () => {
      await mount(lab);
      const prompt = firstPrompt(lab);
      const unsupported = prompt.candidates.find(
        (entry) => entry.id !== prompt.supportedCandidateId,
      );
      assert.ok(unsupported, "The comparison needs an unsupported authored candidate.");
      const accepted = owner?.getSnapshot().accepted;
      await choose(prompt, unsupported.id);
      expect(required("[data-predict-gate]").getAttribute("data-predict-gate")).toBe("open");
      expect(required(".lab-results").getAttribute("data-predict-response")).toBe("shown");
      expect(panel(prompt).querySelector('[data-predict-adjudication="not-close"]')).not.toBeNull();
      expect(panel(prompt).querySelector("[data-predict-explanation]")).not.toBeNull();
      expect(required("[data-predict-original]", panel(prompt)).textContent).toContain(
        unsupported.label,
      );
      expect(original(lab, prompt)).toEqual({
        status: "predicted",
        prediction: { form: "candidate", candidateId: unsupported.id },
      });
      expect(required('[data-testid="predictions-toggle"]')).not.toBeNull();
      expect(owner?.getSnapshot().accepted).toBe(accepted);

      await choose(prompt, prompt.supportedCandidateId);
      expect(panel(prompt).querySelector("[data-predict-after-the-fact]")).not.toBeNull();
      expect(required("[data-predict-original]", panel(prompt)).textContent).toContain(
        unsupported.label,
      );
      expect(original(lab, prompt)?.prediction).toEqual({
        form: "candidate",
        candidateId: unsupported.id,
      });

      await act(async () => root?.unmount());
      root = null;
      await mount(lab);
      expect(required("[data-predict-gate]").getAttribute("data-predict-gate")).toBe("open");
      expect(required("[data-predict-original]", panel(prompt)).textContent).toContain(
        unsupported.label,
      );
    });

    for (const [action, status] of [
      ["Skip prediction", "skipped"],
      ["I have one in mind", "predicted-unrecorded"],
    ] as const) {
      test(`${lab}: ${action} reveals without inventing or sharing a recorded answer`, async () => {
        await mount(lab);
        const prompt = firstPrompt(lab);
        await click(action, panel(prompt));
        expect(required("[data-predict-gate]").getAttribute("data-predict-gate")).toBe("open");
        expect(required(".lab-results").getAttribute("data-predict-response")).toBe("shown");
        expect(original(lab, prompt)).toEqual({ status });
        expect(container.querySelector("[data-predict-original]")).toBeNull();
        expect(container.querySelector('[data-testid="predictions-toggle"]')).toBeNull();
        expect(panel(prompt).querySelector("[data-predict-explanation]")).not.toBeNull();
      });
    }

    test(`${lab}: shared settings and predictions preserve the private original`, async () => {
      const prompt = firstPrompt(lab);
      const privateCandidate = prompt.candidates.find(
        (entry) => entry.id !== prompt.supportedCandidateId,
      );
      assert.ok(privateCandidate, "The private original must differ from the shared choice.");
      const privateChoice = { form: "candidate" as const, candidateId: privateCandidate.id };
      LOCAL_PREDICT_PERSISTENCE.record(lab, prompt.promptId, privateChoice);
      const settings =
        lab === "lq-03"
          ? {
              ...LQ03_DEFAULTS,
              T: 6000,
              coordinate: "wavelength" as const,
              convention: "per-m" as const,
            }
          : { ...LQ04_DEFAULTS, referenceTemperature: 2500, volumeRatio: 0.5 };
      const tape = tapeForSettings(lab === "lq-03" ? LQ03_TAPE : LQ04_TAPE, settings);
      assert.ok(tape, "The real owner must accept the shared settings.");
      const shared = {
        ...tape,
        predictions: [
          predictionForLink(prompt.promptId, {
            form: "candidate",
            candidateId: prompt.supportedCandidateId,
          }),
        ],
      };
      window.history.replaceState(
        {},
        "",
        `/lab/${lab}/?tape=${encodeTapePermalink(shared, { includePredictions: true })}`,
      );
      await mount(lab, true);
      await waitForAcceptedSettings(settings);
      const supported = prompt.candidates.find((entry) => entry.id === prompt.supportedCandidateId);
      assert.ok(supported, "The shared candidate must be authored.");
      await waitForImportedPrediction(prompt, supported.label);
      expect(panel(prompt).getAttribute("data-predict-state")).toBe("revealed");
      expect(required("[data-predict-original]", panel(prompt)).textContent).toContain(
        supported.label,
      );
      expect(required('[data-testid="predictions-toggle"]')).not.toBeNull();
      expect(original(lab, prompt)).toEqual({ status: "predicted", prediction: privateChoice });
      if (lab === "lq-03") {
        expect(required<HTMLSelectElement>('[name="coordinate"]').value).toBe("wavelength");
        expect(required<HTMLSelectElement>('[name="convention"]').value).toBe("per-m");
      } else {
        expect(required<HTMLInputElement>('[id$="-ratio"]').value).toBe("0.5");
        expect(required<HTMLInputElement>('[id$="-t0"]').value).toBe("2500");
      }
      await submit();
      expect(owner?.getSnapshot().accepted?.parameters).toEqual(settings);
    });

    test(`${lab}: server markup retains the worked results for the no-script fallback`, () => {
      container.innerHTML = renderToStaticMarkup(laboratory(lab));
      expect(required(".lab-results").querySelectorAll("table").length).toBeGreaterThan(0);
      expect(required(".lab-results").getAttribute("data-predict-response")).toBe("awaiting");
      expect(required(".lab-results").hasAttribute("hidden")).toBe(false);
      const caption = required(".laboratory > p[data-detail='0']");
      expect(caption.textContent?.trim().length).toBeGreaterThan(0);
      expect(required("noscript").textContent).toContain("complete worked example");
    });
  }

  test("LQ-04 keeps its physical refusal visible until the reader repairs it", async () => {
    await mount("lq-04");
    const outside = evaluateLq04({ ...LQ04_DEFAULTS, volumeRatio: 1e-4 });
    assert.ok(outside.status === "outside-domain", "The actual owner must refuse the dense state.");
    await edit('[id$="-ratio"]', "0.0001");
    await submit();
    const refusal = required("[data-scientific-refusal]");
    expect(refusal.textContent).toContain(outside.reason);
    expect(refusal.closest(AWAITING)).toBeNull();
    expect(required("[data-predict-gate]").getAttribute("data-predict-gate")).toBe("awaiting");
    expect(container.querySelector("[data-apply-failure]")).toBeNull();
    await click("Half");
    expect(container.querySelector("[data-scientific-refusal]")).toBeNull();
    expect(owner?.getSnapshot().accepted?.parameters.volumeRatio).toBe(0.5);
    expect(required("[data-predict-gate]").getAttribute("data-predict-gate")).toBe("awaiting");
  });
});
