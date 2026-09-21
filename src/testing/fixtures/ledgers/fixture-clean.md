---
receiptFormatVersion: 1
receiptKind: facsimile-scan
key: fixture-clean
slug: brownian-motion
paper:
  titleGerman: "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen"
  titleEnglishWorking: "On the Movement of Small Particles Suspended in Stationary Liquids Required by the Molecular-Kinetic Theory of Heat"
  authorLine: "A. Einstein"
  dates:
    - type: date-line
      text: "Bern, Mai 1905."
      iso: "1905-05"
      precision: month
      source: "Printed date-line"
      verifiedAt: "2026-09-17"
    - type: received
      iso: "1905-05-11"
      precision: day
      source: "Annalen der Physik"
      verifiedAt: "2026-09-17"
    - type: issue-publication
      iso: "1905-07-18"
      precision: day
      source: "Issue 8"
      verifiedAt: "2026-09-17"
  journal:
    name: "Annalen der Physik"
    series: 4
    volume: 17
    wholeSeriesVolume: 322
    issue: 8
    issueSource: "Issue 8"
    pages:
      first: 549
      last: 560
    doi: "10.1002/andp.19053220806"
    doiVerifiedAt: "2026-09-17"
  collectedPapers:
    volume: 2
    document: 16
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
  pageCount: 2
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
    footnoteMarks:
      - "1)"
  - pdfPageIndex: 2
    printedPage: 550
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
  ledgerPath: "src/testing/fixtures/ledgers/fixture-clean-reviewed.txt"
  ledgerSha256: "86fdb373b45101bcea32d7311812ac47de028cc4fc80ee9e0d2a93f3f9fb8f3b"
  ledgerSourcePdfSha256: "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f"
  # REVIEWED, and coherently so - the second of exactly two fixtures that open
  # "--- REVIEWED TRANSCRIPTION ---". Its pair is two-page-valid, repaired in ea3923a8; this one is
  # consumed from scripts/, so running src/content/ledger/ could never have surfaced it and the
  # central lane caught it instead. `corrected` contradicted the receipt's own editor block below,
  # which was already present and already named a Reviewer, so advancing the status makes the
  # record agree with itself rather than with the gate.
  ledgerStatus: reviewed
  editors:
    - name: "Test Editor"
      role: "Reviewer"
      pages: [1, 2]
      dates: "2026-09-17"
typographicalErrors: []
watchList: []
pending: []
---

## Identity
Fixture clean.

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
Full article.

## Suspected historical typographical errors
None.

## Transcription watch list
None.

## Editorial acceptance
<!-- generated:editorial-acceptance:start -->
Accepted for testing.
<!-- generated:editorial-acceptance:end -->
