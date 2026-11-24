import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { TransformStream as NativeTransformStream } from "node:stream/web";
import { act, type ReactNode, useRef, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { OsmoticPartitionLab } from "../../components/lab/OsmoticPartitionLab.tsx";
import {
  bm08Laboratory,
  bm08ReplayFixture,
  recordBm08Checkpoints,
} from "../../testing/bm08ReplayHarness.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { BM01_DRAFT_TAPE } from "../bm01/draftTape.ts";
import { BM02_DRAFT_TAPE } from "../bm02/draftTape.ts";
import { createBm02Session } from "../bm02/owner.ts";
import { BM04_DRAFT_TAPE } from "../bm04/draftTape.ts";
import { createBm08WalkthroughTarget } from "../bm08/tape.ts";
import { createMe03Session } from "../me03/session.ts";
import { ME03_TAPE } from "../me03/tape.ts";
import { encodeTapePermalink } from "./codec.ts";
import { draftTapeForSettings, loadDraftTapeAsCurrentSettings } from "./draftTape.ts";
import {
  LabTapeLink,
  type LabTapeLinkState,
  useDraftTapeLink,
  useLabTapeLink,
  useWorkerTapeLink,
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

function draftDeferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function draftBounded(promise: Promise<void>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("The real tape decoder did not finish.")),
          5000,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/** Gate platform delivery only: the real compressed tape, decoder and validators still run. */
function holdDraftDecompression() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "DecompressionStream");
  assert(descriptor, "The browser decompression API must be available.");
  const NativeDecompressionStream = globalThis.DecompressionStream;
  const entered = draftDeferred();
  const released = draftDeferred();
  const finished = draftDeferred();
  class HeldDecompressionStream {
    readonly readable;
    readonly writable;
    constructor(format: CompressionFormat) {
      const native = new NativeDecompressionStream(format);
      this.writable = native.writable;
      this.readable = native.readable.pipeThrough(
        new NativeTransformStream<Uint8Array, Uint8Array>({
          async transform(chunk, controller) {
            entered.resolve();
            await released.promise;
            controller.enqueue(chunk);
          },
          flush() {
            finished.resolve();
          },
        }),
      );
    }
  }
  Object.defineProperty(globalThis, "DecompressionStream", {
    configurable: true,
    writable: true,
    value: HeldDecompressionStream,
  });
  return {
    entered: () => draftBounded(entered.promise),
    async finish() {
      await act(async () => {
        released.resolve();
        await draftBounded(finished.promise);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      });
    },
    restore() {
      released.resolve();
      Object.defineProperty(globalThis, "DecompressionStream", descriptor);
    },
  };
}

function draftSharedTape(): TapeV2 {
  const tape = draftTapeForSettings(BM02_DRAFT_TAPE, { ...BM02_DRAFT_TAPE.defaults, T: 321 });
  assert(tape, "The real osmotic laboratory must accept the shared settings.");
  return tape;
}

function draftAddress(tape = draftSharedTape()) {
  window.history.replaceState({}, "", `/lab/bm-02/?tape=${encodeTapePermalink(tape)}`);
}

function draftProbe(owner = createBm02Session("draft-link-draftProbe")) {
  const loads: object[] = [];
  let current: {
    draft: string;
    edit(value: string): void;
    link: LabTapeLinkState;
  } | null = null;
  function Probe({ enabled = true }: { enabled?: boolean }) {
    useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getServerSnapshot);
    const [draft, setDraft] = useState(String(owner.acceptedParameters().T));
    const draftRevision = useRef(0);
    const link = useDraftTapeLink(
      BM02_DRAFT_TAPE,
      { ...owner.acceptedParameters() },
      enabled,
      (settings) => {
        loads.push(settings);
        setDraft(String(settings.T));
      },
      undefined,
      {
        draftRevision,
        // Recreated callbacks, wrappers and equivalent snapshots must not cancel a valid load.
        session: {
          getSnapshot() {
            const view = owner.getSnapshot();
            return {
              ...view,
              requested: view.requested && {
                ...view.requested,
                revisions: { ...view.requested.revisions },
                parameters: { ...view.requested.parameters },
              },
              accepted: view.accepted && {
                ...view.accepted,
                revisions: { ...view.accepted.revisions },
                parameters: { ...view.accepted.parameters },
              },
            };
          },
        },
      },
    );
    current = {
      draft,
      edit(value) {
        draftRevision.current++;
        setDraft(value);
      },
      link,
    };
    return <p>{draft}</p>;
  }
  return {
    Probe,
    owner,
    loads,
    read() {
      assert(current, "The real hook must have mounted.");
      return current;
    },
  };
}

describe("incoming draft links preserve newer laboratory work", () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = createContainer();
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    removeContainer(container);
  });

  test("an unchanged form still loads once across equivalent fresh snapshots and rerenders", async () => {
    const p = draftProbe();
    const before = p.owner.getSnapshot();
    draftAddress();
    const held = holdDraftDecompression();
    try {
      root = createRoot(container);
      await act(async () => root?.render(<p.Probe />));
      await held.entered();
      await act(async () => root?.render(<p.Probe />));
      await held.finish();
      expect(p.loads).toHaveLength(1);
      expect(p.read().draft).toBe("321");
      expect(p.read().link.recovery).toBeUndefined();
      expect(p.owner.getSnapshot()).toBe(before);
    } finally {
      held.restore();
    }
  });

  for (const change of ["new draft", "away and back"] as const) {
    test(`${change} waits for explicit loading instead of replacing the reader's entries`, async () => {
      const p = draftProbe();
      const before = p.owner.getSnapshot();
      const initial = String(p.owner.acceptedParameters().T);
      draftAddress();
      const held = holdDraftDecompression();
      try {
        root = createRoot(container);
        await act(async () => root?.render(<p.Probe />));
        await held.entered();
        await act(async () => p.read().edit("310"));
        if (change === "away and back") await act(async () => p.read().edit(initial));
        const newer = p.read().draft;
        await held.finish();
        expect(p.loads).toEqual([]);
        expect(p.read().draft).toBe(newer);
        expect(p.owner.getSnapshot()).toBe(before);
        expect(p.read().link.shareTape?.initialConditions.T).toBe(Number(initial));
        expect(p.read().link.note).toContain("have been kept");
        const recovery = p.read().link.recovery;
        assert(recovery);
        expect(recovery.label).toBe("Load the shared settings");
        await act(async () => recovery.run());
        expect(p.loads).toHaveLength(1);
        expect(p.read().draft).toBe("321");
        expect(p.read().link.recovery).toBeUndefined();
        expect(p.owner.getSnapshot()).toBe(before);
      } finally {
        held.restore();
      }
    });
  }

  for (const change of ["changed accepted settings", "identical accepted settings"] as const) {
    test(`${change} supersedes an old load even without a form edit`, async () => {
      const p = draftProbe();
      draftAddress();
      const held = holdDraftDecompression();
      try {
        root = createRoot(container);
        await act(async () => root?.render(<p.Probe />));
        await held.entered();
        const before = p.owner.getSnapshot();
        await act(async () => {
          const settings = p.owner.acceptedParameters();
          expect(
            p.owner.apply(
              change === "changed accepted settings" ? { ...settings, T: 310 } : settings,
            ).kind,
          ).toBe("accepted");
        });
        const newer = p.owner.getSnapshot();
        expect(newer.accepted?.snapshotVersion).not.toBe(before.accepted?.snapshotVersion);
        const draft = p.read().draft;
        await held.finish();
        expect(p.loads).toEqual([]);
        expect(p.read().draft).toBe(draft);
        expect(p.owner.getSnapshot()).toBe(newer);
        expect(p.read().link.shareTape?.initialConditions.T).toBe(p.owner.acceptedParameters().T);
        expect(p.read().link.recovery?.label).toBe("Load the shared settings");
      } finally {
        held.restore();
      }
    });
  }

  for (const fault of ["incompatible model", "damaged settings"] as const) {
    test(`a stale ${fault} does not publish a recovery or error over newer work`, async () => {
      const p = draftProbe();
      const tape = draftSharedTape();
      draftAddress(
        fault === "incompatible model"
          ? { ...tape, modelIdentity: { ...tape.modelIdentity, modelVersion: 999 } }
          : { ...tape, initialConditions: { ...tape.initialConditions, T: 322 } },
      );
      const held = holdDraftDecompression();
      try {
        root = createRoot(container);
        await act(async () => root?.render(<p.Probe />));
        await held.entered();
        await act(async () => p.read().edit("310"));
        await held.finish();
        expect(p.loads).toEqual([]);
        expect(p.read().draft).toBe("310");
        expect(p.read().link.notice).toBe("");
        expect(p.read().link.recovery).toBeUndefined();
        expect(p.read().link.note).toContain("have been kept");
      } finally {
        held.restore();
      }
    });
  }

  for (const departure of ["disabled", "unmount"] as const) {
    test(`${departure} retires decoding without a late form update`, async () => {
      const p = draftProbe();
      const before = p.owner.getSnapshot();
      draftAddress();
      const held = holdDraftDecompression();
      try {
        root = createRoot(container);
        await act(async () => root?.render(<p.Probe />));
        await held.entered();
        if (departure === "disabled") {
          await act(async () => root?.render(<p.Probe enabled={false} />));
        } else {
          await act(async () => root?.unmount());
          root = null;
        }
        await held.finish();
        expect(p.loads).toEqual([]);
        expect(p.owner.getSnapshot()).toBe(before);
        expect(p.read().link.recovery).toBeUndefined();
      } finally {
        held.restore();
      }
    });
  }

  test("a checkpoint arriving after an edit waits for review and starts no worker", async () => {
    const fixture = await bm08ReplayFixture();
    const stops = await recordBm08Checkpoints(fixture);
    const recorded = stops.at(-1)?.tape;
    assert(recorded, "The real camera owner must produce a recorded checkpoint.");
    const original = JSON.stringify(recorded);
    const lab = bm08Laboratory(fixture);
    const before = lab.session.getSnapshot();
    const loaded: object[] = [];
    const restored: object[] = [];
    const draftRevision = { current: 0 };
    const target = createBm08WalkthroughTarget(lab.binding, lab.session, (settings) =>
      restored.push(settings),
    );
    let current: LabTapeLinkState | null = null;
    function link() {
      assert(current);
      return current;
    }
    function Probe() {
      const view = useSyncExternalStore(
        lab.session.subscribe,
        lab.session.getSnapshot,
        lab.session.getSnapshot,
      );
      current = useWorkerTapeLink(
        lab.binding,
        lab.session,
        view.accepted?.parameters,
        true,
        (settings) => loaded.push(settings),
        target,
        draftRevision,
      );
      return <LabTapeLink link={{ ...current, walkthrough: undefined }} />;
    }
    window.history.replaceState({}, "", `/lab/bm-08/?tape=${encodeTapePermalink(recorded)}`);
    const held = holdDraftDecompression();
    try {
      root = createRoot(container);
      await act(async () => root?.render(<Probe />));
      await held.entered();
      // The explicit edit marker is already authoritative before React commits another render.
      draftRevision.current++;
      await held.finish();
      expect(link().checkpoint).toBeUndefined();
      expect(link().recovery?.label).toBe("Review the shared calculation");
      expect(lab.channels).toHaveLength(0);
      expect(lab.session.getSnapshot()).toBe(before);
      expect(loaded).toEqual([]);
      expect(restored).toEqual([]);
      assert(link().shareTape);
      expect(link().shareTape?.acceptedCheckpoint.digest).not.toBe(
        recorded.acceptedCheckpoint.digest,
      );
      await clickRecovery("Review the shared calculation");
      expect(link().recovery).toBeUndefined();
      expect(link().checkpoint?.phase).toBe("ready");
      expect(link().checkpoint?.canRestore).toBe(true);
      expect(lab.channels).toHaveLength(0);
      expect(lab.session.getSnapshot()).toBe(before);
      expect(loaded).toEqual([]);
      expect(restored).toEqual([]);
      expect(link().shareTape?.acceptedCheckpoint.digest).not.toBe(
        recorded.acceptedCheckpoint.digest,
      );
      expect(JSON.stringify(recorded)).toBe(original);
    } finally {
      held.restore();
      await act(async () => root?.unmount());
      root = null;
      lab.session.disconnect();
    }
  }, 20_000);

  test("the real osmotic form keeps typed numbers and loads the shared draft only on request", async () => {
    draftAddress();
    const held = holdDraftDecompression();
    try {
      root = createRoot(container);
      await act(async () =>
        root?.render(<OsmoticPartitionLab instanceId="draft-link-real-form" />),
      );
      await held.entered();
      const field = container.querySelector<HTMLInputElement>('input[name="T"]');
      const lab = container.querySelector<HTMLElement>('[data-instrument-id="bm-02"]');
      assert(field && lab);
      const before = lab.getAttribute("data-snapshot-version");
      assert(before, "The mounted laboratory must identify its accepted snapshot.");
      // Use the mounted handler as in OsmoticPartitionLab.interactions.test.tsx: happy-dom's
      // synthetic number-input events do not reliably reach React's change plugin.
      const propsKey = Object.keys(field).find((key) => key.startsWith("__reactProps$"));
      assert(propsKey);
      const props = (
        field as unknown as Record<
          string,
          {
            onChange(event: { target: HTMLInputElement; currentTarget: HTMLInputElement }): void;
          }
        >
      )[propsKey];
      assert(props && typeof props.onChange === "function");
      await act(async () => {
        field.value = "310";
        props.onChange({ target: field, currentTarget: field });
      });
      expect(field.value).toBe("310");
      await held.finish();
      expect(field.value).toBe("310");
      expect(lab.getAttribute("data-snapshot-version")).toBe(before);
      const recovery = container.querySelector<HTMLButtonElement>("[data-tape-recovery] button");
      assert(recovery, "The reader must be offered an explicit way to use the incoming settings.");
      expect(recovery.textContent).toBe("Load the shared settings");
      await act(async () => recovery.click());
      expect(field.value).toBe("321");
      expect(lab.getAttribute("data-snapshot-version")).toBe(before);
      expect(container.querySelector("[data-tape-recovery]")).toBeNull();
    } finally {
      held.restore();
    }
  });
});
