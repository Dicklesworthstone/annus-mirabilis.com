import { ExperimentRuntimeError } from "../refusal.ts";
/** The live shelf previews use modern SI calibration, not a verified 1904 dataset.
 * Bounds describe the instrument's supported range, not universal physical limits.
 * Bead: am-disc-shelf-michelson-fizeau-dauq.
 */
export const SHELF_IDS = [
  "shelf-michelson-morley",
  "shelf-fizeau",
  "shelf-maxwell-galilean",
] as const;
export type ShelfId = (typeof SHELF_IDS)[number];
export type ShelfParameters =
  | Readonly<{
      instrumentId: "shelf-michelson-morley";
      armLength: number;
      wavelength: number;
      beta: number;
    }>
  | Readonly<{
      instrumentId: "shelf-fizeau";
      waterPathPerBeam: number;
      waterSpeed: number;
      refractiveIndex: number;
      wavelength: number;
      reversal: boolean;
      showLater: boolean;
    }>
  | Readonly<{ instrumentId: "shelf-maxwell-galilean"; beta: number; wavenumber: number }>;
export type ShelfField = Readonly<{
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
}>;
export type ShelfDefinition = Readonly<{
  title: string;
  question: string;
  fields: readonly ShelfField[];
  switches: readonly Readonly<{ key: string; label: string }>[];
  defaults: ShelfParameters;
}>;

export const SHELF_DEFINITIONS: Readonly<Record<ShelfId, ShelfDefinition>> = {
  "shelf-michelson-morley": {
    title: "Michelson–Morley: what does a null result decide?",
    question:
      "Hold the apparatus fixed and compare the predicted rotation shift with and without longitudinal contraction.",
    fields: [
      { key: "armLength", label: "Equal one-way arm length", unit: "m", min: 0.001, max: 100 },
      { key: "wavelength", label: "Vacuum wavelength", unit: "m", min: 1e-9, max: 0.001 },
      {
        key: "beta",
        label: "Signed ether-wind speed divided by c",
        unit: "1",
        min: -0.95,
        max: 0.95,
      },
    ],
    switches: [],
    defaults: {
      instrumentId: "shelf-michelson-morley",
      armLength: 11,
      wavelength: 5.5e-7,
      beta: 1e-4,
    },
  },
  "shelf-fizeau": {
    title: "Fizeau: compare three drag hypotheses",
    question:
      "Which predictions change when the flow reverses, and how do no drag, full drag and Fresnel drag differ?",
    fields: [
      {
        key: "waterPathPerBeam",
        label: "Total moving-water path per beam",
        unit: "m",
        min: 0.001,
        max: 100,
      },
      { key: "waterSpeed", label: "Signed water speed", unit: "m/s", min: -100, max: 100 },
      { key: "refractiveIndex", label: "Assumed refractive index", unit: "1", min: 1, max: 2 },
      { key: "wavelength", label: "Vacuum wavelength", unit: "m", min: 1e-9, max: 0.001 },
    ],
    switches: [
      { key: "reversal", label: "Compare opposite flow directions (flow reversal)" },
      {
        key: "showLater",
        label: "Show the separately labeled later relativistic speed comparison",
      },
    ],
    defaults: {
      instrumentId: "shelf-fizeau",
      waterPathPerBeam: 3,
      waterSpeed: 7,
      refractiveIndex: 1.333,
      wavelength: 5.5e-7,
      reversal: false,
      showLater: false,
    },
  },
  "shelf-maxwell-galilean": {
    title: "Does the wave equation keep its form?",
    question:
      "Apply two coordinate substitutions to the same forward-travelling plane wave and compare the analytic residuals.",
    fields: [
      { key: "beta", label: "Signed frame speed divided by c", unit: "1", min: -0.95, max: 0.95 },
      { key: "wavenumber", label: "Angular wavenumber k", unit: "rad/m", min: 0.001, max: 1e6 },
    ],
    switches: [],
    defaults: { instrumentId: "shelf-maxwell-galilean", beta: 0.1, wavenumber: 1 },
  },
};

export type ShelfDraft = Readonly<Record<string, string | boolean>>;
export type ShelfParse =
  | Readonly<{ kind: "parameters"; parameters: ShelfParameters }>
  | Readonly<{ kind: "refused"; message: string }>;

export function isShelfId(value: unknown): value is ShelfId {
  return typeof value === "string" && SHELF_IDS.some((id) => id === value);
}

export function shelfDraft(parameters: ShelfParameters): ShelfDraft {
  return Object.fromEntries(
    Object.entries(parameters)
      .filter(([key]) => key !== "instrumentId")
      .map(([key, value]) => [key, typeof value === "boolean" ? value : String(value)]),
  );
}

/** Accept decimal/scientific notation, not blank strings, hex, coercible objects or infinities. */
function decimal(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.length > 80) return null;
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/**
 * A declared field's admitted value. parseShelfParameters' field loop refuses any missing field
 * before this runs, so the throw guards a mismatch between an instrument's declared fields and
 * the parameters it builds, a programming error rather than a reader's input. It lives here, not
 * in a closure, so a test can reach the refusal directly.
 */
export function declaredNumber(values: Readonly<Record<string, number>>, key: string): number {
  const value = values[key];
  if (value === undefined)
    throw new ExperimentRuntimeError(
      "declared-field-missing",
      `Missing declared shelf field: ${key}`,
      "shelf-optics",
    );
  return value;
}

export function parseShelfParameters(id: ShelfId, raw: unknown): ShelfParse {
  if (!isShelfId(id) || !raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "refused", message: "Choose a known shelf instrument and a settings object." };
  }
  const data = raw as Record<string, unknown>;
  const definition = SHELF_DEFINITIONS[id];
  const allowed = [
    "instrumentId",
    ...definition.fields.map((field) => field.key),
    ...definition.switches.map((field) => field.key),
  ];
  if (
    Object.keys(data).some((key) => !allowed.includes(key)) ||
    (Object.hasOwn(data, "instrumentId") && data.instrumentId !== id)
  ) {
    return {
      kind: "refused",
      message: "These settings include unknown fields or belong to a different instrument.",
    };
  }
  const values: Record<string, number> = {};
  for (const field of definition.fields) {
    const value = Object.hasOwn(data, field.key) ? decimal(data[field.key]) : null;
    if (value === null || value < field.min || value > field.max) {
      return {
        kind: "refused",
        message: `${field.label} must be a finite decimal between ${field.min} and ${field.max} ${field.unit}. The previous calculation is unchanged.`,
      };
    }
    values[field.key] = value;
  }
  for (const field of definition.switches) {
    if (!Object.hasOwn(data, field.key) || typeof data[field.key] !== "boolean") {
      return { kind: "refused", message: `${field.label} must be explicitly on or off.` };
    }
  }
  // The field loop proved every numeric value is present; no extra input keys survive.
  const number = (key: string): number => declaredNumber(values, key);
  let parameters: ShelfParameters;
  switch (id) {
    case "shelf-michelson-morley":
      parameters = {
        instrumentId: id,
        armLength: number("armLength"),
        wavelength: number("wavelength"),
        beta: number("beta"),
      };
      break;
    case "shelf-fizeau":
      parameters = {
        instrumentId: id,
        waterPathPerBeam: number("waterPathPerBeam"),
        waterSpeed: number("waterSpeed"),
        refractiveIndex: number("refractiveIndex"),
        wavelength: number("wavelength"),
        reversal: data.reversal === true,
        showLater: data.showLater === true,
      };
      break;
    case "shelf-maxwell-galilean":
      parameters = { instrumentId: id, beta: number("beta"), wavenumber: number("wavenumber") };
      break;
  }
  return { kind: "parameters", parameters: Object.freeze(parameters) };
}

export type ShelfCaption = Readonly<{ r0: string; r1: string; r2: string; r3: string }>;

/**
 * Each shelf instrument's four readings (R0 to R3), checked against the owner
 * (src/physics/reference/shelfOptics.ts) at each definition's defaults: Michelson-Morley 0.4 and 0
 * fringes (L = 11 m, λ = 550 nm, β = 10^{−4}); Fizeau 0, 0.4526 and 0.1979 fringes (3 m, 7 m/s,
 * n = 1.333, 550 nm); the wave residual 0.19 and 0 at β = 0.1. The relativity paper names no
 * optical experiment: its introduction mentions unsuccessful attempts to detect the Earth's motion
 * relative to the light medium, and §6 transforms the Maxwell-Hertz equations. The readings-owners
 * record am-disc-shelf-michelson-fizeau-dauq.yaml carries the same text.
 */
export const SHELF_CAPTIONS: Readonly<Record<ShelfId, ShelfCaption>> = Object.freeze({
  "shelf-michelson-morley": Object.freeze({
    r0: "An instrument splits a beam of light along two arms at right angles, sends each out and back, and compares the returns. If the Earth moved through a fixed medium for light, turning the instrument should shift the pattern measurably; the shift found was far smaller, and this lab shows what that null result does and does not decide.",
    r1: "In an ether at rest, light out and back along an arm of length L parallel to the ether wind takes 2L/(c(1 − β^{2})), and across it 2L/(c√(1 − β^{2})), where β = v/c. Turning the apparatus through 90 degrees swaps the arms, and the fringe pattern should shift by about 2Lβ^{2}/λ. With arms of 11 m, light of 550 nm and β = 10^{−4}, about the Earth's orbital speed, the ether without contraction predicts 0.4 fringes. If the arm along the motion is shortened by √(1 − β^{2}), the two times become equal and the prediction is 0. A null result therefore rules out the resting ether without contraction, but it cannot choose between contraction in an ether and Einstein's kinematics, which both predict zero. The relativity paper mentions only unsuccessful attempts to detect the Earth's motion relative to the light medium, and names no experiment.",
    r2: "Along the wind, light goes out against it at c − v and back with it at c + v, so the round trip takes L/(c − v) + L/(c + v) = 2Lc/(c^{2} − v^{2}) = (2L/c)/(1 − β^{2}). Across the wind, the light must aim upstream to reach the mirror at all; its speed across is √(c^{2} − v^{2}), and the round trip takes 2L/√(c^{2} − v^{2}) = (2L/c)/√(1 − β^{2}). For small β the first is about (2L/c)(1 + β^{2}) and the second about (2L/c)(1 + β^{2}/2), so they differ by (L/c)β^{2}. Rotating by 90 degrees swaps the roles, which doubles the difference to (2L/c)β^{2}, and counted in wavelengths of the light that is 2Lβ^{2}/λ fringes. With L = 11 m, β = 10^{−4} and λ = 5.5 × 10^{−7} m, that is 2 × 11 × 10^{−8}/(5.5 × 10^{−7}) = 0.4 fringes. Now shorten the arm along the wind to L√(1 − β^{2}): its round trip becomes (2L/c)√(1 − β^{2})/(1 − β^{2}) = (2L/c)/√(1 − β^{2}), exactly the time across, so the shift is 0 at every speed. The contracted ether and relativity both give 0, so the null result cannot tell them apart.",
    r3: "Michelson ran the experiment in 1881 and, with Morley, much more precisely in 1887, finding a shift well under the 0.4 fringes expected. FitzGerald in 1889 and Lorentz in 1892 proposed the contraction that removes it. How much the experiment weighed with Einstein in 1905 is a matter of historical debate; the paper names no experiment. The instrument's settings are illustrative rather than the historical apparatus, and no measured shift is plotted.",
  }),
  "shelf-fizeau": Object.freeze({
    r0: "Light sent through moving water is carried along by it, but only partly. Comparing beams that travel with the flow and against it shows by how much, and three old hypotheses give three different answers.",
    r1: "Light in still water travels at c/n. If moving water carries the light along with a fraction f of its own speed v, a beam going with the flow travels at c/n + fv and one going against it at c/n − fv, and over a path L_{w} in the water the two arrive out of step by ΔN = (cL_{w}/λ)(1/(c/n − fv) − 1/(c/n + fv)) fringes. No drag, f = 0, gives no shift; full drag, f = 1, gives the most; Fresnel's partial drag, f = 1 − 1/n^{2}, lies between. With 3 m of water per beam, a flow of 7 m/s, n = 1.333 and light of 550 nm, the three predict 0, 0.4526 and 0.1979 fringes, and reversing the flow doubles each. Fizeau's measurement of 1851 favoured Fresnel's coefficient. In relativity the same coefficient follows, to first order in v/c, from adding the speeds of light and water by Einstein's composition law, which the lab keeps as a separately labelled later comparison.",
    r2: "A beam crossing the water path L_{w} at speed u takes L_{w}/u. The beam against the flow takes L_{w}/(c/n − fv) and the beam with it L_{w}/(c/n + fv). The difference, multiplied by the light's frequency c/λ, is the shift in fringes: ΔN = (cL_{w}/λ)(1/(c/n − fv) − 1/(c/n + fv)). For small v this is close to (cL_{w}/λ)(2fv)/(c/n)^{2} = 2L_{w}n^{2}fv/(λc). With full drag, f = 1: 2 × 3 × 1.777 × 7/(5.5 × 10^{−7} × 2.998 × 10^{8}) = 74.6/164.9 = 0.4526 fringes. Fresnel's coefficient is f = 1 − 1/n^{2}, and with n^{2} = 1.333^{2} = 1.777 that is 1 − 1/1.777 = 0.4372, so 0.4372 × 0.4526 = 0.1979 fringes. With no drag the two beams see the same speed and nothing shifts. Reverse the flow and the beams swap speeds, so each shift changes sign; comparing the two directions therefore measures twice the shift, 0.905 fringes for full drag and 0.396 for Fresnel's. The exact expression and the small-v form differ only by terms of order (nv/c)^{2}, about 10^{−15} here, which is why the owner can use the exact one without the difference showing. The relativistic sum of c/n and v is (c/n + v)/(1 + v/(nc)), which to first order in v is c/n + v(1 − 1/n^{2}): Fresnel's coefficient, with no medium for light required.",
    r3: "Fresnel proposed partial drag in 1818 to explain why aberration and refraction showed no sign of the Earth's motion. Fizeau measured the effect in running water in 1851 and found it close to Fresnel's value, and Michelson and Morley repeated the measurement with higher precision in 1886. Lorentz derived the coefficient from his electron theory in 1895, and von Laue showed in 1907 that it follows from Einstein's addition of velocities. The instrument's settings are illustrative rather than Fizeau's apparatus.",
  }),
  "shelf-maxwell-galilean": Object.freeze({
    r0: "A light wave obeys a single wave equation. Describe the same wave from a moving frame with the everyday change of coordinates and the equation no longer holds in its old form; use the change of coordinates Einstein derived, and it does.",
    r1: "Take a wave travelling at c along x, φ = cos(k(x − ct)), which satisfies ∂^{2}φ/∂x^{2} − (1/c^{2})∂^{2}φ/∂t^{2} = 0. Describe it from a frame moving at v. With the Galilean substitution x′ = x − vt, t′ = t, the wave no longer satisfies an equation of the old form in the new coordinates: it leaves a residual of relative size |β(2 − β)|, 0.19 at β = 0.1, and the correct operator there is a different one, (1 − β^{2})∂^{2}/∂x′^{2} + (2v/c^{2})∂^{2}/∂x′∂t′ − (1/c^{2})∂^{2}/∂t′^{2}. With the transformation of §3 of the relativity paper the equation keeps its form and the residual is 0 at every speed. Section 6 shows the same for the full Maxwell–Hertz equations of empty space, with the fields transforming as well; this instrument checks only the scalar wave operator.",
    r2: "In the moving frame x = x′ + vt′ and t = t′, so x − ct = x′ − (c − v)t′, and the wave is cos(k(x′ − (c − v)t′)): it moves at c − v. Differentiating twice in x′ gives −k^{2}φ, and twice in t′ gives −k^{2}(c − v)^{2}φ. The old-form operator then gives −k^{2}φ + (k^{2}(c − v)^{2}/c^{2})φ = −k^{2}φ[1 − (1 − β)^{2}] = −k^{2}φβ(2 − β). At β = 0.1, β(2 − β) = 0.1 × 1.9 = 0.19, and since φ is at most 1 the largest residual is 0.19k^{2}. With the relativity transformation, x = γ(x′ + vt′) and t = γ(t′ + vx′/c^{2}), so x − ct = γ(1 − β)(x′ − ct′). The wave is cos(k′(x′ − ct′)) with k′ = γ(1 − β)k: it still moves at c, and the old-form operator gives −k′^{2}φ + (k′^{2}c^{2}/c^{2})φ = 0. The wavenumber changes, by the Doppler factor γ(1 − β) = √((1 − β)/(1 + β)) = 0.905 at β = 0.1, but the equation does not.",
    r3: "Voigt noticed in 1887 that a transformation of this kind leaves the wave equation unchanged, and Lorentz and Poincaré worked with the full set for electrodynamics by 1904 and 1905. Einstein's §6 applies his transformation to the Maxwell–Hertz equations for empty space and finds them unchanged in form, and §7 draws the Doppler and aberration formulas from that. Before 1905 the invariance was a property of the equations; in the paper it follows from two principles about measurement.",
  }),
});
