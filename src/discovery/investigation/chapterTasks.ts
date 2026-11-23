import type { PpeTask } from "../../content/schemas/journey.ts";
import type { CHAPTER_INVESTIGATION_KEYS } from "../../platform/storage/keys.ts";
import type { InvestigationSpec } from "./core.ts";

export type ChapterInvestigationId = keyof typeof CHAPTER_INVESTIGATION_KEYS;
export type ChapterInvestigation = Readonly<{
  id: ChapterInvestigationId;
  paper: "brownian-motion" | "special-relativity";
  section: string;
  title: string;
  laboratory: "bm-04" | "sr-02" | "sr-13";
  laboratoryLabel: string;
  task: PpeTask;
  spec: InvestigationSpec;
  feedback: Readonly<{ assumption: string; quantity: string; confusion: string }>;
  explanation: readonly string[];
  criteria: readonly string[];
  revisit: string;
}>;

/**
 * Three prose tasks from am-disc-ppe-teachback-wnp7, placed after the named chapters.
 * These are teaching records only. Readings come from the existing laboratory owners; all
 * quantities below are scalar outputs those owners already publish. The four journey tasks
 * in specs.ts retain their identities, placements and saved copies.
 */
export const CHAPTER_INVESTIGATIONS = [
  {
    id: "ppe-brownian-motion-s0-s3",
    paper: "brownian-motion",
    section: "s3",
    title: "Molecular kicks and a concentration gradient",
    laboratory: "bm-04",
    laboratoryLabel: "the drift and diffusion laboratory",
    task: {
      promptId: "ppe-brownian-motion-s0-s3",
      task:
        "With no external force, turn the molecular kicks off. What happens to a concentration gradient of suspended particles, and which observation contradicts a world without kicks?",
      perturbPrompt:
        "First choose Pure diffusion relaxation (m = 1, F = 0), apply the settings, and pin your prediction with the accepted starting reading. Then choose Nägeli frozen step (m = 0, F = 0), apply, wait for the accepted reading, and capture it. Both presets use the same initial step, particle radius, temperature and viscosity; only the kicks change.",
      explainPrompt:
        "Explain why the gradient relaxes with kicks and remains with them off. Connect thermal agitation, osmotic pressure and diffusion, and name an observation that the kicks-off model cannot explain.",
    },
    spec: {
      paper: "brownian-motion",
      promptId: "ppe-brownian-motion-s0-s3",
      experimentId: "bm-04",
      laboratoryAnchor: "investigation-brownian-kicks-laboratory",
      sourceHref: "/papers/brownian-motion/s3/#arg-bm-diffusivity",
      quantities: [
        { id: "diffusionCoefficient", label: "Diffusivity required by thermal equilibrium" },
        { id: "kickDiffusivity", label: "Diffusivity supplied by the molecular kicks" },
        { id: "driftVelocity", label: "Velocity from the external force" },
        { id: "diffusionFlux", label: "Diffusion flux at the laboratory's sampling point" },
        { id: "totalFlux", label: "Total flux at the laboratory's sampling point" },
      ],
      parameterLabels: {
        F: "External force (N)",
        m: "Molecular-kick multiplier",
        T: "Temperature (K)",
        eta: "Viscosity (Pa s)",
        a: "Particle radius (m)",
        profile: "Initial concentration profile",
        steps: "Evolution steps",
        dt: "Time step (s)",
      },
    },
    feedback: {
      assumption:
        "The osmotic-pressure argument and the diffusion argument describe the same suspended particles in thermal equilibrium with the liquid.",
      quantity:
        "The diffusion flux is proportional to the concentration gradient and to the diffusivity. At zero external force, turning the kick diffusivity to zero removes the transport that relaxes the step.",
      confusion:
        "Nägeli's 1879 objection concerned the weakness of an individual molecular impact. The relevant motion comes from the changing imbalance of many impacts; taking every impact separately misses that imbalance.",
    },
    explanation: [
      "With F = 0 there is no drift. The m = 1 branch supplies molecular agitation, so particles spread down the concentration gradient and the step smooths. In the m = 0 branch both drift and diffusion vanish: the initial gradient stays where it was. The zero-force condition matters. With a nonzero force, particles can still drift when the kicks are off.",
      "Observed diffusion and persistent Brownian wandering rule out that motionless model. The observations discussed by Gouy in 1888 linked stronger wandering to smaller particles, warmer liquids and lower viscosity. Einstein's argument joins this spreading to the osmotic pressure of the same suspension, rather than treating the visible particle as something one molecule must push on its own.",
    ],
    criteria: [
      "State that the gradient remains when both the external force and the molecular kicks are zero.",
      "Name observed spreading or intrinsic Brownian wandering as evidence against that branch.",
      "Connect diffusion and osmotic pressure through thermal agitation.",
    ],
    revisit:
      "Return to your pinned prediction after reading the displacement argument in §4. Explain how the growth of the spread supplies another way to detect the same molecular agitation; keep your original prediction visible.",
  },
  {
    id: "ppe-special-relativity-s6",
    paper: "special-relativity",
    section: "s6",
    title: "One event, two field descriptions",
    laboratory: "sr-02",
    laboratoryLabel: "the magnet and conductor laboratory",
    task: {
      promptId: "ppe-special-relativity-s6",
      task:
        "In the magnet's rest frame, moving charges in the conductor feel a magnetic force. Describe the same event in the conductor's rest frame: what acts on the charges there?",
      perturbPrompt:
        "Keep the uniform field, transverse segment and speed fixed. Pin your prediction in the magnet-rest description, choose the conductor-rest description, apply the settings, and capture the accepted reading. This changes the observer, not the apparatus.",
      explainPrompt:
        "Say which field acts on charges at rest in the conductor's frame and where that field comes from. Explain why changing the electric or magnetic description does not introduce a second physical event.",
    },
    spec: {
      paper: "special-relativity",
      promptId: "ppe-special-relativity-s6",
      experimentId: "sr-02",
      laboratoryAnchor: "investigation-relativity-fields-laboratory",
      sourceHref: "/papers/special-relativity/s6/#arg-sr-field-components",
      quantities: [
        { id: "electricFieldStationary", label: "Electric field in the magnet's rest frame" },
        { id: "electricFieldMoving", label: "Electric field in the conductor's rest frame" },
        { id: "transverseForceLaboratory", label: "Force in the magnet's rest frame" },
        { id: "transverseForceComoving", label: "Force in the conductor's rest frame" },
        { id: "electromotiveForceMagnetFrame", label: "EMF along the segment in the magnet frame" },
        { id: "electromotiveForceConductorFrame", label: "EMF along the segment in the conductor frame" },
        { id: "electromotiveForceExcess", label: "Fractional excess of the conductor-frame EMF" },
      ],
      parameterLabels: {
        descriptionFrame: "Observer's frame",
        speed: "Relative speed (m/s)",
        magneticField: "Magnetic field (T)",
        segmentLength: "Segment length (m)",
        pathOrientation: "Segment orientation",
        fieldModel: "Field model",
        sliceDeclared: "Endpoint time slice declared",
      },
    },
    feedback: {
      assumption:
        "The field transformation describes one event using two inertial frames. The moving charge in the magnet's frame is at rest in the conductor's frame.",
      quantity:
        "For a boost along x and a magnetic field B along z, the conductor frame has E′y = −γvB. Its electric force acts on the charge at rest there.",
      confusion:
        "Agreement about the event does not require equal numerical forces or EMFs in both frames at every speed. The familiar low-speed accounts agree to first order in v/c; the transformed force and work must use their own frame.",
    },
    explanation: [
      "In the magnet frame, E = 0 and a charge moving with the conductor feels q(v × B). In the conductor frame that charge has no velocity, so its magnetic force is zero. Transforming the magnet's field supplies an electric field E′y = −γvB, which acts on the stationary charge. What changes is the field description of the event.",
      "For B = 1 T, v = 10 m/s and a transverse segment 0.1 m long, the magnet-frame EMF has magnitude 1 V. The conductor-frame value is γ times as large, with a fractional excess γ − 1 of about 5.56 × 10⁻¹⁶. At 0.6c the factor is 1.25. The laboratory already shows both frame readings, so switching its description preserves that pair of values while recording the new observer.",
    ],
    criteria: [
      "Identify an electric force on charges at rest in the conductor frame.",
      "Trace that electric field to the transformation of the magnet's field.",
      "Distinguish a changed description from a new event, without requiring equal EMFs at all speeds.",
    ],
    revisit:
      "Before reopening the worked explanation, read your original prediction and explain the conductor-frame force aloud or in your saved explanation. Then try 0.6c and account for the factor between the two EMFs.",
  },
  {
    id: "ppe-special-relativity-s9-s10",
    paper: "special-relativity",
    section: "s10",
    title: "Why two transverse masses appear",
    laboratory: "sr-13",
    laboratoryLabel: "the electron dynamics laboratory",
    task: {
      promptId: "ppe-special-relativity-s9-s10",
      task:
        "Two transverse mass coefficients describe the same electron at the same speed. Has the particle changed, or has the definition of force changed?",
      perturbPrompt:
        "Use an electron at 0.6c. Pin the starting reading with Source (Einstein 1905: comoving force), change only Force convention to Laboratory (Planck 1906: F = dp/dt), apply, and capture the accepted reading. Keep the fields and all other settings fixed.",
      explainPrompt:
        "Explain why the transverse coefficients differ while the trajectory and kinetic energy agree. Identify which force is divided by which acceleration, and date the later laboratory convention.",
    },
    spec: {
      paper: "special-relativity",
      promptId: "ppe-special-relativity-s9-s10",
      experimentId: "sr-13",
      laboratoryAnchor: "investigation-relativity-electron-laboratory",
      sourceHref: "/papers/special-relativity/s10/#arg-sr-electron-conventions",
      quantities: [
        { id: "lorentzFactor", label: "Lorentz factor" },
        { id: "longitudinalMass", label: "Longitudinal mass coefficient" },
        { id: "transverseMassComoving", label: "Transverse coefficient using comoving force" },
        { id: "transverseMassLaboratory", label: "Transverse coefficient using laboratory force" },
        { id: "kineticEnergy", label: "Relativistic kinetic energy" },
        { id: "kineticEnergyNewtonian", label: "Newtonian comparison energy" },
        { id: "radiusCurvatureElectric", label: "Electric deflection radius" },
      ],
      parameterLabels: {
        forceConvention: "Force convention",
        initialSpeed: "Initial speed as a fraction of light speed",
        particle: "Particle",
        electricFieldY: "Transverse electric field (V/m)",
        magneticFieldZ: "Magnetic field along z (T)",
        massLanguage: "Mass terminology",
      },
    },
    feedback: {
      assumption:
        "Both accounts describe the same electron and acceleration in the stationary frame. They divide different definitions of transverse force by that acceleration.",
      quantity:
        "Einstein's comoving force gives γ²m; laboratory force gives γm. At 0.6c these are 1.5625m and 1.25m. The longitudinal coefficient is γ³m = 1.953125m in both conventions.",
      confusion:
        "A changed coefficient does not imply a changed electron or a different trajectory. Planck's laboratory-force convention dates from 1906; it should not be silently substituted for Einstein's stated 1905 definition.",
    },
    explanation: [
      "Einstein takes the force measured with the electron in its instantaneous rest frame and divides it by the acceleration in the stationary frame. For a transverse acceleration, that gives γ²m. With Planck's 1906 laboratory force F = dp/dt, the force across the motion is smaller by γ and the quotient is γm. Both coefficients are already displayed in the laboratory; the convention switch chooses their interpretation.",
      "At v = 0.6c, γ = 1.25. The two transverse coefficients are therefore 1.5625m and 1.25m, while the longitudinal coefficient is 1.953125m. The relativistic kinetic energy remains about 127.75 keV, compared with 91.98 keV from the Newtonian expression, and the trajectory is unchanged. A measurement of the path or work does not depend on which force convention names the coefficient.",
    ],
    criteria: [
      "Name the changed force definition rather than a change in the particle.",
      "Explain why the trajectory and kinetic energy agree across the convention switch.",
      "Identify the laboratory convention as Planck's 1906 formulation.",
    ],
    revisit:
      "Return to your original prediction after comparing the two saved readings. Explain to another reader how the two transverse coefficients describe the same motion, and point to a quantity that stayed unchanged.",
  },
] as const satisfies readonly ChapterInvestigation[];

export function chapterInvestigationAt(
  paper: string,
  section: string,
): ChapterInvestigation | undefined {
  return CHAPTER_INVESTIGATIONS.find((chapter) => chapter.paper === paper && chapter.section === section);
}
