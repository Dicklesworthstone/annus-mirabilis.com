import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CameraControlledComparison } from "../../components/lab/CameraControlledComparison.tsx";
import { CameraLab } from "../../components/lab/CameraLab.tsx";
import { DriftDiffusionLab } from "../../components/lab/DriftDiffusionLab.tsx";
import { InferenceLab } from "../../components/lab/InferenceLab.tsx";
import { RodSimultaneityLab } from "../../components/lab/RodSimultaneityLab.tsx";
import { WaveDescriptionLab } from "../../components/lab/WaveDescriptionLab.tsx";
import bm04Example from "../../generated/bm04-example.json";
import bm07Example from "../../generated/bm07-example.json";
import bm08Example from "../../generated/bm08-example.json";
import lq01Example from "../../generated/lq01-example.json";
import sr03Example from "../../generated/sr03-example.json";
import {
  emitTestIntersection,
  installDom,
  observedTestIntersections,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createBm04Host } from "../../workers/host/bm04Host.ts";
import { createBm07Host } from "../../workers/host/bm07Host.ts";
import { createBm08Host } from "../../workers/host/bm08Host.ts";
import { createLq01Host } from "../../workers/host/lq01Host.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import type { WorkerChannel } from "../../workers/scheduler/scheduler.ts";
import { createBm04Session, type PreparedBm04Example } from "../bm04/session.ts";
import { createBm07Session, type PreparedBm07Example } from "../bm07/session.ts";
import { createBm08Session, type PreparedBm08Example } from "../bm08/session.ts";
import { createLq01Session, type PreparedLq01Example } from "../lq01/session.ts";
import { createSr03Session, type PreparedSr03Example } from "../sr03/session.ts";
import { RetainedSessionProvider } from "../store/retainedSession.tsx";
import { createSessionRetention, type SessionRetention } from "../store/sessionRetention.ts";

type Session = Pick<
  ReturnType<typeof createBm04Session>,
  "apply" | "getSnapshot" | "subscribe" | "disconnect"
>;
type Host = ReturnType<typeof createBm04Host>;
type Case = Readonly<{
  id: string;
  sourceDigest: string;
  create(id: string, channel: () => WorkerChannel): Session;
  host(send: (message: unknown) => void): Host;
  view(id: string): ReactElement;
  parameters: Record<string, unknown>;
  change: Record<string, string | number | boolean>;
}>;
const cases: readonly Case[] = [
  {
    id: "bm-04",
    sourceDigest: bm04Example.sourceDigest,
    create: (id, channel) => createBm04Session(id, bm04Example as PreparedBm04Example, channel),
    host: (send) => createBm04Host(send, bm04Example.sourceDigest),
    view: (id) => (
      <DriftDiffusionLab
        example={bm04Example as PreparedBm04Example}
        instanceId={id}
        restoreFromLocation={false}
      />
    ),
    parameters: { ...bm04Example.parameters, steps: 4 },
    change: { F: 0 },
  },
  {
    id: "bm-07",
    sourceDigest: bm07Example.sourceDigest,
    create: (id, channel) => createBm07Session(id, bm07Example as PreparedBm07Example, channel),
    host: (send) => createBm07Host(send, bm07Example.sourceDigest),
    view: (id) => (
      <InferenceLab
        example={bm07Example as PreparedBm07Example}
        instanceId={id}
        restoreFromLocation={false}
      />
    ),
    parameters: { ...bm07Example.parameters, M: 8, coverageTrials: 0 },
    change: { coverage: 0.9 },
  },
  {
    id: "bm-08",
    sourceDigest: bm08Example.sourceDigest,
    create: (id, channel) => createBm08Session(id, bm08Example as PreparedBm08Example, channel),
    host: (send) => createBm08Host(send, bm08Example.sourceDigest),
    view: (id) => (
      <CameraLab
        example={bm08Example as PreparedBm08Example}
        instanceId={id}
        restoreFromLocation={false}
      />
    ),
    parameters: { ...bm08Example.parameters, M: 4, coverageTrials: 0 },
    change: { sigma: 0 },
  },
  {
    id: "lq-01",
    sourceDigest: lq01Example.sourceDigest,
    create: (id, channel) => createLq01Session(id, lq01Example as PreparedLq01Example, channel),
    host: (send) => createLq01Host(send, lq01Example.sourceDigest),
    view: (id) => (
      <WaveDescriptionLab
        example={lq01Example as PreparedLq01Example}
        instanceId={id}
        restoreFromLocation={false}
      />
    ),
    parameters: { ...lq01Example.parameters },
    change: { delta: Math.PI },
  },
  {
    id: "sr-03",
    sourceDigest: sr03Example.sourceDigest,
    create: (id, channel) => createSr03Session(id, sr03Example as PreparedSr03Example, channel),
    host: (send) => createSr03Host(send, sr03Example.sourceDigest),
    view: (id) => (
      <RodSimultaneityLab
        example={sr03Example as PreparedSr03Example}
        instanceId={id}
        restoreFromLocation={false}
      />
    ),
    parameters: { ...sr03Example.parameters },
    change: { measuringFrame: "k" },
  },
];
let root: Root | null;
let container: HTMLElement;
let cache: SessionRetention;
let restoreWorker: (() => void) | undefined;
const placement = "/papers/visibility-owner";
const instanceId = "visible-retained-owner";

beforeEach(async () => {
  await installDom({ intersections: "manual" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  cache = createSessionRetention();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  cache.dispose();
  restoreWorker?.();
  restoreWorker = undefined;
  await uninstallDom();
});

function retained(spec: Case) {
  let creations = 0;
  let requests = 0;
  let disposals = 0;
  const prepared = cache.prepare(
    placement,
    { experimentId: spec.id, instanceId, sourceDigest: spec.sourceDigest },
    (id) =>
      spec.create(id, () => {
        creations++;
        let listener: ((message: unknown) => void) | undefined;
        const host = spec.host((message) =>
          queueMicrotask(() => listener?.(structuredClone(message))),
        );
        return {
          send(message) {
            if ((message as { messageKind: string }).messageKind === "request") requests++;
            void host.receive(structuredClone(message));
          },
          listen(onMessage) {
            listener = onMessage;
            queueMicrotask(() => host.hello());
            return () => {
              listener = undefined;
            };
          },
          dispose() {
            disposals++;
            host.dispose();
          },
        };
      }),
  );
  const release = cache.retain(prepared);
  return {
    session: prepared.session,
    release,
    get creations() {
      return creations;
    },
    get requests() {
      return requests;
    },
    get disposals() {
      return disposals;
    },
  };
}
async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 200 && !check(); attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  assert.ok(check(), "The real view and worker must settle.");
}
async function settled(session: Session) {
  await until(() => !session.getSnapshot().pending);
  expect(session.getSnapshot().status).toBe("accepted");
}

for (const spec of cases) {
  test(`${spec.id}: the complete mounted laboratory region controls its retained owner`, async () => {
    const lab = retained(spec);
    await act(async () =>
      root?.render(
        <StrictMode>
          <RetainedSessionProvider
            cache={cache}
            placementKey={placement}
            instanceId={instanceId}
            previous={null}
            onReference={() => {}}
          >
            {spec.view(instanceId)}
          </RetainedSessionProvider>
        </StrictMode>,
      ),
    );
    lab.release();
    const region = container.querySelector<HTMLElement>(
      `section.laboratory[data-instrument-id="${spec.id}"]`,
    );
    assert.ok(region);
    expect(observedTestIntersections()).toContain(region);
    const forms = [...container.querySelectorAll("form")];
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) expect(region.contains(form)).toBe(true);
    await act(async () => {
      expect(lab.session.apply(spec.parameters).kind).toBe("accepted");
    });
    expect(lab.creations).toBe(0);
    expect(region.dataset.labVisibility).toBe("off-screen");
    await act(async () => {
      expect(emitTestIntersection(region, true)).toBe(1);
    });
    await settled(lab.session);
    expect(lab.creations).toBe(1);
    expect(lab.requests).toBe(1);
    const accepted = lab.session.getSnapshot().accepted;
    assert.ok(accepted);
    await act(async () => {
      emitTestIntersection(region, false);
      expect(lab.session.apply({ ...spec.parameters, ...spec.change }).kind).toBe("accepted");
    });
    expect(lab.requests).toBe(1);
    expect(lab.disposals).toBe(0);
    expect(lab.session.getSnapshot().accepted).toBe(accepted);
    const queued = lab.session.getSnapshot().requested;
    assert.ok(queued);
    if (spec.id === "bm-04") {
      // The force change is backdated; visibility must preserve its intended new run.
      expect(accepted.simulationTime).toBeGreaterThan(0);
      expect(queued.runId).not.toBe(accepted.runId);
      expect(queued.parentRunId).toBe(accepted.runId);
    } else {
      expect(queued.runId).toBe(accepted.runId);
    }
    await act(async () => {
      emitTestIntersection(region, true);
    });
    await settled(lab.session);
    expect(lab.requests).toBe(2);
    expect(lab.creations).toBe(1);
    const resumed = lab.session.getSnapshot().accepted;
    assert.ok(resumed);
    expect(resumed.runId).toBe(queued.runId);
    expect(resumed.parentRunId).toBe(queued.parentRunId);
    expect(resumed.actionIndex).toBe(queued.actionIndex);
    expect(resumed.revisions).toEqual(queued.revisions);
    expect(resumed.parameters).toEqual(queued.parameters);
    await act(async () => root?.unmount());
    root = null;
    expect(observedTestIntersections()).not.toContain(region);
    expect(emitTestIntersection(region, true)).toBe(0);
    expect(lab.disposals).toBe(1);
  }, 60000);
}

/** Exercise the comparison's real browser-channel factory with an in-process host transport. */
function cameraWorker() {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let creations = 0;
  let requests = 0;
  let disposals = 0;
  class InProcessWorker extends EventTarget {
    private closed = false;
    private readonly host = createBm08Host((message) => {
      if (!this.closed) {
        this.dispatchEvent(new MessageEvent("message", { data: structuredClone(message) }));
      }
    }, bm08Example.sourceDigest);
    constructor() {
      super();
      creations++;
      queueMicrotask(() => {
        if (!this.closed) this.host.hello();
      });
    }
    postMessage(message: unknown) {
      if ((message as { messageKind: string }).messageKind === "request") requests++;
      void this.host.receive(structuredClone(message));
    }
    terminate() {
      if (this.closed) return;
      this.closed = true;
      disposals++;
      this.host.dispose();
    }
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: InProcessWorker });
  restoreWorker = () => {
    if (original) Object.defineProperty(globalThis, "Worker", original);
    else Reflect.deleteProperty(globalThis, "Worker");
  };
  return {
    get creations() {
      return creations;
    },
    get requests() {
      return requests;
    },
    get disposals() {
      return disposals;
    },
  };
}

test("the camera comparison observes the parent that contains its start and variation controls", async () => {
  const worker = cameraWorker();
  await act(async () =>
    root?.render(
      <StrictMode>
        <CameraControlledComparison example={bm08Example as PreparedBm08Example} />
      </StrictMode>,
    ),
  );
  const region = container.querySelector<HTMLElement>("[data-controlled-camera-comparison]");
  assert.ok(region);
  const start = region.querySelector<HTMLButtonElement>(".actions button");
  const form = region.querySelector<HTMLFormElement>("form");
  assert.ok(start && form);
  expect(observedTestIntersections()).toContain(region);
  expect(start.disabled).toBe(false);
  await act(async () => start.click());
  expect(region.dataset.pending).toBe("true");
  expect(worker.creations).toBe(0);
  await act(async () => {
    expect(emitTestIntersection(region, true)).toBe(1);
  });
  await until(() => region.dataset.pending === "false");
  expect(region.dataset.comparisonPhase).toBe("live");
  expect(worker.creations).toBe(1);
  expect(worker.requests).toBe(1);
  const input = form.querySelector<HTMLInputElement>('input[type="text"]');
  assert.ok(input);
  const key = Object.keys(input).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key);
  const props = (
    input as unknown as Record<string, { onChange(event: { target: HTMLInputElement }): void }>
  )[key];
  assert.ok(props);
  await act(async () => {
    emitTestIntersection(region, false);
    input.value = bm08Example.parameters.sigma === 0 ? "0.1" : "0";
    props.onChange({ target: input });
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(region.dataset.pending).toBe("true");
  expect(worker.requests).toBe(1);
  expect(worker.disposals).toBe(0);
  await act(async () => {
    emitTestIntersection(region, true);
  });
  await until(() => region.dataset.pending === "false");
  expect(worker.requests).toBe(2);
  expect(worker.creations).toBe(1);
  expect(region.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root?.unmount());
  root = null;
  expect(emitTestIntersection(region, true)).toBe(0);
  expect(worker.disposals).toBe(1);
}, 60000);
