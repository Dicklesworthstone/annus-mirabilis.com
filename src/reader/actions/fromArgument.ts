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

/** Brownian §4: averaging removes the cross terms only under the stated step assumptions. */
const independentStepsLink = (foundationId: string) => [
  {
    foundationId,
    callingAnchor: "arg-bm-independent-steps",
    returnCaption: "Return to why independent, centred steps make the mean square grow with time.",
  },
];
const ARG_BM_INDEPENDENT_STEPS_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "Δᵢ is the signed displacement in step i; n counts the steps and τ is the time per step. Angle brackets mean an average over many realizations. l² is the mean square of one step. Thus ⟨x²⟩ averages the squared total displacements, while ⟨x⟩² squares their signed average. Those two operations give different answers.",
    foundationLinks: independentStepsLink("mean-variance-rms"),
  },
  physicalReason: {
    explanation:
      "Independence lets the average of a product of different steps factor into the product of their averages. Centred steps have zero average, so those cross terms vanish. Neither condition alone makes this argument work. Einstein needs an interval τ long enough for independence to be a useful approximation; it is not asserted down to every instant of a tracer's motion.",
    foundationLinks: independentStepsLink("probability-independence"),
  },
  connectionToPicture: {
    explanation:
      "For the passage's two-step walk, list the four equally likely pairs: (+1, +1), (+1, −1), (−1, +1), (−1, −1). Their endpoints are +2, 0, 0, −2. The signed average stays zero, but the squared endpoints are 4, 0, 0, 4 and average to 2. A wider cloud can therefore keep the same centre.",
    foundationLinks: independentStepsLink("random-walks"),
  },
  tooMuchAtOnce: {
    explanation:
      "Keep just the square-root comparison from the passage. In the ±1 walk, 4 steps give mean square 4 and RMS displacement 2. After 16 steps those values are 16 and 4. Four times as many steps, and therefore four times the time at fixed τ, doubles the RMS displacement. It does not quadruple it.",
    foundationLinks: independentStepsLink("bridge-squaring-square-roots"),
  },
  algebraicMove: {
    explanation:
      "First expand (A + B)² = A² + 2AB + B², then average. Independence gives ⟨AB⟩ = ⟨A⟩⟨B⟩, and centring makes this zero. For n steps all the cross terms vanish in the same way, leaving n copies of l². Substitute n = t/τ and define D = l²/(2τ); the remaining expression is ⟨x²⟩ = 2Dt.",
    foundationLinks: independentStepsLink("probability-independence"),
  },
  purposeOfCalculation: {
    explanation:
      "This step finds an observable that accumulates predictably even when individual displacements do not: the mean square. It supplies the bridge from random steps to the diffusivity in the next passage. The fixed-jump walk is a mathematical reconstruction; it does not claim that a liquid makes a tracer take literal jumps of one prescribed length.",
    foundationLinks: independentStepsLink("random-walks"),
  },
};

/** Brownian §4: retain normalization, symmetry, finite second moment and the approximation's scale. */
const diffusionEquationLink = (foundationId: string) => [
  {
    foundationId,
    callingAnchor: "arg-bm-diffusion-equation",
    returnCaption: "Return to how the jump law becomes the diffusion equation on larger scales.",
  },
];
const ARG_BM_DIFFUSION_EQUATION_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "p(x,t) is a density over position, so its integral over an interval is a probability. φ(Δ) is a different density, over possible displacements during time τ. The symbols ∂p/∂t and ∂²p/∂x² mean the density's time rate of change and its spatial curvature. D has units of length squared per time.",
    foundationLinks: diffusionEquationLink("partial-derivatives"),
  },
  physicalReason: {
    explanation:
      "To reach x after a jump Δ, a tracer must start at x − Δ. Add the contributions of all possible jumps, using the same jump law at every starting position. Equal left and right jumps remove a preferred direction. The approximation also needs a density that varies little across one jump and one interval, with τ still long enough for the independence assumption.",
    foundationLinks: diffusionEquationLink("diffusion-equation"),
  },
  connectionToPicture: {
    explanation:
      "Picture a smooth density peak and its neighbouring lower regions. At the top the curvature is negative, so D times the curvature makes the peak fall. In a hollow the curvature is positive and the density rises. The changing curve describes the whole population; it does not prescribe the next move of any particular tracer.",
    foundationLinks: diffusionEquationLink("functions-graphs"),
  },
  tooMuchAtOnce: {
    explanation:
      "Follow the three spatial terms. The jump probabilities add to one, so the first term is the present density. Equal positive and negative jumps cancel the slope term. Squared jumps add rather than cancel, leaving the curvature term. Subtract the present density from both sides and divide by τ. The remaining time rate is D times the curvature, within the retained approximation.",
    foundationLinks: diffusionEquationLink("taylor-expansion"),
  },
  algebraicMove: {
    explanation:
      "After the two Taylor expansions, normalization gives p on the right and symmetry gives zero for the first jump moment. The retained equation is p + τ ∂p/∂t ≈ p + ½⟨Δ²⟩ ∂²p/∂x². Subtract p, divide by positive τ, and name ⟨Δ²⟩/(2τ) as D. A finite second moment is needed for this coefficient.",
    foundationLinks: diffusionEquationLink("taylor-expansion"),
  },
  purposeOfCalculation: {
    explanation:
      "The calculation connects a random displacement rule to a deterministic law for density. It drops higher spatial and time terms, so it applies on scales larger than one jump. An exact diffusion limit requires the jumps and time interval to shrink together while D stays finite. Setting τ to zero with the same finite jumps would not justify the equation.",
    foundationLinks: diffusionEquationLink("diffusion-equation"),
  },
};

/** Brownian §4: a density predicts interval probabilities; its point-source formula requires positive time. */
const gaussianLink = (foundationId: string) => [
  {
    foundationId,
    callingAnchor: "arg-bm-gaussian",
    returnCaption:
      "Return to the spreading density, its interval probabilities and one-coordinate RMS.",
  },
];
const ARG_BM_GAUSSIAN_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "p is probability density, with units of inverse length; its height is not itself a probability. D is diffusivity, t is elapsed time and λₓ is the root-mean-square displacement along one axis. In e^(−x²/(4Dt)), the ratio x²/(4Dt) has no units. The square-root factor underneath makes the total area one.",
    foundationLinks: gaussianLink("distributions"),
  },
  physicalReason: {
    explanation:
      "This solution assumes every tracer starts at the same point on an unbounded line, with constant positive D and no drift. The bell curve solves the diffusion equation under those conditions. Walls, a spread of initial positions or a different transport law require a different solution. The Gaussian formula here is defined for positive time.",
    foundationLinks: gaussianLink("gaussian-distributions"),
  },
  connectionToPicture: {
    explanation:
      "Read an area under the curve: shade the interval from one position to another, and its area is the chance of finding a tracer there. As time grows the bell widens and its peak falls while the total area stays one. The signed centre stays at the start. Neither the height of the peak nor the path of one tracer is the ensemble's RMS width.",
    foundationLinks: gaussianLink("distributions"),
  },
  tooMuchAtOnce: {
    explanation:
      "Use the passage's interval check. Between −λₓ and +λₓ lies about 68% of the probability, and between −2λₓ and +2λₓ about 95%, at every positive time. As time increases these intervals widen because λₓ = √(2Dt). These percentages describe repeated tracers or realizations; they do not promise that a particular tracer stays inside an interval.",
    foundationLinks: gaussianLink("gaussian-distributions"),
  },
  algebraicMove: {
    explanation:
      "Set u = x/√(4Dt), so dx = √(4Dt) du and x² = 4Dt u². The square-root factors cancel in the integral. Normalization uses ∫e^(−u²) du = √π over the whole line. For the second moment, integration by parts gives ∫u²e^(−u²) du = √π/2. Multiplying that normalized one-half by 4Dt gives ⟨x²⟩ = 2Dt.",
    foundationLinks: gaussianLink("integration"),
  },
  purposeOfCalculation: {
    explanation:
      "The density law now predicts a measurable spread: λₓ = √(2Dt) for one coordinate. Three independent coordinates instead have total mean square 6Dt. At t = 0 every tracer is at the start, a point distribution; the finite bell formula cannot be evaluated there. Distinguishing these cases keeps a density plot from silently answering a different measurement question.",
    foundationLinks: gaussianLink("mean-variance-rms"),
  },
};

/** Mass-energy: the unchanged additive constant is a physical premise, not a result of cancellation. */
const constantPremiseLink = (foundationId: string) => [
  {
    foundationId,
    callingAnchor: "arg-me-constant-premise",
    returnCaption:
      "Return to the unchanged offset needed to identify the kinetic-energy difference.",
  },
];
const ARG_ME_CONSTANT_PREMISE_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "E is the body's energy in its rest frame, H its energy in the moving frame and K its kinetic energy in that moving frame. Subscripts 0 and 1 mean before and after emission. Capital C is an additive energy offset in H − E = K + C. It is different from lowercase c, the speed of light.",
    foundationLinks: constantPremiseLink("bridge-letter-for-quantity"),
  },
  physicalReason: {
    explanation:
      "The paper identifies each frame-energy difference with kinetic energy plus an offset and asserts that the offset is unchanged by the emission. That assertion is needed to interpret the subtraction as a kinetic-energy drop. The two energy balances alone do not establish it. The conclusion remains conditional on this premise.",
    foundationLinks: constantPremiseLink("work-energy"),
  },
  connectionToPicture: {
    explanation:
      "Write the two differences in parallel rows: before, K₀ + C; after, K₁ + C. When the second row is subtracted, the identical C entries cancel. If the entries instead read C₀ and C₁, their difference would remain in the result. A crossed-out pair in the ledger represents the assumed equality of those entries.",
    foundationLinks: constantPremiseLink("conservation-symmetry"),
  },
  tooMuchAtOnce: {
    explanation:
      "Keep only the part that can get lost: the two offsets. Calling both of them C says they are the same before and after. Their difference is then zero. If they may change, the ledger gives the kinetic-energy drop plus the offset change, and cannot separate them. Cancelling matching symbols does not prove that the offsets really match.",
    foundationLinks: constantPremiseLink("bridge-equals-sign-relationship"),
  },
  algebraicMove: {
    explanation:
      "Substitute H₀ − E₀ = K₀ + C and H₁ − E₁ = K₁ + C into the previous subtraction. The right side becomes (K₀ + C) − (K₁ + C) = K₀ − K₁. With distinct offsets it would be (K₀ − K₁) + (C₀ − C₁). Only the unchanged-offset premise removes that last term.",
    foundationLinks: constantPremiseLink("bridge-equals-sign-relationship"),
  },
  purposeOfCalculation: {
    explanation:
      "This is the bridge from a difference between two energy accounts to the loss of energy of motion L(γ − 1). The body has the same speed before and after the symmetric emission. The next passage asks what a drop in kinetic energy at that same speed implies for inertia. No absolute body-energy formula has been assumed here.",
    foundationLinks: constantPremiseLink("work-energy"),
  },
};

/** Mass-energy: read the limiting quadratic coefficient, not the finite-speed quotient or an assumed rest energy. */
const smallSpeedLink = (foundationId: string) => [
  {
    foundationId,
    callingAnchor: "arg-me-small-speed",
    returnCaption: "Return to the low-speed coefficient that identifies the loss of inertial mass.",
  },
];
const ARG_ME_SMALL_SPEED_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "β = v/c is speed as a fraction of the speed of light, and γ = 1/√(1 − β²) is the transformation factor. K₀ − K₁ is the kinetic energy lost by the body. The coefficient of v²/2 is the quantity multiplying that factor in the leading low-speed term; Newtonian mechanics identifies such a coefficient with a mass difference.",
    foundationLinks: smallSpeedLink("taylor-expansion"),
  },
  physicalReason: {
    explanation:
      "At low speed, Newtonian kinetic energy is mv²/2. The body keeps the same speed before and after emission, so a change in the coefficient multiplying v²/2 identifies a change in inertia. Comparing this with the leading term of L(γ − 1) yields the mass lost. The argument does not insert an absolute rest energy mc² into the ledgers.",
    foundationLinks: smallSpeedLink("work-energy"),
  },
  connectionToPicture: {
    explanation:
      "Compare the exact kinetic-energy drop with the quadratic approximation as functions of speed. They agree to leading order near zero and separate at larger speeds. At v = 0.6c the exact drop is 0.25L, while the quadratic term is 0.18L. That difference shows why dividing one high-speed value by v²/2 does not identify the low-speed coefficient.",
    foundationLinks: smallSpeedLink("functions-graphs"),
  },
  tooMuchAtOnce: {
    explanation:
      "Use the passage's β = 0.1 check. γ − 1 is about 0.0050378. The leading term β²/2 is 0.005, and the next term 3β⁴/8 is 0.0000375. The leading term already lies close, and the next explains most of the difference. Lowering the speed further suppresses the higher powers.",
    foundationLinks: smallSpeedLink("taylor-expansion"),
  },
  algebraicMove: {
    explanation:
      "Expand γ − 1 = β²/2 + 3β⁴/8 + higher powers, then replace β² by v²/c². The leading drop is (L/c²)v²/2. Newtonian mechanics gives (m₀ − m₁)v²/2 at the same low speed. Matching the limiting coefficients identifies the positive mass lost, m₀ − m₁ = L/c²; it does not equate the full finite-speed expressions.",
    foundationLinks: smallSpeedLink("taylor-expansion"),
  },
  purposeOfCalculation: {
    explanation:
      "The finite-speed quotient 2L(γ − 1)/v² contains higher-speed corrections. Its limit as v approaches zero is L/c², the mass-loss coefficient under the preceding premises. At exactly v = 0 the unreduced quotient reads 0/0, so use the limit rather than division by zero. The limiting coefficient is meaningful even where that quotient cannot be evaluated directly.",
    foundationLinks: smallSpeedLink("taylor-expansion"),
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
  "arg-bm-independent-steps": ARG_BM_INDEPENDENT_STEPS_OBSTACLES,
  "arg-bm-diffusion-equation": ARG_BM_DIFFUSION_EQUATION_OBSTACLES,
  "arg-bm-gaussian": ARG_BM_GAUSSIAN_OBSTACLES,
  "arg-me-constant-premise": ARG_ME_CONSTANT_PREMISE_OBSTACLES,
  "arg-me-small-speed": ARG_ME_SMALL_SPEED_OBSTACLES,
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
