import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IonizationLab } from "../components/lab/lq09/IonizationLab.tsx";
import { LQ09_DEFAULTS, type Lq09Parameters } from "../experiments/lq09/definition.ts";
import { LQ09_TAPE } from "../experiments/lq09/tape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { tapeForSettings } from "../experiments/permalink/sessionTape.ts";
import { predictionForLink } from "../experiments/predict/authoredChoice.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../experiments/predict/localPredictPersistence.ts";
import { writeGlobalPredictEntry } from "../experiments/predict/predictEntry.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../experiments/predict/predictPersistence.ts";
import { getStoredPrompt, readPredictionsDocument } from "../experiments/predict/predictStorage.ts";
import example from "../generated/lq09-example.json";
import { PREDICT_PROMPTS } from "../generated/predict-prompts.ts";
import { createStorageContext } from "../platform/storage/store.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

const SETTINGS: Lq09Parameters = {
  ...LQ09_DEFAULTS,
  frequency: 3.5e15,
  incidentPower: 2e-6,
  absorptionMode: "declared-fraction",
  declaredFraction: 0.3,
};
let container: HTMLElement;
let root: Root | null = null;

beforeEach(async () => {
  await installDom();
  container = createContainer();
  history.replaceState({}, "", "/lab/lq-09/");
  installPredictPersistence(LOCAL_PREDICT_PERSISTENCE);
  writeGlobalPredictEntry(createStorageContext(), "predict-first");
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  removeContainer(container);
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function required<T extends Element = HTMLElement>(selector: string, scope = container): T {
  const element = scope.querySelector<T>(selector);
  assert.ok(element, `The ionization laboratory must render ${selector}.`);
  return element;
}

async function mount(restoreFromLocation = true) {
  root = createRoot(container);
  await act(async () => {
    root?.render(<IonizationLab example={example} restoreFromLocation={restoreFromLocation} />);
  });
}

type Handlers = {
  onChange?: (event: unknown) => void;
  onBlur?: (event: unknown) => void;
};
function handlers(element: Element): Handlers {
  const key =
    Object.keys(element).find((name) => name.startsWith("__reactProps$")) ??
    Object.keys(field("frequency")).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The control must have a React renderer key.");
  const result = (element as unknown as Record<string, Handlers>)[key];
  assert.ok(result, "The renderer key must address the mounted control's real handlers.");
  return result;
}

function field(key: string): HTMLInputElement {
  return required(`input[type="text"][id$="-${key}"]`);
}

async function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const handler = handlers(control).onChange;
  assert.ok(handler, "The mounted control must accept changes.");
  await act(async () => {
    control.value = value;
    handler({ target: control, currentTarget: control });
  });
}

async function commit(key: string, value: string) {
  const input = field(key);
  await change(input, value);
  const blur = handlers(input).onBlur;
  assert.ok(blur, "The typed field must commit through its real blur handler.");
  await act(async () => blur({ target: input, currentTarget: input }));
}

async function click(label: string, scope = container) {
  const button = [...scope.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  assert.ok(button, `The laboratory must offer ${label}.`);
  await act(async () => button.click());
}

async function until(check: () => boolean, reason: string) {
  const deadline = Date.now() + 2000;
  while (!check()) {
    assert.ok(Date.now() < deadline, reason);
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

function tape() {
  const result = tapeForSettings(LQ09_TAPE, SETTINGS);
  assert.ok(result, "The real ionization owner must accept the recorded settings.");
  return result;
}

function share() {
  const url = container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value;
  if (!url) return null;
  const decoded = decodeTapePermalink(new URL(url));
  assert.equal(decoded.kind, "success");
  return decoded.tape;
}

function readout(quantity: string) {
  return required(`[data-quantity-id="${quantity}"] td`).textContent;
}

describe("ionization recording continuity", () => {
  test("a verified shared prediction can be compared and excluded without changing the private original", async () => {
    const prompt = PREDICT_PROMPTS["lq-09"]?.[0];
    assert.ok(prompt, "LQ09 must have its authored prediction prompt.");
    const privateCandidate = prompt.candidates.find(
      (candidate) => candidate.id !== prompt.supportedCandidateId,
    );
    const supported = prompt.candidates.find(
      (candidate) => candidate.id === prompt.supportedCandidateId,
    );
    assert.ok(privateCandidate && supported);
    const privateChoice = { form: "candidate" as const, candidateId: privateCandidate.id };
    LOCAL_PREDICT_PERSISTENCE.record("lq-09", prompt.promptId, privateChoice);
    const prediction = predictionForLink(prompt.promptId, {
      form: "candidate",
      candidateId: supported.id,
    });
    const encoded = encodeTapePermalink(
      { ...tape(), predictions: [prediction] },
      { includePredictions: true },
    );
    history.replaceState({}, "", `/lab/lq-09/?tape=${encoded}`);
    await mount();
    await until(() => {
      const restored = share()?.predictions?.[0];
      return (
        restored?.form === "candidate" &&
        "candidateId" in restored.payload &&
        restored.payload.candidateId === supported.id
      );
    }, "A verified imported prediction must reach the laboratory's optional share control.");
    expect(field("frequency").value).toBe("3500");
    expect(field("incidentPower").value).toBe("2");
    expect(field("declaredFraction").value).toBe("0.3");
    expect(required<HTMLSelectElement>('select[id$="-mode"]').value).toBe("declared-fraction");
    expect(required("[data-predict-original]").textContent).toContain(supported.label);
    expect(share()?.initialConditions).toEqual(SETTINGS);
    const option = required<HTMLInputElement>('[data-testid="predictions-toggle"]');
    const toggle = handlers(option).onChange;
    assert.ok(toggle, "The reader must be able to keep a prediction out of the link.");
    await act(async () => toggle({ target: { checked: false } }));
    await until(
      () => share() !== null && share()?.predictions === undefined,
      "Excluding predictions must produce a new link without the recorded choice.",
    );
    expect(
      getStoredPrompt(readPredictionsDocument(createStorageContext()), "lq-09", prompt.promptId),
    ).toEqual({ status: "predicted", prediction: privateChoice });
    expect(readout("frequency")).toBe("3500.00 THz");
  });

  for (const bad of ["", "0"]) {
    test(`restoring a saved stop clears ${JSON.stringify(bad)} without recording the bad draft`, async () => {
      await mount();
      const recorder = required('[data-experiment-recorder="lq-09"]');
      await change(field("frequency"), "1900");
      await click("Save starting point", recorder);
      expect(readout("frequency")).toBe("2901.59 THz");
      await commit("frequency", "3500");
      await click("Save current accepted settings", recorder);
      expect(readout("frequency")).toBe("3500.00 THz");
      await commit("frequency", bad);
      expect(field("frequency").value).toBe(bad);
      expect(required('.lab-columns [role="alert"]').textContent).toContain("last accepted");
      if (bad === "0") {
        expect(required("[data-apply-failure]").getAttribute("data-refusal-code")).toBe(
          "outside-model-domain",
        );
      } else {
        expect(container.querySelector("[data-apply-failure]")).toBeNull();
      }
      await until(
        () => share()?.initialConditions.frequency === 3.5e15,
        "The accepted frequency must remain shareable after a refused or incomplete draft.",
      );
      await change(required<HTMLSelectElement>("[data-experiment-recorder] select"), "0");
      expect(field("frequency").value).toBe(bad);
      await click("Restore saved stop", recorder);
      expect(field("frequency").value).toBe("2901.59");
      expect(readout("frequency")).toBe("2901.59 THz");
      expect(container.querySelector('.lab-columns [role="alert"]')).toBeNull();
      expect(container.querySelector('[data-currency-state="refused"]')).toBeNull();
      await click("Restore next saved stop", recorder);
      expect(field("frequency").value).toBe("3500");
      expect(readout("frequency")).toBe("3500.00 THz");
      expect(recorder.textContent).toContain("2 of 64 saved stops");
    });
  }

  test("a corrupt checkpoint cannot import a prediction or replace the prepared result", async () => {
    const prompt = PREDICT_PROMPTS["lq-09"]?.[0];
    assert.ok(prompt);
    const valid = tape();
    const corrupt = {
      ...valid,
      acceptedCheckpoint: { ...valid.acceptedCheckpoint, digest: "host:0000000000000000" },
      predictions: [
        predictionForLink(prompt.promptId, {
          form: "candidate",
          candidateId: prompt.supportedCandidateId,
        }),
      ],
    };
    const encoded = encodeTapePermalink(corrupt, { includePredictions: true });
    history.replaceState({}, "", `/lab/lq-09/?tape=${encoded}`);
    await mount();
    await until(
      () => container.querySelector("[data-tape-notice]") !== null,
      "The failed checkpoint verification must be explained.",
    );
    expect(field("frequency").value).toBe("2901.59");
    expect(readout("frequency")).toBe("2901.59 THz");
    expect(required("[data-predict-gate]").getAttribute("data-predict-gate")).toBe("awaiting");
    expect(container.querySelector("[data-predict-original]")).toBeNull();
    expect(required("[data-tape-notice]").closest('[data-predict-response="awaiting"]')).toBeNull();
  });

  test("an inline laboratory records its own unresolved count and shares the standalone lab", async () => {
    history.replaceState({}, "", `/papers/light-quanta/?tape=${encodeTapePermalink(tape())}`);
    await mount(false);
    expect(field("frequency").value).toBe("2901.59");
    const recorder = required('[data-experiment-recorder="lq-09"]');
    const mode = required<HTMLSelectElement>('select[id$="-mode"]');
    await change(mode, "unknown");
    expect(readout("ionizationRate")).toContain("Not fixed by these settings");
    await click("Save starting point", recorder);
    await change(mode, "all-absorbed-ionizes");
    expect(readout("ionizationRate")).not.toContain("Not fixed by these settings");
    await click("Restore saved stop", recorder);
    expect(mode.value).toBe("unknown");
    expect(readout("ionizationRate")).toContain("Not fixed by these settings");
    await until(
      () => share()?.initialConditions.absorptionMode === "unknown",
      "The inline lab must share the actual accepted unresolved-count model.",
    );
    expect(
      new URL(required<HTMLInputElement>('[data-testid="selectable-url"]').value).pathname,
    ).toBe("/lab/lq-09/");
  });
});
