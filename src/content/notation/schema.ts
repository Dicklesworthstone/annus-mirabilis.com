/**
 * Schema parsing and validation for Notation Concordance entries.
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 */

export * from "../schemas/concordance.ts";
export {
  validateConcordanceEntry,
  validatePaperConcordance as validateNotationConcordanceFile,
  ConcordanceSchemaError as NotationSchemaError,
} from "../schemas/concordance.ts";
