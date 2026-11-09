import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CameraControlledComparison } from "../../components/lab/CameraControlledComparison.tsx";
import { validateBm08Parameters } from "../../experiments/bm08/parameters.ts";
import prepared from "../../generated/bm08-example.json";
import catalogue from "../../generated/notebook-replay.json";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createBm08Host } from "../../workers/host/bm08Host.ts";
import { getNotebookStore } from "./browserStore.ts";
import { replayEnvironment } from "./replayCurrent.ts";
import { mountReplayView } from "./replayView.ts";
import type { NotebookReplayEntry } from "./schema.ts";

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "The reader's camera action must finish");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
  }
}
async function change(
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  if (control instanceof HTMLSelectElement) {
    await act(async () => {
      control.value = value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return;
  }
  // This project uses React's actual onChange boundary in happy-dom, which has no trusted input.
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

test("a reader predicts, runs, saves camera evidence, inspects it without running, then explicitly replays it in the notebook", async () => {
  await installDom({ intersections: "visible" });
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let creations = 0,
    disposals = 0;
  let holdVariant = true;
  let releaseVariant: (() => void) | undefined;
  const failures: unknown[] = [];
  class CameraWorker extends EventTarget {
    private closed = false;
    private readonly host = createBm08Host((message) => {
      const deliver = () => {
        if (!this.closed)
          this.dispatchEvent(new MessageEvent("message", { data: structuredClone(message) }));
      };
      if (
        holdVariant &&
        message.messageKind === "result" &&
        message.token.parameters.sigma === 0.4e-6
      )
        releaseVariant = deliver;
      else deliver();
    }, prepared.sourceDigest);
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
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: CameraWorker });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let inspection: ReturnType<typeof mountReplayView> | undefined;
  let savedId: string | undefined;
  try {
    const checked = validateBm08Parameters(prepared.parameters);
    assert.equal(checked.kind, "accepted");
    if (checked.kind !== "accepted") return;
    await act(async () =>
      root.render(
        <StrictMode>
          <CameraControlledComparison
            example={{ ...prepared, parameters: checked.data }}
            passage={catalogue.passages["arg-bm-inference"]}
          />
        </StrictMode>,
      ),
    );
    expect(creations).toBe(0);
    const region = host.querySelector<HTMLElement>("[data-controlled-camera-comparison]");
    assert.ok(region);
    const button = (name: string) => {
      const found = [...host.querySelectorAll("button")].find(
        (control) => control.textContent?.trim() === name,
      );
      assert.ok(found, name);
      return found;
    };
    await act(async () => button("Start controlled camera comparison").click());
    await until(() => region.dataset.pending === "false");
    const form = host.querySelector<HTMLFormElement>(
      'form[aria-label="Controlled camera comparison settings"]',
    );
    const prediction = form?.querySelector<HTMLSelectElement>('select[id$="-prediction"]');
    const sigma = form?.querySelector<HTMLInputElement>('input[type="text"]');
    assert.ok(form && prediction && sigma);
    await change(prediction, "larger");
    await change(sigma, "0.4");
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(button("Save this comparison and my explanation").disabled).toBe(true);
    await until(() => releaseVariant !== undefined);
    await act(async () => {
      holdVariant = false;
      releaseVariant?.();
    });
    await until(() => region.dataset.pending === "false");
    expect(creations).toBe(1);
    await change(prediction, "smaller"); // A later form choice must not relabel the accepted prediction.
    const before = host.querySelector<HTMLTextAreaElement>('textarea[id$="-before"]');
    const after = host.querySelector<HTMLTextAreaElement>('textarea[id$="-after"]');
    const notes = host.querySelector<HTMLTextAreaElement>('textarea[id$="-notes"]');
    assert.ok(before && after && notes);
    await change(before, "Camera noise may raise the naive estimate.");
    await change(after, "The particle's diffusivity stayed fixed.");
    await change(notes, "Private <script>camera-notes</script>");
    const store = getNotebookStore();
    const oldIds = new Set(store.getSnapshot().document.entries.map((entry) => entry.id));
    await act(async () => button("Save this comparison and my explanation").click());
    await until(() => store.getSnapshot().document.entries.some((entry) => !oldIds.has(entry.id)));
    const entry = store
      .getSnapshot()
      .document.entries.find((item) => !oldIds.has(item.id)) as NotebookReplayEntry;
    savedId = entry.id;
    expect(entry.replay.kind).toBe("bm08-comparison");
    expect(entry.replay.tape.predictions?.[0]?.payload).toEqual({ candidateId: "larger" });
    expect(entry.replay.passage).toEqual(catalogue.passages["arg-bm-inference"]);
    expect(entry.text).toBe("Private <script>camera-notes</script>");
    expect(host.textContent).toContain("Kept in your notebook");
    const notebook = document.createElement("div");
    document.body.append(notebook);
    inspection = mountReplayView(notebook, entry, store, replayEnvironment(entry.replay));
    const again = [...notebook.querySelectorAll("button")].find(
      (control) => control.textContent === "Run the saved comparison again",
    );
    assert.ok(again);
    await until(() => !again.disabled);
    expect(creations).toBe(1);
    expect(notebook.textContent).toContain("Sample naive estimate");
    expect(notebook.textContent).toContain("naive diffusion estimate will be larger");
    expect(notebook.textContent).not.toContain("coordinate RMS");
    expect(notebook.querySelector("script")).toBeNull();
    await act(async () => again.click());
    await until(
      () =>
        notebook.querySelector<HTMLElement>("[data-fresh-replay]")?.dataset.phase === "complete",
    );
    expect(creations).toBe(2);
    expect(notebook.textContent).toContain("The new numbers agree");
    expect(notebook.querySelectorAll("table")).toHaveLength(2);
    expect(store.getSnapshot().document.entries.find((item) => item.id === entry.id)).toEqual(
      entry,
    );
    expect(failures).toEqual([]);
  } finally {
    inspection?.dispose();
    if (savedId) getNotebookStore().remove(savedId);
    await act(async () => root.unmount());
    if (previousWorker) Object.defineProperty(globalThis, "Worker", previousWorker);
    else Reflect.deleteProperty(globalThis, "Worker");
    await uninstallDom();
  }
  expect(disposals).toBe(creations);
});
