/**
 * Schema parsing and validation for Notation Concordance entries.
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 */

export * from "../schemas/concordance.ts";
export {
  ConcordanceSchemaError as NotationSchemaError,
  validateConcordanceEntry,
  validatePaperConcordance as validateNotationConcordanceFile,
} from "../schemas/concordance.ts";
