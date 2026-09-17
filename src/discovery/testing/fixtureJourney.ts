/**
 * Canonical test fixtures for Discovery Journey framework testing.
 * Specification: am-disc-journey-framework-umbg
 */

import type { Journey } from "../../content/schemas/journey.ts";

export const FIXTURE_JOURNEY_BROWNIAN: Journey = {
  id: "brownian-motion",
  paper: "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen",
  revision: 1,
  completeness: "complete",
  shelf: ["card-osmotic-pressure", "card-stokes-law", "card-equipartition"],
  naggingFact:
    "Suspended microscopic particles in a liquid at rest never settle into permanent stillness.",
  firstHonestQuestion: "How can the thermal agitation of invisible molecules produce observable microscopic motion?",
  stages: [
    {
      id: "arg-bm-observable",
      title: "Zero average is not no movement",
      question: "Why do symmetric random steps yield zero mean but non-zero spread?",
      computeFromShelf:
        "The osmotic pressure and Stokes drag balance determine the diffusion coefficient.",
      premiseRefs: [{ cardId: "card-osmotic-pressure" }, { cardId: "card-stokes-law" }],
      instrument: {
        instrumentId: "bm-01",
        mode: "bm-01:default",
        presetId: "bm-01-einstein-08",
      },
      reasoning: [{ foundationId: "bridge-squaring-square-roots" }],
      prerequisites: ["random-walks"],
      support: {
        workedExample: {
          prompt: "Calculate the mean square displacement after 4 equal steps.",
          steps: ["Step 1: x1 = +1", "Step 2: x2 = -1", "Step 3: x3 = +1", "Step 4: x4 = +1", "Sum of squares = 4"],
          result: "Mean square displacement is proportional to the number of steps.",
        },
        partialComparison: {
          given: "For 1 second, RMS displacement is 1 unit.",
          toComplete: "For 4 seconds, RMS displacement is...",
          explanation: "Square root of 4 gives 2 units.",
        },
        prediction: {
          prompt: "What happens to the spread when the observation time quadruples?",
          choices: ["No change", "It doubles", "It quadruples"],
          explanation: "The displacement scale grows with the square root of time, so it doubles.",
        },
        explanation:
          "Because individual displacements are independently signed, the linear average vanishes while the mean square accumulates.",
        transferCase: {
          condition: "What if the liquid is twice as viscous?",
          explanation: "Viscosity halves D, reducing the RMS displacement by sqrt(2).",
          whatChanges: "The diffusion constant D is reduced by a factor of 2.",
          whatStaysValid: "The square-root time scaling lambda = sqrt(2Dt) remains valid.",
        },
      },
      meanings: {
        logicalRole: "premise",
        historicalStatus: "accepted-period",
        modelStatus: "continuous-limit",
        executionStatus: "deterministic-closed-form",
      },
    },
  ],
  forks: [
    {
      id: "arg-fork-observable",
      afterStageId: "arg-bm-observable",
      question: "Which observable quantity should be measured to characterize the motion?",
      varies: "observable-definition",
      branches: [
        {
          id: "arg-branch-apparent-velocity",
          label: "Appren-velocity trajectory tracking",
          proponent: { name: "Exner", cardId: "card-exner-1900" },
          hypothesis: "Measure distance divided by time between subsequent microscope observations.",
          worksWhen: "When observation intervals are long and apparent speed is treated as an interval-dependent quantity.",
          steps: [{ text: "Track position every 0.1 s." }, { text: "Divide path length by elapsed time." }],
          outcome: {
            type: "correct-but-weaker",
            plainLanguage: "Accurate as an apparent speed over a chosen interval, but does not reveal an intrinsic molecular velocity.",
          },
        },
        {
          id: "arg-branch-mean-square-displacement",
          label: "Mean-square displacement scaling",
          hypothesis: "Measure the statistical spread across an ensemble as a function of elapsed time.",
          worksWhen: "When steps are treated as independent stochastic fluctuations.",
          steps: [{ text: "Record starting coordinates." }, { text: "Compute root-mean-square displacement." }],
          outcome: {
            type: "papers-route",
            plainLanguage: "The relation lambda_x = sqrt(2Dt) connects microscopic diffusion to observable displacement.",
          },
        },
      ],
    },
    {
      id: "arg-fork-mechanism",
      afterStageId: "arg-bm-observable",
      question: "What physical mechanism drives the irregular displacement?",
      varies: "theoretical-postulate",
      branches: [
        {
          id: "arg-branch-external-vibrations",
          label: "Ambient environmental vibrations",
          hypothesis: "Building and floor vibrations transmitted through the vessel drive particle jiggling.",
          worksWhen: "In non-isolated experimental apparatus.",
          steps: [{ text: "Place sample on heavy stone table in deep cellar." }],
          outcome: {
            type: "dead-end-on-constraint",
            constraintRef: "card-gouy-1888",
            plainLanguage: "Gouy demonstrated that motion persists in isolated deep basements and sealed tubes indefinitely.",
          },
        },
        {
          id: "arg-branch-molecular-collisions",
          label: "Thermal molecular bombardment",
          hypothesis: "Unbalanced instantaneous collisions from solvent molecules transfer momentum to suspended particles.",
          worksWhen: "When matter is atomic and heat is kinetic energy.",
          steps: [{ text: "Apply kinetic theory of heat to suspended particles." }],
          outcome: {
            type: "papers-route",
            plainLanguage: "Particles in suspension exert osmotic pressure exactly like dissolved molecules of the same number.",
          },
        },
      ],
    },
  ],
  move: {
    label: "Equipartition to Suspended Particles",
    chainId: "chain-bm-diffusion",
    stepId: "bm-step-move-osmotic",
    r0Summary: {
      text: "Treating suspended microscopic particles as gas molecules obeying the laws of heat relates their diffusion rate to Avogadro's number.",
      reviewState: "reviewed",
    },
  },
  worldChecks: [
    {
      id: "check-perrin-avogadro",
      claim: "The diffusion equation yields Avogadro's number within experimental precision.",
      instrumentId: "bm-07",
      quantityId: "avogadroNumber",
      expected: 6e23,
      tolerance: { relative: 0.2 },
      laterEvidence: {
        year: 1908,
        description: "Jean Perrin's sedimentation equilibrium and displacement measurements.",
        recordId: "perrin-1908-data",
      },
      staticWorkedExample: {
        label: "Perrin (1908) gamboge emulsion",
        value: "6.8e23",
        unit: "mol⁻¹",
        constantSetId: "historical-1908",
      },
      comparisonKind: "printed-prediction",
    },
  ],
  sourceJumps: [
    {
      id: "jump-bm-section-4",
      label: "Read Section 4: On the movement of suspended particles",
      paperId: "brownian-motion",
      section: "s4",
      targetAnchor: "s4-p1",
      weavePredicateId: "pred-bm-diffusion",
      pointer: "This is where the paper connects the diffusion coefficient to osmotic pressure.",
    },
  ],
  exercises: [
    {
      id: "ex-bm-displacement-scaling",
      role: "instrumented",
      prompt: "Find the factor by which mean square displacement increases when time is multiplied by nine.",
    },
    {
      id: "ex-bm-viscosity-dependence",
      role: "instrumented",
      prompt: "Compare particle spread in water versus glycerine at identical temperatures.",
    },
    {
      id: "ex-bm-reasoning-verbal",
      role: "explanation",
      prompt: "Why can an observable with zero average still carry physical information?",
    },
  ],
  ppeTask: {
    promptId: "ppe-bm-chapter-end",
    task: "Predict what happens to displacement spread if particle radius is doubled.",
    perturbPrompt: "Change particle radius from 0.5 um to 1.0 um in the laboratory.",
    explainPrompt: "Explain how Stokes drag reduces the diffusion coefficient inversely with radius.",
  },
  doors: {
    frontDoor: {
      id: "door-bm-front",
      title: "From Brownian steps to molecular reality",
      arrivesAtEquationId: "eq-bm-diffusion-coefficient",
    },
    sideDoors: [
      {
        id: "door-bm-arithmetic",
        title: "The arithmetic of independent coin tosses",
        arrivesAtEquationId: "eq-bm-diffusion-coefficient",
        entryRecordId: "entrance-brownian-motion",
      },
    ],
  },
};

export const FIXTURE_PARTIAL_JOURNEY: Journey = {
  ...FIXTURE_JOURNEY_BROWNIAN,
  id: "light-quanta",
  completeness: "partial",
  worldChecks: [],
  exercises: [],
  pendingElements: [
    {
      element: "worldChecks",
      reason: "Photoelectric and photoluminescence data checks in preparation.",
      ownerBead: "am-disc-journey-i-chain-n1lh",
    },
    {
      element: "exercises.instrumented",
      reason: "Light-quanta checker exercises in preparation.",
      ownerBead: "am-disc-journey-i-chain-n1lh",
    },
  ],
};
