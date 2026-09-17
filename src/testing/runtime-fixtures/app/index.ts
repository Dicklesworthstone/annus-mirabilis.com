/**
 * Runtime-conformance fixture application (am-rt-browser-conformance-09i5).
 * Client-side routes so mount/unmount is real. Each instrument placement owns
 * a dedicated Worker through the real scheduler and instance store.
 */

import type { ScientificResult } from "../../../experiments/results/types.ts";
import {
  instrumentRootAttributes,
  viewRootAttributes,
} from "../../../experiments/store/identityAttributes.ts";
import { liveWorkerCount } from "./channel.ts";
import { createRuntimePlacement, type RuntimePlacement } from "./placement.ts";
import { RUNTIME_FIXTURE_EXPERIMENT_ID } from "./protocol.ts";

const INSTANCE_A = "runtime-analytic-a";
const INSTANCE_B = "runtime-analytic-b";

type ConformanceHooks = {
  injectStaleResponse: (instanceId: string) => void;
  crashWorker: (instanceId: string) => void;
  forceProtocolMismatch: (instanceId: string) => void;
  readExperimentView: (instanceId: string) => unknown;
  readCounters: () => { liveWorkers: number; workerMessages: Record<string, number> };
  workerMessageCount: (instanceId: string) => number;
  observerChange: (instanceId: string, frameSpeed: number) => void;
  measurementChange: (instanceId: string, interval: number) => void;
  presentationChange: (instanceId: string) => void;
  publishAfterTeardown: (instanceId: string) => boolean;
};

declare global {
  interface Window {
    __amRuntimeConformance?: ConformanceHooks;
  }
}

const placements = new Map<string, RuntimePlacement>();
const tornDown = new Map<string, RuntimePlacement["store"]>();

function seedFromLocation(): string {
  const params = new URLSearchParams(location.search);
  return params.get("seed") ?? "1";
}

function routeIsRuntime(): boolean {
  return location.hash.startsWith("#/runtime");
}

function numericOutput(
  view: ReturnType<RuntimePlacement["store"]["getSnapshot"]>,
  id: string,
): number | undefined {
  const output = view.accepted?.outputs.find((item) => item.quantityId === id);
  if (output === undefined || output.status !== "value") return undefined;
  return typeof output.value === "number" ? output.value : undefined;
}

function executionLabel(view: ReturnType<RuntimePlacement["store"]["getSnapshot"]>): string {
  if (view.status === "unavailable") return "unavailable";
  if (view.accepted) return "host";
  return "static";
}

function renderPlacement(placement: RuntimePlacement, mount: HTMLElement): void {
  const view = placement.store.getSnapshot();
  const attrs = instrumentRootAttributes(view);
  const identity = viewRootAttributes(view);
  mount.setAttribute("data-instrument-id", RUNTIME_FIXTURE_EXPERIMENT_ID);
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) mount.setAttribute(name, value);
  } else {
    mount.setAttribute("data-instance-id", placement.instanceId);
    mount.setAttribute(
      "data-run-id",
      view.requested?.runId ?? `${placement.instanceId}/run/pending`,
    );
    mount.setAttribute("data-snapshot-version", "0");
    mount.setAttribute("data-input-revision", "0");
    mount.setAttribute("data-accepted-input-revision", "0");
    mount.setAttribute("data-pending", view.pending ? "true" : "false");
  }
  mount.setAttribute("data-execution-label", executionLabel(view));
  const probe = numericOutput(view, "fixtureProbe");
  const latent = numericOutput(view, "latentDraws");
  const noise = numericOutput(view, "noiseDraws");
  if (view.accepted && probe !== undefined) mount.setAttribute("data-result-status", "value");
  else mount.removeAttribute("data-result-status");
  if (view.refusal) mount.setAttribute("data-refusal-code", view.refusal.code);
  else mount.removeAttribute("data-refusal-code");
  if (view.outcome) mount.setAttribute("data-execution-outcome", view.outcome.outcome);
  else mount.removeAttribute("data-execution-outcome");

  const version = identity?.["data-snapshot-version"] ?? "0";
  const runId = identity?.["data-run-id"] ?? mount.getAttribute("data-run-id") ?? "";
  const instanceId = placement.instanceId;
  const label = executionLabel(view);
  const probeText = probe === undefined ? "The worked example is 0.5 at seed 1." : String(probe);
  mount.innerHTML = `
    <div data-view="plot" data-instance-id="${instanceId}" data-run-id="${runId}" data-snapshot-version="${version}">
      <p>Plot of the fixture probe.</p>
      <p data-probe-value>${probeText}</p>
    </div>
    <div data-view="equation" data-instance-id="${instanceId}" data-run-id="${runId}" data-snapshot-version="${version}">
      <p>The probe is ${probeText}</p>
    </div>
    <div data-view="table" data-instance-id="${instanceId}" data-run-id="${runId}" data-snapshot-version="${version}">
      <table>
        <tr><th>probe</th><td>${probeText}</td></tr>
        <tr><th>latent draws</th><td data-latent-draws>${latent ?? 0}</td></tr>
        <tr><th>noise draws</th><td data-noise-draws>${noise ?? 0}</td></tr>
      </table>
    </div>
    <p data-execution-note>Computed on the ${label} path.</p>
  `;
  // Event identities and rest-frame worldline invariants do not depend on frame speed.
  mount.setAttribute(
    "data-event-set-digest",
    "event-origin-emission,event-sensor-trigger,event-absorber-impact,event-echo-detection",
  );
  mount.setAttribute("data-worldline-digest", "worldline-emitter,worldline-signal");
}

function mountRuntime(root: HTMLElement, blockWorkers: boolean): void {
  root.innerHTML = `
    <p class="lead">Two independent placements of the same analytic fixture, each with its own worker.</p>
    <div id="placement-a"></div>
    <div id="placement-b"></div>
    <p>
      <button type="button" data-observer-toggle>Change frame speed</button>
      <button type="button" data-measurement-toggle>Change observation interval</button>
      <button type="button" data-presentation-toggle>Change presentation</button>
    </p>
  `;
  const seed = seedFromLocation();
  for (const id of [INSTANCE_A, INSTANCE_B]) {
    const placement = createRuntimePlacement(id, blockWorkers);
    placements.set(id, placement);
    placement.store.subscribe(() => {
      const node = document.getElementById(id === INSTANCE_A ? "placement-a" : "placement-b");
      if (node) renderPlacement(placement, node);
      markReady(root);
    });
    placement.issueSetup(seed, 0);
    const node = document.getElementById(id === INSTANCE_A ? "placement-a" : "placement-b");
    if (node) renderPlacement(placement, node);
  }
  root.querySelector("[data-observer-toggle]")?.addEventListener("click", () => {
    placements.get(INSTANCE_A)?.observerChange(0.6);
  });
  root.querySelector("[data-measurement-toggle]")?.addEventListener("click", () => {
    placements.get(INSTANCE_A)?.measurementChange(0.2);
  });
  root.querySelector("[data-presentation-toggle]")?.addEventListener("click", () => {
    placements.get(INSTANCE_A)?.presentationChange();
  });
}

function mountReading(root: HTMLElement): void {
  root.innerHTML = `
    <p class="lead">Static worked example. The probe at seed 1 is 0.5. No worker is started on this route.</p>
    <p><a href="#/runtime">Open the runtime placements</a></p>
    <div data-instrument-id="${RUNTIME_FIXTURE_EXPERIMENT_ID}" data-instance-id="runtime-static" data-run-id="runtime-static/run/0" data-snapshot-version="0" data-input-revision="0" data-accepted-input-revision="0" data-pending="false" data-execution-label="static" data-result-status="value">
      <div data-view="plot" data-instance-id="runtime-static" data-run-id="runtime-static/run/0" data-snapshot-version="0"><p>Worked plot</p></div>
      <div data-view="equation" data-instance-id="runtime-static" data-run-id="runtime-static/run/0" data-snapshot-version="0"><p>The probe is 0.5</p></div>
      <div data-view="table" data-instance-id="runtime-static" data-run-id="runtime-static/run/0" data-snapshot-version="0"><p>seed 1</p></div>
    </div>
  `;
  root.dataset.ready = "true";
}

function disposeRuntime(): void {
  for (const [id, placement] of placements) {
    tornDown.set(id, placement.store);
    placement.dispose();
  }
  placements.clear();
}

function markReady(root: HTMLElement): void {
  const ready = [...placements.values()].every((placement) => {
    const view = placement.store.getSnapshot();
    return view.accepted !== null || view.status === "unavailable";
  });
  if (ready && placements.size > 0) root.dataset.ready = "true";
}

function renderApp(): void {
  const root = document.querySelector<HTMLElement>("[data-reader-root]");
  if (!root) return;
  root.dataset.view = routeIsRuntime() ? "runtime" : "reading";
  root.dataset.ready = "false";
  disposeRuntime();
  if (routeIsRuntime())
    mountRuntime(root, new URLSearchParams(location.search).get("blockWorkers") === "1");
  else mountReading(root);
}

function installHooks(): void {
  window.__amRuntimeConformance = {
    injectStaleResponse(instanceId) {
      placements.get(instanceId)?.injectStale();
    },
    crashWorker(instanceId) {
      placements.get(instanceId)?.crashWorker();
    },
    forceProtocolMismatch(instanceId) {
      placements.get(instanceId)?.forceProtocolMismatch();
    },
    readExperimentView(instanceId) {
      return placements.get(instanceId)?.store.getSnapshot() ?? null;
    },
    readCounters() {
      const workerMessages: Record<string, number> = {};
      for (const [id, placement] of placements) {
        workerMessages[id] = placement.diagnostics().workerMessages;
      }
      return { liveWorkers: liveWorkerCount(), workerMessages };
    },
    workerMessageCount(instanceId) {
      return placements.get(instanceId)?.diagnostics().workerMessages ?? 0;
    },
    observerChange(instanceId, frameSpeed) {
      placements.get(instanceId)?.observerChange(frameSpeed);
    },
    measurementChange(instanceId, interval) {
      placements.get(instanceId)?.measurementChange(interval);
    },
    presentationChange(instanceId) {
      placements.get(instanceId)?.presentationChange();
    },
    publishAfterTeardown(instanceId) {
      const store = tornDown.get(instanceId);
      if (!store) return false;
      const accepted = store.getSnapshot().accepted;
      if (!accepted) return false;
      const decision = store.publish({
        ...accepted,
        actionIndex: accepted.actionIndex,
        stepIndex: accepted.stepIndex + 1,
        simulationTime: accepted.simulationTime + 1,
        final: true,
        outputs: accepted.outputs.map((output): ScientificResult => {
          if (output.status === "value") {
            if (typeof output.value === "number") {
              return { ...output, value: 12345 };
            }
            return { ...output, value: output.value.copy() };
          }
          return output as unknown as ScientificResult;
        }),
      });
      return decision.accepted;
    },
  };
}

if (typeof document !== "undefined") {
  installHooks();
  window.addEventListener("hashchange", () => {
    renderApp();
  });
  renderApp();
}
