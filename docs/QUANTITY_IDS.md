# Quantity IDs

Generated from `content/quantities/*.yaml` by `scripts/generate-quantity-ids.ts`. Do not hand-edit; run `bun scripts/generate-quantity-ids.ts` to regenerate, and `--check` in CI to confirm this file is fresh.

Total: 304 quantities, 45 rejected spellings, 0 reserved spellings.

## Registered quantities

| id | name | dimension | frame | mathematicalKind | legacy spellings |
|---|---|---|---|---|---|
| absorbedLightEnergy | Absorbed light energy | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| absorbedQuantumRate | Absorbed quantum rate | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| acceleratingPotential | Accelerating potential | 2,1,-3,0,-1,0 | not-applicable | scalar | acceleratingVoltage |
| accelerationLongitudinalLaboratory | Longitudinal acceleration (laboratory) | 1,0,-2,0,0,0 | laboratory | scalar | — |
| accelerationTransverseLaboratory | Transverse acceleration (laboratory) | 1,0,-2,0,0,0 | laboratory | scalar | — |
| additiveEnergyConstant | Additive energy constant | 2,1,-2,0,0,0 | not-applicable | scalar | additiveConstant |
| angularFrequency | Angular frequency | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| angularWavenumber | Angular wavenumber | -1,0,0,0,0,0 | not-applicable | scalar | — |
| ansatzSpatialScale | Modern ansatz spatial scale: a(v) | 0,0,0,0,0,0 | not-applicable | scalar | — |
| ansatzTimeScale | Modern ansatz time scale: b(v) | 0,0,0,0,0,0 | not-applicable | scalar | — |
| ansatzTimeSpaceCoefficient | Modern ansatz time-space coefficient: d(v) | -1,0,1,0,0,0 | not-applicable | scalar | — |
| ansatzTransverseScale | Modern ansatz transverse scale | 0,0,0,0,0,0 | not-applicable | scalar | — |
| apparentSpeed | Apparent speed | 1,0,-1,0,0,0 | not-applicable | scalar | — |
| apparentSpeedRatio | Apparent speed ratio | 0,0,0,0,0,0 | not-applicable | scalar | — |
| approachingDopplerFactor | Approaching line-of-sight Doppler factor | 0,0,0,0,0,0 | not-applicable | scalar | — |
| auxiliaryGalileanCoordinate | Auxiliary Galilean coordinate: x' | 1,0,0,0,0,0 | not-applicable | scalar | — |
| avogadroConstant | Avogadro's constant | 0,0,0,0,0,-1 | not-applicable | scalar | avogadroNumber, moleculesPerMole |
| avogadroNumberEstimate | Avogadro number estimate | 0,0,0,0,0,-1 | not-applicable | scalar | avogadroNumber, molecularNumberEstimate, moleculesPerMole |
| bandEnergy | Band-integrated radiation energy | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| bandwidth | Bandwidth | 0,0,-1,0,0,0 | not-applicable | scalar | frequencyBandWidth |
| beamPower | Power of a beam | 2,1,-3,0,0,0 | not-applicable | scalar | — |
| bodyEnergyMovingAfter | Body energy after emission (moving system) | 2,1,-2,0,0,0 | moving-system | scalar | — |
| bodyEnergyMovingBefore | Body energy before emission (moving system) | 2,1,-2,0,0,0 | moving-system | scalar | — |
| bodyEnergyRestAfter | Body energy after emission (stationary system) | 2,1,-2,0,0,0 | stationary-system | scalar | — |
| bodyEnergyRestBefore | Body energy before emission (stationary system) | 2,1,-2,0,0,0 | stationary-system | scalar | — |
| bodyKineticEnergy | Kinetic energy of a body | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| bodyMass | Mass of a body | 0,1,0,0,0,0 | not-applicable | scalar | — |
| bodyMassAfter | Body mass after emission | 0,1,0,0,0,0 | not-applicable | scalar | — |
| bodyMassBefore | Body mass before emission | 0,1,0,0,0,0 | not-applicable | scalar | — |
| bodySpeed | Speed of a body | 1,0,-1,0,0,0 | not-applicable | scalar | — |
| boltzmannConstant | Boltzmann's constant | 2,1,-2,-1,0,0 | not-applicable | scalar | — |
| boxLength | Box length | 1,0,0,0,0,0 | not-applicable | scalar | — |
| boxMass | Box mass | 0,1,0,0,0,0 | not-applicable | scalar | — |
| centerOfMassShift | Center-of-mass shift | 1,0,0,0,0,0 | not-applicable | scalar | comShift |
| chargeDensityMoving | Charge density (moving system) | -3,0,1,0,1,0 | moving-system | scalar | chargeDensity |
| chargeDensityStationary | Charge density (stationary system) | -3,0,1,0,1,0 | stationary-system | scalar | chargeDensity |
| chargeToMassRatio | Charge-to-mass ratio | 0,-1,1,0,1,0 | not-applicable | scalar | — |
| chargeVelocityMoving | Charge velocity (moving system) | 1,0,-1,0,0,0 | moving-system | vector | — |
| chargeVelocityStationary | Charge velocity (stationary system) | 1,0,-1,0,0,0 | stationary-system | vector | — |
| classicalObserverDopplerFactor | Classical observer Doppler factor | 0,0,0,0,0,0 | not-applicable | scalar | — |
| classicalSourceDopplerFactor | Classical source Doppler factor | 0,0,0,0,0,0 | not-applicable | scalar | — |
| clockOffset | Clock offset | 0,0,1,0,0,0 | not-applicable | scalar | — |
| clockSpeedStationary | Speed of a transported clock (stationary system) | 1,0,-1,0,0,0 | stationary-system | scalar | — |
| collectorPotential | Collector potential | 2,1,-3,0,-1,0 | not-applicable | scalar | — |
| columnLength | Column length | 1,0,0,0,0,0 | not-applicable | scalar | — |
| configurationIntegral | Configuration integral | symbolic | not-applicable | scalar | — |
| configurationIntegralFactor | Configuration integral factor | symbolic | not-applicable | scalar | — |
| configurationProbability | Configuration probability | 0,0,0,0,0,0 | not-applicable | scalar | independentPointsProbability, multiplicity, statisticalProbability |
| conversionYield | Fluorescent conversion yield | 0,0,0,0,0,0 | not-applicable | scalar | — |
| coordinatePositionMoving | Coordinate position (moving system) | 1,0,0,0,0,0 | moving-system | vector | — |
| coordinatePositionStationary | Coordinate position (stationary system) | 1,0,0,0,0,0 | stationary-system | vector | — |
| coordinateTimeMoving | Coordinate time (moving system) | 0,0,1,0,0,0 | moving-system | scalar | coordinateTime |
| coordinateTimeStationary | Coordinate time (stationary system) | 0,0,1,0,0,0 | stationary-system | scalar | coordinateTime |
| currentDensityMoving | Current density (moving system) | -2,0,0,0,1,0 | moving-system | vector | currentDensity |
| currentDensityStationary | Current density (stationary system) | -2,0,0,0,1,0 | stationary-system | vector | currentDensity |
| diffusionCoefficient | Diffusion coefficient | 2,0,-1,0,0,0 | not-applicable | scalar | — |
| diffusionFlux | Diffusion flux | -2,0,-1,0,0,0 | not-applicable | scalar | — |
| diffusionFluxComponent | Diffusion flux component | -2,0,-1,0,0,0 | not-applicable | vector-component | — |
| directionCosineMoving | Direction cosine (moving system) | 0,0,0,0,0,0 | moving-system | vector | directionCosineMotion |
| directionCosineStationary | Direction cosine (stationary system) | 0,0,0,0,0,0 | stationary-system | vector | directionCosineMotion |
| displacement1d | Displacement since start (one dimension) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| displacementIncrement | Displacement increment | 1,0,0,0,0,0 | not-applicable | scalar | — |
| displacementVariance1d | Displacement variance (one dimension) | 2,0,0,0,0,0 | not-applicable | scalar | — |
| distanceFromSource | Distance from the source | 1,0,0,0,0,0 | not-applicable | scalar | — |
| dopplerFactor | Doppler factor | 0,0,0,0,0,0 | not-applicable | scalar | — |
| dragCoefficient | Drag coefficient | 0,0,0,0,0,0 | not-applicable | scalar | — |
| dragForce | Drag force | 1,1,-2,0,0,0 | not-applicable | scalar | — |
| driftFlux | Drift flux | -2,0,-1,0,0,0 | not-applicable | scalar | — |
| driftFluxComponent | Drift flux component | -2,0,-1,0,0,0 | not-applicable | vector-component | — |
| driftVelocity | Drift velocity | 1,0,-1,0,0,0 | not-applicable | scalar | — |
| effectiveIndependentCount | Effective independent count | 0,0,0,0,0,0 | not-applicable | scalar | — |
| effectiveViscosity | Effective viscosity | -1,1,-1,0,0,0 | not-applicable | scalar | — |
| elapsedTime | Elapsed time | 0,0,1,0,0,0 | not-applicable | scalar | — |
| electricDeflectability | Electric deflectability | undefined in source | not-applicable | scalar | — |
| electricFieldAmplitudeStationary | Electric field amplitude (stationary system) | 1,1,-3,0,-1,0 | stationary-system | vector | — |
| electricFieldMoving | Electric field (moving system) | 1,1,-3,0,-1,0 | moving-system | vector | electricField |
| electricFieldStationary | Electric field (stationary system) | 1,1,-3,0,-1,0 | stationary-system | vector | electricField |
| electromotiveForceConductorFrame | Electromotive force (conductor rest) | 2,1,-3,0,-1,0 | moving-system | scalar | — |
| electromotiveForceExcess | Electromotive-force excess over unity | 0,0,0,0,0,0 | not-applicable | scalar | — |
| electromotiveForceMagnetFrame | Electromotive force (magnet rest) | 2,1,-3,0,-1,0 | stationary-system | scalar | — |
| electronCharge | Electron charge | 0,0,1,0,1,0 | not-applicable | scalar | — |
| electronMass | Electron mass | 0,1,0,0,0,0 | not-applicable | scalar | — |
| electronSpeedStationary | Electron speed during its acceleration (stationary system) | 1,0,-1,0,0,0 | stationary-system | scalar | — |
| electronWork | Electron work | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| elementaryCharge | Elementary charge | 0,0,1,0,1,0 | not-applicable | scalar | — |
| emissionAngle | Emission angle | 0,0,0,0,0,0 | not-applicable | scalar | — |
| emissionRate | Photoelectron emission rate | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| emittedEnergyRestFrame | Emitted energy (object rest frame) | 2,1,-2,0,0,0 | object-rest | scalar | emittedEnergyRest |
| emittedFrequency | Emitted frequency | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| emittedQuantumRate | Fluorescent emitted quantum rate | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| endpointSimultaneityOffset | Endpoint simultaneity offset | 0,0,1,0,0,0 | not-applicable | scalar | — |
| energyDensityBelowCutoff | Energy density below a cutoff frequency | -1,1,-2,0,0,0 | not-applicable | scalar | — |
| entropy | Entropy | 2,1,-2,-1,0,0 | not-applicable | scalar | entropyDifference, entropyFunctionOfProbability |
| entropyDensityConstant | Integration constant of the spectral entropy density | -1,1,-1,-1,0,0 | not-applicable | scalar | — |
| entropyFromUnfixedConstant | Entropy an unfixed constant would add | 2,1,-2,-1,0,0 | not-applicable | scalar | — |
| entropyVolumeCoefficient | Entropy-volume coefficient | 2,1,-2,-1,0,0 | not-applicable | scalar | entropyCoefficient |
| eventSeparationSpatial | Spatial event separation | 1,0,0,0,0,0 | not-applicable | scalar | — |
| eventSeparationTemporal | Temporal event separation | 0,0,1,0,0,0 | not-applicable | scalar | — |
| eventSeparationTemporalMoving | Temporal event separation (moving system) | 0,0,1,0,0,0 | moving-system | scalar | — |
| eventSeparationTemporalStationary | Temporal event separation (stationary system) | 0,0,1,0,0,0 | stationary-system | scalar | — |
| exposureTime | Exposure time | 0,0,1,0,0,0 | not-applicable | scalar | — |
| externalForcePerParticle | External force per particle | 1,1,-2,0,0,0 | not-applicable | scalar | externalForce |
| faradayConstant | Faraday constant | 0,0,1,0,1,-1 | not-applicable | scalar | — |
| fieldInvariantE2MinusC2B2 | Field invariant: E^2 - c^2 B^2 | 2,2,-6,0,-2,0 | not-applicable | scalar | — |
| fieldInvariantEDotB | Field invariant: E dot B | 1,2,-5,0,-2,0 | not-applicable | scalar | — |
| fieldScaleFactorUnknown | Unknown scale factor: psi(v) | 0,0,0,0,0,0 | not-applicable | scalar | — |
| fieldTimeCoordinate | Time coordinate (field) | 0,0,1,0,0,0 | not-applicable | scalar | — |
| finiteSpeedMassProxy | Finite-speed mass proxy | 0,1,0,0,0,0 | not-applicable | scalar | — |
| fourierAmplitude | Fourier amplitude | 1,1,-3,0,-1,0 | not-applicable | scalar | — |
| fourierPhase | Fourier phase | 0,0,0,0,0,0 | not-applicable | scalar | — |
| fourierValueProbability | Probability of the Fourier values | 0,0,0,0,0,0 | not-applicable | scalar | — |
| frameSpeed | Frame speed | 1,0,-1,0,0,0 | not-applicable | scalar | observerSpeed |
| freeEnergy | Free energy | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| frequency | Frequency | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| frequencyEnergyDensity | Frequency-basis spectral energy density | -1,1,-1,0,0,0 | not-applicable | scalar | — |
| fringeShift | Fringe shift | 0,0,0,0,0,0 | not-applicable | scalar | — |
| gasEntropyChange | Entropy change of a gas of independent points | 2,1,-2,-1,0,0 | not-applicable | scalar | — |
| genericBase | Any positive number | 0,0,0,0,0,0 | not-applicable | scalar | — |
| genericExponent | Any power | 0,0,0,0,0,0 | not-applicable | scalar | — |
| genericNumberA | Any number A | 0,0,0,0,0,0 | not-applicable | scalar | — |
| genericNumberB | Any number B | 0,0,0,0,0,0 | not-applicable | scalar | — |
| gramEquivalentCharge | Gram-equivalent charge | 0,0,1,0,1,-1 | not-applicable | scalar | — |
| gridSpacing | Grid spacing | 1,0,0,0,0,0 | not-applicable | scalar | — |
| hydrostaticHead | Hydrostatic head | 1,0,0,0,0,0 | not-applicable | scalar | — |
| incidentFrequency | Incident frequency | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| incidentPower | Incident radiant power | 2,1,-3,0,0,0 | not-applicable | scalar | — |
| independentPointCount | Independent point count | 0,0,0,0,0,0 | not-applicable | scalar | — |
| inducedCircuitCurrent | Induced circuit current | 0,0,0,0,1,0 | not-applicable | scalar | — |
| inertialMassDecrease | Inertial mass decrease | 0,1,0,0,0,0 | not-applicable | scalar | massLossCoefficient |
| intensity | Intensity | 0,1,-3,0,0,0 | not-applicable | scalar | — |
| interceptedPower | Intercepted power | 2,1,-3,0,0,0 | not-applicable | scalar | — |
| intervalProbability | Interval probability | 0,0,0,0,0,0 | not-applicable | scalar | — |
| invariantMassSystem | Invariant mass of a system | 0,1,0,0,0,0 | not-applicable | scalar | — |
| ionCount | Number of ionized molecules | 0,0,0,0,0,0 | not-applicable | scalar | — |
| ionizationEnergyPerMolecule | Ionization energy per molecule | 2,1,-2,0,0,0 | not-applicable | scalar | ionizationEnergy |
| ionizationRate | Ionization event rate | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| ionizationWorkPerGramEquivalent | Ionization work per gram-equivalent | 2,1,-2,0,0,-1 | not-applicable | scalar | — |
| ionizedGramMolecules | Ionized gram-molecules | 0,0,0,0,0,1 | not-applicable | scalar | — |
| kickDiffusivity | Kick diffusivity | 2,0,-1,0,0,0 | not-applicable | scalar | — |
| kineticDecayLength | Kinetic decay length | 1,0,0,0,0,0 | not-applicable | scalar | decayLength |
| kineticEnergy | Kinetic energy (electron) | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| kineticEnergyAfter | Body kinetic energy after emission (moving system) | 2,1,-2,0,0,0 | moving-system | scalar | — |
| kineticEnergyBefore | Body kinetic energy before emission (moving system) | 2,1,-2,0,0,0 | moving-system | scalar | — |
| kineticEnergyDifference | Body kinetic energy difference (moving system) | 2,1,-2,0,0,0 | moving-system | scalar | — |
| kolmogorovDistance | Kolmogorov distance | 0,0,0,0,0,0 | not-applicable | scalar | — |
| lagrangeMultiplier | Lagrange multiplier | 0,0,0,-1,0,0 | not-applicable | scalar | — |
| latentPosition1d | Latent position (one dimension) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| lengthMeasuredMoving | Measured length (moving system) | 1,0,0,0,0,0 | moving-system | scalar | — |
| lengthMeasuredStationary | Measured length (stationary system) | 1,0,0,0,0,0 | stationary-system | scalar | rodLengthMeasured |
| lengthProper | Proper length | 1,0,0,0,0,0 | object-rest | scalar | rodLengthRest |
| lightAmplitudeMoving | Light amplitude (moving system) | 1,1,-3,0,-1,0 | moving-system | scalar | lightAmplitude |
| lightAmplitudeReflectedMoving | Reflected light amplitude (moving system) | 1,1,-3,0,-1,0 | moving-system | scalar | — |
| lightAmplitudeReflectedStationary | Reflected light amplitude (stationary system) | 1,1,-3,0,-1,0 | stationary-system | scalar | — |
| lightAmplitudeStationary | Light amplitude (stationary system) | 1,1,-3,0,-1,0 | stationary-system | scalar | lightAmplitude |
| lightComplexEnergyMoving | Light complex energy (moving system) | 2,1,-2,0,0,0 | moving-system | scalar | lightComplexEnergy |
| lightComplexEnergyStationary | Light complex energy (stationary system) | 2,1,-2,0,0,0 | stationary-system | scalar | lightComplexEnergy |
| lightComplexVolumeMoving | Light complex volume (moving system) | 3,0,0,0,0,0 | moving-system | scalar | lightComplexVolume |
| lightComplexVolumeStationary | Light complex volume (stationary system) | 3,0,0,0,0,0 | stationary-system | scalar | lightComplexVolume |
| lightEnergyDensityMoving | Light energy density (moving system) | -1,1,-2,0,0,0 | moving-system | scalar | — |
| lightEnergyDensityStationary | Light energy density (stationary system) | -1,1,-2,0,0,0 | stationary-system | scalar | — |
| lightMassAssigned | Mass assigned to transported light energy | 0,1,0,0,0,0 | not-applicable | scalar | — |
| lightSphereRadius | Light-sphere radius | 1,0,0,0,0,0 | not-applicable | scalar | — |
| localizationErrorStd | Localization error (standard deviation) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| logIntervalEnergyDensity | Log-interval spectral energy density | -1,1,-2,0,0,0 | not-applicable | scalar | — |
| longAveragingInterval | Long averaging interval | 0,0,1,0,0,0 | not-applicable | scalar | — |
| longitudinalForce | Longitudinal force | 1,1,-2,0,0,0 | not-applicable | vector | — |
| longitudinalMass | Longitudinal mass | 0,1,0,0,0,0 | not-applicable | scalar | longitudinalMassSource, massCoefficientLongitudinal |
| lorentzFactor | Lorentz factor | 0,0,0,0,0,0 | not-applicable | scalar | — |
| magneticDeflectability | Magnetic deflectability | undefined in source | not-applicable | scalar | — |
| magneticDipoleMoment | Magnetic dipole moment | 2,0,0,0,1,0 | not-applicable | vector | — |
| magneticFieldAmplitudeStationary | Magnetic field amplitude (stationary system) | 0,1,-2,0,-1,0 | stationary-system | vector | — |
| magneticFieldMoving | Magnetic field (moving system) | 0,1,-2,0,-1,0 | moving-system | vector | magneticField |
| magneticFieldStationary | Magnetic field (stationary system) | 0,1,-2,0,-1,0 | stationary-system | vector | magneticField |
| massChangeSigned | Signed mass change | 0,1,0,0,0,0 | not-applicable | scalar | — |
| maxKineticEnergy | Maximum photoelectron kinetic energy | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| maxProbabilityDifference | Maximum probability difference | 0,0,0,0,0,0 | not-applicable | scalar | — |
| meanDisplacement1d | Mean displacement (one dimension) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| meanQuantumEnergyWien | Mean quantum energy over a Wien spectrum | 2,1,-2,0,0,0 | not-applicable | scalar | meanQuantumEnergy |
| meanResonatorEnergy | Mean resonator energy | 2,1,-2,0,0,0 | not-applicable | scalar | meanOscillatorEnergy |
| meanResonatorEnergyAtFrequency | Mean resonator energy at a given frequency | 2,1,-2,0,0,0 | not-applicable | scalar | resonatorMeanEnergyAtFrequency |
| meanSquareDisplacement1d | Mean-square displacement (one dimension) | 2,0,0,0,0,0 | not-applicable | scalar | — |
| measuredPosition1d | Measured position (one dimension) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| microstateEnergy | Microstate energy | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| mirrorSpeed | Mirror speed | 1,0,-1,0,0,0 | not-applicable | scalar | — |
| mobility | Mobility | 0,-1,1,0,0,0 | not-applicable | scalar | — |
| molarGasConstant | Molar gas constant | 2,1,-2,-1,0,-1 | not-applicable | scalar | gasConstant |
| molesPerVolume | Moles per volume | -3,0,0,0,0,1 | not-applicable | scalar | — |
| naiveGammaMinusOne | Naive Lorentz-factor excess | 0,0,0,0,0,0 | not-applicable | scalar | — |
| numberDensity | Number density | -3,0,0,0,0,0 | not-applicable | scalar | — |
| observationInterval | Observation interval | 0,0,1,0,0,0 | not-applicable | scalar | — |
| osmoticDecayLength | Osmotic decay length | 1,0,0,0,0,0 | not-applicable | scalar | decayLength |
| osmoticPressure | Osmotic pressure | -1,1,-2,0,0,0 | not-applicable | scalar | — |
| particleChargeMagnitude | Size of a particle's charge | 0,0,1,0,1,0 | not-applicable | scalar | — |
| particleCount | Particle count | 0,0,0,0,0,0 | not-applicable | scalar | — |
| particleFlux | Particle flux | -2,0,-1,0,0,0 | not-applicable | scalar | — |
| particleMass | Particle mass | 0,1,0,0,0,0 | not-applicable | scalar | — |
| particleRadius | Particle radius | 1,0,0,0,0,0 | not-applicable | scalar | — |
| particleVelocity | Particle velocity (laboratory) | 1,0,-1,0,0,0 | laboratory | vector | — |
| partitionForce | Partition force | 1,1,-2,0,0,0 | not-applicable | scalar | — |
| pathBoostParallelComponent | Path boost-parallel component | 0,0,0,0,0,0 | not-applicable | scalar | — |
| peakFrequency | Peak frequency | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| peakWavelength | Peak wavelength | 1,0,0,0,0,0 | not-applicable | scalar | — |
| photocurrent | Photocurrent | 0,0,0,0,1,0 | not-applicable | scalar | — |
| photoelectricInterceptPotential | Photoelectric intercept potential | 2,1,-3,0,-1,0 | not-applicable | scalar | — |
| planckChargeQuotient | Planck constant over elementary charge (h/e) | 2,1,-2,0,-1,0 | not-applicable | scalar | — |
| planckChargeQuotientEstimate | Estimate of h/e from a photoelectric slope | 2,1,-2,0,-1,0 | not-applicable | scalar | — |
| planckConstant | Planck's constant | 2,1,-1,0,0,0 | not-applicable | scalar | — |
| positionCoordinate1d | Position coordinate (field, one dimension) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| pressure | Gas pressure | -1,1,-2,0,0,0 | not-applicable | scalar | — |
| probabilityDensity | Probability density (one-dimensional) | -1,0,0,0,0,0 | not-applicable | scalar | — |
| probabilityFlux1d | Probability flux (one dimension) | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| propagationAngleMoving | Propagation angle (moving system) | 0,0,0,0,0,0 | moving-system | scalar | propagationAngle |
| propagationAngleReflectedMoving | Reflected propagation angle (moving system) | 0,0,0,0,0,0 | moving-system | scalar | — |
| propagationAngleReflectedStationary | Reflected propagation angle (stationary system) | 0,0,0,0,0,0 | stationary-system | scalar | — |
| propagationAngleStationary | Propagation angle (stationary system) | 0,0,0,0,0,0 | stationary-system | scalar | propagationAngle |
| properTimeElapsed | Elapsed proper time | 0,0,1,0,0,0 | object-rest | scalar | properTime |
| proxyExcessOverLimit | Proxy excess over the limiting coefficient | 0,0,0,0,0,0 | not-applicable | scalar | — |
| pulseFlightTime | Pulse flight time | 0,0,1,0,0,0 | not-applicable | scalar | — |
| pulseMomentum | Pulse momentum | 1,1,-1,0,0,0 | not-applicable | scalar | — |
| quadraticKineticDifference | Quadratic kinetic-energy approximation | 2,1,-2,0,0,0 | moving-system | scalar | — |
| quadraticRelativeDiscrepancy | Quadratic relative discrepancy | 0,0,0,0,0,0 | not-applicable | scalar | — |
| quantumEfficiency | Quantum efficiency | 0,0,0,0,0,0 | not-applicable | scalar | — |
| quantumEnergy | Quantum energy | 2,1,-2,0,0,0 | not-applicable | scalar | meanQuantumEnergy |
| quantumRate | Incident quantum rate | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| radialDistance2d | Radial distance (two dimensions) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| radiationElectricField | Radiation electric field | 1,1,-3,0,-1,0 | not-applicable | vector | electricForceComponentZ |
| radiationEnergy | Radiation energy | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| radiationEntropy | Radiation entropy | 2,1,-2,-1,0,0 | not-applicable | scalar | entropyDifference |
| radiationEntropyChange | Entropy change of dilute radiation | 2,1,-2,-1,0,0 | not-applicable | scalar | — |
| radiationForce | Radiation force | 1,1,-2,0,0,0 | not-applicable | vector | — |
| radiationForceAbsorbed | Push of light on an absorbing surface | 1,1,-2,0,0,0 | not-applicable | scalar | — |
| radiationForceReflected | Push of light on a mirror | 1,1,-2,0,0,0 | not-applicable | scalar | — |
| radiationPressureMirror | Radiation pressure on a mirror | -1,1,-2,0,0,0 | not-applicable | scalar | — |
| radiusCurvatureElectric | Radius of curvature (electric deflection) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| radiusCurvatureMagnetic | Radius of curvature (magnetic deflection) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| rapidity | Rapidity | 0,0,0,0,0,0 | not-applicable | scalar | — |
| recedingDopplerFactor | Receding line-of-sight Doppler factor | 0,0,0,0,0,0 | not-applicable | scalar | — |
| recoilSpeed | Recoil speed | 1,0,-1,0,0,0 | not-applicable | scalar | — |
| reflectedFrequencyRatio | Reflected frequency ratio | 0,0,0,0,0,0 | not-applicable | scalar | — |
| relativeSpectralEmission | Relative spectral emission | 0,0,0,0,0,0 | not-applicable | scalar | — |
| relativeViscosity | Relative viscosity | 0,0,0,0,0,0 | not-applicable | scalar | viscosityRatio |
| rmsDisplacement1d | RMS displacement (one dimension) | 1,0,0,0,0,0 | not-applicable | scalar | — |
| sampleSize | Number of values in a sample | 0,0,0,0,0,0 | not-applicable | scalar | — |
| scaleFactorUnknown | Unknown scale factor: phi(v) | 0,0,0,0,0,0 | not-applicable | scalar | — |
| scaledDisplacement | Scaled displacement | 0,0,0,0,0,0 | not-applicable | scalar | — |
| signalDepartureTimeA | Signal departure time at A | 0,0,1,0,0,0 | stationary-system | scalar | — |
| signalReflectionTimeB | Signal reflection time at B | 0,0,1,0,0,0 | stationary-system | scalar | — |
| signalReturnTimeA | Signal return time at A | 0,0,1,0,0,0 | stationary-system | scalar | — |
| soluteAmount | Solute amount | 0,0,0,0,0,1 | not-applicable | scalar | — |
| sourcePower | Power of the source | 2,1,-3,0,0,0 | not-applicable | scalar | — |
| spacetimeIntervalSquared | Squared spacetime interval | 2,0,0,0,0,0 | frame-independent | scalar | intervalSquared |
| spectralEntropyDensity | Spectral entropy density | -1,1,-1,-1,0,0 | not-applicable | scalar | — |
| speedDeficitFromLight | Speed deficit from light speed: kappa, lambda | 1,0,-1,0,0,0 | not-applicable | scalar | — |
| speedOfLight | Speed of light | 1,0,-1,0,0,0 | not-applicable | scalar | lightSpeed |
| speedOfLightSquared | Speed of light squared, as a printed factor | 2,0,-2,0,0,0 | not-applicable | scalar | — |
| speedRatio | Speed ratio | 0,0,0,0,0,0 | not-applicable | scalar | — |
| sphereRadius | Sphere radius | 1,0,0,0,0,0 | not-applicable | scalar | — |
| stabilityRatio | Stability ratio | 0,0,0,0,0,0 | not-applicable | scalar | — |
| stateVariable | State variable | symbolic | not-applicable | scalar | — |
| stateVariableRate | State variable rate | symbolic | not-applicable | scalar | — |
| stepInterval | Step interval | 0,0,1,0,0,0 | not-applicable | scalar | — |
| stepRms | Step RMS | 1,0,0,0,0,0 | not-applicable | scalar | — |
| stoppingPotentialMagnitude | Stopping potential magnitude | 2,1,-3,0,-1,0 | not-applicable | scalar | — |
| suspensionViscosityCoefficient | Suspension viscosity coefficient | 0,0,0,0,0,0 | not-applicable | scalar | — |
| systemEnergy | System energy | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| temperature | Temperature | 0,0,0,1,0,0 | not-applicable | scalar | — |
| thresholdFrequency | Threshold frequency | 0,0,-1,0,0,0 | not-applicable | scalar | — |
| timeIncrement | Time increment | 0,0,1,0,0,0 | not-applicable | scalar | — |
| timeStep | Time step | 0,0,1,0,0,0 | not-applicable | scalar | — |
| transformationCoefficientA | Transformation coefficient: a | 0,0,0,0,0,0 | not-applicable | scalar | — |
| transitionKernel | Transition kernel | -1,0,0,0,0,0 | not-applicable | scalar | — |
| transverseForceComoving | Transverse force (comoving) | 1,1,-2,0,0,0 | object-rest | vector | — |
| transverseForceLaboratory | Transverse force (laboratory) | 1,1,-2,0,0,0 | laboratory | vector | — |
| transverseMassComoving | Transverse mass (comoving) | 0,1,0,0,0,0 | object-rest | scalar | massCoefficientTransverseComoving, transverseMassSource |
| transverseMassLaboratory | Transverse mass (laboratory) | 0,1,0,0,0,0 | laboratory | scalar | transverseCoefficientLaboratory |
| universalEntropyConstant | Universal entropy constant | 2,1,-2,-1,0,0 | not-applicable | scalar | entropyCoefficient |
| vacuumPermeability | Vacuum magnetic permeability (mu_0) | 1,1,-2,0,-2,0 | not-applicable | scalar | — |
| vacuumPermittivity | Vacuum electric permittivity (epsilon_0) | -3,-1,4,0,2,0 | not-applicable | scalar | — |
| velocityComponentXMoving | Velocity along x (moving system) | 1,0,-1,0,0,0 | moving-system | scalar | — |
| velocityComponentXStationary | Velocity along x (stationary system) | 1,0,-1,0,0,0 | stationary-system | scalar | — |
| velocityComponentYMoving | Velocity along y (moving system) | 1,0,-1,0,0,0 | moving-system | scalar | — |
| velocityComponentYStationary | Velocity along y (stationary system) | 1,0,-1,0,0,0 | stationary-system | scalar | — |
| velocityComposed | Composed velocity (stationary system) | 1,0,-1,0,0,0 | stationary-system | vector | — |
| velocityDirectionAngle | Velocity direction angle: alpha | 0,0,0,0,0,0 | not-applicable | scalar | — |
| velocityInMovingFrame | Velocity in the moving frame | 1,0,-1,0,0,0 | moving-system | vector | — |
| viscosity | Dynamic viscosity | -1,1,-1,0,0,0 | not-applicable | scalar | — |
| volume | Volume | 3,0,0,0,0,0 | not-applicable | scalar | — |
| volumeFraction | Volume fraction | 0,0,0,0,0,0 | not-applicable | scalar | — |
| volumeRatio | Volume ratio | 0,0,0,0,0,0 | not-applicable | scalar | — |
| walkStepCount | Number of walk steps | 0,0,0,0,0,0 | not-applicable | scalar | — |
| waveAmplitude | Wave amplitude | 1,1,-3,0,-1,0 | not-applicable | scalar | — |
| waveAngularFrequencyMoving | Wave angular frequency (moving system) | 0,0,-1,0,0,0 | moving-system | scalar | — |
| waveAngularFrequencyStationary | Wave angular frequency (stationary system) | 0,0,-1,0,0,0 | stationary-system | scalar | — |
| waveFrequencyMoving | Wave frequency (moving system) | 0,0,-1,0,0,0 | moving-system | scalar | — |
| waveFrequencyReflectedMoving | Reflected light frequency (moving system) | 0,0,-1,0,0,0 | moving-system | scalar | — |
| waveFrequencyReflectedStationary | Reflected light frequency (stationary system) | 0,0,-1,0,0,0 | stationary-system | scalar | — |
| waveFrequencyStationary | Wave frequency (stationary system) | 0,0,-1,0,0,0 | stationary-system | scalar | — |
| wavePhase | Wave phase | 0,0,0,0,0,0 | frame-independent | scalar | — |
| wavelength | Wavelength | 1,0,0,0,0,0 | not-applicable | scalar | — |
| wavelengthEnergyDensity | Wavelength-basis spectral energy density | -2,1,-2,0,0,0 | not-applicable | scalar | — |
| wienConstantAlpha | Wien's constant: alpha | -1,1,2,0,0,0 | not-applicable | scalar | — |
| wienConstantBeta | Wien's constant: beta | 0,0,1,1,0,0 | not-applicable | scalar | — |
| workFunction | Work function | 2,1,-2,0,0,0 | not-applicable | scalar | — |
| workFunctionPerGramEquivalent | Work function per gram-equivalent | 2,1,-2,0,0,-1 | not-applicable | scalar | — |

## Reserved spellings

Reserved for a not-yet-authored record; `resolveQuantityId` reports these `unregistered`, never a plausible-looking binding.

_None._

## Representation fields

Declared data fields on a quantity's authored record, exempt from the legacy-spelling check because they name a representation of that same quantity, never a different one.

- `lnW` on `configurationProbability`
- `log10W` on `configurationProbability`
- `logFrequencyEnergyDensity` on `frequencyEnergyDensity`
- `log10FrequencyEnergyDensity` on `frequencyEnergyDensity`
- `logWavelengthEnergyDensity` on `wavelengthEnergyDensity`
- `log10WavelengthEnergyDensity` on `wavelengthEnergyDensity`
