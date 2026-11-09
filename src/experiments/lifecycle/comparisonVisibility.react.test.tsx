import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrownianInvestigation } from "../../components/discover/BrownianInvestigation.tsx";
import { BrownianComparisonLab } from "../../components/lab/BrownianComparisonLab.tsx";
import preparedComparison from "../../generated/bm01-comparison.json";
import spreadExample from "../../generated/bm06-example.json";
import { bm01Laboratory, bm01ReplayFixture } from "../../testing/bm01ReplayHarness.ts";
import {
  createContainer,
  emitTestIntersection,
  installDom,
  observedTestIntersections,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createBm01Host } from "../../workers/host/bm01Host.ts";
import type { LabRequest, LabResponse } from "../../workers/protocol/bm01.ts";
import type { Bm01Parameters } from "../bm01/definition.ts";
import type { PreparedBm01Example } from "../bm01/session.ts";
import type { PreparedBm06Example } from "../bm06/session.ts";
import { encodeResult } from "../results/codec.ts";

const fixture = await bm01ReplayFixture();
/** Prepare small worked examples through the real owner, without relabeling larger results. */
async function prepare(parameters: Bm01Parameters): Promise<PreparedBm01Example> {
  const lab = bm01Laboratory(fixture);
  try {
    const requested = lab.session.apply(parameters);
    if (requested.kind !== "accepted") throw new Error("The fixture request must be admitted.");
    const channel = await lab.channel(0);
    await channel.result;
    const response = channel.results[0];
    if (response?.result.kind !== "accepted" || lab.session.getSnapshot().status !== "accepted")
      throw new Error("The fixture must contain a completed result from the actual owner.");
    return {
      ...fixture.example,
      parameters,
      results: response.result.data.outputs.map(encodeResult),
      stepIndex: response.result.data.stepIndex,
      simulationTime: response.result.data.simulationTime,
    };
  } finally {
    lab.session.disconnect();
  }
}
const baseline = await prepare({ ...fixture.example.parameters, interval: 0.2 });
const comparison = {
  ...preparedComparison,
  baseline,
  doubledRadius: await prepare({ ...baseline.parameters, a: baseline.parameters.a * 2 }),
};

let root: Root | null = null;
let container: HTMLElement;
let workerDescriptor: PropertyDescriptor | undefined;
let workers: HostWorker[];
let app: { visibility: "visible" | "hidden" };

/** Browser transport substitute only: the pinned recorder and production host own every result. */
class HostWorker {
  readonly requests: LabRequest[] = [];
  readonly responses: LabResponse[] = [];
  readonly errors: unknown[] = [];
  readonly listeners = new Map<string, Set<(event: { data: unknown }) => void>>();
  readonly host;
  disposed = false;
  constructor(url: URL) {
    if (!url.pathname.endsWith("/bm01Worker.ts"))
      throw new Error("The spreading laboratory must not start during these tracer actions.");
    workers.push(this);
    this.host = createBm01Host(
      (message) => {
        if (message.messageKind === "result") this.responses.push(structuredClone(message));
        this.deliver("message", message);
      },
      fixture.sourceDigest,
      fixture.recorder,
    );
    queueMicrotask(() => this.host.hello());
  }
  private deliver(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? [])
      listener({ data: structuredClone(data) });
  }
  postMessage(message: unknown) {
    if (
      message &&
      typeof message === "object" &&
      "messageKind" in message &&
      message.messageKind === "request"
    )
      this.requests.push(structuredClone(message) as LabRequest);
    void this.host.receive(structuredClone(message)).catch((error) => {
      this.errors.push(error);
      this.deliver("error", error);
    });
  }
  addEventListener(type: string, listener: (event: { data: unknown }) => void) {
    const entries = this.listeners.get(type) ?? new Set();
    entries.add(listener);
    this.listeners.set(type, entries);
  }
  removeEventListener(type: string, listener: (event: { data: unknown }) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  terminate() {
    this.disposed = true;
    this.host.dispose();
  }
}

beforeEach(async () => {
  await installDom({ intersections: "manual" });
  workers = [];
  app = { visibility: "hidden" };
  Object.defineProperty(window, "__AM_APP__", { configurable: true, value: app });
  workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    writable: true,
    value: HostWorker,
  });
  container = createContainer();
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  for (const worker of workers) worker.terminate();
  if (workerDescriptor) Object.defineProperty(globalThis, "Worker", workerDescriptor);
  else Reflect.deleteProperty(globalThis, "Worker");
  removeContainer(container);
  await uninstallDom();
});

function element<T extends Element = HTMLElement>(selector: string): T {
  const found = container.querySelector<T>(selector);
  if (!found) throw new Error(`The mounted laboratory must render ${selector}.`);
  return found;
}
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(
    (entry) => entry.textContent?.trim() === label,
  );
  if (!found) throw new Error(`The mounted laboratory must offer "${label}".`);
  expect(found.disabled).toBe(false);
  return found;
}
function nativeVisibility(state: "visible" | "hidden") {
  app.visibility = state;
  window.dispatchEvent(new CustomEvent("am-app:lifecycle.visibility", { detail: { state } }));
}
async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 200 && !check(); attempt++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  expect(check()).toBe(true);
}
function owner() {
  expect(workers).toHaveLength(1);
  const worker = workers[0];
  if (!worker) throw new Error("A visible request must create the real recording owner.");
  expect(worker.errors).toEqual([]);
  return worker;
}
function acceptedPair() {
  const results = element("[data-comparison-results]");
  return {
    baseline: results.dataset.baselineRunId,
    variant: results.dataset.variantRunId,
    baselineVersion: results.dataset.baselineSnapshot,
    variantVersion: results.dataset.variantSnapshot,
  };
}
function acceptedTrial() {
  const tracer = element('[data-instrument-id="bm-01"]');
  return { run: tracer.dataset.runId, version: tracer.dataset.snapshotVersion };
}
function confirmsReuse(worker: HostWorker) {
  const response = worker.responses.at(-1);
  expect(response?.result.kind).toBe("accepted");
  if (response?.result.kind !== "accepted") throw new Error("A measurement must be accepted.");
  const reused = response.result.data.outputs.find(
    (output) => output.quantityId === "reusedRecording",
  );
  expect(reused?.status === "value" && reused.value).toBe(1);
}
async function unmountHidden(region: HTMLElement, worker: HostWorker, requestCount: number) {
  await act(async () => root?.unmount());
  root = null;
  expect(worker.disposed).toBe(true);
  expect([...worker.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  expect(observedTestIntersections()).not.toContain(region);
  expect(emitTestIntersection(region, true)).toBe(0);
  await act(async () => nativeVisibility("visible"));
  expect(worker.requests).toHaveLength(requestCount);
  expect(workers).toHaveLength(1);
}

test("the controlled Brownian comparison defers native-hidden work and retains its accepted pair across resume", async () => {
  await act(async () =>
    root?.render(
      <StrictMode>
        <BrownianComparisonLab example={comparison} />
      </StrictMode>,
    ),
  );
  const region = element("[data-controlled-comparison]");
  expect(observedTestIntersections()).toContain(region);
  await act(async () => {
    expect(emitTestIntersection(region, true)).toBe(1);
    button("Start live comparison").click();
  });
  expect(region.dataset.labVisibility).toBe("document-hidden");
  expect(region.dataset.pending).toBe("true");
  expect(workers).toHaveLength(0);
  await act(async () => nativeVisibility("visible"));
  await until(
    () => region.dataset.comparisonPhase === "live" && region.dataset.pending === "false",
  );
  const worker = owner();
  expect(worker.requests).toHaveLength(1);
  const accepted = acceptedPair();
  expect(accepted.variant).toBe(accepted.baseline);
  const input = element<HTMLSelectElement>('select[id$="-input"]');
  await act(async () => {
    input.value = "interval";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    nativeVisibility("hidden");
  });
  await act(async () => button("Observe at four times the baseline interval").click());
  expect(region.dataset.pending).toBe("true");
  expect(acceptedPair()).toEqual(accepted);
  expect(worker.requests).toHaveLength(1);
  expect(worker.disposed).toBe(false);
  await act(async () => nativeVisibility("visible"));
  await until(() => region.dataset.pending === "false" && worker.requests.length === 2);
  expect(acceptedPair().baseline).toBe(accepted.baseline);
  expect(acceptedPair().variant).toBe(accepted.baseline);
  expect(acceptedPair().variantVersion).not.toBe(accepted.variantVersion);
  expect(worker.requests.at(-1)?.token.parameters.interval).toBe(0.8);
  confirmsReuse(worker);

  await act(async () => {
    nativeVisibility("hidden");
    button("Use twice the baseline value").click();
  });
  expect(region.dataset.pending).toBe("true");
  expect(worker.requests).toHaveLength(2);
  await unmountHidden(region, worker, 2);
});

test("the investigation observes its whole composition so lower interval controls resume the same accepted trial", async () => {
  await act(async () =>
    root?.render(
      <StrictMode>
        <BrownianInvestigation
          tracerExample={baseline}
          spreadExample={spreadExample as PreparedBm06Example}
        />
      </StrictMode>,
    ),
  );
  const region = element("[data-brownian-investigation]");
  const tracer = element('[data-instrument-id="bm-01"]');
  expect(observedTestIntersections()).toContain(region);
  expect(observedTestIntersections()).not.toContain(tracer);
  await act(async () => {
    expect(emitTestIntersection(region, true)).toBe(1);
    expect(emitTestIntersection(tracer, false)).toBe(0);
    button("Apply settings").click();
  });
  expect(region.dataset.labVisibility).toBe("document-hidden");
  expect(tracer.dataset.pending).toBe("true");
  expect(workers).toHaveLength(0);
  await act(async () => nativeVisibility("visible"));
  await until(() => tracer.dataset.pending === "false" && workers.length === 1);
  const worker = owner();
  expect(worker.requests).toHaveLength(1);
  await act(async () => button("Pin accepted result as baseline").click());
  const accepted = acceptedTrial();
  const fourTimes = button("Observe at four times the baseline interval");
  expect(tracer.contains(fourTimes)).toBe(false);
  expect(region.contains(fourTimes)).toBe(true);
  await act(async () => {
    nativeVisibility("hidden");
    fourTimes.click();
  });
  expect(tracer.dataset.pending).toBe("true");
  expect(acceptedTrial()).toEqual(accepted);
  expect(worker.requests).toHaveLength(1);
  await act(async () => nativeVisibility("visible"));
  await until(() => tracer.dataset.pending === "false" && worker.requests.length === 2);
  expect(acceptedTrial().run).toBe(accepted.run);
  expect(acceptedTrial().version).not.toBe(accepted.version);
  expect(worker.requests.at(-1)?.token.parameters.interval).toBe(0.8);
  confirmsReuse(worker);

  await act(async () => {
    nativeVisibility("hidden");
    button("Return to the baseline interval").click();
  });
  expect(tracer.dataset.pending).toBe("true");
  expect(worker.requests).toHaveLength(2);
  await unmountHidden(region, worker, 2);
});
