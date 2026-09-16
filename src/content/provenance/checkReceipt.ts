/**
 * Comprehensive validator and checker for provenance receipts.
 * Specification: docs/editorial/RECEIPT_FORMAT.md
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { type ParsedReceiptResult, parseReceipt } from "./parseReceipt.ts";
import {
  CLOUD_PROCESSING_VALUES,
  CONTENTS_VOCABULARY,
  DATE_PRECISIONS,
  type DatePrecision,
  LEDGER_STATUS_VALUES,
  PAPER_DATE_TYPES,
  type PaperDate,
  PUBLICATION_DECISION_VALUES,
  RECEIPT_FORMAT_VERSION,
  REUSE_TERMS_VALUES,
  type Receipt,
  type ReceiptFrontMatter,
  RIGHTS_STATUS_VALUES,
  WITNESS_KINDS,
} from "./receiptSchema.ts";
import { parseYaml } from "./yaml.ts";

export type CheckDiagnostic = Readonly<{
  rule: string;
  severity: "error" | "flag";
  path: string;
  message: string;
  expected?: string | undefined;
  actual?: string | undefined;
  repair?: string | undefined;
}>;

export type CheckResult = Readonly<{
  ok: boolean;
  receipt?: Receipt | undefined;
  key: string;
  filePath: string;
  diagnostics: readonly CheckDiagnostic[];
  errors: readonly CheckDiagnostic[];
  flags: readonly CheckDiagnostic[];
}>;

export type CheckOptions = Readonly<{
  requireLocal?: boolean | undefined;
  configDir?: string | undefined;
  rootDir?: string | undefined;
}>;

export function checkReceipt(
  fileContentOrParsed: string | ParsedReceiptResult,
  filePath: string,
  options: CheckOptions = {},
): CheckResult {
  const diagnostics: CheckDiagnostic[] = [];
  const errors: CheckDiagnostic[] = [];
  const flags: CheckDiagnostic[] = [];

  const addError = (
    rule: string,
    p: string,
    message: string,
    expected?: string,
    actual?: string,
    repair?: string,
  ) => {
    const diag: CheckDiagnostic = {
      rule,
      severity: "error",
      path: p,
      message,
      expected,
      actual,
      repair,
    };
    diagnostics.push(diag);
    errors.push(diag);
  };

  const addFlag = (
    rule: string,
    p: string,
    message: string,
    expected?: string,
    actual?: string,
    repair?: string,
  ) => {
    const diag: CheckDiagnostic = {
      rule,
      severity: "flag",
      path: p,
      message,
      expected,
      actual,
      repair,
    };
    diagnostics.push(diag);
    flags.push(diag);
  };

  // 1. Parse receipt if string
  const parsed =
    typeof fileContentOrParsed === "string"
      ? parseReceipt(fileContentOrParsed, filePath)
      : fileContentOrParsed;

  for (const d of parsed.diagnostics) {
    if (d.severity === "error") {
      addError(d.rule, d.path, d.message, d.expected, d.actual);
    } else {
      addFlag(d.rule, d.path, d.message, d.expected, d.actual);
    }
  }

  const fm = parsed.frontMatter;
  if (!fm || typeof fm !== "object") {
    return {
      ok: false,
      key: path.basename(filePath, ".md"),
      filePath,
      diagnostics,
      errors,
      flags,
    };
  }

  const key = typeof fm.key === "string" ? fm.key : path.basename(filePath, ".md");

  // 2. Filename vs key check
  const baseName = path.basename(filePath, ".md");
  if (/^ap-\d+-\d+$/.test(baseName) && fm.key !== baseName) {
    addError(
      "receipt-key-filename-mismatch",
      "key",
      `Receipt key "${fm.key}" does not match filename basename "${baseName}".`,
      baseName,
      fm.key,
      `Set key: ${baseName}`,
    );
  }

  // 3. Schema & Format Version
  if (fm.receiptFormatVersion !== RECEIPT_FORMAT_VERSION) {
    addError(
      "receipt-format-version",
      "receiptFormatVersion",
      `Expected receiptFormatVersion: ${RECEIPT_FORMAT_VERSION}, found ${fm.receiptFormatVersion}.`,
      String(RECEIPT_FORMAT_VERSION),
      String(fm.receiptFormatVersion),
    );
  }

  if (fm.receiptKind !== "facsimile-scan") {
    addError(
      "receipt-kind",
      "receiptKind",
      `Unsupported receiptKind "${fm.receiptKind}". Expected "facsimile-scan".`,
      "facsimile-scan",
      String(fm.receiptKind),
    );
  }

  if (typeof fm.slug !== "string" || !fm.slug) {
    addError("receipt-slug", "slug", "Receipt slug is required.");
  }

  // 4. Paper & Journal Identity
  const paper = fm.paper;
  if (!paper || typeof paper !== "object") {
    addError("receipt-paper", "paper", "Paper identity block is required.");
  } else {
    if (typeof paper.titleGerman !== "string" || !paper.titleGerman) {
      addError("receipt-paper-title-german", "paper.titleGerman", "German title is required.");
    }
    if (typeof paper.titleEnglishWorking !== "string" || !paper.titleEnglishWorking) {
      addError(
        "receipt-paper-title-english",
        "paper.titleEnglishWorking",
        "English working title is required.",
      );
    }
    if (typeof paper.authorLine !== "string" || !paper.authorLine) {
      addError("receipt-paper-author", "paper.authorLine", "Author line is required.");
    }

    const journal = paper.journal;
    if (!journal || typeof journal !== "object") {
      addError("receipt-journal", "paper.journal", "Journal information is required.");
    } else {
      if (typeof journal.name !== "string" || !journal.name) {
        addError("receipt-journal-name", "paper.journal.name", "Journal name is required.");
      }
      if (
        !journal.pages ||
        typeof journal.pages.first !== "number" ||
        typeof journal.pages.last !== "number"
      ) {
        addError(
          "receipt-journal-pages",
          "paper.journal.pages",
          "Journal pages {first, last} are required.",
        );
      } else {
        const keyMatch = key.match(/^ap-\d+-(\d+)$/);
        if (keyMatch) {
          const expectedFirstPage = Number(keyMatch[1]);
          if (journal.pages.first !== expectedFirstPage) {
            addError(
              "receipt-journal-first-page",
              "paper.journal.pages.first",
              `Journal first page (${journal.pages.first}) must equal first page in key (${expectedFirstPage}).`,
              String(expectedFirstPage),
              String(journal.pages.first),
            );
          }
        }
        if (journal.pages.last < journal.pages.first) {
          addError(
            "receipt-journal-page-order",
            "paper.journal.pages",
            `Journal last page (${journal.pages.last}) cannot be less than first page (${journal.pages.first}).`,
          );
        }
      }

      // DOI validation
      if (
        typeof journal.doi !== "string" ||
        !/^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(journal.doi)
      ) {
        addError(
          "receipt-journal-doi-invalid",
          "paper.journal.doi",
          `Invalid canonical DOI format "${journal.doi}".`,
        );
      }
      if (typeof journal.doiVerifiedAt !== "string" || !journal.doiVerifiedAt) {
        addError(
          "receipt-journal-doi-verified",
          "paper.journal.doiVerifiedAt",
          "doiVerifiedAt date is required.",
        );
      }
    }

    // Collected papers check
    if (!paper.collectedPapers || typeof paper.collectedPapers.volume !== "number") {
      addError("receipt-cpae", "paper.collectedPapers", "Collected papers reference is required.");
    }

    // Dates validation
    if (!Array.isArray(paper.dates) || paper.dates.length === 0) {
      addError("receipt-dates", "paper.dates", "Dates array is required and must be non-empty.");
    } else {
      for (let i = 0; i < paper.dates.length; i++) {
        const d = paper.dates[i] as PaperDate;
        const p = `paper.dates[${i}]`;
        if (!PAPER_DATE_TYPES.includes(d.type)) {
          addError(
            "receipt-date-type",
            `${p}.type`,
            `Invalid date type "${d.type}".`,
            PAPER_DATE_TYPES.join(" | "),
            String(d.type),
          );
        }
        if (!DATE_PRECISIONS.includes(d.precision)) {
          addError(
            "receipt-date-precision",
            `${p}.precision`,
            `Invalid date precision "${d.precision}".`,
            DATE_PRECISIONS.join(" | "),
            String(d.precision),
          );
        }
        if (typeof d.iso !== "string" || !isValidIsoDate(d.iso, d.precision)) {
          addError(
            "receipt-date-iso",
            `${p}.iso`,
            `Invalid or untyped ISO date "${d.iso}" for precision "${d.precision}".`,
          );
        }
        if (typeof d.verifiedAt !== "string" || !d.verifiedAt) {
          addError("receipt-date-verified", `${p}.verifiedAt`, "verifiedAt date is required.");
        }
      }

      // Chronology checks
      validateChronology(paper.dates, addError);
    }
  }

  // 5. Scan Block & Digest Checks
  const scan = fm.scan;
  if (!scan || typeof scan !== "object") {
    addError("receipt-scan", "scan", "Scan block is required.");
  } else {
    // SHA256 validation: lowercase 64-char hex string
    if (typeof scan.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(scan.sha256)) {
      addError(
        "receipt-scan-sha256-invalid",
        "scan.sha256",
        `Invalid scan SHA-256 digest "${scan.sha256}". Must be lowercase 64-character hexadecimal string.`,
      );
    }

    if (scan.parent) {
      if (typeof scan.parent.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(scan.parent.sha256)) {
        addError(
          "receipt-parent-sha256-invalid",
          "scan.parent.sha256",
          `Invalid parent SHA-256 digest "${scan.parent.sha256}". Must be lowercase 64-character hexadecimal string.`,
        );
      }
    }

    if (typeof scan.pageCount !== "number" || scan.pageCount <= 0) {
      addError(
        "receipt-scan-pagecount",
        "scan.pageCount",
        "scan.pageCount must be a positive integer.",
      );
    }

    // Rights status validation
    if (!RIGHTS_STATUS_VALUES.includes(scan.rightsStatus)) {
      addError(
        "receipt-rights-status-invalid",
        "scan.rightsStatus",
        `Invalid rightsStatus "${scan.rightsStatus}".`,
        RIGHTS_STATUS_VALUES.join(" | "),
        String(scan.rightsStatus),
      );
    }

    if (!PUBLICATION_DECISION_VALUES.includes(scan.publicationDecision)) {
      addError(
        "receipt-publication-decision-invalid",
        "scan.publicationDecision",
        `Invalid publicationDecision "${scan.publicationDecision}".`,
        PUBLICATION_DECISION_VALUES.join(" | "),
        String(scan.publicationDecision),
      );
    }

    if (!CLOUD_PROCESSING_VALUES.includes(scan.cloudProcessing)) {
      addError(
        "receipt-cloud-processing-invalid",
        "scan.cloudProcessing",
        `Invalid cloudProcessing "${scan.cloudProcessing}".`,
        CLOUD_PROCESSING_VALUES.join(" | "),
        String(scan.cloudProcessing),
      );
    }

    if (!REUSE_TERMS_VALUES.includes(scan.reuseTerms)) {
      addError(
        "receipt-reuse-terms-invalid",
        "scan.reuseTerms",
        `Invalid reuseTerms "${scan.reuseTerms}".`,
        REUSE_TERMS_VALUES.join(" | "),
        String(scan.reuseTerms),
      );
    }

    // Vocabulary & Rights constraints
    if (
      scan.rightsStatus === "scan-terms-restrict-redistribution" &&
      scan.publicationDecision === "publish"
    ) {
      addError(
        "receipt-rights-restrict-publish",
        "scan.publicationDecision",
        "Scans with scan-terms-restrict-redistribution cannot have publicationDecision: publish.",
      );
    }

    if (
      (scan.rightsStatus === "public-domain-image" || scan.rightsStatus === "cleared-image") &&
      (!scan.credit || !scan.credit.trim())
    ) {
      addError(
        "receipt-image-credit-required",
        "scan.credit",
        `rightsStatus "${scan.rightsStatus}" requires a non-empty credit field.`,
      );
    }

    if (scan.publicationDecision !== "publish" && scan.reuseTerms !== "no-reuse-offered") {
      addError(
        "receipt-nonpublish-no-reuse",
        "scan.reuseTerms",
        `An asset with publicationDecision "${scan.publicationDecision}" must have reuseTerms: no-reuse-offered.`,
      );
    }

    if (
      scan.publicationDecision !== "publish" &&
      (!scan.publicationReason || !scan.publicationReason.trim())
    ) {
      addError(
        "receipt-nonpublish-reason-required",
        "scan.publicationReason",
        `publicationDecision "${scan.publicationDecision}" requires a publicationReason.`,
      );
    }

    if (scan.reuseTerms === "named-license" && (!scan.originUrl || !scan.originUrl.trim())) {
      addError(
        "receipt-named-license-source-required",
        "scan.originUrl",
        "reuseTerms: named-license requires a non-empty source URL.",
      );
    }

    if (scan.publicationDecision === "publish" && typeof scan.path === "string") {
      if (!scan.path.startsWith("public/papers/pdfs/")) {
        addError(
          "receipt-publish-path",
          "scan.path",
          `Published scan path must be under public/papers/pdfs/, found "${scan.path}".`,
        );
      }
    }

    if (scan.publicationDecision === "pin-local-only" && typeof scan.path === "string") {
      if (!scan.path.startsWith("sources/pinned/")) {
        addError(
          "receipt-pin-local-path",
          "scan.path",
          `pin-local-only scan path must be under sources/pinned/, found "${scan.path}".`,
        );
      }
    }

    // Local file availability check
    if (typeof scan.path === "string" && scan.publicationDecision === "pin-local-only") {
      const resolvedPath = options.rootDir ? path.join(options.rootDir, scan.path) : scan.path;
      if (!fs.existsSync(resolvedPath)) {
        if (options.requireLocal) {
          addError(
            "receipt-local-file-missing",
            "scan.path",
            `Local-only pinned file missing at "${scan.path}" under --require-local.`,
          );
        } else {
          addFlag(
            "receipt-local-file-not-available",
            "scan.path",
            `Local-only pinned file not present on this machine: "${scan.path}".`,
          );
        }
      } else {
        // Verify SHA256 of local file if present
        try {
          const fileBuf = fs.readFileSync(resolvedPath);
          const actualSha = crypto.createHash("sha256").update(fileBuf).digest("hex");
          if (actualSha !== scan.sha256) {
            addError(
              "receipt-local-file-digest-mismatch",
              "scan.sha256",
              `Actual file SHA-256 (${actualSha}) disagrees with scan.sha256 (${scan.sha256}).`,
            );
          }
        } catch {
          // ignore read error
        }
      }
    }

    // Facsimile sources config consistency check
    if (options.configDir) {
      const configPath = path.join(options.configDir, `${key}.yaml`);
      if (fs.existsSync(configPath)) {
        try {
          const cfgText = fs.readFileSync(configPath, "utf8");
          const cfg = parseYaml(cfgText) as Record<string, unknown>;
          const pinnedCfg = (cfg.pinned || cfg) as Record<string, unknown>;
          if (pinnedCfg.sha256 && pinnedCfg.sha256 !== scan.sha256) {
            addError(
              "receipt-config-digest-mismatch",
              "scan.sha256",
              `scan.sha256 (${scan.sha256}) disagrees with configuration record (${pinnedCfg.sha256}).`,
            );
          }
          if (pinnedCfg.pageCount && pinnedCfg.pageCount !== scan.pageCount) {
            addError(
              "receipt-config-pagecount-mismatch",
              "scan.pageCount",
              `scan.pageCount (${scan.pageCount}) disagrees with configuration record (${pinnedCfg.pageCount}).`,
            );
          }
        } catch (e) {
          addError(
            "receipt-config-read-error",
            "config",
            `Failed to parse configuration record at ${configPath}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      } else if (
        scan.publicationDecision === "publish" ||
        scan.publicationDecision === "pin-local-only"
      ) {
        addError(
          "receipt-config-missing",
          "config",
          `Receipt claims pinned scan for "${key}" but no configuration record found in ${options.configDir}.`,
        );
      }
    }
  }

  // 6. Page Map Checks
  const pageMap = fm.pageMap;
  if (!Array.isArray(pageMap) || pageMap.length === 0) {
    addError("receipt-pagemap", "pageMap", "pageMap array is required.");
  } else {
    if (scan && pageMap.length !== scan.pageCount) {
      addError(
        "receipt-pagemap-count",
        "pageMap",
        `pageMap length (${pageMap.length}) does not match scan.pageCount (${scan.pageCount}).`,
      );
    }

    const seenIndices = new Set<number>();
    let lastArticlePrintedPage: number | null = null;

    for (let i = 0; i < pageMap.length; i++) {
      const entry = pageMap[i]!;
      const p = `pageMap[${i}]`;

      if (typeof entry.pdfPageIndex !== "number") {
        addError(
          "receipt-pagemap-index",
          `${p}.pdfPageIndex`,
          "pdfPageIndex is required and must be a number.",
        );
      } else {
        if (seenIndices.has(entry.pdfPageIndex)) {
          addError(
            "receipt-pagemap-duplicate-index",
            `${p}.pdfPageIndex`,
            `Duplicate pdfPageIndex ${entry.pdfPageIndex}.`,
          );
        }
        seenIndices.add(entry.pdfPageIndex);
      }

      // Check contents vocabulary
      if (!Array.isArray(entry.contents) || entry.contents.length === 0) {
        addError("receipt-pagemap-contents", `${p}.contents`, "contents array is required.");
      } else {
        for (const c of entry.contents) {
          if (!CONTENTS_VOCABULARY.includes(c)) {
            addError(
              "receipt-pagemap-contents-invalid",
              `${p}.contents`,
              `Invalid contents value "${c}".`,
              CONTENTS_VOCABULARY.join(" | "),
              String(c),
            );
          }
        }
      }

      // other-article pages must carry no sectionIds
      if (entry.contents?.includes("other-article")) {
        if (Array.isArray(entry.sectionIds) && entry.sectionIds.length > 0) {
          addError(
            "receipt-pagemap-other-article-sections",
            `${p}.sectionIds`,
            "other-article pages must carry no sectionIds.",
          );
        }
      }

      // article-text pages printed range & non-decreasing order
      if (entry.contents?.includes("article-text")) {
        if (typeof entry.printedPage !== "number") {
          addError(
            "receipt-pagemap-printed-page",
            `${p}.printedPage`,
            "article-text page requires printedPage.",
          );
        } else {
          if (paper?.journal?.pages) {
            if (
              entry.printedPage < paper.journal.pages.first ||
              entry.printedPage > paper.journal.pages.last
            ) {
              addError(
                "receipt-pagemap-printed-page-range",
                `${p}.printedPage`,
                `printedPage ${entry.printedPage} is outside journal range ${paper.journal.pages.first}–${paper.journal.pages.last}.`,
              );
            }
          }

          if (lastArticlePrintedPage !== null && entry.printedPage < lastArticlePrintedPage) {
            addError(
              "receipt-pagemap-decreasing-pages",
              `${p}.printedPage`,
              `printedPage ${entry.printedPage} decreased from previous article page ${lastArticlePrintedPage}.`,
            );
          }
          lastArticlePrintedPage = entry.printedPage;
        }
      }

      // Refinement check
      if (entry.refinedBy) {
        if (entry.displayEquations && typeof entry.displayEquations.unnumbered === "number") {
          addError(
            "receipt-pagemap-refined-has-unnumbered",
            `${p}.displayEquations.unnumbered`,
            `Refined page map entry (refinedBy: ${entry.refinedBy}) must replace unnumbered count with unnumberedIds.`,
          );
        }
        if (
          !entry.displayEquations ||
          !Array.isArray(entry.displayEquations.unnumberedIds) ||
          entry.displayEquations.unnumberedIds.length === 0
        ) {
          addError(
            "receipt-pagemap-refined-no-unnumbered-ids",
            `${p}.displayEquations.unnumberedIds`,
            `Refined page map entry (refinedBy: ${entry.refinedBy}) requires non-empty unnumberedIds.`,
          );
        }
      }
    }

    // Check PDF indices cover 1 to scan.pageCount exactly
    if (scan && typeof scan.pageCount === "number") {
      for (let pageNum = 1; pageNum <= scan.pageCount; pageNum++) {
        if (!seenIndices.has(pageNum)) {
          addError(
            "receipt-pagemap-missing-page",
            "pageMap",
            `pageMap is missing PDF page index ${pageNum} (expected 1 to ${scan.pageCount}).`,
          );
        }
      }
    }
  }

  // 7. Witnesses Checks
  const witnesses = fm.witnesses;
  if (!Array.isArray(witnesses) || witnesses.length === 0) {
    addError("receipt-witnesses", "witnesses", "witnesses array is required.");
  } else {
    let hasCpae = false;
    let hasWikisource = false;

    for (let i = 0; i < witnesses.length; i++) {
      const w = witnesses[i]!;
      const p = `witnesses[${i}]`;

      if (!WITNESS_KINDS.includes(w.kind)) {
        addError(
          "receipt-witness-kind",
          `${p}.kind`,
          `Invalid witness kind "${w.kind}".`,
          WITNESS_KINDS.join(" | "),
          String(w.kind),
        );
      }

      if (w.kind === "collected-papers") hasCpae = true;
      if (w.kind === "wikisource") hasWikisource = true;

      if (!["available", "not-found"].includes(w.availability)) {
        addError(
          "receipt-witness-availability",
          `${p}.availability`,
          `Invalid witness availability "${w.availability}". Expected "available" | "not-found".`,
        );
      }
    }

    if (!hasCpae) {
      addError(
        "receipt-witness-missing-cpae",
        "witnesses",
        "Witnesses list must contain a collected-papers entry.",
      );
    }
    if (!hasWikisource) {
      addError(
        "receipt-witness-missing-wikisource",
        "witnesses",
        "Witnesses list must contain a wikisource entry.",
      );
    }
  }

  // 8. Transcription & Ledger Checks
  const transcription = fm.transcription;
  if (!transcription || typeof transcription !== "object") {
    addError("receipt-transcription", "transcription", "transcription block is required.");
  } else {
    if (!LEDGER_STATUS_VALUES.includes(transcription.ledgerStatus)) {
      addError(
        "receipt-ledger-status",
        "transcription.ledgerStatus",
        `Invalid ledgerStatus "${transcription.ledgerStatus}".`,
        LEDGER_STATUS_VALUES.join(" | "),
        String(transcription.ledgerStatus),
      );
    }

    if (transcription.ledgerSourcePdfSha256) {
      if (!/^[0-9a-f]{64}$/.test(transcription.ledgerSourcePdfSha256)) {
        addError(
          "receipt-ledger-source-pdf-sha256-invalid",
          "transcription.ledgerSourcePdfSha256",
          "ledgerSourcePdfSha256 must be a lowercase 64-character hexadecimal digest.",
        );
      } else if (scan && transcription.ledgerSourcePdfSha256 !== scan.sha256) {
        addError(
          "receipt-ledger-source-pdf-sha256-mismatch",
          "transcription.ledgerSourcePdfSha256",
          `ledgerSourcePdfSha256 (${transcription.ledgerSourcePdfSha256}) does not match scan.sha256 (${scan.sha256}).`,
        );
      }
    }

    // OCR runs validation
    if (Array.isArray(transcription.ocrRuns)) {
      const seenToolRunIds = new Set<string>();
      for (let i = 0; i < transcription.ocrRuns.length; i++) {
        const run = transcription.ocrRuns[i]!;
        const p = `transcription.ocrRuns[${i}]`;

        if (typeof run.toolRunId !== "string" || !isValidToolRunId(run.toolRunId)) {
          addError(
            "receipt-tool-run-id-invalid",
            `${p}.toolRunId`,
            `Invalid toolRunId format "${run.toolRunId}". Expected run-<timestamp|digits>-<hex> format.`,
          );
        } else {
          if (seenToolRunIds.has(run.toolRunId)) {
            addError(
              "receipt-tool-run-id-duplicate",
              `${p}.toolRunId`,
              `Duplicate toolRunId "${run.toolRunId}" in ocrRuns.`,
            );
          }
          seenToolRunIds.add(run.toolRunId);
        }
      }
    }

    // Status: reviewed checks
    if (transcription.ledgerStatus === "reviewed") {
      const acceptance = parsed.editorialAcceptanceContent || "";
      const hasGermanReviewRecord =
        /German source review/i.test(acceptance) ||
        /reviewed by/i.test(acceptance) ||
        /accepted/i.test(acceptance);

      if (!hasGermanReviewRecord) {
        addError(
          "receipt-reviewed-no-acceptance",
          "transcription.ledgerStatus",
          "ledgerStatus: reviewed requires a German source review acceptance record in the editorial acceptance section.",
        );
      }

      // Check watchlist: no items can be pending
      if (Array.isArray(fm.watchList)) {
        for (let i = 0; i < fm.watchList.length; i++) {
          const item = fm.watchList[i]!;
          if (item.result === "pending") {
            addError(
              "receipt-reviewed-pending-watchlist",
              `watchList[${i}]`,
              `ledgerStatus is reviewed but watchList item "${item.id}" is still pending.`,
            );
          }
        }
      }
    }
  }

  // 9. Typographical Errors
  if (Array.isArray(fm.typographicalErrors)) {
    for (let i = 0; i < fm.typographicalErrors.length; i++) {
      const typo = fm.typographicalErrors[i]!;
      const p = `typographicalErrors[${i}]`;
      if (!typo.evidence || !typo.evidence.trim()) {
        addError(
          "receipt-typo-no-evidence",
          `${p}.evidence`,
          `Typographical error "${typo.id || i}" is missing evidence.`,
        );
      }
    }
  }

  // 10. Watchlist Flags (when not reviewed)
  if (transcription?.ledgerStatus !== "reviewed" && Array.isArray(fm.watchList)) {
    for (let i = 0; i < fm.watchList.length; i++) {
      const item = fm.watchList[i]!;
      if (item.result === "pending") {
        addFlag(
          "receipt-watchlist-pending",
          `watchList[${i}]`,
          `Watch-list item "${item.id}" is pending under ledgerStatus "${transcription?.ledgerStatus}".`,
        );
      }
    }
  }

  // 11. Pending Section Flags
  if (Array.isArray(fm.pending) && fm.pending.length > 0) {
    for (let i = 0; i < fm.pending.length; i++) {
      const pend = fm.pending[i]!;
      addFlag(
        "receipt-section-pending",
        `pending[${i}]`,
        `Section "${pend.section}" is pending (owner: ${pend.owner}).`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    receipt: parsed.receipt,
    key,
    filePath,
    diagnostics,
    errors,
    flags,
  };
}

function isValidIsoDate(iso: string, precision: DatePrecision): boolean {
  if (precision === "year") {
    return /^\d{4}$/.test(iso);
  }
  if (precision === "month") {
    return /^\d{4}-(?:0[1-9]|1[0-2])$/.test(iso);
  }
  return /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(iso);
}

function isValidToolRunId(id: string): boolean {
  // run-<timestamp|digits>-<hex> or <timestamp>-<hex> (at least 6 digits/chars before hex suffix)
  if (/^run-\d+$/.test(id)) return false; // run-1 is invalid
  return /^(?:run-)?(?:\d{6,}|\d{4}-\d{2}-\d{2}(?:T[\d:]+Z?)?)-[0-9a-fA-F]+$/.test(id);
}

function validateChronology(
  dates: readonly PaperDate[],
  addError: (rule: string, path: string, message: string) => void,
): void {
  const dateline = dates.find((d) => d.type === "date-line");
  const received = dates.find((d) => d.type === "received");
  const publication = dates.find((d) => d.type === "issue-publication");

  if (dateline && received) {
    const comp = compareDatesAtCoarserPrecision(received, dateline);
    if (comp < 0) {
      addError(
        "receipt-chronology-received-before-dateline",
        "paper.dates",
        `Paper received date (${received.iso}) is before date-line (${dateline.iso}).`,
      );
    }
  }

  if (received && publication) {
    const comp = compareDatesAtCoarserPrecision(publication, received);
    if (comp < 0) {
      addError(
        "receipt-chronology-published-before-received",
        "paper.dates",
        `Issue publication date (${publication.iso}) is before received date (${received.iso}).`,
      );
    }
  }
}

export function compareDatesAtCoarserPrecision(d1: PaperDate, d2: PaperDate): number {
  const precisionOrder: Record<DatePrecision, number> = { year: 0, month: 1, day: 2 };
  const coarser =
    precisionOrder[d1.precision] <= precisionOrder[d2.precision] ? d1.precision : d2.precision;

  const getNorm = (d: PaperDate, prec: DatePrecision): string => {
    if (prec === "year") return d.iso.slice(0, 4);
    if (prec === "month") return d.iso.slice(0, 7);
    return d.iso;
  };

  const str1 = getNorm(d1, coarser);
  const str2 = getNorm(d2, coarser);

  if (str1 < str2) return -1;
  if (str1 > str2) return 1;
  return 0;
}
