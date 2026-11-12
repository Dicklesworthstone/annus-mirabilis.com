## Choose the claim before taking the limit {#choose-the-claim}

A limit answers a question about a particular quantity as a particular condition changes. An energy difference may approach zero while a coefficient extracted from that difference approaches a finite value. A spectrum may approach another spectrum in one range without carrying every calculation based on it into the same range. Naming the quantity first prevents an approximation from silently changing the question. {#limit-needs-a-target}

The papers give several ways to make this distinction concrete. The mass-energy note retains a quadratic term in the observer's speed. The light-quanta paper restricts a spectral law before using it to calculate entropy. The Brownian paper requires a separation between observation times and the shorter interval on which displacements are treated as independent. These are different uses of approximation, with different conclusions to preserve. {#different-uses}

## Extract the coefficient that survives {#coefficient-that-survives}

In the mass-energy note, a body emits equal light pulses in opposite directions and remains at rest in its original frame. Compare that same emission from a moving frame. The [energy-account subtraction](ref:mass-energy/s0-p7) identifies an exact kinetic-energy decrease if the relation between rest-frame energy, moving-frame energy and kinetic energy has the same additive offset before and after emission. The equality of those offsets is a premise that survives into the calculation. {#exact-difference-premise}

Write the emitted energy as L and the positive kinetic-energy decrease as ΔK = K₀ − K₁. In modern notation, β = v/c and γ = 1/√(1 − β²). The light speed c replaces the paper's V. Holding L fixed while changing v changes the observer, so the energy release being compared stays the same. {#define-speed-and-energy}

{{equation:eq-model-me-exact-drop}} {#exact-kinetic-decrease}

At small speed, γ − 1 begins with β²/2. The paper [discards fourth and higher orders](ref:mass-energy/s0-p11) before comparing the result with the Newtonian kinetic-energy form. The approximation retains the coefficient of v². It does not assert equality of the quadratic expression and the full expression at every speed. {#retained-order}

{{equation:eq-model-me-quadratic-drop}} {#quadratic-kinetic-decrease}

Taking the limit of ΔK alone gives zero. To read the mass coefficient, divide by the factor v²/2 that multiplies mass in the low-speed kinetic-energy expression. This quotient requires a nonzero v. {#form-the-quotient}

{{equation:eq-model-me-finite-speed-proxy}} {#finite-speed-quotient}

The algebra makes the surviving coefficient explicit. From γ² = 1/(1 − β²), obtain γ² − 1 = β²γ². Factor the left side as (γ − 1)(γ + 1), then divide by γ + 1. Substituting into the quotient gives 2ΔK/v² = (L/c²) 2γ²/(γ + 1). As v approaches zero, γ approaches one and the final factor approaches one. {#work-through-the-limit}

{{equation:eq-model-me-low-speed-limit}} {#limiting-mass-coefficient}

For a nonzero admissible speed, γ is greater than one and the final factor is greater than one. The finite-speed quotient therefore varies with the observer's speed, while its limit is L/c². That limiting coefficient supports the [mass decrease stated in the note](ref:mass-energy/s0-p12). Substituting v = 0 directly into the original quotient would instead give an undefined division. {#finite-quotient-and-limit}

In the [energy-account instrument](ref:me-02), keep L fixed and compare the exact decrease, the quadratic approximation and the finite-speed quotient as the speed shrinks. Identify which displayed quantity approaches zero and which approaches a mass. The [Taylor expansion foundation](ref:taylor-expansion) develops how an omitted term can become small relative to a retained term. {#inspect-the-coefficient}

## Keep a spectral approximation inside its regime {#spectral-regime}

The light-quanta paper [introduces Wien's law with its limitation](ref:light-quanta/s4-p1): observations support it for large frequency divided by temperature, while it is not an exact law for all thermal radiation. The modern teaching equation uses A and B for the paper's spectral constants. {#wien-restriction}

{{equation:eq-model-lq-wien-spectrum}} {#wien-equation}

Set x = Bν/T. With matched constants, Wien's density is ρW = Aν³e⁻ˣ and Planck's is ρP = Aν³/(eˣ − 1). Their ratio is ρW/ρP = 1 − e⁻ˣ. Hence the difference divided by the Planck density is e⁻ˣ, which tends to zero as x grows. This is a comparison at one frequency and one temperature. The [spectrum instrument](ref:lq-03) lets you inspect that discrepancy and the declared tolerance. {#pointwise-comparison}

A small pointwise discrepancy establishes only that spectral comparison. It is not a bound on the error of an entropy difference obtained by inversion and integration. The paper's [entropy calculation](ref:light-quanta/s4-p2) makes further choices: fixed energy E, fixed frequency ν, a fixed narrow bandwidth, and a boundary condition for the entropy-density integration constant. The resulting volume dependence is conditional on those choices and the [low-density regime](ref:light-quanta/s4-p5). {#spectral-error-is-local}

{{equation:eq-model-lq-volume-entropy}} {#entropy-volume-relation}

A symbolic compression shows why the endpoint matters. Let r = V/V₀. At fixed E and bandwidth, the final spectral energy density is the initial density divided by r. Combining this with the Wien exponential gives x = x₀ + ln r. Compression makes r smaller than one, so ln r is negative and the final x is smaller. An initially admissible state can therefore be pushed out of the Wien regime even though the initial spectral discrepancy was small. {#compression-changes-the-regime}

Use the [entropy instrument](ref:lq-04) to change the volume ratio and compare its initial and final regime checks. The logarithmic formula can remain algebraically evaluable after a required condition fails. The physical conclusion needs both states to satisfy the approximation, and the pointwise checks still do not supply an integrated entropy error bound. {#inspect-both-states}

## Keep the time scale that made diffusion possible {#diffusion-time-scale}

The Brownian derivation introduces [an intermediate interval τ](ref:brownian-motion/s4-p3). It must be short relative to observable intervals, yet long enough that motions in consecutive intervals can be treated as independent. The later [displacement result](ref:brownian-motion/s4-p11) concerns the square root of the mean squared coordinate displacement over an elapsed time t. {#independence-before-limit}

{{equation:eq-model-bm-rms}} {#coordinate-spread}

Divide that model spread by t to obtain an apparent coordinate speed. {#divide-by-observation-time}

{{equation:eq-model-bm-apparent-speed}} {#apparent-speed-quotient}

At fixed D, the spread decreases as √t while this quotient increases as 1/√t. The formal continuum model therefore has no finite limit for that apparent speed as t approaches zero. This statement does not establish an infinite instantaneous speed for a physical particle. The derivation required independent displacements on an intermediate time scale; extending the observation interval below the physical basis of that approximation changes the problem. {#formal-and-physical-limits}

In the [Brownian instrument](ref:bm-01), shorten the observation interval and compare the displacement spread with the apparent speed. State which quantity the instrument computes before interpreting its change. A finer interval resolves a different quotient; it does not, by itself, recover a velocity that the diffusion model left out. {#inspect-the-observation-interval}

## State what the approximation carries {#state-the-surviving-claim}

For each calculation, record the varying ratio, the held quantities and the conclusion being extracted. The mass-energy calculation preserves a quadratic coefficient. The Wien comparison preserves a spectral prediction within a stated regime, while the entropy calculation requires additional constraints. The diffusion model preserves a relation between displacement spread and observation time within its physical range. Each conclusion can be used more precisely once those conditions remain attached to it. {#carry-the-conditions}
