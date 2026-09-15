# Rights, Attribution, and Asset Reuse Policy

This document establishes the editorial rights, licensing, scan provenance, attribution, and asset reuse policies for Annus Mirabilis (annus-mirabilis.com).

## Preamble and Nature of Policy

This document defines conservative editorial standards and operational policies for the Annus Mirabilis project. It is not a legal opinion and must not be cited as legal advice. The policy reflects conservative choices designed to respect original authors, historical archives, scanning institutions, translators, and site visitors. Where terms are ambiguous, the project adopts the restrictive option until clarified by an authorized decision.

### Public Domain Cutoff and Recheck Instruction

As of 2026, works published in the United States in 1930 or earlier are in the public domain, because the 95-year copyright term for works published in 1930 expired on December 31, 2025. In jurisdictions applying the rule of the author's life plus 70 years, works by Albert Einstein entered the public domain on January 1, 2026, because Einstein died on April 18, 1955, and the 70-year post-mortem term expired at the end of 2025.

Because the United States public domain eligibility window advances on January 1 of each year, editors and contributors must recheck copyright status upon publication and at the beginning of each calendar year.

---

## Thirteen Core Policy Points

### 1. Historical German Text

The German texts of Albert Einstein's four 1905 papers published in *Annalen der Physik*, his 1905 doctoral dissertation published in *Annalen der Physik* in 1906, and his 1911 published correction are in the public domain:

- *Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt*, Ann. Phys. (4) 17, 132–148 (1905).
- *Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen*, Ann. Phys. (4) 17, 549–560 (1905).
- *Zur Elektrodynamik bewegter Körper*, Ann. Phys. (4) 17, 891–921 (1905).
- *Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?*, Ann. Phys. (4) 18, 639–641 (1905).
- *Eine neue Bestimmung der Moleküldimensionen*, Ann. Phys. (4) 19, 289–306 (1906); correction Ann. Phys. (4) 34, 591–592 (1911).

In the United States, all five works entered the public domain long ago under applicable statutory terms. In life-plus-70 jurisdictions, protection expired at the close of 2025. The original German texts may be transcribed, reproduced, edited, and translated without restriction.

### 2. Scans Are Not the Text

A digital scan file is distinct from the underlying public domain work. Digital reproductions, facsimile scans, and microfilm conversions may carry specific terms, restrictions, or claims asserted by the scanning institution, archive, or library holding the physical volume.

For every pinned scan, the project records in a provenance receipt:
- The exact source retrieval URL.
- Verbatim terms of use quoted from the item page, the institution's repository-wide terms, and any notices embedded directly within the file (such as introductory usage sheets in Google-digitized volumes).
- The retrieval date.
- The cryptographic SHA-256 digest of the downloaded file.

The project prefers scans from digital libraries and archives that offer open, unrestricted public access (such as Internet Archive, HathiTrust full view, or university repositories under open terms). Scans from commercial publisher platforms served under subscription licenses must never be pinned or redistributed.

A host catalog record or metadata field stating "not in copyright" or "public domain" describes the underlying text, not necessarily the scan file. Similarly, microfilm-derived items whose metadata references the journal's modern commercial publisher are not automatically commercial subscription files, but neither are they automatically open. Every item is evaluated strictly on the basis of its stated file terms. If terms cannot be located, the asset status must be recorded as `scan-terms-unknown`.

### 3. Existing English Translations Are Not Reused

The site publishes its own original translation created directly from the original German printings. Existing historical or commercial English translations are handled as follows:

- Historical translations by W. Perrett and G. B. Jeffery (Methuen, 1923; reprinted by Dover; adapted by Fourmilab) and A. D. Cowper (Methuen, 1926; edited by R. Fürth; reprinted by Dover, 1956) are in the public domain in the United States by publication date. However, their copyright status in life-plus-70 jurisdictions depends on the individual translators' dates of death. Because this website is distributed globally, these translations are not republished.
- Modern scholarly translations, such as the translations by Anna Beck (The Collected Papers of Albert Einstein, Princeton University Press, 1989) and the translation of the light quantum paper by A. B. Arons and M. B. Peppard (American Journal of Physics, 1965), remain protected by copyright.

The project never imports or reproduces existing translations as edition text. Historical translations are consulted exclusively as comparison witnesses to evaluate challenging sentences and variant phrasing. This conservative editorial stance ensures legal clarity worldwide and produces a sentence-aligned translation tailored to the bilingual reader.

### 4. Comparison Witnesses

Comparison witnesses include the Princeton Collected Papers transcriptions and critical apparatus, the Augsburg University facsimiles, German Wikisource transcriptions, and published historical translations. These materials may be examined to detect potential typographical errors or verify obscure 1905 idioms, but they must never be copied into the edition ledger, translation text, annotations, or metadata.

An explicit exception is permitted for local, gitignored working files: machine-readable witness text may be placed in a temporary scratch file under `artifacts/` solely to run diff scripts that list textual divergences against our transcriptions. Such files must never be committed to git, and every divergence must be resolved by inspecting the pinned historical facsimile scan.

### 5. Secondary Literature

Modern scholarly articles, monographs, and historical commentaries are treated under standard fair-dealing and fair-use principles:
- Only brief, attributed quotations may be included when directly relevant to textual criticism or historical reception.
- All other background analysis, context, and commentary must be paraphrased in original prose with full bibliographic citations.

### 6. Letters and Correspondence

Historical correspondence, including Einstein's May 1905 letter to Conrad Habicht describing the four papers, must be paraphrased rather than reproduced verbatim. The transcription and translation layers published in *The Collected Papers of Albert Einstein* represent copyrighted editorial work of Princeton University Press and Hebrew University of Jerusalem. Correspondence is cited by date, recipient, and archival identification, with its substantive contents described in original prose.

### 7. Photographs

Public-domain photographs of Albert Einstein may be used across the site, including the home page, timeline, section introductions, and social preview cards. Every photograph must carry a complete source credit naming:
- The holding institution or archive.
- The photographer, when known.
- The date or approximate date of the photograph.

The primary placeholder portrait selected for the 1905 period is Lucien Chavan's patent office portrait of Einstein, circa 1905, held by the ETH-Bibliothek Zürich, Bildarchiv (Identifier: Portr_05937). Use of this image will be confirmed against the archive catalog terms upon acquisition.

Providing this credit is a mandatory requirement. In the asset registry and provenance receipts, the `rights.credit` field is strictly required for every image asset; an image without a verified credit line fails automated verification.

### 8. Name and Likeness

Under the project owner decision of September 14, 2026 (recorded in commit 678cc68, `docs/PLAN_MINING_DECISIONS.md`, and task `am-gov-decision-license-rights-tps`), Albert Einstein's name and historical likeness may be used freely on this non-commercial, open-source educational site.

No personality rights caveats or likeness restrictions apply to this project. Earlier preliminary drafts that suggested avoiding historical portraits or restricting site branding to the year 1905 are superseded. Photographs in the public domain are welcome, subject only to accurate archival source credits as specified in Section 7.

### 9. Rights Layers and Repository Licensing

The project maintains strict separation between its distinct rights layers:
- The original German historical texts (public domain).
- Third-party digital facsimile scans (governed by their respective institutional terms).
- The new English translation (site-original prose).
- Explanatory prose, readings, and historical essays (site-original prose).
- Application code, interactive components, and simulation engines (site-original code).
- Third-party software dependencies and fonts (governed by upstream open-source licenses).
- Pinned numerical code adapted from donor repositories (FrankenSim and Classic Patents), which preserve their original license headers and rider notices.
- Digitized historical datasets (governed by original publication terms and digitization metadata).

The repository `LICENSE` file (MIT License with OpenAI/Anthropic Rider) applies strictly to site code and site-authored prose. It does not grant rights to third-party scans, datasets, fonts, or external assets. Before formal determination under `am-gov-decision-license-rights-tps`, site-original assets carry `rights.reuseTerms: pending-decision`.

### 10. Historical Datasets

Scientific datasets digitized from historical literature (for example, experimental measurements by Perrin, Millikan, Kaufmann, Lummer and Pringsheim, or Rubens and Kurlbaum) must be recorded with:
- Full bibliographic citation of the source publication.
- Exact table, figure, or page number.
- Name of the person or entity who digitized the data.
- The rights status of the original table or chart.

Historical measurements are empirical facts and not subject to copyright, but their presentation, selection, and editorial notes must be documented to maintain scientific transparency and provenance.

### 11. Machine Processing of Scans (Cloud OCR Only)

Submitting page images to external cloud OCR services is a distinct use that must be authorized separately from reading or publishing. Pinned scans must record a `cloudProcessing` determination:
- `permitted`: The scan's stated terms allow third-party machine processing or cloud transfer.
- `forbidden`: The scan's stated terms restrict third-party processing, automated analysis, or cloud transmission.
- `unknown`: The stated terms are silent, unclear, or unverified regarding cloud processing.

Cloud OCR orchestration (`am-src-ocr-orchestrator-u1e0`) executes OCR jobs exclusively for scans marked `cloudProcessing: permitted`. If a scan is marked `unknown`, cloud processing is halted until the project owner makes a written determination. Under no circumstances may an agent presume permission.

Furthermore, in accordance with repository instructions, OCR is never executed locally on developer machines.

### 12. Embedded Third-Party Text Layers

Many archive PDF files contain hidden, computer-generated OCR text layers created by the scanning institution. These embedded text layers:
- Are third-party machine outputs of variable quality.
- Must never be used as transcription sources or authoritative text.
- Must never be accepted as the basis for equations or notation.
- Must never be displayed to visitors as the critical edition text.
- Must never be extracted by automated project scripts.

Provenance receipts record the presence of such layers as `embeddedTextLayer: present`, `absent`, or `unknown`. The cryptographic integrity of the original file is preserved; files are never modified to strip embedded text.

### 13. Per-Asset Reuse Terms

Serving an asset to visitors on the website (`publicationDecision: publish`) is not equivalent to granting unrestricted public reuse. A visitor is invited to read everything published on the site, but whether a reader, teacher, or researcher may incorporate a specific image, diagram, or interactive embed into external materials is decided on a per-asset basis through `rights.reuseTerms`.

- **Third-party scans and figures**: Governed by the terms established by the source archive or original publication.
- **Site-original prose, translations, and figures**: Governed by the project's licensing decisions. Prior to the formal recording of `am-gov-decision-license-rights-tps`, these assets carry `rights.reuseTerms: pending-decision`, indicating that no downstream reuse license is granted yet.
- **Interactive instrument embeds**: Each embeddable instrument (`/embed/lab/[experiment]`) carries an asset record. The embed route provides an attribution footer and link back to the edition, but attribution alone is not a license grant. The exact conditions for embedding or reusing the instrument are defined in the instrument asset's `rights.reuseTerms`.
- **Non-published assets**: Any asset whose `publicationDecision` is `pin-local-only` or `reference-only` must carry `rights.reuseTerms: no-reuse-offered`.
- **No broadening of terms**: Listing an asset in this repository does not relicense it. The site reports recorded terms accurately and never expands them.

---

## Controlled Vocabulary

The project enforces a controlled vocabulary across all `SourceAsset` records. The fields and allowed values are detailed below and defined in machine-readable form in `docs/rights-vocabulary.yaml`.

### Table 1: `rights.status`

| Value | Definition | Required Fields | Implications |
|---|---|---|---|
| `public-domain-text` | Historical text whose public-domain basis is recorded. | `rights.statement`, `rights.recordedAt` | Permits transcription, translation, and publication. In the United States as of 2026, works published in 1930 or earlier are public domain; in life-plus-70 jurisdictions, Einstein works entered the public domain at the end of 2025. |
| `public-domain-image` | A photograph or other image whose public-domain basis is recorded, used with a credit. | `rights.statement`, `rights.source`, `rights.credit`, `rights.recordedAt` | Requires a non-empty `rights.credit` naming archive, photographer where known, and date. Eligible for publication if scan terms allow. |
| `scan-open-terms` | A scan whose stated terms permit reuse and redistribution. | `rights.statement`, `rights.source`, `originUrl`, `acquisitionDate` | Eligible for `publicationDecision: publish` and `cloudProcessing: permitted` if stated terms permit processing. |
| `scan-terms-restrict-redistribution` | A scan whose stated terms restrict re-hosting, redistribution, or commercial use. | `rights.statement`, `rights.source`, `originUrl`, `acquisitionDate` | Implies `publicationDecision` must be `pin-local-only` or `reference-only`, and `rights.reuseTerms` must be `no-reuse-offered`. |
| `scan-terms-unknown` | No terms statement found yet. | `rights.source`, `rights.recordedAt` | Implies `publicationDecision: reference-only` and `cloudProcessing: unknown`. File cannot be pinned, served, or sent to cloud OCR until terms are verified. |
| `site-original-code` | Code written for this site, governed by LICENSE. | `rights.statement` | Governed by repository `LICENSE` (MIT with OpenAI/Anthropic rider). Holds `rights.reuseTerms: pending-decision` until `am-gov-decision-license-rights-tps` is recorded. |
| `site-original-prose` | New prose and the new translation, governed by the license decision. | `rights.statement` | Governed by the upcoming license decision. Holds `rights.reuseTerms: pending-decision` until `am-gov-decision-license-rights-tps` is recorded. |
| `third-party-licensed` | A third-party asset under a named license. | `rights.statement`, `rights.source` | Must comply with named license terms. Eligible for publication if license allows redistribution. |
| `in-copyright-witness-only` | Consulted and cited, never copied. | `rights.statement` | Implies `publicationDecision: reference-only` and `rights.reuseTerms: no-reuse-offered`. Never pinned or served. |
| `cleared-image` | An image with a recorded clearance rather than a public-domain basis. | `rights.statement`, `rights.source`, `rights.credit` | Requires a non-empty `rights.credit`. Eligible for publication within the limits of the clearance record. |

### Table 2: `publicationDecision`

| Value | Definition | Requires Reason | Required Fields | Implications |
|---|---|---|---|---|
| `publish` | Served from `public/` to visitors. | False | (None) | Asset is served publicly. Requires a `rights.status` that permits redistribution. |
| `pin-local-only` | Pinned bytes retained locally outside git and never served. | True | `publicationReason` | Asset is stored in local developer storage for verification but never committed to git or served from `public/`. Requires `rights.reuseTerms: no-reuse-offered`. |
| `reference-only` | Consulted and cited, never pinned. | True | `publicationReason` | Asset is cited in documentation or provenance receipts only; no file is pinned or served. Requires `rights.reuseTerms: no-reuse-offered`. |

### Table 3: `cloudProcessing`

| Value | Definition | Required Fields | Implications |
|---|---|---|---|
| `permitted` | Stated terms permit sending page images or asset bytes to cloud OCR or processing services. | `cloudProcessingBasis`, `rights.recordedAt` | Scan pages may be dispatched to cloud OCR pipelines. Cannot be combined with `scan-terms-unknown`. |
| `forbidden` | Stated terms prohibit third-party machine processing or cloud transfer. | `cloudProcessingBasis`, `rights.recordedAt` | Scan pages must not be dispatched to cloud OCR. Local processing is also prohibited by repository policy. |
| `unknown` | Stated terms are ambiguous, unexamined, or silent on third-party processing. | `cloudProcessingBasis`, `rights.recordedAt` | Cloud OCR is paused for this scan until the project owner makes a determination. Never assumed to be permitted. |

### Table 4: `rights.reuseTerms`

| Value | Definition | Required Fields | Implications |
|---|---|---|---|
| `pending-decision` | A site-original asset awaiting the formal license and rider decision in `am-gov-decision-license-rights-tps`. | `rights.statement` | Asset is served but no public reuse terms are offered yet. Surfaces display pending status. |
| `named-license` | Reuse offered under a named open license (for example MIT, CC-BY-4.0). | `rights.statement`, `rights.source` | Reuse is permitted according to the terms of the license identified in `rights.statement` and linked in `rights.source`. |
| `source-terms` | Reuse governed by the asset's own stated third-party or archive terms, quoted verbatim. | `rights.statement` | Reuse is governed solely by the original source repository or archive terms quoted in `rights.statement`. |
| `no-reuse-offered` | The recorded terms do not support public reuse, or the asset is not published. | `rights.statement` | No reuse permissions are granted to third parties. Mandatory for any asset whose `publicationDecision` is not `publish`. |

---

## Machine-Enforced Constraints

The constraints below are defined in `docs/rights-vocabulary.yaml` and enforced by schema validators in `am-cm-schemas-source-1en`:

1. **`scan-restrict-redistribution-non-publish`**
   - Condition: `rights.status == 'scan-terms-restrict-redistribution'`
   - Consequence: `publicationDecision` must be `pin-local-only` or `reference-only`.
   - Message: "Scans with terms restricting redistribution must not be published; publicationDecision must be pin-local-only or reference-only."

2. **`scan-terms-unknown-reference-and-unknown-cloud`**
   - Condition: `rights.status == 'scan-terms-unknown'`
   - Consequence: `publicationDecision` must be `reference-only` and `cloudProcessing` must be `unknown`.
   - Message: "Assets with unknown scan terms must be reference-only and cloudProcessing must be unknown until terms are located."

3. **`in-copyright-witness-reference-only`**
   - Condition: `rights.status == 'in-copyright-witness-only'`
   - Consequence: `publicationDecision` must be `reference-only`.
   - Message: "In-copyright comparison witnesses must have publicationDecision set to reference-only."

4. **`publish-requires-redistributable-status`**
   - Condition: `publicationDecision == 'publish'`
   - Consequence: `rights.status` must be one of `scan-open-terms`, `public-domain-text`, `public-domain-image`, `site-original-code`, `site-original-prose`, `third-party-licensed`, or `cleared-image`.
   - Message: "Publication requires a status that permits redistribution."

5. **`image-credit-required`**
   - Condition: `rights.status` in `['public-domain-image', 'cleared-image']`
   - Consequence: `rights.credit` must be present and non-empty.
   - Message: "Images (public domain or cleared) require a non-empty rights.credit."

6. **`cloud-permitted-not-unknown-terms`**
   - Condition: `cloudProcessing == 'permitted'`
   - Consequence: `rights.status` must not be `scan-terms-unknown`.
   - Message: "cloudProcessing: permitted cannot be combined with scan-terms-unknown."

7. **`non-publish-no-reuse`**
   - Condition: `publicationDecision` in `['pin-local-only', 'reference-only']`
   - Consequence: `rights.reuseTerms` must be `no-reuse-offered`.
   - Message: "An asset whose publicationDecision is not publish must carry rights.reuseTerms: no-reuse-offered."

8. **`site-original-pending-decision`**
   - Condition: `rights.status` in `['site-original-code', 'site-original-prose']` while license decision is pending
   - Consequence: `rights.reuseTerms` must be `pending-decision` until `am-gov-decision-license-rights-tps` is recorded, and `named-license` thereafter.
   - Message: "Site-original code and prose must carry rights.reuseTerms: pending-decision until am-gov-decision-license-rights-tps is recorded, and named-license thereafter."

9. **`named-license-requires-source`**
   - Condition: `rights.reuseTerms == 'named-license'`
   - Consequence: `rights.source` must be present and non-empty.
   - Message: "rights.reuseTerms: named-license requires a non-empty rights.source URL."

10. **`reuse-terms-requires-statement`**
    - Condition: `rights.reuseTerms` is set
    - Consequence: `rights.statement` must be present and non-empty.
    - Message: "Every rights.reuseTerms determination requires an explanatory rights.statement."

11. **`non-publish-requires-reason`**
    - Condition: `publicationDecision` in `['pin-local-only', 'reference-only']`
    - Consequence: `publicationReason` must be present and non-empty.
    - Message: "A publicationDecision other than publish requires a publicationReason."

---

## How to Record an Asset (Checklist)

When surveying, evaluating, and pinning an asset, complete each step in sequence:

1. **Identify the Item**:
   - Record holding institution, host item identifier, original file name, and whether the file is the host's original upload or a derived asset that the host may regenerate. (Original uploads are strongly preferred because derived files can change bytes over time).
2. **Record Host Checksums and Retrieval Date**:
   - Record any checksums published by the host (such as MD5 or SHA-1 in repository metadata) and the exact retrieval timestamp.
3. **Capture Verbatim Terms from Every Relevant Surface**:
   - Record exact terms of use and URLs from the specific item page, repository-wide policies, and any text embedded in the file itself.
4. **Determine Status, Publication, and Cloud Processing**:
   - Set `rights.status`, `publicationDecision` (providing `publicationReason` if not `publish`), and `cloudProcessing` (with `cloudProcessingBasis` quoting the terms). For images, write `rights.credit`.
5. **Classify Reuse Terms**:
   - Determine `rights.reuseTerms` directly from the quoted terms, never from a site-wide default. In `rights.statement`, explain what downstream reusers may do. For interactive instrument embeds, record terms alongside the embed identifier.
6. **Verify Pinned File Characteristics**:
   - Compute lowercase SHA-256 digest, verify page count, record parent digest and page offsets for extracts, and verify `embeddedTextLayer` (`present`, `absent`, or `unknown`).
7. **Document Scope and Boundary**:
   - State that the classification represents conservative editorial policy, not a legal opinion.
8. **Save Provenance Receipt**:
   - Write the finalized record into `docs/provenance/<key>.md` conforming to the provenance receipt format.

---

## Worked Examples (Illustrative Only)

The following examples illustrate how the controlled vocabulary and constraints apply to hypothetical asset records. They are illustrations for testing and documentation, not determinations regarding specific production assets.

### Example 1: Google-Digitized Volume with Non-Commercial / No-Rehosting Notice

*Scenario*: A whole volume of *Annalen der Physik* (1905) downloaded from Google Books via Internet Archive. The front matter includes a standard Google Books sheet requesting non-commercial use and asking that the file not be re-hosted on third-party servers.

```yaml
id: ap-17-whole-volume-google
originUrl: "https://archive.org/details/annalenderphysik417leip"
acquisitionDate: "2026-09-15"
sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
mimeType: "application/pdf"
pageCount: 1042
rights:
  status: "scan-terms-restrict-redistribution"
  statement: "Front matter notice requests: 'We ask that you use these files for personal, non-commercial purposes... We also ask that you do not systematically scrape or re-host this file.'"
  source: "https://books.google.com/googlebooks/tos.html"
  recordedAt: "2026-09-15"
publicationDecision: "pin-local-only"
publicationReason: "Google front-matter notice requests no third-party re-hosting. Pinned locally outside git for transcription verification only."
cloudProcessing: "unknown"
cloudProcessingBasis: "Notice addresses personal viewing and re-hosting; it is silent regarding cloud OCR processing. Escalated to project owner for decision."
rights.reuseTerms: "no-reuse-offered"
embeddedTextLayer: "present"
```

### Example 2: University Digital Library Scan Under Open Terms

*Scenario*: A university digital repository provides a high-resolution scan of volume 17 with an explicit Public Domain Mark and no redistribution restrictions.

```yaml
id: ap-17-uni-scan-open
originUrl: "https://digital.ub.example.edu/records/ap-17-1905"
acquisitionDate: "2026-09-15"
sha256: "d41d8cd98f00b204e9800998ecf8427e00000000000000000000000000000000"
mimeType: "application/pdf"
pageCount: 32
rights:
  status: "scan-open-terms"
  statement: "Repository marks digital scan as Public Domain (PDM 1.0) with unrestricted downloading and redistribution permitted."
  source: "https://digital.ub.example.edu/terms"
  recordedAt: "2026-09-15"
publicationDecision: "publish"
cloudProcessing: "permitted"
cloudProcessingBasis: "Repository policy places no restrictions on automated analysis or processing of public domain scans."
rights.reuseTerms: "source-terms"
embeddedTextLayer: "absent"
```

### Example 3: Candidate Scan with Unknown Terms

*Scenario*: An independent digital repository hosts a scan of *Annalen der Physik* volume 18, but no terms of service, license mark, or access statement can be located on the web interface.

```yaml
id: ap-18-candidate-unknown
originUrl: "https://archive.example.org/scans/ap18.pdf"
acquisitionDate: "2026-09-15"
sha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
mimeType: "application/pdf"
pageCount: 4
rights:
  status: "scan-terms-unknown"
  statement: "Repository catalog page and document footer inspected; no terms of use found."
  source: "https://archive.example.org/catalog/ap18"
  recordedAt: "2026-09-15"
publicationDecision: "reference-only"
publicationReason: "No terms statement found. File cannot be pinned or published until terms are identified."
cloudProcessing: "unknown"
cloudProcessingBasis: "Terms unknown. Processing paused pending verification."
rights.reuseTerms: "no-reuse-offered"
embeddedTextLayer: "unknown"
```

### Example 4: Historical Archive Photograph

*Scenario*: Lucien Chavan's 1905 patent office portrait of Albert Einstein, obtained from the ETH-Bibliothek Zürich image archive.

```yaml
id: photo-einstein-chavan-1905
originUrl: "https://ba.e-pics.ethz.ch/catalog/ETHBIB.Bildarchiv/Portr_05937"
acquisitionDate: "2026-09-15"
sha256: "9f83c68d71261ae337b34208a0ff1ef7a90977239634f19d2b2707dd642ec345"
mimeType: "image/jpeg"
rights:
  status: "public-domain-image"
  statement: "Photograph created circa 1905. Lucien Chavan died in 1942; photographer term expired at end of 2012 in life-plus-70 jurisdictions. Archive catalog indicates Public Domain Mark."
  source: "https://ba.e-pics.ethz.ch/terms"
  credit: "ETH-Bibliothek Zürich, Bildarchiv, Portr_05937 / Photo: Lucien Chavan (c. 1905)"
  recordedAt: "2026-09-15"
publicationDecision: "publish"
cloudProcessing: "permitted"
cloudProcessingBasis: "Public domain image; no restrictions on machine processing."
rights.reuseTerms: "source-terms"
```

### Example 5: Site-Original Reviewed Figure

*Scenario*: A technical diagram of the Brownian motion osmotic partition created specifically for the Annus Mirabilis edition, shown before and after the repository license decision.

**State A (Before License Decision `am-gov-decision-license-rights-tps`)**:
```yaml
id: fig-bm-osmotic-partition
acquisitionDate: "2026-09-15"
sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
mimeType: "image/svg+xml"
rights:
  status: "site-original-prose"
  statement: "Original explanatory diagram created for Annus Mirabilis. Awaiting formal project license decision."
  recordedAt: "2026-09-15"
publicationDecision: "publish"
cloudProcessing: "permitted"
cloudProcessingBasis: "Site-authored asset; processing permitted."
rights.reuseTerms: "pending-decision"
```

**State B (After License Decision `am-gov-decision-license-rights-tps`)**:
```yaml
id: fig-bm-osmotic-partition
acquisitionDate: "2026-09-15"
sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
mimeType: "image/svg+xml"
rights:
  status: "site-original-prose"
  statement: "Original explanatory diagram released under Creative Commons Attribution 4.0 International (CC BY 4.0)."
  source: "https://creativecommons.org/licenses/by/4.0/"
  recordedAt: "2026-10-01"
publicationDecision: "publish"
cloudProcessing: "permitted"
cloudProcessingBasis: "Site-authored asset; processing permitted."
rights.reuseTerms: "named-license"
```

### Example 6: Interactive Instrument Embed Asset

*Scenario*: Embeddable interactive laboratory instrument for the photoelectric effect (`lq-08`). The embed asset specifies the exact terms under which third-party sites may embed the instrument, accompanied by the unchanged embed snippet.

```yaml
id: embed-instrument-lq-08
originUrl: "https://annus-mirabilis.com/embed/lab/lq-08"
acquisitionDate: "2026-09-15"
rights:
  status: "site-original-code"
  statement: "Interactive instrument embed. Embedding permitted with attribution footer and link back to annus-mirabilis.com intact."
  source: "https://annus-mirabilis.com/about/embedding"
  recordedAt: "2026-09-15"
publicationDecision: "publish"
cloudProcessing: "permitted"
cloudProcessingBasis: "Site-authored interactive code; processing permitted."
rights.reuseTerms: "source-terms"
embedSnippet: '<iframe src="https://annus-mirabilis.com/embed/lab/lq-08" width="100%" height="600" frameborder="0" title="Photoelectric Apparatus (LQ-08)"></iframe>'
```

---

## Decision Log

| Date | Modification | Rationale | Author |
|---|---|---|---|
| 2026-09-14 | Name, likeness, and photograph policy recorded | Commit 678cc68 established that Einstein name and likeness restrictions do not apply to this non-commercial, open-source project. Public-domain photographs welcome with attribution; no likeness caveats. | Project Owner (jemanuel) |
| 2026-09-15 | Version 1 of Rights Policy and Controlled Vocabulary | Initial delivery of docs/RIGHTS.md and docs/rights-vocabulary.yaml covering thirteen policy points, four determinations, constraints, and checklist. | DarkSnow (am-src-rights-policy-1dp) |

---

## Vocabulary Consistency Table

This table verifies that every value in `docs/rights-vocabulary.yaml` has an identical entry and definition in `docs/RIGHTS.md`:

| Determination Category | Vocabulary Value | Required Fields | Detailed in RIGHTS.md |
|---|---|---|---|
| `rights.status` | `public-domain-text` | `rights.statement`, `rights.recordedAt` | Section 1, Table 1 |
| `rights.status` | `public-domain-image` | `rights.statement`, `rights.source`, `rights.credit`, `rights.recordedAt` | Section 7, Table 1 |
| `rights.status` | `scan-open-terms` | `rights.statement`, `rights.source`, `originUrl`, `acquisitionDate` | Section 2, Table 1 |
| `rights.status` | `scan-terms-restrict-redistribution` | `rights.statement`, `rights.source`, `originUrl`, `acquisitionDate` | Section 2, Table 1 |
| `rights.status` | `scan-terms-unknown` | `rights.source`, `rights.recordedAt` | Section 2, Table 1 |
| `rights.status` | `site-original-code` | `rights.statement` | Section 9, Table 1 |
| `rights.status` | `site-original-prose` | `rights.statement` | Section 9, Table 1 |
| `rights.status` | `third-party-licensed` | `rights.statement`, `rights.source` | Section 9, Table 1 |
| `rights.status` | `in-copyright-witness-only` | `rights.statement` | Section 3, Section 4, Table 1 |
| `rights.status` | `cleared-image` | `rights.statement`, `rights.source`, `rights.credit` | Section 7, Table 1 |
| `publicationDecision` | `publish` | (None) | Section 13, Table 2 |
| `publicationDecision` | `pin-local-only` | `publicationReason` | Section 2, Table 2 |
| `publicationDecision` | `reference-only` | `publicationReason` | Section 2, Table 2 |
| `cloudProcessing` | `permitted` | `cloudProcessingBasis`, `rights.recordedAt` | Section 11, Table 3 |
| `cloudProcessing` | `forbidden` | `cloudProcessingBasis`, `rights.recordedAt` | Section 11, Table 3 |
| `cloudProcessing` | `unknown` | `cloudProcessingBasis`, `rights.recordedAt` | Section 11, Table 3 |
| `rights.reuseTerms` | `pending-decision` | `rights.statement` | Section 9, Section 13, Table 4 |
| `rights.reuseTerms` | `named-license` | `rights.statement`, `rights.source` | Section 13, Table 4 |
| `rights.reuseTerms` | `source-terms` | `rights.statement` | Section 13, Table 4 |
| `rights.reuseTerms` | `no-reuse-offered` | `rights.statement` | Section 13, Table 4 |
