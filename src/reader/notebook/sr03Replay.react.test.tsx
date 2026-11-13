import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ObserverControlledComparison } from "../../components/lab/ObserverControlledComparison.tsx";
import { prepareSr03Comparisons } from "../../content/sr03Comparison.ts";
import catalogue from "../../generated/sr03-notebook-replay.json";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import { getNotebookStore } from "./browserStore.ts";
import { replayEnvironment } from "./replayCurrent.ts";
import { mountReplayView } from "./replayView.ts";
import type { NotebookReplayEntry } from "./schema.ts";

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "The reader's observer action must finish");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
  }
}
async function change(control: HTMLSelectElement | HTMLTextAreaElement, value: string) {
  if (control instanceof HTMLSelectElement) {
    await act(async () => {
      control.value = value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return;
  }
  // HappyDOM does not emit trusted typing; exercise React's actual input boundary.
  const key = Object.keys(control).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key);
  const props = (
    control as unknown as Record<string, { onChange(event: { target: typeof control }): void }>
  )[key];
  assert.ok(props);
  await act(async () => {
    control.value = value;
    props.onChange({ target: control });
  });
}

test("an observer comparison keeps its prediction through cancellation, saves privately and explicitly replays the fixed events", async () => {
  await installDom({ intersections: "visible" });
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let creations = 0,
    disposals = 0,
    hold = false;
  const held: (() => void)[] = [];
  const failures: unknown[] = [];
  class ObserverWorker extends EventTarget {
    private closed = false;
    private readonly host = createSr03Host((message) => {
      const deliver = () => {
        if (!this.closed)
          this.dispatchEvent(new MessageEvent("message", { data: structuredClone(message) }));
      };
      if (hold && message.messageKind === "result") held.push(deliver);
      else deliver();
    }, catalogue.example.sourceDigest);
    constructor() {
      super();
      creations++;
      queueMicrotask(() => {
        if (!this.closed) this.host.hello();
      });
    }
    postMessage(message: unknown) {
      void this.host.receive(structuredClone(message)).catch((error) => {
        failures.push(error);
        this.dispatchEvent(new Event("error"));
      });
    }
    terminate() {
      if (this.closed) return;
      this.closed = true;
      disposals++;
      this.host.dispose();
    }
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: ObserverWorker });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let inspection: ReturnType<typeof mountReplayView> | undefined;
  const savedIds: string[] = [];
  try {
    const examples = await prepareSr03Comparisons(catalogue.example.sourceDigest);
    await act(async () =>
      root.render(
        <StrictMode>
          <ObserverControlledComparison
            examples={examples}
            passage={catalogue.passages["arg-sr-rod-events"]}
          />
        </StrictMode>,
      ),
    );
    expect(creations).toBe(0);
    const region = host.querySelector<HTMLElement>("[data-observer-comparison]");
    assert.ok(region);
    const button = (name: string) => {
      const found = [...host.querySelectorAll("button")].find(
        (control) => control.textContent?.trim() === name,
      );
      assert.ok(found, name);
      return found;
    };
    await act(async () => button("Start live observer comparison").click());
    await until(() => region.dataset.comparisonPending === "false");
    const form = host.querySelector<HTMLFormElement>(
      'form[aria-label="Observer comparison settings"]',
    );
    const prediction = form?.querySelector<HTMLSelectElement>('select[id$="-prediction"]');
    const frame = form?.querySelector<HTMLSelectElement>('select[id$="-frame"]');
    assert.ok(form && prediction && frame);
    const submit = () =>
      act(async () => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    await change(prediction, "smaller");
    await change(frame, "k");
    hold = true;
    await submit();
    expect(button("Save this comparison and my explanation").disabled).toBe(true);
    await until(() => held.length === 1);
    await act(async () => {
      hold = false;
      held.shift()?.();
    });
    await until(() => region.dataset.comparisonPending === "false");
    expect(host.querySelector('[data-observer-readout="time"]')?.textContent).toContain("−7.5");
    await change(prediction, "larger"); // A later choice cannot relabel the accepted result.
    const before = host.querySelector<HTMLTextAreaElement>('textarea[id$="-before"]');
    const after = host.querySelector<HTMLTextAreaElement>('textarea[id$="-after"]');
    const notes = host.querySelector<HTMLTextAreaElement>('textarea[id$="-notes"]');
    assert.ok(before && after && notes);
    await change(before, "I expect the signed time difference to decrease.");
    await change(after, "The second event is earlier in k for this fixed spacelike pair.");
    await change(notes, "Private <script>observer-notes</script>");
    const store = getNotebookStore();
    async function save() {
      const oldIds = new Set(store.getSnapshot().document.entries.map((entry) => entry.id));
      await act(async () => button("Save this comparison and my explanation").click());
      await until(() =>
        store.getSnapshot().document.entries.some((entry) => !oldIds.has(entry.id)),
      );
      const entry = store.getSnapshot().document.entries.find((item) => !oldIds.has(item.id));
      assert.ok(entry?.kind === "replay");
      savedIds.push(entry.id);
      return entry;
    }
    const entry = await save();
    expect(entry.replay.kind).toBe("sr03-comparison");
    expect(entry.replay.tape.predictions?.[0]?.payload).toEqual({ candidateId: "smaller" });
    expect(entry.replay.passage).toEqual(catalogue.passages["arg-sr-rod-events"]);
    expect(entry.frame.paper).toBe("special-relativity");
    expect(entry.text).toBe("Private <script>observer-notes</script>");
    expect(entry.replay.variant.outputs.measuredLength?.status).toBe("not-applicable");

    // Cancel B while A remains displayed: A must retain its original prediction, not B's choice.
    await change(frame, "K");
    hold = true;
    await submit();
    await until(() => held.length === 1);
    expect(button("Save this comparison and my explanation").disabled).toBe(true);
    await act(async () => button("Stop calculation").click());
    await act(async () => {
      hold = false;
      held.shift()?.();
    });
    const retained = await save();
    expect(retained.replay.baseline).toEqual(entry.replay.baseline);
    expect(retained.replay.variant).toEqual(entry.replay.variant);
    expect(retained.replay.tape.predictions?.[0]?.payload).toEqual({ candidateId: "smaller" });

    // A genuinely new request with the same settings and no choice must not inherit A's prediction.
    await change(prediction, "");
    await change(frame, "k");
    await submit();
    await until(() => region.dataset.comparisonPending === "false");
    const unpredicted = await save();
    expect(unpredicted.replay.variant.parameters).toEqual(entry.replay.variant.parameters);
    expect(unpredicted.replay.variant.snapshotVersion).toBeGreaterThan(
      entry.replay.variant.snapshotVersion,
    );
    expect(unpredicted.replay.tape.predictions).toEqual([]);

    const notebook = document.createElement("div");
    document.body.append(notebook);
    inspection = mountReplayView(
      notebook,
      entry as NotebookReplayEntry,
      store,
      replayEnvironment(entry.replay),
    );
    const again = [...notebook.querySelectorAll("button")].find(
      (control) => control.textContent === "Run the saved comparison again",
    );
    assert.ok(again);
    await until(() => !again.disabled);
    const workersBeforeReplay = creations;
    expect(notebook.textContent).toContain("signed time separation will be smaller");
    expect(notebook.textContent).toContain("fixed event pair");
    expect(notebook.textContent).not.toContain("particle paths");
    expect(notebook.querySelector("script")).toBeNull();
    expect(notebook.querySelectorAll("table")).toHaveLength(1);
    await act(async () => again.click());
    await until(
      () =>
        notebook.querySelector<HTMLElement>("[data-fresh-replay]")?.dataset.phase === "complete",
    );
    expect(creations).toBe(workersBeforeReplay + 1);
    expect(notebook.textContent).toContain("same fixed event pair and physical setup");
    expect(notebook.querySelectorAll("table")).toHaveLength(2);
    expect(store.getSnapshot().document.entries.find((item) => item.id === entry.id)).toEqual(
      entry,
    );
    expect(failures).toEqual([]);
  } finally {
    inspection?.dispose();
    for (const id of savedIds) getNotebookStore().remove(id);
    await act(async () => root.unmount());
    if (previousWorker) Object.defineProperty(globalThis, "Worker", previousWorker);
    else Reflect.deleteProperty(globalThis, "Worker");
    await uninstallDom();
  }
  expect(disposals).toBe(creations);
});
