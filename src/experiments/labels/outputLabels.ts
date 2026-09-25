/**
 * A reader's name for each lab output that is not itself a registered quantity (dispatch 218).
 *
 * The model note names every output a laboratory publishes. An output whose id is a registered
 * quantity takes the registry's name (QUANTITY_LABELS, generated from content/quantities). The
 * rest were spelled out from their ids ("Kinetic energy Newtonian", "Plot sample MSD"): 240 of the
 * 339 output ids the live notes showed, measured on 2026-09-25.
 *
 * WHY A TABLE AND NOT THE REGISTRY. An output id is not a quantity id. Several outputs are an
 * already-registered quantity under another name: ME-03's `invariantMass` is the registered
 * `invariantMassSystem`, and its `massChange` is what `massChangeSigned` describes. Registering the
 * output ids would give one quantity two canonical ids, which the registry exists to prevent. Many
 * others are series, bins, counts and flags, which are not quantities at all. So this table names
 * the OUTPUT, as the lab publishes it; which registered quantity each output is remains the
 * experiment manifest's `quantityId`, and reconciling those bindings is separate, reviewed work.
 *
 * Client-safe: data only, imported by ModelNote. Keys are exact output ids.
 */

export const OUTPUT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  // ME-03, the system-boundary ledger (massEnergy.boundaryLedger) and the light's four-momentum.
  energyChange: "Energy change inside the boundary",
  massChange: "Mass change inside the boundary",
  radiationEnergyChange: "Energy carried by the radiation",
  radiationMassChange: "Mass change of the radiation alone",
  systemEnergyChange: "Energy change of body and radiation together",
  systemMassChange: "Mass change of body and radiation together",
  invariantMass: "Invariant mass of the emitted light",
  // ME-03's 1906 extension, the photon in a box (massEnergy.box).
  boxDisplacement: "Displacement of the box while the light crosses it",

  // Light quanta. Each label follows the words the lab's own page gives the same value.
  // LQ-01, the wave description (WaveDescriptionLab's value rows).
  centerIntensity: "Intensity at the centre, averaged",
  instantaneousCenterIntensity: "Intensity at the centre, this instant",
  selectedPositionIntensity: "Intensity at the probe",
  pathDifference: "Path difference at the probe",
  fringeVisibility: "Fringe visibility",
  fringeSpacing: "Distance between bright fringes",
  screenIntensity: "Intensity across the screen",
  pointSourceIntensity: "Intensity at distance r",
  shellPower: "Power through the whole sphere of radius r",
  smallAperturePower: "Power through a 1 cm² window",
  exactDiskPower: "Power through a 1 cm² disc, exact",
  relativeDifference: "Relative difference of the two powers",
  // LQ-03's regime report (radiation.spectra).
  regimeReport: "Where Wien's law and the classical law each hold",
  // LQ-04, the constrained-state comparison at the reference volume V₀ and the compared volume V.
  initialTemperature: "Temperature at the reference volume",
  finalTemperature: "Temperature at the compared volume",
  initialX: "x = βν/T at the reference volume",
  finalX: "x = βν/T at the compared volume",
  initialPointwiseDeviation: "Pointwise deviation of Wien's law at the reference volume",
  finalPointwiseDeviation: "Pointwise deviation of Wien's law at the compared volume",
  initialSpectralEntropyDensity: "Spectral entropy density at the reference volume",
  finalSpectralEntropyDensity: "Spectral entropy density at the compared volume",
  radiationEntropyNumeric: "Radiation entropy change, summed from the entropy densities",
  unfixedConstantDeltaS: "Entropy change with an unfixed constant C (a teaching comparison)",
  unfixedConstantExtraTerm: "Extra entropy term from an unfixed constant C",
  // LQ-05, n independent points in a subvolume.
  lnW: "Natural logarithm of the probability W",
  log10W: "Base-10 logarithm of the probability W",
  deltaSOverKb: "Dimensionless entropy change ΔS/k",
  sampleFraction: "Fraction of sampled trials with every point in V",
  successCount: "Sampled trials with every point in V",
  drawCountAfter: "Random draws used so far",
  expectedTrialsToOne: "Expected trials before one success",
  lockedProbability: "Probability for a cluster locked together, W = f",
  // LQ-06, the coefficient match (its value rows); quantumEnergyEv also serves LQ-09.
  quantumEnergyEv: "Energy of one quantum, hν",
  gasEntropy: "Gas: entropy change",
  gasEntropyVolumeCoefficient: "Gas: coefficient of ln(V/V₀)",
  meanQuantumEnergyWienEv: "Mean quantum energy over a Wien spectrum",
  moleculeMeanKineticEnergyEv: "Mean kinetic energy of a gas molecule",
  meanEnergyRatio: "Ratio of the mean quantum energy to a molecule's mean kinetic energy",
  ratioAt600THz: "hν at 600 THz over the mean quantum energy",
  correspondenceVerdict: "Whether the radiation and gas coefficients agree",
  // LQ-07, Stokes's rule as an energy budget, and the rates it implies.
  allowed: "Whether the energy budget allows the emission",
  nu2Max: "Maximum allowed emitted frequency",
  e1Ev: "Absorbed quantum energy",
  e2Ev: "Emitted quantum energy",
  eOtherEv: "Energy dissipated as heat, per quantum",
  energyDeficitEv: "Energy deficit",
  absorbedRate: "Quanta absorbed each second",
  emittedRate: "Quanta emitted each second",
  emittedPowerWatts: "Power emitted as light",
  dissipatedHeatWatts: "Power dissipated as heat",
  // LQ-09, ionization of a gas by light.
  absorptionEfficiency: "Share of the light absorbed",
  duration: "Exposure time",
  thresholdWavelengthNm: "Threshold wavelength, below which one quantum can ionize",
  excessEnergyEv: "Energy left over, hν − J (negative when short)",
  singleQuantumAllowed: "Whether one quantum can ionize a molecule",
  ionizationCount: "Molecules ionized during the exposure",

  // Relativity. K is the stationary system and k the moving one, as the paper names them; each
  // label follows the words the lab's page gives the value where it gives any.
  // SR-01, clock synchronization and the rod chase (ClockSyncLab's list).
  assignedRemoteTime: "Assigned remote time (stated procedure)",
  roundTripSpeed: "Round-trip speed of light",
  criterionOffset: "Criterion check (declared clock B)",
  chaseOutboundLeg: "Rod chase, outbound leg (section 2)",
  chaseReturnLeg: "Rod chase, return leg (section 2)",
  desynchronization: "Desynchronization of the moving pair (platform frame)",
  oneWayLightSpeed: "One-way speed of light (by convention)",
  // SR-03, the rod and its simultaneity (the lab's own value labels, in general form).
  spatialSeparationK: "Distance between the two readings in K",
  temporalSeparationK: "Time between the two readings in K",
  spatialSeparationKPrime: "Distance between the two readings in k",
  temporalSeparationKPrime: "Time between the two readings in k",
  simultaneityK: "Whether K counts the two readings simultaneous",
  simultaneityKPrime: "Whether k counts the two readings simultaneous",
  measuredLength: "Distance between the two readings in the measuring frame",
  rodLengthK: "The rod's length in K, its ends read at one time of K",
  rodLengthKPrime: "The rod's length in k, its ends read at one time of k",
  readingsOnRodEnds: "Whether the two readings lie on the rod's ends",
  causalOrder: "Causal order of the two readings",
  gammaFactor: "Lorentz factor γ",
  ellipsoidAxisLongitudinal: "Semi-axis of the ellipsoid along the motion",
  ellipsoidAxisTransverseY: "Semi-axis of the ellipsoid across the motion (y)",
  ellipsoidAxisTransverseZ: "Semi-axis of the ellipsoid across the motion (z)",
  // SR-04, the candidate maps and the slow case.
  constraintFamily: "Status of the family of candidate maps",
  candidateResiduals: "How far the candidate map misses each constraint",
  slowCaseGalilean: "Galilean composed velocity (slow case)",
  slowCaseDeviation: "Relativistic minus Galilean velocity (slow case)",
  rightRayFraction: "Galilean speed of the rightward ray, as a fraction of c",
  leftRayFraction: "Galilean speed of the leftward ray, as a fraction of c",
  // SR-05, moving clocks (MovingClocksLab's rows).
  speed: "Clock speed (fraction of c)",
  coordinateDuration: "Coordinate duration",
  lightClockArm: "Length of the light clock's arm",
  frameOfDescription: "Speed of the frame of description (fraction of c)",
  properTime: "Proper time (τ)",
  coordinateTime: "Coordinate time (t)",
  dilationLossExact: "Exact loss per second",
  dilationLossPrintedSecondOrder: "Loss per second to second order, as the paper prints it",
  dilationLossDifference: "Exact minus printed loss per second",
  reunionExactLag: "Exact lag at reunion",
  reunionPrintedApproxLag: "Lag at reunion, the paper's approximation",
  reciprocalDilationFactor: "Dilation factor (γ)",
  lightClockProperTick: "Light-clock tick in the clock's own frame",
  lightClockCoordinateTick: "Light-clock tick in the frame of description",
  equatorFractionalRate: "Equator clock's fractional rate (illustrative)",
  equatorApproxNanosecondsPerDay: "Equator clock's lag per day in nanoseconds (illustrative)",
  dailyLossSpeedBeta: "Speed of a clock that loses one second per day (fraction of c)",
  // SR-06, the composition of velocities (VelocityCompositionLab's rows).
  composedUxOverC: "Composed velocity, x component over c",
  composedUyOverC: "Composed velocity, y component over c",
  composedSpeedOverC: "Composed speed over c",
  printedSpeedOverC: "Composed speed over c, by the printed section 5 formula",
  galileanSpeedOverC: "Galilean sum |v + w| over c",
  shortfall: "Shortfall from c, 1 − U/c",
  inverseUxOverC: "Inverse composition, x component over c",
  inverseUyOverC: "Inverse composition, y component over c",
  rotationDeg: "Wigner rotation (degrees)",
  composedGamma: "Lorentz factor of the composed velocity",
  productMatrix: "Product of the two boost matrices",
  rapidityFrame: "Rapidity of v, φ(v) (a later aid)",
  rapidityMoving: "Rapidity of w, φ(w) (a later aid)",
  rapiditySum: "Sum of the rapidities, φ(v) + φ(w) (a later aid)",
  fizeauIncrement: "Composition increment in a moving medium",
  fresnelIncrement: "Fresnel's first-order drag",
  // SR-07, Maxwell's equations for a plane wave in both systems (FieldEquationsLab's rows).
  residualMax: "Largest residual of the field equations",
  residualFaradayX: "Faraday residual, x component",
  residualFaradayY: "Faraday residual, y component",
  residualFaradayZ: "Faraday residual, z component",
  residualAmpereX: "Ampère-Maxwell residual, x component",
  residualAmpereY: "Ampère-Maxwell residual, y component",
  residualAmpereZ: "Ampère-Maxwell residual, z component",
  amplitudeFactor: "Amplitude factor γ(1 − β) for a +x wave",
  frequencyFactor: "Frequency factor",
  formInvariant: "Whether the equations keep their form in k",
  stepIndexOut: "Step reached in the derivation",
  // SR-08, the force on a charge in both systems.
  electricForceStationary: "Electric force on the charge (stationary system)",
  electricForceMoving: "Electric force on the charge (moving system)",
  magneticForceStationary: "Magnetic force on the charge (stationary system)",
  magneticForceMoving: "Magnetic force on the charge (moving system)",
  forceMovingFromFourForce: "Force in the moving system, from the four-force (a modern check)",
  forceTransformationResidual: "Residual of the force transformation (a modern check)",
  particleTimeJacobian: "dt′/dt along the particle",
  fieldInvariantEDotBMoving: "Field invariant E·B (moving system)",
  fieldInvariantE2MinusC2B2Moving: "Field invariant E² − c²B² (moving system)",
  // SR-10, the light complex (LightComplexLab's rows).
  energyDensityFactor: "Energy density ratio u′/u",
  volumeFactor: "Volume ratio V′/V (1/q)",
  materialVolumeFactor: "Material volume factor 1/γ",
  // SR-11, the moving mirror (MovingMirrorLab's rows).
  frequencyRatio: "Frequency ratio ν′′′/ν",
  cosPhiReflected: "Reflection cosine cos(φ′′′)",
  phiReflectedDeg: "Reflection angle φ′′′ (degrees)",
  amplitudeRatio: "Amplitude ratio A′′′/A",
  radiationPressure: "Radiation pressure on the mirror",
  reflectedPower: "Reflected power",
  workRate: "Work done on the mirror each second",
  energyBalanceResidual: "Energy balance residual",
  // SR-12, charge and current in both frames (ChargeCurrentLab's table rows, K and k its columns).
  fourCurrentInvariant: "Four-current invariant (cρ)² − |J|²",
  fourCurrentInvariantNormalized: "Four-current invariant (cρ)² − |J|², normalized",
  continuityResidualStationary: "Continuity residual ∂ρ/∂t + div J in K",
  continuityResidualMoving: "Continuity residual ∂ρ/∂t + div J in k",
  loopLegChargePositive: "Charge on the loop's top leg (+x), in k",
  loopLegChargeNegative: "Charge on the loop's bottom leg (−x), in k",
  loopTotalCharge: "Total charge on the loop, in k",
  sphereTotalChargeStationary: "Total charge on the sphere, Q, in K",
  sphereTotalChargeMoving: "Total charge on the sphere, Q, in k",
  // SR-13, the electron: the Newtonian comparisons and the path.
  kineticEnergyNewtonian: "Kinetic energy (Newtonian)",
  acceleratingPotentialNewtonian: "Accelerating potential (Newtonian)",
  trajectoryPositions: "Positions along the electron's path",
});
