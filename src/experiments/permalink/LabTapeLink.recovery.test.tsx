import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, type ReactNode, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { BM01_DRAFT_TAPE } from "../bm01/draftTape.ts";
import { BM04_DRAFT_TAPE } from "../bm04/draftTape.ts";
import { createMe03Session } from "../me03/session.ts";
import { ME03_TAPE } from "../me03/tape.ts";
import { encodeTapePermalink } from "./codec.ts";
import { draftTapeForSettings, loadDraftTapeAsCurrentSettings } from "./draftTape.ts";
import {
  LabTapeLink,
  type LabTapeLinkState,
  useDraftTapeLink,
  useLabTapeLink,
} from "./LabTapeLink.tsx";
import {
  calculateTapeAsNewRun,
  restoreTape,
  type TapeSession,
  tapeForSettings,
  tapeStateDigestV2,
  tapeStateOf,
} from "./sessionTape.ts";
import type { TapePredictionEvent, TapeV2 } from "./types.ts";

let root: Root | null = null;
beforeEach(async () => installDom());
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await uninstallDom();
});

function legacy(tape: TapeV2, changed = false): TapeV2 {
  return {
    ...tape,
    modelIdentity: {
      modelId: tape.modelIdentity.modelId,
      modelVersion: tape.modelIdentity.modelVersion,
      ...(changed ? { artifactDigest: `host:sha256:${"0".repeat(64)}` } : {}),
    },
  };
}

function checkpoint(): TapeV2 {
  const initial = tapeForSettings(ME03_TAPE, ME03_TAPE.defaults);
  const selected = tapeStateOf({ ...ME03_TAPE.defaults, boundary: "radiation" });
  if (!initial || !selected) throw new Error("The real boundary laboratory rejected the fixture.");
  return {
    ...initial,
    events: [
      {
        actionIndex: 1,
        commandClass: "measurement-change",
        paramId: "boundary",
        value: "radiation",
      },
      { actionIndex: 2, commandClass: "presentation-change", paramId: "notation", value: "modern" },
    ],
    acceptedCheckpoint: {
      acceptedActionIndex: 1,
      acceptedInputRevision: 1,
      digest: tapeStateDigestV2(selected, 1),
    },
  };
}

async function clickRecovery(label: string) {
  const button = document.querySelector<HTMLButtonElement>("[data-tape-recovery] button");
  expect(button?.textContent).toBe(label);
  await act(async () => button?.click());
}

async function mount(element: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(element));
}

describe("an incompatible shared link requires a reader's explicit new calculation", () => {
  for (const changed of [false, true]) {
    test(`${changed ? "changed" : "missing"} source identity preserves the accepted run until the button is pressed`, async () => {
      const owner = createMe03Session(`shared-source-recovery-${changed}`);
      const recorded = legacy(
        {
          ...checkpoint(),
          predictions: [
            { promptId: "boundary-prediction", form: "candidate", payload: { candidateId: "old" } },
          ],
        },
        changed,
      );
      const originalRecord = JSON.stringify(recorded);
      const before = owner.getSnapshot();
      const restored: object[] = [];
      const restoredPredictions: (readonly TapePredictionEvent[] | undefined)[] = [];
      let current: LabTapeLinkState | null = null;
      function Probe() {
        const view = useSyncExternalStore(
          owner.subscribe,
          owner.getSnapshot,
          owner.getServerSnapshot,
        );
        current = useLabTapeLink(
          ME03_TAPE,
          owner,
          view.accepted?.parameters,
          true,
          (parameters, predictions) => {
            restored.push(parameters);
            restoredPredictions.push(predictions);
          },
        );
        return <LabTapeLink link={{ ...current, walkthrough: undefined }} />;
      }
      window.history.replaceState({}, "", `/lab/me-03/?tape=${encodeTapePermalink(recorded)}`);
      await mount(<Probe />);
      expect(owner.getSnapshot()).toBe(before);
      expect(restored).toEqual([]);
      expect(restoredPredictions).toEqual([]);
      expect(document.querySelector("[data-tape-notice]")?.textContent).toContain(
        "Recorded artifact:",
      );
      expect(document.querySelector("[data-tape-recovery]")?.textContent).toContain(
        "original record keeps its identity",
      );
      await clickRecovery("Calculate this checkpoint as a new run");
      expect(owner.getSnapshot().accepted?.runId).not.toBe(before.accepted?.runId);
      expect(owner.getSnapshot().accepted?.parentRunId).toBe(before.accepted?.runId);
      expect(owner.acceptedParameters()).toEqual({ ...ME03_TAPE.defaults, boundary: "radiation" });
      expect(restored).toEqual([{ ...ME03_TAPE.defaults, boundary: "radiation" }]);
      expect(restoredPredictions).toEqual([undefined]);
      // The later retained notation change is not the checkpoint the reader selected.
      expect(owner.acceptedParameters().notation).toBe(ME03_TAPE.defaults.notation);
      expect(document.querySelector("[data-tape-recovery]")).toBeNull();
      expect(document.querySelector("[data-tape-loaded]")?.textContent).toContain(
        "recorded result has not been verified",
      );
      const link = current as LabTapeLinkState | null;
      expect(link?.shareTape?.modelIdentity.artifactDigest).toBe(
        ME03_TAPE.environment.artifactDigest,
      );
      expect(link?.shareTape?.acceptedCheckpoint.acceptedActionIndex).toBe(0);
      expect(JSON.stringify(recorded)).toBe(originalRecord);
      expect(new URL(window.location.href).searchParams.get("tape")).toBe(
        encodeTapePermalink(recorded),
      );
    });
  }

  test("an owner that cannot create a new run keeps its accepted snapshot after the explicit request", async () => {
    const real = createMe03Session("shared-source-recovery-unsupported");
    const owner: TapeSession = {
      apply: real.apply,
      acceptedParameters: real.acceptedParameters,
      getSnapshot: real.getSnapshot,
    };
    const before = real.getSnapshot();
    function Probe() {
      const link = useLabTapeLink(ME03_TAPE, owner, before.accepted?.parameters);
      return <LabTapeLink link={{ ...link, walkthrough: undefined }} />;
    }
    window.history.replaceState(
      {},
      "",
      `/lab/me-03/?tape=${encodeTapePermalink(legacy(checkpoint()))}`,
    );
    await mount(<Probe />);
    await clickRecovery("Calculate this checkpoint as a new run");
    expect(real.getSnapshot()).toBe(before);
    expect(document.querySelector("[data-tape-notice]")?.textContent).toContain(
      "cannot begin an explicitly new identified run",
    );
    expect(document.querySelector("[data-tape-loaded]")).toBeNull();
  });

  test("explicit recovery validates the selected endpoint and controls before changing a live run", () => {
    const owner = createMe03Session("shared-source-recovery-invalid");
    const before = owner.getSnapshot();
    const base = legacy(checkpoint());
    for (const tape of [
      { ...base, acceptedCheckpoint: { ...base.acceptedCheckpoint, acceptedActionIndex: 5 } },
      {
        ...base,
        events: [
          {
            actionIndex: 1,
            commandClass: "setup-change" as const,
            paramId: "emittedEnergy",
            value: -1,
          },
        ],
      },
    ]) {
      const refused = restoreTape(ME03_TAPE, owner, tape);
      expect(refused.kind).toBe("not-restored");
      if (refused.kind !== "not-restored" || !refused.newRun)
        throw new Error("Expected an explicit recovery offer.");
      expect(calculateTapeAsNewRun(ME03_TAPE, owner, refused.newRun).kind).toBe("not-restored");
      expect(owner.getSnapshot()).toBe(before);
    }
  });
});

describe("worker links can explicitly reuse settings without starting a calculation", () => {
  test("an unversioned link leaves the form alone until the reader copies its settings", async () => {
    const settings = { ...BM04_DRAFT_TAPE.defaults, F: Number(BM04_DRAFT_TAPE.defaults.F) * 2 };
    const current = draftTapeForSettings(BM04_DRAFT_TAPE, settings);
    if (!current) throw new Error("The real drift laboratory rejected the fixture.");
    const recorded = legacy(current);
    const originalRecord = JSON.stringify(recorded);
    const loads: object[] = [];
    function Probe() {
      const link = useDraftTapeLink(BM04_DRAFT_TAPE, BM04_DRAFT_TAPE.defaults, true, (loaded) => {
        loads.push(loaded);
      });
      return <LabTapeLink link={{ ...link, walkthrough: undefined }} />;
    }
    window.history.replaceState({}, "", `/lab/bm-04/?tape=${encodeTapePermalink(recorded)}`);
    await mount(<Probe />);
    expect(loads).toEqual([]);
    await clickRecovery("Copy these settings for a new calculation");
    expect(loads).toEqual([settings]);
    expect(document.querySelector("[data-tape-recovery]")).toBeNull();
    expect(document.querySelector("[data-tape-loaded]")?.textContent).toContain(
      "Apply them to calculate with the current model",
    );
    expect(JSON.stringify(recorded)).toBe(originalRecord);
    expect(recorded.modelIdentity.artifactDigest).toBeUndefined();
  });

  test("explicit settings reuse still refuses damaged, invalid, foreign, and unresolved records", () => {
    const current = draftTapeForSettings(BM04_DRAFT_TAPE, BM04_DRAFT_TAPE.defaults);
    if (!current) throw new Error("The real drift laboratory rejected its defaults.");
    const recorded = legacy(current);
    const invalid = { ...recorded.initialConditions, T: -1 };
    for (const tape of [
      { ...recorded, initialConditions: { ...recorded.initialConditions, T: 500 } },
      { ...recorded, experimentId: "bm-05" },
      { ...recorded, teachingTapeRef: { tapeId: "missing-walkthrough", stepIndex: 0 } },
      {
        ...recorded,
        initialConditions: invalid,
        acceptedCheckpoint: {
          ...recorded.acceptedCheckpoint,
          digest: tapeStateDigestV2(invalid, 0),
        },
      },
    ]) {
      expect(loadDraftTapeAsCurrentSettings(BM04_DRAFT_TAPE, tape).kind).toBe("not-restored");
    }
    const seeded = draftTapeForSettings(BM01_DRAFT_TAPE, BM01_DRAFT_TAPE.defaults);
    if (!seeded) throw new Error("The real tracer laboratory rejected its defaults.");
    const wrongSeed = seeded.seed === "9" ? "10" : "9";
    expect(
      loadDraftTapeAsCurrentSettings(BM01_DRAFT_TAPE, {
        ...legacy(seeded),
        seed: wrongSeed as TapeV2["seed"],
      }).kind,
    ).toBe("not-restored");
  });
});
