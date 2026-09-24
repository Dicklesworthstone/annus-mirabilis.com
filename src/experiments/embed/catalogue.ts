/** Explicit admission list for real, server-renderable laboratory adapters.
 * Registration alone is not proof that an instrument can be embedded.
 * Plan §10.7; am-inst-embed-route-rnyg. No numerical laws live here.
 */
export const EMBED_INSTRUMENTS = [
  {
    id: "bm-03",
    title: "Counting configurations and osmotic pressure",
    source: "/papers/brownian-motion/view/german/#s2",
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
  {
    id: "sr-01",
    title: "Clock synchronization with the event ledger",
    source: "/papers/special-relativity/#s1",
    overview: "Give a time to a distant event by sending a signal and halving the round trip.",
    full: "Section 1 defines the time at a distant clock by setting the light's outward and return times equal. The one-way time is never measured; the lab reports it as not applicable, while the round-trip speed is a real measurement with one clock.",
    steps:
      "Send a flash from A, reflect it at B, and read the time the rule assigns to the reflection. Then move the stations as in section 2 and see the two legs become unequal, and set a moving pair of clocks in step to find the trailing clock ahead as judged from the platform.",
  },
  {
    id: "sr-02",
    title: "Magnet and conductor",
    source: "/papers/special-relativity/#s6",
    overview: "Describe the same relative motion of a magnet and a wire in each body's rest frame.",
    full: "Moving the magnet or the wire gives the same current, but the physics of 1905 explained the two cases differently. Transformed to the wire's frame, the magnet's field has an electric part, and that is what drives the charges.",
    steps:
      "Compare the work per unit charge along a segment across the motion in both frames, vBℓ and γvBℓ, then turn the segment along the motion, where the force points across it and the work is zero. The apparatus mode tells the story without computing it.",
  },
  {
    id: "bm-01",
    title: "The Brownian tracer ensemble",
    source: "/papers/brownian-motion/#arg-bm-observable",
    overview: "Follow hundreds of particles from one start and watch their spread grow.",
    full: "Each tracer takes its own random path. The average position stays near the start while the typical distance keeps growing as the square root of the time; at the default settings it is about 0.93 μm along one axis after 1 s.",
    steps:
      "Pick an observation time and compare the sample mean, mean square and root mean square with the model; four times as long gives twice the typical distance. Changing when you observe re-reads the same paths and draws no new ones.",
  },
  {
    id: "bm-04",
    title: "Drift-diffusion balance and the Stokes-Einstein relation",
    source: "/papers/brownian-motion/view/german/#s3",
    overview: "Push suspended particles with a steady force and see drift and diffusion balance.",
    full: "The force makes the particles drift and pile up, and their random motion spreads them back out. At balance the diffusion coefficient is fixed by the temperature and the drag of the liquid alone, whatever the force was.",
    steps:
      "Change the force and watch the steady profile steepen while the diffusion coefficient stays put; then change the temperature, viscosity or radius and see it move. The balance is section 3's route to the Stokes-Einstein relation.",
  },
  {
    id: "bm-06",
    title: "The spreading laboratory",
    source: "/papers/brownian-motion/#arg-bm-gaussian",
    overview: "Watch particles spread from one point into a bell curve.",
    full: "After a time t a particle could be anywhere nearby, most likely close to where it began. The spread follows a bell curve whose width grows as the square root of the time and is smaller for bigger spheres and thicker liquids.",
    steps:
      "Choose an interval and ask how likely a particle is to finish inside it, then compare the bell curve with the stepped numerical model. Doubling the viscosity halves the diffusion coefficient and narrows the spread by a factor of √2, not by half.",
  },
  {
    id: "lq-01",
    title: "Wave description and energy spreading",
    source: "/papers/light-quanta/#s0",
    overview: "Treat light as a continuous wave and see what that picture explains.",
    full: "Two sources make bright and dark stripes, and the light of one source spreads ever thinner over larger spheres. Einstein granted that the wave picture explains everything purely optical, and asked whether it could still fail where light is produced or absorbed.",
    steps:
      "Compare equal and unequal amplitudes and a phase shift, then follow the energy of one source out to larger distances. The wave picture keeps its successes here; the paper's question is about emission and absorption.",
  },
  {
    id: "lq-03",
    title: "The radiation spectrum and regime comparison",
    source: "/papers/light-quanta/#s2",
    overview: "Compare a hot body's glow with Wien's formula and the classical rule.",
    full: "A hot body glows at every frequency, most brightly in a middle range that moves higher as it gets hotter. Wien's formula matches the high frequencies and the classical rule the low ones, and each fails badly where the other works.",
    steps:
      "Set the temperature and read where each law agrees with the full spectrum. Then check what a density plot measures: per unit frequency and per unit wavelength put the peak in different places.",
  },
  {
    id: "lq-04",
    title: "Radiation entropy workbench",
    source: "/papers/light-quanta/#s3",
    overview:
      "Give faint light of one colour more room at the same energy and see its entropy rise.",
    full: "Where Wien's law holds, the entropy of monochromatic radiation grows with its volume by the same logarithmic law as an ideal gas that expands. The lab keeps the energy and the frequency band fixed so the comparison is fair.",
    steps:
      "Halve or double the volume at fixed energy and band and read the entropy change. Then check where the result needs Wien's regime, and which constant the comparison leaves undetermined.",
  },
  {
    id: "lq-07",
    title: "Fluorescence energy budget and Stokes's rule",
    source: "/papers/light-quanta/#s7",
    overview:
      "Check whether a glow can come out at a higher frequency than the light that excites it.",
    full: "On the light-quantum picture one absorbed quantum can pay for at most one emitted quantum of no greater energy, so the glow comes out at a lower frequency. Einstein named the conditions under which the rule could fail, and the lab shows each.",
    steps:
      "Set the exciting and emitted frequencies and read the energy budget per quantum. Then try the exceptions, several quanta absorbed together or heat drawn from the body, and see which the model allows.",
  },
  {
    id: "lq-08",
    title: "Photoelectric apparatus and stopping potential",
    source: "/papers/light-quanta/#s8",
    overview: "Shine light on a metal and measure the fastest electrons it releases.",
    full: "In this model brighter light releases more electrons each second but none faster, while light of a higher frequency makes the fastest ones faster. The stopping potential rises in a straight line with the frequency, as Einstein expected if light gives up its energy in separate quanta.",
    steps:
      "Change the intensity and then the frequency, and compare what each does to the current and to the stopping potential. Below the threshold frequency no electron is emitted, and the stopping potential is reported as not applicable rather than zero.",
  },
  {
    id: "lq-09",
    title: "Gas ionization bounds and counting model",
    source: "/papers/light-quanta/#s9",
    overview: "Ionize a gas with ultraviolet light one quantum at a time.",
    full: "Each quantum must carry at least the work needed to ionize one molecule, which sets a frequency threshold, and the number of molecules ionized should equal the number of quanta absorbed. Einstein proposed that count as a test worth making.",
    steps:
      "Choose a gas with a cited ionization energy, set the frequency and the absorbed energy, and read whether the quanta clear the threshold and how many molecules they could ionize. A gas without a citation is refused rather than given a number.",
  },
  {
    id: "bm-05",
    title: "Random steps to diffusion",
    source: "/papers/brownian-motion/#s4",
    overview: "Add many independent steps and see a spread appear.",
    full: "Change the shape of each step while keeping its variance, and compare the spread after many steps. For independent steps the mean square displacement grows in proportion to the number of steps, whatever the shape of a single step.",
    steps:
      "Begin with the coin walk you can count exactly, then switch to other step shapes with the same variance. Compare the spread and the shape at several step counts, and check which assumptions the result needs.",
  },
  {
    id: "bm-07",
    title: "Inferring the molecular number",
    source: "/papers/brownian-motion/#s5",
    overview: "Ask what a finite set of displacements can tell you about the molecular number.",
    full: "The displacements fix the diffusion coefficient, which ties the particle radius and the molecular number together; without an independent radius the two cannot be separated. The positions here are synthetic, generated with a hidden molecular number.",
    steps:
      "First ask what the observations identify. Then declare the missing information, estimate the number, and test what a confidence interval does across hypothetical repeats.",
  },
  {
    id: "bm-08",
    title: "Measurement bias: localization noise, drift and exposure",
    source: "/papers/brownian-motion/#s5",
    overview: "See how a camera's errors change what the same motion appears to show.",
    full: "A camera averages the motion over each exposure and adds uncertainty to every recorded position. The particle follows the same path either way, but the recorded displacements, and what they say about diffusion, change. The camera model is a later measurement aid, not Einstein's derivation.",
    steps:
      "Add localization noise, drift and a longer exposure one at a time, and compare what the recorded positions imply about the spread after each change.",
  },
  {
    id: "sr-06",
    title: "Velocity composition",
    source: "/papers/special-relativity/#s5",
    overview: "Combine two speeds and see why the result never reaches light speed.",
    full: "By the addition theorem of §5, two speeds below light speed compose to less than their sum and never to light speed or more. Motions at an angle compose differently from motions along one line.",
    steps:
      "Compose 0.6c with 0.6c and compare the result with 1.2c. Then set an angle between the two motions, and apply two boosts in turn.",
  },
  {
    id: "sr-07",
    title: "Transforming the field equations",
    source: "/papers/special-relativity/#s6",
    overview:
      "Transform the Maxwell-Hertz equations and see what the fields must do to keep their form.",
    full: "Under the transformation of §3 the field equations keep their form only when the electric and magnetic components transform together, as §6 sets out. The laboratory reports the residuals of the transformed equations.",
    steps:
      "Change the frame speed and the field components, and read the residuals of the transformed equations. Compare the symbols printed in §6 with their modern names.",
  },
] as const;

export type EmbeddableId = (typeof EMBED_INSTRUMENTS)[number]["id"];
export function embedInstrument(id: string) {
  return EMBED_INSTRUMENTS.find((instrument) => instrument.id === id);
}
export function isEmbeddableId(id: unknown): id is EmbeddableId {
  return typeof id === "string" && embedInstrument(id) !== undefined;
}
