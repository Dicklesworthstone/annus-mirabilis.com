/** The placement contract shared by /connections and the full-course syllabus. */
export const CONNECTION_EXERCISE_LINKS = Object.freeze([
  {
    id: "cross-journey-avogadro-three-ways",
    title: "Infer a molecular number by different routes",
    href: "/connections/#cross-journey-avogadro-three-ways",
    minutes: 20,
    task: "Compare the radiation-constant calculation with an inference from synthetic Brownian displacements. Keep the radius, measured spread and source of each constant visible.",
    question:
      "What independent information does each route need before it can determine a molecular number?",
    explanation:
      "Agreement is meaningful only after each route's inputs and uncertainty are stated. The Brownian interval is conditional on the known radius and the observation model. Synthetic data check the inference machinery, not the existence of molecules; a deferred dissertation route cannot supply a third historical measurement.",
  },
  {
    id: "cross-journey-doppler-eigenvalue",
    title: "Find one number in a colour shift and a boost",
    href: "/connections/#cross-journey-doppler-eigenvalue",
    minutes: 12,
    task: "Calculate the approaching and receding Doppler factors, compare them with the light-line scaling of a boost, and check an equivalent expression.",
    question:
      "Why does the same factor appear when a light wave changes frequency and when a boost rescales a light direction?",
    explanation:
      "A boost preserves each light direction while changing its scale. The wave's frequency and wave vector transform together, so the light-line scale also supplies its Doppler factor. The direction convention matters: receding and approaching factors are reciprocals, not the same number.",
  },
  {
    id: "cross-journey-effective-mass",
    title: "Separate an energy equivalent from invariant mass",
    href: "/connections/#cross-journey-effective-mass",
    minutes: 8,
    task: "In an explicitly modern comparison, calculate the energy-equivalent mass of visible light and distinguish it from the invariant mass of a photon.",
    question:
      "What does dividing a light quantum's energy by the square of light speed tell you, and what does it leave unchanged?",
    explanation:
      "The energy equivalent describes a contribution to a system's energy and inertia. A photon still has zero invariant mass. The September paper uses transformed radiation energy without assuming quanta, and the light-quanta hypothesis does not establish special relativity.",
  },
  {
    id: "cross-journey-statistical-papers",
    title: "Compare the direction of the two statistical arguments",
    href: "/connections/#cross-journey-statistical-papers",
    minutes: 12,
    task: "Compare the role of independence and volume dependence in the two statistical papers, then describe which direction each inference takes.",
    question:
      "Does the same counting pattern make the light-quanta and Brownian arguments the same kind of evidence?",
    explanation:
      "The light paper uses an entropy correspondence in the Wien regime to suggest an energy-element interpretation. The Brownian paper starts from molecular-statistical assumptions to derive a displacement prediction that can be compared with observations. Shared mathematics does not make the physical assumptions or the direction of inference identical.",
  },
] as const);
