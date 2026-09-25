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
});
