import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrownianLab } from "../components/lab/BrownianLab.tsx";
import { BM06_DEFAULTS } from "../experiments/bm06/definition.ts";
import { createBm06Session, type PreparedBm06Example } from "../experiments/bm06/session.ts";
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
import prepared from "../generated/bm06-example.json";
import { createBm06Host } from "../workers/host/bm06Host.ts";
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

async function settled(session: ReturnType<typeof createBm06Session>) {
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

test("BrownianLab exposes calculation recovery before prediction reveal and preserves the accepted result", async () => {
  const example = prepared as PreparedBm06Example;
  let corrupt = false;
  let created = 0;
  let retired = 0;
  const factory = (): WorkerChannel => {
    created++;
    let receive: ((message: unknown) => void) | undefined;
    let failed: (() => void) | undefined;
    const host = createBm06Host((message) => {
      if (corrupt && message.messageKind === "result" && message.result.kind === "accepted")
        receive?.({
          ...message,
          result: {
            kind: "accepted",
            data: {
              ...message.result.data,
              outputs: message.result.data.outputs.map((output) => {
                if (
                  output.quantityId !== "gridDensity" ||
                  output.status !== "value" ||
                  !(output.value instanceof Float64Array)
                )
                  return output;
                const value = output.value.slice();
                value[value.length - 1] = (value[value.length - 1] as number) + 1;
                return { ...output, value };
              }),
            },
          },
        });
      else receive?.(message);
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
        retired++;
        host.dispose();
      },
    };
  };
  const cache = createSessionRetention();
  caches.push(cache);
  const identity = {
    experimentId: "bm-06",
    instanceId: "spreading-retention-ui",
    sourceDigest: example.sourceDigest,
  };
  const owner = cache.prepare("spreading-retention-passage", identity, (instanceId) =>
    createBm06Session(instanceId, example, factory, {
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
          placementKey: "spreading-retention-passage",
          instanceId: identity.instanceId,
          previous: null,
          onReference: () => {},
        },
        createElement(BrownianLab, {
          example,
          instanceId: identity.instanceId,
          restoreFromLocation: false,
          readings: false,
        }),
      ),
    );
  });
  release();
  const instrument = container.querySelector('[data-instrument-id="bm-06"]');
  assert.ok(instrument);
  await act(async () => {
    expect(emitTestIntersection(instrument, true)).toBeGreaterThan(0);
    session.apply({ ...BM06_DEFAULTS, gridEnabled: true });
  });
  await settled(session);
  expect(session.getSnapshot().status).toBe("accepted");
  const accepted = session.getSnapshot().accepted;
  assert.ok(accepted);
  const saved = exported(accepted);
  const tables = Array.from(container.querySelectorAll("table")).map((table) => table.textContent);
  expect(created).toBe(1);
  expect(retired).toBe(1);

  corrupt = true;
  await act(async () => {
    session.apply({ ...accepted.parameters, lower: 0 });
  });
  await settled(session);
  expect(session.getSnapshot().status).toBe("unavailable");
  expect(session.getSnapshot().accepted === accepted).toBe(true);
  expect(exported(accepted)).toEqual(saved);
  expect(Array.from(container.querySelectorAll("table")).map((table) => table.textContent)).toEqual(
    tables,
  );
  expect(container.querySelector('[data-predict-response="awaiting"]') !== null).toBe(true);
  const recovery = container.querySelector<HTMLElement>("[data-calculation-recovery]");
  assert.ok(recovery);
  expect(recovery.textContent).toContain("same model, engine and complete numerical state");
  expect(recovery.textContent).toContain("The previous accepted result is unchanged.");
  expect(recovery.textContent).toContain("Start a new calculation to continue.");
  expect(recovery.closest('[data-predict-response="awaiting"]') === null).toBe(true);
  expect(recovery.getAttribute("data-predict-response")).toBe("shown");
  expect(recovery.hidden).toBe(false);
  expect(container.querySelectorAll("[data-calculation-recovery]").length).toBe(1);
  const announcements = Array.from(
    container.querySelectorAll('[aria-live], [role="status"], [role="alert"]'),
  ).filter((element) => element.textContent?.includes("Start a new calculation to continue."));
  expect(announcements.length).toBe(1);
  const restart = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === "Start a new calculation",
  );
  assert.ok(restart);
  expect(restart.disabled).toBe(false);
  expect(restart.closest('[data-predict-response="awaiting"]') === null).toBe(true);

  corrupt = false;
  await act(async () => restart.click());
  await settled(session);
  const recovered = session.getSnapshot();
  expect(recovered.status).toBe("accepted");
  expect(recovered.accepted?.runId).not.toBe(accepted.runId);
  expect(recovered.accepted?.parameters.lower).toBe(0);
  expect(recovered.accepted?.parameters.gridEnabled).toBe(true);
  expect(recovered.accepted?.stepIndex).toBe(accepted.stepIndex);
  expect(recovered.accepted?.simulationTime).toBe(accepted.simulationTime);
  expect(container.querySelector("[data-calculation-recovery]") === null).toBe(true);
  expect(container.querySelector('[data-predict-response="awaiting"]') !== null).toBe(true);
  expect(created).toBe(3);
  expect(retired).toBe(3);
});
