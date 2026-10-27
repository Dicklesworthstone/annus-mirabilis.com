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
  exportInvestigationJson,
  type InvestigationReport,
  type InvestigationStore,
} from "./core.ts";
import { INVESTIGATIONS } from "./specs.ts";

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

function Probe() {
  seen = { store: useDiscoveryInvestigation(), keep: useInvestigationKeepStatus() };
  return null;
}

describe("the provider joins the store to the reader's device", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    seen = { store: null, keep: "idle" };
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
});
