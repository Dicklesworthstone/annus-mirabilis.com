import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { TwoLedgersLab } from "../components/lab/me01/TwoLedgersLab.tsx";
import { ME01_DEFAULTS, type Me01Parameters } from "../experiments/me01/definition.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../experiments/me01/session.ts";
import { ME01_TAPE } from "../experiments/me01/tape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { tapeForSettings } from "../experiments/permalink/sessionTape.ts";
import type { TapeV2 } from "../experiments/permalink/types.ts";
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
import labDigests from "../generated/lab-source-digests.json";
import { PREDICT_PROMPTS } from "../generated/predict-prompts.ts";
import { createStorageContext } from "../platform/storage/store.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

const EXAMPLE = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-01"] };
const SHARED: Me01Parameters = {
  ...ME01_DEFAULTS,
  frameSpeed: 0.4,
  emissionAngle: 60,
  emittedEnergyRestFrame: 2.5,
  notation: "modern",
  step: "sum-angle",
};

let container: HTMLElement;
let root: Root | null = null;
let retention: SessionRetention;
let owner: RetainedSession | undefined;
let initial: ReturnType<RetainedSession["getSnapshot"]> | undefined;

beforeEach(async () => {
  await installDom();
  window.history.replaceState({}, "", "/lab/me-01/");
  container = createContainer();
  owner = undefined;
  initial = undefined;
  const cache = createSessionRetention();
  // Observe the real retained owner; decoding, validation and replay remain the product's code.
  retention = {
    ...cache,
    prepare<T extends RetainedSession>(
      placementKey: string,
      identity: SessionRetentionIdentity,
      create: (instanceId: string) => T,
    ): PreparedRetainedSession<T> {
      const prepared = cache.prepare(placementKey, identity, create);
      owner = prepared.session;
      initial ??= owner.getSnapshot();
      return prepared;
    },
  };
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

async function mount(restoreFromLocation = true) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <RetainedSessionProvider
        cache={retention}
        placementKey="me01-tape-test"
        instanceId="me01-tape-test"
        previous={null}
        onReference={() => undefined}
      >
        <TwoLedgersLab
          example={EXAMPLE}
          instanceId="me01-tape-test"
          restoreFromLocation={restoreFromLocation}
        />
      </RetainedSessionProvider>,
    );
  });
}

function required<T extends Element = HTMLElement>(selector: string): T {
  const element = container.querySelector<T>(selector);
  assert.ok(element, `The real ME-01 laboratory must contain ${selector}.`);
  return element;
}

function snapshot() {
  assert.ok(owner, "The laboratory must have its real retained owner.");
  return owner.getSnapshot();
}

function field(key: "frameSpeed" | "emissionAngle" | "emittedEnergyRestFrame") {
  return required<HTMLInputElement>(`input[type="text"][id^="${key}-"]`);
}

type Handlers = {
  onChange?: (event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => void;
  onBlur?: (event: { target: HTMLInputElement }) => void;
};

function handlers(input: HTMLInputElement): Handlers {
  const key = Object.keys(input).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The mounted input must carry React's real handlers.");
  const value = (input as unknown as Record<string, Handlers>)[key];
  assert.ok(value);
  return value;
}

async function edit(value: string, commit = false) {
  const input = field("frameSpeed");
  const change = handlers(input).onChange;
  assert.ok(change);
  await act(async () => {
    input.value = value;
    change({ target: input, currentTarget: input });
  });
  if (commit) {
    const blur = handlers(input).onBlur;
    assert.ok(blur);
    await act(async () => blur({ target: input }));
  }
}

async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  assert.ok(button, `The laboratory must offer "${label}".`);
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
}

/** Browser compression and restoration can finish after React's initial mount. */
async function until(ready: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!ready()) {
    assert.ok(Date.now() < deadline, "The real ME-01 tape operation did not finish.");
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    });
  }
}

function sharedTape() {
  const decoded = decodeTapePermalink(
    container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value ?? "",
  );
  return decoded.kind === "success" ? decoded.tape : undefined;
}

function tape(parameters: Me01Parameters = SHARED): TapeV2 {
  const result = tapeForSettings(ME01_TAPE, parameters);
  assert.ok(result, "The real ME-01 owner must accept the fixture settings.");
  return result;
}

function visit(recorded: TapeV2) {
  window.history.replaceState(
    {},
    "",
    `/lab/me-01/?tape=${encodeTapePermalink(recorded, { includePredictions: true })}`,
  );
}

describe("ME-01 verified links and personal recordings", () => {
  test("a verified shared run restores controls and predictions without overwriting the private original", async () => {
    const prompt = PREDICT_PROMPTS["me-01"]?.[0];
    assert.ok(prompt);
    const privateCandidate = prompt.candidates.find(
      (candidate) => candidate.id !== prompt.supportedCandidateId,
    );
    const sharedCandidate = prompt.candidates.find(
      (candidate) => candidate.id === prompt.supportedCandidateId,
    );
    assert.ok(privateCandidate && sharedCandidate);
    const privateChoice = { form: "candidate" as const, candidateId: privateCandidate.id };
    LOCAL_PREDICT_PERSISTENCE.record("me-01", prompt.promptId, privateChoice);
    visit({
      ...tape(),
      predictions: [
        predictionForLink(prompt.promptId, {
          form: "candidate",
          candidateId: sharedCandidate.id,
        }),
      ],
    });
    await mount();
    await until(
      () =>
        snapshot().accepted?.parameters.frameSpeed === SHARED.frameSpeed &&
        container.querySelector("[data-predict-original]")?.textContent?.trim() ===
          `Recorded prediction: ${sharedCandidate.label}`,
    );
    expect(snapshot().accepted?.parameters).toEqual(SHARED);
    expect(field("frameSpeed").value).toBe("0.4");
    expect(field("emissionAngle").value).toBe("60");
    expect(field("emittedEnergyRestFrame").value).toBe("2.5");
    expect(required('[aria-current="step"]').textContent).toBe("3. The two pulses summed");
    expect(required('[data-testid="predictions-toggle"]')).not.toBeNull();
    expect(
      getStoredPrompt(readPredictionsDocument(createStorageContext()), "me-01", prompt.promptId),
    ).toEqual({ status: "predicted", prediction: privateChoice });
    expect(container.querySelector("[data-tape-notice]")).toBeNull();
    expect(container.textContent).not.toContain("Unknown setting: tape");
    await edit("0.4", true);
    expect(snapshot().accepted?.parameters).toEqual(SHARED);
  });

  test("a corrupt checkpoint keeps the exact accepted result and offers no unverifiable replay", async () => {
    const recorded = tape();
    visit({
      ...recorded,
      acceptedCheckpoint: { ...recorded.acceptedCheckpoint, digest: "host:0000000000000000" },
    });
    await mount();
    await until(() => container.querySelector("[data-tape-notice]") !== null);
    expect(snapshot()).toBe(initial);
    expect(field("frameSpeed").value).toBe(String(EXAMPLE.parameters.frameSpeed));
    expect(container.querySelector("[data-tape-recovery]")).toBeNull();
    expect(container.querySelector("[data-predict-original]")).toBeNull();
  });

  test("an incompatible model keeps the accepted result until an explicit new calculation", async () => {
    const recorded = tape();
    const prompt = PREDICT_PROMPTS["me-01"]?.[0];
    assert.ok(prompt);
    visit({
      ...recorded,
      modelIdentity: {
        ...recorded.modelIdentity,
        modelVersion: recorded.modelIdentity.modelVersion + 1,
      },
      predictions: [
        predictionForLink(prompt.promptId, {
          form: "candidate",
          candidateId: prompt.supportedCandidateId,
        }),
      ],
    });
    await mount();
    await until(() => container.querySelector("[data-tape-notice]") !== null);
    expect(snapshot()).toBe(initial);
    expect(field("frameSpeed").value).toBe(String(EXAMPLE.parameters.frameSpeed));
    expect(container.querySelector("[data-predict-original]")).toBeNull();
    await click("Calculate this checkpoint as a new run");
    expect(snapshot().accepted?.parameters).toEqual(SHARED);
    expect(field("frameSpeed").value).toBe("0.4");
    expect(required("[data-tape-loaded]").textContent).toContain("has not been verified");
    expect(container.querySelector("[data-predict-original]")).toBeNull();
    expect(container.querySelector('[data-testid="predictions-toggle"]')).toBeNull();
    expect(required("[data-predict-gate]").getAttribute("data-predict-gate")).toBe("awaiting");
  });

  test("legacy settings links stay drafts and the share link records only accepted settings", async () => {
    window.history.replaceState({}, "", "/lab/me-01/?v=0.25&phi=60&L=2");
    await mount();
    expect(field("frameSpeed").value).toBe("0.25");
    expect(snapshot()).toBe(initial);
    expect(snapshot().accepted?.parameters).toEqual(EXAMPLE.parameters);
    await until(() => sharedTape()?.initialConditions.frameSpeed === EXAMPLE.parameters.frameSpeed);
    await click("Calculate the linked settings");
    expect(snapshot().accepted?.parameters).toMatchObject({
      frameSpeed: 0.25,
      emissionAngle: 60,
      emittedEnergyRestFrame: 2,
    });
    await until(() => sharedTape()?.initialConditions.frameSpeed === 0.25);
    expect(sharedTape()?.initialConditions.emissionAngle).toBe(60);
    expect(sharedTape()?.initialConditions.emittedEnergyRestFrame).toBe(2);
    expect(container.textContent).not.toContain("The link's settings are in the fields");
  });

  test("an inline instance ignores the primary URL while recording and sharing its own accepted settings", async () => {
    window.history.replaceState({}, "", `/papers/mass-energy/?tape=${encodeTapePermalink(tape())}`);
    await mount(false);
    await until(() => sharedTape()?.initialConditions.frameSpeed === EXAMPLE.parameters.frameSpeed);
    expect(snapshot()).toBe(initial);
    expect(field("frameSpeed").value).toBe(String(EXAMPLE.parameters.frameSpeed));
    expect(container.querySelector("[data-tape-notice]")).toBeNull();
    expect(
      new URL(required<HTMLInputElement>('[data-testid="selectable-url"]').value).pathname,
    ).toBe("/lab/me-01/");
    await edit("0.25", true);
    await until(() => sharedTape()?.initialConditions.frameSpeed === 0.25);
    await click("Save starting point");
    await edit("0.75", true);
    await click("Restore saved stop");
    expect(snapshot().accepted?.parameters.frameSpeed).toBe(0.25);
    expect(field("frameSpeed").value).toBe("0.25");
  });

  test("saved stops exclude drafts and restore controls while clearing a later refused edit", async () => {
    await mount();
    const original = snapshot();
    await edit("0.35");
    expect(snapshot()).toBe(original);
    await until(() => sharedTape()?.initialConditions.frameSpeed === EXAMPLE.parameters.frameSpeed);
    await click("Save starting point");
    await edit("0.25", true);
    const second = snapshot();
    await edit("0.9");
    expect(snapshot()).toBe(second);
    await click("Save current accepted settings");
    expect(required('[data-experiment-recorder="me-01"]').textContent).toContain(
      "2 of 64 saved stops",
    );
    await click("Restore previous saved stop");
    expect(snapshot().accepted?.parameters).toEqual(EXAMPLE.parameters);
    expect(field("frameSpeed").value).toBe(String(EXAMPLE.parameters.frameSpeed));
    const restored = snapshot();
    await edit("1.2", true);
    expect(snapshot()).toBe(restored);
    expect(required('[data-instrument-id="me-01"]').hasAttribute("data-refusal-code")).toBe(true);
    expect(container.querySelector('[role="alert"][data-refusal-code]')).not.toBeNull();
    await click("Restore next saved stop");
    expect(snapshot().accepted?.parameters.frameSpeed).toBe(0.25);
    expect(field("frameSpeed").value).toBe("0.25");
    expect(required('[data-instrument-id="me-01"]').hasAttribute("data-refusal-code")).toBe(false);
    expect(container.querySelector('[role="alert"][data-refusal-code]')).toBeNull();
    expect(required('[data-recording-outcome="replayed"]')).not.toBeNull();
  });

  test("the existing two-pulses control keeps the current result when its historical artifact differs", async () => {
    await mount();
    await edit("1.2", true);
    const before = snapshot();
    expect(container.querySelector('[role="alert"][data-refusal-code]')).not.toBeNull();
    await click("Play the recorded walkthrough");
    expect(
      required('[data-walkthrough-result="refused"]').getAttribute("data-walkthrough-code"),
    ).toBe("tape-artifact-mismatch");
    expect(snapshot()).toBe(before);
    expect(field("frameSpeed").value).toBe("1.2");
    expect(container.querySelector('[role="alert"][data-refusal-code]')).not.toBeNull();
    expect(required('[data-instrument-id="me-01"]').hasAttribute("data-refusal-code")).toBe(true);
  });

  test("server markup keeps the complete worked example without transient recording controls", () => {
    container.innerHTML = renderToStaticMarkup(<TwoLedgersLab example={EXAMPLE} />);
    expect(
      required('table[data-view="table-two-ledgers"]').querySelectorAll("tbody tr").length,
    ).toBeGreaterThan(4);
    expect(required("noscript").textContent).toContain("complete worked example");
    expect(container.querySelector("[data-experiment-recorder]")).toBeNull();
    expect(container.querySelector('[data-testid="selectable-url"]')).toBeNull();
  });
});
