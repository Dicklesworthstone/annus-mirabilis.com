/**
 * Light quanta's seven argument stages, recorded from the discovery page's existing chain (am-4k0m).
 *
 * The explanation text below is the route's existing narrative. The premise lists and worked
 * comparisons make the same chain available to the journey compiler, shelf audit and local search.
 * They preserve the page's central qualification: the quantum conclusion is heuristic, and all
 * pre-1905 premises come from the declared 1904 shelf.
 */
import type { Stage } from "../../content/schemas/journey.ts";

export const WAVE_SUCCESS_STAGE = Object.freeze({
  id: "step-01",
  title: "Start with what works",
  question: "The wave theory is not the problem",
  computeFromShelf:
    "Fresnel's diffraction and Maxwell's electromagnetic theory are positive premises: continuous waves explain interference, diffraction and polarization. This stage narrows the later question to emission and absorption rather than treating those successes as failures.",
  premiseRefs: [
    { cardId: "fresnel-1826-diffraction" },
    { cardId: "maxwell-1873-electromagnetic-light" },
  ],
  instrument: { instrumentId: "lq-01" },
  reasoning: [
    { foundationId: "fields-waves", kind: "scope", label: "Keep the wave account where its measurements support it." },
    { foundationId: "functions-graphs", kind: "comparison", label: "Separate a successful model's tested outputs from questions it never measured." },
  ],
  prerequisites: ["fields-waves", "functions-graphs"],
  support: {
    workedExample: {
      prompt: "If a wave model correctly predicts the positions of bright and dark interference bands, does a later problem in photoelectric emission erase that success?",
      steps: [
        "The interference prediction concerns propagation and superposition before detection.",
        "The emission problem concerns how energy is transferred in an elementary interaction.",
        "A failure in the second claim does not reverse a successful measurement of the first.",
      ],
      result: "The route keeps the successful wave predictions and asks a narrower question.",
    },
    partialComparison: {
      given: "Two theories predict the same interference pattern but differ about one act of absorption.",
      toComplete: "Which observation can distinguish them?",
      explanation:
        "The interference pattern cannot distinguish claims that agree about it. A measurement of the absorption event, or a consequence that depends on it, is needed.",
    },
    explanation:
      "Send light through two slits and the bright and dark bands land where the wave account says they will. Diffraction, interference, polarisation, the whole of optics: the wave description predicts them quantitatively and measurement agrees. Nothing in this route takes any of that away, and any replacement that cannot reproduce it is not a candidate.\n\nThe ending is often told as though waves were overthrown. They were not. What follows narrows to a region the optical evidence never covered.",
  },
  meanings: {
    logicalRole: "qualification",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "idealized-representation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const OPTICAL_AVERAGES_STAGE = Object.freeze({
  id: "step-02",
  title: "Find the edge of the evidence",
  question: "Optics measures averages",
  computeFromShelf:
    "The established wave results concern macroscopic optical observables. Lenard's photoelectric result lies at the boundary this route wants to probe: greater intensity changes the number of emitted electrons without increasing their greatest energy.",
  premiseRefs: [
    { cardId: "maxwell-1873-electromagnetic-light" },
    { cardId: "lenard-1902-photoelectric" },
  ],
  reasoning: [
    { foundationId: "mean-variance-rms", kind: "observable-scope", label: "Do not identify an averaged observable with one elementary event." },
    { foundationId: "error-and-inference", kind: "evidence-scope", label: "Ask what a measurement can actually discriminate." },
  ],
  prerequisites: ["mean-variance-rms", "error-and-inference"],
  support: {
    workedExample: {
      prompt: "A detector reports the same time-averaged fringe intensity in two models. One model says energy arrives continuously and the other in independent transfers. What has the detector decided?",
      steps: [
        "The reported quantity is an average over many optical cycles and many interactions.",
        "Both models were stipulated to give the same average.",
        "The observation therefore does not decide the microscopic transfer rule.",
      ],
      result: "Agreement on an average does not settle how a single transfer occurs.",
    },
    partialComparison: {
      given: "At one frequency, doubling the light intensity doubles the number of emitted electrons.",
      toComplete: "What extra observation makes Lenard's result uncomfortable for a simple continuous-transfer picture?",
      explanation:
        "The greatest electron energy does not increase with the intensity. More total energy arrives, but the most energetic individual electron does not receive a larger share.",
    },
    prediction: {
      prompt: "At fixed frequency, what did Lenard's result say changed with brighter light?",
      choices: ["The number of emitted electrons.", "The greatest electron energy.", "Both in the same proportion."],
      explanation:
        "The number increased while the greatest energy remained essentially unchanged, which is why this observation belongs at the edge of the wave evidence rather than inside the interference tests.",
    },
    explanation:
      "The gap is easy to miss, because it is a statement about instruments rather than about light. Every optical measurement confirming the wave theory is an average over an enormous number of cycles. A fringe pattern is a time-averaged intensity. Nothing in that evidence says what happens in a single act of emission or absorption, because no optical measurement of the period resolved one.\n\nSo there is a region where the wave theory is untested rather than confirmed: the moment light is produced, and the moment a body takes it up. And there is already an observation sitting in that region that does not sit comfortably. Make ultraviolet light brighter and more electrons come out of a metal, but they do not come out faster. Brightness buys you more of them, not more energetic ones.",
  },
  meanings: {
    logicalRole: "qualification",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "idealized-representation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const CLASSICAL_ALLOCATION_STAGE = Object.freeze({
  id: "step-03",
  title: "Make a prediction",
  question: "Give every vibration its fair share. What is the total?",
  computeFromShelf:
    "The equal-share premise assigns the same mean thermal energy scale to each resonator mode. Rayleigh's counting supplies ever more modes at higher frequency. Extending both without a cutoff makes the integrated classical energy fail to approach a finite total.",
  premiseRefs: [
    { cardId: "equipartition-mean-resonator-energy" },
    { cardId: "rayleigh-1900-radiation-law" },
  ],
  instrument: { instrumentId: "lq-02" },
  reasoning: [
    { foundationId: "temperature-thermal-energy", kind: "thermal-allocation", label: "Relate temperature to the mean energy assigned to a degree of freedom." },
    { foundationId: "integration", kind: "sum-over-modes", label: "Add the energy over an expanding frequency range." },
  ],
  prerequisites: ["temperature-thermal-energy", "integration"],
  support: {
    workedExample: {
      prompt: "Suppose widening the frequency cutoff by a factor of ten makes the classical total grow by a factor of one thousand. What happens as the cutoff keeps increasing?",
      steps: [
        "Each tenfold widening multiplies the total by another factor of one thousand.",
        "The added high-frequency contribution does not shrink toward zero.",
        "No finite limiting total is approached.",
      ],
      result: "The unbounded classical allocation has no finite total energy.",
    },
    partialComparison: {
      given: "A finite cutoff always gives a finite number.",
      toComplete: "Does that make the total over all frequencies finite?",
      explanation:
        "No. A finite window only postpones the divergence. The question is what happens as the upper limit is removed.",
    },
    prediction: {
      prompt: "If the equal-share rule is extended to arbitrarily high frequency, does the total settle?",
      choices: ["Yes.", "No; it grows without bound.", "Only the lowest frequencies matter."],
      explanation:
        "The classical mode count keeps growing, so extending the same allocation without limit produces no finite total.",
    },
    explanation:
      "Before going further, commit to an answer. Thermal equilibrium hands every vibrating degree of freedom the same average energy, fixed by the temperature. A box of radiation has vibrations at every frequency. Add up the energy that rule assigns across all of them. Is the total a modest amount, an enormous but definite amount, or no definite amount at all?",
    transferCase: {
      condition: "What if you keep a finite frequency cutoff?",
      explanation:
        "Then the integral is finite, but the answer depends on the arbitrary cutoff and grows rapidly when the cutoff is raised.",
      whatChanges: "The numerical total becomes finite for that chosen window.",
      whatStaysValid: "Removing the upper limit still exposes the divergence of the same classical rule.",
    },
  },
  meanings: {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const WIEN_ENTROPY_STAGE = Object.freeze({
  id: "step-04",
  title: "Work where a law is solid",
  question: "Pick the regime you can trust, then take its entropy",
  computeFromShelf:
    "Wien's measured high-frequency law supplies the admitted radiation regime. Boltzmann's entropy-probability relation supplies the counting language. The comparison is explicitly restricted to low-density monochromatic radiation where the Wien approximation is good.",
  premiseRefs: [
    { cardId: "wien-1896-radiation-law" },
    { cardId: "boltzmann-1877-entropy-probability" },
  ],
  instrument: { instrumentId: "lq-04" },
  reasoning: [
    { foundationId: "entropy-temperature", kind: "thermodynamic-derivation", label: "Use the entropy-temperature relation in the admitted Wien regime." },
    { foundationId: "logarithms", kind: "volume-dependence", label: "Read the entropy change through the logarithm of the volume ratio." },
  ],
  prerequisites: ["entropy-temperature", "logarithms"],
  support: {
    workedExample: {
      prompt: "At fixed energy and frequency band, compare a radiation state in volume V0 with one in half that volume, while both states stay in the Wien regime.",
      steps: [
        "The volume ratio is one half, so its logarithm is negative.",
        "The entropy change is the positive coefficient E/(beta*nu) times that negative logarithm.",
        "The entropy therefore decreases when the same admitted radiation is confined to the smaller volume.",
      ],
      result: "Within the Wien regime, the volume dependence is logarithmic at fixed energy and band.",
    },
    partialComparison: {
      given: "The same energy and band are instead allowed to occupy twice the volume.",
      toComplete: "What changes sign?",
      explanation:
        "The logarithm of the volume ratio becomes positive, so the entropy change becomes positive while the coefficient is unchanged.",
    },
    prediction: {
      prompt: "If the volume is doubled at fixed energy and band, what happens to the Wien-regime entropy change?",
      choices: ["It is positive.", "It is zero.", "It is negative."],
      explanation:
        "The coefficient stays positive and ln(2) is positive. This statement is only admitted while both compared states remain inside the Wien regime.",
    },
    explanation:
      "Rather than argue about the whole spectrum, retreat to ground that holds. Wien’s law describes the measured distribution well when the frequency is high and the temperature low, and in 1904 that is not in dispute. Work only there.\n\nIn that regime you can write down the entropy of a quantity of monochromatic radiation, and then ask a single question about it: if you keep the energy and the frequency band fixed and let the radiation occupy a different volume, how does the entropy change? That is a question about counting, not about mechanism, and it can be answered.",
    transferCase: {
      condition: "What if the compared state leaves the Wien regime?",
      explanation:
        "Then the approximation used to derive this entropy law is no longer admitted, so the route must stop rather than extend the formula as though nothing changed.",
      whatChanges: "The Wien approximation ceases to be an accepted premise for that state.",
      whatStaysValid: "The need to declare the regime and the fixed-energy, fixed-band comparison remains.",
    },
  },
  meanings: {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "approximation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const GAS_COUNT_STAGE = Object.freeze({
  id: "step-05",
  title: "Do the same sum for something you understand",
  question: "How a gas of independent things behaves",
  computeFromShelf:
    "Boltzmann's probability relation and the gas volume-entropy result count independently placeable particles. Independence is the premise that turns a one-particle volume fraction into a probability raised to the particle count.",
  premiseRefs: [
    { cardId: "boltzmann-1877-entropy-probability" },
    { cardId: "boltzmann-1896-gas-volume-entropy" },
  ],
  instrument: { instrumentId: "lq-05" },
  reasoning: [
    { foundationId: "probability-independence", kind: "independence", label: "Multiply probabilities for independently placeable points." },
    { foundationId: "entropy-multiplicity", kind: "counting", label: "Turn the configuration probability into an entropy difference." },
  ],
  prerequisites: ["probability-independence", "entropy-multiplicity"],
  support: {
    workedExample: {
      prompt: "Ten independent points move uniformly in a box. What is the chance that all ten lie in the left half at once?",
      steps: [
        "Each point is in the left half with probability one half.",
        "Independence multiplies the ten probabilities.",
        "The result is (1/2)^10 = 1/1024.",
      ],
      result: "The exponent counts independent positions, not merely labelled points.",
    },
    partialComparison: {
      given: "Lock the ten points rigidly together so they move as one pattern.",
      toComplete: "Does the same tenth power still apply?",
      explanation:
        "No. The locked pattern has one independently chosen position, so the chance is the single volume fraction rather than its tenth power.",
    },
    prediction: {
      prompt: "What happens to the exponent when ten points are locked together?",
      choices: ["It stays ten.", "It becomes one.", "It becomes zero."],
      explanation:
        "The exponent tracks independent placement choices. Locking the points removes nine of those independent choices.",
    },
    explanation:
      "Now put the radiation aside and take a container of gas with a definite number of particles that do not interact. Ask exactly the same question: keep everything else fixed, let it occupy a different volume, and see how the entropy changes. The answer comes from counting how many ways the particles can be arranged, and it depends on the volume logarithmically, with the number of particles as a multiplier out front.\n\nYou now have two answers to one question, derived independently: one for radiation in a regime where a measured law holds, one for a gas of a known number of independent things.",
    transferCase: {
      condition: "What if the particles are correlated rather than independent?",
      explanation:
        "Then the simple product of one-particle probabilities is not justified, so the exponent cannot be read as the number of labelled particles without a correlation model.",
      whatChanges: "The configuration probability is no longer f raised to the particle count.",
      whatStaysValid: "Entropy still depends on the multiplicity of admitted configurations; the counting rule must match the dependencies.",
    },
  },
  meanings: {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const ENTROPY_CORRESPONDENCE_STAGE = Object.freeze({
  id: "step-06",
  title: "Compare the two, and read the exponent",
  question: "What plays the part of the number of molecules?",
  computeFromShelf:
    "The Wien-regime radiation entropy and Boltzmann gas entropy have the same logarithmic volume dependence. Matching their coefficients is the paper's heuristic move: in this respect the radiation behaves as if its total energy were divided among independent pieces of size R*beta*nu/N.",
  premiseRefs: [
    { cardId: "wien-1896-radiation-law" },
    { cardId: "boltzmann-1896-gas-volume-entropy" },
    { cardId: "planck-1901-energy-elements", parallelWorkAcknowledged: true },
  ],
  instrument: { instrumentId: "lq-06" },
  reasoning: [
    { foundationId: "entropy-multiplicity", kind: "coefficient-match", label: "Compare the multipliers of the same logarithmic volume term." },
    { foundationId: "ratios-scaling", kind: "dimensional-match", label: "Restore R/N so the radiation coefficient becomes a pure count." },
  ],
  prerequisites: ["entropy-multiplicity", "ratios-scaling"],
  support: {
    workedExample: {
      prompt: "The gas law has (R/N)*n*ln(f), while the radiation law has (E/(beta*nu))*ln(f). What expression plays the role of n?",
      steps: [
        "Match the coefficients multiplying the same ln(f).",
        "Set (R/N)*n equal to E/(beta*nu).",
        "Solve for n = (N/R)*E/(beta*nu).",
      ],
      result: "The matching coefficient behaves like an effective independent count in this thermodynamic comparison.",
    },
    partialComparison: {
      given: "Double the radiation energy while frequency and the volume ratio stay fixed.",
      toComplete: "What happens to the effective count?",
      explanation:
        "It doubles. The inferred count is proportional to E at fixed frequency, so the implied energy per independent piece stays fixed by the frequency.",
    },
    prediction: {
      prompt: "What is fixed by frequency in this heuristic comparison?",
      choices: ["The energy per effective independent piece.", "The total energy.", "The volume."],
      explanation:
        "The piece size is R*beta*nu/N, proportional to frequency. Total energy determines how many such effective pieces the comparison assigns.",
    },
    explanation:
      "The two expressions have the same shape. Set them beside each other and the multiplier that counts particles in the gas is matched, in the radiation case, by the total energy divided by a quantity built from the frequency. The paper states the conclusion in the careful form its title promises: radiation of low density behaves, as far as this thermodynamic question goes, as if it consisted of mutually independent energy quanta each of size Rβν/N.\n\nOne quantity has been shown to behave, in one regime, in one respect, like a count. That is a resemblance in a formula, and a resemblance is not a mechanism. The paper goes on to ask whether emission and transformation also look as though light were made this way.",
    transferCase: {
      condition: "What if the radiation is outside the low-density Wien regime?",
      explanation:
        "The coefficient match was derived from the Wien-law entropy. Outside that regime this route has not established the same volume law, so it cannot carry the effective-count inference across unchanged.",
      whatChanges: "The radiation entropy premise changes.",
      whatStaysValid: "The inference remains explicitly heuristic even where its premises are admitted.",
    },
  },
  meanings: {
    logicalRole: "heuristic-inference",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "approximation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const CONSEQUENCES_STAGE = Object.freeze({
  id: "step-07",
  title: "Demand consequences",
  question: "Three predictions it did not have to get right",
  computeFromShelf:
    "Stokes's fluorescence rule and Lenard's intensity result are independent checks already available on the 1904 shelf. The paper's single-quantum energy bookkeeping also yields photoelectric and ionization consequences, while their rates remain separate empirical questions.",
  premiseRefs: [
    { cardId: "stokes-1852-refrangibility" },
    { cardId: "lenard-1902-photoelectric" },
    { cardId: "hertz-1887-ultraviolet-spark" },
    { cardId: "thomson-1899-photoelectric-carrier" },
  ],
  instrument: { instrumentId: "lq-08" },
  reasoning: [
    { foundationId: "work-energy", kind: "energy-budget", label: "Apply one-quantum energy conservation to one elementary transfer." },
    { foundationId: "functions-graphs", kind: "prediction", label: "Separate a frequency-dependent energy prediction from an intensity-dependent event rate." },
  ],
  prerequisites: ["work-energy", "functions-graphs"],
  support: {
    workedExample: {
      prompt: "At fixed frequency above threshold, double the incident optical power in the single-quantum picture. What changes first?",
      steps: [
        "Each quantum still carries the same energy because the frequency did not change.",
        "Twice the power means twice as many quanta arrive per unit time.",
        "The emission rate can rise while the greatest energy of any one emitted electron stays fixed.",
      ],
      result: "Intensity controls how many opportunities occur; frequency controls the energy available in each one.",
    },
    partialComparison: {
      given: "Now raise the frequency at fixed optical power.",
      toComplete: "Do more or fewer quanta arrive each second?",
      explanation:
        "Fewer. Each quantum carries more energy, so a fixed power is divided among a smaller number of quanta per second.",
    },
    prediction: {
      prompt: "Can a single absorbed quantum produce fluorescent light of higher frequency without another energy source?",
      choices: ["No.", "Yes, if the incoming beam is brighter.", "Yes, automatically."],
      explanation:
        "With one absorbed quantum supplying the elementary event, conservation bounds the emitted quantum's energy by the absorbed one. A brighter beam changes the event rate, not that per-event budget.",
    },
    explanation:
      "A resemblance found in one thermodynamic calculation earns nothing until it says something about a different experiment. Take the picture seriously for a moment and three consequences follow, each testable against work already done by 1904.\n\nLight re-emitted by a fluorescing substance should not have a higher frequency than the light that excited it. The energy of electrons driven out of a metal should not depend on brightness at fixed frequency, while the number does. And ultraviolet light should only ionise a gas when its frequency is high enough. These are consistency checks, not proof, and a threshold alone does not determine a yield.",
    transferCase: {
      condition: "What if one elementary event can absorb two quanta at once?",
      explanation:
        "Then the one-quantum energy ceiling no longer applies to that event: two incoming quanta can supply more energy than either one separately.",
      whatChanges: "The per-event energy budget has a different input count and can support multi-quantum outcomes.",
      whatStaysValid: "Energy conservation still constrains the total energy entering and leaving the elementary event.",
    },
  },
  meanings: {
    logicalRole: "prediction",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "idealized-representation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const LIGHT_QUANTA_STAGES = Object.freeze([
  WAVE_SUCCESS_STAGE,
  OPTICAL_AVERAGES_STAGE,
  CLASSICAL_ALLOCATION_STAGE,
  WIEN_ENTROPY_STAGE,
  GAS_COUNT_STAGE,
  ENTROPY_CORRESPONDENCE_STAGE,
  CONSEQUENCES_STAGE,
]) satisfies readonly Stage[];
