## Specify the resemblance {#specify-the-resemblance}

The light-quanta paper compares radiation with a gas through a particular relation: how entropy changes when the available volume changes. That choice matters. Light and gas molecules need not have the same motions, interactions or means of exchanging energy for a mathematical dependence to resemble another. A useful analogy names the relation it preserves and keeps the remaining questions open. {#a-relation-to-compare}

The radiation side begins with Wien's spectral law. Einstein [states its restricted range before using it](ref:light-quanta/s4-p1). Consider a positive amount of radiation energy E in a fixed narrow frequency band around ν. Compare that same energy and band in volumes V and V₀, with both states within the law's regime. The [entropy difference derived in Section 4](ref:light-quanta/eq-s4-d5) is: {#radiation-comparison}

{{equation:eq-model-lq-volume-entropy}} {#radiation-volume-law}

B here is the spectral constant printed as β in this paper. The volume dependence sits in a logarithm; the coefficient is E divided by Bν. Energy, central frequency and bandwidth remain fixed during this comparison. Changing a cavity's volume by moving its walls need not preserve those quantities, so that physical process cannot be silently substituted for the comparison just specified. The [radiation entropy laboratory](ref:lq-04) lets you examine the dependence with the held quantities visible. {#hold-the-radiation-conditions}

## Find where the gas logarithm comes from {#count-independent-positions}

For the gas comparison, write f for the fraction V/V₀, with V a positive subvolume smaller than V₀. Suppose n points have independent positions, each uniformly distributed throughout V₀. One point has probability f of lying in the chosen subvolume. The question in [Section 5](ref:light-quanta/s5-p7) asks for the probability that all the points are there at the same instant. {#state-the-probability-question}

Independence permits multiplication of the individual probabilities. Each point supplies another factor of f, giving the model relation: {#multiply-the-probabilities}

{{equation:eq-model-lq-configuration-probability}} {#configuration-probability}

[Applying Boltzmann's entropy relation](ref:light-quanta/s5-p8) turns the product into a logarithm. The exponent n becomes a multiplier. The displayed modern form uses Boltzmann's constant, which the paper writes R/N: {#take-the-logarithm}

{{equation:eq-model-lq-gas-entropy-change}} {#gas-volume-law}

The coefficient records how many independently positioned points were required to occupy the smaller volume together. The argument concerns a restriction on configurations. It does not calculate a gas molecule's path or the time it takes to enter the subvolume. {#what-the-exponent-counts}

## Lock the positions and repeat the argument {#locked-positions}

Keep n labels, but attach them all to exactly one uniformly sampled position. Whenever that position lies inside the chosen subvolume, every label lies inside; whenever it lies outside, every label lies outside. The probability of all labels being inside is now f. Multiplying f once for every label would count the same event repeatedly as though the events were independent. {#shared-position-counterexample}

Boltzmann's relation now gives the entropy coefficient of one independent position, whatever the number of labels. This is a deliberately constructed counterexample to the counting premise, not a proposal about the structure of a gas or a replacement theory of radiation. The [configuration laboratory](ref:lq-05) provides independent and locked positions so that the consequence of changing this premise can be inspected. {#inspect-the-counterexample}

The counterexample identifies the useful part of the analogy. Merely drawing many dots does not supply the gas coefficient. The positions must have the specified probability law, and their joint probabilities must factor. Any proposed interpretation of the radiation coefficient inherits a question about that independence. {#identify-the-needed-structure}

## Work the coefficient comparison {#match-the-coefficients}

Place the radiation and gas entropy laws side by side for the same volume ratio. Both contain the same logarithm. To reproduce the radiation law with an independent-point description, its entropy coefficient must equal the gas coefficient. The paper [rewrites the radiation expression for precisely this comparison](ref:light-quanta/s6-p1). Choose unequal volumes: if the ratio were unity, both entropy differences would vanish for every coefficient and that comparison would determine no count. {#choose-a-nonzero-logarithm}

Cancel the common nonzero logarithm. The radiation coefficient is E divided by Bν; the gas coefficient is the count multiplied by Boltzmann's constant. Divide the former by that constant to obtain the effective count: {#solve-for-the-count}

{{equation:eq-model-lq-effective-count}} {#effective-count-equation}

Keeping the paper's constants visible, replace Boltzmann's constant by R/N. The same count is obtained by multiplying E by N and dividing by RBν. It is the [exponent of the radiation probability expression](ref:light-quanta/s6-p5). Calling it an effective count records the proposed correspondence. It has been inferred from an entropy coefficient, not obtained by observing and counting individual packets, and rounding it would change the relation being compared. {#read-the-count-conditionally}

Now divide the total energy by that effective count. Substituting the count makes E cancel, leaving: {#divide-energy-by-count}

{{equation:eq-model-lq-energy-per-point-molar}} {#energy-per-element}

The result is proportional to frequency. Changing total energy at fixed frequency changes the effective count in proportion, while this energy per element stays fixed. This completes the symbolic example: a known volume dependence supplies a coefficient; a proposed independent-element description supplies an interpretation of that coefficient; dividing energy by the resulting count supplies a scale. No photon-energy formula was inserted as a premise of this calculation. {#what-the-calculation-fixes}

The [coefficient laboratory](ref:lq-06) follows that comparison. Agreement of its displayed entropy laws checks the correspondence under their stated assumptions. The scientific inference remains the proposal that independently behaving energy elements are a useful description of dilute radiation. The algebra alone cannot settle every property of those elements. {#inspect-the-coefficient-match}

## Carry the conclusion only as far as the premises {#scope-of-the-inference}

The paper's statement of the conclusion keeps both restrictions visible: sufficiently dilute monochromatic radiation, and a comparison in thermodynamic behavior. The original wording is: {#read-the-qualified-conclusion}

> source:light-quanta/s6-p6 {#source-thermodynamic-conclusion}

Three distinct steps are involved. The entropy calculation establishes a logarithmic volume dependence within the assumed radiation law. Matching coefficients establishes which effective independent-point count reproduces that dependence. Interpreting this resemblance as evidence for discrete energy elements is a heuristic inference. The first two steps explain the mathematical fit; the last gives the fit a proposed physical meaning. {#separate-the-logical-steps}

Einstein then [asks whether the production and transformation of light also behave according to the proposed energy elements](ref:light-quanta/s6-p4). That question extends the investigation to further phenomena. A volume-entropy comparison does not itself specify an emission mechanism, an absorption law or the behavior of radiation outside the Wien regime. Each extension needs its own assumptions and consequences. {#make-the-next-question-explicit}

When using an analogy elsewhere, identify the quantities being mapped, the relation that survives the mapping, and a change that would break it. Here the preserved relation is logarithmic volume dependence, coefficient matching supplies a frequency-dependent energy scale, and locking the positions demonstrates the importance of independence. Those statements make the analogy usable while leaving its unresolved physics visible. {#use-the-mapping-with-limits}
