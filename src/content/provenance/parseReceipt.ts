/**
 * Parser for provenance receipt markdown files.
 * Extracts YAML front matter, validates markdown heading order, extracts generated sections,
 * and checks pending status lines.
 */

import type { Receipt, ReceiptBodySection, ReceiptFrontMatter } from "./receiptSchema.ts";
import { parseYaml, YamlParseError } from "./yaml.ts";

export const REQUIRED_RECEIPT_HEADINGS = [
  "## Identity",
  "## Scan and rights",
  "## Page map",
  "## Comparison witnesses",
  "## Transcription method",
  "## Translation credits",
  "## Editorial boundaries",
  "## Suspected historical typographical errors",
  "## Transcription watch list",
  "## Editorial acceptance",
] as const;

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
  if (!fmMatch) {
    err(
      "receipt-format-structure",
      "front-matter",
      "Provenance receipt must begin with YAML front matter enclosed by ---.",
    );
    return { ok: false, bodySections: [], diagnostics };
  }

  const rawFrontMatter = fmMatch[1]!;
  const body = fmMatch[2]!;

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
    const line = lines[i]!.trim();
    if (line.startsWith("## ")) {
      foundHeadings.push({
        title: line,
        lineIndex: i,
        lineNumber: i + 1,
      });
    }
  }

  // 4. Validate heading presence and order
  let headingOrderValid = true;
  if (foundHeadings.length !== REQUIRED_RECEIPT_HEADINGS.length) {
    headingOrderValid = false;
    err(
      "receipt-headings-mismatch",
      "body.headings",
      `Expected exactly ${REQUIRED_RECEIPT_HEADINGS.length} level-2 headings, found ${foundHeadings.length}.`,
      REQUIRED_RECEIPT_HEADINGS.join(", "),
      foundHeadings.map((h) => h.title).join(", "),
    );
  } else {
    for (let i = 0; i < REQUIRED_RECEIPT_HEADINGS.length; i++) {
      const expected = REQUIRED_RECEIPT_HEADINGS[i]!;
      const actual = foundHeadings[i]?.title;
      if (actual !== expected) {
        headingOrderValid = false;
        err(
          "receipt-headings-order",
          `body.headings[${i}]`,
          `Heading ${i + 1} mismatch: expected "${expected}" but found "${actual || "missing"}".`,
          expected,
          actual,
        );
      }
    }
  }

  // 5. Extract section contents
  const bodySections: ReceiptBodySection[] = [];
  for (let i = 0; i < foundHeadings.length; i++) {
    const cur = foundHeadings[i]!;
    const nextLineIndex =
      i + 1 < foundHeadings.length ? foundHeadings[i + 1]!.lineIndex : lines.length;
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
