import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { KitchenLab } from "../components/lab/kitchen/KitchenLab.tsx";
import { exportKitchenCsv, parseKitchenCsv } from "../experiments/bm07/kitchen/csv.ts";
import type { KitchenOptions } from "../experiments/bm07/kitchen/definition.ts";
import { createKitchenHost } from "../experiments/bm07/kitchen/host.ts";
import { KITCHEN_STORAGE_NAMESPACE } from "../experiments/bm07/kitchen/kitchenStorage.ts";
import type { KitchenRequest } from "../experiments/bm07/kitchen/protocol.ts";
import { createKitchenSession } from "../experiments/bm07/kitchen/session.ts";
import {
  captureKitchenSession,
  kitchenSessionJson,
  readKitchenSessionFile,
} from "../experiments/bm07/kitchen/sessionFile.ts";
import { createWorkerAdmission } from "../workers/scheduler/admission.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

const practice = { csv: kitchenFixture(), sourceDigest: `source:sha256:${"a".repeat(64)}` };
const chosen: KitchenOptions = {
  track: JSON.stringify(["second-particle", 0]),
  axis: "y",
  coverage: 0.9,
  constantSet: "modern-si-2019",
};
let root: Root | null = null;
let container: HTMLElement;
let workers: HostWorker[];
let workerDescriptor: PropertyDescriptor | undefined;
let createUrlDescriptor: PropertyDescriptor | undefined;
let revokeUrlDescriptor: PropertyDescriptor | undefined;
let clickDescriptor: PropertyDescriptor | undefined;
let blobs: Map<string, Blob>;
let downloads: { name: string; href: string }[];

/** Actual browser channel and kitchen owner, with only response delivery under test control. */
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
  postMessage(message: unknown) { this.requests.push(structuredClone(message) as KitchenRequest); }
  addEventListener(type: string, listener: (event: { data: unknown }) => void) {
    if (type === "message") this.listeners.add(listener);
  }
  removeEventListener(type: string, listener: (event: { data: unknown }) => void) {
    if (type === "message") this.listeners.delete(listener);
  }
  terminate() { this.disposed = true; this.host.dispose(); }
  async completeNext() {
    const request = this.requests[this.completed++];
    assert.ok(request, "The real browser channel must dispatch an analysis request.");
    await this.host.receive(request);
  }
}

beforeEach(async () => {
  await installDom({ intersections: "visible" });
  Object.defineProperty(window, "__AM_APP__", { configurable: true, value: { visibility: "visible" } });
  workers = [];
  blobs = new Map();
  downloads = [];
  workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  createUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  revokeUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  clickDescriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "click");
  Object.defineProperty(globalThis, "Worker", { configurable: true, writable: true, value: HostWorker });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true, writable: true,
    value: (blob: Blob) => {
      const href = `blob:kitchen-session-test-${blobs.size}`;
      blobs.set(href, blob);
      return href;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: () => {} });
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true, writable: true,
    value: function (this: HTMLAnchorElement) { downloads.push({ name: this.download, href: this.href }); },
  });
  container = createContainer();
  root = createRoot(container);
});
function restore(object: object, key: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(object, key, descriptor);
  else Reflect.deleteProperty(object, key);
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  for (const worker of workers) worker.terminate();
  restore(globalThis, "Worker", workerDescriptor);
  restore(URL, "createObjectURL", createUrlDescriptor);
  restore(URL, "revokeObjectURL", revokeUrlDescriptor);
  restore(HTMLAnchorElement.prototype, "click", clickDescriptor);
  removeContainer(container);
  await uninstallDom();
});

function button(label: string) {
  const found = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  assert.ok(found, `The kitchen control "${label}" must exist.`);
  return found;
}
async function click(label: string) {
  await act(async () => { button(label).click(); });
}
async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 200 && !predicate(); attempt++)
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 5)); });
  expect(predicate()).toBe(true);
}
function element() {
  const found = container.querySelector<HTMLElement>('[data-instrument-id="bm-07-kitchen"]');
  assert.ok(found);
  return found;
}
function identity() {
  const node = element();
  return {
    instance: node.dataset.instanceId,
    run: node.dataset.runId,
    version: node.dataset.snapshotVersion,
    document: node.dataset.documentDigest,
  };
}
function results() {
  const table = [...container.querySelectorAll("table")].find(
    (node) => node.caption?.textContent === "Diffusion and camera-error estimates from accepted inputs",
  );
  assert.ok(table, "The current accepted inference table must remain readable.");
  return table.textContent;
}
async function mount() {
  await act(async () => { root?.render(<KitchenLab practice={practice} />); });
}
async function remount() {
  await act(async () => { root?.unmount(); });
  root = createRoot(container);
  await mount();
}
async function chooseFile(file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"][accept=".json,application/json"]');
  assert.ok(input);
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function analyzePractice() {
  await click("Analyze synthetic practice data");
  await until(() => workers.some((worker) => !worker.disposed && worker.requests.length > 0));
  const worker = workers.at(-1);
  assert.ok(worker);
  await act(async () => { await worker.completeNext(); });
  return worker;
}
async function fixtureSession() {
  const document = parseKitchenCsv(practice.csv);
  const csv = exportKitchenCsv({
    ...document,
    points: [
      ...document.points,
      ...document.points.filter((point) => point.kind === "particle").map((point) => ({
        ...point, objectId: "second-particle",
      })),
    ],
  });
  let listener: ((message: unknown) => void) | null = null;
  const host = createKitchenHost((message) => listener?.(structuredClone(message)), practice.sourceDigest);
  const session = createKitchenSession("saved-kitchen-fixture", () => ({
    listen(fn) { listener = fn; return () => { listener = null; }; },
    send(message) { void host.receive(structuredClone(message)); },
    dispose() { host.dispose(); },
  }), practice.sourceDigest, createWorkerAdmission(1));
  try {
    expect(await session.submit(csv, chosen)).toBe(true);
    await until(() => session.getSnapshot().accepted !== null);
    const accepted = session.getSnapshot().accepted;
    assert.ok(accepted);
    return await captureKitchenSession(accepted, practice.sourceDigest);
  } finally {
    session.disconnect();
  }
}

test("accepted choices survive keeping, reloading and a real downloaded-session import despite unfinished control edits", async () => {
  const saved = await fixtureSession();
  localStorage.setItem(KITCHEN_STORAGE_NAMESPACE, kitchenSessionJson(saved));
  await mount();
  expect(workers).toHaveLength(0);
  await click("Preview kept session");
  await until(() => container.querySelector("[data-kitchen-session-preview]") !== null);
  expect(workers).toHaveLength(0);
  expect(container.textContent).toContain("second-particle");
  await click("Analyze saved session");
  await until(() => workers.length === 1);
  const first = workers[0];
  assert.ok(first);
  expect(first.requests[0]?.token.parameters).toMatchObject(chosen);
  await act(async () => { await first.completeNext(); });
  const before = results();

  // A draft coordinate is deliberately different from the accepted choice.
  const axis = container.querySelector<HTMLSelectElement>('select[name="axis"]');
  assert.ok(axis);
  await act(async () => {
    axis.value = "x";
    axis.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(first.requests).toHaveLength(1);
  expect(results()).toBe(before);
  await click("Keep accepted session on this device");
  await until(() => (container.textContent ?? "").includes("and their accepted analysis choices"));
  const kept = JSON.parse(localStorage.getItem(KITCHEN_STORAGE_NAMESPACE) ?? "null");
  expect(kept.options).toEqual(chosen);
  expect(kept.csv).toBe(saved.csv);
  expect(kept.origin.documentDigest).toBe(saved.origin?.documentDigest);

  await click("Export resumable session");
  await until(() => downloads.some((download) => download.name === "local-observation-session.json"));
  const download = downloads.find((item) => item.name === "local-observation-session.json");
  assert.ok(download);
  expect(download.href.startsWith("blob:")).toBe(true);
  const blob = blobs.get(download.href);
  assert.ok(blob);
  const downloaded = await blob.text();
  const exported = await readKitchenSessionFile(downloaded, practice.sourceDigest);
  expect(exported.session.options).toEqual(chosen);
  expect(exported.session.csv).toBe(saved.csv);

  await remount();
  expect(first.disposed).toBe(true);
  expect(workers).toHaveLength(1);
  await click("Preview kept session");
  await until(() => container.querySelector("[data-kitchen-session-preview]") !== null);
  expect(workers).toHaveLength(1);
  await click("Analyze saved session");
  await until(() => workers.length === 2);
  const second = workers[1];
  assert.ok(second);
  expect(second.requests[0]?.token.parameters).toMatchObject(chosen);
  await act(async () => { await second.completeNext(); });
  expect(results()).toBe(before);

  // Import the actual bytes created by the mounted export control.
  await chooseFile(new File([downloaded], "local-observation-session.json", { type: "application/json" }));
  const acceptedIdentity = identity();
  await click("Preview selected session");
  await until(() => container.querySelector("[data-kitchen-session-preview]") !== null);
  expect(second.requests).toHaveLength(1);
  expect(identity()).toEqual(acceptedIdentity);
  await click("Analyze saved session");
  await until(() => second.requests.length === 2);
  expect(identity()).toEqual(acceptedIdentity);
  expect(results()).toBe(before);
  expect(second.requests[1]?.token.parameters).toMatchObject(chosen);
  await act(async () => { await second.completeNext(); });
  expect(results()).toBe(before);
});

test("malformed and changed-evaluator files preserve accepted results until a separate confirmation succeeds", async () => {
  const saved = await fixtureSession();
  await mount();
  const worker = await analyzePractice();
  const before = identity();
  const table = results();
  await chooseFile(new File(["{broken"], "invalid.json", { type: "application/json" }));
  await click("Preview selected session");
  await until(() => container.querySelector('[role="alert"]') !== null);
  expect(identity()).toEqual(before);
  expect(results()).toBe(table);
  expect(worker.requests).toHaveLength(1);

  const changed = {
    ...saved,
    origin: { ...saved.origin, sourceDigest: `source:sha256:${"b".repeat(64)}` },
  };
  await chooseFile(new File([JSON.stringify(changed)], "older-evaluator.json", { type: "application/json" }));
  await click("Preview selected session");
  await until(() => container.querySelector('[data-kitchen-session-preview="changed-evaluator"]') !== null);
  expect(container.textContent).toContain("The evaluator has changed");
  expect(identity()).toEqual(before);
  expect(results()).toBe(table);
  expect(worker.requests).toHaveLength(1);
  await click("Analyze saved session");
  await until(() => worker.requests.length === 2);
  expect(identity()).toEqual(before);
  expect(results()).toBe(table);
  expect(worker.requests[1]?.sourceDigest).toBe(practice.sourceDigest);
  expect(worker.requests[1]?.token.parameters).toMatchObject(chosen);
  await act(async () => { await worker.completeNext(); });
  expect(identity().document).toBe(saved.origin?.documentDigest);
});

for (const action of ["stop", "clear"] as const) {
  test(`${action} cancels a deferred session file read without late previews or analysis`, async () => {
    await mount();
    const worker = await analyzePractice();
    const before = identity();
    const legacy = JSON.stringify({
      schemaVersion: 1,
      csv: practice.csv,
      rows: parseKitchenCsv(practice.csv).points.length,
    });
    let release: (text: string) => void = () => {};
    const pending = new Promise<string>((resolve) => { release = resolve; });
    const file = new File([], "deferred-session.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: () => pending });
    await chooseFile(file);
    await click("Preview selected session");
    expect(element().dataset.pending).toBe("true");
    if (action === "stop") await click("Stop local analysis");
    else {
      await click("Clear local observations");
      await click("Confirm clear this laboratory");
    }
    await act(async () => { release(legacy); await pending; });
    expect(container.querySelector("[data-kitchen-session-preview]")).toBeNull();
    expect(worker.requests).toHaveLength(1);
    expect(element().dataset.pending).toBe("false");
    if (action === "stop") expect(identity()).toEqual(before);
    else expect(element().dataset.documentDigest).toBe("");
  });
}
