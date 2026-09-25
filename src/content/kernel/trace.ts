import { BROWNIAN_QUANTITIES } from "../../equations/quantities.ts";
import { explainRefusal } from "../../experiments/results/explanations.ts";
import { createDeclaredConstantSet } from "../../physics/reference/constants.ts";
import {
  rmsDisplacement,
  stokesEinsteinD,
} from "../../physics/reference/diffusion/distributions.ts";
import { ftcs1d } from "../../physics/reference/diffusion/ftcs.ts";
import type { TraceRow } from "../schemas/experiment.ts";
import { checkTraceRowCount } from "./traceValidation.ts";
import type { KernelIssue, WorkedTrace } from "./types.ts";

export const BM01_TRACE_SCENARIO_ID = "diffusion-einstein-1905-printed";
export const BM01_TRACE_CONSTANT_SET_LABEL = "Declared 1905-plan inputs";
export const BM01_TRACE_CONSTANT_SET_ID = "scenario-einstein-1905-brownian-printed";

/** Chosen values from the project plan, in SI. Legacy IDs do not certify transcription. */
export const BM01_PRINTED_INPUTS = Object.freeze({
  R: 8.31,
  T: 290.15,
  N: 6e23,
  eta: 1.35e-3,
  a: 0.5e-6,
});

export function printedBrownianConstantSet() {
  return createDeclaredConstantSet({
    id: BM01_TRACE_CONSTANT_SET_ID,
    era: 1905,
    provenance:
      "Chosen teaching inputs from the project plan: R = 8.31 J mol^-1 K^-1 and N = 6e23 mol^-1. These are not measurements or checked transcriptions. The reserved historical set remains unavailable.",
    precisionNote:
      "Declared decimal inputs; neither measurement uncertainties nor source review are asserted.",
    gasConstantProvenance: "not-applicable",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: BM01_PRINTED_INPUTS.R,
        exactDecimal: "8.31",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "Chosen R = 8.31 J mol^-1 K^-1 for this arithmetic exercise.",
        dependsOn: [],
      },
      {
        quantityId: "avogadroConstant",
        value: BM01_PRINTED_INPUTS.N,
        exactDecimal: "6e23",
        unit: "1/mol",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "Chosen N = 6e23 mol^-1 for this arithmetic exercise.",
        dependsOn: [],
      },
    ],
  });
}

function row(
  label: string,
  expression: string,
  value: number | string,
  unit: string,
  quantityId?: string,
  opId?: string,
): TraceRow {
  return {
    label,
    expression,
    value,
    unit,
    ...(quantityId ? { quantityId } : {}),
    ...(opId ? { opId } : {}),
  };
}

export function computeBm01StokesEinsteinTrace(): WorkedTrace {
  const { R, T, N, eta, a } = BM01_PRINTED_INPUTS;
  const set = printedBrownianConstantSet();
  const evaluated = stokesEinsteinD({ T, eta, a, medium: "liquid" }, set);
  if (evaluated.result.status !== "value") {
    return {
      scenarioId: BM01_TRACE_SCENARIO_ID,
      constantSetId: set.id,
      constantSetLabel: BM01_TRACE_CONSTANT_SET_LABEL,
      functionName: "stokesEinsteinD",
      rows: [
        row(
          "The Stokes–Einstein evaluation refused",
          "D = RT / (N 6 π η a)",
          evaluated.result.status,
          "",
        ),
      ],
      terminatedAtRow: 0,
      refusalMessage:
        evaluated.result.status === "outside-domain" ? evaluated.result.reason : undefined,
    };
  }
  const RT = R * T;
  const drag = 6 * Math.PI * eta * a;
  const moleDrag = N * drag;
  const D = typeof evaluated.result.value === "number" ? evaluated.result.value : 0;
  const rms1 = rmsDisplacement(D, 1);
  const rms60 = rmsDisplacement(D, 60);
  const rows: TraceRow[] = [
    row(
      "The gas constant in SI",
      // Drawn by ShowTheCode through withScripts; it printed "R = 8.31e7 erg mol^{-1} K^{-1}".
      "R = 8.31 × 10^{7} erg mol^{−1} K^{−1}",
      R,
      "J mol^{-1} K^{-1}",
      "molarGasConstant",
    ),
    row("Thermal energy per mole", "RT", RT, "J mol^{-1}", "molarGasConstant"),
    row(
      "Drag on one sphere",
      "6 π η a",
      drag,
      "kg s^{-1}",
      "viscosity",
      "eq-model-bm-diffusivity.op.drag",
    ),
    row(
      "Drag on a mole of spheres",
      "N 6 π η a",
      moleDrag,
      "kg s^{-1} mol^{-1}",
      "avogadroConstant",
    ),
    row(
      "Diffusion coefficient",
      "RT / (N 6 π η a)",
      D,
      "m^2 s^{-1}",
      "diffusionCoefficient",
      "eq-model-bm-diffusivity.op.equality",
    ),
  ];
  if (rms1.result.status === "value") {
    rows.push(
      row(
        "Coordinate RMS at 1 s",
        "λ_x = √(2 D t) at t = 1 s",
        typeof rms1.result.value === "number" ? rms1.result.value : 0,
        "m",
        "rmsDisplacement1d",
        "eq-model-bm-rms.op.squareRoot",
      ),
    );
  }
  if (rms60.result.status === "value") {
    rows.push(
      row(
        "Coordinate RMS at 60 s",
        "λ_x = √(2 D t) at t = 60 s",
        typeof rms60.result.value === "number" ? rms60.result.value : 0,
        "m",
        "rmsDisplacement1d",
        "eq-model-bm-rms.op.squareRoot",
      ),
    );
  }
  return {
    scenarioId: BM01_TRACE_SCENARIO_ID,
    constantSetId: set.id,
    constantSetLabel: BM01_TRACE_CONSTANT_SET_LABEL,
    functionName: "stokesEinsteinD",
    rows,
  };
}

export function computeFtcsUnstableTrace(): WorkedTrace {
  const result = ftcs1d({
    n: 8,
    frames: 4,
    stepsPerFrame: 1,
    D: 1,
    dx: 1,
    dt: 1,
    profile: 0,
  });
  if (result.kind !== "refused") {
    throw new Error(
      "Expected ftcs1d to refuse an unstable step; the stability check did not fire.",
    );
  }
  const explained = explainRefusal(result.refusal);
  return {
    scenarioId: "ftcs-stability-limit",
    constantSetId: "modern-si-2019",
    constantSetLabel: "modern-si-2019",
    functionName: "ftcs1d",
    rows: [
      row(
        "Explicit diffusion step",
        "r = D dt / dx^2",
        explained.message,
        "",
        "diffusionCoefficient",
      ),
    ],
    terminatedAtRow: 0,
    refusalCode: result.refusal.code,
    refusalMessage: explained.message,
  };
}

export function assertTraceBounds(
  instrumentId: string,
  functionName: string,
  rows: readonly TraceRow[],
): KernelIssue[] {
  return checkTraceRowCount(instrumentId, functionName, rows.length);
}

export function roleForQuantity(quantityId: string): "result" | "input" | "constant" | undefined {
  const q = BROWNIAN_QUANTITIES[quantityId];
  if (q) return q.role;
  if (
    quantityId === "molarGasConstant" ||
    quantityId === "avogadroConstant" ||
    quantityId.endsWith("Constant") ||
    quantityId.startsWith("constant")
  ) {
    return "constant";
  }
  return undefined;
}

export function renderTraceMarkup(trace: WorkedTrace): string {
  const rows = trace.rows
    .map((r, i) => {
      const qty = r.quantityId ? ` data-quantity-id="${r.quantityId}"` : "";
      const op = r.opId ? ` data-op-id="${r.opId}"` : "";
      const role = r.quantityId ? roleForQuantity(r.quantityId) : undefined;
      const roleCls = role ? ` class="am-role-${role}"` : "";
      const value = typeof r.value === "number" ? String(r.value) : r.value;
      const expr = r.opId
        ? `<a href="#${escapeHtml(r.opId)}" aria-label="Operation explanation for ${escapeHtml(r.opId)}">${escapeHtml(r.expression)}</a>`
        : escapeHtml(r.expression);
      return `<tr${qty}${op}${roleCls}><th scope="row">${escapeHtml(r.label)}</th><td>${expr}</td><td>${escapeHtml(value)}</td><td>${escapeHtml(r.unit)}</td></tr><!--${i}-->`;
    })
    .join("");
  const stopped =
    trace.terminatedAtRow !== undefined
      ? `<p>${escapeHtml(trace.refusalMessage ?? "The calculation stopped at this row.")}</p>`
      : "";
  return `<table class="kernel-trace" data-constant-set="${escapeHtml(trace.constantSetLabel)}" data-scenario="${escapeHtml(trace.scenarioId)}"><caption>One worked example of this calculation. Constant set: ${escapeHtml(trace.constantSetLabel)}.</caption><thead><tr><th>Step</th><th>Expression</th><th>Value</th><th>Unit</th></tr></thead><tbody>${rows}</tbody></table>${stopped}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
