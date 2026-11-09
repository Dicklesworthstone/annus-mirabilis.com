import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { KitchenLab } from "../components/lab/kitchen/KitchenLab.tsx";
import { createKitchenHost } from "../experiments/bm07/kitchen/host.ts";
import type { KitchenRequest } from "../experiments/bm07/kitchen/protocol.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";
import {
  createContainer,
  emitTestIntersection,
  installDom,
  observedTestIntersections,
  removeContainer,
  uninstallDom,
} from "./reactDom.ts";

const practice = { csv: kitchenFixture(), sourceDigest: `source:sha256:${"a".repeat(64)}` };
let root: Root | null = null;
let container: HTMLElement;
let workerDescriptor: PropertyDescriptor | undefined;
let workers: HostWorker[];
let app: { visibility: "visible" | "hidden" };

/** The browser channel stays real; only delivery timing is controlled around the real owner. */
class HostWorker {
  readonly requests: KitchenRequest[] = [];
  readonly listeners = new Set<(event: { data: unknown }) => void>();
  readonly host;
  private completed = 0;
  disposed = false;
  constructor() {
    workers.push(this);
    this.host = createKitchenHost((message) => {
      for (const listener of this.listeners) listener({ data: structuredClone(message) });
    }, practice.sourceDigest);
  }
  postMessage(message: unknown) {
    this.requests.push(structuredClone(message) as KitchenRequest);
  }
  addEventListener(type: string, listener: (event: { data: unknown }) => void) {
    if (type === "message") this.listeners.add(listener);
  }
  removeEventListener(type: string, listener: (event: { data: unknown }) => void) {
    if (type === "message") this.listeners.delete(listener);
  }
  terminate() {
    this.disposed = true;
    this.host.dispose();
  }
  async completeNext() {
    const request = this.requests[this.completed++];
    if (!request) throw new Error("The mounted kitchen must dispatch a request first.");
    await this.host.receive(request);
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

function nativeVisibility(state: "visible" | "hidden") {
  app.visibility = state;
  window.dispatchEvent(new CustomEvent("am-app:lifecycle.visibility", { detail: { state } }));
}
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find((b) => b.textContent === label);
  if (!found) throw new Error(`The kitchen control "${label}" must exist.`);
  return found;
}
function identity(element: HTMLElement) {
  return {
    instance: element.dataset.instanceId,
    run: element.dataset.runId,
    version: element.dataset.snapshotVersion,
    document: element.dataset.documentDigest,
  };
}
async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 200 && !predicate(); attempt++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  expect(predicate()).toBe(true);
}
async function mount() {
  await act(async () =>
    root?.render(
      <StrictMode>
        <KitchenLab practice={practice} />
      </StrictMode>,
    ),
  );
  const element = container.querySelector<HTMLElement>('[data-instrument-id="bm-07-kitchen"]');
  if (!element) throw new Error("The kitchen must render its laboratory section.");
  expect(observedTestIntersections()).toContain(element);
  await act(async () => {
    expect(emitTestIntersection(element, true)).toBe(1);
  });
  return element;
}

test("the mounted kitchen retains one owner across native visibility changes and StrictMode cleanup", async () => {
  const element = await mount();
  expect(element.dataset.labVisibility).toBe("document-hidden");
  await act(async () => button("Analyze synthetic practice data").click());
  expect(element.dataset.pending).toBe("true");
  expect(workers).toHaveLength(0);
  await act(async () => nativeVisibility("visible"));
  await until(() => workers.length === 1);
  const worker = workers[0];
  if (!worker) throw new Error("The browser channel must create an analysis owner.");
  expect(worker.requests).toHaveLength(1);
  await act(async () => {
    nativeVisibility("hidden");
    await worker.completeNext();
  });
  expect(element.dataset.pending).toBe("false");
  expect(element.dataset.documentDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(container.textContent).toContain("Analysis accepted.");
  const accepted = identity(element);
  await act(async () => button("Reanalyze accepted observations").click());
  expect(element.dataset.pending).toBe("true");
  expect(identity(element)).toEqual(accepted);
  expect(worker.requests).toHaveLength(1);
  expect(worker.disposed).toBe(false);
  await act(async () => nativeVisibility("visible"));
  await until(() => worker.requests.length === 2);
  await act(async () => worker.completeNext());
  expect(element.dataset.pending).toBe("false");
  expect(element.dataset.runId).toBe(accepted.run);
  expect(element.dataset.snapshotVersion).not.toBe(accepted.version);
  expect(workers).toHaveLength(1);

  await act(async () => root?.unmount());
  root = null;
  expect(worker.disposed).toBe(true);
  expect(worker.listeners.size).toBe(0);
  expect(observedTestIntersections()).not.toContain(element);
  expect(emitTestIntersection(element, true)).toBe(0);
  nativeVisibility("visible");
  expect(worker.requests).toHaveLength(2);
});

test("the mounted kitchen stops hidden analysis and unmount cannot restart deferred work", async () => {
  app.visibility = "visible";
  const element = await mount();
  await act(async () => button("Analyze synthetic practice data").click());
  await until(() => workers.length === 1);
  const worker = workers[0];
  if (!worker) throw new Error("The browser channel must create an analysis owner.");
  await act(async () => worker.completeNext());
  const accepted = identity(element);
  await act(async () => {
    emitTestIntersection(element, false);
    button("Reanalyze accepted observations").click();
  });
  expect(element.dataset.labVisibility).toBe("off-screen");
  expect(element.dataset.pending).toBe("true");
  await act(async () => button("Stop local analysis").click());
  await act(async () => {
    emitTestIntersection(element, true);
  });
  expect(element.dataset.pending).toBe("false");
  expect(identity(element)).toEqual(accepted);
  expect(worker.disposed).toBe(true);
  expect(worker.requests).toHaveLength(1);

  await act(async () => {
    emitTestIntersection(element, false);
    button("Reanalyze accepted observations").click();
  });
  await act(async () => root?.unmount());
  root = null;
  expect(emitTestIntersection(element, true)).toBe(0);
  nativeVisibility("visible");
  expect(workers).toHaveLength(1);
  expect(worker.requests).toHaveLength(1);
});
