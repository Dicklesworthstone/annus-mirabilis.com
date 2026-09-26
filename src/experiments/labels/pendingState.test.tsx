import { afterAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getLogger } from "../../testing/log/logger.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import { deriveCurrencyState } from "./currencyState.ts";
import { ExecutionChrome } from "./ExecutionChrome.tsx";
import { executionLabelFor } from "./executionLabelFor.ts";

const logger = getLogger("execution-labels");
const BEAD = "am-inst-execution-labels-5ywv";

function options() {
  return {
    experimentId: "bm-01",
    instanceId: "bm-01:pending",
    initialParameters: { D: 1, seed: "0" },
    parameterClasses: { D: "input" as const, seed: "input" as const },
    outputs: {
      tracerPositions: {
        statuses: ["value"] as const,
        unit: "m",
        semanticKind: "synthetic-tracer-endpoints-xyz",
        ownerId: "diffusion.recordTracers",
      },
    },
  };
}

const output = {
  quantityId: "tracerPositions",
  unit: "m",
  semanticKind: "synthetic-tracer-endpoints-xyz",
  ownerId: "diffusion.recordTracers",
  status: "value" as const,
  value: 1,
};

describe("pendingState: the engine label persists across pending requests", () => {
  test("a pending continue keeps Ideal model, host calculation and shows the running indicator", () => {
    const store = createInstanceStore(options());
    const token = store.issue("setup-change");
    store.publish({ ...token, stepIndex: 0, simulationTime: 0, final: true, outputs: [output] });
    const acceptedHtml = renderToStaticMarkup(
      createElement(ExecutionChrome, {
        state: "host-accepted",
        view: store.getSnapshot(),
      }),
    );
    expect(acceptedHtml).toContain(executionLabelFor("host-accepted").text);
    // The accepted state shows no currency notice; only running, refused and stale are news
    // (dispatch 259).
    expect(acceptedHtml).not.toContain("data-currency-state");

    store.issue("continue");
    const pending = store.getSnapshot();
    expect(pending.pending).toBe(true);
    expect(deriveCurrencyState(pending)).toBe("running");
    const pendingHtml = renderToStaticMarkup(
      createElement(ExecutionChrome, { state: "host-accepted", view: pending }),
    );
    expect(pendingHtml).toContain(executionLabelFor("host-accepted").text);
    expect(pendingHtml).toContain('data-execution-label="host"');
    expect(pendingHtml).toContain('data-currency-state="running"');
    expect(pendingHtml).toContain("previous accepted inputs");
    logger.log({
      testId: "pending-keeps-host-label",
      beadId: BEAD,
      extra: { executionLabel: "host", currencyState: "running" },
      outcome: "passed",
      message: "pending request keeps the last accepted engine label",
    });
  });

  test("a pending request never switches the engine label to FrankenSim", () => {
    const store = createInstanceStore(options());
    const token = store.issue("setup-change");
    store.publish({ ...token, stepIndex: 0, simulationTime: 0, final: true, outputs: [output] });
    store.issue("continue");
    const html = renderToStaticMarkup(
      createElement(ExecutionChrome, {
        state: "host-accepted",
        view: store.getSnapshot(),
      }),
    );
    expect(html).not.toContain("computed with FrankenSim");
    expect(html).not.toContain('data-execution-label="frankensim"');
  });
});

afterAll(async () => {
  await logger.flush();
});
