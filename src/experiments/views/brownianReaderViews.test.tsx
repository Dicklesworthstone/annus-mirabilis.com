import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import bm04Example from "../../generated/bm04-example.json";
import bm08Example from "../../generated/bm08-example.json";
import type { LabReference } from "../../reader/stack/stackStore.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createBm04Host } from "../../workers/host/bm04Host.ts";
import { createBm08Host } from "../../workers/host/bm08Host.ts";
import type { WorkerChannel } from "../../workers/scheduler/scheduler.ts";
import { toBm04Draft } from "../bm04/controls.ts";
import { validateBm04Parameters } from "../bm04/parameters.ts";
import { encodeBm04Settings } from "../bm04/permalink.ts";
import { createBm04Session } from "../bm04/session.ts";
import { toCameraDraft } from "../bm08/controls.ts";
import { validateBm08Parameters } from "../bm08/parameters.ts";
import { encodeBm08Settings } from "../bm08/permalink.ts";
import { createBm08Session } from "../bm08/session.ts";
import { ExperimentDispatch } from "../dispatch.tsx";
import { RetainedSessionProvider } from "../store/retainedSession.tsx";
import { createSessionRetention, type SessionRetention } from "../store/sessionRetention.ts";
import { READER_VIEW_LOADERS } from "./readerViewLoaders.ts";

const checked04 = validateBm04Parameters(bm04Example.parameters);
const checked08 = validateBm08Parameters(bm08Example.parameters);
assert.ok(checked04.kind === "accepted" && checked08.kind === "accepted");
const prepared04 = { ...bm04Example, parameters: checked04.data };
const prepared08 = { ...bm08Example, parameters: checked08.data };
type Session = Pick<
  ReturnType<typeof createBm04Session>,
  "getSnapshot" | "subscribe" | "disconnect"
>;
type Host = ReturnType<typeof createBm04Host>;
type Scenario = Readonly<{
  id: "bm-04" | "bm-08";
  sourceDigest: string;
  field: string;
  initial: string;
  changed: string;
  parentSettings: string;
  create(instanceId: string, channel: () => WorkerChannel): Session;
  host(send: (message: unknown) => void): Host;
}>;
const scenarios: readonly Scenario[] = [
  {
    id: "bm-04",
    sourceDigest: prepared04.sourceDigest,
    field: "steps",
    initial: toBm04Draft(prepared04.parameters).steps,
    changed: prepared04.parameters.steps === 4 ? "8" : "4",
    parentSettings: encodeBm04Settings({
      ...prepared04.parameters,
      steps: prepared04.parameters.steps === 4 ? 8 : 4,
    }),
    create: (id, channel) => createBm04Session(id, prepared04, channel),
    host: (send) => createBm04Host(send, prepared04.sourceDigest),
  },
  {
    id: "bm-08",
    sourceDigest: prepared08.sourceDigest,
    field: "M",
    initial: toCameraDraft(prepared08.parameters).M,
    changed: prepared08.parameters.M === 4 ? "6" : "4",
    parentSettings: encodeBm08Settings({
      ...prepared08.parameters,
      M: prepared08.parameters.M === 4 ? 6 : 4,
    }),
    create: (id, channel) => createBm08Session(id, prepared08, channel),
    host: (send) => createBm08Host(send, prepared08.sourceDigest),
  },
];
let root: Root;
let container: HTMLElement;
let cache: SessionRetention;
let reference: LabReference | null;
const instanceId = "reader-brownian-laboratory";
const placement = "/papers/brownian-motion/s3/#arg-bm-diffusion";
const report = (next: LabReference) => {
  reference = next;
};

beforeEach(async () => {
  await installDom({ intersections: "visible" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  cache = createSessionRetention();
  reference = null;
});
afterEach(async () => {
  await act(async () => root.unmount());
  cache.dispose();
  await uninstallDom();
});

/** Only the transport is in-process. The real host, decoder, owner and form all run. */
function retainLaboratory(scenario: Scenario) {
  let workers = 0;
  let requests = 0;
  let disposals = 0;
  const prepared = cache.prepare(
    placement,
    { experimentId: scenario.id, instanceId, sourceDigest: scenario.sourceDigest },
    (id) =>
      scenario.create(id, () => {
        workers++;
        let listener: ((message: unknown) => void) | undefined;
        const host = scenario.host((message) =>
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
    prepared,
    release,
    get workers() {
      return workers;
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
  assert.ok(check(), "The real lazy view and its bounded calculation must settle.");
}
function laboratory(scenario: Scenario): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    `section.laboratory[data-instrument-id="${scenario.id}"]`,
  );
  assert.ok(element, "The registered reader loader must render the actual laboratory.");
  return element;
}
function field(scenario: Scenario): HTMLInputElement {
  const element = laboratory(scenario).querySelector<HTMLInputElement>(
    `input[name="${scenario.field}"]`,
  );
  assert.ok(element, "The actual standalone settings control must be present in the reader.");
  return element;
}
type Handlers = {
  onChange?: (event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => void;
};
function handlers(element: Element): Handlers {
  const key = Object.keys(element).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The mounted control must have React handlers.");
  const props = (element as unknown as Record<string, Handlers>)[key];
  assert.ok(props);
  return props;
}
async function edit(scenario: Scenario, value: string) {
  const input = field(scenario);
  await act(async () => {
    const change = handlers(input).onChange;
    assert.ok(change);
    input.value = value;
    change({ target: input, currentTarget: input });
  });
}
async function submit(scenario: Scenario) {
  const form = field(scenario).closest("form");
  assert.ok(form);
  await act(async () => {
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
}
async function render(scenario: Scenario, place = placement) {
  await act(async () =>
    root.render(
      <StrictMode>
        <RetainedSessionProvider
          cache={cache}
          placementKey={place}
          instanceId={instanceId}
          previous={reference}
          onReference={report}
        >
          <ExperimentDispatch
            id={scenario.id}
            instanceId={instanceId}
            viewLoaders={READER_VIEW_LOADERS}
          />
        </RetainedSessionProvider>
      </StrictMode>,
    ),
  );
  await until(
    () =>
      container.querySelector(`section.laboratory[data-instrument-id="${scenario.id}"]`) !== null,
  );
}
function identity(scenario: Scenario) {
  const element = laboratory(scenario);
  return ["data-instance-id", "data-run-id", "data-snapshot-version"].map((name) =>
    element.getAttribute(name),
  );
}

for (const scenario of scenarios) {
  test(`${scenario.id}: the lazy reader loader opens real controls without interpreting the paper URL`, async () => {
    const held = retainLaboratory(scenario);
    try {
      for (const query of [
        scenario.parentSettings,
        "?view=german&detail=2&tape=invalid-parent-tape",
      ]) {
        window.history.replaceState(null, "", `/papers/brownian-motion/s3/${query}`);
        await render(scenario);
        expect(field(scenario).value).toBe(scenario.initial);
        expect(laboratory(scenario).dataset.instanceId).toBe(held.prepared.instanceId);
        expect(reference?.instanceId).toBe(held.prepared.instanceId);
        expect(container.querySelector("[data-tape-notice]")).toBeNull();
        expect(held.workers).toBe(0);
        await act(async () => root.render(null));
      }
    } finally {
      held.release();
    }
  }, 60000);

  test(`${scenario.id}: accepted results and form survive return; another passage has its own owner`, async () => {
    const held = retainLaboratory(scenario);
    await render(scenario);
    held.release();
    const before = held.prepared.session.getSnapshot().accepted;
    assert.ok(before);
    await edit(scenario, scenario.changed);
    expect(held.prepared.session.getSnapshot().accepted).toBe(before);
    await submit(scenario);
    await until(() => !held.prepared.session.getSnapshot().pending);
    expect(held.prepared.session.getSnapshot().status).toBe("accepted");
    expect(held.requests).toBe(1);
    expect(held.workers).toBe(1);
    const accepted = held.prepared.session.getSnapshot().accepted;
    assert.ok(accepted);
    expect(accepted).not.toBe(before);
    const acceptedIdentity = identity(scenario);
    expect(reference?.runId).toBe(accepted.runId);
    await edit(scenario, "unfinished");
    expect(held.prepared.session.getSnapshot().accepted).toBe(accepted);
    const savedReference = reference;
    await act(async () => root.render(null));
    expect(held.disposals).toBe(1);
    await render(scenario);
    expect(identity(scenario)).toEqual(acceptedIdentity);
    expect(field(scenario).value).toBe(scenario.changed);
    expect(held.prepared.session.getSnapshot().accepted).toBe(accepted);
    expect(held.workers).toBe(1);
    await act(async () => root.render(null));
    reference = null;
    await render(scenario, "/papers/brownian-motion/s5/#arg-bm-inference");
    expect(identity(scenario)[0]).not.toBe(acceptedIdentity[0]);
    expect(field(scenario).value).toBe(scenario.initial);
    await act(async () => root.render(null));
    reference = savedReference;
    await render(scenario);
    expect(identity(scenario)).toEqual(acceptedIdentity);
    expect(field(scenario).value).toBe(scenario.changed);
    expect(held.workers).toBe(1);
  }, 60000);
}
