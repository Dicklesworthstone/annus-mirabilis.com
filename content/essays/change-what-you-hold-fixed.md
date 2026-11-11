## A comparison has conditions {#comparison-conditions}

A statement such as “the entropy changes when the volume changes” leaves part of the question unanswered. Does energy stay fixed? Does temperature stay fixed? Is the radiation still in the same frequency band? Different constraints select different pairs of states, so they need not give the same change. {#name-the-constraints}

The useful move is to specify the comparison before interpreting the answer. This can expose a simpler dependence or reveal that two apparently similar calculations were answering different questions. It does not establish that an apparatus can follow every mathematically defined comparison. {#comparison-before-answer}

## Radiation at fixed energy and frequency {#fixed-band-radiation}

In section 4 of the light-quanta paper, [the entropy comparison holds the radiation energy and narrow frequency band fixed](ref:light-quanta/eq-s4-d5) while the volume changes. Both states must remain in the dilute regime where Wien's radiation law applies. The paper [explicitly qualifies its resemblance to the entropy of an ideal gas by the radiation's sufficiently small density](ref:light-quanta/s4-p5). {#radiation-source}

{{equation:eq-model-lq-volume-entropy}} {#radiation-equation}

This display uses the site's modern model letters: E is the fixed band energy, ν the fixed frequency, B the constant that Einstein writes as β, and V and V₀ the compared volumes. The logarithm is natural; the printed formula writes lg. The coefficient multiplying that logarithm stays fixed in this comparison. The bandwidth also stays fixed, even though it has dropped out of this final expression. {#radiation-notation}

Open [the radiation-entropy instrument](ref:lq-04). Its worked example uses a frequency of {{value:band-frequency}}, a bandwidth of {{value:bandwidth}} and energy {{value:band-energy}}. With the same energy and band in half the reference volume, the entropy change is {{value:entropy-change}}. The numbers use modern SI constants and illustrative model settings; they are not measurements reported in 1905. {#radiation-worked-example}

The coefficient divided by Boltzmann's constant gives an effective independent count of {{value:effective-count}}. This is the thermodynamic correspondence explored later in the paper. It is not an observed count of individual particles, and the instrument does not round it to an integer. Its role here is to show that the coefficient remains tied to the same energy and frequency while the volume ratio changes. {#coefficient-count}

There is another change to inspect. The dimensionless ratio of quantum energy to thermal energy falls from {{value:initial-x}} to {{value:final-x}}, a decrease by the natural logarithm of two. Both states remain dilute in this example, but reducing the volume moves the comparison toward the boundary of that approximation. “Keep the energy fixed” does not also mean “keep the temperature fixed.” {#check-both-states}

A moving reflecting wall would do work on the radiation and shift its frequencies. Its actual compression trajectory would change quantities that this comparison holds fixed. The entropy formula compares allowed states under declared constraints; it is not a claim that a moving mirror implements those constraints. {#moving-wall-limit}

## Brownian spreading at the same time {#same-elapsed-time}

The Brownian comparison uses a different set of controls. [The displacement law combines temperature, viscosity and particle size](ref:brownian-motion/s5-p1). To compare two sizes, hold temperature and dynamic viscosity fixed, and compare their distributions after the same elapsed time. [The statistic is the root-mean-square coordinate displacement](ref:brownian-motion/s4-p11), rather than the signed average or the largest displacement in a finite sample. {#brownian-controls}

{{equation:eq-model-bm-diffusivity}} {#diffusivity-equation}

{{equation:eq-model-bm-rms}} {#rms-equation}

In [the Brownian displacement instrument](ref:bm-01), double the radius while keeping the other settings fixed. The diffusion coefficient halves. The root-mean-square displacement falls by the square root of that factor: its ratio to the original is {{value:rms-ratio}}. A factor of two in the drag coefficient therefore does not produce a factor of two in the typical displacement. This numerical ratio compares two modern golden scenarios with the same temperature, declared viscosity and elapsed time. {#radius-comparison}

Use [the spreading-distribution instrument](ref:bm-06) to keep the observation time fixed while comparing different diffusion coefficients. The curves describe ensembles under the model. A particular finite set of observed particles can fluctuate around that distribution; holding the controls fixed does not remove sampling variation. {#compare-ensembles}

The declared viscosity in the radius example is an illustrative model input, not a measured property attributed to water. In a real fluid, changing temperature can also change viscosity. A temperature comparison that keeps viscosity numerically fixed needs that extra modelling assumption stated beside it. {#viscosity-assumption}

## Carry the constraints with the conclusion {#carry-the-constraints}

Before transferring a result to another setting, name the changed quantity, the held quantities, the quantity compared and the conditions under which the relation applies. The radiation example needs the same energy and frequency band in two dilute states. The Brownian example needs the same temperature, viscosity and elapsed time while the radius changes. Those conditions are part of each conclusion. {#constraints-travel}

A useful comparison can be deliberately narrower than a whole experiment. Its value comes from making a particular dependence inspectable. The next question is whether the physical system, numerical calculation or measurement protocol actually preserves the constraints on which that dependence relies. {#test-the-controls}
