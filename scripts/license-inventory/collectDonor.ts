/**
 * Collect Extracted Donor Code and Validate Attribution Headers.
 * Bead: am-gov-license-inventory-w6yz
 */

import { join } from "node:path";
import type { LicenseItem } from "./types.ts";

export interface CollectDonorOptions {
  readonly rootDir: string;
  readonly auditMarkdown: string;
  readonly readText: (path: string) => string | null;
  readonly exists: (path: string) => boolean;
}

export interface DonorExtractedEntry {
  readonly sourcePath: string;
  readonly destPath: string;
  readonly noticeForm: string;
}

export function parseDonorAuditExtractedFiles(markdown: string): DonorExtractedEntry[] {
  const entries: DonorExtractedEntry[] = [];
  const lines = markdown.split("\n");

  let inSection11 = false;

  for (const line of lines) {
    if (line.startsWith("## 11. Extracted Files") || line.startsWith("## 11. ")) {
      inSection11 = true;
      continue;
    }
    if (inSection11 && line.startsWith("## ") && !line.startsWith("## 11")) {
      break;
    }

    if (!inSection11) continue;

    // Match table row with sourcePath and destPath
    // e.g. | `src/physics/controlTape.ts` | `src/experiments/tape/controlTape.ts` (`am-scaf-...`) | ... | header | ...
    const match = line.match(
      /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`(?:\s*\([^)]*\))?\s*\|(?:[^|]*\|){5}\s*([^|]+)\s*\|/,
    );
    if (match) {
      const [, rawSource, rawDest, rawNotice] = match;
      if (!rawSource || !rawDest || !rawNotice) continue;
      const sourcePath = rawSource.trim();
      const destPath = rawDest.trim();
      const noticeForm = rawNotice.trim().toLowerCase();

      // Skip header row
      if (sourcePath === "sourcePath" || sourcePath.startsWith("-")) continue;

      entries.push({
        sourcePath,
        destPath,
        noticeForm,
      });
    }
  }

  return entries;
}

export interface HeaderValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateDonorAttributionHeader(content: string): HeaderValidationResult {
  const errors: string[] = [];
  if (!content.startsWith("/**\n * Extracted from classic-patents.com\n")) {
    errors.push("Missing required opening: '/**\\n * Extracted from classic-patents.com\\n'");
  }
  if (
    !content.includes("Source repository: https://github.com/Dicklesworthstone/classic-patents.com")
  ) {
    errors.push(
      "Missing required 'Source repository: https://github.com/Dicklesworthstone/classic-patents.com'",
    );
  }
  if (!content.includes("Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5")) {
    errors.push("Missing required 'Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5'");
  }
  if (!content.includes("License: MIT License (with OpenAI/Anthropic Rider)")) {
    errors.push("Missing required 'License: MIT License (with OpenAI/Anthropic Rider)'");
  }
  if (!content.includes("Preserved license text: /LICENSE")) {
    errors.push("Missing required 'Preserved license text: /LICENSE'");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface KnownDonorGap {
  readonly destPath: string;
  readonly donorSourcePath: string;
  readonly recordedDate: string;
  readonly status: "pending-owner-ruling";
  readonly reason: string;
  readonly deletionCondition: string;
}

/**
 * Known gaps awaiting owner ruling on whether a short rewrite still carries
 * the donor MIT + Rider license notice requirement.
 *
 * Patterned after KNOWN_GAPS in src/app/theme/contentGlyphCoverage.test.ts lines 85-89.
 *
 * Deletion condition:
 * An entry is removed when the owner rules on whether the rewrite carries the Rider:
 * - If yes: add the required attribution header to the destination file.
 * - If no: reclassify the file as independently authored.
 */
export const KNOWN_DONOR_GAPS: readonly KnownDonorGap[] = [
  {
    destPath: "src/app/robots.ts",
    donorSourcePath: "src/app/robots.ts",
    recordedDate: "2026-09-18",
    status: "pending-owner-ruling",
    reason:
      "Pending owner ruling on whether Next.js App Router metadata boilerplate carries donor Rider.",
    deletionCondition:
      "Remove when owner rules: add attribution header or reclassify as independently authored.",
  },
  {
    destPath: "src/app/sitemap.ts",
    donorSourcePath: "src/app/sitemap.ts",
    recordedDate: "2026-09-18",
    status: "pending-owner-ruling",
    reason:
      "Pending owner ruling on whether Next.js App Router metadata boilerplate carries donor Rider.",
    deletionCondition:
      "Remove when owner rules: add attribution header or reclassify as independently authored.",
  },
  {
    destPath: "src/app/error.tsx",
    donorSourcePath: "src/app/error.tsx",
    recordedDate: "2026-09-18",
    status: "pending-owner-ruling",
    reason:
      "Pending owner ruling on whether Next.js App Router boundary boilerplate carries donor Rider.",
    deletionCondition:
      "Remove when owner rules: add attribution header or reclassify as independently authored.",
  },
  {
    destPath: "src/app/global-error.tsx",
    donorSourcePath: "src/app/global-error.tsx",
    recordedDate: "2026-09-18",
    status: "pending-owner-ruling",
    reason:
      "Pending owner ruling on whether Next.js App Router boundary boilerplate carries donor Rider.",
    deletionCondition:
      "Remove when owner rules: add attribution header or reclassify as independently authored.",
  },
  {
    destPath: "src/app/not-found.tsx",
    donorSourcePath: "src/app/not-found.tsx",
    recordedDate: "2026-09-18",
    status: "pending-owner-ruling",
    reason:
      "Pending owner ruling on whether Next.js App Router 404 boilerplate carries donor Rider.",
    deletionCondition:
      "Remove when owner rules: add attribution header or reclassify as independently authored.",
  },
  {
    destPath: "src/app/theme/ThemeToggle.tsx",
    donorSourcePath: "src/components/layout/ThemeToggle.tsx",
    recordedDate: "2026-09-18",
    status: "pending-owner-ruling",
    reason: "Pending owner ruling on whether theme toggle rewrite carries donor Rider.",
    deletionCondition:
      "Remove when owner rules: add attribution header or reclassify as independently authored.",
  },
];

/**
 * Canonical destination mappings from donor source path to potential
 * destination paths in Annus Mirabilis for files not mapped 1:1.
 */
export const CANONICAL_SEAM_DESTINATION_MAP: Record<string, readonly string[]> = {
  "src/components/layout/ThemeToggle.tsx": [
    "src/app/theme/ThemeToggle.tsx",
    "src/components/layout/ThemeToggle.tsx",
  ],
  "src/components/layout/PatentSearchPalette.tsx": ["src/search/CommandPalette.tsx"],
};

export interface DonorReuseSeamRow {
  readonly seamName: string;
  readonly donorPaths: readonly string[];
  readonly decision: string;
  readonly noticeRequirement: string;
  readonly extractingBead: string;
}

export function parseDonorAuditReuseTable(markdown: string): DonorReuseSeamRow[] {
  const rows: DonorReuseSeamRow[] = [];
  const lines = markdown.split("\n");

  let inSection5 = false;

  for (const line of lines) {
    // am-o44v. This used to also accept `line.includes("Reuse Table")`, a substring test standing
    // in for "this line IS the section 5 heading". Any prose cross-reference to the Reuse Table
    // earlier in the document set inSection5 on that line, and the next `## ` heading then broke
    // the loop before the real section was ever reached: 20 rows became 0, silently, and a donor
    // seam with no row carries no notice requirement. Measured on the real document, planted in
    // section 2 and asserted in license-inventory.test.ts. The first two disjuncts were the same
    // test written twice. The heading is matched by its NUMBER, so retitling the section is safe
    // and renumbering it is caught by the existing row-count assertion rather than passing as an
    // empty table.
    if (line.startsWith("## 5.")) {
      inSection5 = true;
      continue;
    }
    if (inSection5 && line.startsWith("## ") && !line.startsWith("## 5")) {
      break;
    }
    if (!inSection5) continue;

    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;

    const columns = trimmed
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());

    if (columns.length < 5) continue;

    const [rawSeam, rawDecision, , rawNoticeReq, rawBead] = columns;
    if (!rawSeam || !rawDecision) continue;

    if (
      rawSeam.includes("Donor Seam") ||
      rawSeam.startsWith("---") ||
      rawDecision.startsWith("---")
    ) {
      continue;
    }

    const seamNameMatch = rawSeam.match(/\*\*([^*]+)\*\*/);
    const seamName = seamNameMatch ? (seamNameMatch[1] ?? rawSeam).trim() : rawSeam;

    const donorPaths: string[] = [];
    const backtickRegex = /`([^`]+)`/g;
    let match = backtickRegex.exec(rawSeam);
    while (match !== null) {
      if (match[1]) {
        donorPaths.push(match[1].trim());
      }
      match = backtickRegex.exec(rawSeam);
    }

    const decision = rawDecision.replace(/\*\*/g, "").trim();
    const noticeRequirement = (rawNoticeReq || "").replace(/\*\*/g, "").trim();
    const extractingBead = (rawBead || "").trim();

    rows.push({
      seamName,
      donorPaths,
      decision,
      noticeRequirement,
      extractingBead,
    });
  }

  return rows;
}

export function collectDonor(options: CollectDonorOptions): LicenseItem[] {
  const { rootDir, auditMarkdown, readText, exists } = options;
  const section11Entries = parseDonorAuditExtractedFiles(auditMarkdown);
  const items: LicenseItem[] = [];
  const handledDestPaths = new Set<string>();
  const handledSourcePaths = new Set<string>();

  for (const entry of section11Entries) {
    const fullPath = join(rootDir, entry.destPath);
    const fileExists = exists(fullPath);

    if (!fileExists) {
      // If file doesn't exist on disk yet (e.g. pending batch 2), skip
      continue;
    }

    handledDestPaths.add(entry.destPath);
    handledDestPaths.add(entry.destPath.replace(/\/+$/, ""));
    handledSourcePaths.add(entry.sourcePath);
    handledSourcePaths.add(entry.sourcePath.replace(/\/+$/, ""));

    const content = readText(fullPath) || "";
    let license = "MIT with OpenAI/Anthropic Rider";
    let noticeError: string | undefined;

    // The audit's own `noticeForm` decides, and the file extension is only the fallback
    // for a row that records nothing meaningful.
    //
    // This branch used to be `noticeForm === "header" || destPath ends with .ts/.tsx/...`,
    // and the extension test made the recorded value irrelevant: every code file was
    // required to carry the section 9 header whatever its row said. DONOR_AUDIT.md
    // section 11 records one row as `owner-blocked` - src/reader/viewMode.ts, whose notes
    // read "Pure function rewrite; Rider applicability on short rewrites is an unresolved
    // owner decision (reported as owner-blocked)" - so the gate parsed that answer and
    // then overrode it, reporting a disallowed license for a notice form the audit says
    // nobody has ruled on. The seam-table path below already had a typed state for this
    // exact case, PENDING-OWNER-RULING, exempt under rule `known-donor-gap`; the
    // section 11 path had no way to say it.
    //
    // Writing the header instead would be worse than the false failure: it would assert,
    // in a file's legal notice, that the Rider applies to a short rewrite, which is the
    // question the owner has not answered.
    const OWNER_BLOCKED_FORMS = new Set(["owner-blocked", "pending-owner-ruling"]);
    const isCodeFile = /\.(ts|tsx|js|jsx)$/.test(entry.destPath);
    if (OWNER_BLOCKED_FORMS.has(entry.noticeForm)) {
      license = "PENDING-OWNER-RULING";
      noticeError =
        `DONOR_AUDIT.md section 11 records noticeForm '${entry.noticeForm}' for ` +
        `'${entry.destPath}': the notice form is an open owner decision, so no attribution ` +
        "header is required or written until it is ruled on.";
    } else if (entry.noticeForm === "header" || isCodeFile) {
      const headerCheck = validateDonorAttributionHeader(content);
      if (!headerCheck.valid) {
        license = "ATTRIBUTION-HEADER-INVALID";
        noticeError = headerCheck.errors.join("; ");
      }
    }

    items.push({
      kind: "donor",
      name: entry.destPath,
      version: "da11ff4",
      license,
      source: entry.destPath,
      authorOrNotice:
        noticeError ||
        "Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
    });
  }

  // Cross-reference Section 5 / canonical seam table for donor extractions
  // marked Reuse that may not be registered in Section 11 tables.
  const reuseRows = parseDonorAuditReuseTable(auditMarkdown);

  for (const row of reuseRows) {
    const isReuse =
      row.decision.toLowerCase() === "reuse" || row.decision.toLowerCase().startsWith("reuse");
    if (!isReuse) continue;

    for (const rawDonorPath of row.donorPaths) {
      const donorPath = rawDonorPath.replace(/\/+$/, "");
      if (handledSourcePaths.has(donorPath) || handledSourcePaths.has(rawDonorPath)) continue;

      const candidates = CANONICAL_SEAM_DESTINATION_MAP[donorPath] ??
        CANONICAL_SEAM_DESTINATION_MAP[rawDonorPath] ?? [donorPath];

      for (const rawDestPath of candidates) {
        const destPath = rawDestPath.replace(/\/+$/, "");
        if (handledDestPaths.has(destPath) || handledDestPaths.has(rawDestPath)) continue;

        const fullPath = join(rootDir, destPath);
        if (!exists(fullPath)) continue;

        const content = readText(fullPath) || "";
        const headerCheck = validateDonorAttributionHeader(content);

        if (headerCheck.valid) {
          items.push({
            kind: "donor",
            name: destPath,
            version: "da11ff4",
            license: "MIT with OpenAI/Anthropic Rider",
            source: destPath,
            authorOrNotice: `Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 (seam: ${row.seamName})`,
          });
          handledDestPaths.add(destPath);
        } else {
          const gap = KNOWN_DONOR_GAPS.find((g) => g.destPath === destPath);
          if (gap) {
            items.push({
              kind: "donor",
              name: destPath,
              version: "da11ff4",
              license: "PENDING-OWNER-RULING",
              source: destPath,
              authorOrNotice: `Known gap (recorded ${gap.recordedDate}): ${gap.reason} [Deletion condition: ${gap.deletionCondition}]`,
            });
            handledDestPaths.add(destPath);
          } else {
            items.push({
              kind: "donor",
              name: destPath,
              version: "da11ff4",
              license: "UNATTRIBUTED-DONOR-EXTRACTION",
              source: destPath,
              authorOrNotice: `Donor seam '${row.seamName}' file '${destPath}' (donor: '${donorPath}') lacks required attribution header.`,
            });
            handledDestPaths.add(destPath);
          }
        }
      }
    }
  }

  return items;
}
