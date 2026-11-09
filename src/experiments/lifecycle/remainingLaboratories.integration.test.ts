import { afterAll, expect, test } from "bun:test";
import assert from "node:assert/strict";
import bm04Example from "../../generated/bm04-example.json";
import bm07Example from "../../generated/bm07-example.json";
import bm08Example from "../../generated/bm08-example.json";
import lq01Example from "../../generated/lq01-example.json";
import sr03Example from "../../generated/sr03-example.json";
import { TestLogger } from "../../testing/log/logger.ts";
import { createBm04Host } from "../../workers/host/bm04Host.ts";
import { createBm07Host } from "../../workers/host/bm07Host.ts";
import { createBm08Host } from "../../workers/host/bm08Host.ts";
import { createLq01Host } from "../../workers/host/lq01Host.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import type { WorkerChannel } from "../../workers/scheduler/scheduler.ts";
import { createBm04Session, type PreparedBm04Example } from "../bm04/session.ts";
import { createBm07Session, type PreparedBm07Example } from "../bm07/session.ts";
import { createBm08ComparisonSession } from "../bm08/comparisonSession.ts";
import { createBm08Session, type PreparedBm08Example } from "../bm08/session.ts";
import { createLq01Session, type PreparedLq01Example } from "../lq01/session.ts";
import { createSr03Session, type PreparedSr03Example } from "../sr03/session.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import {
  bindLaboratoryVisibility,
  type VisibilityControlledSession,
} from "./bindLaboratoryVisibility.ts";

const logger = new TestLogger("remaining-laboratory-visibility");
afterAll(() => logger.flush());
type Session = Pick<
  ReturnType<typeof createBm04Session>,
  "apply" | "getSnapshot" | "subscribe" | "setSchedulingPaused" | "disconnect" | "stop"
> &
  Partial<Pick<ReturnType<typeof createLq01Session>, "startNewRun">>;
type Host = ReturnType<typeof createBm04Host>;
type Case = {
  id: string;
  create(channel: () => WorkerChannel): Session;
  host(send: (message: unknown) => void): Host;
  parameters: Record<string, unknown>;
  measurements: readonly Record<string, string | number | boolean>[];
};
const cases: readonly Case[] = [
  {
    id: "bm-04",
    create: (channel) =>
      createBm04Session("visible-balance", bm04Example as PreparedBm04Example, channel),
    host: (send) => createBm04Host(send, bm04Example.sourceDigest),
    parameters: { ...bm04Example.parameters, steps: 4 },
    measurements: [{ F: 0 }, { F: 2e-15 }],
  },
  {
    id: "bm-07",
    create: (channel) =>
      createBm07Session("visible-inference", bm07Example as PreparedBm07Example, channel),
    host: (send) => createBm07Host(send, bm07Example.sourceDigest),
    parameters: { ...bm07Example.parameters, M: 8, coverageTrials: 0 },
    measurements: [{ coverage: 0.9 }, { coverage: 0.99 }],
  },
  {
    id: "bm-08",
    create: (channel) =>
      createBm08Session("visible-camera", bm08Example as PreparedBm08Example, channel),
    host: (send) => createBm08Host(send, bm08Example.sourceDigest),
    parameters: { ...bm08Example.parameters, M: 4, coverageTrials: 0 },
    measurements: [{ sigma: 1e-7 }, { sigma: 3e-7 }],
  },
  {
    id: "lq-01",
    create: (channel) =>
      createLq01Session("visible-wave", lq01Example as PreparedLq01Example, channel),
    host: (send) => createLq01Host(send, lq01Example.sourceDigest),
    parameters: { ...lq01Example.parameters },
    measurements: [{ delta: Math.PI / 2 }, { delta: Math.PI }],
  },
  {
    id: "sr-03",
    create: (channel) =>
      createSr03Session("visible-rod", sr03Example as PreparedSr03Example, channel),
    host: (send) => createSr03Host(send, sr03Example.sourceDigest),
    parameters: { ...sr03Example.parameters },
    measurements: [{ measuringFrame: "k" }, { endpointPairId: "frame-simultaneous" }],
  },
];

/** Real owners and codecs; only browser events and transport timing are controlled here. */
function laboratory(spec: Case, hold = false) {
  let creations = 0;
  let disposals = 0;
  const messages: unknown[] = [];
  const deliveries: (() => void)[] = [];
  const session = spec.create(() => {
    creations++;
    let listener: ((message: unknown) => void) | undefined;
    const host = spec.host((message) => {
      const deliver = () => listener?.(structuredClone(message));
      if (hold && (message as { messageKind: string }).messageKind === "result") {
        deliveries.push(deliver);
      } else deliver();
    });
    return {
      send(message) {
        messages.push(structuredClone(message));
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
  });
  return {
    session,
    messages,
    get creations() {
      return creations;
    },
    get disposals() {
      return disposals;
    },
    get held() {
      return deliveries.length;
    },
    release() {
      hold = false;
      for (const deliver of deliveries.splice(0)) deliver();
    },
  };
}

function visibility(session: VisibilityControlledSession) {
  let emit: ((intersecting: boolean) => void) | undefined;
  let disconnected = false;
  let state = "visible";
  const bounds: DOMRectReadOnly = {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    top: 0,
    right: 1,
    bottom: 1,
    left: 0,
    toJSON: () => ({ x: 0, y: 0, width: 1, height: 1 }),
  };
  const document = Object.assign(new EventTarget(), {
    get visibilityState() {
      return state;
    },
  });
  const view = Object.assign(new EventTarget(), {
    IntersectionObserver: class {
      constructor(callback: IntersectionObserverCallback) {
        emit = (intersecting) =>
          callback(
            [
              {
                target: element,
                isIntersecting: intersecting,
                boundingClientRect: bounds,
                intersectionRect: bounds,
                intersectionRatio: intersecting ? 1 : 0,
                rootBounds: null,
                time: 0,
              },
            ],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    },
  });
  Object.defineProperty(document, "visibilityState", { get: () => state });
  Object.assign(document, { defaultView: view });
  const element = { ownerDocument: document, dataset: {} } as unknown as HTMLElement;
  const cleanup = bindLaboratoryVisibility(element, session);
  return {
    cleanup,
    element,
    intersect: (value: boolean) => emit?.(value),
    documentVisible(value: boolean) {
      state = value ? "visible" : "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    },
    page: (event: "pagehide" | "pageshow") => view.dispatchEvent(new Event(event)),
    get disconnected() {
      return disconnected;
    },
  };
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(check(), "The real host must settle within the bounded wait.");
}
async function settled(session: Session) {
  await until(() => !session.getSnapshot().pending);
  expect(session.getSnapshot().status).toBe("accepted");
}
function accepted(session: Session): AcceptedSnapshot {
  const snapshot = session.getSnapshot().accepted;
  assert.ok(snapshot);
  return snapshot;
}
function values(snapshot: AcceptedSnapshot) {
  return snapshot.outputs.map((output) => {
    if (output.status === "value" && typeof output.value === "object" && "copy" in output.value) {
      return { ...output, value: Array.from(output.value.copy()) };
    }
    return output;
  });
}
function apply(session: Session, input: unknown) {
  expect(session.apply(input).kind).toBe("accepted");
}

for (const spec of cases) {
  test(`${spec.id}: visible work dispatches; hidden requests coalesce and resume the queued scientific request`, async () => {
    const lab = laboratory(spec);
    const control = laboratory(spec);
    const visible = visibility(lab.session);
    try {
      expect(lab.creations).toBe(0);
      visible.intersect(true);
      apply(lab.session, spec.parameters);
      await settled(lab.session);
      expect(lab.messages.length).toBeGreaterThan(0); // Positive control before the hidden zero.
      const before = accepted(lab.session);
      const messagesBefore = lab.messages.length;
      visible.intersect(false);
      for (const measurement of spec.measurements)
        apply(lab.session, { ...spec.parameters, ...measurement });
      expect(lab.session.getSnapshot().pending).toBe(true);
      expect(lab.messages.length).toBe(messagesBefore);
      expect(accepted(lab.session)).toBe(before);
      expect(lab.disposals).toBe(0);
      const queued = lab.session.getSnapshot().requested;
      assert.ok(queued);
      if (spec.id === "bm-04") {
        // Changing the force at time zero forks an already evolved diffusion history.
        expect(before.simulationTime).toBeGreaterThan(0);
        expect(queued.runId).not.toBe(before.runId);
        expect(queued.parentRunId).toBe(before.runId);
      } else {
        expect(queued.runId).toBe(before.runId);
      }
      visible.intersect(true);
      await settled(lab.session);
      const resumed = accepted(lab.session);
      expect(resumed.runId).toBe(queued.runId);
      expect(resumed.parentRunId).toBe(queued.parentRunId);
      expect(resumed.actionIndex).toBe(queued.actionIndex);
      expect(resumed.revisions).toEqual(queued.revisions);
      expect(resumed.parameters).toEqual(queued.parameters);
      expect(resumed.stepIndex).toBe(before.stepIndex);
      expect(resumed.simulationTime).toBe(before.simulationTime);
      expect(resumed.parameters.seed).toBe(before.parameters.seed);
      expect(lab.messages.length).toBe(messagesBefore + 1);
      expect(lab.creations).toBe(1);
      // The same accepted values as an uninterrupted owner, including all trajectory arrays.
      apply(control.session, spec.parameters);
      await settled(control.session);
      apply(control.session, { ...spec.parameters, ...spec.measurements.at(-1) });
      await settled(control.session);
      expect(values(resumed)).toEqual(values(accepted(control.session)));
      logger.log({
        testId: `${spec.id}-resume`,
        instrumentId: spec.id,
        outcome: "passed",
        message: `Visible messages ${messagesBefore}; hidden messages 0; resumed the queued scientific request on the same worker.`,
      });
    } finally {
      visible.cleanup();
      lab.session.disconnect();
      control.session.disconnect();
    }
  }, 60000);
}

for (const spec of cases) {
  test(`${spec.id}: before the first measurement and during page/document suspension no worker starts`, async () => {
    const lab = laboratory(spec);
    const visible = visibility(lab.session);
    try {
      apply(lab.session, spec.parameters);
      expect(lab.creations).toBe(0);
      visible.documentVisible(false);
      visible.intersect(true);
      expect(lab.creations).toBe(0);
      visible.page("pagehide");
      visible.documentVisible(true);
      expect(lab.creations).toBe(0);
      visible.page("pageshow");
      await settled(lab.session);
      expect(lab.creations).toBe(1);
      visible.intersect(false);
      apply(lab.session, { ...spec.parameters, ...spec.measurements[0] });
      const count = lab.messages.length;
      visible.cleanup();
      expect(visible.disconnected).toBe(true);
      visible.intersect(true); // Already queued observer callbacks after teardown are harmless.
      visible.page("pageshow");
      expect(lab.messages.length).toBe(count);
    } finally {
      visible.cleanup();
      lab.session.disconnect();
    }
  }, 60000);

  test(`${spec.id}: an in-flight result can finish while hidden, and Stop discards the queued request`, async () => {
    const lab = laboratory(spec, true);
    const visible = visibility(lab.session);
    try {
      visible.intersect(true);
      apply(lab.session, spec.parameters);
      await until(() => lab.held > 0);
      visible.intersect(false);
      lab.release();
      expect(lab.session.getSnapshot().pending).toBe(false);
      const before = accepted(lab.session);
      apply(lab.session, { ...spec.parameters, ...spec.measurements[0] });
      expect(lab.messages.length).toBe(1);
      expect(accepted(lab.session)).toBe(before);
      lab.session.stop();
      visible.intersect(true);
      expect(lab.messages.length).toBe(1); // Explicit Stop discards the queue permanently.
      expect(accepted(lab.session)).toBe(before);
    } finally {
      visible.cleanup();
      lab.session.disconnect();
    }
  }, 60000);
}

for (const spec of cases.filter((entry) => entry.id === "lq-01" || entry.id === "sr-03")) {
  test(`${spec.id}: explicit new runs also wait for visibility without replacing the accepted result`, async () => {
    const lab = laboratory(spec);
    const visible = visibility(lab.session);
    try {
      const start = lab.session.startNewRun;
      assert.ok(start);
      const before = accepted(lab.session);
      expect(start(spec.parameters).kind).toBe("accepted");
      expect(lab.creations).toBe(0);
      expect(accepted(lab.session)).toBe(before);
      visible.intersect(true);
      await settled(lab.session);
      expect(lab.creations).toBe(1);
      expect(lab.messages.length).toBe(1);
      const first = accepted(lab.session);
      expect(first.runId).not.toBe(before.runId);
      visible.intersect(false);
      expect(start(spec.parameters).kind).toBe("accepted");
      expect(lab.messages.length).toBe(1);
      expect(accepted(lab.session)).toBe(first);
      visible.intersect(true);
      await settled(lab.session);
      expect(lab.creations).toBe(1);
      expect(lab.messages.length).toBe(2);
      expect(accepted(lab.session).runId).not.toBe(first.runId);
    } finally {
      visible.cleanup();
      lab.session.disconnect();
    }
  }, 60000);
}

test("the controlled camera comparison pauses its actual owner and retains the baseline recording", async () => {
  let creations = 0;
  let requests = 0;
  let disposals = 0;
  const controller = createBm08ComparisonSession(
    "visible-camera-comparison",
    bm08Example as PreparedBm08Example,
    () => {
      creations++;
      let listener: ((message: unknown) => void) | undefined;
      const host = createBm08Host(
        (message) => listener?.(structuredClone(message)),
        bm08Example.sourceDigest,
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
    },
  );
  controller.connect();
  const visible = visibility(controller);
  try {
    const prepared = controller.getSnapshot().variantSnapshot;
    expect(controller.start()).toBe(true);
    expect(creations).toBe(0);
    expect(controller.getSnapshot().variantSnapshot).toBe(prepared);
    visible.intersect(true);
    await until(() => !controller.getSnapshot().pending);
    const baseline = controller.getSnapshot().baselineSnapshot;
    expect(controller.getSnapshot().phase).toBe("live");
    expect(controller.getSnapshot().error).toBe("");
    expect(requests).toBe(1);
    expect(creations).toBe(1);
    visible.intersect(false);
    const sigma = baseline.parameters.sigma === 0 ? 1e-7 : 0;
    expect(controller.apply({ ...baseline.parameters, sigma })).toBe(true);
    expect(controller.getSnapshot().pending).toBe(true);
    expect(controller.getSnapshot().baselineSnapshot).toBe(baseline);
    expect(controller.getSnapshot().variantSnapshot).toBe(baseline);
    expect(requests).toBe(1);
    expect(disposals).toBe(0);
    visible.intersect(true);
    await until(() => !controller.getSnapshot().pending);
    expect(requests).toBe(2);
    expect(creations).toBe(1);
    expect(controller.getSnapshot().error).toBe("");
    expect(controller.getSnapshot().result.kind).toBe("accepted");
    expect(controller.getSnapshot().baselineSnapshot).toBe(baseline);
    expect(controller.getSnapshot().variantSnapshot.runId).toBe(baseline.runId);
    expect(controller.getSnapshot().variantSnapshot.parameters.sigma).toBe(sigma);
  } finally {
    visible.cleanup();
    controller.disconnect();
  }
  expect(disposals).toBe(1);
}, 60000);
