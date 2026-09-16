import { maxwellResidualsPlaneWave } from "../../physics/reference/fields.ts";
import { gamma } from "../../physics/reference/kinematics.ts";
import { encodeResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR07_CLASSES, SR07_DEFAULTS, SR07_OUTPUTS, type Sr07Parameters } from "./definition.ts";
import { validateSr07Parameters } from "./parameters.ts";

function identity(id: keyof typeof SR07_OUTPUTS) {
  const contract = SR07_OUTPUTS[id];
  if (!contract) throw new TypeError(`Unregistered SR-07 output: ${id}`);
  const { statuses: _s, ...c } = contract;
  return { quantityId: id, ...c };
}

function value(id: keyof typeof SR07_OUTPUTS, v: number): ScientificResult {
  return { ...identity(id), status: "value", value: v };
}

function absent(id: keyof typeof SR07_OUTPUTS, reason: string): ScientificResult {
  return {
    ...identity(id),
    status: "outside-domain",
    condition: reason,
    domainKind: "physical",
    reason,
    boundary: { parameterId: "boostBeta", value: 0.6 },
  };
}

export function evaluateSr07(
  p: Sr07Parameters,
  convention: "printed" | "flipped-z-prime" = "printed",
): ScientificResult[] {
  const g = gamma(p.boostBeta);
  if (g.status !== "value") {
    const reason = g.reason;
    return (Object.keys(SR07_OUTPUTS) as (keyof typeof SR07_OUTPUTS)[]).map((id) =>
      absent(id, reason),
    );
  }
  const report = maxwellResidualsPlaneWave({
    beta: p.boostBeta,
    wave: p.wave,
    polarization: p.polarization,
    convention,
  });
  return [
    value("residualMax", report.maxResidual),
    value("residualFaradayX", report.residuals[0] ?? 0),
    value("residualFaradayY", report.residuals[1] ?? 0),
    value("residualFaradayZ", report.residuals[2] ?? 0),
    value("residualAmpereX", report.residuals[3] ?? 0),
    value("residualAmpereY", report.residuals[4] ?? 0),
    value("residualAmpereZ", report.residuals[5] ?? 0),
    value("amplitudeFactor", report.amplitudeFactor),
    value("frequencyFactor", report.frequencyFactor),
    value("lorentzFactor", report.gamma),
    value("formInvariant", report.passed ? 1 : 0),
    value("stepIndexOut", p.stepIndex),
  ];
}

export type PreparedSr07Example = Readonly<{
  sourceDigest: string;
  parameters: Sr07Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr07Example = Object.freeze({
  sourceDigest: "src/physics/reference/fields.ts",
  parameters: SR07_DEFAULTS,
  results: evaluateSr07(SR07_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function createSr07Session(
  instanceId = "sr07-session",
  initialParameters: Sr07Parameters = SR07_DEFAULTS,
) {
  const store = createInstanceStore({
    experimentId: "sr-07",
    instanceId,
    initialParameters: initialParameters as unknown as Parameters,
    parameterClasses: SR07_CLASSES,
    outputs: SR07_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const published = store.publish({
    ...token,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    outputs: evaluateSr07(initialParameters),
  });
  if (!published.accepted) throw new Error("Invalid prepared SR-07 example.");
  const serverSnapshot = store.getSnapshot();
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    acceptedParameters(): Sr07Parameters {
      return (store.getSnapshot().accepted?.parameters ?? initialParameters) as Sr07Parameters;
    },
    apply(input: unknown) {
      const checked = validateSr07Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const previous = store.getSnapshot().accepted?.parameters as Sr07Parameters;
      const next = checked.data;
      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};
      for (const key of Object.keys(next) as (keyof Sr07Parameters)[]) {
        if (Object.is(next[key], previous[key])) continue;
        const cls = SR07_CLASSES[key];
        if (cls === "input") setup[key] = next[key];
        else if (cls === "observer") observer[key] = next[key];
        else presentation[key] = next[key];
      }
      let request = Object.keys(setup).length ? store.issue("setup-change", setup) : null;
      if (Object.keys(observer).length) request = store.issue("observer-change", observer);
      if (Object.keys(presentation).length)
        request = store.issue("presentation-change", presentation);
      request ??= store.issue("continue");
      const decision = store.publish({
        ...request,
        stepIndex: next.stepIndex,
        simulationTime: 0,
        final: true,
        outputs: evaluateSr07(next),
      });
      if (!decision.accepted) throw new Error(`SR-07 publication refused: ${decision.reason}`);
      return { kind: "accepted" as const, data: request };
    },
  });
}
