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
  parent:
    sha256: "not-a-valid-sha256-digest"
    pageCount: 100
    parentPageIndices: [1, 2, 3, 4]
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
