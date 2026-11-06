/**
 * The five argument stages of the mass-energy discovery route (am-4k0m).
 *
 * The narrative and existing disclosure text were moved from its page without rewriting.
 * Premise attribution and the worked comparisons are authored here. They draw on the shelf
 * cards and arg-me-symmetric-emission, arg-me-two-ledgers, arg-me-subtraction,
 * arg-me-constant-premise and arg-me-small-speed; they claim no new historical evidence.
 * Both the page and the emitted journey record consume these same stages.
 */
import type { Stage } from "../../content/schemas/journey.ts";

export const SYMMETRIC_EMISSION_STAGE = Object.freeze({
  id: "step-01",
  title: "Start with a body that does nothing",
  question: "Where can the energy have gone?",
  computeFromShelf:
    "Conservation of energy accounts for the energy carried away by light. Radiation pressure makes recoil a real part of the bookkeeping; choosing equal, opposite emissions removes that complication in this idealized setup. Neither claim supplies an absolute energy or a mass for the body.",
  premiseRefs: [
    {
      cardId: "helmholtz-1847-conservation-of-energy",
    },
    {
      cardId: "maxwell-1873-radiation-pressure",
    },
    {
      cardId: "poynting-1884-energy-flux",
    },
  ],
  instrument: {
    instrumentId: "me-01",
  },
  reasoning: [
    {
      foundationId: "work-energy",
      kind: "energy-balance",
      label: "Follow energy across the boundary of the body.",
    },
    {
      foundationId: "conservation-symmetry",
      kind: "symmetry",
      label: "Use equal, opposite emissions to keep the body at the same speed.",
    },
  ],
  prerequisites: ["work-energy", "conservation-symmetry"],
  support: {
    workedExample: {
      prompt:
        "In a worked example, the two flashes each carry five joules in the body’s rest frame. What has been determined about the body?",
      steps: [
        "The two equal, opposite emissions cancel the recoil in the idealized setup.",
        "Add the energies carried away: five joules plus five joules is ten joules.",
        "Conservation makes the body’s energy decrease by ten joules. Its energy before and its energy after remain unknown.",
      ],
      result: "The energy lost is ten joules. This account alone has not determined a mass change.",
    },
    partialComparison: {
      given: "The flashes carry equal energy in opposite directions. The body stays at rest.",
      toComplete:
        "Which quantity is known: the body’s initial energy, its final energy, or their difference?",
      explanation:
        "Only the difference is fixed by the emitted energy. Keeping the speed unchanged does not assign a value to either unknown body energy.",
    },
    explanation:
      "Put a body at rest in front of you and let it give off light: two equal flashes, one to the left and one to the right, at the same moment. Because the flashes are equal and opposite, whatever push one gives the body the other takes away. The body does not recoil. It sits exactly where it sat, at rest, before and after.\n\nEnergy is conserved, so the energy carried off by the flashes came out of the body. But the body has not slowed down, because it was not moving, and it has not moved. Nothing you can see about it has changed. A quantity has left and no visible property has altered to account for it.",
    transferCase: {
      condition: "Why insist on two flashes rather than one?",
      explanation:
        "One flash would push the body the other way, and then some of the bookkeeping would be about the recoil rather than about the body itself. The symmetric pair is a device for keeping the speed fixed so that only one unknown is left. It is a choice made to isolate a question, not a fact about how bodies emit light.",
      whatChanges:
        "With one flash, or unequal flashes, the body recoils and its change of motion must enter the account.",
      whatStaysValid:
        "Energy conservation still applies when the body and the outgoing light are counted together.",
    },
  },
  meanings: {
    logicalRole: "assumption",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "idealized-representation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const PREDICTION_STAGE = Object.freeze({
  id: "step-02",
  title: "Make a prediction",
  question: "Is the body lighter, or is that a category error?",
  computeFromShelf:
    "Conservation fixes how much energy leaves, and radiation pressure shows that light exerts a force. Neither statement alone identifies the emitting body’s mass change. Thomson’s charged-sphere example concerns the inertia of a particular electromagnetic field, so it does not yet establish a rule for every form of energy.",
  premiseRefs: [
    {
      cardId: "helmholtz-1847-conservation-of-energy",
    },
    {
      cardId: "maxwell-1873-radiation-pressure",
    },
    {
      cardId: "thomson-1881-electromagnetic-mass",
    },
  ],
  reasoning: [
    {
      foundationId: "work-energy",
      kind: "distinction",
      label: "Distinguish an energy transfer from a claim about inertia.",
    },
  ],
  prerequisites: ["work-energy"],
  support: {
    workedExample: {
      prompt: "Can the unchanged position of the body settle whether its mass changed?",
      steps: [
        "The symmetric emission leaves its velocity unchanged.",
        "That observation is compatible with more than one claim about its inertia.",
        "A relation between the energy of motion and the same speed before and after is still needed.",
      ],
      result: "A body remaining at rest does not, by itself, decide whether its mass changed.",
    },
    partialComparison: {
      given: "The body loses energy and does not recoil.",
      toComplete: "Does either fact yet give the amount of mass lost?",
      explanation:
        "No. The later comparison of two frames, the unchanged-offset premise, and the slow-speed coefficient supply the missing argument.",
    },
    prediction: {
      prompt: "After the flashes leave, what do you expect to happen to the body’s inertia?",
      choices: ["It stays the same.", "It decreases.", "The energy account alone does not decide."],
      explanation:
        "The shelf’s energy account alone does not decide. Keep the prediction in mind while following the additional premises; the later result is conditional on them.",
    },
    explanation:
      "Before going on, commit to an answer. After the flashes have left, is the body’s mass the same as before, smaller, or is the question malformed because mass is not the sort of thing energy can be taken out of? There is a respectable case for each in 1904, and the argument below only decides between them under premises you will be able to see.",
    transferCase: {
      condition: "The case for “the question is malformed”",
      explanation:
        "Mass in 1904 is the measure of how hard a body is to accelerate, fixed by the body and not by its history. Energy is a quantity of account that bodies exchange. On that reading, asking whether emitting light changes the mass is like asking whether paying a bill changes your height. There is a serious case for it, and nothing in the argument that follows refutes it directly. What the argument does is produce a number where that position predicts none.",
      whatChanges:
        "Assuming that inertia is fixed would rule out a mass change before comparing the two energy accounts.",
      whatStaysValid:
        "The emitted energy and the absence of recoil remain the same facts whichever prediction you make.",
    },
  },
  meanings: {
    logicalRole: "qualification",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "idealized-representation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const TWO_LEDGERS_STAGE = Object.freeze({
  id: "step-03",
  title: "Describe the same event twice",
  question: "Two accounts of one emission",
  computeFromShelf:
    "Apply conservation separately in each inertial frame. The explicitly imported 1905 light-energy transformation gives the moving account its light total; it is not a result of the 1904 shelf. No formula for the body’s absolute energy is assumed.",
  premiseRefs: [
    {
      cardId: "helmholtz-1847-conservation-of-energy",
    },
    {
      cardId: "einstein-1905-light-complex-transformation",
      importId: "einstein-1905-light-complex-transformation",
    },
  ],
  instrument: {
    instrumentId: "me-01",
  },
  reasoning: [
    {
      foundationId: "frames-events",
      kind: "change-of-description",
      label: "Describe the same emission in two inertial frames.",
    },
    {
      foundationId: "conservation-symmetry",
      kind: "energy-balance",
      label: "Balance each frame’s account separately.",
    },
  ],
  prerequisites: ["frames-events", "conservation-symmetry"],
  support: {
    workedExample: {
      prompt:
        "Use the printed argument’s model with ten joules emitted in the rest frame and an observer speed of 0.6 times the speed of light.",
      steps: [
        "The imported transformation gives a factor of 1.25 for the sum of the two opposite pulses.",
        "The rest account loses ten joules; the moving account loses 12.5 joules.",
        "Balance each account against its own departing light. Do not set the two frame totals equal.",
      ],
      result:
        "Both accounts conserve energy, although they assign different energies to the same emission.",
    },
    partialComparison: {
      given: "The rest account loses ten joules and the moving account loses 12.5 joules.",
      toComplete: "Does the difference mean that one account failed to conserve energy?",
      explanation:
        "No. Conservation compares before with after in one frame. It does not require two frames to assign the same energy.",
    },
    explanation:
      "Describe the same emission a second time, from a frame gliding steadily past at speed v. Nothing about the body changes; you have changed only where you are standing. Write down the body’s energy before and after in each account, four quantities in all.\n\nYou cannot evaluate any of the four, because each contains the body’s absolute energy content, which no one knows, in 1904 or now. That is why the second account earns its place: the quantity you cannot supply appears in both accounts, so a subtraction removes it.\n\nThe two accounts do not agree about the light, though. A given pair of flashes is measured to carry different total energy depending on the frame it is measured in, and by how much is fixed by the speed and the direction. That is the imported step. It comes from section 8 of the relativity paper, received in June of the same year, and it is the one thing in this route that a reader standing at the end of 1904 could not reach for. It is on the shelf below, marked as an import, with where it came from.",
    transferCase: {
      condition: "Why the import is declared rather than absorbed",
      explanation:
        "A reconstruction that quietly used a 1905 result while claiming to start from 1904 would be telling you the argument is cheaper than it is. The September paper openly rests on the June one. Naming the debt is the difference between a route and a conjuring trick.",
      whatChanges:
        "If the 1905 import is withheld, the moving-frame light total is not supplied by this route.",
      whatStaysValid:
        "Conservation still requires each observer’s account to balance, without determining how the two light totals are related.",
    },
  },
  meanings: {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const SUBTRACTION_STAGE = Object.freeze({
  id: "step-04",
  title: "Subtract",
  question: "What survives when the unknowns cancel",
  computeFromShelf:
    "Subtract the two energy balances obtained in step 3. This algebra needs no absolute body energy. Reading the remaining difference as a loss of kinetic energy needs the additional, unchanged-offset premise; conservation and the imported transformation do not establish that premise for you.",
  premiseRefs: [
    {
      cardId: "helmholtz-1847-conservation-of-energy",
    },
    {
      cardId: "einstein-1905-light-complex-transformation",
      importId: "einstein-1905-light-complex-transformation",
    },
  ],
  instrument: {
    instrumentId: "me-01",
  },
  reasoning: [
    {
      foundationId: "bridge-equals-sign-relationship",
      kind: "subtraction",
      label: "Subtract one balanced relation from another.",
    },
    {
      foundationId: "work-energy",
      kind: "assumption",
      label: "State the unchanged offset before identifying the energy of motion.",
    },
  ],
  prerequisites: ["bridge-equals-sign-relationship", "work-energy"],
  support: {
    workedExample: {
      prompt:
        "Continue the worked example: the moving account loses 12.5 joules and the rest account loses ten joules.",
      steps: [
        "Subtract the two losses: 12.5 minus ten leaves 2.5 joules.",
        "In each account difference, separate kinetic energy from the offset between energy conventions.",
        "If the offset is unchanged by emission, its before-and-after contributions cancel.",
      ],
      result:
        "Under the unchanged-offset premise, the body’s kinetic energy decreases by 2.5 joules at the same speed.",
    },
    partialComparison: {
      given:
        "The difference between the two losses is 2.5 joules, but the offset may change during emission.",
      toComplete: "Can you still identify the entire 2.5 joules as a kinetic-energy decrease?",
      explanation:
        "No. The subtraction remains correct, but it now constrains the kinetic-energy change together with an unknown offset change.",
    },
    explanation:
      "Take the difference between the two accounts before the emission, take it again after, and subtract one from the other. Every absolute body energy disappears, because each appears once in each account. What is left on one side is a difference of differences, and on the other side the light energy multiplied by a factor that depends only on the speed.\n\nThe quantity that survives is the difference between what the moving observer and the resting observer say the body’s energy is, and how that difference changed when the light left. For a body whose speed never changed, that is its energy of motion, plus whatever fixed offset separates the two accounts.",
    transferCase: {
      condition: "The premise hiding in “whatever fixed offset”",
      explanation:
        "Identifying the surviving quantity as a change in energy of motion requires that the offset is the same before and after. Nothing so far forces that. If the offset shifted when the light left, the subtraction still holds but it no longer isolates the energy of motion, and the route stops here with a constraint rather than a result. This is the premise worth arguing about, and the workbench below lets you remove it and see what survives.",
      whatChanges:
        "Allowing the offset to change leaves the kinetic-energy decrease undetermined by these accounts alone.",
      whatStaysValid: "The two energy balances and their algebraic difference remain valid.",
    },
  },
  meanings: {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const COEFFICIENT_STAGE = Object.freeze({
  id: "step-05",
  title: "Read the coefficient",
  question: "A number where a category error predicted none",
  computeFromShelf:
    "Use the low-speed form of the kinetic energy from Thomson and Tait with the loss established in step 4. Comparing the coefficients of the squared speed identifies a mass decrease. This comparison retains the 1905 import and the unchanged-offset premise; it does not use a rest-energy formula as a starting point.",
  premiseRefs: [
    {
      cardId: "thomson-tait-1867-kinetic-energy",
    },
    {
      cardId: "einstein-1905-light-complex-transformation",
      importId: "einstein-1905-light-complex-transformation",
    },
  ],
  instrument: {
    instrumentId: "me-02",
  },
  reasoning: [
    {
      foundationId: "taylor-expansion",
      kind: "limit",
      label: "Keep the quadratic term and distinguish its limit from a finite-speed estimate.",
    },
    {
      foundationId: "work-energy",
      kind: "coefficient-comparison",
      label: "Read the mass difference from the coefficient of one half the speed squared.",
    },
  ],
  prerequisites: ["taylor-expansion", "work-energy"],
  support: {
    workedExample: {
      prompt:
        "The low-speed energy decrease is one half times L/V² times the speed squared. What mass difference would give the same coefficient?",
      steps: [
        "For unchanged speed, subtract the final Newtonian kinetic energy from the initial one. Its quadratic coefficient is one half the mass difference.",
        "Compare this with the coefficient supplied by the two accounts: one half times L/V².",
        "The coefficients match when the mass before minus the mass after equals L/V².",
      ],
      result:
        "Positive emitted energy gives a positive mass lost. The calculation determines a difference, not either absolute body energy.",
    },
    partialComparison: {
      given: "At exactly zero relative speed both kinetic-energy changes are zero.",
      toComplete: "Does dividing those zero values identify the mass decrease?",
      explanation:
        "No. The identification uses the coefficient approached as the speed tends to zero, not a quotient evaluated at zero.",
    },
    explanation:
      "Let the second observer glide past slowly and the speed factor simplifies. The paper prints the result on its last page, in the notation it was set in, where L is the energy given off and V is the speed of light:\n\nNow put that beside the energy of motion you already had on the shelf, one half of the mass times the speed squared. The two expressions have the same shape, and in the place where a mass belongs stands the energy given off divided by the square of the speed of light. The body behaves, for every purpose that mass is measured by, as though it lost that much of it.",
    transferCase: {
      condition: "Why the slow-speed limit and not the exact factor",
      explanation:
        "At a finite speed you get a coefficient that depends on the speed, which is a proxy and not an identification: you would be reading a mass off a quantity that still remembers how fast you happened to be gliding. The identification is made in the limit as the speed goes to zero, which is where the comparison with one half m v squared is exact. Running the instrument at zero speed instead gives zero on both sides and settles nothing, which is a different thing from taking the limit.",
      whatChanges:
        "At finite speed the quadratic approximation is not exact, and the apparent mass-loss proxy still depends on the speed.",
      whatStaysValid:
        "The exact two-account energy difference remains valid within the admitted model. Its low-speed coefficient supplies the mass identification.",
    },
  },
  meanings: {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "approximation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const MASS_ENERGY_STAGES: readonly Stage[] = Object.freeze([
  SYMMETRIC_EMISSION_STAGE,
  PREDICTION_STAGE,
  TWO_LEDGERS_STAGE,
  SUBTRACTION_STAGE,
  COEFFICIENT_STAGE,
]);
