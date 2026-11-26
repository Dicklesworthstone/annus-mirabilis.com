import {
  alignedBoost,
  composeBoosts,
  composedSpeedShortfall,
  composePrinted,
  compositionIncrement,
  gamma,
  generalBoost,
  rapidity,
  speedOfLightMetresPerSecond,
  transformLightDirection,
  transformVelocity,
} from "../../physics/reference/kinematics.ts";
import { encodeResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import {
  SR06_CLASSES,
  SR06_DEFAULTS,
  SR06_EVENT_OUTPUTS,
  SR06_OUTPUTS,
  type Sr06Parameters,
  sr06CompositionSettings,
} from "./definition.ts";
import { measureVelocityFromEvents } from "./eventMeasurements.ts";
import { validateSr06Parameters } from "./parameters.ts";

function identity(id: keyof typeof SR06_OUTPUTS) {
  const contract = SR06_OUTPUTS[id];
  if (!contract) throw new TypeError(`Unregistered SR-06 output: ${id}`);
  const { statuses: _s, ...c } = contract;
  return { quantityId: id, ...c };
}

function value(id: keyof typeof SR06_OUTPUTS, v: number | Float64Array): ScientificResult {
  return { ...identity(id), status: "value", value: v };
}

function absent(
  id: keyof typeof SR06_OUTPUTS,
  status: "not-applicable" | "outside-domain",
  reason: string,
): ScientificResult {
  if (status === "not-applicable") return { ...identity(id), status, reason };
  return {
    ...identity(id),
    status,
    condition: reason,
    domainKind: "physical",
    reason,
    boundary: { alternativeModel: "Stay inside |v| < c and w ≤ c." },
  };
}

function flatten(matrix: readonly (readonly number[])[]): Float64Array {
  const out = new Float64Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out[i * 4 + j] = matrix[i]?.[j] ?? 0;
  return out;
}

export function evaluateSr06(p: Sr06Parameters): ScientificResult[] {
  const c = speedOfLightMetresPerSecond();
  // In two-boosts mode the composed velocity is the doubly boosted frame's: the second boost,
  // given in the intermediate frame, composed with the first. It used to stay the moving point's,
  // so the table read U = 0.882c beside the product's gamma 1.5625, which belongs to 0.768c.
  const active = sr06CompositionSettings(p);
  const w = active.speed;
  const alpha = (active.angleDeg * Math.PI) / 180;
  const wx = w * Math.cos(alpha);
  const wy = w * Math.sin(alpha);
  const lightRay = w === 1;
  const composed = lightRay
    ? transformLightDirection({ x: wx, y: wy, z: 0 }, -p.frameBeta, 1)
    : transformVelocity({ ux: wx, uy: wy, uz: 0 }, -p.frameBeta, 1);
  const outputs: ScientificResult[] = [];
  if (composed.status !== "value") {
    const reason = composed.reason;
    for (const id of Object.keys(SR06_OUTPUTS) as (keyof typeof SR06_OUTPUTS)[])
      outputs.push(absent(id, "outside-domain", reason));
    return outputs;
  }
  const events = measureVelocityFromEvents(p.frameBeta, wx, wy);
  if (events.status === "value") {
    for (const [id, readings] of Object.entries(events.value)) outputs.push(value(id, readings));
  } else {
    for (const id of Object.keys(SR06_EVENT_OUTPUTS)) outputs.push(absent(id, "outside-domain", events.reason));
  }

  const ux = composed.value.ux;
  const uy = composed.value.uy;
  const U = lightRay ? 1 : Math.hypot(ux, uy);
  const galilean = Math.hypot(p.frameBeta + wx, wy);
  outputs.push(
    value("movingUxOverC", wx),
    value("movingUyOverC", wy),
    value("galileanUxOverC", p.frameBeta + wx),
    value("galileanUyOverC", wy),
    value("composedUxOverC", ux),
    value("composedUyOverC", uy),
    value("composedSpeedOverC", U),
  );
  outputs.push(value("galileanSpeedOverC", galilean));
  const printed = composePrinted(p.frameBeta, w, alpha, 1);
  outputs.push(
    printed.status === "value"
      ? value("printedSpeedOverC", printed.value)
      : absent("printedSpeedOverC", "outside-domain", printed.reason),
  );
  // Transform the timelike four-velocity's time component. Computing gamma from a rounded
  // near-light speed can invent an infinite factor even though both supplied speeds are < c.
  const frameGamma = gamma(p.frameBeta);
  const movingGamma = lightRay ? null : gamma(w);
  const composedGamma =
    frameGamma.status === "value" && movingGamma?.status === "value"
      ? frameGamma.value * movingGamma.value * (1 + p.frameBeta * wx)
      : null;
  if (p.mode === "collinear" && w < 1) {
    // The owner returns 1 minus a signed velocity. Reflect both inputs when the resultant
    // points along -x so this readout remains the shortfall of the speed |U| from light speed.
    const direction = ux < 0 ? -1 : 1;
    const s = composedSpeedShortfall(direction * p.frameBeta, direction * w);
    outputs.push(
      s.status === "value"
        ? value("shortfall", s.value)
        : absent("shortfall", "outside-domain", s.reason),
    );
  } else if (lightRay) {
    outputs.push(value("shortfall", 0));
  } else {
    outputs.push(
      composedGamma !== null
        ? value("shortfall", 1 / composedGamma / composedGamma / (1 + U))
        : absent("shortfall", "outside-domain", "The timelike velocity factor is unavailable."),
    );
  }
  const back = lightRay
    ? transformLightDirection({ x: ux, y: uy, z: 0 }, p.frameBeta, 1)
    : transformVelocity({ ux, uy, uz: 0 }, p.frameBeta, 1);
  if (back.status === "value") {
    outputs.push(value("inverseUxOverC", back.value.ux), value("inverseUyOverC", back.value.uy));
  } else {
    outputs.push(
      absent("inverseUxOverC", "outside-domain", back.reason),
      absent("inverseUyOverC", "outside-domain", back.reason),
    );
  }
  if (p.mode === "two-boosts") {
    const first = alignedBoost(p.frameBeta, 1);
    const phi = (p.secondAngleDeg * Math.PI) / 180;
    const second = generalBoost(
      { bx: p.secondBeta * Math.cos(phi), by: p.secondBeta * Math.sin(phi), bz: 0 },
      1,
    );
    if (first.status === "value" && second.status === "value") {
      const product = composeBoosts(first.value, second.value);
      if (product.status === "value") {
        outputs.push(
          value("rotationDeg", (product.value.wignerAngle * 180) / Math.PI),
          value("composedGamma", product.value.boost.gamma),
          value("productMatrix", flatten(product.value.product)),
        );
      } else {
        outputs.push(
          absent("rotationDeg", "outside-domain", product.reason),
          absent("composedGamma", "outside-domain", product.reason),
          absent("productMatrix", "outside-domain", product.reason),
        );
      }
    } else {
      const msg =
        first.status !== "value" ? first.reason : second.status !== "value" ? second.reason : "";
      outputs.push(
        absent("rotationDeg", "outside-domain", msg),
        absent("composedGamma", "outside-domain", msg),
        absent("productMatrix", "outside-domain", msg),
      );
    }
  } else {
    outputs.push(
      absent(
        "rotationDeg",
        "not-applicable",
        "A single boost along one line has no Wigner rotation.",
      ),
      lightRay
        ? absent(
            "composedGamma",
            "not-applicable",
            "A light ray has no rest frame or finite Lorentz factor.",
          )
        : composedGamma !== null && Number.isFinite(composedGamma)
          ? value("composedGamma", composedGamma)
          : absent(
              "composedGamma",
              "outside-domain",
              "The timelike velocity factor is unavailable.",
            ),
      absent("productMatrix", "not-applicable", "The 4×4 product is published in two-boosts mode."),
    );
  }
  const r1 = rapidity(p.frameBeta);
  const r2 = Math.abs(w) < 1 ? rapidity(w) : null;
  outputs.push(
    r1.status === "value"
      ? value("rapidityFrame", r1.value)
      : absent("rapidityFrame", "outside-domain", r1.reason),
  );
  if (r2 && r2.status === "value") {
    outputs.push(value("rapidityMoving", r2.value));
    outputs.push(
      p.mode === "collinear"
        ? value("rapiditySum", r1.status === "value" ? r1.value + r2.value : r2.value)
        : absent("rapiditySum", "not-applicable", "Rapidity adds only for collinear boosts."),
    );
  } else {
    outputs.push(
      absent(
        "rapidityMoving",
        "not-applicable",
        "A light-like moving-frame speed has no finite rapidity.",
      ),
      absent(
        "rapiditySum",
        "not-applicable",
        "A light-like moving-frame speed has no finite rapidity.",
      ),
    );
  }
  const inc = compositionIncrement(c / p.mediumIndex, p.flowSpeed, c);
  const fresnel = (1 - 1 / (p.mediumIndex * p.mediumIndex)) * p.flowSpeed;
  outputs.push(
    inc.status === "value"
      ? value("fizeauIncrement", inc.value)
      : absent("fizeauIncrement", "outside-domain", inc.reason),
  );
  outputs.push(value("fresnelIncrement", fresnel));
  return outputs;
}

export type PreparedSr06Example = Readonly<{
  sourceDigest: string;
  parameters: Sr06Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr06Example = Object.freeze({
  sourceDigest: "src/physics/reference/kinematics.ts",
  parameters: SR06_DEFAULTS,
  results: evaluateSr06(SR06_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function createSr06Session(
  instanceId = "sr06-session",
  initialParameters: Sr06Parameters = SR06_DEFAULTS,
) {
  const store = createInstanceStore({
    experimentId: "sr-06",
    instanceId,
    initialParameters: initialParameters as unknown as Parameters,
    parameterClasses: SR06_CLASSES,
    outputs: SR06_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const published = store.publish({
    ...token,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    outputs: evaluateSr06(initialParameters),
  });
  if (!published.accepted) throw new Error("Invalid prepared SR-06 example.");
  const serverSnapshot = store.getSnapshot();
  function apply(input: unknown, newRun = false) {
    const checked = validateSr06Parameters(input);
    if (checked.kind !== "accepted") return checked;
    const previous = store.getSnapshot().accepted!.parameters as Sr06Parameters;
    const next = checked.data;
    const setup: Record<string, number | string | boolean> = {};
    const presentation: Record<string, number | string | boolean> = {};
    for (const key of Object.keys(next) as (keyof Sr06Parameters)[]) {
      if (Object.is(next[key], previous[key])) continue;
      if (SR06_CLASSES[key] === "presentation") presentation[key] = next[key];
      else setup[key] = next[key];
    }
    let request = newRun || Object.keys(setup).length ? store.issue("setup-change", setup) : null;
    if (Object.keys(presentation).length)
      request = store.issue("presentation-change", presentation);
    request ??= store.issue("continue");
    const decision = store.publish({
      ...request,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: evaluateSr06(next),
    });
    if (!decision.accepted) throw new Error(`SR-06 publication refused: ${decision.reason}`);
    return { kind: "accepted" as const, data: request };
  }

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    exportCheckpoint: store.exportCheckpoint,
    restoreCheckpoint: store.restoreCheckpoint,
    acceptedParameters(): Sr06Parameters {
      return (store.getSnapshot().accepted?.parameters ?? initialParameters) as Sr06Parameters;
    },
    apply: (input: unknown) => apply(input),
    startNewRun: (input: unknown) => apply(input, true),
  });
}
