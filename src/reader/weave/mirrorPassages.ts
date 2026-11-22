import { SR11_MODEL } from "../../experiments/sr11/definition.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeaveCondition, WeavePredicate } from "../../experiments/weave/types.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

/** Availability checks read the owner, including signed work, without reconstructing a law. */
function finiteReadings(...quantityIds: string[]): readonly WeaveCondition[] {
  return Object.freeze(
    quantityIds.map((quantityId) =>
      Object.freeze({
        kind: "threshold" as const,
        quantityId,
        direction: "at-least" as const,
        enter: -Number.MAX_VALUE,
        exit: -Number.MAX_VALUE,
      }),
    ),
  );
}

const REFLECTION_READINGS = finiteReadings(
  "incidentAngleInFrameDeg",
  "incidentFrequencyRatio",
  "frequencyRatio",
  "cosPhiReflected",
  "phiReflectedDeg",
  "amplitudeRatio",
);
const PRESSURE_READINGS = finiteReadings("radiationPressure", "radiationForce");
const ENERGY_READINGS = finiteReadings(
  "incidentPower",
  "reflectedPower",
  "workRate",
  "energyBalanceResidual",
);

const MIRROR_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "beta", label: "Mirror speed in K", unit: "c" }),
  Object.freeze({ parameterId: "incidentAngleDeg", label: "Incident angle in K", unit: "degrees" }),
  Object.freeze({
    parameterId: "incidentEnergyDensity",
    label: "Incident energy density in K",
    unit: "J/m³",
  }),
  Object.freeze({ parameterId: "mirrorArea", label: "Mirror area", unit: "m²" }),
  Object.freeze({
    parameterId: "frame",
    label: "Readings in",
    values: Object.freeze({ lab: "laboratory frame K", mirror: "mirror rest frame k" }),
  }),
  Object.freeze({
    parameterId: "unitLayer",
    label: "Notation",
    values: Object.freeze({ si: "SI labels", gaussian: "printed field names; SI readings" }),
  }),
]);

function bindingForFrame(frame: "lab" | "mirror"): ReaderWeaveBinding {
  const mirror = frame === "mirror";
  const reflectionSentence = mirror ? "s8-p7-s3" : "s8-p7-s4";
  const predicates: readonly WeavePredicate[] = Object.freeze([
    Object.freeze({
      id: "sr11-reflection",
      instrumentId: "sr-11",
      meaning: "quantity-compared" as const,
      targets: Object.freeze([reflectionSentence]),
      conditions: REFLECTION_READINGS,
      pointerText: mirror
        ? "The accepted incident and reflected rays are described in the mirror rest frame k. This passage applies ideal reflection there: the normal direction reverses while frequency and amplitude are preserved. Both displayed frequency ratios still use the original incident frequency in K as their reference, so a ratio different from one is not a frequency change at this stationary mirror."
        : "The accepted reflected direction, frequency and amplitude are described in the laboratory frame K. This passage transforms the reflected light back from the mirror rest frame. The displayed frequency and amplitude ratios use the original incident light in K as their reference; these are consequences of the ideal reflection model, not observations of a real mirror.",
    }),
    Object.freeze({
      id: "sr11-radiation-pressure",
      instrumentId: "sr-11",
      meaning: "quantity-compared" as const,
      targets: Object.freeze(["s8-p10-s4"]),
      conditions: PRESSURE_READINGS,
      pointerText: mirror
        ? "The accepted pressure and force describe the ideal mirror in its rest frame k. The highlighted source step instead uses pressure times the mirror velocity for work per unit area in K. In k the mirror is stationary, so its force can be nonzero while its mechanical work rate is zero. Switch to K to follow the source's moving-mirror work ledger."
        : "The accepted pressure and force point to the source step that writes work per unit area as pressure times mirror velocity in K. This lab reports pressure in pascals and force for the accepted mirror area in newtons; the paper uses Gaussian quantities. Perfect reflection and prescribed mirror motion remain model assumptions.",
    }),
    Object.freeze({
      id: "sr11-energy-balance",
      instrumentId: "sr-11",
      meaning: "quantity-compared" as const,
      targets: Object.freeze(["s8-p10-s3"]),
      conditions: ENERGY_READINGS,
      pointerText: mirror
        ? "The accepted incoming and reflected powers and signed work rate describe the same trial in k, where the mirror is at rest and reflection does no mechanical work. The highlighted passage states the energy bookkeeping in K. The readings here use watts for the accepted mirror area; they are a model calculation, and the reported residual is not empirical evidence for energy conservation."
        : "The accepted incoming power, reflected power and signed mechanical work display the energy bookkeeping stated here in K. Negative work means the mirror supplies energy to the light. The paper counts energy per unit area; the lab's powers are in watts for the accepted mirror area. The reported residual is a model calculation, not empirical evidence for energy conservation.",
    }),
  ]);
  const passages: Readonly<Record<string, WeavePassage>> = Object.freeze({
    "sr11-reflection": Object.freeze({
      title: mirror ? "Reflecting in the mirror rest frame" : "Returning the reflected ray to K",
      sentenceId: reflectionSentence,
      pointerText: predicates[0]?.pointerText ?? "",
    }),
    "sr11-radiation-pressure": Object.freeze({
      title: "Pressure, force and the work of a moving mirror",
      sentenceId: "s8-p10-s4",
      pointerText: predicates[1]?.pointerText ?? "",
    }),
    "sr11-energy-balance": Object.freeze({
      title: "Incoming light, outgoing light and mechanical work",
      sentenceId: "s8-p10-s3",
      pointerText: predicates[2]?.pointerText ?? "",
    }),
  });
  return Object.freeze({
    instrumentId: "sr-11",
    constantSetId: SR11_MODEL.constantSetId,
    paper: "special-relativity",
    predicates,
    passages,
    contextFields: MIRROR_CONTEXT,
  });
}

export const SR11_LAB_READER_WEAVE = bindingForFrame("lab");
export const SR11_MIRROR_READER_WEAVE = bindingForFrame("mirror");

/** A frame comes from accepted metadata, never a draft control or a guessed frequency ratio. */
export function sr11ReaderWeave(
  accepted: Pick<AcceptedSnapshot, "parameters"> | null,
): ReaderWeaveBinding | null {
  if (accepted?.parameters.frame === "lab") return SR11_LAB_READER_WEAVE;
  if (accepted?.parameters.frame === "mirror") return SR11_MIRROR_READER_WEAVE;
  return null;
}
