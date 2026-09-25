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
});
