# CONTENT_IDS.md: Content ID, Anchor, Alias, and Revision Grammar

This document specifies the canonical grammar, naming rules, normalization tables, and revision invariants for all content entities, source structures, equations, instruments, and anchors across **Annus Mirabilis** (`annus-mirabilis.com`).

---

## 1. Core Principles

1. **Permanence & Immutability:** Once published, a source block or sentence ID never changes because a paragraph is inserted into an explanation or split for translation. Retired or split nodes receive explicit aliases.
2. **Face-Invariant Addressing:** Anchors are content IDs, never array positions or line numbers. Switching between German, English, gloss, parallel, reading, results, and facsimile faces preserves the reader's exact place.
3. **Distinct Identity Dimensions:** `contentRevision`, `sourceAssetDigest`, `translationRevision`, `modelVersion`, and `artifactDigest` remain separate typed fields. A change in editorial prose never changes physics telemetry; a change in solver implementation never changes source alignment.
4. **No Disguised Types:** Dots appear in an ID ONLY between two digits (e.g. `0.6c`). Colons appear ONLY in mode IDs (`<instrumentId>:<slug>`).

---

## 2. Route Slugs, Bibliographic Keys, and Paper Codes

### 2.1 Route Slugs
The five canonical route slugs for the edition:
- `light-quanta`
- `brownian-motion`
- `special-relativity`
- `mass-energy`
- `molecular-dimensions` (companion)

### 2.2 Bibliographic Keys (`ap-<vol>-<page>`)
Bibliographic keys identify historical publications in *Annalen der Physik* (4th series):
- `ap-17-132` — Light Quanta (Vol. 17, pp. 132–148)
- `ap-17-549` — Brownian Motion (Vol. 17, pp. 549–560)
- `ap-17-891` — Special Relativity (Vol. 17, pp. 891–921)
- `ap-18-639` — Mass-Energy Equivalence (Vol. 18, pp. 639–641)
- `ap-19-289` — Molecular Dimensions Dissertation (Vol. 19, pp. 289–306)
- `ap-34-591` — 1911 Correction to Molecular Dimensions (Vol. 34, pp. 591–592)

*Note: Bibliographic keys name files, citations, and metadata; they never appear directly in user-facing URLs.*

### 2.3 Paper Codes
Two-letter prefixes used to make IDs globally unique across papers:
| Slug | Code |
|---|---|
| `light-quanta` | `lq` |
| `brownian-motion` | `bm` |
| `special-relativity` | `sr` |
| `mass-energy` | `me` |
| `molecular-dimensions` | `md` |

---

## 3. Source Structure Grammar (Local Document IDs)

### 3.1 Sections and Paragraphs
- **Sections:** `s<n>` where `n >= 0`. `s0` is used for unnumbered introductions in papers 1–3 and throughout paper 4 (which has no sections).
- **Paragraphs:** `s<n>-p<m>` where `m >= 1` (e.g. `s3-p2`).

### 3.2 Sentences and Alignable Units
- **Paragraph Sentences:** `s<n>-p<m>-s<k>` where `k >= 1` (e.g. `s3-p2-s1`).
- **Section Headings:** The block and translatable unit ID for a section heading is the section ID itself, `s<n>` (e.g. `s3`). `s0` has no heading block. (The retired `s3-h` form is rejected).
- **Part Headings (Paper 3):** `part-1` and `part-2`.
- **Masthead Units:** `masthead-title` and `masthead-author`.
- **Footnotes:** `s<n>-fn<k>` where `k >= 1` (e.g. `s3-fn1`). Footnotes align at block level and have no sentence-level sub-IDs.
- **Closings:** `closing-dateline`, `closing-ack`, `closing-received`. Each aligns at block level without sentence-level sub-IDs.

### 3.3 Split Translation Units
When one German unit splits into multiple English translation units:
- **Digit-ending base IDs:** Append a lowercase letter directly:
  `s3-p2-s1a`, `s3-p2-s1b`, `s3-fn1a`, `s3-fn1b`, `s3a`, `part-1a`.
- **Letter-ending base IDs:** Join with a hyphen:
  `closing-ack-a`, `closing-ack-b`, `masthead-title-a`, `closing-dateline-a`.
- *Rule: Suffixes exist only on English translation units. German source units never have letter suffixes.*

### 3.4 Inline Math and Reference Occurrences
- **Inline Math Regions:** `s<n>-p<m>-s<k>-m<i>` (in sentences) or `s<n>-fn<k>-m<i>` (in footnotes), where `i >= 1` is 1-based index across **all** printed math regions. Only substantive regions receive records, creating intentional sequence gaps that prevent renumbering when annotations are added.
- **Reference Occurrences:** `<alignableUnitId>-r<i>` where `i >= 1` (e.g. `s3-p2-s1-r1`, `s3-fn1-r2`). Names the occurrence in the text, not the target.

### 3.5 Related Document Prefixes
For companion documents (e.g. the 1911 correction to the dissertation), IDs carry `<role>-<year>-`:
- `correction-1911-s0-p1`
- `correction-1911-closing-dateline`

---

## 4. Equations and Printed Label Normalization

### 4.1 Equation ID Forms
- **Page Anchor:** `#eq-<suffix>`
  - Unique printed label: `#eq-7`, `#eq-7a`, `#eq-1p`
  - Section-qualified label (when printed label is repeated): `#eq-s1-1`, `#eq-s3-1`
  - Unnumbered display equation: `#eq-s3-d4`
- **Global Record ID:** `eq-<paperCode>-<suffix>` (e.g. `eq-bm-s3-d4`, `eq-lq-7`, `eq-sr-s3-1`)
- **Equation Terms, Operations, Alternate Forms, and Qualified IDs:**
  - Term ID: `<equation>.t.<name>` (e.g. `eq-s3-d4.t.viscosity`, `eq-sr-s3-1.t.beta`, `s3-p2-s1-m1.t.x`)
  - Operation ID: `<equation>.op.<name>` (e.g. `eq-s3-d4.op.denominator`, `eq-12.op.denominator`, `eq-sr-s3-1.op.lorentzFactor`)
  - Alternate-Form ID: `<equation>.alt.<name>` (e.g. `eq-s6-d3.alt.si`)
  - Qualified ID: `<route-slug>/<local-id>` (e.g. `brownian-motion/eq-s3-d4.t.viscosity`)
  - **Grammar Rules:**
    - `<equation>` is a displayed equation local ID / anchor (`eq-<printed>`, `eq-s<n>-<printed>`, `eq-s<n>-d<j>`), global record ID (`eq-<paperCode>-<suffix>`), substantive inline math ID (`s<n>-p<m>-s<k>-m<i>`, `s<n>-fn<k>-m<i>`), or model equation ID (`eq-model-<name>`).
    - `<name>` matches `^[a-z][A-Za-z0-9]{0,47}$`: lower camelCase, ASCII only, 1–48 characters, free of commas, equals signs, dots, and whitespace (ensuring generated KaTeX `\htmlData` markers parse cleanly).
    - `<route-slug>` must be one of the five canonical route slugs: `light-quanta`, `brownian-motion`, `special-relativity`, `mass-energy`, or `molecular-dimensions`. Short abbreviations like `bm` or `sr` are strictly rejected.

### 4.2 Printed Label Normalization Table
Printed labels are normalized to canonical ID tokens using `normalizePrintedLabel`:

| Original Printed Label | Normalized Token | Example Anchor | Example Record ID |
|---|---|---|---|
| `(7)` | `7` | `#eq-7` | `eq-lq-7` |
| `(7a)` | `7a` | `#eq-7a` | `eq-lq-7a` |
| `(1')` / `(1′)` | `1p` | `#eq-1p` | `eq-sr-1p` |
| `(1'')` / `(1″)` | `1pp` | `#eq-1pp` | `eq-sr-1pp` |
| `(II)` | `roman-2` | `#eq-roman-2` | `eq-sr-roman-2` |
| `(IIa)` | `roman-2a` | `#eq-roman-2a` | `eq-sr-roman-2a` |
| `(II')` / `(II′)` | `roman-2p` | `#eq-roman-2p` | `eq-sr-roman-2p` |
| Repeated `(1)` in §1 and §3 | `s1-1` and `s3-1` | `#eq-s1-1`, `#eq-s3-1` | `eq-sr-s1-1`, `eq-sr-s3-1` |
| Unnumbered 4th display in §3 | `s3-d4` | `#eq-s3-d4` | `eq-bm-s3-d4` |

---

## 5. Instruments, Modes, Presets, Prompts, and Tapes

### 5.1 Instrument Catalogues
- **Core Instruments:** `^(lq|bm|sr|me)-\d{2}$`
  - Light Quanta: `lq-01` .. `lq-09`
  - Brownian Motion: `bm-01` .. `bm-08`
  - Special Relativity: `sr-01` .. `sr-13`
  - Mass-Energy: `me-01` .. `me-03`
- **Declared Non-Core Instruments:**
  | Instrument ID | Kind | Owning Bead |
  |---|---|---|
  | `shelf-michelson-morley` | `shelf` | `am-disc-shelf-michelson-fizeau-dauq` |
  | `shelf-fizeau` | `shelf` | `am-disc-shelf-michelson-fizeau-dauq` |
  | `shelf-maxwell-galilean` | `shelf` | `am-disc-shelf-michelson-fizeau-dauq` |
  | `avogadro-lab` | `discovery` | `am-disc-avogadro-lab-pfi7` |
  | `light-thread` | `discovery` | `am-disc-light-thread-7wm4` |

### 5.2 Slug Grammar and the Dot Rule
All instrument sub-identifiers build upon canonical slugs:
- `TOKEN = [a-z0-9]+(\.[0-9]+[a-z0-9]*)?`
- `SLUG = TOKEN(-TOKEN)*`
- **The Dot Rule:** A dot is permitted **ONLY between two digits**.
  - Valid: `boost-0.6c`, `0-8-micron`, `wave-1.5`
  - Rejected: `.6c` (leading dot), `0.c` (no digit after dot), `a.b` (letters around dot), `0..6` (double dot), `0.6.7` (multiple dots)

### 5.3 Instrument Sub-Identifiers
- **Modes:** `<instrumentId>:<slug>` (e.g. `lq-02:1904`, `sr-04:1904`, `sr-02:apparatus`, `bm-04:kicks-off`, `bm-07:kitchen`, `me-03:box-1906`, `shelf-michelson-morley:1904`).
- **Presets:** `<instrumentId>-<slug>` (e.g. `sr-03-boost-0.6c`, `lq-08-intensity-probe`, `me-03-card-coal`, `shelf-michelson-morley-1904`).
- **Predict Prompts:** `<instrumentId>-predict-<slug>` (e.g. `sr-09-predict-approaching`).
- **Teaching Tapes:** `<slug>` matching `content/experiments/tapes/<id>.yaml` (e.g. `einstein-0-8-micron`, `perrins-count`, `the-boost-to-0.6c`, `the-two-pulses`, `the-locked-positions`).

---

## 6. Concordance, Knowledge Cards, and First-Encounters

### 6.1 Notation Concordance IDs
- **Format:** `<paperCode>.<glyph>.<meaning>`
- **Rules:** Glyph segment is case-sensitive ASCII spelling of printed symbols; meaning is kebab-case.
- **Examples:**
  - `bm.k.viscosity` (Stokes viscosity $k$)
  - `lq.beta.wien` (Wien constant $\beta$)
  - `sr.L.magnetic-field-x` (X-component of magnetic field $L$)
  - `sr.l.direction-cosine` (Direction cosine $l$)

### 6.2 Knowledge Card (Premise) IDs
- **Format:** `^[a-z]+(-[a-z]+)*-\d{4}-[a-z0-9]+(-[a-z0-9]+)*$` (max 80 chars)
- **Convention:** `<first-author>-<year>-<topic>`
- **Anchor:** `#card-<id>` (e.g. `#card-rayleigh-1900-radiation-law`, `#card-sutherland-1904-dunedin`)
- **Examples:** `rayleigh-1900-radiation-law`, `sutherland-1904-dunedin`, `poincare-1900-fictitious-fluid`.

### 6.3 First-Encounter Records & Entry Anchors
- **Record ID:** `entrance-<paperSlug>` (`entrance-light-quanta`, `entrance-brownian-motion`, `entrance-special-relativity`, `entrance-mass-energy`).
- **Entry Anchor:** `#entry-<paperSlug>` (`#entry-light-quanta`, `#entry-brownian-motion`, `#entry-special-relativity`, `#entry-mass-energy`).
- `entryAnchorForEntrance` and `entranceForEntryAnchor` provide exact round-trip conversion.

---

## 7. Anchors

Every anchor is a URL fragment (`#...`) that is a real HTML `id` needing no percent-encoding. `parseAnchor` in `src/content/anchors.ts` accepts exactly these forms and no other; `emitAnchor` in `src/reader/anchors/emitAnchor.ts` is the emission direction, round-tripped through `parseAnchor` before it returns.

### 7.1 Page Anchors (source structure)
The local source-structure ids of §3, used directly as fragments: `#s3` (the section; its first element is its heading block), `#s3-p2`, `#s3-p2-s1`, `#s3-fn1`, `#part-1`, `#masthead-title`, `#closing-dateline`, `#closing-received`.

### 7.2 Equation Anchors
`#eq-<suffix>` in every form of §4.1: `#eq-7`, `#eq-s3-1`, `#eq-s3-d2`, `#eq-roman-2`.

### 7.3 Other Anchors
| Anchor | Target | Example |
|---|---|---|
| `#result-<kebab-slug>` | A named result | `#result-lorentz-transformation` |
| `#arg-<paperCode>-<name>` | An argument node or journey stage | `#arg-sr-03`, `#arg-bm-variance-of-sum` |
| `#lab-<instrumentId>` | A core or declared non-core instrument | `#lab-bm-06`, `#lab-shelf-fizeau`, `#lab-avogadro-lab` |
| `#card-<premiseId>` | A knowledge card, identical on the `/1904` desk, timeline, shelves, and journeys | `#card-rayleigh-1900-radiation-law` |
| `#object-<kebab-name>` | An object of the `/1904` desk | `#object-radiation-spectrum` |
| `#entry-<paperSlug>` | A paper's first-encounter record (§6.3); the slug is always the full route slug | `#entry-brownian-motion` |

### 7.4 Retired Forms
Rejected, each with a message naming the current form: the short `#entry-brownian-motion`-style abbreviation and the bare `#entrance` (use `#entry-<full paper slug>`); `#s3-h` (use `#s3`); any `-fn<k>-s<j>` footnote-sentence form (footnotes align at block level only).

### 7.5 Query Parameters Are Never Part Of An Id
`?view=`, `?detail=`, `?tape=`, and every other query parameter are reading preferences, never identity. `rel=canonical` omits them. All ids are lowercase ASCII except quantity ids and the glyph segment of concordance entry ids, which are case-sensitive.

---

## 8. Generic Record ID Registry

Every entity not covered by a grammar above (foundations, bridges, misconceptions, knowledge cards, scenarios, datasets, tours, citations, notes, reviews, constant sets) uses the base pattern `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 80 characters, unique within its own entity namespace (`parseGenericRecordId`). An owning schema bead may narrow this grammar for its entity and must add its line here. Two narrowings are recorded:

- **Knowledge-card (premise) ids** — see §6.2: `<first-author>-<year>-<topic>`.
- **Foundation and bridge ids** are kebab slugs under the base pattern above; a **bridge** id additionally begins with `bridge-` (e.g. `bridge-negative-numbers-direction`). The reader's drawer deep link `?open=foundation:<id>` is a URL parameter value, never part of the id itself.

---

## 9. Aliases, Frozen ID Snapshots, and Revision Invariants

### 9.1 Alias Records (`content/aliases/<slug>.yaml`)
When a published ID is retired, split, or merged:
```yaml
- retiredId: s2-p2
  kind: merged
  replacementIds:
    - s2-p1
  reason: Consolidated introductory context during editorial review
  date: "1905-05-11"
  editor: "ed-albert"
```

### 9.2 Frozen ID Snapshots (`content/source-blocks/<slug>/manifest.ids.snapshot.txt`)
- Frozen snapshots contain one ID per line in manifest order.
- Lines beginning with `#` (e.g. `# s4-s5`) are ignored comments.
- `validateFrozenIds` enforces:
  1. Every snapshot ID must exist in current manifest or be retired in a valid alias.
  2. No current ID can reuse a retired ID.
  3. New IDs are flagged for review.

### 9.3 Revision Lineage and Cross-Commit Checks
- Every record has a positive integer `revision` and a `lineage[]` documenting previous revisions.
- `scripts/check-revisions.ts --base <git-ref>` compares base and head revisions:
  - If substantive content changes, `revision` must increase.
  - Revisions must never decrease.
  - Records removed at HEAD must have an alias.
