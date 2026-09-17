# Digitization Pipeline Template

This directory provides the standard template for digitizing historical tables and figures into canonical `HistoricalDataset` records for Annus Mirabilis (`content/datasets/<id>.yaml` and `<id>.csv`).

## Steps for Digitizing a Historical Table or Figure

1. **Copy this template** into `scripts/digitize-datasets/<dataset-id>/`.
2. **Key raw data** into `raw.csv` exactly as printed, retaining printed units, commas/dots, blanks, and inequality signs (`<`, `>`).
3. **Configure metadata** in `digitize.ts`:
   - Title and full bibliographic citation with exact table or figure locator.
   - Publication date with earliest/latest intervals.
   - Canonical quantity IDs for each column (resolved against the canonical quantity registry; never use legacy spellings or local aliases).
   - Authoritative digitization metadata: digitizer name, method (e.g. double-keying), date, and source page image locator.
   - Uncertainty specification and rights statement from the rights policy vocabulary.
4. **Execute pipeline harness**:
   - Run `bun scripts/digitize-datasets/<dataset-id>/digitize.ts`.
   - The harness validates column quantity IDs, enforces cell unions (`number`, `bound`, `missing`), computes the cryptographic SHA-256 digest of the CSV, and emits the canonical YAML and CSV under `content/datasets/`.
5. **Verify**:
   - Run `bun test src/testing/datasets/` to confirm strict schema compliance, shelf eligibility, and overlay rendering.
