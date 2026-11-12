## Name the quantity where the routes meet {#name-the-meeting-point}

A diffusion coefficient describes how rapidly a distribution spreads. It has dimensions of squared length divided by time. A particle's speed has a different meaning and different units. In the Brownian paper, the coefficient D links a calculation about an equilibrium suspension to a calculation about displacements. To follow that connection, keep track of what each calculation starts with, what it establishes, and what it still leaves unspecified. {#one-coefficient-two-questions}

The first route combines osmotic pressure with the slow drift of a sphere through a liquid. It expresses D in terms of temperature, viscosity, particle radius and the molecular number. The second starts with a probability distribution for small displacements. It explains how the distribution spreads and how D determines a displacement statistic. They become useful together because they describe the same suspended particles in a common regime. {#what-each-route-supplies}

## Find D from an equilibrium {#equilibrium-route}

Einstein introduces a [force acting on the suspended particles](ref:brownian-motion/s3-p1). It produces a nonuniform equilibrium concentration. Write n for the number of suspended particles per unit volume, F for the force on each particle, and b for mobility, the steady drift speed per unit force. These are explanatory symbols; the printed paper uses ν for number density and K for force. The temperature is uniform, and the suspension is dilute. {#choose-the-equilibrium}

The osmotic law makes pressure equal to n multiplied by RT/N. Here R is the gas constant and N is the molecular number per mole. At fixed temperature, a pressure gradient therefore equals the number-density gradient multiplied by RT/N. The [thermodynamic equilibrium condition](ref:brownian-motion/s3-p2) equates that pressure gradient to the force density nF. This supplies one relation between the force and the concentration profile. {#pressure-balance}

Now describe the same equilibrium through particle flows. The [Stokes drift calculation](ref:brownian-motion/s3-p6) gives a mean drift speed bF. Multiplication by n turns that speed into a particle flux. Diffusion supplies an opposing flux: D times the density gradient, with a minus sign because it runs toward lower concentration. In the [zero-net-flux condition](ref:brownian-motion/s3-p7), these flows have equal magnitudes. {#flux-balance}

Substitute the thermodynamic expression for nF into the drift flux. Its coefficient of the density gradient becomes bRT/N, while the opposing diffusive coefficient is D. Comparing an equilibrium with a nonzero gradient lets that common gradient cancel. Thus D is bRT/N. Inserting the Stokes mobility of a sphere gives the [paper's result](ref:brownian-motion/s3-p8), written here with η for viscosity and a for radius: {#cancel-the-gradient}

{{equation:eq-model-bm-diffusivity-molar}} {#equilibrium-diffusivity}

The displayed N_A denotes the molecular number that the paper writes N. Einstein's printed k is viscosity, not Boltzmann's constant, and his P is the sphere's radius. The auxiliary force has disappeared because its effects on the drift and the equilibrium gradient compensate. A perfectly uniform, force-free state would give zero on both sides of the flux balance and would not determine D by cancellation. The nontrivial equilibrium comparison supplies the coefficient that can then be used without the force. {#why-the-force-disappears}

The [drift and diffusion laboratory](ref:bm-04) makes these two descriptions of equilibrium available together. The physical inputs still matter: the calculation assumes slow drift, spherical particles and a liquid for which the chosen drag law applies. The algebra cannot establish those conditions for a particular suspension. {#inspect-the-equilibrium}

## Find spreading from a displacement law {#distribution-route}

Section 4 begins from displacements over an interval τ. Einstein [requires that interval to be short compared with observation times but long enough for successive movements to be treated as independent](ref:brownian-motion/s4-p3). This choice carries physical information. Arbitrarily small steps in a drawing do not establish independence in a liquid. {#choose-the-step-interval}

Let φ describe the probability density of a coordinate displacement Δ during τ. Normalization says that all possible displacements account for the whole probability. Symmetry removes a preferred direction, so the first moment vanishes. The finite second moment measures the spread of a step. Einstein assigns the following [second-moment expression to D](ref:brownian-motion/eq-s4-d9): {#define-the-step-moment}

{{equation:eq-model-bm-jump-moment}} {#jump-moment-equation}

To obtain the later distribution, average the earlier distribution shifted by every possible displacement. Expand this expression on distances large compared with a step and times large compared with τ. The normalized zeroth-order term reproduces the earlier density; the symmetric first-order term vanishes; the second-order term contains the moment just displayed. Keeping these terms yields the diffusion equation. {#from-steps-to-density}

{{equation:eq-model-bm-diffusion-equation}} {#distribution-equation}

The paper [identifies its coefficient with the diffusion coefficient](ref:brownian-motion/s4-p9). With particles initially concentrated at one coordinate, the diffusion equation gives a Gaussian distribution. Its second moment supplies the [root mean square coordinate displacement](ref:brownian-motion/s4-p11): {#read-the-observable}

{{equation:eq-model-bm-rms}} {#displacement-equation}

This route connects D to an observable without specifying the viscosity or the sphere's radius. Its step variance remains an input until the equilibrium route supplies the physical value of D. The [step-law comparison](ref:bm-05) lets you change the shape of the steps while preserving their variance. The [spreading laboratory](ref:bm-06) displays the corresponding diffusion description. A finite collection of discrete steps need not already have an exactly Gaussian distribution. {#what-the-statistical-route-leaves-open}

## Work the connection backward {#worked-inverse-calculation}

Suppose repeated observations supply a positive mean squared coordinate displacement over a known interval t. Use one coordinate throughout, with zero drift assumed or accounted for. First turn the spreading relation around to estimate the coefficient from that mean square: {#start-from-observed-spread}

{{equation:eq-model-bm-diffusivity-from-data}} {#diffusivity-from-observations}

Next equate that expression for D to the equilibrium expression. Multiplying by the observation time and collecting the factors of the mean square gives the [inversion printed in Section 5](ref:brownian-motion/s5-p3). The factor of two in the coordinate spreading law combines with the factor of six in the Stokes coefficient: {#join-and-invert}

{{equation:eq-model-bm-avogadro-inference}} {#molecular-number-equation}

This completes a symbolic inference: a displacement statistic, an interval, the gas constant and separately supplied temperature, viscosity and radius yield a conditional estimate of N. It also exposes what the observations cannot decide. At fixed temperature and viscosity, the same spreading coefficient can arise from different radius and molecular-number pairs with the same product. Displacements alone do not separate those two unknowns. {#what-the-inversion-needs}

The [inference laboratory](ref:bm-07) explores that dependence with finite samples. If the radius was itself inferred from these same displacements using an assumed N, substituting it back would return the assumption. Likewise, recovering a molecular number from displacements generated using that number checks a procedure within a model. A real observational comparison needs measurements and calibration whose dependence on the sought quantity has been examined. {#avoid-a-circular-meeting}

## Ask what the agreement establishes {#meaning-of-agreement}

The routes share a molecular and statistical framework. Within it, they constrain different parts of the description: equilibrium and drag fix the scale of D, while displacement statistics connect that scale to something observable. Their meeting makes a prediction possible without a calculation of every collision. Agreement between simulations of those premises can check their implementation; it does not add a separate observation of a suspension. {#shared-premises}

For a comparison with measured trajectories, list the inputs each route receives and the assumptions they share. Then ask which inputs could change together if a calibration or model assumption failed. A discrepancy may identify a useful question about drag, concentration, drift, observation intervals or measurement error. Agreement becomes informative in proportion to how well those possible dependencies have been understood. {#use-agreement-carefully}
