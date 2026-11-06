/**
 * The wiring itself (am-rc1001-bridge-plan-pcjk.27): that mounting the provider puts a kept
 * investigation back, and that an accepted change writes one out.
 *
 * `persistence.test.ts` proves the storage layer against an injected `Storage`. This proves the
 * part no unit test reaches: the effect in `DiscoveryInvestigationProvider` that joins the two.
 * It goes through `window.localStorage` (happy-dom) rather than an injected context, because the
 * provider deliberately takes no storage prop and the boundary under test is the real one.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
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
  exportInvestigationHtml,
  exportInvestigationJson,
  type InvestigationReport,
  type InvestigationStore,
} from "./core.ts";
import { INVESTIGATIONS } from "./specs.ts";
import { InvestigationWorkspace } from "./Workspace.tsx";
import { mountInvestigationWorkspace } from "./workspace.ts";

const PAPER = "brownian-motion";
const KEY = INVESTIGATION_KEYS[PAPER];
const spec = INVESTIGATIONS[PAPER];
const task = {
  promptId: spec.promptId,
  task: "What happens to the spread?",
  perturbPrompt: "Change only radius.",
  explainPrompt: "Explain the change and the model's limits.",
};

function acceptedView(): unknown {
  const identity = {
    experimentId: "bm-01",
    instanceId: "placement-A",
    runId: "run-1",
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { T: 290.15, eta: 0.00135, a: 5e-7, seed: "18446744073709551615" },
  };
  return {
    status: "accepted",
    pending: false,
    requested: { ...identity },
    accepted: {
      ...identity,
      snapshotVersion: 1,
      stepIndex: 20,
      simulationTime: 1,
      final: true,
      outputs: spec.quantities.map(({ id }, i) => ({
        quantityId: id,
        ownerId: "fixture.reference",
        unit: "m",
        semanticKind: "coordinate-rms",
        status: "value",
        value: i ? 6e-6 : 8e-7,
      })),
    },
  };
}
const session = () => ({ getSnapshot: () => acceptedView(), subscribe: () => () => {} });

/** A report produced by the real store, so the stored bytes are the ones the site writes. */
function pinnedElsewhere(): InvestigationReport {
  const store = createInvestigationStore(spec);
  store.connect(session(), "fixture-source-v1");
  const begun = store.begin("It will be smaller, but not half.", task);
  if (!begun.ok) throw new Error(`fixture could not pin: ${begun.message}`);
  const report = store.getSnapshot().report;
  if (!report) throw new Error("fixture produced no report");
  return report;
}

let seen: { store: InvestigationStore | null; keep: InvestigationKeepStatus } = {
  store: null,
  keep: "idle",
};
const tabs = new Map<string, typeof seen>();

function Probe({ name = "one" }: { name?: string }) {
  seen = { store: useDiscoveryInvestigation(), keep: useInvestigationKeepStatus() };
  tabs.set(name, seen);
  return (
    <div data-investigation-tab={name}>
      <InvestigationWorkspace task={task} />
      <div data-native-workspace="" />
    </div>
  );
}

describe("the provider joins the store to the reader's device", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    seen = { store: null, keep: "idle" };
    tabs.clear();
    container = createContainer();
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
    await uninstallDom();
  });

  async function mount() {
    await act(async () => {
      root.render(
        <DiscoveryInvestigationProvider spec={spec}>
          <Probe />
        </DiscoveryInvestigationProvider>,
      );
    });
  }

  async function mountTwo() {
    await act(async () => {
      root.render(
        <>
          <DiscoveryInvestigationProvider spec={spec}>
            <Probe name="first" />
          </DiscoveryInvestigationProvider>
          <DiscoveryInvestigationProvider spec={spec}>
            <Probe name="second" />
          </DiscoveryInvestigationProvider>
        </>,
      );
    });
    return {
      first: tabs.get("first")?.store as InvestigationStore,
      second: tabs.get("second")?.store as InvestigationStore,
    };
  }

  test("nothing kept: the store starts empty and says so without claiming a save", async () => {
    await mount();
    expect(seen.store?.getSnapshot().report).toBe(null);
    expect(seen.store?.getSnapshot().restored).toBe(false);
    expect(seen.keep).toBe("idle");
    expect(window.localStorage.getItem(KEY)).toBe(null);
  });

  test("a kept investigation is open on arrival, marked as restored", async () => {
    const report = pinnedElsewhere();
    window.localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, report }));

    await mount();

    expect(seen.keep).toBe("restored");
    const state = seen.store?.getSnapshot();
    expect(state?.restored).toBe(true);
    expect(state?.report?.prediction).toBe("It will be smaller, but not half.");
    expect(exportInvestigationJson(state?.report as InvestigationReport)).toBe(
      exportInvestigationJson(report),
    );
  });

  test("pinning a prediction writes it to this device, under the registered key", async () => {
    await mount();
    const store = seen.store as InvestigationStore;
    await act(async () => {
      store.connect(session(), "fixture-source-v1");
      expect(store.begin("It will be smaller, but not half.", task).ok).toBe(true);
    });

    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBe(null);
    const kept = JSON.parse(raw as string);
    expect(kept.schemaVersion).toBe(1);
    expect(kept.report.prediction).toBe("It will be smaller, but not half.");
    expect(seen.keep).toBe("kept");
  });

  test("a later explanation is written too, not only the first pin", async () => {
    await mount();
    const store = seen.store as InvestigationStore;
    await act(async () => {
      store.connect(session(), "fixture-source-v1");
      store.begin("It will be smaller, but not half.", task);
    });
    await act(async () => {
      expect(store.explain("The spread fell by root two.").ok).toBe(true);
    });

    const kept = JSON.parse(window.localStorage.getItem(KEY) as string);
    expect(kept.report.explanation).toBe("The spread fell by root two.");
  });

  test("starting another investigation clears the copy on this device", async () => {
    const report = pinnedElsewhere();
    window.localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, report }));
    await mount();
    expect(seen.keep).toBe("restored");

    await act(async () => {
      (seen.store as InvestigationStore).restartConfirmed();
    });

    expect(window.localStorage.getItem(KEY)).toBe(null);
    expect(seen.keep).toBe("idle");
  });

  test("bytes this edition cannot read are set aside, and the reader is told", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 1, report: { format: "something-else" } }),
    );
    await mount();

    expect(seen.keep).toBe("unreadable");
    expect(seen.store?.getSnapshot().report).toBe(null);
    // Moved rather than discarded: the reader can still export the bytes from /your-data/.
    expect(window.localStorage.getItem(KEY)).toBe(null);
    const held = JSON.parse(window.localStorage.getItem("am:quarantine:v1") as string);
    expect(held.entries).toHaveLength(1);
    expect(held.entries[0].originalKey).toBe(KEY);
  });

  test("two mounted providers cannot overwrite or clear each other's newer work", async () => {
    const original = pinnedElsewhere();
    window.localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, report: original }));
    const { first, second } = await mountTwo();

    await act(async () => {
      expect(first.explain("A newer saved explanation from the first tab.").ok).toBe(true);
    });
    const durable = window.localStorage.getItem(KEY);
    await act(async () => {
      // No storage event is dispatched: the comparison must also happen at the action itself.
      expect(second.explain("An independent explanation retained in the second tab.").ok).toBe(
        true,
      );
    });
    expect(tabs.get("first")?.keep).toBe("kept");
    expect(tabs.get("second")?.keep).toBe("conflict");
    expect(window.localStorage.getItem(KEY)).toBe(durable);
    const local = second.getSnapshot().report as InvestigationReport;
    expect(JSON.parse(exportInvestigationJson(local)).explanation).toBe(
      "An independent explanation retained in the second tab.",
    );
    expect(exportInvestigationHtml(local)).toContain(
      "An independent explanation retained in the second tab.",
    );

    await act(async () => {
      expect(second.restartConfirmed().ok).toBe(false);
    });
    expect(second.getSnapshot().report).toBe(local);
    expect(window.localStorage.getItem(KEY)).toBe(durable);
    const notice = container.querySelector('[data-investigation-keep="conflict"]');
    expect(notice?.textContent).toContain("Download this investigation before reloading");
    expect(notice?.querySelector('a[href="/notebook/"]')).not.toBe(null);
  });

  test("a storage event warns without replacing the current tab's report", async () => {
    const original = pinnedElsewhere();
    window.localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, report: original }));
    await mount();
    const store = seen.store as InvestigationStore;
    const local = store.getSnapshot().report;
    await act(async () => {
      window.localStorage.removeItem(KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: null }));
    });
    expect(seen.keep).toBe("conflict");
    expect(store.getSnapshot().report).toBe(local);
    expect(window.localStorage.getItem(KEY)).toBe(null);
    await act(async () => {
      expect(store.explain("This deleted copy remains available only in this tab.").ok).toBe(true);
    });
    expect(window.localStorage.getItem(KEY)).toBe(null);
  });

  test("a full quarantine protects the original while new work remains exportable", async () => {
    const bytes = JSON.stringify({ schemaVersion: 99, report: {} });
    window.localStorage.setItem(KEY, bytes);
    window.localStorage.setItem(
      "am:quarantine:v1",
      JSON.stringify({
        schemaVersion: 1,
        entries: Array.from({ length: 50 }, (_, i) => ({
          originalKey: `am:fixture:${i}`,
          rawValue: "x",
          reason: "fixture",
          quarantinedAt: "2026-10-27T00:00:00.000Z",
        })),
      }),
    );
    await mount();
    expect(seen.keep).toBe("protected");
    const store = seen.store as InvestigationStore;
    await act(async () => {
      store.connect(session(), "fixture-source-v1");
      expect(store.begin("My new prediction stays in this tab.", task).ok).toBe(true);
      expect(store.explain("My explanation also stays complete.").ok).toBe(true);
    });
    const local = store.getSnapshot().report as InvestigationReport;
    expect(JSON.parse(exportInvestigationJson(local)).explanation).toBe(
      "My explanation also stays complete.",
    );
    await act(async () => {
      expect(store.restartConfirmed().ok).toBe(false);
    });
    expect(store.getSnapshot().report).toBe(local);
    expect(window.localStorage.getItem(KEY)).toBe(bytes);
    expect(seen.keep).toBe("protected");
  });

  test("blocked storage still permits an explicit second investigation on this page", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Browser storage is blocked");
      },
    });
    try {
      await mount();
      const store = seen.store as InvestigationStore;
      await act(async () => {
        store.connect(session(), "fixture-source-v1");
        expect(store.begin("First local investigation.", task).ok).toBe(true);
      });
      expect(seen.keep).toBe("unavailable");
      await act(async () => {
        const result = store.restartConfirmed();
        expect(result.ok).toBe(true);
        expect(result.message).toContain("New investigation on this page");
        expect(result.message).toContain("no saved copy was cleared");
      });
      expect(store.getSnapshot().report).toBe(null);
      expect(seen.keep).toBe("unavailable");
      await act(async () => {
        expect(store.begin("Second local investigation.", task).ok).toBe(true);
      });
      expect(seen.keep).toBe("unavailable");
      expect(
        JSON.parse(exportInvestigationJson(store.getSnapshot().report as InvestigationReport))
          .prediction,
      ).toBe("Second local investigation.");
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
      else Reflect.deleteProperty(window, "localStorage");
    }
  });

  test("a refused restart retains typed text and both downloads export this tab's work", async () => {
    const original = pinnedElsewhere();
    window.localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, report: original }));
    const { first, second } = await mountTwo();
    const host = container.querySelector<HTMLElement>(
      '[data-investigation-tab="second"] [data-native-workspace]',
    ) as HTMLElement;
    const mounted = mountInvestigationWorkspace(host, second, task);
    const explanation = host.querySelector<HTMLTextAreaElement>(
      'textarea[id$="-explanation"]',
    ) as HTMLTextAreaElement;
    explanation.value = "A typed explanation that has not been saved yet.";
    const local = second.getSnapshot().report;
    function button(label: string): HTMLButtonElement {
      const found = [...host.querySelectorAll("button")].find(
        (candidate) => candidate.textContent === label,
      );
      if (!found) throw new Error(`Missing investigation button: ${label}`);
      return found;
    }

    // Replace only browser download APIs. The real island, store, persistence, exporters, and
    // Blob contents remain under test; no browser navigation should leave this fixture.
    const createUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const clickAnchor = HTMLAnchorElement.prototype.click;
    const blobs = new Map<string, Blob>();
    const downloads = new Map<string, Blob>();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (blob: Blob) => {
        const url = `blob:http://localhost/local-investigation-${blobs.size}`;
        blobs.set(url, blob);
        return url;
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
    HTMLAnchorElement.prototype.click = function () {
      const blob = blobs.get(this.href);
      if (!blob) throw new Error("The investigation download did not use its local Blob");
      downloads.set(this.download, blob);
    };
    try {
      await act(async () => {
        expect(first.explain("The newer durable copy in another tab.").ok).toBe(true);
        button("Start another investigation").click();
        button("Replace this investigation").click();
      });
      const durable = window.localStorage.getItem(KEY);
      expect(second.getSnapshot().report).toBe(local);
      expect(explanation.value).toBe("A typed explanation that has not been saved yet.");
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        "saved investigation changed",
      );
      expect(host.textContent).not.toContain(
        "New investigation. The copy kept on this device is cleared",
      );

      await act(async () => {
        button("Download investigation JSON").click();
        button("Download printable investigation").click();
      });
      const json = downloads.get(`${PAPER}-investigation.json`);
      const html = downloads.get(`${PAPER}-investigation.html`);
      expect(json).toBeDefined();
      expect(html).toBeDefined();
      const exported = JSON.parse(await (json as Blob).text());
      expect(exported.prediction).toBe(original.prediction);
      expect(exported.baseline).toEqual(original.baseline);
      expect(exported.explanation).toBe(explanation.value);
      expect(await (html as Blob).text()).toContain(explanation.value);
      expect(window.localStorage.getItem(KEY)).toBe(durable);
      expect(tabs.get("second")?.keep).toBe("conflict");
    } finally {
      mounted.dispose();
      HTMLAnchorElement.prototype.click = clickAnchor;
      if (createUrl) Object.defineProperty(URL, "createObjectURL", createUrl);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (revokeUrl) Object.defineProperty(URL, "revokeObjectURL", revokeUrl);
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });
});
