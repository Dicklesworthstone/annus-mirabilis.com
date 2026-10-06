import type { InvestigationSpec } from "./core.ts";

/** The four published PPE tasks, and outputs their existing embedded laboratories actually publish. */
export const INVESTIGATIONS = {
  "brownian-motion": {
    paper: "brownian-motion", promptId: "bm-predict-perturb-explain-radius", experimentId: "bm-01",
    laboratoryAnchor: "investigation-brownian-laboratory",
    sourceHref: "/papers/brownian-motion/s5/#arg-bm-inference",
    quantities: [
      { id: "lambdaX1s", label: "One-axis root mean square displacement after one second" },
      { id: "lambdaX60s", label: "One-axis root mean square displacement after one minute" },
    ],
    parameterLabels: { T: "Temperature (K)", eta: "Viscosity (Pa s)", a: "Particle radius (m)", seed: "Random seed" },
  },
  "light-quanta": {
    paper: "light-quanta", promptId: "ppe-light-quanta-s7-s9", experimentId: "lq-08",
    laboratoryAnchor: "investigation-light-quanta-laboratory",
    sourceHref: "/papers/light-quanta/s8/",
    quantities: [
      { id: "incidentPower", label: "Power falling on the metal" },
      { id: "emissionRate", label: "Electrons emitted each second" },
      { id: "maxKineticEnergy", label: "Greatest emitted-electron kinetic energy" },
      { id: "stoppingPotentialMagnitude", label: "Potential that stops the fastest electrons" },
    ],
    parameterLabels: { incidentPower: "Incident power (W)", frequency: "Frequency (Hz)", workFunction: "Exit cost (eV)", quantumEfficiency: "Quantum efficiency", collectorPotential: "Collector potential (V)" },
  },
  "special-relativity": {
    paper: "special-relativity", promptId: "ppe-special-relativity-s4", experimentId: "sr-05",
    laboratoryAnchor: "investigation-relativity-laboratory",
    sourceHref: "/papers/special-relativity/s4/",
    quantities: [
      { id: "coordinateTime", label: "Time on the resting clocks" },
      { id: "properTime", label: "Time on the moving clock" },
      { id: "dilationLossExact", label: "Exact loss in each second" },
    ],
    parameterLabels: { speed: "Speed as a fraction of light speed", worldlinePreset: "Worldline", duration: "Duration" },
  },
  "mass-energy": {
    paper: "mass-energy", promptId: "me-predict-perturb-explain-joule", experimentId: "me-03",
    laboratoryAnchor: "investigation-mass-energy-laboratory",
    sourceHref: "/papers/mass-energy/#arg-me-small-speed",
    quantities: [
      { id: "energyChange", label: "Energy change inside the boundary" },
      { id: "massChange", label: "Mass change inside the boundary" },
    ],
    parameterLabels: { mode: "Ledger mode", boundary: "System boundary", emittedEnergy: "Emitted energy" },
  },
} as const satisfies Readonly<Record<string, InvestigationSpec>>;
