/**
 * Interactive Selftest Fixture Application
 * Specification: am-test-e2e-harness-bqmh requirements 8 and 9.
 *
 * Mounts the pure SelftestState machine into the DOM with all contract
 * attributes, views, controls, and scriptable behaviors.
 */

import {
  applyInput,
  blockWasm,
  initialSelftestState,
  loseContext,
  requestInput,
  restart,
  restoreContext,
  restoreFromTape,
  type SelftestState,
  serializeTape,
} from "./instrument.ts";

export class SelftestApp {
  private state: SelftestState;
  private instrumentAddress: string;
  private rootElement: HTMLElement;
  private pendingRevisions: number[] = [];

  constructor(container: HTMLElement) {
    this.rootElement = container;
    const url = new URL(typeof window !== "undefined" ? window.location.href : "http://127.0.0.1/");
    const tapeParam = url.searchParams.get("tape");
    const modeParam = url.searchParams.get("mode");
    const instrumentIdParam = url.searchParams.get("instrumentId");

    const instanceId = url.searchParams.get("instanceId") ?? "inst-selftest-1";
    const runId = url.searchParams.get("runId") ?? "run-selftest-1";

    if (tapeParam) {
      try {
        this.state = restoreFromTape(tapeParam);
      } catch {
        this.state = initialSelftestState(instanceId, runId);
      }
    } else {
      this.state = initialSelftestState(instanceId, runId);
    }

    if (instrumentIdParam) {
      this.instrumentAddress = instrumentIdParam;
    } else if (modeParam) {
      this.instrumentAddress = `harness-selftest:${modeParam}`;
    } else {
      this.instrumentAddress = "bm-01";
    }

    this.init();
  }

  private async init() {
    // Probe WASM availability
    try {
      const response = await fetch("fixture.wasm");
      if (!response.ok) {
        this.state = blockWasm(this.state);
      }
    } catch {
      this.state = blockWasm(this.state);
    }

    this.render();
  }

  public getState(): SelftestState {
    return this.state;
  }

  public handleInputChange(newValue: number) {
    this.state = requestInput(this.state, newValue);
    const rev = this.state.inputRevision;
    this.pendingRevisions.push(rev);
    this.render();

    // Async application simulating worker response
    setTimeout(() => {
      this.state = applyInput(this.state, rev);
      this.render();
    }, 10);
  }

  public handleDelayedResponse(olderRev: number) {
    this.state = applyInput(this.state, olderRev);
    this.render();
  }

  public handleStep() {
    this.handleInputChange(this.state.acceptedParams.value + 1);
  }

  public handleRestart() {
    const newRunId = `run-selftest-${Date.now()}`;
    this.state = restart(this.state, newRunId);
    this.render();
  }

  public handleLoseContext() {
    this.state = loseContext(this.state);
    this.render();
  }

  public handleRestoreContext() {
    this.state = restoreContext(this.state);
    this.render();
  }

  public handleBlockWasm() {
    this.state = blockWasm(this.state);
    this.render();
  }

  public render() {
    const s = this.state;
    // Set contract attributes on root
    this.rootElement.setAttribute("data-instrument-id", this.instrumentAddress);
    this.rootElement.setAttribute("data-instance-id", s.instanceId);
    this.rootElement.setAttribute("data-run-id", s.runId);
    this.rootElement.setAttribute("data-snapshot-version", String(s.snapshotVersion));
    this.rootElement.setAttribute("data-input-revision", String(s.inputRevision));
    this.rootElement.setAttribute("data-accepted-input-revision", String(s.acceptedInputRevision));
    this.rootElement.setAttribute("data-pending", s.pending ? "true" : "false");
    this.rootElement.setAttribute("data-execution-label", s.executionLabel);

    if (s.resultStatus) {
      this.rootElement.setAttribute("data-result-status", s.resultStatus);
    } else {
      this.rootElement.removeAttribute("data-result-status");
    }

    if (s.refusalCode) {
      this.rootElement.setAttribute("data-refusal-code", s.refusalCode);
    } else {
      this.rootElement.removeAttribute("data-refusal-code");
    }

    const tape = serializeTape(s);

    this.rootElement.innerHTML = `
      <div class="selftest-container" style="padding: 16px; font-family: sans-serif;">
        <header>
          <h2>Selftest Fixture Instrument: <code>${this.instrumentAddress}</code></h2>
          <div class="status-badge">Execution Label: <strong id="selftest-execution-label">${s.executionLabel}</strong></div>
          <div class="refusal-badge" id="selftest-refusal" style="color: red;">${s.refusalCode ? `Refusal: ${s.refusalCode}` : ""}</div>
        </header>

        <section class="controls" style="margin: 16px 0;">
          <label for="selftest-input">Input Value (0-100): </label>
          <input id="selftest-input" type="number" value="${s.requestedParams.value}" />
          <button id="selftest-step">Step (+1)</button>
          <button id="selftest-restart">Restart</button>
          <button id="selftest-lose-context">Lose WebGL Context</button>
          <button id="selftest-restore-context">Restore WebGL Context</button>
          <button id="selftest-block-wasm">Block WASM</button>
          <button id="selftest-delay-response">Trigger Delayed Response</button>
        </section>

        <section class="views" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
          <div data-view="trace" data-instance-id="${s.instanceId}" data-run-id="${s.runId}" data-snapshot-version="${s.snapshotVersion}">
            <h3>Trace View</h3>
            <p>Value: ${s.acceptedParams.value}</p>
          </div>
          <div data-view="distribution" data-instance-id="${s.instanceId}" data-run-id="${s.runId}" data-snapshot-version="${s.snapshotVersion}">
            <h3>Distribution View</h3>
            <p>Snapshot Version: ${s.snapshotVersion}</p>
          </div>
          <div data-view="equation" data-instance-id="${s.instanceId}" data-run-id="${s.runId}" data-snapshot-version="${s.snapshotVersion}">
            <h3>Equation View</h3>
            <math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi><mo>=</mo><mn>${s.acceptedParams.value}</mn></mrow></semantics></math>
          </div>
          <div data-view="table" data-instance-id="${s.instanceId}" data-run-id="${s.runId}" data-snapshot-version="${s.snapshotVersion}">
            <h3>Table View</h3>
            <p>Run: ${s.runId}</p>
          </div>
          <div data-view="a11y" data-instance-id="${s.instanceId}" data-run-id="${s.runId}" data-snapshot-version="${s.snapshotVersion}">
            <h3>Accessible Description</h3>
            <p>Current accepted value is ${s.acceptedParams.value}</p>
          </div>
        </section>

        <footer style="margin-top: 16px;">
          <a id="selftest-share-tape" href="?tape=${encodeURIComponent(tape)}">Share Link (?tape=...)</a>
        </footer>
      </div>
    `;

    // Wire up events
    const inputEl = this.rootElement.querySelector<HTMLInputElement>("#selftest-input");
    inputEl?.addEventListener("change", (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      this.handleInputChange(val);
    });

    this.rootElement.querySelector("#selftest-step")?.addEventListener("click", () => {
      this.handleStep();
    });

    this.rootElement.querySelector("#selftest-restart")?.addEventListener("click", () => {
      this.handleRestart();
    });

    this.rootElement.querySelector("#selftest-lose-context")?.addEventListener("click", () => {
      this.handleLoseContext();
    });

    this.rootElement.querySelector("#selftest-restore-context")?.addEventListener("click", () => {
      this.handleRestoreContext();
    });

    this.rootElement.querySelector("#selftest-block-wasm")?.addEventListener("click", () => {
      this.handleBlockWasm();
    });

    this.rootElement.querySelector("#selftest-delay-response")?.addEventListener("click", () => {
      // Trigger a stale response from older revision 0
      this.handleDelayedResponse(0);
    });
  }
}

// Auto-mount in browser environments
if (typeof document !== "undefined") {
  const container =
    document.getElementById("app") || document.body.appendChild(document.createElement("div"));
  container.id = "app";
  new SelftestApp(container);
}
