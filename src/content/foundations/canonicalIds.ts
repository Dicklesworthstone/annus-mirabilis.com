/**
 * The frozen canonical id table for the foundation library, transcribed
 * verbatim from am-ep-foundations-z1e's "Canonical id table and partition"
 * section (36 nodes + 10 bridges = 46 ids, each with exactly one owning
 * bead). This module is the actual source of truth code can check against;
 * content/foundations/registry.yaml is derived from it and is expected to
 * match exactly on id/kind/ownerBead (registry.yaml additionally carries
 * `cluster`, `status`, and `plannedCallers`, which are this project's own
 * operational bookkeeping, not part of the epic's table).
 *
 * Only am-ep-foundations-z1e may change this file's entries (a new
 * foundation id, a re-owned id, or a corrected count must cite that epic's
 * own updated table). No other bead edits this list to make its own
 * registry entry agree with it.
 */

export type CanonicalFoundationKind = "node" | "bridge";

export type CanonicalFoundationEntry = Readonly<{
  id: string;
  kind: CanonicalFoundationKind;
  ownerBead: string;
}>;

export const CANONICAL_FOUNDATION_IDS: readonly CanonicalFoundationEntry[] = Object.freeze([
  ["foundation:quantities-units", "node", "am-found-quantities-magnitudes-igxe"],
  ["foundation:ratios-scaling", "node", "am-found-quantities-magnitudes-igxe"],
  ["foundation:orders-of-magnitude", "node", "am-found-quantities-magnitudes-igxe"],
  ["foundation:unit-system-1905", "node", "am-found-quantities-magnitudes-igxe"],
  ["foundation:functions-graphs", "node", "am-found-calculus-6agg"],
  ["foundation:derivatives", "node", "am-found-calculus-6agg"],
  ["foundation:partial-derivatives", "node", "am-found-calculus-6agg"],
  ["foundation:exponentials", "node", "am-found-calculus-6agg"],
  ["foundation:logarithms", "node", "am-found-calculus-6agg"],
  ["foundation:integration", "node", "am-bm-slice-foundations-f5z9"],
  ["foundation:taylor-expansion", "node", "am-bm-slice-foundations-f5z9"],
  ["foundation:probability-independence", "node", "am-bm-slice-foundations-f5z9"],
  ["foundation:distributions", "node", "am-bm-slice-foundations-f5z9"],
  ["foundation:mean-variance-rms", "node", "am-bm-slice-foundations-f5z9"],
  ["foundation:gaussian-distributions", "node", "am-bm-slice-foundations-f5z9"],
  ["foundation:flux-continuity", "node", "am-bm-slice-foundations-f5z9"],
  ["foundation:diffusion-equation", "node", "am-bm-slice-foundations-f5z9"],
  ["foundation:random-walks", "node", "am-bm-slice-foundations-f5z9"],
  ["foundation:error-inference", "node", "am-found-statistics-inference-pzqv"],
  ["foundation:two-measurements-two-unknowns", "node", "am-found-statistics-inference-pzqv"],
  ["foundation:viscosity-stokes-drag", "node", "am-found-transport-thermo-smv3"],
  ["foundation:free-energy-osmotic-pressure", "node", "am-found-transport-thermo-smv3"],
  ["foundation:work-energy", "node", "am-found-transport-thermo-smv3"],
  ["foundation:temperature-thermal-energy", "node", "am-found-transport-thermo-smv3"],
  ["foundation:entropy-multiplicity", "node", "am-found-transport-thermo-smv3"],
  ["foundation:entropy-temperature", "node", "am-found-transport-thermo-smv3"],
  ["foundation:vectors-components", "node", "am-found-linear-geometry-7w15"],
  ["foundation:matrices-linear-maps", "node", "am-found-linear-geometry-7w15"],
  ["foundation:dot-cross-products", "node", "am-found-linear-geometry-7w15"],
  ["foundation:hyperbolic-functions-rapidity", "node", "am-found-linear-geometry-7w15"],
  ["foundation:conservation-symmetry", "node", "am-found-linear-geometry-7w15"],
  ["foundation:frames-events", "node", "am-found-fields-light-cv3o"],
  ["foundation:fields-waves", "node", "am-found-fields-light-cv3o"],
  ["foundation:electromagnetism-needed-here", "node", "am-found-fields-light-cv3o"],
  ["foundation:momentum-energy-light", "node", "am-found-fields-light-cv3o"],
  ["foundation:reading-german-physics-sentence", "node", "am-found-reading-german-u8oc"],
  ["foundation:bridge-letter-for-quantity", "bridge", "am-found-zero-algebra-rest-oipl"],
  ["foundation:bridge-equals-sign-relationship", "bridge", "am-found-zero-algebra-rest-oipl"],
  ["foundation:bridge-mathematical-punctuation", "bridge", "am-found-zero-algebra-rest-oipl"],
  ["foundation:bridge-probability-notation", "bridge", "am-found-zero-algebra-rest-oipl"],
  ["foundation:bridge-negative-numbers-direction", "bridge", "am-bm-slice-foundations-f5z9"],
  ["foundation:bridge-fractions-ratios", "bridge", "am-bm-slice-foundations-f5z9"],
  ["foundation:bridge-squaring-square-roots", "bridge", "am-bm-slice-foundations-f5z9"],
  ["foundation:bridge-scientific-notation-units", "bridge", "am-bm-slice-foundations-f5z9"],
  ["foundation:bridge-a-graph", "bridge", "am-bm-slice-foundations-f5z9"],
  ["foundation:bridge-sum-average", "bridge", "am-bm-slice-foundations-f5z9"],
] as const).map(
  ([id, kind, ownerBead]) => Object.freeze({ id, kind, ownerBead }) as CanonicalFoundationEntry,
);

export const CANONICAL_NODE_COUNT = CANONICAL_FOUNDATION_IDS.filter(
  (e) => e.kind === "node",
).length;
export const CANONICAL_BRIDGE_COUNT = CANONICAL_FOUNDATION_IDS.filter(
  (e) => e.kind === "bridge",
).length;
export const CANONICAL_TOTAL_COUNT = CANONICAL_FOUNDATION_IDS.length;
