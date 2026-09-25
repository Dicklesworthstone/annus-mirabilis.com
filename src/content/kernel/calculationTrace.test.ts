import { describe, expect, test } from "bun:test";
import { stokesEinsteinD } from "../../physics/reference/diffusion/distributions.ts";
import { getLogger } from "../../testing/log/logger.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import {
  BM01_PRINTED_INPUTS,
  computeBm01StokesEinsteinTrace,
  computeFtcsUnstableTrace,
  printedBrownianConstantSet,
  renderTraceMarkup,
} from "./trace.ts";
import { checkTraceRowCount, checkTraceScenario } from "./traceValidation.ts";
import { KERNEL_BEAD_ID, MAX_TRACE_ROWS } from "./types.ts";

const logger = getLogger("show-the-code");
const rel = { relative: 1e-9 } as const;

function independentPrinted(): {
  R: number;
  RT: number;
  drag: number;
  moleDrag: number;
  D: number;
  lambda1: number;
  lambda60: number;
} {
  const { R, T, N, eta, a } = BM01_PRINTED_INPUTS;
  const RT = R * T;
  const drag = 6 * Math.PI * eta * a;
  const moleDrag = N * drag;
  const D = RT / moleDrag;
  return {
    R,
    RT,
    drag,
    moleDrag,
    D,
    lambda1: Math.sqrt(2 * D * 1),
    lambda60: Math.sqrt(2 * D * 60),
  };
}

describe("calculation traces", () => {
  test("BM-01 rows match independent arithmetic and the real evaluator", () => {
    const trace = computeBm01StokesEinsteinTrace();
    const indie = independentPrinted();
    const set = printedBrownianConstantSet();
    const evaluated = stokesEinsteinD(
      { T: BM01_PRINTED_INPUTS.T, eta: BM01_PRINTED_INPUTS.eta, a: BM01_PRINTED_INPUTS.a },
      set,
    );
    expect(evaluated.result.status).toBe("value");
    const expected = [indie.R, indie.RT, indie.drag, indie.moleDrag, indie.D];
    expect(trace.rows.length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < 5; i++) {
      const value = trace.rows[i]?.value;
      const reference = expected[i];
      expect(typeof value).toBe("number");
      expect(typeof reference).toBe("number");
      if (typeof value !== "number" || typeof reference !== "number") continue;
      const verdict = withinTolerance(value, reference, rel);
      expect(verdict.ok).toBe(true);
    }
    expect(evaluated.result.status === "value" ? evaluated.result.value : NaN).toBe(indie.D);
    const rms1 = trace.rows.find((r) => r.label.includes("1 s"))?.value;
    const rms60 = trace.rows.find((r) => r.label.includes("60 s"))?.value;
    expect(typeof rms1).toBe("number");
    expect(typeof rms60).toBe("number");
    expect(withinTolerance(rms1 as number, indie.lambda1, rel).ok).toBe(true);
    expect(withinTolerance(rms60 as number, indie.lambda60, rel).ok).toBe(true);
    expect(withinTolerance(indie.RT, 2411.1465, rel).ok).toBe(true);
    expect(withinTolerance(indie.drag, 1.2723450247e-8, rel).ok).toBe(true);
    expect(withinTolerance(indie.D, 3.1584023374e-13, rel).ok).toBe(true);
    expect((indie.lambda1 * 1e6).toFixed(7)).toBe("0.7947833");
    expect((indie.lambda60 * 1e6).toFixed(7)).toBe("6.1563648");
    const markup = renderTraceMarkup(trace);
    expect(markup).toContain(trace.constantSetLabel);
    expect(markup.includes("6.1 μm")).toBe(false);
    // Declared, not measured; and no review clause (D-2026-09-25-no-review-status-banners).
    expect(trace.constantSetLabel).toBe("Declared 1905-plan inputs");
    expect(set.gasConstantProvenance).toBe("not-applicable");
    expect(set.entries.every((entry) => entry.evidentialRole === "declared-input")).toBe(true);
    logger.log({
      testId: "bm01-printed-trace",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-01",
      outcome: "passed",
      comparisonKind: "tolerance",
      tolerance: rel,
      message: "BM-01 printed trace matches independent arithmetic and stokesEinsteinD",
      extra: {
        traceScenarioId: trace.scenarioId,
        traceRowCount: trace.rows.length,
        traceConstantSetId: trace.constantSetId,
      },
    });
  });

  test("a 13-row fixture fails naming the function and the count", () => {
    const issues = checkTraceRowCount("bm-01", "stokesEinsteinD", 13);
    expect(issues[0]?.code).toBe("trace-rows-exceeded");
    expect(issues[0]?.message).toContain("stokesEinsteinD");
    expect(issues[0]?.message).toContain("13");
    expect(issues[0]?.message).toContain(String(MAX_TRACE_ROWS));
    logger.log({
      testId: "trace-13-rows",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-01",
      outcome: "passed",
      message: "13-row trace failed",
    });
  });

  test("an unregistered traceScenarioId fails", () => {
    const issues = checkTraceScenario("bm-01", "not-registered", [
      "diffusion-einstein-1905-printed",
    ]);
    expect(issues[0]?.code).toBe("unregistered-trace-scenario");
    expect(issues[0]?.message).toContain("not-registered");
    logger.log({
      testId: "unregistered-trace-scenario",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-01",
      outcome: "passed",
      message: "Unregistered traceScenarioId failed",
    });
  });

  test("an unstable ftcs scenario shows the refusing row and no later rows", () => {
    const trace = computeFtcsUnstableTrace();
    expect(trace.rows).toHaveLength(1);
    expect(trace.terminatedAtRow).toBe(0);
    expect(trace.refusalCode).toBe("ftcs-unstable");
    const markup = renderTraceMarkup(trace);
    expect(markup).toContain("too large for the explicit diffusion scheme");
    expect(markup.includes("ftcs-unstable")).toBe(false);
    logger.log({
      testId: "ftcs-unstable-trace",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-06",
      outcome: "passed",
      message: "Unstable FTCS trace stops with ordinary language",
      extra: { traceRefusalCode: trace.refusalCode, traceTerminatedAtRow: trace.terminatedAtRow },
    });
  });

  test("two builds produce byte-identical trace markup", () => {
    const a = renderTraceMarkup(computeBm01StokesEinsteinTrace());
    const b = renderTraceMarkup(computeBm01StokesEinsteinTrace());
    expect(a).toBe(b);
    logger.log({
      testId: "trace-markup-deterministic",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Trace markup is byte-identical across two computations",
    });
  });

  test("trace rows carrying quantityId use role tokens and rows carrying opId link to operation explanations", () => {
    const trace = computeBm01StokesEinsteinTrace();
    const markup = renderTraceMarkup(trace);

    // Rows carrying quantityId use the same role tokens as equation terms
    expect(markup).toContain('data-quantity-id="diffusionCoefficient"');
    expect(markup).toContain('class="am-role-result"');
    expect(markup).toContain('data-quantity-id="viscosity"');
    expect(markup).toContain('class="am-role-input"');
    expect(markup).toContain('data-quantity-id="molarGasConstant"');
    expect(markup).toContain('class="am-role-constant"');

    // Rows carrying opId link to the operation explanation anchor
    expect(markup).toContain('data-op-id="eq-model-bm-diffusivity.op.drag"');
    expect(markup).toContain(
      '<a href="#eq-model-bm-diffusivity.op.drag" aria-label="Operation explanation for eq-model-bm-diffusivity.op.drag">6 π η a</a>',
    );
    expect(markup).toContain('data-op-id="eq-model-bm-diffusivity.op.equality"');
    expect(markup).toContain(
      '<a href="#eq-model-bm-diffusivity.op.equality" aria-label="Operation explanation for eq-model-bm-diffusivity.op.equality">RT / (N 6 π η a)</a>',
    );
    expect(markup).toContain('data-op-id="eq-model-bm-rms.op.squareRoot"');
    expect(markup).toContain(
      '<a href="#eq-model-bm-rms.op.squareRoot" aria-label="Operation explanation for eq-model-bm-rms.op.squareRoot">λ_x = √(2 D t) at t = 1 s</a>',
    );

    // Rows without opId do not contain redundant anchor tags
    expect(markup).not.toContain('<a href="#undefined"');
    logger.log({
      testId: "trace-row-role-tokens-and-op-links",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Trace rows use equation role tokens and link opId to operation explanations",
    });
  });
});
