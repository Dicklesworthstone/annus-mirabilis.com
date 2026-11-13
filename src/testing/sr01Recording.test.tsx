import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ClockSyncLab } from "../components/lab/sr01/ClockSyncLab.tsx";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { tapeForSettings } from "../experiments/permalink/sessionTape.ts";
import { predictionForLink } from "../experiments/predict/authoredChoice.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../experiments/predict/localPredictPersistence.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../experiments/predict/predictPersistence.ts";
import { getStoredPrompt, readPredictionsDocument } from "../experiments/predict/predictStorage.ts";
import type { Sr01Parameters } from "../experiments/sr01/definition.ts";
import { encodeSr01Settings } from "../experiments/sr01/permalink.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../experiments/sr01/session.ts";
import { SR01_TAPE } from "../experiments/sr01/tape.ts";
import labDigests from "../generated/lab-source-digests.json";
import { PREDICT_PROMPTS } from "../generated/predict-prompts.ts";
import { createStorageContext } from "../platform/storage/store.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

const EXAMPLE = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["sr-01"] };
const SETTINGS: Sr01Parameters = {
  stationSeparationLs: 5,
  emissionTimeA: 20,
  clockOffsetB: 2,
  rodBeta: 0.4,
  pairBeta: -0.3,
  pairSeparationLs: 15,
  frameBeta: 0.25,
};
const FIELD_PREFIXES: Readonly<Record<keyof Sr01Parameters, string>> = {
  stationSeparationLs: "sep-",
  emissionTimeA: "emit-",
  clockOffsetB: "offb-",
  rodBeta: "rodv-",
  pairBeta: "pairv-",
  pairSeparationLs: "pairl-",
  frameBeta: "frame-",
};

let container: HTMLElement;
let root: Root | null = null;

beforeEach(async () => {
  await installDom();
  container = createContainer();
  history.replaceState({}, "", "/lab/sr-01/");
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
  assert.ok(element, `The mounted clock laboratory must render ${selector}.`);
  return element;
}

async function mount(restoreFromLocation = true) {
  root = createRoot(container);
  await act(async () => {
    root?.render(<ClockSyncLab example={EXAMPLE} restoreFromLocation={restoreFromLocation} />);
  });
}

type Handlers = { onChange?: (event: unknown) => void; onSubmit?: (event: unknown) => void };
function handlers(element: Element): Handlers {
  // Happy DOM's form/select proxies conceal the key; a number input exposes the same renderer.
  const key =
    Object.keys(element).find((name) => name.startsWith("__reactProps$")) ??
    Object.keys(field("stationSeparationLs")).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The control must have a React renderer key.");
  const result = (element as unknown as Record<string, Handlers>)[key];
  assert.ok(result, "The renderer key must address the mounted control's handlers.");
  return result;
}

function field(name: keyof Sr01Parameters): HTMLInputElement {
  return required(`form input[id^="${FIELD_PREFIXES[name]}"]`);
}

async function editControl(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const change = handlers(control).onChange;
  assert.ok(change, "The mounted setting must accept changes.");
  await act(async () => {
    control.value = value;
    change({ target: control, currentTarget: control });
  });
}

async function submit() {
  const apply = handlers(required("form.lab-controls")).onSubmit;
  assert.ok(apply, "The mounted clock form must apply settings.");
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
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

function tape(parameters = SETTINGS) {
  const result = tapeForSettings(SR01_TAPE, parameters);
  assert.ok(result, "The real clock owner must accept the recorded settings.");
  return result;
}

function sharedTape() {
  const url = container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value;
  if (!url) return null;
  const decoded = decodeTapePermalink(new URL(url));
  assert.equal(decoded.kind, "success");
  return decoded.tape;
}

function readings() {
  return [...container.querySelectorAll(".derived-outputs dd")].map((entry) => entry.textContent);
}

function ledgerColumn(index: number) {
  return [...container.querySelectorAll(".event-ledger tbody tr")].map(
    (row) => row.querySelectorAll("td")[index]?.textContent,
  );
}

describe("clock synchronization recordings", () => {
  test("verified links synchronize all seven settings and retain the reader's private prediction", async () => {
    const prompt = PREDICT_PROMPTS["sr-01"]?.[0];
    assert.ok(prompt, "SR01 must offer its authored prediction.");
    const privateCandidate = prompt.candidates.find(
      (candidate) => candidate.id !== prompt.supportedCandidateId,
    );
    const supported = prompt.candidates.find(
      (candidate) => candidate.id === prompt.supportedCandidateId,
    );
    assert.ok(privateCandidate && supported);
    const privateChoice = { form: "candidate" as const, candidateId: privateCandidate.id };
    LOCAL_PREDICT_PERSISTENCE.record("sr-01", prompt.promptId, privateChoice);
    const incoming = predictionForLink(prompt.promptId, {
      form: "candidate",
      candidateId: supported.id,
    });
    const shared = { ...tape(), predictions: [incoming] };
    history.replaceState(
      {},
      "",
      `/lab/sr-01/?tape=${encodeTapePermalink(shared, { includePredictions: true })}`,
    );
    await mount();
    await until(
      () => field("stationSeparationLs").value === "5",
      "A verified restore must synchronize the form with the accepted ledger.",
    );
    await until(
      () => sharedTape()?.predictions?.[0]?.promptId === prompt.promptId,
      "The laboratory must offer its imported prediction in the share control.",
    );
    for (const name of Object.keys(FIELD_PREFIXES) as (keyof Sr01Parameters)[]) {
      expect(field(name).value).toBe(String(SETTINGS[name]));
    }
    expect(readings()[0]).toBe("25 s");
    expect(readings()[5]).toContain("not applicable");
    expect(required("[data-predict-original]").textContent).toContain(supported.label);
    expect(sharedTape()?.predictions).toEqual([incoming]);
    expect(
      getStoredPrompt(readPredictionsDocument(createStorageContext()), "sr-01", prompt.promptId),
    ).toEqual({ status: "predicted", prediction: privateChoice });
    await submit();
    expect(readings()[0]).toBe("25 s");
    expect(required(".event-ledger caption").textContent).toContain("0.25");
  });

  test("saved stops exclude drafts and refusals, then restore usable controls and accepted results", async () => {
    await mount();
    const recorder = required('[data-experiment-recorder="sr-01"]');
    await editControl(field("stationSeparationLs"), "20");
    await click("Save starting point", recorder);
    expect(readings()[0]).toBe("10 s");
    await submit();
    expect(readings()[0]).toBe("20 s");
    await click("Save current accepted settings", recorder);
    await editControl(field("pairBeta"), "1");
    await submit();
    expect(required('form [role="alert"]').getAttribute("data-refusal-code")).toBe(
      "superluminal-observer",
    );
    expect(readings()[0]).toBe("20 s");
    await until(
      () => sharedTape()?.initialConditions.stationSeparationLs === 20,
      "The share control must keep the accepted separation after a refused draft.",
    );
    expect(sharedTape()?.initialConditions.pairBeta).toBe(0.6);
    await editControl(required<HTMLSelectElement>("[data-experiment-recorder] select"), "0");
    expect(field("pairBeta").value).toBe("1");
    await click("Restore saved stop", recorder);
    expect(required('[data-recording-outcome="replayed"]')).not.toBeNull();
    expect(field("stationSeparationLs").value).toBe("10");
    expect(field("pairBeta").value).toBe("0.6");
    expect(readings()[0]).toBe("10 s");
    expect(container.querySelector('form [role="alert"]')).toBeNull();
    expect(container.querySelector('[data-currency-state="refused"]')).toBeNull();
    expect(recorder.textContent).toContain("2 of 64 saved stops");
    await click("Restore next saved stop", recorder);
    expect(field("stationSeparationLs").value).toBe("20");
    expect(readings()[0]).toBe("20 s");
  });

  test("recording and replaying frame changes preserves the physical run and clocks' own readings", async () => {
    await mount();
    const lab = required('[data-instrument-id="sr-01"]');
    const run = lab.getAttribute("data-run-id");
    assert.ok(run, "The comparison must start from an identified accepted run.");
    const ownReadings = ledgerColumn(3);
    const originalCoordinates = ledgerColumn(4);
    expect(ownReadings.length).toBeGreaterThan(0);
    const recorder = required('[data-experiment-recorder="sr-01"]');
    await click("Save starting point", recorder);
    await editControl(field("frameBeta"), "0.5");
    await submit();
    expect(lab.getAttribute("data-run-id")).toBe(run);
    expect(ledgerColumn(3)).toEqual(ownReadings);
    expect(ledgerColumn(4)).not.toEqual(originalCoordinates);
    const movingCoordinates = ledgerColumn(4);
    await click("Save current accepted settings", recorder);
    await editControl(required<HTMLSelectElement>("[data-experiment-recorder] select"), "0");
    await click("Restore saved stop", recorder);
    expect(field("frameBeta").value).toBe("0");
    expect(lab.getAttribute("data-run-id")).toBe(run);
    expect(ledgerColumn(3)).toEqual(ownReadings);
    expect(ledgerColumn(4)).toEqual(originalCoordinates);
    await click("Restore next saved stop", recorder);
    expect(field("frameBeta").value).toBe("0.5");
    expect(lab.getAttribute("data-run-id")).toBe(run);
    expect(ledgerColumn(3)).toEqual(ownReadings);
    expect(ledgerColumn(4)).toEqual(movingCoordinates);
  });

  test("legacy links still recalculate immediately and synchronize the event-ledger controls", async () => {
    history.replaceState({}, "", `/lab/sr-01/${encodeSr01Settings(SETTINGS)}`);
    await mount();
    expect(field("stationSeparationLs").value).toBe("5");
    expect(field("emissionTimeA").value).toBe("20");
    expect(field("frameBeta").value).toBe("0.25");
    expect(readings()[0]).toBe("25 s");
    expect(required("[data-shared-clock-settings]").textContent).toContain("recalculated");
  });

  test("an unverified checkpoint leaves the prepared result and controls untouched", async () => {
    const valid = tape();
    const corrupt = {
      ...valid,
      acceptedCheckpoint: { ...valid.acceptedCheckpoint, digest: "host:0000000000000000" },
    };
    history.replaceState({}, "", `/lab/sr-01/?tape=${encodeTapePermalink(corrupt)}`);
    await mount();
    await until(
      () => container.querySelector("[data-tape-notice]") !== null,
      "A refused shared checkpoint must leave an explanatory notice.",
    );
    expect(field("stationSeparationLs").value).toBe("10");
    expect(field("frameBeta").value).toBe("0");
    expect(readings()[0]).toBe("10 s");
    expect(required("[data-instrument-id]").getAttribute("data-execution-label")).toBe("static");
    expect(required("[data-tape-notice]").closest('[data-predict-response="awaiting"]')).toBeNull();
  });

  test("an inline clock laboratory keeps its own setup when the page carries a shared tape", async () => {
    history.replaceState(
      {},
      "",
      `/papers/special-relativity/s1/?tape=${encodeTapePermalink(tape())}`,
    );
    await mount(false);
    expect(field("stationSeparationLs").value).toBe("10");
    expect(field("frameBeta").value).toBe("0");
    expect(readings()[0]).toBe("10 s");
    const recorder = required('[data-experiment-recorder="sr-01"]');
    await until(
      () => sharedTape()?.initialConditions.stationSeparationLs === 10,
      "An inline laboratory must share its own accepted calculation.",
    );
    const url = required<HTMLInputElement>('[data-testid="selectable-url"]').value;
    expect(new URL(url).pathname).toBe("/lab/sr-01/");
    await click("Save starting point", recorder);
    await editControl(field("stationSeparationLs"), "12");
    await submit();
    expect(readings()[0]).toBe("12 s");
    await click("Restore saved stop", recorder);
    expect(field("stationSeparationLs").value).toBe("10");
    expect(readings()[0]).toBe("10 s");
  });

  test("the no-script rendering retains its worked ledger without active recorder controls", () => {
    container.innerHTML = renderToStaticMarkup(<ClockSyncLab example={EXAMPLE} />);
    expect(readings()[0]).toBe("10 s");
    expect(ledgerColumn(3).length).toBeGreaterThan(0);
    expect(required("noscript").textContent).toContain("complete worked example");
    expect(container.querySelector("[data-experiment-recorder]")).toBeNull();
  });
});
