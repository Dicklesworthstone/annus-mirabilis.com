import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, StrictMode, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FluorescenceLab } from "../../components/lab/lq07/FluorescenceLab.tsx";
import sourceDigests from "../../generated/lab-source-digests.json";
import example from "../../generated/lq08-example.json";
import type { LabReference } from "../../reader/stack/stackStore.ts";
import { TestLogger } from "../../testing/log/logger.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { LQ07_DEFAULTS } from "../lq07/definition.ts";
import { createLq08Session } from "../lq08/session.ts";
import { LQ08_TAPE } from "../lq08/tape.ts";
import { instrumentRootAttributes } from "./identityAttributes.ts";
import { createReaderCheckpointBinding } from "./readerCheckpoint.ts";
import { RetainedSessionProvider, useRetainedSession } from "./retainedSession.tsx";
import { createSessionRetention, type SessionRetention } from "./sessionRetention.ts";
import { useInstrumentView } from "./useExperimentSnapshot.ts";

let root: Root;
let container: HTMLElement;
let cache: SessionRetention;
let lastReference: LabReference | null;
let subscriptions: number;
let disconnects: number;
let creations: number;
const never = new Promise<void>(() => {});
const logger = new TestLogger("retained-session-react");
afterAll(() => logger.flush());

beforeEach(async () => {
  await installDom();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  cache = createSessionRetention();
  lastReference = null;
  subscriptions = 0;
  disconnects = 0;
  creations = 0;
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  cache.dispose();
  await uninstallDom();
});

const report = (reference: LabReference) => {
  lastReference = reference;
};
function Probe({
  sourceDigest = example.sourceDigest,
  suspend = false,
  archive = false,
}: {
  sourceDigest?: string;
  suspend?: boolean;
  archive?: boolean;
}) {
  const session = useRetainedSession(
    { experimentId: "lq-08", instanceId: "probe", sourceDigest },
    (id) => {
      creations++;
      const actual = createLq08Session(id, { ...example, sourceDigest });
      return {
        ...actual,
        subscribe(listener: () => void) {
          subscriptions++;
          const unsubscribe = actual.subscribe(listener);
          return () => {
            subscriptions--;
            unsubscribe();
          };
        },
        disconnect() {
          disconnects++;
          actual.disconnect();
        },
      };
    },
    archive ? createReaderCheckpointBinding(LQ08_TAPE) : undefined,
  );
  const view = useInstrumentView(session);
  if (suspend) throw never;
  return (
    <section {...instrumentRootAttributes(view)}>
      <button type="button" onClick={() => session.apply({ frequency: 9e14 })}>
        Change frequency
      </button>
      <output>{session.acceptedParameters().frequency}</output>
    </section>
  );
}
async function render(sourceDigest = example.sourceDigest, suspend = false, archive = false) {
  await act(async () => {
    root.render(
      <StrictMode>
        <RetainedSessionProvider
          cache={cache}
          placementKey="/paper/passage"
          instanceId="probe"
          previous={lastReference}
          onReference={report}
        >
          <Suspense fallback={<p>Loading laboratory</p>}>
            <Probe sourceDigest={sourceDigest} suspend={suspend} archive={archive} />
          </Suspense>
        </RetainedSessionProvider>
      </StrictMode>,
    );
  });
}
async function close() {
  await act(async () => {
    root.render(null);
  });
}

describe("committed React retention lifecycle", () => {
  test("a bounded history checkpoint rehydrates the exact accepted owner after idle eviction", async () => {
    cache.dispose();
    cache = createSessionRetention({ maxIdleSessions: 0 });
    await render(example.sourceDigest, false, true);
    await act(async () => {
      container.querySelector("button")?.click();
    });
    const accepted = { ...container.querySelector<HTMLElement>("section")?.dataset };
    const initialCreations = creations;
    expect(lastReference?.compactTape.length).toBeGreaterThan(0);
    await close();
    expect(cache.size()).toBe(0);
    expect(subscriptions).toBe(0);
    await render(example.sourceDigest, false, true);
    expect(creations).toBe(initialCreations + 1);
    expect({ ...container.querySelector<HTMLElement>("section")?.dataset }).toEqual(accepted);
    expect(container.querySelector("output")?.textContent).toBe("900000000000000");
    expect(container.querySelector("[data-lab-return-notice]")?.textContent).toContain(
      "Restored the recorded accepted experiment",
    );
  });
  test("StrictMode keeps one committed owner and reopening reads the current accepted snapshot", async () => {
    await render();
    expect(cache.size()).toBe(1);
    expect(subscriptions).toBe(2);
    expect(disconnects).toBe(0);
    await act(async () => {
      container.querySelector("button")?.click();
    });
    expect(container.querySelector("output")?.textContent).toBe("900000000000000");
    const accepted = { ...container.querySelector<HTMLElement>("section")?.dataset };
    const count = creations;
    await close();
    expect(subscriptions).toBe(0);
    expect(disconnects).toBe(1);
    expect(container.childElementCount).toBe(0);
    await render();
    expect(creations).toBe(count);
    expect({ ...container.querySelector<HTMLElement>("section")?.dataset }).toEqual(accepted);
    expect(container.querySelector("output")?.textContent).toBe("900000000000000");
    expect(container.querySelector("[data-lab-return-notice]")).toBeNull();
    expect(lastReference?.checkpointDigest).toBe("");
    expect(lastReference?.compactTape).toBe("");
    logger.log({
      testId: "strict-mode-return",
      beadId: "am-read-return-stack-oxa",
      instrumentId: "lq-08",
      instanceId: lastReference?.instanceId,
      runId: lastReference?.runId,
      outcome: "passed",
      message:
        "StrictMode keeps one committed owner; reopening retains the exact snapshot without leaked subscriptions or another construction.",
    });
  });

  test("an abandoned Suspense render never registers, subscribes or starts a retained owner", async () => {
    await render(example.sourceDigest, true);
    expect(creations).toBeGreaterThan(0);
    expect(cache.size()).toBe(0);
    expect(subscriptions).toBe(0);
    expect(disconnects).toBe(0);
    expect(lastReference).toBeNull();
    await close();
    await render();
    expect(cache.size()).toBe(1);
    expect(lastReference).not.toBeNull();
  });

  test("changing the source on a mounted view replaces the owner and visibly identifies the fresh experiment", async () => {
    await render();
    await act(async () => {
      container.querySelector("button")?.click();
    });
    const previous = lastReference;
    await render(`source:sha256:${"0".repeat(64)}`);
    expect(lastReference?.instanceId).not.toBe(previous?.instanceId);
    expect(lastReference?.runId).not.toBe(previous?.runId);
    expect(container.querySelector("output")?.textContent).toBe(
      String(example.parameters.frequency),
    );
    expect(container.querySelector("[data-lab-return-notice]")?.textContent).toContain(
      "model has changed",
    );
    expect(cache.size()).toBe(1);
    expect(subscriptions).toBe(2);
    expect(disconnects).toBe(1);
  });

  test("eviction shows a fresh-run explanation and cannot reuse the previous run identity", async () => {
    cache.dispose();
    cache = createSessionRetention({ maxIdleSessions: 0 });
    await render();
    await act(async () => {
      container.querySelector("button")?.click();
    });
    const previous = lastReference;
    await close();
    expect(cache.size()).toBe(0);
    await render();
    expect(lastReference?.instanceId).not.toBe(previous?.instanceId);
    expect(lastReference?.runId).not.toBe(previous?.runId);
    expect(container.querySelector("output")?.textContent).toBe(
      String(example.parameters.frequency),
    );
    expect(container.querySelector("[data-lab-return-notice]")?.textContent).toContain(
      "earlier laboratory session is no longer available",
    );
  });

  test("a source replacement resets a real laboratory's private form to its new accepted owner", async () => {
    async function renderForm(sourceDigest: string) {
      await act(async () => {
        root.render(
          <RetainedSessionProvider
            cache={cache}
            placementKey="/paper/passage"
            instanceId="form-lab"
            previous={lastReference}
            onReference={report}
          >
            <FluorescenceLab
              instanceId="form-lab"
              restoreFromLocation={false}
              example={{
                sourceDigest,
                parameters: LQ07_DEFAULTS,
                results: [],
                stepIndex: 1,
                simulationTime: 1,
              }}
            />
          </RetainedSessionProvider>,
        );
      });
    }
    const input = () => container.querySelector<HTMLInputElement>('input[id$="-nu2"]');
    await renderForm(sourceDigests["lq-07"]);
    const original = input()?.value;
    const preset = container.querySelectorAll<HTMLButtonElement>(".lq07-try button")[1];
    if (!preset) throw new Error("The real fluorescence preset is missing.");
    await act(async () => {
      preset.click();
    });
    expect(input()?.value).not.toBe(original);
    const previous = lastReference;
    await renderForm(`source:sha256:${"1".repeat(64)}`);
    expect(input()?.value).toBe(original);
    expect(lastReference?.instanceId).not.toBe(previous?.instanceId);
    expect(lastReference?.runId).not.toBe(previous?.runId);
    expect(container.querySelector("[data-lab-return-notice]")?.textContent).toContain(
      "model has changed",
    );
    expect(cache.size()).toBe(1);
  });

  test("an older history reference names the latest retained experiment honestly after eviction", async () => {
    cache.dispose();
    cache = createSessionRetention({ maxIdleSessions: 1 });
    await render();
    const olderHistory = lastReference;
    await close();
    const other = cache.prepare(
      "/paper/other-passage",
      { experimentId: "lq-08", instanceId: "other", sourceDigest: example.sourceDigest },
      (id) => createLq08Session(id, example),
    );
    cache.retain(other)();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await render();
    const latest = lastReference;
    expect(latest?.instanceId).not.toBe(olderHistory?.instanceId);
    await close();
    lastReference = olderHistory;
    await render();
    expect(lastReference?.instanceId).toBe(latest?.instanceId);
    const notice = container.querySelector("[data-lab-return-notice]")?.textContent;
    expect(notice).toContain("latest experiment from this passage is shown");
    expect(notice).not.toContain("starts a new experiment");
  });
});
