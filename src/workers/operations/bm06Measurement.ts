import { intervalProbability } from "../../physics/reference/diffusion/distributions.ts";
import { validateBm06Parameters } from "../../experiments/bm06/parameters.ts";
import type { Bm06Parameters } from "../../experiments/bm06/definition.ts";
import type { Bm06Evaluation } from "./bm06.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";

/** Reselecting an interval reads the existing field; it never reruns numerical diffusion. */
export function remeasureBm06(previous: Bm06Parameters, data: Bm06Evaluation, requested: Bm06Parameters): Computation<Bm06Evaluation> | null {
  if (Object.keys(previous).some(k => k !== "lower" && k !== "upper" && previous[k as keyof Bm06Parameters] !== requested[k as keyof Bm06Parameters])) return null;
  const checked = validateBm06Parameters(requested);
  if (checked.kind !== "accepted") return checked;
  const diffusivity = data.outputs.find(o => o.quantityId === "diffusionCoefficient");
  if (diffusivity?.status !== "value" || typeof diffusivity.value !== "number") return null;
  const probability = intervalProbability(requested.lower, requested.upper, requested.t, diffusivity.value).result;
  if (probability.status !== "value") return { kind: "outcome", outcome: { outcome: "invariant-violation", ...executionOutcomeRegistry["invariant-violation"] } };
  return { kind: "accepted", data: { ...data, outputs: data.outputs.map(o => o.quantityId === "intervalProbability" ? probability : o) } };
}
