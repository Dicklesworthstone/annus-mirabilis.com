import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WaveDescriptionLab } from "../../components/lab/WaveDescriptionLab.tsx";
import { LQ01_DEFAULTS } from "../../experiments/lq01/definition.ts";
import type { PreparedLq01Example } from "../../experiments/lq01/session.ts";
import { createLq01TapeBinding } from "../../experiments/lq01/tape.ts";
import { encodeTapePermalink } from "../../experiments/permalink/codec.ts";
import { draftTapeForSettings } from "../../experiments/permalink/draftTape.ts";
import rawExample from "../../generated/lq01-example.json";
import { createLq01Host } from "../../workers/host/lq01Host.ts";
import { TestLogger } from "../log/logger.ts";
import { installDom, uninstallDom } from "../reactDom.ts";

const example = rawExample as unknown as PreparedLq01Example;
const logger = new TestLogger("lq01-walkthrough-form");
afterAll(() => logger.flush());
let root: Root | null = null;
let workerDescriptor: PropertyDescriptor | undefined;
let workers: HostWorker[];
let holdLive: boolean;

/** Browser transport substitute only: the production host validates and calculates every result. */
class HostWorker {
  readonly host;
  readonly listeners = new Set<(event: { data: unknown }) => void>();
  readonly deliveries: (() => void)[] = [];
  held: boolean;
  hasResult = false;
  disposed = false;
  constructor() {
    this.held = holdLive && workers.length === 1;
    workers.push(this);
    this.host = createLq01Host((message) => {
      const deliver = () => {
        for (const listener of this.listeners) listener({ data: structuredClone(message) });
      };
      if (message.messageKind === "result") {
        this.hasResult = true;
        if (this.held) {
          this.deliveries.push(deliver);
          return;
        }
      }
      deliver();
    }, example.sourceDigest);
    queueMicrotask(() => this.host.hello());
  }
  postMessage(message: unknown) {
    void this.host.receive(structuredClone(message));
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
    this.listeners.clear();
  }
  release() {
    this.held = false;
    for (const deliver of this.deliveries.splice(0)) deliver();
  }
}

beforeEach(async () => {
  await installDom();
  workers = [];
  holdLive = false;
  workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    writable: true,
    value: HostWorker,
  });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  for (const worker of workers) worker.terminate();
  if (workerDescriptor) Object.defineProperty(globalThis, "Worker", workerDescriptor);
  else Reflect.deleteProperty(globalThis, "Worker");
  await uninstallDom();
});

async function mount(search: string) {
  window.history.replaceState({}, "", `/lab/lq-01/${search}`);
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(<WaveDescriptionLab example={example} />));
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 40 && !check(); attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  expect(check()).toBe(true);
}

async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (entry) => entry.textContent?.trim() === label,
  );
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => button.click());
}

function input(suffix: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(`input[id$="-${suffix}"]`);
  if (!element) throw new Error(`Missing wave input: ${suffix}`);
  return element;
}

async function typeWithoutCommitting(suffix: string, value: string) {
  const field = input(suffix);
  // This shared happy-dom harness needs React's installed input handler; do not invoke onBlur,
  // which would commit the draft and hide the late-acceptance regression this test exercises.
  const key = Object.keys(field).find((candidate) => candidate.startsWith("__reactProps$"));
  const handlers = key
    ? (field as unknown as Record<string, { onChange(event: unknown): void }>)[key]
    : undefined;
  if (!handlers) throw new Error("React must install the wave input handler.");
  await act(async () => {
    field.value = value;
    handlers.onChange({ target: field, currentTarget: field });
  });
}

const lab = () => document.querySelector("[data-testid=wave-description-lab]");
const outcome = () =>
  document.querySelector("[data-walkthrough-outcome]")?.getAttribute("data-walkthrough-outcome");

test("opening a pinned settings link changes the form without starting a worker or relabelling the result", async () => {
  const binding = createLq01TapeBinding(example, () => {
    throw new Error("Reading shared settings must not create a worker.");
  });
  const tape = draftTapeForSettings(binding, { ...LQ01_DEFAULTS, delta: Math.PI, A2: 0.5 });
  if (!tape) throw new Error("Valid wave settings must have a share tape.");
  await mount(`?tape=${encodeTapePermalink(tape)}`);
  await until(() => document.querySelector("[data-tape-loaded]") !== null);
  expect(input("delta").value).toBe(String(Math.PI));
  expect(input("a2").value).toBe("0.5");
  expect(document.querySelector('[data-output="centerIntensity"]')?.textContent).toBe("4");
  expect(lab()?.getAttribute("data-pending")).toBe("false");
  expect(workers).toHaveLength(0);
  expect(document.querySelector("[data-tape-notice]")).toBeNull();
  expect(outcome()).toBeUndefined();
  logger.log({ testId: "shared-form-no-autoplay", instrumentId: "lq-01", outcome: "passed" });
});

test("a valid walkthrough waits for explicit replay and keeps newer typed entries when its result arrives", async () => {
  holdLive = true;
  await mount("?walkthrough=waves-in-and-out-of-step&stop=2");
  await until(
    () =>
      document
        .querySelector("[data-walkthrough-checkpoint]")
        ?.getAttribute("data-walkthrough-checkpoint") === "2",
  );
  expect(document.body.textContent).not.toContain("link is incomplete or unsupported");
  expect(workers).toHaveLength(0);
  await click("Inspect previous checkpoint");
  await click("Inspect next checkpoint");
  expect(workers).toHaveLength(0);
  expect(input("a2").value).toBe("1");

  await click("Restore checkpoint");
  await until(() => workers[1]?.hasResult === true);
  expect(outcome()).toBeUndefined();
  expect(lab()?.getAttribute("data-pending")).toBe("true");
  expect(document.querySelector('[data-output="centerIntensity"]')?.textContent).toBe("4");
  await typeWithoutCommitting("delta", "0.73");
  await typeWithoutCommitting("a2", "0.8");
  await act(async () => workers[1]?.release());
  await until(() => outcome() === "replayed");
  expect(lab()?.getAttribute("data-pending")).toBe("false");
  expect(document.querySelector('[data-output="centerIntensity"]')?.textContent).toBe("0.25");
  expect(input("delta").value).toBe("0.73");
  expect(input("a2").value).toBe("0.8");
  expect(document.body.textContent).toContain("Your newer entries are still in the form");
  expect(workers[0]?.disposed).toBe(true);

  // A second explicit replay with no intervening typing can bring the form to the checkpoint.
  await click("Restore checkpoint");
  await until(() => input("delta").value === String(Math.PI));
  expect(input("a2").value).toBe("0.5");
  expect(document.body.textContent).not.toContain("Your newer entries are still in the form");
  logger.log({
    testId: "late-acceptance-retains-newer-draft",
    instrumentId: "lq-01",
    outcome: "passed",
  });
});
