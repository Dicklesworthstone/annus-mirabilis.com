/**
 * Authored dependency reconstruction for paper 3, not a numerical physics engine.
 * The linear-map route is a pedagogical reconstruction, not Einstein's private
 * reasoning or publication of the reviewed Journey III / 1904 knowledge shelf.
 * Source scope: COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md §8.3.
 */
export const RELATIVITY_CARDS = [
  {
    id: "clocks",
    title: "Define a coordinate-time procedure",
    needs: [],
    explanation:
      "Use clocks at named stations, synchronized by the light round-trip convention. An event at a remote clock is not the later reception of its image.",
    formula: "t_B = (t_A + t_A^{\\mathrm{return}})/2",
  },
  {
    id: "linear-map",
    title: "Admit an aligned, linear candidate map",
    needs: ["clocks"],
    explanation:
      "Homogeneity and inertial coordinates motivate linearity. Aligned axes and coincident origins put the moving origin at x = vt. These are assumptions, not consequences of the algebra below.",
    formula: "x'=a(v)(x-vt),\\qquad t'=b(v)t+d(v)x",
  },
  {
    id: "light-postulate",
    title: "Require the same vacuum light speed in both frames",
    needs: ["clocks"],
    explanation:
      "Admit the light-speed postulate for both directions, using each frame's own coordinate-time procedure. This is a physical premise, not something this workbench measures.",
    formula: "x=\\pm ct\\quad\\Longrightarrow\\quad x'=\\pm ct'",
  },
  {
    id: "forward-ray",
    title: "Apply the constraint to the forward light ray",
    needs: ["linear-map", "light-postulate"],
    explanation:
      "Substitute x = ct. This gives only one equation for b and d; preserving one light direction is not enough to determine the time assignment.",
    formula: "a(1-v/c)=b+cd",
  },
  {
    id: "backward-ray",
    title: "Apply the constraint to the backward light ray",
    needs: ["linear-map", "light-postulate"],
    explanation:
      "Substitute x = -ct. The second direction adds an independent constraint. Forward and backward checks may be used in either order.",
    formula: "a(1+v/c)=b-cd",
  },
  {
    id: "light-family",
    title: "Combine the two constraints — keep the unknown scale",
    needs: ["forward-ray", "backward-ray"],
    explanation:
      "Adding and subtracting determines b and d relative to a. The common scale a(v) has NOT been fixed. Setting it to gamma here would assume a conclusion still to be earned.",
    formula: "b=a,\\quad d=-av/c^2,\\quad t'=a(t-vx/c^2)",
  },
  {
    id: "inverse",
    title: "Require the reverse transformation to undo the first",
    needs: ["light-family"],
    explanation:
      "Use the same form with reversed relative velocity. Composition must return the original coordinates. This fixes a product of two scales, not either scale separately.",
    formula: "a(v)a(-v)(1-v^2/c^2)=1",
  },
  {
    id: "isotropy",
    title: "Admit spatial isotropy",
    needs: ["linear-map"],
    explanation:
      "Reversing the spatial direction must not change the common scale. This extra symmetry is not supplied by the forward and backward light equations alone.",
    formula: "a(v)=a(-v)",
  },
  {
    id: "identity",
    title: "Choose the branch continuous with the identity",
    needs: ["linear-map"],
    explanation:
      "At zero relative speed the coordinates agree. Continuity and a nonsingular, orientation-preserving map select the positive branch rather than a sign-reversed map.",
    formula: "a(0)=1,\\qquad a(v)>0",
  },
  {
    id: "normalize",
    title: "Fix the longitudinal scale",
    needs: ["inverse", "isotropy", "identity"],
    explanation:
      "Only now do the inverse, symmetry and branch conditions select the Lorentz factor. This establishes the longitudinal map, not yet the transverse equations.",
    formula: "a=\\gamma=\\frac{1}{\\sqrt{1-v^2/c^2}}",
  },
  {
    id: "transverse-form",
    title: "State the transverse coordinate assumptions",
    needs: ["linear-map", "isotropy"],
    explanation:
      "With aligned axes, fixed transverse orientation and symmetry about the boost axis, take a common transverse scale k and no transverse offsets or mixing. Do not copy y'=y from the desired answer.",
    formula: "y'=k(v)y,\\qquad z'=k(v)z",
  },
  {
    id: "transverse-light",
    title: "Test transverse light and fix its scale",
    needs: ["normalize", "transverse-form", "light-postulate", "identity"],
    explanation:
      "For x=0, y=ct, z=0, the light condition gives k²=gamma²(1-v²/c²)=1. The branch continuous with the identity gives k=1. This completes the aligned-axis reconstruction, not arbitrary rotated or accelerated coordinates.",
    formula: "k^2=\\gamma^2(1-v^2/c^2)=1,\\qquad y'=y,\\quad z'=z",
  },
] as const;

export type RelativityCardId = (typeof RELATIVITY_CARDS)[number]["id"];
export type RelativityCard = (typeof RELATIVITY_CARDS)[number];
export const WORKED_RELATIVITY_ORDER: readonly RelativityCardId[] = RELATIVITY_CARDS.map(
  (card) => card.id,
);
export const LIGHT_ONLY_ORDER: readonly RelativityCardId[] = [
  "clocks",
  "linear-map",
  "light-postulate",
  "forward-ray",
  "backward-ray",
  "light-family",
];
export const LONGITUDINAL_ORDER: readonly RelativityCardId[] = WORKED_RELATIVITY_ORDER.filter(
  (id) => id !== "transverse-form" && id !== "transverse-light",
);

export function isRelativityCardId(value: unknown): value is RelativityCardId {
  return typeof value === "string" && RELATIVITY_CARDS.some((card) => card.id === value);
}

export function relativityCard(id: RelativityCardId): RelativityCard {
  const card = RELATIVITY_CARDS.find((entry) => entry.id === id);
  if (!card) throw new Error("Unknown relativity argument card.");
  return card;
}

export type RelativityOutcome =
  | "empty"
  | "premises-only"
  | "scale-free"
  | "longitudinal"
  | "aligned-map";
export type RelativityTrace = Readonly<{
  id: RelativityCardId;
  status: "supported" | "blocked";
  missing: readonly RelativityCardId[];
}>;

/** Only an earlier SUPPORTED step grants a dependency; merely adding its ID does not. */
export function assessRelativity(order: readonly RelativityCardId[]) {
  const seen = new Set<RelativityCardId>();
  const supported = new Set<RelativityCardId>();
  const trace: RelativityTrace[] = [];
  for (const id of order) {
    if (!isRelativityCardId(id) || seen.has(id))
      throw new Error("Cards must be known and occur once.");
    seen.add(id);
    const missing = relativityCard(id).needs.filter((need) => !supported.has(need));
    if (missing.length === 0) supported.add(id);
    trace.push({ id, status: missing.length === 0 ? "supported" : "blocked", missing });
  }
  const outcome: RelativityOutcome = supported.has("transverse-light")
    ? "aligned-map"
    : supported.has("normalize")
      ? "longitudinal"
      : supported.has("light-family")
        ? "scale-free"
        : order.length === 0
          ? "empty"
          : "premises-only";
  return { outcome, trace, hasBlockedSteps: trace.some((step) => step.status === "blocked") };
}

export const RELATIVITY_OUTCOMES: Readonly<Record<RelativityOutcome, string>> = {
  empty: "Choose premises or open a worked route. Nothing has been established yet.",
  "premises-only":
    "These supported steps have not yet established the two-direction light-cone family.",
  "scale-free":
    "Both light directions are preserved, but the common scale a(v) remains undetermined.",
  longitudinal:
    "The longitudinal Lorentz map follows conditionally. The transverse equations still need their own assumptions and check.",
  "aligned-map":
    "The aligned-axis map follows from the admitted assumptions in the supported chain. This is a dependency reconstruction, not empirical confirmation or a general proof checker.",
};

/** Authored arithmetic examples, NOT live kernel output or experimental observations.
 * Modern notation: v/c=0.6, gamma=1.25, x in light-seconds and t in seconds.
 * The same rest-frame rod has endpoints x=0 and x=10 in both rod examples.
 * Plan §8.3 supplies the first example; the others are explicit substitutions.
 */
export const RELATIVITY_MEASUREMENTS = [
  {
    id: "same-platform-time",
    title: "Choose the rod endpoints at the same platform time",
    eventA: { x: "0", t: "0", xp: "0", tp: "0" },
    eventB: { x: "10", t: "0", xp: "12.5", tp: "-7.5" },
    movingLength: false,
    reason:
      "The platform measures a length of 10 light-seconds. The transformed events are 7.5 seconds apart, so 12.5 light-seconds is NOT this rod's length in the moving frame.",
    unchanged: "The rod and both events are unchanged by a passive change of coordinates.",
  },
  {
    id: "same-moving-time",
    title: "Choose this rod's endpoints at the same moving-frame time",
    eventA: { x: "0", t: "0", xp: "0", tp: "0" },
    eventB: { x: "10", t: "6", xp: "8", tp: "0" },
    movingLength: true,
    reason:
      "These are different endpoint events on the SAME rod. They are simultaneous in the moving frame, which measures 8 light-seconds. The change from 12.5 to 8 is a change of measurement procedure, not another transformation law.",
    unchanged:
      "The rod stays at rest between x=0 and x=10 on the platform; the selected event at its far end changes.",
  },
  {
    id: "one-clock",
    title: "Choose two ticks of one platform clock",
    eventA: { x: "0", t: "0", xp: "0", tp: "0" },
    eventB: { x: "0", t: "10", xp: "-7.5", tp: "12.5" },
    movingLength: false,
    reason:
      "The clock accumulates 10 seconds between its own ticks; the moving-frame coordinate-time difference is 12.5 seconds. The transformed spatial separation is not a rod measurement.",
    unchanged:
      "Both events remain on the same clock's worldline. A coordinate change does not alter its elapsed time.",
  },
] as const;

export type RelativityMeasurementId = (typeof RELATIVITY_MEASUREMENTS)[number]["id"];
export type LengthPrediction = "yes" | "no";
export function isRelativityMeasurementId(value: unknown): value is RelativityMeasurementId {
  return typeof value === "string" && RELATIVITY_MEASUREMENTS.some((entry) => entry.id === value);
}
export function relativityMeasurement(id: RelativityMeasurementId) {
  const entry = RELATIVITY_MEASUREMENTS.find((item) => item.id === id);
  if (!entry) throw new Error("Unknown measurement example.");
  return entry;
}
