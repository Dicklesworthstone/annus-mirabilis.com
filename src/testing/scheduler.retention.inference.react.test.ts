import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InferenceLab } from "../components/lab/InferenceLab.tsx";
import { inferenceObservationCsv } from "../experiments/bm07/export.ts";
import { createBm07Session, type PreparedBm07Example } from "../experiments/bm07/session.ts";
import { RetainedSessionProvider } from "../experiments/store/retainedSession.tsx";
import {
  createSessionRetention,
  type SessionRetention,
} from "../experiments/store/sessionRetention.ts";
import {
  installPredictPersistence,
  predictPersistence,
  REMEMBERS_NOTHING,
} from "../experiments/predict/predictPersistence.ts";
import prepared from "../generated/bm07-example.json";
import { createBm07Host } from "../workers/host/bm07Host.ts";
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

async function settled(session: ReturnType<typeof createBm07Session>) {
  for (let attempt = 0; attempt < 400 && session.getSnapshot().pending; attempt++)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  expect(session.getSnapshot().pending).toBe(false);
}

test("InferenceLab keeps accepted observations readable and exportable and starts an explicit replacement trial", async () => {
  const example = prepared as PreparedBm07Example;
  let corrupt = false;
  let created = 0;
  let retired = 0;
  const factory = (): WorkerChannel => {
    created++;
    let receive: ((message: unknown) => void) | undefined;
    let failed: (() => void) | undefined;
    const host = createBm07Host((message) => {
      if (
        corrupt &&
        message.messageKind === "result" &&
        message.result.kind === "accepted" &&
        message.result.data.recordingCheckpoint
      )
        receive?.({
          ...message,
          result: {
            ...message.result,
            data: {
              ...message.result.data,
              recordingCheckpoint: {
                ...message.result.data.recordingCheckpoint,
                digest: "host:sha256:" + "f".repeat(64),
              },
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
  // Reopen the actual retained owner through the normal reader boundary, without replacing
  // InferenceLab's hooks or introducing a test-only production worker factory.
  const cache = createSessionRetention();
  caches.push(cache);
  const identity = {
    experimentId: "bm-07",
    instanceId: "inference-retention-ui",
    sourceDigest: example.sourceDigest,
  };
  const owner = cache.prepare("inference-retention-passage", identity, (instanceId) =>
    createBm07Session(instanceId, example, factory, {
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
          placementKey: "inference-retention-passage",
          instanceId: identity.instanceId,
          previous: null,
          onReference: () => {},
        },
        createElement(InferenceLab, {
          example,
          instanceId: identity.instanceId,
          restoreFromLocation: false,
          readings: false,
        }),
      ),
    );
  });
  release();
  const instrument = container.querySelector('[data-instrument-id="bm-07"]');
  assert.ok(instrument);
  await act(async () => {
    expect(emitTestIntersection(instrument, true)).toBeGreaterThan(0);
    session.apply({
      ...example.parameters,
      M: 8,
      coverageTrials: 0,
      seed: "9007199254740993",
    });
  });
  await settled(session);
  expect(session.getSnapshot().status).toBe("accepted");
  const accepted = session.getSnapshot().accepted;
  assert.ok(accepted);
  const exported = inferenceObservationCsv(accepted, example.sourceDigest);
  const readings = Array.from(container.querySelectorAll("table")).map(
    (table) => table.textContent,
  );
  expect(created).toBe(1);
  expect(retired).toBe(1);

  corrupt = true;
  await act(async () => {
    session.apply({ ...accepted.parameters, M: 12 });
  });
  await settled(session);
  expect(session.getSnapshot().status).toBe("unavailable");
  expect(session.getSnapshot().accepted === accepted).toBe(true);
  expect(container.textContent).toContain("could not recover the same recording");
  expect(container.textContent).toContain("The previous accepted result is unchanged.");
  expect(container.textContent).toContain("Start a new independent trial to continue.");
  expect(container.querySelector('[data-predict-response="awaiting"]') !== null).toBe(true);
  const recovery = container.querySelector<HTMLElement>("[data-recording-recovery]");
  assert.ok(recovery);
  expect(recovery.closest('[data-predict-response="awaiting"]') === null).toBe(true);
  expect(recovery.hidden).toBe(false);
  expect(container.querySelectorAll("[data-recording-recovery]").length).toBe(1);
  const recoveryAnnouncements = Array.from(
    container.querySelectorAll('[aria-live], [role="status"], [role="alert"]'),
  ).filter((element) =>
    element.textContent?.includes("Start a new independent trial to continue."),
  );
  expect(recoveryAnnouncements.length).toBe(1);
  expect(inferenceObservationCsv(accepted, example.sourceDigest)).toBe(exported);
  expect(Array.from(container.querySelectorAll("table")).map((table) => table.textContent)).toEqual(
    readings,
  );

  const buttons = Array.from(container.querySelectorAll("button"));
  const download = buttons.find(
    (button) => button.textContent?.trim() === "Download accepted observations",
  );
  const restart = buttons.find(
    (button) => button.textContent?.trim() === "New independent trial",
  );
  assert.ok(download);
  assert.ok(restart);
  expect(download.disabled).toBe(false);
  expect(download.closest('[data-predict-response="awaiting"]') === null).toBe(true);
  expect(restart.disabled).toBe(false);
  expect(restart.closest('[data-predict-response="awaiting"]') === null).toBe(true);
  corrupt = false;
  await act(async () => restart.click());
  await settled(session);
  expect(session.getSnapshot().status).toBe("accepted");
  expect(session.getSnapshot().accepted?.runId).not.toBe(accepted.runId);
  expect(session.getSnapshot().accepted?.parameters.seed).not.toBe(accepted.parameters.seed);
  expect(container.textContent).not.toContain("Start a new independent trial to continue.");
  expect(container.querySelector("[data-recording-recovery]") === null).toBe(true);
  expect(created).toBe(3);
  expect(retired).toBe(3);
});
