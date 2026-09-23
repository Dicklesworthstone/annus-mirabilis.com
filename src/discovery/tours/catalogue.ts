/** Guided reading routes through existing edition surfaces (am-tours-infra-g518).
 * These explanatory routes do not publish reviewed Journey records or historical shelves.
 * Stop IDs are durable bookmark identities; changing a route's steps requires a revision bump.
 */
export type TourStop = Readonly<{
  id: string;
  title: string;
  activity: "read" | "experiment" | "reconstruct";
  href: string;
  task: string;
  question: string;
  explanation: string;
}>;
export type GuidedTour = Readonly<{
  id: string;
  revision: number;
  title: string;
  introduction: string;
  paper: string;
  stops: readonly TourStop[];
}>;

export const GUIDED_TOURS: readonly GuidedTour[] = [
  {
    id: "brownian-motion",
    revision: 1,
    paper: "brownian-motion",
    title: "From wandering to a molecular number",
    introduction:
      "Choose what to measure, explain a growing spread, then ask what the observations can actually identify.",
    stops: [
      {
        id: "observe",
        title: "Start with a visible speck",
        activity: "read",
        href: "/papers/brownian-motion/#entry-brownian-motion",
        task: "Begin with the no-algebra entrance. Compare signed displacement with the size of a displacement.",
        question: "Can the average signed displacement vanish while the particles keep spreading?",
        explanation:
          "Left and right displacements can cancel in the average. Squared displacements do not cancel. A small mean is not evidence that nothing moved.",
      },
      {
        id: "steps",
        title: "Build the spread from steps",
        activity: "experiment",
        href: "/lab/bm-05/",
        task: "Inspect the independent-step model and its variance. Distinguish this teaching walk from a model of every molecular collision.",
        question:
          "Which assumption makes the cross terms disappear when the displacement sum is squared?",
        explanation:
          "Independent, zero-mean increments give zero mean cross terms. The variance then adds across steps. Correlated increments need a different calculation.",
      },
      {
        id: "distribution",
        title: "Read a probability distribution",
        activity: "experiment",
        href: "/lab/bm-06/",
        task: "Compare the distribution at two times. Inspect a selected interval rather than treating the height of the density as its probability.",
        question: "Does four times the observation time mean four times the typical displacement?",
        explanation:
          "In free diffusion the one-coordinate mean square grows with time, so its square root grows with the square root of time. Interval probability is area under the density, not its height.",
      },
      {
        id: "equilibrium",
        title: "Find diffusion without following every collision",
        activity: "experiment",
        href: "/lab/bm-04/",
        task: "Follow the balance between directional drag and random spreading, keeping its equilibrium assumptions visible.",
        question:
          "Why can an auxiliary force help determine diffusion even though it drops out of the final relation?",
        explanation:
          "The force connects drift and osmotic equilibrium. Matching the two descriptions relates diffusion to mobility and temperature. The zero-force case is a limit of that argument, not a division of zero by zero.",
      },
      {
        id: "infer",
        title: "Ask what a recording identifies",
        activity: "experiment",
        href: "/lab/bm-07/",
        task: "Inspect the diffusion estimate and its assumptions before interpreting a molecular number. Keep radius, viscosity and temperature explicit.",
        question: "Is a diffusion estimate alone enough to determine a molecular number?",
        explanation:
          "The molecular-number inference also needs the physical inputs in the diffusion relation. A statistical interval does not account for every possible calibration error or a wrong physical model.",
      },
      {
        id: "camera",
        title: "Separate the particle from its measurement",
        activity: "experiment",
        href: "/lab/bm-08/",
        task: "Compare the particle, camera and estimate. Look for assumptions broken by blur, localization error or observation timing.",
        question: "Could changing the camera change the estimate without changing the liquid?",
        explanation:
          "A recording is a measurement model as well as a particle model. Observational effects can alter inferred diffusion even when the underlying motion is unchanged.",
      },
      {
        id: "paper",
        title: "Return to the whole argument",
        activity: "read",
        href: "/papers/brownian-motion/",
        task: "Read the paper's two routes to diffusion and its closing observable prediction. Use the facsimile and the edition's stated availability of each reading face.",
        question:
          "How would you explain the chain from visible displacements to molecules, naming what must be known independently?",
        explanation:
          "A complete account separates the displacement statistic, the diffusion model, the relation to mobility, the calibrated inputs, and the uncertainty of the inference. Finishing this route is not a test of mastery.",
      },
    ],
  },
  {
    id: "light-quanta",
    revision: 1,
    paper: "light-quanta",
    title: "From entropy to energy packets",
    introduction:
      "Preserve the successes of waves, examine a restricted entropy comparison, and distinguish a hypothesis from its consequences.",
    stops: [
      {
        id: "count",
        title: "Begin with a counting question",
        activity: "read",
        href: "/papers/light-quanta/#entry-light-quanta",
        task: "Take the no-algebra counting entrance. Keep the difference between light propagating and light exchanging energy in view.",
        question: "Would an energy-transfer hypothesis erase interference?",
        explanation:
          "The successes of a wave description are not discarded by changing the hypothesis about production and absorption. Those are different questions the account must reconcile.",
      },
      {
        id: "regime",
        title: "Locate the regime of the argument",
        activity: "experiment",
        href: "/lab/lq-03/",
        task: "Compare the spectral laws and identify where Wien's law is an admitted approximation. Read the density's axis and units.",
        question:
          "Why does a successful formula in one spectral regime not justify using it everywhere?",
        explanation:
          "The entropy argument has a domain inherited from its spectral premise. Agreement in a restricted region cannot establish a global law or turn a generated curve into observations.",
      },
      {
        id: "entropy",
        title: "Compare volume dependence",
        activity: "experiment",
        href: "/lab/lq-04/",
        task: "Follow the radiation entropy comparison at fixed energy and frequency. Identify what changes when volume changes.",
        question:
          "Which quantities must stay fixed for this comparison to mean what the argument says?",
        explanation:
          "Changing the energy or frequency as well as the volume would ask a different question. The logarithmic volume dependence is being derived under specific constraints and a restricted spectral law.",
      },
      {
        id: "independence",
        title: "Make independence do the work",
        activity: "experiment",
        href: "/lab/lq-05/",
        task: "Compare independent positions with the locked-position alternative. Explain the difference without relying on the appearance of animated dots.",
        question:
          "For a subvolume fraction f, why do independent positions give f to the power n, while perfectly locked positions give f?",
        explanation:
          "Independent events multiply their probabilities. Perfectly locked positions have one collective location. Counting independent possibilities, not drawing particles, supplies the contrast.",
      },
      {
        id: "match",
        title: "Make the heuristic move",
        activity: "experiment",
        href: "/lab/lq-06/",
        task: "Compare the coefficients of the gas and radiation entropy laws. Separate coefficient matching from extending the interpretation to emission.",
        question:
          "What does the entropy correspondence suggest, and what extra assumption is needed for an emission prediction?",
        explanation:
          "The correspondence suggests independent energy elements in the stated regime. Treating energy exchange as single-quantum transfer is a further hypothesis, not a measurement performed by the matching calculation.",
      },
      {
        id: "emission",
        title: "Change power, then frequency",
        activity: "experiment",
        href: "/lab/lq-08/",
        task: "Compare a power change at fixed frequency with a frequency change at fixed power. Inspect the threshold case and the declared collection model.",
        question: "Why are electron count and maximum electron energy different observables?",
        explanation:
          "Under the single-quantum model, frequency sets the available energy per quantum while optical power also affects the quantum arrival rate. Below threshold the model has no emitted electron, not an electron with negative kinetic energy.",
      },
      {
        id: "ionization",
        title: "Follow the paper beyond the familiar example",
        activity: "experiment",
        href: "/lab/lq-09/",
        task: "Inspect the ionization threshold and event-count bound. Identify which extra information an exact yield would require.",
        question:
          "Does an energy budget determine an absorption cross-section or an exact number of observed ions?",
        explanation:
          "An energy bound constrains possible events under stated assumptions. It does not supply unmodeled interaction probabilities or a measured yield.",
      },
      {
        id: "paper",
        title: "Read the qualifications in the source",
        activity: "read",
        href: "/papers/light-quanta/",
        task: "Return to the full paper, including fluorescence and ionization. Keep its heuristic scope distinct from later theory.",
        question:
          "Which steps are derived from the spectral premise, which are hypotheses, and which still call for observations?",
        explanation:
          "The route connects a restricted entropy law to an interpretation and then to conditional predictions. A simulation of those predictions is not an independent experimental confirmation.",
      },
    ],
  },
  {
    id: "special-relativity",
    revision: 1,
    paper: "special-relativity",
    title: "Clocks, coordinate maps and light",
    introduction:
      "Define a measurement before transforming it, then carry the same discipline into the electrodynamic half of the paper.",
    stops: [
      {
        id: "flash",
        title: "One flash and two clocks",
        activity: "read",
        href: "/papers/special-relativity/#entry-special-relativity",
        task: "Start with the no-algebra entrance. Distinguish an event at a clock from the later arrival of its image.",
        question:
          "Does seeing a remote clock tell you its reading at your present coordinate time?",
        explanation:
          "Reception and emission are different events. A coordinate-time assignment needs an explicit procedure rather than an unexplained camera view.",
      },
      {
        id: "synchronize",
        title: "Specify the timing procedure",
        activity: "experiment",
        href: "/lab/sr-01/",
        task: "Inspect the emission, reflection and return events in the clock-synchronization ledger.",
        question: "What convention connects the remote reflection time to the round-trip readings?",
        explanation:
          "The procedure assigns the remote reflection the midpoint of the local round-trip times. The convention and the relevant clocks must remain visible when changing frames.",
      },
      {
        id: "construct",
        title: "Earn the coordinate map",
        activity: "experiment",
        href: "/lab/sr-04/",
        task: "Begin with the light constraints, then inspect what reciprocity, isotropy and the identity branch add. Keep the transverse step separate.",
        question: "Do the two light directions already fix the common scale?",
        explanation:
          "The two longitudinal light constraints leave a scale freedom. The inverse and symmetry conditions and a branch choice do additional work. The transverse equations require their own assumptions and check.",
      },
      {
        id: "measure",
        title: "Choose events that answer the question",
        activity: "experiment",
        href: "/lab/sr-03/",
        task: "Compare transformed event separations with a rod-length measurement using endpoint events simultaneous in the measuring frame.",
        question:
          "Can a transformed spatial separation be larger while the correctly measured rod length is smaller?",
        explanation:
          "Yes: the two calculations can use different event pairs. A spatial separation of events at different moving-frame times is not that frame's length measurement.",
      },
      {
        id: "fields",
        title: "Do not stop at clocks and rulers",
        activity: "experiment",
        href: "/lab/sr-08/",
        task: "Inspect the electric and magnetic fields and the force in the two frames. Compare the same event with the stated frame convention.",
        question:
          "Should the raw field and force components be numerically identical in both frames?",
        explanation:
          "A change of description transforms components. Consistency means satisfying their transformation laws at the same event, not forcing unlike components to be equal.",
      },
      {
        id: "packet",
        title: "Transform a bounded light complex",
        activity: "experiment",
        href: "/lab/sr-10/",
        task: "Inspect the energy-density and bounding-volume factors separately before their product.",
        question:
          "Why is the volume of a light complex not transformed as the volume of a material rod?",
        explanation:
          "Each frame selects a simultaneous slice of a moving light complex. Its boundary is not a material body. The energy-density and volume factors together determine the total energy transformation.",
      },
      {
        id: "electron",
        title: "Read the force convention before the coefficient",
        activity: "experiment",
        href: "/lab/sr-13/",
        task: "Compare the historical transverse coefficient and the modern same-frame description. Name the frame of each force and acceleration.",
        question:
          "Are two transverse coefficients necessarily competing measurements of one scalar rest mass?",
        explanation:
          "No. A convention mixing force in the comoving frame with acceleration in the original frame differs from a same-frame convention. The definitions must be compared before the numbers.",
      },
      {
        id: "paper",
        title: "Read both halves of the paper",
        activity: "read",
        href: "/papers/special-relativity/",
        task: "Return to the source, including sections 6–10. Connect the measurement procedure, coordinate map, fields and light-energy result.",
        question:
          "Which result can the mass–energy paper import without assuming mass–energy equivalence?",
        explanation:
          "The transformation of light energy provides an explicit input to the balanced-emission argument. The next argument must identify that input rather than assume the conclusion it seeks.",
      },
    ],
  },
  {
    id: "mass-energy",
    revision: 1,
    paper: "mass-energy",
    title: "Two ledgers, one inference",
    introduction:
      "Follow a symmetric emission, subtract two descriptions, and distinguish a derivation from a consistency check.",
    stops: [
      {
        id: "begin",
        title: "Ask what can change when light leaves",
        activity: "read",
        href: "/papers/mass-energy/#entry-mass-energy",
        task: "Begin with the paper's first encounter. Treat the relation between inertia and emitted energy as the question, not the premise.",
        question: "Why arrange two equal emissions in opposite directions?",
        explanation:
          "Symmetry removes recoil in the original rest frame. It isolates the energy change without beginning by calling the pulses converted mass.",
      },
      {
        id: "ledgers",
        title: "Write the same emission twice",
        activity: "experiment",
        href: "/lab/me-01/",
        task: "Compare the rest-frame and moving-frame energy ledgers. Track the two pulses separately and then their sum.",
        question: "Which result from the preceding paper supplies the moving-frame light energies?",
        explanation:
          "The light-energy transformation is an imported premise. Symmetric emission and conservation in each frame allow the ledgers to be compared without an assumed rest-energy formula.",
      },
      {
        id: "coefficient",
        title: "Inspect the low-speed coefficient",
        activity: "experiment",
        href: "/lab/me-02/",
        task: "Compare the kinetic-energy change at fixed speed with its low-speed form. Inspect the coefficient rather than only a dramatic high-speed case.",
        question: "What lets a change in energy of motion identify a change in inertia?",
        explanation:
          "The low-speed kinetic-energy coefficient links the energy change to inertia. Matching that coefficient under the argument's assumptions is different from inserting an already assumed relativistic energy formula.",
      },
      {
        id: "argument",
        title: "Remove a premise and see what remains",
        activity: "reconstruct",
        href: "/discover/mass-energy/investigate/#argument-workbench",
        task: "Assemble the worked argument. Inspect an unresolved offset and compare with the route that assumes its target relation.",
        question:
          "Does a correct calculation become an independent derivation when one of its premises is the conclusion?",
        explanation:
          "Such a calculation can be a consistency check but not an independent derivation. The supported conclusion depends on exactly which earlier premises are admitted.",
      },
      {
        id: "boundary",
        title: "Name the system before balancing it",
        activity: "experiment",
        href: "/lab/me-03/",
        task: "Inspect the system boundary and energy ledger. Distinguish the emitting body from a larger system that also includes its radiation.",
        question: "Can energy leave a body without leaving a larger closed system?",
        explanation:
          "Yes. An energy balance depends on what is inside its boundary. A change in one subsystem is not the disappearance of energy from the whole system.",
      },
      {
        id: "paper",
        title: "Read the short paper without skipping its assumptions",
        activity: "read",
        href: "/papers/mass-energy/",
        task: "Return to the full source and identify the light-energy import, subtraction, offset assumption and low-speed comparison.",
        question:
          "How would you explain the argument to another reader without starting with its famous conclusion?",
        explanation:
          "An explanation names the symmetric experiment, the two conservation ledgers and the assumptions that let their difference be interpreted. Reaching the end records a reading position, not a score or a claim of mastery.",
      },
    ],
  },
];

export function getGuidedTour(id: string): GuidedTour | null {
  return GUIDED_TOURS.find((tour) => tour.id === id) ?? null;
}
export function getTourStop(tour: GuidedTour, id: string): TourStop | null {
  return tour.stops.find((stop) => stop.id === id) ?? null;
}
