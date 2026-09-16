/**
 * Avogadro's number and molecular weights from Planck's radiation constants (paper 1 §2, LQ-02).
 * Specification: am-ref-radiation-15c.
 */

import type { ConstantSet } from "../constants.ts";
import type { AvogadroReadout } from "./types.ts";

export const MODERN_AVOGADRO = 6.02214076e23;
export const MODERN_RECIPROCAL_GRAM = 1 / MODERN_AVOGADRO; // 1.6605390666010537e-24 g
export const MODERN_H1_ATOM_MASS_GRAMS = 1.6735328e-24; // AME 2020 1.00782503223 u
export const MODERN_BOLTZMANN = 1.380649e-23;

export function avogadroFromPlanckConstants(set?: ConstantSet): AvogadroReadout {
  // If no set or modern set is passed, compute with standard historical 1905 CGS inputs or set entries
  let alpha = 6.1e-57;
  let beta = 4.866e-11;
  let R_cgs = 8.31e7;
  let L_cgs = 3e10;

  let alphaStatus = "printed-corrected";
  let alphaReason = "Corrected witness exponent from 10^-56 to 10^-57.";
  let rStatus = "editorial-input";
  let rReason = "Einstein did not print R in §2; standard 1905 value R = 8.31e7 erg/(mol K).";
  let rSensitivity = "Linear in R.";
  let lStatus = "editorial-input";
  let lReason = "Speed of light rounded to 3e10 cm/s in 1905 text.";
  let lSensitivity = "Inverse cubic in L.";

  if (set) {
    if (set.id === "planck-1900-1901-printed") {
      // Planck's own 1900-1901 printed readout
      return {
        status: "value",
        avogadroConstant: 6.175e23,
        printedAvogadroConstant: 6.175e23,
        hydrogenAtomMassGrams: 1 / 6.175e23,
        printedHydrogenAtomMassGrams: 1.62e-24,
        unroundedHydrogenAtomMassGrams: 1 / 6.175e23,
        rOverN: 8.31e7 / 6.175e23,
        printedROverN: 8.31e7 / 6.175e23,
        unroundedROverN: 8.31e7 / 6.175e23,
        markers: {
          avogadroConstant: { printedStatus: "printed", reason: "Planck 1900-1901 printed value." },
        },
        modernComparisons: {
          modernAvogadro: MODERN_AVOGADRO,
          modernReciprocalGram: MODERN_RECIPROCAL_GRAM,
          modernHydrogenAtomMassGrams: MODERN_H1_ATOM_MASS_GRAMS,
          modernBoltzmannConstant: MODERN_BOLTZMANN,
        },
      };
    }

    // Check if set has entries for alpha, beta, R, L
    const alphaEntry = set.entries.find((e) => e.quantityId === "wienConstantAlpha");
    if (alphaEntry) {
      alpha = alphaEntry.value;
      if (alphaEntry.printedStatus) alphaStatus = alphaEntry.printedStatus;
      if (alphaEntry.reason) alphaReason = alphaEntry.reason;
    }
    const betaEntry = set.entries.find((e) => e.quantityId === "wienConstantBeta");
    if (betaEntry) {
      beta = betaEntry.value;
    }
    const rEntry = set.entries.find((e) => e.quantityId === "molarGasConstant");
    if (rEntry) {
      // If R is in SI (8.31), convert to CGS erg/(mol K)
      R_cgs = rEntry.value < 100 ? rEntry.value * 1e7 : rEntry.value;
      if (rEntry.printedStatus) rStatus = rEntry.printedStatus;
      if (rEntry.reason) rReason = rEntry.reason;
      if (rEntry.sensitivity) rSensitivity = rEntry.sensitivity;
    }
    const lEntry = set.entries.find((e) => e.quantityId === "speedOfLight");
    if (lEntry) {
      L_cgs = lEntry.value < 1e9 ? lEntry.value * 100 : lEntry.value;
      if (lEntry.printedStatus) lStatus = lEntry.printedStatus;
      if (lEntry.reason) lReason = lEntry.reason;
      if (lEntry.sensitivity) lSensitivity = lEntry.sensitivity;
    }
  }

  // N = (beta / alpha) * (8 * pi * R / L^3)
  const N_unrounded = (beta / alpha) * ((8 * Math.PI * R_cgs) / L_cgs ** 3);
  const N_printed = 6.17e23;

  const hMass_from_printed_N = 1 / N_printed; // 1.62074554e-24 g
  const hMass_printed = 1.62e-24;
  const hMass_unrounded = 1 / N_unrounded; // 1.62061805e-24 g

  const rOverN_from_printed_N = R_cgs / N_printed; // 1.34683955e-16 erg/K
  const rOverN_unrounded = R_cgs / N_unrounded; // 1.34673347e-16 erg/K

  return {
    status: "value",
    avogadroConstant: N_unrounded,
    printedAvogadroConstant: N_printed,
    hydrogenAtomMassGrams: hMass_from_printed_N,
    printedHydrogenAtomMassGrams: hMass_printed,
    unroundedHydrogenAtomMassGrams: hMass_unrounded,
    rOverN: rOverN_from_printed_N,
    printedROverN: rOverN_from_printed_N,
    unroundedROverN: rOverN_unrounded,
    markers: {
      wienConstantAlpha: { printedStatus: alphaStatus, reason: alphaReason },
      molarGasConstant: { printedStatus: rStatus, reason: rReason, sensitivity: rSensitivity },
      speedOfLight: { printedStatus: lStatus, reason: lReason, sensitivity: lSensitivity },
    },
    modernComparisons: {
      modernAvogadro: MODERN_AVOGADRO,
      modernReciprocalGram: MODERN_RECIPROCAL_GRAM,
      modernHydrogenAtomMassGrams: MODERN_H1_ATOM_MASS_GRAMS,
      modernBoltzmannConstant: MODERN_BOLTZMANN,
    },
  };
}
