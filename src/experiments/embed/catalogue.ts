/** Explicit admission list for real, server-renderable laboratory adapters.
 * Registration alone is not proof that an instrument can be embedded.
 * Plan §10.7; am-inst-embed-route-rnyg. No numerical laws live here.
 */
export const EMBED_INSTRUMENTS = [
  {
    id: "bm-03",
    title: "Counting configurations and osmotic pressure",
    source: "/papers/brownian-motion/#arg-bm-configuration",
    overview: "Compare independently placed particles with one locked cluster.",
    full: "Hold the temperature and volume fixed while changing what counts as an independently placed unit. The counterexample changes the independence assumption, not merely the drawing.",
    steps:
      "Follow one particle, two particles, the logarithm for many particles, and finally the volume derivative. Inspect the named assumptions before interpreting the pressure.",
  },
  {
    id: "lq-05",
    title: "Independent configurations and the gas analogy",
    source: "/papers/light-quanta/#s5",
    overview: "Count the configurations before interpreting the entropy.",
    full: "Change the subvolume fraction and compare independent positions with locked positions. Inspect the probability and its logarithm rather than treating a small probability as an impossible event.",
    steps:
      "Start with one point, increase the point count, then lock the positions. Compare the resulting volume dependence. The counting argument is a premise for the radiation analogy, not by itself a demonstration of light quanta.",
  },
  {
    id: "lq-06",
    title: "Matching the radiation and gas entropy coefficients",
    source: "/papers/light-quanta/#s6",
    overview: "Compare the volume dependence of two entropy expressions.",
    full: "Change the radiation energy or frequency and inspect the coefficient match. Keep the mathematical identity separate from the physical hypothesis suggested by the analogy.",
    steps:
      "Inspect the radiation coefficient, the independent-particle coefficient, and the effective count that makes them agree. Check the constant set and the stated Wien-regime limitation before carrying the result into emission or absorption.",
  },
  {
    id: "sr-04",
    title: "Constructing the coordinate map",
    source: "/papers/special-relativity/#s3",
    overview: "Enable constraints and inspect what each actually determines.",
    full: "Preserving both light directions is not the same as fixing the common scale. Compare the underdetermined family with the result obtained after admitting the inverse, symmetry, and branch conditions.",
    steps:
      "Inspect the forward and backward light constraints separately. Add reciprocity, isotropy, and the identity branch, then check transverse light. Later mathematical aids are checks, not premises smuggled into the construction.",
  },
  {
    id: "me-01",
    title: "Opposite pulses and two energy ledgers",
    source: "/papers/mass-energy/#arg-me-two-ledgers",
    overview: "Describe the same balanced emission in two frames.",
    full: "Change the emission angle and compare the individual pulse energies with their sum. Then inspect the subtraction of the two energy balances and the role of the offset premise.",
    steps:
      "Follow the moving pulses, their angle-free sum, both balances, the subtraction, and the kinetic-energy interpretation. The light-energy transformation is an imported premise; a mass-energy formula is not installed as the starting answer.",
  },
  {
    id: "me-02",
    title: "Inertia from the small-speed coefficient",
    source: "/papers/mass-energy/#arg-me-small-speed",
    overview: "Inspect what the low-speed coefficient tells you about inertia.",
    full: "Compare the exact change in energy of motion with its small-speed approximation. A limiting coefficient and a finite-speed numerical estimate answer different questions.",
    steps:
      "Inspect the unchanged-offset premise, the exact kinetic drop, and the coefficient of the squared speed. Vary the speed to see the approximation's range; do not divide a zero-speed measurement by zero to manufacture an inertia estimate.",
  },
  {
    id: "shelf-michelson-morley",
    title: "Optical arm times with and without contraction",
    source: "/discover/special-relativity/",
    overview: "Compare two hypotheses for the same equal-arm apparatus.",
    full: "Keep the arm length, wavelength, and wind speed fixed while changing the contraction hypothesis. The fringe prediction is a model consequence, not an observed experimental bound.",
    steps:
      "Inspect both round-trip times, their difference, and the predicted change after a right-angle rotation. Compare the exact model with the leading low-speed approximation. The supplied calibration is modern and illustrative, not a strict 1904 dataset.",
  },
  {
    id: "shelf-fizeau",
    title: "Moving-water drag hypotheses",
    source: "/discover/special-relativity/",
    overview: "Compare no drag, full drag, and Fresnel drag under the same settings.",
    full: "Keep the water path per beam and wavelength fixed. Reverse the signed flow and distinguish a single-direction comparison from a flow-reversal measurement protocol.",
    steps:
      "Inspect the assumed drag coefficient, both path speeds, and the predicted fringe difference. The opt-in relativistic comparison is a later development, not evidence used to justify the earlier hypotheses. No historical observation is supplied by this preview.",
  },
  {
    id: "shelf-maxwell-galilean",
    title: "Wave equations under a change of coordinates",
    source: "/papers/special-relativity/#s6",
    overview: "Compare coordinate substitutions on the same scalar wave.",
    full: "Change the frame speed, then change only the wavenumber. Distinguish the dimensional residual from the normalized residual so a scale change is not mistaken for a better transformation.",
    steps:
      "Inspect the mixed-derivative term and both residuals for Galilean and Lorentz substitutions. This scalar diagnostic is not the complete Maxwell-Hertz field derivation. Continue to the full reading for the field transformations.",
  },
] as const;

export type EmbeddableId = (typeof EMBED_INSTRUMENTS)[number]["id"];
export function embedInstrument(id: string) {
  return EMBED_INSTRUMENTS.find((instrument) => instrument.id === id);
}
export function isEmbeddableId(id: unknown): id is EmbeddableId {
  return typeof id === "string" && embedInstrument(id) !== undefined;
}
