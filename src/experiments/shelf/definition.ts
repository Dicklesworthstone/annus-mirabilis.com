/** Reader-facing shelf experiments. am-disc-shelf-michelson-fizeau-dauq. */

import { ExperimentRuntimeError } from "../refusal.ts";
import type { ParameterClass, Parameters } from "../store/instanceStore.ts";

export const SHELF_IDS = [
  "shelf-michelson-morley",
  "shelf-fizeau",
  "shelf-maxwell-galilean",
] as const;
export type ShelfId = (typeof SHELF_IDS)[number];
export type ShelfMode = "full" | "1904";
export type ShelfField = Readonly<{
  id: string;
  label: string;
  help: string;
  kind: "number" | "boolean" | "choice";
  initial: number | string | boolean;
  choices?: readonly string[];
  parameterClass: ParameterClass;
}>;
export type ShelfDefinition = Readonly<{
  title: string;
  question: string;
  prediction: string;
  explanation: string;
  notModeled: readonly string[];
  sourceSection: string;
}>;

export const SHELF_DEFINITIONS: Readonly<Record<ShelfId, ShelfDefinition>> = {
  "shelf-michelson-morley": {
    title: "Can contraction conceal an ether wind?",
    question:
      "Would rotating a two-arm light-timing apparatus reveal motion through an ether, and what changes when the parallel arm contracts?",
    prediction:
      "Before changing the settings, predict what turning on the contraction hypothesis will do to the shift on a quarter-turn.",
    explanation:
      "The uncontracted apparatus has unequal round-trip times. A quarter-turn exchanges the arms. The contraction hypothesis makes the two times equal for these equal arms, so this experiment alone does not distinguish that hypothesis from a theory predicting no ether wind.",
    notModeled: [
      "Multiple reflections and compensator optics",
      "Thermal drift and mechanical flexure",
      "Unequal arms and extended sources",
    ],
    sourceSection: "s0",
  },
  "shelf-fizeau": {
    title: "How much does moving water drag light?",
    question:
      "Do no drag, complete drag, and Fresnel's partial drag predict the same interference shift for the same moving water?",
    prediction:
      "Predict which hypothesis gives the largest shift, and what reversing the flow will do. Compare model consequences, not invented measurements.",
    explanation:
      "All three rows use the same path, wavelength, index, and flow. No drag predicts no shift. Complete drag and partial drag give different shifts. Reversal compares opposite flow directions and doubles the displacement; it does not double the water path entered here.",
    notModeled: [
      "Dispersion corrections",
      "Tube walls and the flow velocity profile",
      "Turbulence and the historical apparatus's error budget",
    ],
    sourceSection: "s5",
  },
  "shelf-maxwell-galilean": {
    title: "Does a change of frame preserve the wave equation?",
    question:
      "What happens to the one-dimensional wave equation under a Galilean substitution, and how does the Lorentz substitution compare?",
    prediction:
      "Predict whether the unchanged wave equation still holds after the Galilean substitution. Look separately for a changed coefficient and a new mixed derivative.",
    explanation:
      "The Galilean substitution preserves solutions of the transformed equation, not of the old equation with its form unchanged. The mixed derivative and changed spatial coefficient account for that difference. The Lorentz substitution preserves the form of this scalar equation; that agreement does not establish a unique interpretation of the transformation.",
    notModeled: [
      "The full vector Maxwell equations",
      "Sources, charges, and boundaries",
      "Dispersion and material media",
    ],
    sourceSection: "s3",
  },
};

const number = (
  id: string,
  label: string,
  initial: number,
  help: string,
  parameterClass: ParameterClass = "input",
): ShelfField => Object.freeze({ id, label, initial, help, kind: "number", parameterClass });
const toggle = (
  id: string,
  label: string,
  initial: boolean,
  help: string,
  parameterClass: ParameterClass = "input",
): ShelfField => Object.freeze({ id, label, initial, help, kind: "boolean", parameterClass });
const choice = (
  id: string,
  label: string,
  initial: string,
  choices: readonly string[],
  parameterClass: ParameterClass = "input",
): ShelfField =>
  Object.freeze({
    id,
    label,
    initial,
    choices: Object.freeze([...choices]),
    help: "",
    kind: "choice",
    parameterClass,
  });

export function isShelfId(value: string): value is ShelfId {
  return (SHELF_IDS as readonly string[]).includes(value);
}
export function shelfPath(id: ShelfId, mode: ShelfMode): string {
  return `/lab/${id}/${mode === "1904" ? "1904/" : ""}`;
}

/** Mode-specific field sets prevent SI speed inputs or later comparisons entering a 1904 run. */
export function shelfFields(id: ShelfId, mode: ShelfMode): readonly ShelfField[] {
  if (!isShelfId(id) || (mode !== "full" && mode !== "1904")) {
    throw new ExperimentRuntimeError(
      "unknown-shelf-address",
      "Unknown shelf instrument or mode.",
      "shelf",
    );
  }
  switch (id) {
    case "shelf-michelson-morley":
      return Object.freeze([
        ...(mode === "1904"
          ? [
              number(
                "beta",
                "Apparatus speed as a fraction of light speed",
                1e-4,
                "Magnitude must be below 1. This is a declared ratio, not a measured speed.",
              ),
              number(
                "pathInWavelengths",
                "Effective arm length in wavelengths",
                2e7,
                "Positive length for each equal arm. Illustrative, not transcribed apparatus data.",
              ),
            ]
          : [
              number(
                "windSpeed",
                "Apparatus speed through the ether (m/s)",
                30000,
                "Magnitude must be below light speed. Uses modern-si-2019, not a historical measurement.",
              ),
              number(
                "length",
                "Effective length of each arm (m)",
                11,
                "Positive length. Both arms have the same length before applying contraction.",
              ),
              number(
                "wavelengthNm",
                "Wavelength (nm)",
                550,
                "Positive wavelength. These settings are illustrative.",
              ),
            ]),
        toggle(
          "contraction",
          "Select the contraction hypothesis",
          false,
          "Changes the model, not just the drawing. Both model predictions remain in the comparison.",
        ),
        choice("orientation", "Drawn orientation", "0", ["0", "90"], "presentation"),
      ]);
    case "shelf-fizeau":
      return Object.freeze([
        ...(mode === "1904"
          ? [
              number(
                "waterSpeedFractionOfC",
                "Water speed as a fraction of light speed",
                2.35e-8,
                "A declared dimensionless ratio. No conversion using a modern light-speed constant.",
              ),
            ]
          : [
              number(
                "waterSpeed",
                "Water speed (m/s)",
                7.06,
                "Signed effective flow speed. This is an illustrative setting, not an observed result.",
              ),
            ]),
        number(
          "waterPathPerBeam",
          "Total water path per beam (m)",
          3,
          "Positive total path through water for ONE beam, not the sum for the two beams.",
        ),
        number(
          "wavelengthNm",
          "Vacuum wavelength (nm)",
          530,
          "Positive wavelength. The refractive index is assumed independent of frequency.",
        ),
        number(
          "refractiveIndex",
          "Refractive index",
          1.333,
          "At least 1 in this model. A predicted beam must be able to return against the flow.",
        ),
        choice("hypothesis", "Selected drag hypothesis", "fresnel-drag", [
          "no-drag",
          "full-drag",
          "fresnel-drag",
        ]),
        toggle(
          "reversal",
          "Compare after reversing the flow",
          false,
          "Compare the two opposite flow directions rather than flow against zero flow.",
        ),
        ...(mode === "full"
          ? [
              toggle(
                "showLater",
                "Show the later velocity-addition comparison (Laue 1907)",
                false,
                "A separately labelled later derivation, not a premise available on this shelf.",
                "presentation",
              ),
            ]
          : []),
      ]);
    case "shelf-maxwell-galilean":
      return Object.freeze([
        number(
          "beta",
          "Frame speed as a fraction of light speed",
          0.6,
          "Magnitude must be below 1 for the comparison with the Lorentz map.",
          "observer",
        ),
        number(
          "wavenumber",
          "Wavenumber (rad/m)",
          1,
          "Positive wavenumber. The normalised residual is independent of this choice.",
        ),
        choice(
          "map",
          "Selected coordinate substitution",
          "galilean",
          ["galilean", "lorentz"],
          "observer",
        ),
      ]);
  }
}
export function shelfDefaults(id: ShelfId, mode: ShelfMode): Parameters {
  return Object.freeze(
    Object.fromEntries(shelfFields(id, mode).map((field) => [field.id, field.initial])),
  );
}

export type ShelfInput = Readonly<
  { kind: "accepted"; parameters: Parameters } | { kind: "refused"; code: string; message: string }
>;
/** No coercion: blank strings, null, unknown fields, and nonfinite inputs cannot become zero. */
export function validateShelfInput(id: ShelfId, mode: ShelfMode, input: unknown): ShelfInput {
  const fields = shelfFields(id, mode);
  const refuse = (message: string, code = "invalid-parameter"): ShelfInput =>
    Object.freeze({ kind: "refused", code, message });
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    return refuse("Supply a complete set of settings for this experiment.");
  }
  const record = input as Record<string, unknown>;
  if (
    mode === "1904" &&
    ["waterSpeed", "windSpeed", "constantSet"].some((key) => Object.hasOwn(record, key))
  ) {
    return refuse(
      "No pre-1905 light-speed set is registered. Enter a fraction of light speed instead of a speed in metres per second.",
      "no-pre-1905-light-speed-set",
    );
  }
  if (
    Object.keys(record).length !== fields.length ||
    fields.some((field) => !Object.hasOwn(record, field.id))
  ) {
    return refuse(
      "This link or form has missing or unsupported settings. The accepted example is unchanged.",
    );
  }
  for (const field of fields) {
    const value = record[field.id];
    if (field.kind === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      return refuse(`Enter a finite number for ${field.label}.`, "nonfinite-input");
    }
    // Bound numerical work/representation separately from the owner's physical domain.
    if (typeof value === "number" && Math.abs(value) > 1e100) {
      return refuse(
        `The numerical range for ${field.label} ends at magnitude 1e100.`,
        "invalid-parameter",
      );
    }
    if (field.kind === "boolean" && typeof value !== "boolean")
      return refuse(`Choose on or off for ${field.label}.`);
    if (field.kind === "choice" && (typeof value !== "string" || !field.choices?.includes(value))) {
      return refuse(`Choose a listed option for ${field.label}.`);
    }
  }
  return Object.freeze({
    kind: "accepted",
    parameters: Object.freeze({ ...record }) as Parameters,
  });
}
