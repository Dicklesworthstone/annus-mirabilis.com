# Question Bank: Brownian Motion (`brownian-motion`)

**Paper:** *Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen* (Ann. Phys. 17, 549–560, 1905)

---

## Route 1: `no-algebra`

1. **Restless Traces Comparison:** Two microscope tracer paths look equally restless, but one fluid is twice as viscous as the other; what quantitative comparison distinguishes their diffusion coefficients? Target anchor: `#s1-osmotic-pressure`.
2. **Mean vs. Mean Square Displacement:** If a million particles start at the origin and wander left and right with zero mean position, why does the root-mean-square displacement grow with time? Target anchor: `#s4-observable-movement`.
3. **Viscosity & Temperature Scaling:** If the liquid temperature is raised while the particle radius is doubled, what combination keeps the expected spread unchanged? Target anchor: `#s3-stokes-einstein-balance`.
4. **Distinguishing Simulation from Observation:** In the interactive Brownian simulator, which visual parameter represents the time interval tau between recorded positions rather than a collision interval? Target action: `bm-01:step-drag`.

---

## Route 2: `nonvisual`

1. **Auditory Particle Velocity:** When listening to the tracer coordinate sonification, how does the auditory pitch variance signal the diffusion coefficient D? Target action: `bm-01:sonification-variance`.
2. **Accessible Table of Stokes Drag:** In the nonvisual table of mechanical drag, which row displays the total resistance on a mole of suspended spheres? Target anchor: `#s3-mole-drag`.
3. **Screen Reader Density Profile:** When reviewing the spatial distribution table across coordinate bins, what shape confirms a Gaussian distribution? Target anchor: `#s5-gaussian-distribution`.
4. **Spoken Formula Notation:** In the spoken math equivalent for $\lambda_x = \sqrt{2Dt}$, which term represents the elapsed observation time? Target anchor: `#s4-formula-rms`.

---

## Route 3: `full-derivation`

1. **Taylor Expansion Cancellation:** In expanding $f(x, t+\tau) = \int f(x-\Delta, t)\phi(\Delta)d\Delta$, which symmetry premise makes the first-order spatial derivative term vanish? Target anchor: `#s4-taylor-derivation`.
2. **Stokes-Einstein Mobility Equality:** In equating dynamic osmotic equilibrium to Stokes mechanical drag, how does the Avogadro number N appear in the denominator of D? Target anchor: `#s3-mobility-equation`.
3. **Gaussian Propagator Normalization:** How is the normalization constant $(4\pi D t)^{-1/2}$ derived for the one-dimensional diffusion equation solution? Target anchor: `#s5-propagator-normalization`.
4. **Second Moment Integration:** What mathematical step converts the probability transition density $\phi(\Delta)$ into the macroscopic diffusion coefficient D? Target anchor: `#s4-second-moment`.

---

## Route 4: `low-cost-phone`

1. **Touch Tracer Scrubber:** Scrubbing the time slider on mobile view, how does the radius of the probability envelope change over time? Target action: `bm-05:time-scrubber`.
2. **Mobile Histogram Binning:** Interacting with the particle count histogram on a narrow screen, which button toggles between 1D coordinate displacement and 2D radial distance? Target action: `bm-06:histogram-toggle`.
3. **Responsive Formula View:** In the compact equation panel, what symbol is used for dynamic liquid viscosity? Target anchor: `#s3-viscosity-symbol`.
4. **Mobile Replay Grid:** When running the tracer ensemble on a low-power phone, how many simultaneous particles are rendered to maintain responsive frame timing? Target action: `bm-01:ensemble-render`.
