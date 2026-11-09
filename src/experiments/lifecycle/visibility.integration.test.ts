import { afterAll, expect, test } from "bun:test";
import assert from "node:assert/strict";
import bm01Example from "../../generated/bm01-example.json";
import bm05Example from "../../generated/bm05-example.json";
import bm06Example from "../../generated/bm06-example.json";
import { TestLogger } from "../../testing/log/logger.ts";
import { createBm01Host } from "../../workers/host/bm01Host.ts";
import { createBm05Host } from "../../workers/host/bm05Host.ts";
import { createBm06Host } from "../../workers/host/bm06Host.ts";
import type { WorkerChannel } from "../../workers/scheduler/scheduler.ts";
import { createBm01Session, type PreparedBm01Example } from "../bm01/session.ts";
import { createBm05Session, type PreparedBm05Example } from "../bm05/session.ts";
import { createBm06Session } from "../bm06/session.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { bindLaboratoryVisibility } from "./bindLaboratoryVisibility.ts";

const logger = new TestLogger("laboratory-visibility");
afterAll(() => logger.flush());
type Session = Pick<
  ReturnType<typeof createBm01Session>,
  "apply" | "getSnapshot" | "subscribe" | "setSchedulingPaused" | "disconnect" | "stop"
>;
type Host = ReturnType<typeof createBm01Host>;
type Case = {
  id: string;
  create(channel: () => WorkerChannel): Session;
  host(send: (message: unknown) => void): Host;
  parameters: Record<string, unknown>;
  measurements: readonly Record<string, number>[];
};
const cases: readonly Case[] = [
  {
    id: "bm-01",
    create: (channel) =>
      createBm01Session("visible-tracer", bm01Example as PreparedBm01Example, channel),
    host: (send) => createBm01Host(send, bm01Example.sourceDigest),
    parameters: { ...bm01Example.parameters, M: 4, H: 1, interval: 0.2 },
    measurements: [{ interval: 0.4 }, { interval: 0.6 }],
  },
  {
    id: "bm-05",
    create: (channel) =>
      createBm05Session("visible-walk", bm05Example as PreparedBm05Example, channel),
    host: (send) => createBm05Host(send, bm05Example.sourceDigest),
    parameters: { ...bm05Example.parameters, walkers: 20, runSteps: 16, n: 4 },
    measurements: [{ n: 8 }, { n: 12 }],
  },
  {
    id: "bm-06",
    create: (channel) => createBm06Session("visible-grid", bm06Example, channel),
    host: (send) => createBm06Host(send, bm06Example.sourceDigest),
    parameters: { ...bm06Example.parameters },
    measurements: [{ lower: -2e-6 }, { lower: -3e-6 }],
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

function visibility(session: Session) {
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
  test(`${spec.id}: visible work dispatches; hidden requests coalesce and resume the same scientific run`, async () => {
    const lab = laboratory(spec);
    const control = laboratory(spec);
    const visible = visibility(lab.session);
    try {
      expect(lab.creations).toBe(0);
      visible.intersect(true);
      apply(lab.session, spec.parameters);
      await until(() => !lab.session.getSnapshot().pending);
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
      visible.intersect(true);
      await until(() => !lab.session.getSnapshot().pending);
      const resumed = accepted(lab.session);
      expect(resumed.runId).toBe(before.runId);
      expect(resumed.stepIndex).toBe(before.stepIndex);
      expect(resumed.simulationTime).toBe(before.simulationTime);
      expect(resumed.parameters.seed).toBe(before.parameters.seed);
      expect(lab.messages.length).toBe(messagesBefore + 1);
      expect(lab.creations).toBe(1);
      // The same accepted values as an uninterrupted owner, including all trajectory arrays.
      apply(control.session, spec.parameters);
      await until(() => !control.session.getSnapshot().pending);
      apply(control.session, { ...spec.parameters, ...spec.measurements.at(-1) });
      await until(() => !control.session.getSnapshot().pending);
      expect(values(resumed)).toEqual(values(accepted(control.session)));
      logger.log({
        testId: `${spec.id}-resume`,
        instrumentId: spec.id,
        outcome: "passed",
        message: `Visible messages ${messagesBefore}; hidden messages 0; resumed on the same worker and run.`,
      });
    } finally {
      visible.cleanup();
      lab.session.disconnect();
      control.session.disconnect();
    }
  });
}

test("hidden before first action creates no worker; document and pagehide pauses compose and disposal does not resume", async () => {
  const spec = cases[0];
  assert.ok(spec);
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
    await until(() => !lab.session.getSnapshot().pending);
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
});

test("an in-flight result may finish while hidden, but the queued request cannot dispatch until resume", async () => {
  const spec = cases[0];
  assert.ok(spec);
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
});
