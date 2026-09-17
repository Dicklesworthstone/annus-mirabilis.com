# Provenance Receipt Format Specification

**Normative Standard:** `RECEIPT_FORMAT_VERSION: 1`  
**Owner Bead:** `am-src-receipt-format-npo5`  
**Consumers:** `am-src-facsimile-*`, `am-edit-review-records-hofz`, `am-design-sources-about-zumd`, `am-cm-schemas-source-1en`, `am-edn-ledger-validator-edv`

---

## 1. Overview & Purpose

A provenance receipt is a persistent, machine-readable, and human-auditable document located at `docs/provenance/<key>.md`, where `<key>` matches `ap-<volume>-<first-printed-page>` (for example, `ap-17-549` for Brownian motion).

The provenance receipt records the full bibliographic, physical, legal, and transcription lineage of an *Annalen der Physik* paper or companion work before any editorial copy is published. It establishes an unbroken chain of custody from the original 1905 printing and digital repository scan to the diplomatic reviewed transcription ledger, translation, and interactive critical edition.

---

## 2. Document Structure

A provenance receipt file consists of two mandatory components:
1. **Machine-Readable YAML Front Matter** enclosed between standard `---` boundary lines.
2. **Authoritative Markdown Body** containing exactly ten level-2 (`##`) headings in strict prescribed order.

```markdown
---
receiptFormatVersion: 1
receiptKind: facsimile-scan
key: ap-99-001
# ... additional front matter fields ...
---

# Provenance Receipt: ap-99-001 (Example Paper)

## Identity
...
## Scan and rights
...
## Page map
...
## Comparison witnesses
...
## Transcription method
...
## Translation credits
...
## Editorial boundaries
...
## Suspected historical typographical errors
...
## Transcription watch list
...
## Editorial acceptance
...
```

---

## 3. Front Matter Field Specification

### 3.1. Top-Level Identity

| Field | Type | Description |
|---|---|---|
| `receiptFormatVersion` | `1` | Schema version constant (must be `1`). |
| `receiptKind` | `"facsimile-scan"` | Discriminator for receipt structure. |
| `key` | `string` | Bibliographic key matching `ap-<volume>-<first page>` and the file basename. |
| `slug` | `string` | URL slug (e.g. `light-quanta`, `brownian-motion`, `special-relativity`, `mass-energy`). |

### 3.2. Paper Identity (`paper`)

- `titleGerman`: Original German title as printed.
- `titleEnglishWorking`: Working English title.
- `authorLine`: Author attribution as printed.
- `dates`: Array of typed dates, each:
  - `type`: `"date-line" | "received" | "issue-publication" | "submitted" | "later-edition"`
  - `text`: (Optional) verbatim string from printed paper (e.g. `"Bern, Mai 1905."`)
  - `iso`: ISO date string (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`)
  - `precision`: `"day" | "month" | "year"`
  - `source`: Citation of source for the date determination
  - `verifiedAt`: ISO date of verification
  - `confirmedFromScan`: Boolean indicating direct scan confirmation
- `journal`:
  - `name`: Journal name (`"Annalen der Physik"`)
  - `series`: Series number (`4`)
  - `volume`: Journal volume (e.g. `17`)
  - `wholeSeriesVolume`: Cumulative series volume (e.g. `322`)
  - `issue`: Issue number or identifier (e.g. `8`)
  - `issueSource`: Source for issue metadata
  - `pages`: `{ first: number, last: number }` (e.g. `{ first: 549, last: 560 }`)
  - `doi`: Canonical Crossref DOI (e.g. `"10.1002/andp.19053220806"`)
  - `doiVerifiedAt`: ISO date when DOI resolution was confirmed against publisher landing page
  - `laterEditionDois`: (Optional) Array of `{ doi, description, verifiedAt }`
- `collectedPapers`: `{ volume: number, document: number }` (e.g. `{ volume: 2, document: 16 }`)

### 3.3. Scan Block (`scan`)

- `originUrl`: Original repository landing page / item URL.
- `finalUrl`: Direct digital item or download URL.
- `institution`: Holding library or digitizing institution.
- `hostItemId`: Unique item identifier in source repository.
- `hostFileName`: Filename assigned by repository.
- `hostFileSource`: `"original" | "derivative"`
- `hostChecksumsVerified`: Boolean.
- `termsStatementUrls`: Array of URLs for terms and conditions.
- `acquisitionDate`: ISO date when file was fetched and pinned.
- `sha256`: Lowercase 64-character hexadecimal SHA-256 digest of the pinned PDF.
- `mimeType`: `"application/pdf"`
- `pageCount`: Positive integer page count.
- `parent`: (Optional) Parent whole-volume record `{ sha256, pageCount, path?, parentPageIndices: number[] }`.
- `embeddedTextLayer`: `"present" | "absent" | "partial"`
- `rightsStatus`: Status from `docs/rights-vocabulary.yaml`.
- `publicationDecision`: `"publish" | "pin-local-only" | "reference-only"`.
- `publicationReason`: (Required if not `publish`) Justification for local-only or reference-only retention.
- `cloudProcessing`: `"permitted" | "forbidden" | "unknown"`.
- `cloudProcessingBasis`: Explanation of basis for cloud processing determination.
- `reuseTerms`: `"pending-decision" | "named-license" | "source-terms" | "no-reuse-offered"`.
- `credit`: (Required for `public-domain-image` and `cleared-image`) Credit statement naming archive, photographer, and date.
- `path`: Relative repository path where PDF is stored (`public/papers/pdfs/<name>.pdf` for published scans, `sources/pinned/<name>.pdf` for local-only).
- `downloadLog`: Relative path to pinning tool log (`artifacts/facsimile-logs/<key>/<tool-run-id>.jsonl`).
- `termsStatements`: Array of `{ url: string, retrievedAt: string, text: string }` quoting terms verbatim.

### 3.3.1. Facsimile Configuration Consistency

When verified with `--config-dir` (or during default verification against `scripts/sources/facsimile-sources/`), the receipt's `scan` block must remain strictly consistent with the pinned source configuration record:
- `scan.sha256`: Must match `pinned.sha256` (`receipt-config-digest-mismatch`).
- `scan.pageCount`: Must match `pinned.pageCount` (`receipt-config-pagecount-mismatch`).
- `scan.originUrl`: Must match `pinned.originUrl` or candidate URL (`receipt-config-origin-url-mismatch`).
- `scan.acquisitionDate`: Must match `pinned.acquisitionDate` (`receipt-config-acquisition-date-mismatch`).
- Rights fields (`rightsStatus`, `publicationDecision`, `cloudProcessing`, `reuseTerms`): Must match `config.rights` or `pinned` (`receipt-config-rights-mismatch`).
- Missing configuration: If the receipt claims a pinned scan (`publish` or `pin-local-only`), a corresponding `<key>.yaml` file must exist (`receipt-config-missing`).

### 3.4. Page Map (`pageMap`)

Each entry represents exactly one PDF page (1-based `pdfPageIndex` matching the viewer):
- `pdfPageIndex`: 1-based page index (`1` to `pageCount`).
- `printedPage`: Printed journal page number, or `null` for covers/furniture.
- `contents`: Array of closed vocabulary terms:
  - `"front-matter"`
  - `"usage-notice"`
  - `"masthead"`
  - `"article-text"`
  - `"other-article"`
  - `"plate"`
  - `"back-matter"`
- `sectionIds`: Array of section IDs (e.g. `["s1", "s2"]`). For `"other-article"` pages, must be empty `[]`.
- `displayEquations`:
  - `numbered`: Array of printed display equation labels (e.g. `["(1)", "(2)"]`).
  - `unnumbered`: (At pinning time) Count of unnumbered display equations.
  - `unnumberedIds`: (After refinement) Array of allocated unnumbered equation IDs (e.g. `["eq-s4-d1", "eq-s4-d2"]`).
- `footnoteMarks`: Array of footnote mark labels (e.g. `["1)", "*"]`).
- `refinedBy`: (Optional) Bead ID that performed inventory refinement.

#### Refinement Rule:
When an inventory bead refines a page map entry, it sets `refinedBy: "<bead-id>"`, removes `displayEquations.unnumbered`, and supplies `displayEquations.unnumberedIds` in printed order. The checker enforces that `displayEquations.unnumbered` is absent when `refinedBy` is present and that `unnumberedIds` is non-empty.

### 3.5. Witnesses (`witnesses`)

Array of comparison witnesses consulted:
- `kind`: `"collected-papers" | "augsburg" | "wikisource" | "historical-translation" | "other"`
- `identity`: Full bibliographic description.
- `url`: (Optional) URL to witness scan or page.
- `revisionId`: (Optional) Permanent revision ID.
- `availability`: `"available" | "not-found"`
- `checkedAt`: ISO date.
- `rightsStatus`: Rights classification for the witness.
- `notes`: Specific notes on witness fidelity.

**Enforcement:** Every receipt must include at least one `collected-papers` witness and at least one `wikisource` witness (which may record `availability: not-found`).

### 3.6. Transcription (`transcription`)

- `ocrRuns`: Array of OCR pipeline runs:
  - `toolRunId`: Run ID matching standard timestamp-plus-hex format (`run-<timestamp>-<hex>` or `<timestamp>-<hex>`).
  - `adapter`: Adapter name (e.g. `"cloud-gpt5-luna"`).
  - `workerIdentity`: Cloud worker ID.
  - `model`: Model name.
  - `jobIds`: Array of job IDs.
  - `pdfPageRange`: `{ first: number, last: number }`.
  - `startedAt`, `finishedAt`: ISO timestamps.
  - `summaryPath`: Path to OCR run summary artifact.
- `ledgerPath`: Path to diplomatic transcription ledger (`public/papers/transcripts/<key>-reviewed.txt`).
- `ledgerSha256`: Lowercase SHA-256 of the ledger file.
- `ledgerSourcePdfSha256`: Lowercase SHA-256 of the PDF used when authoring the ledger (must match `scan.sha256`).
- `ledgerScopePages`: (Optional) Array of PDF page indices covered by the ledger.
- `printingProvenance`: (Optional) Array of `{ item, kind: "passage" | "numerical-input", printing, pdfPageIndex, printedPage, notes }`.
- `ledgerStatus`: `"not-started" | "in-progress" | "corrected" | "corrected-second-read" | "reviewed"`.
- `editors`: Array of `{ name, role, pages, dates }`.

### 3.7. Typographical Errors (`typographicalErrors`)

Array of suspected historical typographical errors in the source printing:
- `id`: Stable error ID (e.g. `err-typo-p559-1`).
- `locator`: `{ pdfPageIndex: number, printedPage: number, line?: number }`.
- `originalReading`: Text as printed.
- `proposedReading`: Proposed editorial reading.
- `reasoning`: Mathematical or grammatical justification.
- `evidence`: Detailed citation and evidence from context or witnesses (mandatory non-empty string).
- `layer`: `"source" | "translation"`.
- `recordedBy`: Name of editor who identified the item.
- `recordedAt`: ISO date.

### 3.8. Watch List (`watchList`)

Array of transcription items requiring specific verification:
- `id`: Watch item ID.
- `item`: Description of character, formula, or phrase.
- `expectedCheck`: Verification criteria.
- `result`: `"pending" | "matches" | "differs" | "not-found"`.
- `notes`: Outcome notes.
- `checkedBy`, `checkedAt`: Verification attribution.

**Enforcement:** When `ledgerStatus: reviewed`, no watch list item may remain with `result: pending`.

### 3.9. Pending Sections (`pending`)

Array of sections pending completion:
- `section`: Heading name (e.g. `"## Translation credits"`).
- `owner`: Bead ID responsible (e.g. `"am-tran-light-quanta-4b2"`).

---

## 4. Markdown Body & Required Headings

The Markdown body must contain the following 10 level-2 (`##`) headings in exact sequence:

1. `## Identity`
2. `## Scan and rights`
3. `## Page map`
4. `## Comparison witnesses`
5. `## Transcription method`
6. `## Translation credits`
7. `## Editorial boundaries`
8. `## Suspected historical typographical errors`
9. `## Transcription watch list`
10. `## Editorial acceptance`

### 4.1. Pending Section Marker
If a section is unfinished, its body text must be exactly:
```markdown
Status: pending (owner: <bead-id>)
```

### 4.2. Generated Editorial Acceptance Section
Under `## Editorial acceptance`, content generated from review records is enclosed between explicit markers:
```markdown
<!-- generated:editorial-acceptance:start -->
German source review: accepted by Albert Einstein Archives Reviewer on 2026-09-15.
<!-- generated:editorial-acceptance:end -->
```
This section is modified only via `writeGeneratedSection(filePath, "editorial-acceptance", content)`.

---

## 5. SourceAsset Mapping (`receiptToSourceAsset`)

The function `receiptToSourceAsset(receipt)` converts the front matter into a `SourceAsset` record used by the static content compiler:

| `SourceAsset` Field | Mapped From Receipt Field |
|---|---|
| `originUrl` | `scan.originUrl` |
| `acquisitionDate` | `scan.acquisitionDate` |
| `sha256` | `scan.sha256` |
| `mimeType` | `scan.mimeType` |
| `pageCount` | `scan.pageCount` |
| `pageMapping` | `pageMap` |
| `rights.status` | `scan.rightsStatus` |
| `rights.statement` | `scan.termsStatements[].text` (joined by double newline) |
| `rights.source` | `scan.originUrl` |
| `rights.recordedAt` | `scan.acquisitionDate` |
| `rights.reuseTerms` | `scan.reuseTerms` |
| `rights.credit` | `scan.credit` (if present) |
| `publicationDecision` | `scan.publicationDecision` |
| `publicationReason` | `scan.publicationReason` (if present) |
| `cloudProcessing` | `scan.cloudProcessing` |
| `cloudProcessingBasis` | `scan.cloudProcessingBasis` |
| `parentSha256` | `scan.parent.sha256` (if present) |
| `parentPageIndices` | `scan.parent.parentPageIndices` (if present) |

---

## 6. Complete Valid Example (`ap-99-001.md`)

```markdown
---
receiptFormatVersion: 1
receiptKind: facsimile-scan
key: ap-99-001
slug: example-paper
paper:
  titleGerman: "Über ein exemplarisches physikalisches Phänomen"
  titleEnglishWorking: "On an Exemplary Physical Phenomenon"
  authorLine: "A. Einstein"
  dates:
    - type: date-line
      text: "Bern, 15. Mai 1905."
      iso: "1905-05-15"
      precision: day
      source: "Printed date-line at end of paper, p. 4."
      verifiedAt: "2026-09-15"
      confirmedFromScan: true
    - type: received
      iso: "1905-05-20"
      precision: day
      source: "Annalen der Physik received stamp recorded in issue masthead."
      verifiedAt: "2026-09-15"
      confirmedFromScan: true
    - type: issue-publication
      iso: "1905-06-30"
      precision: day
      source: "Issue 6 publication date."
      verifiedAt: "2026-09-15"
      confirmedFromScan: true
  journal:
    name: "Annalen der Physik"
    series: 4
    volume: 99
    wholeSeriesVolume: 404
    issue: 6
    issueSource: "Issue masthead"
    pages:
      first: 1
      last: 4
    doi: "10.1002/andp.19050990601"
    doiVerifiedAt: "2026-09-15"
  collectedPapers:
    volume: 2
    document: 99
scan:
  originUrl: "https://example.org/details/annalen-der-physik-99-001"
  finalUrl: "https://example.org/download/annalen-der-physik-99-001.pdf"
  institution: "State Library Example Collection"
  hostItemId: "item-99-001"
  hostFileName: "annalen-der-physik-99-001.pdf"
  hostFileSource: original
  hostChecksumsVerified: true
  termsStatementUrls:
    - "https://example.org/terms"
  acquisitionDate: "2026-09-15"
  sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  mimeType: "application/pdf"
  pageCount: 4
  embeddedTextLayer: present
  rightsStatus: scan-open-terms
  publicationDecision: publish
  cloudProcessing: permitted
  cloudProcessingBasis: "Open access scan repository terms permit computational analysis."
  reuseTerms: source-terms
  path: "public/papers/pdfs/ap-99-001.pdf"
  downloadLog: "artifacts/facsimile-logs/ap-99-001/run-1789500000000-a1b2c3.jsonl"
  termsStatements:
    - url: "https://example.org/terms"
      retrievedAt: "2026-09-15"
      text: "This digital scan is provided under open access terms permitting free redistribution and academic reuse."
pageMap:
  - pdfPageIndex: 1
    printedPage: 1
    contents:
      - article-text
    sectionIds:
      - s1
    displayEquations:
      numbered:
        - "(1)"
      unnumbered: 0
    footnoteMarks:
      - "1)"
  - pdfPageIndex: 2
    printedPage: 2
    contents:
      - article-text
    sectionIds:
      - s1
      - s2
    displayEquations:
      numbered:
        - "(2)"
      unnumbered: 1
    footnoteMarks: []
  - pdfPageIndex: 3
    printedPage: 3
    contents:
      - article-text
    sectionIds:
      - s2
    displayEquations:
      numbered:
        - "(3)"
      unnumbered: 0
    footnoteMarks: []
  - pdfPageIndex: 4
    printedPage: 4
    contents:
      - article-text
    sectionIds:
      - s3
    displayEquations:
      numbered: []
      unnumbered: 0
    footnoteMarks: []
witnesses:
  - kind: collected-papers
    identity: "The Collected Papers of Albert Einstein, Vol. 2, Doc. 99, Princeton University Press."
    availability: available
    checkedAt: "2026-09-15"
    rightsStatus: in-copyright-witness-only
    notes: "Critical apparatus consulted."
  - kind: wikisource
    identity: "de.wikisource transcription for ap-99-001"
    availability: not-found
    checkedAt: "2026-09-15"
    rightsStatus: public-domain-text
    notes: "No Wikisource page exists."
transcription:
  ocrRuns:
    - toolRunId: "run-1789500000000-a1b2c3"
      adapter: "cloud-gpt5-luna"
      workerIdentity: "luna-worker-01"
      model: "gpt-5.6-luna"
      jobIds:
        - "job-101"
      pdfPageRange:
        first: 1
        last: 4
      startedAt: "2026-09-15T12:00:00Z"
      finishedAt: "2026-09-15T12:02:00Z"
      summaryPath: "artifacts/ocr/ap-99-001/summary.json"
  ledgerPath: "public/papers/transcripts/ap-99-001-reviewed.txt"
  ledgerSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
  ledgerSourcePdfSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  ledgerStatus: in-progress
  editors:
    - name: "Editorial Team"
      role: "Lead Editor"
      pages: "1-4"
      dates: "2026-09-15"
typographicalErrors:
  - id: typo-1
    locator:
      pdfPageIndex: 2
      printedPage: 2
      line: 14
    originalReading: "Teilcheu"
    proposedReading: "Teilchen"
    reasoning: "Broken letter 'n' rendered as 'u'."
    evidence: "Confirmed by letterpress context and CPAE Vol. 2 apparatus."
    layer: source
    recordedBy: "Editorial Team"
    recordedAt: "2026-09-15"
watchList:
  - id: watch-1
    item: "Exponent in equation (2)"
    expectedCheck: "Verify exponent is 2 and not prime mark."
    result: matches
    notes: "Crisp letterpress shows numeral 2."
    checkedBy: "Editorial Team"
    checkedAt: "2026-09-15"
pending:
  - section: "## Translation credits"
    owner: "am-tran-example-paper-101"
---

# Provenance Receipt: ap-99-001

## Identity

Albert Einstein, *Über ein exemplarisches physikalisches Phänomen*, *Annalen der Physik* (4. Folge), Band 99, Seiten 1–4 (1905).

- **Canonical DOI**: `10.1002/andp.19050990601`
- **Collected Papers**: CPAE Vol. 2, Doc. 99.

## Scan and rights

- **Scan Source**: State Library Example Collection
- **SHA-256**: `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`
- **Publication Decision**: `publish`

## Page map

Complete 4-page article map covering PDF pages 1 through 4.

## Comparison witnesses

- The Collected Papers of Albert Einstein, Vol. 2, Doc. 99.
- German Wikisource (consulted; not found).

## Transcription method

Cloud OCR draft prepared via GPT-5.6 Luna worker; diplomatic transcription ledger reviewed against page pixels.

## Translation credits

Status: pending (owner: am-tran-example-paper-101)

## Editorial boundaries

- Source Face: `public/papers/transcripts/ap-99-001-reviewed.txt`
- Pinned PDF: `public/papers/pdfs/ap-99-001.pdf`

## Suspected historical typographical errors

- `typo-1`: Broken letter 'n' on page 2.

## Transcription watch list

- `watch-1`: Exponent in equation (2).

## Editorial acceptance

<!-- generated:editorial-acceptance:start -->
<!-- generated:editorial-acceptance:end -->
```
