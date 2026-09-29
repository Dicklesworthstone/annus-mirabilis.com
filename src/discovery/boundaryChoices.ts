import { C_SI } from "../physics/reference/massEnergy.ts";

/**
 * The three boundaries /discover/mass-energy/ tells a reader to draw (dispatch 450).
 *
 * "In the ledger below one joule of light leaves a body: draw the boundary around the body alone,
 * around the light, or around both, and read the mass that goes with it." The laboratory below it
 * draws one at a time, which is what makes it a laboratory; the comparison the sentence asks for
 * is the three together, and that is what these describe.
 *
 * The wording of each boundary is the laboratory's own (BoundaryLedgerPlot's BOUNDARY_WORDS), so a
 * reader meets one vocabulary and not two.
 */
export const EMITTED_JOULES = 1;

/** The mass that energy is, from the owner's speed of light rather than a literal. */
export const massOf = (joules: number): number => joules / (C_SI * C_SI);

/** The mass of the emitted light, as the figure prints it: a multiple of 10⁻¹⁷ kg. */
export const PRINTED_MASS_MANTISSA = 1.11;
export const PRINTED_MASS_EXPONENT = -17;

export type BoundaryChoice = Readonly<{
  id: "body-alone" | "radiation" | "combined-isolated-system";
  inside: string;
  /** What the scale reads for that boundary: negative, positive, or no change at all. */
  change: -1 | 0 | 1;
  reading: string;
}>;

export const BOUNDARY_CHOICES: readonly BoundaryChoice[] = [
  {
    id: "body-alone",
    inside: "The body alone",
    change: -1,
    reading: "lighter by the mass of the light it sent away",
  },
  {
    id: "radiation",
    inside: "The radiation",
    change: 1,
    reading: "carries that same mass away with it",
  },
  {
    id: "combined-isolated-system",
    inside: "Both, as one isolated system",
    change: 0,
    reading: "unchanged, because nothing crossed the boundary",
  },
];
