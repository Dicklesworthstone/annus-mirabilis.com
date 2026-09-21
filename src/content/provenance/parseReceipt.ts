/**
 * Parser for provenance receipt markdown files.
 * Extracts YAML front matter, validates markdown heading order, extracts generated sections,
 * and checks pending status lines.
 */

import type { Receipt, ReceiptBodySection, ReceiptFrontMatter } from "./receiptSchema.ts";
import { parseYaml, YamlParseError } from "./yaml.ts";

/**
 * The declared level-2 headings of a receipt, in order, each marked required or permitted.
 *
 * WHY A DECLARED SET AND NOT A COUNT. This rule used to be "exactly N level-2 headings", which
 * cannot say WHICH headings a receipt has: a receipt could drop "## Scan and rights", add
 * anything at all in its place, and still pass at the same count. The count also refused any new
 * section outright, so the first receipt to carry a reviewer handoff failed the gate for having
 * MORE provenance rather than less, and the pressure was to delete the section or demote it below
 * level 2 - which is loosening the receipt to satisfy the checker.
 *
 * Naming the set admits the new section by DECLARING it and is strictly stronger than the count
 * it replaces: a missing heading is now named, an undeclared heading is now named, and neither
 * can hide behind an arithmetic coincidence.
 *
 * `required: false` means permitted, not optional-in-quality. A receipt without a reviewer
 * handoff is complete; one that has it must put it here, under this exact name.
 */
export const RECEIPT_HEADING_SEQUENCE = [
  { title: "## Identity", required: true },
  { title: "## Scan and rights", required: true },
  { title: "## Page map", required: true },
  { title: "## Comparison witnesses", required: true },
  { title: "## Transcription method", required: true },
  { title: "## Translation credits", required: true },
  { title: "## Editorial boundaries", required: true },
  { title: "## Suspected historical typographical errors", required: true },
  { title: "## Transcription watch list", required: true },
  { title: "## Open questions for the German source reviewer", required: false },
  { title: "## Editorial acceptance", required: true },
] as const;

export const REQUIRED_RECEIPT_HEADINGS = RECEIPT_HEADING_SEQUENCE.filter((h) => h.required).map(
  (h) => h.title,
);

const DECLARED_RECEIPT_HEADINGS: readonly string[] = RECEIPT_HEADING_SEQUENCE.map((h) => h.title);

export type ParseDiagnostic = Readonly<{
  rule: string;
  severity: "error" | "flag";
  path: string;
  message: string;
  expected?: string | undefined;
  actual?: string | undefined;
}>;

export type ParsedReceiptResult = Readonly<{
  ok: boolean;
  receipt?: Receipt | undefined;
  frontMatter?: ReceiptFrontMatter | undefined;
  rawFrontMatter?: string | undefined;
  body?: string | undefined;
  bodySections: readonly ReceiptBodySection[];
  editorialAcceptanceContent?: string | undefined;
  diagnostics: readonly ParseDiagnostic[];
}>;

export function parseReceipt(markdownText: string, filePath: string): ParsedReceiptResult {
  const diagnostics: ParseDiagnostic[] = [];
  const err = (rule: string, path: string, message: string, expected?: string, actual?: string) => {
    diagnostics.push({ rule, severity: "error", path, message, expected, actual });
  };

  // 1. Split front matter
  const fmMatch = markdownText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch || fmMatch[1] === undefined || fmMatch[2] === undefined) {
    err(
      "receipt-format-structure",
      "front-matter",
      "Provenance receipt must begin with YAML front matter enclosed by ---.",
    );
    return { ok: false, bodySections: [], diagnostics };
  }

  const rawFrontMatter = fmMatch[1];
  const body = fmMatch[2];

  // 2. Parse YAML
  let frontMatterRaw: unknown;
  try {
    frontMatterRaw = parseYaml(rawFrontMatter);
  } catch (e) {
    err(
      "receipt-yaml-syntax",
      "front-matter",
      e instanceof YamlParseError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Failed to parse YAML front matter.",
    );
    return { ok: false, rawFrontMatter, body, bodySections: [], diagnostics };
  }

  const frontMatter = frontMatterRaw as ReceiptFrontMatter;

  // 3. Parse Markdown body sections
  const lines = body.split(/\r?\n/);
  const foundHeadings: { title: string; lineIndex: number; lineNumber: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (line.startsWith("## ")) {
      foundHeadings.push({
        title: line,
        lineIndex: i,
        lineNumber: i + 1,
      });
    }
  }

  // 4. Validate heading presence and order
  const foundTitles = foundHeadings.map((h) => h.title);
  const missing = REQUIRED_RECEIPT_HEADINGS.filter((h) => !foundTitles.includes(h));
  const undeclared = foundTitles.filter((h) => !DECLARED_RECEIPT_HEADINGS.includes(h));
  const duplicated = foundTitles.filter((h, i) => foundTitles.indexOf(h) !== i);

  if (missing.length > 0 || undeclared.length > 0 || duplicated.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing ${missing.join(", ")}`);
    if (undeclared.length > 0) parts.push(`undeclared ${undeclared.join(", ")}`);
    if (duplicated.length > 0) parts.push(`duplicated ${[...new Set(duplicated)].join(", ")}`);
    err(
      "receipt-headings-mismatch",
      "body.headings",
      `Receipt headings do not match the declared set: ${parts.join("; ")}.`,
      DECLARED_RECEIPT_HEADINGS.join(", "),
      foundTitles.join(", "),
    );
  } else {
    // Every found heading is declared and unique, so the order check is a subsequence test
    // against the declared order; a permitted heading that is absent simply advances past.
    let cursor = 0;
    for (let i = 0; i < foundTitles.length; i++) {
      const actual = foundTitles[i];
      if (!actual) continue;
      const at = DECLARED_RECEIPT_HEADINGS.indexOf(actual, cursor);
      if (at < 0) {
        err(
          "receipt-headings-order",
          `body.headings[${i}]`,
          `Heading ${i + 1} "${actual}" appears out of the declared order.`,
          DECLARED_RECEIPT_HEADINGS.join(", "),
          foundTitles.join(", "),
        );
        break;
      }
      cursor = at + 1;
    }
  }

  // 5. Extract section contents
  const bodySections: ReceiptBodySection[] = [];
  for (let i = 0; i < foundHeadings.length; i++) {
    const cur = foundHeadings[i];
    if (!cur) continue;
    const nextHeading = i + 1 < foundHeadings.length ? foundHeadings[i + 1] : undefined;
    const nextLineIndex = nextHeading ? nextHeading.lineIndex : lines.length;
    const contentLines = lines.slice(cur.lineIndex + 1, nextLineIndex);
    const content = contentLines.join("\n").trim();

    bodySections.push({
      title: cur.title,
      level: 2,
      content,
      startLine: cur.lineNumber,
    });
  }

  // 6. Validate pending sections
  const pendingMap = new Map<string, string>();
  if (frontMatter && Array.isArray(frontMatter.pending)) {
    for (const p of frontMatter.pending) {
      if (p && typeof p.section === "string" && typeof p.owner === "string") {
        pendingMap.set(p.section, p.owner);
      }
    }
  }

  for (const sec of bodySections) {
    const isDeclaredPending = pendingMap.has(sec.title);
    const hasPendingText = sec.content.includes("Status: pending");

    if (isDeclaredPending || hasPendingText) {
      const pendingMatch = sec.content.match(/^Status: pending \(owner: ([a-z0-9-]+)\)$/m);
      if (!pendingMatch) {
        err(
          "receipt-pending-malformed",
          `body.${sec.title}`,
          `Section "${sec.title}" is pending but content does not match "Status: pending (owner: <bead id>)".`,
        );
      } else {
        const ownerInBody = pendingMatch[1];
        if (isDeclaredPending) {
          const ownerInFm = pendingMap.get(sec.title);
          if (ownerInFm !== ownerInBody) {
            err(
              "receipt-pending-owner-mismatch",
              `body.${sec.title}`,
              `Section "${sec.title}" pending owner in body (${ownerInBody}) does not match front matter (${ownerInFm}).`,
            );
          }
        }
      }
    }
  }

  // 7. Validate generated editorial acceptance section markers
  let editorialAcceptanceContent: string | undefined;
  const startMarker = "<!-- generated:editorial-acceptance:start -->";
  const endMarker = "<!-- generated:editorial-acceptance:end -->";

  const startCount = (body.match(new RegExp(escapeRegex(startMarker), "g")) || []).length;
  const endCount = (body.match(new RegExp(escapeRegex(endMarker), "g")) || []).length;

  if (startCount !== 1 || endCount !== 1) {
    err(
      "receipt-generated-markers",
      "body.editorial-acceptance",
      `Editorial acceptance section must contain exactly one start marker and one end marker (found start: ${startCount}, end: ${endCount}).`,
    );
  } else {
    const startIdx = body.indexOf(startMarker);
    const endIdx = body.indexOf(endMarker);
    if (startIdx > endIdx) {
      err(
        "receipt-generated-markers-order",
        "body.editorial-acceptance",
        "Start marker must appear before end marker.",
      );
    } else {
      editorialAcceptanceContent = body.slice(startIdx + startMarker.length, endIdx).trim();
    }
  }

  const receipt: Receipt = {
    frontMatter,
    rawFrontMatter,
    body,
    bodySections,
    editorialAcceptanceContent,
    filePath,
  };

  return {
    ok: diagnostics.length === 0,
    receipt,
    frontMatter,
    rawFrontMatter,
    body,
    bodySections,
    editorialAcceptanceContent,
    diagnostics,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
