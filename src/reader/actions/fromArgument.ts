/**
 * Maps a preview argument's already-authored help and experiments onto
 * PassageActions. Obstacle copy is attached only when supplied; missing
 * kinds stay unavailable rather than being filled in here.
 */
import type { Argument } from "../../content/schemas/reading.ts";
import type { ObstacleResponses } from "./passageActions.schema.ts";
import { type PassageActions, validatePassageActions } from "./passageActions.schema.ts";

/** Authored obstacle answers for the Brownian observable argument, one for each of the six kinds. */
const RETURN = "Return to zero average is not no movement.";
const ARG_BM_OBSERVABLE_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "Two averages carry this passage. ⟨x⟩ is the average of the displacements themselves, each with its sign: plus for a tracer that ended to the right of where it started, minus for one that ended to the left. ⟨x²⟩ is the average of their squares, and a square is never negative.",
    foundationLinks: [
      {
        foundationId: "bridge-negative-numbers-direction",
        callingAnchor: "arg-bm-observable",
        returnCaption: RETURN,
      },
    ],
  },
  physicalReason: {
    explanation:
      "Nothing in the liquid prefers left to right. Molecules strike each tracer from every side, so in the model a step to the right is exactly as likely as the same step to the left, and over the whole ensemble the signed steps balance. The strikes never stop, so every tracer keeps moving; only the average of the signed displacements stays at the start.",
    foundationLinks: [
      { foundationId: "random-walks", callingAnchor: "arg-bm-observable", returnCaption: RETURN },
    ],
  },
  connectionToPicture: {
    explanation:
      "Watch the cloud of tracers rather than any one of them. Its centre stays on the starting line: that centre is ⟨x⟩, and it stays at zero. Its edges move outward: how wide the cloud is, measured as √⟨x²⟩, is the quantity that grows.",
    foundationLinks: [
      { foundationId: "distributions", callingAnchor: "arg-bm-observable", returnCaption: RETURN },
    ],
  },
  tooMuchAtOnce: {
    explanation:
      "One example, four numbers. Four tracers end at −3, −1, +1 and +3. Their signed average is 0. Square them to get 9, 1, 1 and 9; the average of those is 5, and its square root, about 2.24, is how far a typical tracer has gone. That is the whole passage.",
    foundationLinks: [
      {
        foundationId: "bridge-sum-average",
        callingAnchor: "arg-bm-observable",
        returnCaption: RETURN,
      },
    ],
  },
  algebraicMove: {
    explanation:
      "Squaring before averaging is the move that keeps movement when signs cancel. The signed mean of −3, −1, +1, +3 is zero; the mean of those squares is not.",
    foundationLinks: [
      {
        foundationId: "bridge-squaring-square-roots",
        callingAnchor: "arg-bm-observable",
        returnCaption: RETURN,
      },
    ],
  },
  purposeOfCalculation: {
    explanation:
      "The calculation answers how far members of the ensemble have wandered, not where their centre has moved. That is why a zero signed mean is not a claim that nothing moved.",
    foundationLinks: [
      {
        foundationId: "mean-variance-rms",
        callingAnchor: "arg-bm-observable",
        returnCaption: RETURN,
      },
    ],
  },
};

/**
 * Light quanta's counting passage: why the probability is f to the power n. Every number and claim
 * here is the passage's own (arg-lq-independent-configurations): four independent points in half
 * the volume give 1/16, four locked together give 1/2, and section 6 reads the result "as if" for
 * dilute radiation, which its entrance also says is not a general proof about light.
 */
const RETURN_LQ = "Return to independence supplies the exponent.";
const ARG_LQ_INDEPENDENT_CONFIGURATIONS_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "f is a fraction of the volume: the chosen part divided by the whole, one half when the part is half of it. n is the number of points. W is a probability, the chance that at one moment all n points are inside the chosen part, and ln is the natural logarithm.",
    foundationLinks: [
      // One lesson per answer: ObstacleMenu names each link by its obstacle, so two links in
      // one answer would share a name and lead to different lessons.
      {
        foundationId: "bridge-probability-notation",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  physicalReason: {
    explanation:
      "In the model each point moves over the whole volume without regard to the others, as the molecules of a dilute gas do. So the chance that any one point is in the chosen part is f, whatever the other points are doing. That independence is a premise of the model; the counting does not prove it.",
    foundationLinks: [
      {
        foundationId: "probability-independence",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  connectionToPicture: {
    explanation:
      "Split the volume into the chosen part and the rest, and take one snapshot. One point is in the part a fraction f of the time. For two, the part must catch the first and also the second: f of the time, and then f of those times, which is f × f. Each further point multiplies by f again.",
    foundationLinks: [
      {
        foundationId: "probability-independence",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  tooMuchAtOnce: {
    explanation:
      "One example: four points, half the volume. One point is in the left half with chance 1/2. Two are, with chance 1/2 × 1/2 = 1/4. All four are, with chance 1/16. If the four were locked together and moved as one, the chance would stay 1/2. That difference is the whole passage.",
    foundationLinks: [
      {
        foundationId: "bridge-fractions-ratios",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  algebraicMove: {
    explanation:
      "Multiplying n equal factors f is written fⁿ, and the logarithm turns that power into a product: ln fⁿ = n ln f. So k_B ln W becomes n k_B ln f, the number of points times the change for one. Because f is less than 1, ln f is negative, and so is the entropy change for crowding the points into the smaller part.",
    foundationLinks: [
      {
        foundationId: "logarithms",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  purposeOfCalculation: {
    explanation:
      "Section 6 uses the result in reverse. The entropy of dilute monochromatic radiation changes with volume the way n k_B ln f does for n independent points, so in that respect such radiation behaves as if it consisted of n independent energy quanta. The exponent is what carries the comparison, which is why the passage says it comes from independence.",
    foundationLinks: [
      {
        foundationId: "entropy-multiplicity",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
};

/**
 * Relativity's velocity composition: why two ordinary-looking speeds do not simply add. The numbers
 * are the passage's own (arg-sr-velocity-composition): 0.6c and 0.6c give 15c/17, about 0.882c,
 * where plain addition says 1.2c, and light comes out at c in every frame.
 */
const RETURN_SR = "Return to the denominator changes as well.";
const srLink = (foundationId: string) => [
  { foundationId, callingAnchor: "arg-sr-velocity-composition", returnCaption: RETURN_SR },
];
const ARG_SR_VELOCITY_COMPOSITION_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "v is the speed of the moving frame, measured in the original one. w is the object's speed measured in the moving frame, and U is the same object's speed measured in the original frame. c is the speed of light. uₓ and u′ₓ are the object's velocities along x in the two frames.",
    foundationLinks: srLink("bridge-letter-for-quantity"),
  },
  physicalReason: {
    explanation:
      "A speed is a distance divided by the time taken, and the two frames disagree about both. They disagree about the time because each sets its distant clocks by its own light signals. So a speed cannot pass from one frame to the other by adding v; the time between the same two events changes too.",
    foundationLinks: srLink("frames-events"),
  },
  connectionToPicture: {
    explanation:
      "Picture two neighbouring events on the object's path: here at one moment, and a little further along a little later. Each frame measures the distance and the time between those same two events. Both numbers change from frame to frame, and the speed is their ratio.",
    foundationLinks: srLink("frames-events"),
  },
  tooMuchAtOnce: {
    explanation:
      "One example: v = w = 0.6c. Plain addition gives 1.2c. The formula divides that by 1 + 0.6 × 0.6 = 1.36, which gives 15c/17, about 0.882c. The faster the two speeds, the further the divisor rises above 1.",
    foundationLinks: srLink("bridge-fractions-ratios"),
  },
  algebraicMove: {
    explanation:
      "Transform the two small changes first, then divide. With dx′ = γ(dx − v dt) and dt′ = γ(dt − v dx/c²), the ratio dx′/dt′ is (uₓ − v)/(1 − v uₓ/c²). The factors γ cancel, and the second term of dt′ is what puts 1 − v uₓ/c² in the denominator.",
    foundationLinks: srLink("derivatives"),
  },
  purposeOfCalculation: {
    explanation:
      "It finds what the two postulates require of speeds. Put in light, uₓ = c, and the formula returns c in every frame, as the second postulate demands, and two speeds below c combine to a speed below c. At everyday speeds v w/c² is tiny and the formula is ordinary addition.",
    foundationLinks: srLink("orders-of-magnitude"),
  },
};

/**
 * Mass-energy's subtraction: which difference survives when the two accounts are subtracted. The
 * numbers are the paper's example as the two-ledgers passage gives it: the rest account assigns the
 * light 10 units and a traveler at sixty percent of light speed 12.5, so L(γ − 1) = 2.5. The
 * passage's limit is kept: the subtraction is algebra, and naming what survives needs a premise.
 */
const RETURN_ME = "Return to subtract what you cannot measure.";
const meLink = (foundationId: string) => [
  { foundationId, callingAnchor: "arg-me-subtraction", returnCaption: RETURN_ME },
];
const ARG_ME_SUBTRACTION_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "E is the body's energy counted in its own rest frame, and H is the same body's energy as a traveler moving past it counts it. The subscript 0 means before the light leaves, 1 after. L is the light's energy in the rest frame, and γ, 1.25 at sixty percent of light speed, is how much larger the traveler finds it.",
    foundationLinks: meLink("bridge-letter-for-quantity"),
  },
  physicalReason: {
    explanation:
      "Each observer's account balances on its own: the body's energy drops by exactly the energy the light carries away, in that observer's reckoning. The two observers only assign the light different amounts, so the body's drop differs between the accounts. Neither account is wrong.",
    foundationLinks: meLink("conservation-symmetry"),
  },
  connectionToPicture: {
    explanation:
      "Picture two ledgers for one emission. In the rest ledger the body's energy falls by 10 units; in the traveler's by 12.5. Taking one ledger's change from the other's needs only those two losses, not the balances themselves, which nobody can measure.",
    foundationLinks: meLink("work-energy"),
  },
  tooMuchAtOnce: {
    explanation:
      "One example: the light carries 10 units in the rest frame, and the traveler moves at sixty percent of light speed, so γ = 1.25. The rest account loses 10, the traveler's loses 12.5, and the difference is 2.5, which is 10 × (1.25 − 1). Nothing more of the passage is needed yet.",
    foundationLinks: meLink("two-measurements-two-unknowns"),
  },
  algebraicMove: {
    explanation:
      "Two balances, H₀ − H₁ = γL and E₀ − E₁ = L, taken one from the other: H₀ − H₁ − E₀ + E₁ = γL − L. Grouping the left as (H₀ − E₀) − (H₁ − E₁) and taking L out on the right gives L(γ − 1). The unknown energies are never given values, only compared.",
    foundationLinks: meLink("bridge-equals-sign-relationship"),
  },
  purposeOfCalculation: {
    explanation:
      "It isolates the one quantity both accounts agree how to compute, L(γ − 1), without knowing the body's total energy in either frame. The passage stops there on purpose: that this difference is a change in the body's energy of motion is a separate premise, which the next passage states.",
    foundationLinks: meLink("work-energy"),
  },
};

/**
 * Light quanta §3: the two-band variation in the passage explains why the entropy
 * derivatives agree. Thermodynamics identifies their value; it does not supply a
 * microscopic picture of radiation or the integration constant used in §4.
 */
const entropyTemperatureLink = (foundationId: string) => [
  {
    foundationId,
    callingAnchor: "arg-lq-entropy-temperature",
    returnCaption: "Return to the entropy gained per added energy, at fixed volume and frequency.",
  },
];
const ARG_LQ_ENTROPY_TEMPERATURE_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "ρν is energy per unit volume and per unit frequency interval; sν is entropy measured in the same way. The derivative ∂sν/∂ρν asks how much the entropy density changes when a little energy density is added at this fixed frequency and volume. T is absolute temperature, so 1/T has units of inverse kelvins.",
    foundationLinks: entropyTemperatureLink("partial-derivatives"),
  },
  physicalReason: {
    explanation:
      "At equilibrium the radiation has the greatest entropy compatible with its total energy and volume. Imagine moving a tiny amount of energy between two frequency bands. If one band gained more entropy per added energy than the other lost, this transfer would increase the total entropy. That would contradict equilibrium. The slopes must therefore agree; reversible heating identifies their common value as 1/T.",
    foundationLinks: entropyTemperatureLink("entropy-temperature"),
  },
  connectionToPicture: {
    explanation:
      "Picture two frequency bands as two columns in an energy table. Take a tiny energy amount q from the first column and add the same q to the second, keeping the total fixed. Next to each column put its entropy change per added energy. The entropy changes are −q times the first slope and +q times the second. Equal slopes make these first-order changes cancel.",
    foundationLinks: entropyTemperatureLink("functions-graphs"),
  },
  tooMuchAtOnce: {
    explanation:
      "Start with the passage's two-band check. A tiny energy amount q leaves band 1 and enters band 2. At equilibrium, each has entropy slope 1/T: one loses q/T and the other gains q/T, so the total change is zero to first order. This explains the equal slopes. Integrating them to find entropy itself still needs a boundary condition.",
    foundationLinks: entropyTemperatureLink("entropy-temperature"),
  },
  algebraicMove: {
    explanation:
      "Call the two entropy slopes m₁ and m₂. Transferring a small energy q gives ΔS ≈ −m₁q + m₂q = q(m₂ − m₁). The transfer can go either way. Unless m₂ − m₁ is zero, one direction raises entropy, so an equilibrium maximum requires m₁ = m₂. This first-order argument gives a necessary condition for equilibrium, rather than proving that every equal-slope state is a maximum.",
    foundationLinks: entropyTemperatureLink("derivatives"),
  },
  purposeOfCalculation: {
    explanation:
      "A spectrum tells how radiation's energy density depends on temperature. This step makes that information useful for entropy: invert an admitted spectrum to obtain T at a chosen density and frequency, then use 1/T as the entropy derivative. No light particles have been assumed. The next passage integrates that derivative and separately fixes its constant.",
    foundationLinks: entropyTemperatureLink("entropy-temperature"),
  },
};

/** Light quanta §4: keep the dimensionless logarithm, fixed frequency and boundary condition. */
const wienIntegrationLink = (foundationId: string) => [
  {
    foundationId,
    callingAnchor: "arg-lq-wien-integration",
    returnCaption:
      "Return to integrating Wien's entropy derivative and fixing its zero-density constant.",
  },
];
const ARG_LQ_WIEN_INTEGRATION_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "ν is the frequency, held fixed throughout this integration. A and B are the constants in Wien's spectral law; Aν³ has the same units as the spectral energy density ρν. Their ratio ρν/(Aν³) has no units, so its logarithm is defined without choosing a unit system. C(ν) is an unknown entropy-density offset that can depend on frequency, but not on ρν.",
    foundationLinks: wienIntegrationLink("logarithms"),
  },
  physicalReason: {
    explanation:
      "The calculation adopts Wien's law in its admitted regime and the thermodynamic entropy derivative from §3. It also needs the paper's condition that radiation entropy vanishes when radiation density vanishes. Integration alone cannot determine this zero. A positive temperature obtained by inversion does not, by itself, establish that the Wien approximation is accurate for that state.",
    foundationLinks: wienIntegrationLink("entropy-temperature"),
  },
  connectionToPicture: {
    explanation:
      "Draw entropy density against energy density at one frequency. The known derivative fixes the slope of the curve at each density, but moving the whole curve up or down leaves every slope unchanged. C(ν) names that shift. Requiring the curve to approach zero entropy at zero radiation selects one curve. The logarithm diverges there, but the density multiplying it tends to zero faster.",
    foundationLinks: wienIntegrationLink("functions-graphs"),
  },
  tooMuchAtOnce: {
    explanation:
      "Use the passage's dimensionless ratio r = ρν/(Aν³). At r = 0.001, r ln r is about −0.0069; at r = 0.000001, it is about −0.0000138. The product approaches zero even though ln r becomes more negative. In the entropy formula the other density term also vanishes, leaving only C(ν). The stated zero-radiation condition makes that constant zero.",
    foundationLinks: wienIntegrationLink("logarithms"),
  },
  algebraicMove: {
    explanation:
      "At fixed frequency, set a = Aν³ just for this calculation. Differentiate ρ ln(ρ/a) − ρ: the product rule gives ln(ρ/a) + 1 − 1, leaving the required logarithm. Its antiderivative is therefore ρ ln(ρ/a) − ρ. Multiplying by −1/(Bν) gives the entropy expression, with C(ν) still to be fixed by the boundary condition.",
    foundationLinks: wienIntegrationLink("integration"),
  },
  purposeOfCalculation: {
    explanation:
      "The next step compares the entropy of the same radiation energy in two volumes. A constant added to entropy density contributes C(ν) times volume times the frequency-band width to total entropy, so it does not cancel when volume changes. Fixing C(ν) before that comparison is what lets the later volume dependence follow from the stated premises. It does not turn Wien's approximation into a general radiation law.",
    foundationLinks: wienIntegrationLink("entropy-multiplicity"),
  },
};

/** Relativity §3: the shortened two-direction proof retains its unfixed scale and its extra premises. */
const lorentzMapLink = (foundationId: string) => [
  {
    foundationId,
    callingAnchor: "arg-sr-lorentz-map",
    returnCaption:
      "Return to the light constraints, the remaining scale, and the round-trip check.",
  },
];
const ARG_SR_LORENTZ_MAP_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "x and t label an event in the original frame; x′ and t′ label that same event in the moving frame in this explanation. v is their relative speed and a(v) is a scale factor still to be found. The source calls the moving coordinates ξ and τ, and uses x′ = x − vt as a separate helper coordinate. Its β is the factor called γ here, not the speed ratio v/c.",
    foundationLinks: lorentzMapLink("frames-events"),
  },
  physicalReason: {
    explanation:
      "The moving origin follows x = vt, so its new position must be zero wherever x − vt is zero. With a linear coordinate map, light travelling in either direction must still have speed c in the moving frame. Those two requirements make the new time depend on position as well as old time. They leave a common scale undetermined; reversing the change of frame and spatial symmetry supply further constraints.",
    foundationLinks: lorentzMapLink("frames-events"),
  },
  connectionToPicture: {
    explanation:
      "Follow two light rays from the common origin: one has x = ct and one x = −ct. The transformed event coordinates must put them on x′ = ct′ and x′ = −ct′. Multiplying both new coordinates by the same positive factor leaves those slopes unchanged, which is why the light-ray picture alone cannot choose a(v). The picture is a coordinate comparison, not what a camera receives.",
    foundationLinks: lorentzMapLink("functions-graphs"),
  },
  tooMuchAtOnce: {
    explanation:
      "Use the passage's speed v = 0.6c. Going to the moving frame and back requires a² × (1 − 0.6²) = 1 once spatial symmetry makes the factors equal. Thus a² × 0.64 = 1, and the positive factor is a = 1/0.8 = 1.25. Check it: 1.25 × 1.25 × 0.64 = 1. Continuity from a(0) = 1 selects this positive root.",
    foundationLinks: lorentzMapLink("bridge-squaring-square-roots"),
  },
  algebraicMove: {
    explanation:
      "Write t′ = Pt + Qx. The right-going ray gives a(c − v) = c(P + Qc); the left-going ray gives a(c + v) = c(P − Qc). Add them: 2ac = 2cP, so P = a. Subtract the second from the first: −2av = 2Qc², so Q = −av/c². Hence t′ = a(t − vx/c²), still with the same unknown scale as x′.",
    foundationLinks: lorentzMapLink("matrices-linear-maps"),
  },
  purposeOfCalculation: {
    explanation:
      "The calculation constructs a map between synchronized coordinate systems for the same events. Light in both directions fixes the mixing of position and time; going there and back, spatial symmetry and continuity fix the remaining scale for speeds below c. This is the passage's shorter reconstruction. Einstein's own route follows out-and-back clock signals. The spacetime interval can check the result later, but is not a premise of this derivation.",
    foundationLinks: lorentzMapLink("conservation-symmetry"),
  },
};

/** Brownian §5: an algebraic inversion is conditional on independent measurements and model assumptions. */
const inferenceLink = (foundationId: string) => [
  {
    foundationId,
    callingAnchor: "arg-bm-inference",
    returnCaption:
      "Return to the independently measured radius needed to infer N from diffusivity.",
  },
];
const ARG_BM_INFERENCE_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "D is diffusivity, inferred here from mean-square displacement along one axis over time t. N is the number of molecules in a mole; a is the tracer's radius, η the liquid's viscosity, T its absolute temperature and R the molar gas constant. In the printed paper radius is P and viscosity is k. That k is not Boltzmann's constant.",
    foundationLinks: inferenceLink("unit-system-1905"),
  },
  physicalReason: {
    explanation:
      "The relation combines ideal osmotic pressure with Stokes drag for dilute small spheres in a liquid. In that model D = RT/(6πηaN). Measured displacement can constrain D, but a and N enter only through their product. Temperature, viscosity, the gas constant and especially the radius need independent information before an estimate of N is possible. Noise, drift and finite observation time also need their own treatment.",
    foundationLinks: inferenceLink("error-and-inference"),
  },
  connectionToPicture: {
    explanation:
      "Picture mean-square displacement on the vertical axis and elapsed time on the horizontal one. In the admitted diffusion model the straight line's slope is 2D. One measured slope therefore fixes D. Beside that plot, list pairs of radius and molecular number: halving a and doubling N leaves aN, D and the predicted line unchanged. A radius measurement is what separates those possibilities.",
    foundationLinks: inferenceLink("two-measurements-two-unknowns"),
  },
  tooMuchAtOnce: {
    explanation:
      "The passage's worked case pairs a radius of 0.5 μm with N = 6 × 10²³ per mole. The same diffusivity would pair a radius of 1 μm with N = 3 × 10²³ per mole: the radius doubles and N halves. Displacement alone cannot choose between them. These are model calculations using an assumed N, not an independent measurement of molecules.",
    foundationLinks: inferenceLink("two-measurements-two-unknowns"),
  },
  algebraicMove: {
    explanation:
      "From ⟨x²⟩ = 2Dt, divide by 2t for positive t to obtain D. Rearrange D = RT/(6πηaN) to N = RT/(6πηaD). Replacing D by ⟨x²⟩/(2t) multiplies the numerator by 2t; the factor 2 cancels against 6 to leave N = RTt/(3πηa⟨x²⟩). ⟨x²⟩ is the mean of squared displacements, not the square of their signed mean.",
    foundationLinks: inferenceLink("mean-variance-rms"),
  },
  purposeOfCalculation: {
    explanation:
      "The inversion shows how an independently observed spread could estimate N under the model's assumptions. Feeding it a spread generated from an assumed N checks the arithmetic and returns that assumption; it supplies no independent evidence for N in nature. With real observations, uncertainties in the displacement and the separately measured inputs remain part of the estimate. Rearranging the formula does not remove them.",
    foundationLinks: inferenceLink("error-and-inference"),
  },
};

/** The passages marked hard, each with an authored answer for all six obstacles. */
const OBSTACLES: Readonly<Record<string, ObstacleResponses>> = {
  "arg-bm-observable": ARG_BM_OBSERVABLE_OBSTACLES,
  "arg-bm-inference": ARG_BM_INFERENCE_OBSTACLES,
  "arg-lq-independent-configurations": ARG_LQ_INDEPENDENT_CONFIGURATIONS_OBSTACLES,
  "arg-lq-entropy-temperature": ARG_LQ_ENTROPY_TEMPERATURE_OBSTACLES,
  "arg-lq-wien-integration": ARG_LQ_WIEN_INTEGRATION_OBSTACLES,
  "arg-sr-velocity-composition": ARG_SR_VELOCITY_COMPOSITION_OBSTACLES,
  "arg-sr-lorentz-map": ARG_SR_LORENTZ_MAP_OBSTACLES,
  "arg-me-subtraction": ARG_ME_SUBTRACTION_OBSTACLES,
};

export function passageActionsFromArgument(argument: Argument): PassageActions {
  const firstExperiment = argument.experiments[0];
  const obstacleResponses = Object.hasOwn(OBSTACLES, argument.id)
    ? OBSTACLES[argument.id]
    : undefined;
  return validatePassageActions({
    hard: obstacleResponses !== undefined,
    why: argument.help.why,
    missingStep: argument.help.missingStep,
    example: argument.help.example,
    original: [argument.id],
    ...(firstExperiment !== undefined ? { tryIt: { instrumentId: firstExperiment } } : {}),
    ...(obstacleResponses !== undefined ? { obstacleResponses } : {}),
  });
}
