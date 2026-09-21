---
receiptFormatVersion: 1
receiptKind: facsimile-scan
key: fixture-scoped
slug: fixture-two-ledger
paper:
  titleGerman: "Berichtigung zu meiner Arbeit"
  titleEnglishWorking: "Correction to My Work"
  authorLine: "A. Einstein"
  dates:
    - type: received
      iso: "1911-01-21"
      precision: day
      source: "Printed date-line"
      verifiedAt: "2026-09-17"
  journal:
    name: "Annalen der Physik"
    series: 4
    volume: 34
    wholeSeriesVolume: 339
    issue: 3
    issueSource: "Crossref"
    pages:
      first: 549
      last: 560
    doi: "10.1002/andp.19113390313"
    doiVerifiedAt: "2026-09-17"
  collectedPapers:
    volume: 3
    document: 14
scan:
  originUrl: "https://example.org/scan.pdf"
  finalUrl: "https://example.org/scan.pdf"
  institution: "Test Archive"
  hostItemId: "test-item"
  hostFileName: "test.pdf"
  hostFileSource: derivative
  hostChecksumsVerified: true
  termsStatementUrls:
    - "https://example.org/terms"
  acquisitionDate: "2026-09-17"
  sha256: "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f"
  mimeType: "application/pdf"
  pageCount: 3
  embeddedTextLayer: present
  rightsStatus: public-domain-text
  publicationDecision: publish
  cloudProcessing: permitted
  cloudProcessingBasis: "Public domain"
  reuseTerms: source-terms
  path: "public/papers/pdfs/test.pdf"
  downloadLog: "test.jsonl"
  termsStatements: []
pageMap:
  - pdfPageIndex: 1
    printedPage: 549
    contents:
      - masthead
      - article-text
    sectionIds:
      - s1
    displayEquations:
      numbered:
        - "(1)"
    footnoteMarks: []
  - pdfPageIndex: 2
    printedPage: 550
    contents:
      - article-text
    sectionIds:
      - s1
    displayEquations:
      numbered: []
    footnoteMarks: []
  - pdfPageIndex: 3
    printedPage: 551
    contents:
      - article-text
      - back-matter
    sectionIds:
      - s1
    displayEquations:
      numbered: []
    footnoteMarks: []
witnesses: []
transcription:
  ocrRuns: []
  ledgerPath: "src/testing/fixtures/ledgers/fixture-scoped-reviewed.txt"
  ledgerSha256: "965eaed0a5d4977c8ff7b14dd2fa17113349bd9dcd871c9ee3068332b974f93e"
  ledgerSourcePdfSha256: "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f"
  ledgerScopePages:
    - 1
    - 3
  ledgerStatus: corrected
  editors: []
typographicalErrors:
  - id: typo-1
    locator:
      pdfPageIndex: 1
      printedPage: 549
    originalReading: "(1)"
    proposedReading: "(1)"
    reasoning: "Test anomaly"
    evidence: "Scan"
    layer: source
    recordedBy: "jemanuel"
    recordedAt: "2026-09-17"
watchList: []
pending: []
---

## Identity
Fixture scoped.

## Scan and rights
Fixture scan.

## Page map
Fixture page map.

## Comparison witnesses
Fixture witnesses.

## Transcription method
Reviewed diplomatic German transcription.

## Translation credits
None.

## Editorial boundaries
Scoped article.

## Suspected historical typographical errors
None.

## Transcription watch list
None.

## Editorial acceptance
<!-- generated:editorial-acceptance:start -->
Accepted for testing.
<!-- generated:editorial-acceptance:end -->
