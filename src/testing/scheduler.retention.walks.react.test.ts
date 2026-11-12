import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WalkLab } from "../components/lab/WalkLab.tsx";
import type { Bm05Parameters } from "../experiments/bm05/definition.ts";
import { createBm05Session, type PreparedBm05Example } from "../experiments/bm05/session.ts";
import {
  installPredictPersistence,
  predictPersistence,
  REMEMBERS_NOTHING,
} from "../experiments/predict/predictPersistence.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import type { ScientificResult } from "../experiments/results/types.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import { RetainedSessionProvider } from "../experiments/store/retainedSession.tsx";
import {
  createSessionRetention,
  type SessionRetention,
} from "../experiments/store/sessionRetention.ts";
import prepared from "../generated/bm05-example.json";
import { createBm05Host } from "../workers/host/bm05Host.ts";
import { createWorkerAdmission } from "../workers/scheduler/admission.ts";
import { createWorkerRetention } from "../workers/scheduler/retention.ts";
import type { WorkerChannel } from "../workers/scheduler/scheduler.ts";
import {
  createContainer,
  emitTestIntersection,
  installDom,
  removeContainer,
  uninstallDom,
} from "./reactDom.ts";

let container: HTMLElement;
let root: Root;
let previousPredictions: ReturnType<typeof predictPersistence>;
const caches: SessionRetention[] = [];
const example = prepared as PreparedBm05Example;
const parameters: Bm05Parameters = {
  ...example.parameters,
  walkers: 24,
  runSteps: 181,
  seed: "9007199254740993",
};

beforeEach(async () => {
  previousPredictions = predictPersistence();
  installPredictPersistence(REMEMBERS_NOTHING);
  await installDom({ intersections: "manual" });
  document.documentElement.setAttribute("data-detail", "r1");
  container = createContainer();
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  for (const cache of caches.splice(0)) cache.dispose();
  removeContainer(container);
  await uninstallDom();
  installPredictPersistence(previousPredictions);
});

async function settled(session: ReturnType<typeof createBm05Session>) {
  for (let attempt = 0; attempt < 400 && session.getSnapshot().pending; attempt++)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  expect(session.getSnapshot().pending).toBe(false);
}

function exported(snapshot: AcceptedSnapshot): readonly string[] {
  return snapshot.outputs.map((output) => {
    const result: ScientificResult =
      output.status === "value"
        ? {
            ...output,
            value: typeof output.value === "number" ? output.value : output.value.copy(),
          }
        : output;
    return encodeResult(result);
  });
}

async function mountLaboratory() {
  const control = { corrupt: false, created: 0, retired: 0 };
  const factory = (): WorkerChannel => {
    control.created++;
    let receive: ((message: unknown) => void) | undefined;
    let failed: (() => void) | undefined;
    const host = createBm05Host((message) => {
      if (
        control.corrupt &&
        message.messageKind === "result" &&
        message.result.kind === "accepted"
      ) {
        const checkpoint = message.result.data.recordingCheckpoint;
        assert.ok(checkpoint);
        receive?.({
          ...message,
          result: {
            kind: "accepted",
            data: {
              ...message.result.data,
              recordingCheckpoint: { ...checkpoint, digest: `host:sha256:${"f".repeat(64)}` },
            },
          },
        });
      } else receive?.(message);
    }, example.sourceDigest);
    return {
      listen(onMessage, onError) {
        receive = onMessage;
        failed = onError;
        queueMicrotask(() => host.hello());
        return () => {
          receive = undefined;
          failed = undefined;
        };
      },
      send(message) {
        void host.receive(structuredClone(message)).catch(() => failed?.());
      },
      dispose() {
        control.retired++;
        host.dispose();
      },
    };
  };
  const cache = createSessionRetention();
  caches.push(cache);
  const identity = {
    experimentId: "bm-05",
    instanceId: "walk-retention-ui",
    sourceDigest: example.sourceDigest,
  };
  const owner = cache.prepare("walk-retention-passage", identity, (instanceId) =>
    createBm05Session(instanceId, example, factory, {
      admission: createWorkerAdmission(1),
      retention: createWorkerRetention(0),
    }),
  );
  const release = cache.retain(owner);
  const session = owner.session;
  await act(async () => {
    root.render(
      createElement(
        RetainedSessionProvider,
        {
          cache,
          placementKey: "walk-retention-passage",
          instanceId: identity.instanceId,
          previous: null,
          onReference: () => {},
        },
        createElement(WalkLab, {
          example,
          instanceId: identity.instanceId,
          restoreFromLocation: false,
          readings: false,
        }),
      ),
    );
  });
  release();
  const instrument = container.querySelector('[data-instrument-id="bm-05"]');
  assert.ok(instrument);
  expect(control.created).toBe(0);
  await act(async () => {
    expect(emitTestIntersection(instrument, true)).toBeGreaterThan(0);
    session.apply(parameters);
  });
  await settled(session);
  expect(session.getSnapshot().status).toBe("accepted");
  return { session, control, instrument };
}

function restartButton() {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === "Start a new recording with these settings",
  );
  assert.ok(button);
  return button;
}

async function edit(name: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  assert.ok(input);
  // The controlled React handler remains the UI boundary; happy-dom has no native text input.
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  assert.ok(key);
  const props = (input as unknown as Record<string, { onChange?: (event: unknown) => void }>)[key];
  assert.ok(props?.onChange);
  await act(async () => {
    input.value = value;
    props.onChange?.({ target: input, currentTarget: input });
  });
}

test("WalkLab exposes one ungated recovery notice and restarts the exact failed observation", async () => {
  const { session, control } = await mountLaboratory();
  const accepted = session.getSnapshot().accepted;
  assert.ok(accepted);
  const saved = exported(accepted);
  const tables = Array.from(container.querySelectorAll("table")).map((table) => table.textContent);
  expect(control.created).toBe(1);
  expect(control.retired).toBe(1);
  control.corrupt = true;
  await act(async () => {
    session.apply({ ...parameters, n: 37, bias: 0.5 });
  });
  await settled(session);
  expect(session.getSnapshot().status).toBe("unavailable");
  expect(session.getSnapshot().accepted === accepted).toBe(true);
  expect(exported(accepted)).toEqual(saved);
  expect(Array.from(container.querySelectorAll("table")).map((table) => table.textContent)).toEqual(
    tables,
  );
  expect(container.querySelector('[data-predict-response="awaiting"]') !== null).toBe(true);
  const recovery = container.querySelector<HTMLElement>("[data-recording-recovery]");
  assert.ok(recovery);
  expect(recovery.textContent).toContain("complete trajectory differs");
  expect(recovery.textContent).toContain("previous accepted result is unchanged");
  expect(recovery.closest('[data-predict-response="awaiting"]') === null).toBe(true);
  expect(recovery.hidden).toBe(false);
  const announcements = Array.from(
    container.querySelectorAll('[aria-live], [role="status"], [role="alert"]'),
  ).filter((element) =>
    element.textContent?.includes("Start a new independent trial to continue."),
  );
  expect(announcements.length).toBe(1);
  const restart = restartButton();
  expect(restart.disabled).toBe(false);
  expect(restart.closest('[data-predict-response="awaiting"]') === null).toBe(true);
  control.corrupt = false;
  await act(async () => restart.click());
  await settled(session);
  const recovered = session.getSnapshot();
  expect(recovered.status).toBe("accepted");
  expect(recovered.accepted?.runId).not.toBe(accepted.runId);
  expect(recovered.accepted?.parameters.n).toBe(37);
  expect(recovered.accepted?.parameters.bias).toBe(0.5);
  expect(recovered.accepted?.parameters.seed).toBe(parameters.seed);
  expect(recovered.accepted?.stepIndex).toBe(accepted.stepIndex);
  expect(recovered.accepted?.simulationTime).toBe(accepted.simulationTime);
  expect(container.querySelector("[data-recording-recovery]") === null).toBe(true);
  expect(container.querySelector('[data-predict-response="awaiting"]') !== null).toBe(true);
  expect(control.created).toBe(3);
  expect(control.retired).toBe(3);
});

test("recovery validates newer draft entries without losing the accepted recording", async () => {
  const { session, control } = await mountLaboratory();
  const accepted = session.getSnapshot().accepted;
  assert.ok(accepted);
  const saved = exported(accepted);
  control.corrupt = true;
  await act(async () => {
    session.apply({ ...parameters, n: 37, bias: 0.5 });
  });
  await settled(session);
  expect(session.getSnapshot().status).toBe("unavailable");
  const requested = session.getSnapshot().requested;
  await edit("walkers", "-1");
  await act(async () => restartButton().click());
  expect(session.getSnapshot().accepted === accepted).toBe(true);
  expect(session.getSnapshot().requested === requested).toBe(true);
  expect(exported(accepted)).toEqual(saved);
  expect(control.created).toBe(2);
  const refusal = container.querySelector('[data-apply-failure="refused"]');
  assert.ok(refusal);
  expect(refusal.closest('[data-predict-response="awaiting"]') === null).toBe(true);
  // All current draft fields, including inputs and the unsubmitted observation, win over the
  // earlier failed request. This also keeps the u64 seed as exact decimal digits.
  await edit("walkers", "27");
  await edit("runSteps", "80");
  await edit("n", "43");
  await edit("bias", "0.7");
  await edit("seed", "18446744073709551615");
  control.corrupt = false;
  await act(async () => restartButton().click());
  await settled(session);
  const recovered = session.getSnapshot();
  expect(recovered.status).toBe("accepted");
  expect(recovered.accepted?.runId).not.toBe(accepted.runId);
  expect(recovered.accepted?.parameters.walkers).toBe(27);
  expect(recovered.accepted?.parameters.runSteps).toBe(80);
  expect(recovered.accepted?.parameters.n).toBe(43);
  expect(recovered.accepted?.parameters.bias).toBe(0.7);
  expect(recovered.accepted?.parameters.seed).toBe("18446744073709551615");
  expect(container.querySelector('[data-apply-failure="refused"]') === null).toBe(true);
  expect(container.querySelector("[data-recording-recovery]") === null).toBe(true);
});
