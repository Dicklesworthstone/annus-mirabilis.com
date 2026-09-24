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
  {
    id: "sr-03",
    title: "Rod measurement and simultaneity",
    source: "/papers/special-relativity/#s2",
    overview: "Measure a moving rod two ways and compare the answers.",
    full: "Lay a rule alongside the rod while riding with it, or mark where its ends are at one time of the resting system. The two operations give different lengths, and the lab shows which clocks decide what counts as one time.",
    steps:
      "Set the rod's speed and read the length each operation finds. Then follow the light signals that riders use to test the clocks at the rod's ends, and see why clocks in step for the resting system are out of step for them.",
  },
  {
    id: "sr-08",
    title: "Electric and magnetic frame change",
    source: "/papers/special-relativity/#s6",
    overview: "Describe one field in two frames and compare what a test charge feels.",
    full: "Change the boost and watch the electric and magnetic components mix. The components differ from frame to frame, while the combinations E² − c²B² and E · B stay the same.",
    steps:
      "Start with a pure electric field, add a boost, and read the magnetic field that appears. Compare the transformed components with the two invariants, then place a test charge and compare the forces found in each frame.",
  },
  {
    id: "sr-09",
    title: "Doppler principle and aberration",
    source: "/papers/special-relativity/#s7",
    overview:
      "Change the observer's speed and see a light wave's frequency and direction change together.",
    full: "The phase of a plane wave is the same number in every frame, and that fixes both the Doppler factor and the aberration of direction. At 0.6c, light travelling in the direction of motion drops from 500 THz to 250 THz.",
    steps:
      "Pick a direction for the light, set the speed, and read the new frequency and angle. Compare the case along the motion, where the frequency is halved at 0.6c, with the case across it, where it rises by γ to 625 THz.",
  },
  {
    id: "sr-10",
    title: "The finite light complex",
    source: "/papers/special-relativity/#s8",
    overview:
      "Follow a bounded patch of light into a moving frame and compare its energy and volume.",
    full: "The energy and the volume of the light complex change by different factors, and so does the energy density. The lab sets a rigid-body model beside the paper's result and names the cases where the two agree.",
    steps:
      "Choose the direction of the light, set the speed, and read the energy and volume factors. Compare them with the rigid-body model, then check that the energy changes by the same law as the frequency, as §8 remarks.",
  },
  {
    id: "sr-11",
    title: "Moving mirror reflection and radiation pressure",
    source: "/papers/special-relativity/#s8",
    overview: "Reflect light off a receding mirror and account for every joule.",
    full: "The reflected light has lower frequency and amplitude, the mirror feels a pressure, and the power that arrives minus the power that leaves is the work done on the mirror. At 0.6c and normal incidence the frequency returns at a quarter, and three quarters of the arriving power becomes work.",
    steps:
      "Transform into the mirror's frame, reflect there, and transform back. Read the frequency, angle and amplitude ratios, then the pressure and the energy ledger; where the light is too oblique to catch the mirror, the lab says so.",
  },
  {
    id: "sr-12",
    title: "Charge and current density",
    source: "/papers/special-relativity/#s9",
    overview: "Boost a current-carrying wire and see a charge density appear.",
    full: "Charge density and current density transform together, as time and position do. A wire that is neutral in its own frame carries a charge density in a frame moving along it, and the lab shows how much.",
    steps:
      "Set the charge density, the current density and the boost, and read the transformed pair. Check the combination that every frame agrees on, then try a current whose carriers would need to move at light speed, which the lab refuses.",
  },
  {
    id: "sr-13",
    title: "Dynamics of the slowly accelerated electron",
    source: "/papers/special-relativity/#s10",
    overview: "Push an electron with a field and follow its speed, energy and path.",
    full: "The electron's motion follows from its equation of motion in its momentary rest frame. The lab integrates the path and sets the paper's longitudinal and transverse masses beside those of the modern force convention, which gives a different transverse mass.",
    steps:
      "Choose the fields and the starting speed, then read the work done and the kinetic energy; the speed never reaches that of light. Compare Einstein's transverse mass with the modern one: the difference comes from how force is defined, not from the physics.",
  },
] as const;

export type EmbeddableId = (typeof EMBED_INSTRUMENTS)[number]["id"];
export function embedInstrument(id: string) {
  return EMBED_INSTRUMENTS.find((instrument) => instrument.id === id);
}
export function isEmbeddableId(id: unknown): id is EmbeddableId {
  return typeof id === "string" && embedInstrument(id) !== undefined;
}
