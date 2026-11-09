import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { INVESTIGATION_KEYS } from "../../platform/storage/keys.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import {
  DiscoveryInvestigationProvider,
  type InvestigationKeepStatus,
  useDiscoveryInvestigation,
  useInvestigationKeepStatus,
} from "./context.tsx";
import {
  createInvestigationStore,
  exportInvestigationJson,
  type InvestigationReport,
  type InvestigationStore,
} from "./core.ts";
import { INVESTIGATIONS } from "./specs.ts";
import { mountInvestigationWorkspace } from "./workspace.ts";

const spec = INVESTIGATIONS["brownian-motion"];
const key = INVESTIGATION_KEYS["brownian-motion"];
const task = {
  promptId: spec.promptId,
  task: "What happens to the spread?",
  perturbPrompt: "Change the radius.",
  explainPrompt: "Explain what changed.",
};

/** An accepted-view boundary fixture through the actual report producer. */
function report(prediction: string): InvestigationReport {
  const identity = {
    experimentId: spec.experimentId,
    instanceId: "fixture-placement",
    runId: "fixture-run",
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { seed: "18446744073709551615" },
  };
  const view = {
    status: "accepted",
    pending: false,
    requested: identity,
    accepted: {
      ...identity,
      final: true,
      snapshotVersion: 1,
      stepIndex: 0,
      simulationTime: 0,
      outputs: spec.quantities.map(({ id }) => ({
        quantityId: id,
        ownerId: "fixture.owner",
        semanticKind: "fixture-scalar",
        unit: "m",
        status: "value",
        value: 1e-7,
      })),
    },
  };
  const store = createInvestigationStore(spec);
  store.connect({ getSnapshot: () => view, subscribe: () => () => {} }, "fixture-source-v1");
  expect(store.begin(prediction, task).ok).toBe(true);
  return store.getSnapshot().report as InvestigationReport;
}

const tabs = new Map<string, { store: InvestigationStore; keep: InvestigationKeepStatus }>();
function Probe({ name }: { name: string }) {
  const store = useDiscoveryInvestigation();
  const keep = useInvestigationKeepStatus();
  if (store) tabs.set(name, { store, keep });
  return <div data-import-host={name} />;
}

describe("import joins the workspace to the existing guarded storage writer", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;
  const cleanups: (() => void)[] = [];
  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    tabs.clear();
    container = createContainer();
    root = createRoot(container);
  });
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });
  async function mount(two = false) {
    await act(async () =>
      root.render(
        <>
          <DiscoveryInvestigationProvider spec={spec}>
            <Probe name="one" />
          </DiscoveryInvestigationProvider>
          {two && (
            <DiscoveryInvestigationProvider spec={spec}>
              <Probe name="two" />
            </DiscoveryInvestigationProvider>
          )}
        </>,
      ),
    );
  }
  function workspace(name = "one") {
    const store = tabs.get(name)?.store as InvestigationStore;
    const host = container.querySelector<HTMLElement>(
      `[data-import-host="${name}"]`,
    ) as HTMLElement;
    cleanups.push(mountInvestigationWorkspace(host, store, task).dispose);
    function button(label: string) {
      const found = [...host.querySelectorAll("button")].find(
        (candidate) => candidate.textContent === label,
      );
      expect(found).toBeDefined();
      return found as HTMLButtonElement;
    }
    async function choose(imported: InvestigationReport) {
      const input = host.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File([exportInvestigationJson(imported)], "investigation.json")],
      });
      await act(async () => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(host.querySelector<HTMLElement>("[data-investigation-import-preview]")?.hidden).toBe(
        false,
      );
    }
    return { store, host, button, choose };
  }

  test("import is saved only after confirmation and reopens on a later visit", async () => {
    const imported = report("A prediction from another device.");
    await mount();
    const current = workspace();
    await current.choose(imported);
    expect(window.localStorage.getItem(key)).toBe(null);
    expect(current.store.getSnapshot().report).toBe(null);
    await act(async () => current.button("Open this investigation").click());
    expect(tabs.get("one")?.keep).toBe("kept");
    expect(JSON.parse(window.localStorage.getItem(key) as string).report).toEqual(imported);
    expect(current.store.getSnapshot().restored).toBe(true);
    await act(async () => root.render(null));
    await mount();
    expect(tabs.get("one")?.keep).toBe("restored");
    expect(tabs.get("one")?.store.getSnapshot().report).toEqual(imported);
  });

  test("a newer copy in another tab prevents replacement and preserves the local typed explanation", async () => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ schemaVersion: 1, report: report("Original prediction.") }),
    );
    await mount(true);
    const current = workspace("two");
    const original = current.store.getSnapshot().report;
    const explanation = current.host.querySelector<HTMLTextAreaElement>(
      'textarea[id$="-explanation"]',
    ) as HTMLTextAreaElement;
    explanation.value = "Unsaved explanation in this tab.";
    await current.choose(report("The imported prediction."));
    await act(async () => {
      tabs.get("one")?.store.explain("Newer saved work in another tab.");
    });
    const durable = window.localStorage.getItem(key);
    await act(async () => current.button("Replace with this investigation").click());
    expect(tabs.get("two")?.keep).toBe("conflict");
    expect(current.store.getSnapshot().report).toBe(original);
    expect(explanation.value).toBe("Unsaved explanation in this tab.");
    expect(current.host.querySelector('[role="alert"]')?.textContent).toContain(
      "changed in another tab",
    );
    expect(window.localStorage.getItem(key)).toBe(durable);
  });

  test("cancellation preserves both drafts and the stored copy; replacement requires its own final action", async () => {
    const original = report("The investigation already on this device.");
    const durable = JSON.stringify({ schemaVersion: 1, report: original });
    window.localStorage.setItem(key, durable);
    await mount();
    const current = workspace();
    const explanation = current.host.querySelector<HTMLTextAreaElement>(
      'textarea[id$="-explanation"]',
    ) as HTMLTextAreaElement;
    explanation.value = "A draft that has not been saved yet.";
    const imported = report("A different investigation from a file.");
    await current.choose(imported);
    expect(window.localStorage.getItem(key)).toBe(durable);
    await act(async () => current.button("Keep my current work").click());
    expect(explanation.value).toBe("A draft that has not been saved yet.");
    expect(current.store.getSnapshot().report).toEqual(original);
    expect(window.localStorage.getItem(key)).toBe(durable);
    await current.choose(imported);
    await act(async () => current.button("Replace with this investigation").click());
    expect(current.store.getSnapshot().report).toEqual(imported);
    expect(explanation.value).toBe(imported.explanation);
    expect(JSON.parse(window.localStorage.getItem(key) as string).report).toEqual(imported);
    expect(tabs.get("one")?.keep).toBe("kept");
  });

  test("a changed draft needs a new review, and an identical import leaves unsaved text alone", async () => {
    const original = report("The current prediction.");
    const durable = JSON.stringify({ schemaVersion: 1, report: original });
    window.localStorage.setItem(key, durable);
    await mount();
    const current = workspace();
    const explanation = current.host.querySelector<HTMLTextAreaElement>(
      'textarea[id$="-explanation"]',
    ) as HTMLTextAreaElement;
    await current.choose(report("A different file."));
    explanation.value = "New work after the file preview.";
    await act(async () => current.button("Replace with this investigation").click());
    expect(current.host.querySelector('[role="alert"]')?.textContent).toContain(
      "work changed while you were reviewing",
    );
    expect(current.store.getSnapshot().report).toEqual(original);
    expect(window.localStorage.getItem(key)).toBe(durable);
    await current.choose(original);
    await act(async () => current.button("Replace with this investigation").click());
    expect(explanation.value).toBe("New work after the file preview.");
    expect(current.store.getSnapshot().report).toEqual(original);
    expect(window.localStorage.getItem(key)).toBe(durable);
    expect(current.host.textContent).toContain("already open");
  });

  test("a comparison name typed after the preview requires another review without losing the draft", async () => {
    const original = report("The current prediction.");
    const durable = JSON.stringify({ schemaVersion: 1, report: original });
    window.localStorage.setItem(key, durable);
    await mount();
    const current = workspace();
    const label = current.host.querySelector<HTMLInputElement>(
      'input[id$="-label"]',
    ) as HTMLInputElement;
    await current.choose(report("A different file."));
    label.value = "The smaller-radius comparison I am preparing.";
    await act(async () => current.button("Replace with this investigation").click());
    expect(current.host.querySelector('[role="alert"]')?.textContent).toContain(
      "work changed while you were reviewing",
    );
    expect(label.value).toBe("The smaller-radius comparison I am preparing.");
    expect(current.store.getSnapshot().report).toEqual(original);
    expect(window.localStorage.getItem(key)).toBe(durable);
    await current.choose(report("A different file."));
    await act(async () => current.button("Replace with this investigation").click());
    expect(current.store.getSnapshot().report?.prediction).toBe("A different file.");
    expect(label.value).toBe("");
  });

  test("blocked storage keeps an imported investigation editable and exportable in this tab", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Blocked by reader setting");
      },
    });
    try {
      await mount();
      const current = workspace();
      const imported = report("Private imported prediction.");
      await current.choose(imported);
      await act(async () => current.button("Open this investigation").click());
      expect(tabs.get("one")?.keep).toBe("unavailable");
      expect(current.store.getSnapshot().report).toEqual(imported);
      await act(async () => {
        expect(current.store.explain("A complete updated explanation.").ok).toBe(true);
      });
      const exported = JSON.parse(
        exportInvestigationJson(current.store.getSnapshot().report as InvestigationReport),
      );
      expect(exported.prediction).toBe(imported.prediction);
      expect(exported.explanation).toBe("A complete updated explanation.");
      expect(exported.baseline).toEqual(imported.baseline);
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
      else Reflect.deleteProperty(window, "localStorage");
    }
  });

  test("a quota failure never discards the imported report or claims it was kept", async () => {
    await mount();
    const current = workspace();
    const storage = window.localStorage;
    const writes = spyOn(Object.getPrototypeOf(storage), "setItem").mockImplementation(() => {
      throw new DOMException("No room", "QuotaExceededError");
    });
    try {
      const imported = report("This file still belongs to the reader.");
      await current.choose(imported);
      await act(async () => current.button("Open this investigation").click());
      expect(writes).toHaveBeenCalled();
      expect(tabs.get("one")?.keep).toBe("quota");
      expect(current.store.getSnapshot().report).toEqual(imported);
      expect(
        exportInvestigationJson(current.store.getSnapshot().report as InvestigationReport),
      ).toBe(exportInvestigationJson(imported));
      expect(storage.getItem(key)).toBe(null);
    } finally {
      writes.mockRestore();
    }
  });
});
