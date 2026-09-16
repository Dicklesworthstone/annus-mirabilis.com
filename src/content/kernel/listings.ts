import kernelListingsData from "../../generated/kernel-listings.json";
import type { KernelListing } from "./types.ts";

/**
 * Returns the verified KernelListing records for an instrument, including extracted
 * source text, source hashes, identifier bindings, equation references, and worked traces.
 *
 * Sourced from build-time verified extraction (src/generated/kernel-listings.json).
 */
export function getKernelListingsForInstrument(instrumentId: string): readonly KernelListing[] {
  const data = kernelListingsData as Record<string, readonly KernelListing[]>;
  return data[instrumentId] ?? [];
}
