import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ConfigurationComparison,
  ConfigurationLab,
} from "../../components/lab/bm03/ConfigurationLab.tsx";
import { BM03_DEFAULTS } from "../../experiments/bm03/definition.ts";
import { encodeBm03Settings } from "../../experiments/bm03/permalink.ts";
import { BM03_TAPE } from "../../experiments/bm03/tape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../../experiments/permalink/codec.ts";
import { tapeForSettings } from "../../experiments/permalink/sessionTape.ts";
import type { TapeV2 } from "../../experiments/permalink/types.ts";
import { predictionForLink } from "../../experiments/predict/authoredChoice.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../../experiments/predict/localPredictPersistence.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import {
  getStoredPrompt,
  readPredictionsDocument,
} from "../../experiments/predict/predictStorage.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

let container: HTMLElement;
let root: Root | null = null;

beforeEach(async () => {
  await installDom();
  container = createContainer();
  history.replaceState({}, "", "/lab/bm-03/");
  installPredictPersistence(LOCAL_PREDICT_PERSISTENCE);
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
  assert.ok(element, `The laboratory must render ${selector}.`);
  return element;
}

async function mount(comparison = false) {
  root = createRoot(container);
  await act(async () => {
    root?.render(comparison ? <ConfigurationComparison /> : <ConfigurationLab />);
  });
}

type Handlers = { onChange?: (event: unknown) => void; onSubmit?: (event: unknown) => void };
function handlers(element: Element): Handlers {
  // Happy DOM hides React's key on form/select proxies; an ordinary input reveals the same key.
  const key =
    Object.keys(element).find((name) => name.startsWith("__reactProps$")) ??
    Object.keys(required('input[name="Np"]')).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The mounted control must have a React renderer key.");
  const result = (element as unknown as Record<string, Handlers>)[key];
  assert.ok(result, "The renderer key must address the mounted control's handlers.");
  return result;
}

async function edit(selector: string, value: string) {
  const input = required<HTMLInputElement | HTMLSelectElement>(selector);
  const change = handlers(input).onChange;
  assert.ok(change, "The mounted setting must accept changes.");
  await act(async () => {
    input.value = value;
    change({ target: input, currentTarget: input });
  });
}

async function submit() {
  const apply = handlers(required('form[aria-label="Configuration integral settings"]')).onSubmit;
  assert.ok(apply, "The laboratory must apply settings through its mounted form.");
  await act(async () => apply({ preventDefault() {} }));
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
    // Browser compression and URL restoration are asynchronous; check after React commits.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

function recording(parameters = { ...BM03_DEFAULTS, Np: 3, volumeRatio: 3 }): TapeV2 {
  const tape = tapeForSettings(BM03_TAPE, parameters);
  assert.ok(tape, "The real configuration owner must accept the recording.");
  return tape;
}

function decodedShare(scope = container): TapeV2 | null {
  const url = scope.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value;
  if (!url) return null;
  const decoded = decodeTapePermalink(new URL(url));
  assert.equal(decoded.kind, "success");
  return decoded.tape;
}

describe("configuration laboratory recording and sharing", () => {
  test("verified links restore accepted controls and predictions without replacing private choices", async () => {
    const prompt = PREDICT_PROMPTS["bm-03"]?.[0];
    assert.ok(prompt, "BM03 must have its authored prediction prompt.");
    const privateCandidate = prompt.candidates.find(
      (candidate) => candidate.id !== prompt.supportedCandidateId,
    );
    const supported = prompt.candidates.find(
      (candidate) => candidate.id === prompt.supportedCandidateId,
    );
    assert.ok(privateCandidate && supported);
    const privateChoice = { form: "candidate" as const, candidateId: privateCandidate.id };
    LOCAL_PREDICT_PERSISTENCE.record("bm-03", prompt.promptId, privateChoice);
    const incoming = predictionForLink(prompt.promptId, {
      form: "candidate",
      candidateId: supported.id,
    });
    const tape = { ...recording(), predictions: [incoming] };
    history.replaceState(
      {},
      "",
      `/lab/bm-03/?tape=${encodeTapePermalink(tape, { includePredictions: true })}`,
    );
    await mount();
    await until(
      () => required<HTMLInputElement>('[name="Np"]').value === "3",
      "The verified shared calculation must update the typed fields.",
    );
    await until(
      () => decodedShare()?.predictions?.[0]?.promptId === prompt.promptId,
      "The share control must offer the imported prediction.",
    );
    expect(required<HTMLInputElement>('[name="volumeRatio"]').value).toBe("3");
    expect(required('[data-output="factorRatio"]').textContent).toBe("27");
    expect(required("[data-predict-original]").textContent).toContain(supported.label);
    expect(
      getStoredPrompt(readPredictionsDocument(createStorageContext()), "bm-03", prompt.promptId),
    ).toEqual({ status: "predicted", prediction: privateChoice });
    expect(decodedShare()?.predictions).toEqual([incoming]);
    expect(decodedShare()?.initialConditions.Np).toBe(3);
    await submit();
    expect(required('[data-output="factorRatio"]').textContent).toBe("27");
  });

  test("saved stops capture accepted settings and restore the form after drafts and refusals", async () => {
    await mount();
    const recorder = required('[data-experiment-recorder="bm-03"]');
    await edit('[name="Np"]', "5");
    await click("Save starting point", recorder);
    expect(required('[data-output="factorRatio"]').textContent).toBe("4");
    await submit();
    expect(required('[data-output="factorRatio"]').textContent).toBe("32");
    await click("Save current accepted settings", recorder);
    await edit('[name="Np"]', "0");
    await submit();
    expect(required('[data-output="factorRatio"]').textContent).toBe("32");
    expect(required("[data-apply-failure]").getAttribute("data-refusal-code")).toBe(
      "outside-model-domain",
    );
    await until(
      () => decodedShare()?.initialConditions.Np === 5,
      "The shared link must describe accepted settings, never the refused draft.",
    );
    await edit('[data-experiment-recorder="bm-03"] select', "0");
    expect(required<HTMLInputElement>('[name="Np"]').value).toBe("0");
    await click("Restore saved stop", recorder);
    expect(required('[data-recording-outcome="replayed"]')).not.toBeNull();
    expect(required<HTMLInputElement>('[name="Np"]').value).toBe("2");
    expect(required('[data-output="factorRatio"]').textContent).toBe("4");
    expect(container.querySelector("[data-apply-failure]")).toBeNull();
    expect(container.querySelector(".draft-note")).toBeNull();
    expect(recorder.textContent).toContain("2 of 64 saved stops");
    await click("Restore next saved stop", recorder);
    expect(required<HTMLInputElement>('[name="Np"]').value).toBe("5");
    expect(required('[data-output="factorRatio"]').textContent).toBe("32");
  });

  test("legacy settings links remain unapplied drafts until the reader chooses Apply", async () => {
    const legacy = encodeBm03Settings({ ...BM03_DEFAULTS, Np: 3, volumeRatio: 3 });
    history.replaceState({}, "", `/lab/bm-03/${legacy}`);
    await mount();
    expect(required<HTMLInputElement>('[name="Np"]').value).toBe("3");
    expect(required('[data-output="factorRatio"]').textContent).toBe("4");
    expect(required(".draft-note").textContent).toContain("Unapplied settings");
    await submit();
    expect(required('[data-output="factorRatio"]').textContent).toBe("27");
  });

  test("a corrupt shared checkpoint leaves the worked calculation and typed controls intact", async () => {
    const valid = recording();
    const corrupt = {
      ...valid,
      acceptedCheckpoint: { ...valid.acceptedCheckpoint, digest: "host:0000000000000000" },
    };
    history.replaceState({}, "", `/lab/bm-03/?tape=${encodeTapePermalink(corrupt)}`);
    await mount();
    await until(
      () => container.querySelector("[data-tape-notice]") !== null,
      "The laboratory must explain why the recorded checkpoint could not be verified.",
    );
    expect(required<HTMLInputElement>('[name="Np"]').value).toBe("2");
    expect(required('[data-output="factorRatio"]').textContent).toBe("4");
    expect(required("[data-instrument-id]").getAttribute("data-execution-label")).toBe("static");
    expect(required("[data-tape-notice]").closest('[data-predict-response="awaiting"]')).toBeNull();
  });

  test("opening the optional comparison does not replay the primary laboratory's shared tape", async () => {
    history.replaceState({}, "", `/lab/bm-03/?tape=${encodeTapePermalink(recording())}`);
    await mount(true);
    await until(
      () => required<HTMLInputElement>('[name="Np"]').value === "3",
      "The primary laboratory must restore its shared settings.",
    );
    await click("Open an independent second laboratory");
    const labs = [...container.querySelectorAll<HTMLElement>('[data-instrument-id="bm-03"]')];
    expect(labs.length).toBe(2);
    const primary = labs[0];
    const second = labs[1];
    assert.ok(primary && second);
    expect(required<HTMLInputElement>('[name="Np"]', primary).value).toBe("3");
    expect(required<HTMLInputElement>('[name="Np"]', second).value).toBe("2");
    const secondRecorder = required('[data-experiment-recorder="bm-03"]', second);
    expect(required('[data-experiment-recorder="bm-03"]', primary)).not.toBe(secondRecorder);
    await click("Save starting point", secondRecorder);
    await click("Locked cluster (counterexample)", second);
    expect(required('[data-output="factorRatio"]', primary).textContent).toBe("27");
    expect(required('[data-output="factorRatio"]', second).textContent).toBe("2");
    await until(
      () => decodedShare(second)?.initialConditions.model === "locked-cluster",
      "The second laboratory must be able to share its own independent accepted state.",
    );
    expect(decodedShare(primary)?.initialConditions.Np).toBe(3);
    expect(decodedShare(second)?.initialConditions.Np).toBe(2);
    expect(decodedShare(primary)?.initialConditions.model).toBe("independent");
    await click("Restore saved stop", secondRecorder);
    expect(required('[data-output="factorRatio"]', second).textContent).toBe("4");
    expect(required('[data-output="factorRatio"]', primary).textContent).toBe("27");
  });

  test("server markup keeps the complete worked calculation without active recorder controls", () => {
    container.innerHTML = renderToStaticMarkup(<ConfigurationLab />);
    expect(required('[data-output="factorRatio"]').textContent).toBe("4");
    expect(required("noscript").textContent).toContain("complete worked example");
    expect(container.querySelector("[data-experiment-recorder]")).toBeNull();
  });
});
