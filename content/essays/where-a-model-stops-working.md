## Give the prediction a domain {#prediction-and-domain}

A useful model names a quantity, a set of assumptions and a range in which the prediction is meant to apply. Those conditions help locate a disagreement. A missing physical effect, an imperfect observation and an unsuitable calculation can all change a result, but they call for different repairs. {#locate-the-disagreement}

A boundary must do more than excuse an unwelcome result. State it before interpreting the comparison and give reasons for it. If repeated measurements disagree with a prediction while its physical and observational assumptions remain supported, the model needs investigation. If a calculation has been extended beyond a required condition, first identify the condition and the additional account the new question requires. {#boundary-is-a-claim}

## Diffusion predicts a spread over an interval {#diffusion-prediction}

The Brownian paper requires [a time interval short relative to observation but long enough for independence](ref:brownian-motion/s4-p3). Its [root mean square displacement](ref:brownian-motion/s4-p11) describes the spread of coordinate displacements, with the diffusion coefficient D setting the scale. {#brownian-source-boundary}

{{equation:eq-model-bm-rms}} {#diffusion-spread-equation}

The expression can be evaluated mathematically for every positive t. A physical use needs the assumptions behind D and the independent-increment description to remain adequate. Dividing the spread by t produces a quotient that grows as t shrinks. That behavior belongs to the ideal diffusion model; it cannot determine the instantaneous velocity of a particle whose inertia and interaction with the surrounding fluid the model has omitted. {#short-time-extension}

The [Brownian instrument](ref:bm-01) makes that interval-dependent apparent speed visible. Asking for shorter-time motion requires a model that retains the relevant dynamics and evidence for its time scales. The long-time displacement relation can remain useful even when that extension is unavailable. {#keep-supported-predictions}

## The camera can change the inferred motion {#camera-changes-observation}

A discrepancy in recorded displacements need not originate in the particle's dynamics. The [camera instrument](ref:bm-08) adds a later, explicitly synthetic observation model to ideal diffusion. It separates the latent motion from exposure averaging and localization error. These are additions for studying measurement, not claims about the apparatus described in 1905. {#later-observation-model}

Consider its zero-exposure, zero-drift case in one coordinate. Let Xᵢ be a true position at a frame time and εᵢ an independent position error with mean zero and variance σ². The recorded position is Yᵢ = Xᵢ + εᵢ. Assume the errors are also independent of the particle's motion and use a fixed positive frame interval τ. {#camera-assumptions}

A recorded increment contains the true increment plus εᵢ₊₁ − εᵢ. The true increment has variance 2Dτ; the error difference has variance 2σ². Therefore the recorded increment has variance 2Dτ + 2σ². Dividing this second moment by 2τ, as if the recorded positions were exact, gives an expected diffusion estimate D + σ²/τ. Shortening τ increases the extra term even though the underlying D has stayed fixed. {#noise-bias-worked-example}

Neighboring recorded increments also share an error. The error εᵢ₊₁ appears with a plus sign in the first increment and a minus sign in the next, producing covariance −σ². Independent position errors have therefore made adjacent measured increments dependent. A confidence interval that assumes those increments are independent needs more justification than a numerical estimate of D. {#shared-error-covariance}

Start with zero exposure in the camera instrument, add localization error and compare the expected moments with the estimates. Then add exposure and inspect how averaging changes both spread and neighboring covariance. The instrument's corrections belong to its stated camera model; correlated errors, irregular frame timing and a different exposure profile would require further work. A changed estimate alone cannot tell which layer failed. {#camera-investigation}

## An electron energy budget leaves material behavior open {#photoelectric-boundary}

The light-quanta paper [states the assumption of complete transfer](ref:light-quanta/s8-p2): in the simplest case, one quantum gives its energy to one electron. An electron must spend energy leaving the material and may lose additional energy before reaching the surface. In modern notation, hν is the quantum energy and Φ the escape work. For escaping electrons that receive the full quantum and incur no additional loss, the maximum kinetic energy is: {#photoelectric-assumptions}

{{equation:eq-model-lq-photoelectric-maximum}} {#maximum-energy-equation}

The [stopping-potential relation](ref:light-quanta/s8-p3) then connects that maximum energy to the retarding potential needed to stop the fastest electrons. The teaching equation neglects contact potentials between electrode materials. {#stopping-potential-assumptions}

{{equation:eq-model-lq-stopping-energy}} {#stopping-energy-equation}

At fixed frequency and escape work, increasing incident power supplies more quanta per unit time without increasing the energy of each quantum. Under independent absorption and otherwise unchanged conditions, the paper [connects intensity to the emission rate](ref:light-quanta/s8-p7) while keeping the electron-energy distribution independent of intensity. The [photoelectric instrument](ref:lq-08) lets you compare these changes separately. {#power-and-frequency}

The equality has a sharper boundary than the arithmetic alone suggests. If hν is below Φ, the assumed process provides no escaping electron; a negative remainder cannot be interpreted as negative kinetic energy. If complete transfer is not assumed, the paper itself [replaces the equality by an inequality](ref:light-quanta/s8-p9). The equality's missing premise changes the strength of the conclusion. {#equality-needs-transfer}

Even where the energy budget applies, it does not determine how many incident quanta a particular surface absorbs, which electrons escape, or how an actual collector records them. The instrument declares exclusions including real-material yields and energy distributions, surface states, contact potentials, space charge, reflection losses and multiphoton or thermionic emission. A selected efficiency is a model input. It does not turn the energy relation into a universal current-voltage curve for a named material. {#material-predictions-need-more}

## A mirror with a prescribed speed {#prescribed-mirror}

The relativity paper [places a perfectly reflecting plane at rest in the moving frame](ref:special-relativity/s8-p6). It [transforms the incident wave to that frame, reflects it and transforms it back](ref:special-relativity/s8-p7). In the teaching notation, β = v/c describes the prescribed mirror speed and φ the incidence angle measured in the stationary frame. {#mirror-source-setup}

{{equation:eq-model-sr-mirror-frequency}} {#reflected-frequency-equation}

For normal incidence, the numerator becomes (1 − β)² and the denominator is (1 − β)(1 + β). Their ratio reduces to (1 − β)/(1 + β). A receding mirror returns a lower frequency. This is a consequence of the declared constant-speed reflection problem; the calculation has not yet assigned a mass to the mirror or solved for its later velocity. {#mirror-symbolic-example}

The [source's energy balance](ref:special-relativity/s8-p10) accounts for the difference between incoming and outgoing light energy as mechanical work. Thus the prescribed-motion model can include energy transfer while leaving the motion prescribed. To predict the recoil and acceleration of a freely moving mirror, the dynamics of the mirror and any external agent maintaining its motion must enter the account. {#work-without-recoil-trajectory}

The [moving-mirror instrument](ref:sr-11) exposes another boundary before any reflection calculation: the light must reach the mirror. If the incoming ray's velocity component toward the plane is no greater than the receding plane's speed, a ray initially behind it does not catch it. Extending an algebraic reflection expression to that geometry cannot create a reflected ray. The instrument checks interception as part of the physical question. {#interception-before-reflection}

Change the mirror speed and incidence angle, inspect the incident, reflected and work terms, and read the case in which interception fails. Then ask which new inputs would be required to determine the mirror's next speed. The absent mirror mass and acceleration are the missing dynamics of that further question. {#mirror-investigation}

## Keep the condition with the conclusion {#keep-domain-visible}

These examples locate different boundaries. Diffusion leaves out dynamics at sufficiently short times. A camera can alter the relation between a physical trajectory and its recorded positions. A one-quantum budget predicts an energy relation under transfer assumptions without determining every material response. A prescribed mirror supplies a reflection problem without supplying a trajectory. {#different-boundaries}

For a new use, state the requested observable, trace the assumptions that support it and identify the evidence needed to extend them. A failed extension does not erase predictions already supported inside the declared domain. Keeping that domain explicit also leaves a model answerable to disagreement where it does claim to describe the world. {#model-remains-answerable}
