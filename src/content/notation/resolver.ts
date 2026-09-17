/**
 * Scoped notation concordance resolver and toggle contract implementation.
 * Specification: AGENTS.md, am-not-concordance-model-uag, am-not-entries-brownian-1rq.
 */

export * from "./resolve.ts";
export {
  clearConcordanceCache,
  loadAllConcordances,
  loadConcordanceForPaper,
  NOTATION_DIR,
  registerConcordance,
} from "./loader.ts";
