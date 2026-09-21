# Normative Specification: Reviewed Diplomatic German Ledger Format

**Document Identifier**: `docs/editorial/LEDGER_FORMAT.md`  
**Governing Bead**: `am-edn-ledger-validator-edv`  
**Edition Architecture**: Annus Mirabilis (`annus-mirabilis.com`)  
**Status**: Normative Standard  

---

## 1. Scope and Purpose

This document defines the normative file format, markup vocabulary, structural constraints, and validation invariants for the reviewed diplomatic German ledgers of Albert Einstein's 1905 *Annalen der Physik* papers and companion records.

Ledgers reside in the repository under:
```
public/papers/transcripts/<key>-machine-draft.txt     a draft, not yet reviewed by a human
public/papers/transcripts/<key>-reviewed.txt          a named human reviewer has signed off
```
where `<key>` is the bibliographic key of the paper (e.g., `ap-17-132`, `ap-17-549`, `ap-17-891`, `ap-18-639`, `ap-19-289`, `ap-34-591`).

**The filename follows the status, and so does the header.** Owner ruling on am-wisq, 2026-09-21,
selected verbatim as "Header states real status": a draft opens `MACHINE DRAFT` and `REVIEWED`
becomes available only once a human signs off. Before that ruling the format admitted one token and
the validator refused every other first line, so a machine draft asserted human review by
construction - three ledgers in this repository opened with a word nobody had earned. The
alternative of keeping `REVIEWED` on line 1 and adding a status line beneath it was put to the owner
and declined, on the ground that line 1 is the line that gets quoted.

A ledger is a faithful, diplomatic transcription of the printed German source pages as witnessed in the pinned primary facsimile scan. It mirrors the exact structure, orthography, and printed features of the original historical artifact while establishing clean, semantic boundaries for automated alignment, translation pairing, notation concordance, and laboratory verification.

---

## 2. File Encoding and Layout Invariants

Every ledger file must strictly adhere to the following physical invariants:

1. **Character Encoding**: UTF-8 without Byte Order Mark (BOM). The presence of a BOM (U+FEFF) at the start of the file is a structural error (`content-before-marker`).
2. **Unicode Normalization**: Unicode Normalization Form C (NFC). Any non-NFC normalized sequence is an encoding error (`encoding`).
3. **Line Endings**: Unix LF (`\n`, U+000A) only. Carriage returns (`\r`, U+000D), whether CRLF or standalone CR, are strictly forbidden (`encoding`).
4. **Final Newline**: The file must terminate with exactly one LF character immediately following the final line's content.
5. **Forbidden Control Characters**: Tab characters (`\t`, U+0009) and ASCII control characters in the ranges `\x00`–`\x08`, `\x0B`–`\x0C`, and `\x0E`–`\x1F`, as well as DEL (`\x7F`), are forbidden (`encoding`).
6. **No File-Level Metadata Header**: The ledger file contains no front-matter, YAML prelude, comments, or introductory prose. The very first line of the file must be the page marker for page 1 (`first-marker`). Any content preceding this marker is forbidden (`content-before-marker`).

---

## 3. Page Boundaries and Annalen Page Anchors

A ledger document is organized into consecutive pages corresponding directly to the printed facsimile pages.

### 3.1 Page Markers

Each page begins with an uppercase page marker on its own physical line, carrying the transcript's
declared review status:
```
--- MACHINE DRAFT TRANSCRIPTION PAGE <m> OF <N> ---
--- REVIEWED TRANSCRIPTION PAGE <m> OF <N> ---
```
- `<m>` is the 1-based sequential ledger page number ($1 \le m \le N$).
- `<N>` is the total number of ledger pages in the document.
- The first line of the file must be the page-1 marker in one of the two forms above. A leading
  space is not permitted: the line must BEGIN with the marker (`first-marker`).
- **`REVIEWED` is a gate, not a spelling.** A transcript may declare `REVIEWED` only when its
  receipt records a named human reviewer in `transcription.editors` - an entry with a non-empty
  `name` that is not an `agent:` identity, because an agent signing off the draft it produced is
  the state this refuses. Otherwise `reviewed-without-named-reviewer`.
- **Every marker in one file declares the same status** (`marker-status-mixed`). Without this a
  transcript could open `MACHINE DRAFT`, satisfy the receipt gate on line 1, and claim `REVIEWED`
  on page 2, where the gate never looks.
- Page numbers must be strictly sequential with no gaps, no duplicates, and no reversals ($1, 2, \dots, N$). Any violation raises `marker-sequence`.
- `<N>` must match the expected page count declared in the paper's provenance receipt (`page-count-mismatch`):
  - For full-document ledgers: `<N>` equals the length of `pageMap` in `docs/provenance/<key>.md`.
  - For scoped ledgers: `<N>` equals the length of `transcription.ledgerScopePages`.

### 3.2 Annalen Page Anchors

Immediately following each page marker on the very next physical line, an Annalen page anchor must appear:
```
[[ANNALEN-PAGE <printed-page>]]
```
- `<printed-page>` is the printed page number as set in the journal (e.g., `549`).
- Anchors must appear on the line immediately following the page marker (`anchor-missing`).
- Anchors must be strictly monotonically increasing across the ledger (`anchor-order`).
- Anchors must not be duplicated (`anchor-duplicate`).
- Anchors must fall within the journal's published page range (`journal.pages.first` to `journal.pages.last` from the receipt) (`anchor-range`).
- Anchors must match the exact `printedPage` mapped to this ledger page in the receipt's `pageMap` (accounting for `ledgerScopePages` in scoped documents) (`anchor-mapping`).

---

## 4. Document Structure and Content Elements

### 4.1 Masthead (Article Start)

The first page of a full-article ledger includes the printed masthead elements before the main body:
- Optional Article Number: `[[ARTICLE-NUMBER <num>]]` (e.g., `[[ARTICLE-NUMBER 3.]]` or `[[ARTICLE-NUMBER 1.]]`).
- Title: Enclosed between `[[TITLE]]` and `[[/TITLE]]`.
- Author: Enclosed between `[[AUTHOR]]` and `[[/AUTHOR]]`.
- The title and author tags may appear on separate lines or on a shared physical line.
- Unclosed masthead tags raise `unclosed-tag`.
- In completeness mode, a full-article ledger missing title or author tags raises `masthead-missing`.

### 4.2 Section and Part Headings

- **Section Headings**: `[[HEADING s<n>]] <heading text as printed>`  
  `<n>` is a positive integer denoting the section index (e.g., `[[HEADING s1]] § 1. Über die Ursache...`).
- **Part Headings**: `[[PART-HEADING part-<m>]] <part heading text as printed>`  
  Used where papers are divided into major parts (e.g., `[[PART-HEADING part-1]] I. KINEMATISCHER TEIL`).
- **Section 0 (`s0`)**: All text, equations, and footnotes preceding the first explicit `[[HEADING ...]]` implicitly belong to section 0 (`s0`). In papers with no printed section divisions (e.g., Paper 4, `ap-18-639`), the entire work belongs to `s0`.
- **Heading Ordering**: Section numbers must be strictly increasing. Part headings must precede the first section contained within that part. Any inversion raises `heading-order`.

### 4.3 Paragraphs and Line Breaks

- Paragraphs are separated by **exactly one blank line**.
- A paragraph may span multiple physical lines. Soft line breaks in the ledger are joined with a single space during edition compilation.
- **Line-End Hyphens**: No physical line may end with a hyphen (`-`, U+002D) or hyphen character (`‐`, U+2010) immediately preceded by a letter. Wrap-hyphenated words must be rejoined whole on the current line or moved to the next line (`line-end-hyphen`).
- **Paragraphs Crossing Page Breaks**:
  - When a paragraph continues across a page break, its first portion concludes at the bottom of the page with the tag `[[CONTINUES]]` on its own line or at the end of the text.
  - Any word wrap-hyphenated across the page break is rejoined and written whole before `[[CONTINUES]]`.
  - The continuation begins with the first body line of the next page (immediately following `[[ANNALEN-PAGE ...]]`).
  - `[[CONTINUES]]` occurring in the middle of a page or on the final page of a ledger raises `continues-orphan`.

### 4.4 Mathematics

#### 4.4.1 Display Equations
- Display equations are enclosed in `$$ ... $$`.
- A display equation belongs to the paragraph in which it is printed. No blank line separates it from preceding or succeeding text unless a new printed paragraph begins.
- Multi-line equations printed under a single label or brace constitute a single display region (e.g., using `aligned` or `array`).
- **Equation Labels**: If a printed equation bears a label (e.g., `(1)`, `(2a)`, `(I)`), the tag `[[EQ-LABEL <label>]]` must follow on the **very next line** immediately after the closing `$$`.
- A label tag not immediately following a display equation raises `eq-label-orphan`.
- The same printed equation label appearing more than once within the same section raises `eq-label-duplicate-in-section`, unless specifically recorded in `printingAnomalies` in `ledger-config.yaml` with an associated receipt `typographicalErrors` reference.
- An equation label repeating across different sections is flagged with the informational finding `eq-label-repeats-across-sections`.

#### 4.4.2 Inline Mathematics
- Inline mathematical expressions are enclosed in single dollar signs `$ ... $`.
- Mathematics must not contain unbalanced delimiters (`math-unbalanced`).
- German words inside mathematics must be wrapped in `\text{...}`. Unicode letters outside `\text{...}` in math mode trigger `math-parse`.
- Macro definitions (`\def`, `\gdef`, `\edef`, `\let`, `\newcommand`, `\renewcommand`) inside math mode are forbidden (`math-macro-definition`).
- All mathematical expressions are parsed using KaTeX with strict error checking (`ledgerMathSettings.ts`). Syntax errors raise `math-parse`.

### 4.5 Emphasis

- **Sperrdruck (Letter-Spaced Emphasis)**: `[[SPERR]]...[[/SPERR]]`.
- **Italics (Non-Mathematical)**: `[[EM]]...[[/EM]]`.
- Emphasis tags must be properly closed (`unclosed-tag`).
- Emphasis tags must **never nest** (e.g., `[[SPERR]][[EM]]...[[/EM]][[/SPERR]]` is forbidden and raises `nested-emphasis`).

### 4.6 Footnotes

- **Inline Footnote Mark**: `[[FN-MARK <label>]]` placed inline at the point of reference in text, headings, or equations.
- **Footnote Text**: Placed at the foot of the page on which the mark appears:
  ```
  [[FN <label>]] <footnote body text>
  ```
- Footnote labels restart per page as printed (e.g., `1)`).
- **Footnote Continuing Across Page Breaks**:
  - A footnote extending onto the following page ends on the current page with `[[FN-CONTINUES]]`.
  - On the following page, the continuation appears at the foot with:
    ```
    [[FN-CONT <label>]] <continuing footnote body text>
    ```
- A mark without corresponding text on the same page raises `fn-mark-orphan`.
- Footnote text without a corresponding mark raises `fn-text-orphan`.
- A continuation tag `[[FN-CONT]]` without a preceding `[[FN-CONTINUES]]` (or vice-versa) raises `fn-continuation-orphan`.

### 4.7 Closings

Closing editorial matter printed at the conclusion of an article:
- **Date-Line**: `[[DATELINE]] <as printed>` (e.g., `[[DATELINE]] Bern, Mai 1905.`).
- **Acknowledgment**: `[[ACK]] <as printed>` (e.g., `[[ACK]] Am Schlusse sei bemerkt...`).
- **Journal Receipt Line**: `[[RECEIVED]] <as printed>` (e.g., `[[RECEIVED]] (Eingegangen 11. Mai 1905.)`).
- In completeness mode, missing closings specified in the paper's `expectedClosings` configuration raise `closing-missing`.

### 4.8 Omitted Article Marker

When a printed page contains text from a preceding or succeeding article that is not part of the edition, the marker appears on its own line:
```
[[OTHER-ARTICLE-OMITTED]]
```

---

## 5. Normalization Principles vs. Historical Fidelity

The diplomatic ledger honors historical fidelity while adhering strictly to declared editorial normalizations:

1. **Declared Normalizations**:
   - Rejoining wrap-hyphenated words across line and page breaks.
   - Resolving typographic ligatures (fi, fl, ft, tz, ch, ck).
2. **Preserved Historical Features**:
   - Historical German spelling (`daß`, `giebt`, `Theorie`, `Photochemie`).
   - Original punctuation, capitalizations, and spacing in abbreviations (`z. B.`, `d. h.`, `a. a. O.`).
   - Decimal commas and units as printed (`μ`, `Sek.`, `Volt`, `Amp.`).
   - Printed typographical errors. A suspected printer error is transcribed exactly as printed, accompanied by an entry in the receipt's `typographicalErrors` ledger. Editors must never "correct" printed misspellings in the ledger text.

---

## 6. Draft Tokens and Forbidden Artifacts

### 6.1 Draft-Only OCR Tokens (Forbidden in Reviewed Ledgers)

Draft tokens emitted by upstream OCR pipelines are strictly forbidden in reviewed ledgers and raise `draft-token` with specific actionable repairs:
- `[[RUNNING-HEAD ...]]`: "Remove running head; running heads belong in receipt pageMap."
- `[[PAGE-NUMBER ...]]`: "Remove page number; carried by [[ANNALEN-PAGE]]."
- `[[ILLEGIBLE]]`: "Resolve reading against 300+ dpi image/witnesses or record in watchList."

### 6.2 Forbidden Scan and Machine Artifacts

The following tokens are strictly forbidden anywhere in a ledger (`forbidden-token`):
- `[[MATH-REGION`
- `unverified`
- `TODO`
- `???`
- `\uFFFD` (Unicode replacement character)
- `[?]`
- `<unk>`
- Machine confidence JSON payloads (e.g., `{"confidence": ...}`).

### 6.3 Markup Errors

- **HTML Outside Mathematics**: A `<` character followed by a letter, `/`, or `!` outside of mathematical expressions raises `html-outside-math`.
- **Unknown Tags**: Any `[[...]]` tag not recognized by this specification raises `unknown-tag`.

---

## 7. Validation Modes: Structural vs. Completeness

The validator operates in two distinct modes:

1. **Structural Mode**:
   - Active when `transcription.ledgerStatus` in the provenance receipt is `not-started` or `in-progress`.
   - Validates all syntax, encoding, marker sequences, anchor mapping, math syntax, tag balancing, and forbidden tokens.
   - Pages containing only markers and anchors are accepted and flagged with informational `skeleton-page` findings.
   - A digest mismatch in `ledgerSha256` is reported as an informational `receipt-ledger-digest-stale` finding.

2. **Completeness Mode**:
   - Active when `transcription.ledgerStatus` is `corrected`, `corrected-second-read`, or `reviewed`, OR when `--require-complete` is supplied to the validator.
   - Enforces all structural rules.
   - An empty page raises `page-empty` (error).
   - Missing title/author on page 1 of full-article ledgers raises `masthead-missing` (error).
   - Missing expected closings raises `closing-missing` (error).
   - A missing or mismatched `ledgerSha256` raises `receipt-ledger-digest-mismatch` (error).

---

## 8. Warning Rules and Editorial Heuristics

The validator flags potential transcription anomalies as warnings. Warnings do not invalidate the structural integrity of the file, but must either be corrected or acknowledged in the paper's allowlist:

- `short-line`: A line of 1 or 2 words inside a paragraph that is not the final line of the paragraph.
- `short-paragraph`: A paragraph consisting of only 1 or 2 words.
- `spaced-letters`: Sequences of three or more single letters separated by single spaces (e.g., `W ä r m e`) not wrapped in `[[SPERR]]`.
- `modern-spelling`: Modern German spellings where 1905 print used historical forms (e.g., `dass` instead of `daß`).
- `running-head-like`: A line resembling an author running head (e.g., `A. Einstein.`) or matching `runningHeadPatterns`.
- `digit-letter-confusion`: Confusions between letters and numbers in text outside math (e.g., `1O5`, `l00`).
- `ascii-quote`: Straight ASCII quotes (`"` or `'`) in German prose where printed text uses „ and “.
- `double-space`: Consecutive space characters within text.
- `trailing-whitespace`: Spaces or tabs at the end of a physical line.

---

## 9. Allowlist and Configuration Specifications

### 9.1 Allowlist (`ledger-allowlist.yaml`)

Located at `content/source-blocks/<slug>/ledger-allowlist.yaml`. Used to acknowledge acceptable warnings:
```yaml
- ledgerKey: ap-17-549
  code: modern-spelling
  ledgerPage: 1
  lineFingerprint: 8a4f9b2c3d1e0f5a
  reason: "Spelling variant verified against 300 dpi facsimile scan"
  editor: "jemanuel"
  date: "2026-09-17"
```
- `lineFingerprint`: The first 16 hexadecimal characters of the SHA-256 hash of the normalized line text (NFC, leading/trailing whitespace stripped, internal whitespace collapsed).
- Any allowlist entry missing `reason`, `editor`, or `date` raises `allowlist-entry-invalid`.
- Entries are filtered strictly by `ledgerKey`. Entries for other keys within a multi-ledger slug do not affect or acknowledge warnings for the active key.
- Any allowlist entry for the active key that does not match an emitted warning is reported as a stale allowlist entry.

### 9.2 Configuration (`ledger-config.yaml`)

Located at `content/source-blocks/<slug>/ledger-config.yaml`. Configures key-specific rules:
```yaml
defaults:
  runningHeadPatterns:
    - "^A\\.\\s*Einstein\\.?$"
  expectedClosings:
    - dateline
    - received
  modernSpellingList:
    - dass

ledgers:
  ap-19-289:
    expectedClosings:
      - dateline
  ap-34-591:
    expectedClosings:
      - received
    printingAnomalies:
      - label: "(1)"
        section: "s1"
        typographicalErrorId: "typo-ap34-eq1"
```
- Keys under `ledgers:` must resolve to a valid receipt in `docs/provenance/<key>.md`; otherwise, `config-key-unknown` is raised.
- For slugs with multiple documents, if a key lacks both a `ledgers:` entry and complete defaults, `config-key-missing` is raised.

---

## 10. Complete Worked Example Page

The following complete page demonstrates every required structural element, closing, display, footnote continuation, and markup construct in a single realistic page:

```
--- REVIEWED TRANSCRIPTION PAGE 1 OF 2 ---
[[ANNALEN-PAGE 549]]
[[ARTICLE-NUMBER 3.]]
[[TITLE]]Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen[[/TITLE]]
[[AUTHOR]]von A. Einstein[[/AUTHOR]]

[[HEADING s1]]§ 1. Über den den suspendierten Teilchen zuzuschreibenden osmotischen Druck[[/HEADING]]

Es liegt die Vermutung nahe, daß diese Bewegung mit der Wärmebewegung der Moleküle identisch sei. In der Tat muß nach der molekularkinetischen Theorie suspendierten Teilchen von mikroskopischer Größe ein [[SPERR]]osmotischer Druck[[/SPERR]] zukommen, welcher mit dem osmotischen Druck gelöster Moleküle übereinstimmt.[[FN-MARK 1)]]

Setzen wir voraus, daß das suspendierte Teilchen ein kugelförmiges Gebilde sei vom Radius $P$, so ergibt sich für die im Zeitintervall $\tau$ durch Diffusion hervorgerufene mittlere Verschiebung $\lambda_x$:
$$
\lambda_x = \sqrt{\overline{\Delta x^2}} = \sqrt{2 D \tau}
$$
[[EQ-LABEL (1)]]
wobei der Diffusionskoeffizient $D$ durch die Stokes-Einstein-Beziehung gegeben ist:
$$
D = \frac{R T}{6 \pi k P N}
$$
[[EQ-LABEL (2)]]
Hierin bedeutet $R$ die Gaskonstante, $T$ die absolute Temperatur, und $N$ die Anzahl der Moleküle im Grammolekül. Wir bezeichnen diesen Vorgang als [[EM]]Diffusion molekularer Teilchen[[/EM]], wobei $x < V$ gilt.

Wir wollen nun untersuchen, wie sich die Verteilung der Teilchen im Raume mit der Zeit ändert, wenn auf dieselben keine äußeren Kräfte wirken[[CONTINUES]]

[[FN 1)]] Vgl. hierzu die grundlegende Arbeit von M. Smoluchowski, Ann. d. Phys. 16. p. 45. 1905.[[FN-CONTINUES]]
--- REVIEWED TRANSCRIPTION PAGE 2 OF 2 ---
[[ANNALEN-PAGE 550]]
einer solchen Verschiebung unterworfen sind. Es sei ferner hervorgehoben, daß diese Bewegung eine vollkommen regellose ist.

[[OTHER-ARTICLE-OMITTED]]

[[DATELINE]]Bern, Mai 1905.[[DATELINE]]
[[ACK]]Am Schlusse sei Herrn M. Besso für seine wertvollen Ratschläge gedankt.[[ACK]]
[[RECEIVED]](Eingegangen 11. Mai 1905.)[[/RECEIVED]]

[[FN-CONT 1)]] Dieselbe Auffassung wurde auch von anderen Forschern vertreten.
```
