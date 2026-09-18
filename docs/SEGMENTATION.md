# Edition Segmentation and Alignment Rules

This document specifies the rules governing ledger segmentation, alignable units, sentence boundaries, word tokenisation, and reconciliation difference repairs for bilingual critical editions of the 1905 papers (`am-edn-alignment-tooling-do1`).

Executable implementations:
- `src/content/editions/segmentLedger.ts`
- `src/content/editions/segmentSentences.ts`
- `src/content/editions/tokenizeGerman.ts`
- `src/content/editions/reconciliation.ts`
- `src/content/editions/alignment.ts`

---

## 1. Alignable Units

The edition aligns German source units to English translation units via explicit many-to-many graph edges. Array index positions are never an alignment.

### Sentence-Level Alignables
- Paragraph sentences: `s<n>-p<m>-s<k>` (e.g., `s1-p1-s1`, `s4-p2-s3`). Section `s0` designates introductory paragraphs or Paper 4 (which has no numbered sections).
- Footnote sentences: `s<n>-fn<k>-s<j>`.

### Block-Level Alignables
Block-level units align as whole units (English unit ID matches the German block ID, with suffixed letters if English splits the unit):
- Section headings: `s<n>` (e.g., `s1`, `s4`).
- Part headings: `part-1`, `part-2`.
- Masthead units: `masthead-title`, `masthead-author`.
- Footnotes: `s<n>-fn<k>` (e.g., `s1-fn1`).
- Closing units: `closing-dateline`, `closing-ack`, `closing-received`.

### Split Translation Units
When an English translation splits a single German sentence or block into multiple sentences:
- Suffix rule: alphanumeric suffixes are appended directly (e.g., `s3-p2-s1a`, `s3-p2-s1b`; `s3-fn1a`, `s3-fn1b`). Endings with letters append with a hyphen (e.g., `closing-ack-a`, `closing-ack-b`).
- Suffixes must start with `a` and be consecutive (`invalid-split-suffix`).
- A split requires at least two parts (`missing-split-sibling`).
- An unsuffixed base unit cannot exist beside suffixed splits (`invalid-split-suffix`).

---

## 2. Display Equations and Inline References

- **Display equations are not translated:** An English display equation block must be byte-identical to the aligned German display equation block (`display-math-bytes-differ`).
- Equations are shared by permanent ID wherever possible (`eq-<paper>-<suffix>`). Any duplicated display block must match exactly without Unicode or whitespace normalization.
- Retyped words printed inside a display formula stay as printed in German. Their translation and meaning belong in term annotations (`validateTerms`) or section-scoped editorial notes, never by altering the display LaTeX.
- Display equation references in prose align as math atoms, not as sentence boundaries.

---

## 3. Sentence Boundaries

A sentence boundary ends at `.`, `?`, or `!` followed by whitespace and an uppercase letter or an opening quotation mark, or by the end of a paragraph block.

### Never a Sentence Boundary
- Colons (`:`) and semicolons (`;`).
- Periods inside inline mathematics (e.g., `$x = 1.5$`).
- Single-letter initials (e.g., `A. Einstein`).
- Ordinals before a month or noun (e.g., `17. Mai`).
- Section signs with numbers (e.g., `§ 4.`).
- Bibliographic citation strings.

### Sentence Boundary Abbreviation List
The following abbreviations never trigger a sentence boundary. Every abbreviation used by the tokenizer must be present in this list:
- `z. B.`
- `d. h.`
- `u. s. w.`
- `usw.`
- `vgl.`
- `bzw.`
- `ca.`
- `resp.`
- `a. a. O.`
- `l. c.`
- `S.`
- `p.`
- `Bd.`
- `Ann.`
- `d.`
- `Phys.`
- `Sek.`
- `sec.`
- `cm.`
- `mm.`
- `gr.`
- `Fig.`
- `Gl.`
- `Nr.`
- `Proc.`
- `Wied.`
- `Ber.`
- `Sitzungsber.`
- `Akad.`
- `Wiss.`

The pinned facsimile scan decides every doubtful boundary case.

---

## 4. German Word Tokens

Word tokens provide the addressing grid for the interlinear gloss face (`validateGloss`).
- A word token is a maximal run of letters (including German umlauts and eszett: `ä`, `ö`, `ü`, `ß`), with internal apostrophes and printed hyphens.
- Composite tokens: listed multi-word abbreviations with internal spaces (e.g., `z. B.`), `§` with its section number, ordinals with their period, decimal numbers with commas, and printed unit abbreviations.
- Math expressions (`$...$`) and footnote marks are treated as atoms, not word tokens.
- Punctuation marks are not tokens.
- Token indices within a sentence are 0-based among word tokens.
- Every word token in an alignable unit must be accounted for in gloss coverage (`gloss-missing-token`), with no token assigned to overlapping multi-word glosses (`gloss-token-collision`).

---

## 5. Reconciliation Differences and Alias Repairs

Reconciliation compares proposed blocks and units from a reviewed ledger against the frozen manifest. Any discrepancy produces a structured difference:

### Difference Kinds
- `unit-missing-in-ledger`: A manifest unit is absent from the ledger segmentation.
- `unexpected-ledger-unit`: A ledger unit has no corresponding manifest entry.
- `digest-mismatch`: The text of an existing unit differs from the ledger.
- `sequence-gap`: A gap in paragraph or sentence numbering.

### Guarded Writes & Blocking Refusals
- **No writes with unresolved differences:** `writeProposedBlocks` refuses to write blocks if differences remain unresolved (`write-blocks-refused-differences`).
- **No alias without confirm:** An alias record rewrites what permalinks and concordance scopes resolve to. Creating or updating an alias requires `--confirm` (`confirm-required`).
- **Editorial attribution required:** Creating an alias requires an explicit human editor (`missing-editor`) and editorial rationale (`missing-reason`).
- **Overwrite guard:** Overwriting an existing alias requires `--update` (`update-required`).
- **Retired ID reuse forbidden:** A retired ID cannot be reused as a new unit ID (`retired-id-reused`).
- **File safety:** The segmentation tooling never deletes files (Rule 1).
