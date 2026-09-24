/**
 * The pinned artifact's identity, for the loader side. The values live in
 * src/experiments/provenance/pinnedFrankenSim.ts, plain data a view may import too. They mirror
 * public/wasm/manifest.json, and pinnedArtifact.test.ts fails if the two ever disagree.
 */
export {
  FRANKENSIM_BROWNIAN_ENGINE_SENTENCE,
  PINNED_ARTIFACT,
  PINNED_WASM_URL,
} from "../../experiments/provenance/pinnedFrankenSim.ts";
