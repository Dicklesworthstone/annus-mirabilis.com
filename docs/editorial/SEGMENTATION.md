# Editorial Segmentation and Alignment Rules

This document specifies the editorial rules governing ledger segmentation, alignable units, sentence boundaries, word tokenisation, and reconciliation difference repairs for bilingual critical editions of the 1905 papers (`am-edn-alignment-tooling-do1`, Plan §3.2, §4.4, §4.5, §6.9, §7.11, §11.2, §11.3, §17.3).

Executable implementations:
- `src/content/editions/segmentLedger.ts`
- `src/content/editions/segmentSentences.ts`
- `src/content/editions/tokenizeGerman.ts`
- `src/content/editions/reconciliation.ts`
- `src/content/editions/alignment.ts`
- `src/content/editions/editionContract.ts`

---

## 1. Alignable Units

The critical edition aligns German source units to English translation units via explicit many-to-many graph edges. Array index positions or paragraph counts are never an alignment.

### Alignable Unit Kinds
- **Sentence-level alignables:** Sentences of paragraph blocks (`s<n>-p<m>-s<k>`, e.g., `s1-p1-s1`, `s4-p2-s3`). Section `s0` designates introductory paragraphs or Paper 4 (mass-energy, which has no numbered sections as printed).
- **Block-level alignables:** The following align at block level, with the English unit ID equal to the block ID (or suffixed if split):
  - Masthead units: `masthead-title`, `masthead-author`.
  - Section headings: `s<n>` (e.g., `s1`, `s4`).
  - Part headings: `part-1`, `part-2`.
  - Footnotes: `s<n>-fn<k>` (e.g., `s1-fn1`).
  - Closing units: `closing-dateline`, `closing-ack`, and `closing-received` (the journal's receipt line).

### Gloss Unit Addressing
Gloss units address any **alignable unit** from the list above (paragraph sentence, section heading, part heading, masthead unit, footnote, or closing unit), never only paragraph sentences. Addressing an unaligned paragraph block ID, an equation block ID, or an unknown ID fails `gloss-unit-unknown`.

### Split Translation Units
When an English translation splits a single German sentence or block into multiple sentences:
- Suffix rule: alphanumeric suffixes are appended directly (e.g., `s3-p2-s1a`, `s3-p2-s1b`; `s3-fn1a`, `s3-fn1b`). Endings with letters append with a hyphen (e.g., `closing-ack-a`, `closing-ack-b`).
- Suffixes must start with `a` and be consecutive (`invalid-split-suffix`).
- A split requires at least two parts (`missing-split-sibling`).
- An unsuffixed base unit cannot exist beside suffixed splits (`invalid-split-suffix`).

---

## 2. Display Equations and the Display-Reference Model

- **Display printed inside a paragraph:** A display printed inside a paragraph (the prose text continues after it without a new paragraph indent) is an `equation` block holding the LaTeX, printed label, and locators. The paragraph's inline stream references it by a `math` inline carrying the equation ID and `display: true`.
- **Paragraph block integrity:** The paragraph stays one block with one ID, and a sentence may contain the display reference.
- **Display printed after final sentence:** A display printed after a paragraph's final sentence is referenced at the end of that paragraph.
- **Display before first paragraph:** Only a display printed before the first paragraph of a section is a standalone block in section order; each such case is recorded in the paper's difficulties file.
- **Display byte-identity:** English units reference the German equation block by ID. Where the English layer stores its own copy of an equation block, the LaTeX and printed label must be byte-identical (`display-math-bytes-differ`). Retyped words printed inside a display formula stay as printed in German; their translation belongs in term annotations or editorial notes.

---

## 3. Sentence Boundaries

A sentence boundary ends at `.`, `?`, or `!` when followed by whitespace and an uppercase letter or an opening quotation mark (`„`, `»`), or by the end of the paragraph block.

### Candidate Boundaries
- Example: `Die Bewegung ist unregelmäßig. Sie hört nicht auf.` -> Two sentences: `Die Bewegung ist unregelmäßig.` and `Sie hört nicht auf.`
- Example with quotation mark: `Er fragte: „Warum?“ Darauf gab es keine Antwort.` -> Split at `?` followed by quote and uppercase.

### Never a Sentence Boundary
1. **Colons and semicolons:**
   - Example: `Die Bewegung ist unregelmäßig; sie hört nicht auf.` (One sentence).
   - Example: `Es gilt folgendes: Die Energie bleibt konstant.` (One sentence).
2. **Inside inline math regions:**
   - Example: `Setzt man $x = 1.5$ in die Gleichung ein.` (No split at the decimal point).
3. **Listed abbreviations:**
   The following abbreviations never trigger a sentence boundary:
   `z. B.`, `d. h.`, `u. s. w.`, `usw.`, `vgl.`, `bzw.`, `ca.`, `resp.`, `a. a. O.`, `l. c.`, `S.`, `p.`, `Bd.`, `Ann.`, `d.`, `Phys.`, `Sek.`, `sec.`, `cm.`, `mm.`, `gr.`, `Fig.`, `Gl.`, `Nr.`, `Proc.`, `Wied.`, `Ber.`, `Sitzungsber.`, `Akad.`, `Wiss.`.
   - Example: `Dies gilt z. B. für verdünnte Lösungen.` (No split at `z. B.`).
   - Example: `Siehe vgl. A. Einstein hierzu.` (No split at `vgl.`).
4. **Single-letter initials:**
   - Example: `A. Einstein`, `M. Besso`, `H. A. Lorentz` (Never split after initials).
5. **Ordinals before a month or noun, and Roman-numeral ordinals:**
   - Example: `17. März 1905` (No split at `17.`).
   - Example: `4. Folge` (No split at `4.`).
6. **Section signs with numbers:**
   - Example: `§ 8.` (No split at `§ 8.`).
7. **Bibliographic citation strings:**
   - Example: `Ann. d. Phys. 17. p. 891. 1905.` (Remains one sentence).

### Display References and Sentence Boundaries
- A sentence ends at a display only when the display's LaTeX ends with a full stop (optionally followed by spacing commands) and the following text begins with an uppercase letter.
  - Example: `$$ E = mc^2. $$ Es folgt hieraus...` -> Split after display.
- A display ending with a comma, or followed by lowercase continuing text (`wobei`, `wo`), stays inside the sentence.
  - Example: `$$ K = \frac{1}{2}mv^2, $$ wobei $v$ die Geschwindigkeit bedeutet.` -> Remains one sentence across the display.

### Precedence
The pinned facsimile scan decides every doubtful case. The editor's decision and rationale are recorded in the paper's difficulties file.

---

## 4. German Word Tokens

Word tokens provide the addressing grid for the interlinear gloss face (`validateGloss`) and review packets.

### Token Characters
- A token is a maximal run of letters (including `ä ö ü ß` and other Latin letters with diacritics).
- Internal apostrophes are included in the token:
  - Example: `Doppler'schen` (One token).
- Internal hyphens of printed compounds are included in the token:
  - Example: `Maxwell-Hertzschen` (One token).

### Composite Tokens
Each of the following is treated as a single token:
- A listed abbreviation with internal spaces:
  - Example: `z. B.`, `a. a. O.` (One token each).
- A section sign with its number:
  - Example: `§ 8` (One token).
- An ordinal with its period:
  - Example: `17.` (One token).
- A number with a decimal comma:
  - Example: `0,001` (One token).
- A printed unit word:
  - Example: `Sek.`, `cm`, `μ`, `Mikron` (One token each).

### Atoms and Punctuation
- Math expressions (`$...$`) and display references are `math` atoms.
- Footnote marks are `footnote-mark` atoms.
- Atoms are not word tokens and are never glossed.
- Punctuation marks (commas, colons, semicolons, quotes) are not tokens.
- Emphasis markup (`[[SPERR]]`, italic) never splits a token.

### Addressing
Token indices are 0-based positions among word tokens in the alignable unit, strictly excluding atoms and punctuation. The rule is identical for a paragraph sentence, a section heading, a footnote, and a closing unit.
