/**
 * Per-paper edition coverage report (am-edn-alignment-tooling-do1).
 * No percentage, completeness score, or aggregated "done" stamp.
 */

import { ROUTE_SLUGS, type RouteSlug } from "../ids.ts";
import {
  inspectLedgerPresence,
  type LedgerPresence,
  type TranslationCompleteness,
  translationCompleteness,
} from "./ledgerPresence.ts";

export type LayerCoverage = Readonly<{
  layer: "ledger" | "german-edition" | "translation" | "alignment" | "gloss";
  presence: LedgerPresence | "authored" | "absent";
  unitCount: number;
  note: string;
}>;

export type EditionCoverageReport = Readonly<{
  slug: RouteSlug;
  bibliographicKey: string;
  ledger: LedgerPresence;
  translation: TranslationCompleteness;
  layers: readonly LayerCoverage[];
  reviewStates?: Readonly<Record<string, number>> | undefined;
  componentShapes?:
    | Readonly<{ "1:1": number; "1:n": number; "n:1": number; "n:m": number }>
    | undefined;
  mathOrderWarnings?: readonly string[] | undefined;
  termCount?: number | undefined;
  glossTokensByKind?:
    | Readonly<Record<string, { totalWords: number; glossedWords: number }>>
    | undefined;
  digestChain?:
    | Readonly<{ ledgerDigest?: string; facsimileDigest?: string; lastFullVerification?: string }>
    | undefined;
  unresolvedDifferences?: readonly string[] | undefined;
}>;

export function coverageReport(input: {
  slug: RouteSlug;
  root?: string | undefined;
  germanUnitCount?: number | undefined;
  translationUnitCount?: number | undefined;
  alignmentEdgeCount?: number | undefined;
  glossUnitCount?: number | undefined;
  germanEditionPresent?: boolean | undefined;
  reviewStates?: Readonly<Record<string, number>> | undefined;
  componentShapes?:
    | Readonly<{ "1:1": number; "1:n": number; "n:1": number; "n:m": number }>
    | undefined;
  mathOrderWarnings?: readonly string[] | undefined;
  termCount?: number | undefined;
  glossTokensByKind?:
    | Readonly<Record<string, { totalWords: number; glossedWords: number }>>
    | undefined;
  digestChain?:
    | Readonly<{ ledgerDigest?: string; facsimileDigest?: string; lastFullVerification?: string }>
    | undefined;
  unresolvedDifferences?: readonly string[] | undefined;
}): EditionCoverageReport {
  const presence = inspectLedgerPresence(input.slug, input.root);
  const german = input.germanUnitCount ?? 0;
  const english = input.translationUnitCount ?? 0;
  const completeness = translationCompleteness({
    ledger: presence.presence,
    translationUnitCount: english,
    germanAlignableCount: german,
  });
  const layers: LayerCoverage[] = [
    {
      layer: "ledger",
      presence: presence.presence,
      // A file count, not a unit count. Left as-is rather than quietly made to look like a
      // measurement: the number of ledger UNITS is the validator's business, and this
      // record has never asked it.
      unitCount: presence.presence !== "absent" ? 1 : 0,
      note:
        presence.presence === "partial"
          ? "A ledger file is present but DOES NOT YET COVER every page of this paper. This is not completeness. See the paper's provenance receipt for transcription.ledgerStatus."
          : presence.presence === "absent"
            ? "No ledger present. This is not completeness."
            : // This said "Reviewed ledger on disk." until 2026-09-20, and on that day it
              // became a false statement: the first two ledgers in the project are machine
              // drafts with hand correction, and docs/OWNERS.md still lists every
              // german-source-reviewer slot as "open: recruiting". Presence is computed by
              // existsSync, so this note can never speak to review status - it only knows a
              // file is there. It now says only what it knows.
              "A ledger file is present. Presence is not review, and not completeness; see the paper's provenance receipt for transcription.ledgerStatus.",
    },
    {
      layer: "german-edition",
      presence: input.germanEditionPresent ? "authored" : "absent",
      unitCount: german,
      note: input.germanEditionPresent
        ? "German edition blocks authored."
        : "German edition not yet authored.",
    },
    {
      layer: "translation",
      presence: english > 0 ? "authored" : "absent",
      unitCount: english,
      note:
        completeness === "not-applicable-no-ledger"
          ? "Translation completeness is not applicable without a ledger."
          : completeness === "complete"
            ? "Every German alignable has an English unit."
            : "Translation units are missing for some German alignables.",
    },
    {
      layer: "alignment",
      presence: (input.alignmentEdgeCount ?? 0) > 0 ? "authored" : "absent",
      unitCount: input.alignmentEdgeCount ?? 0,
      note: "Alignment is explicit many-to-many edges, never paragraph counts.",
    },
    {
      layer: "gloss",
      presence: (input.glossUnitCount ?? 0) > 0 ? "authored" : "absent",
      unitCount: input.glossUnitCount ?? 0,
      note: "Gloss coverage is counted by unit kind, not as a score.",
    },
  ];
  return {
    slug: input.slug,
    bibliographicKey: presence.bibliographicKey,
    ledger: presence.presence,
    translation: completeness,
    layers: Object.freeze(layers),
    ...(input.reviewStates ? { reviewStates: Object.freeze(input.reviewStates) } : {}),
    ...(input.componentShapes ? { componentShapes: Object.freeze(input.componentShapes) } : {}),
    ...(input.mathOrderWarnings
      ? { mathOrderWarnings: Object.freeze(input.mathOrderWarnings) }
      : {}),
    ...(input.termCount !== undefined ? { termCount: input.termCount } : {}),
    ...(input.glossTokensByKind
      ? { glossTokensByKind: Object.freeze(input.glossTokensByKind) }
      : {}),
    ...(input.digestChain ? { digestChain: Object.freeze(input.digestChain) } : {}),
    ...(input.unresolvedDifferences
      ? { unresolvedDifferences: Object.freeze(input.unresolvedDifferences) }
      : {}),
  };
}

export function coverageReportMarkdown(report: EditionCoverageReport): string {
  const lines = [
    `# Edition coverage: ${report.slug}`,
    "",
    `Bibliographic key: ${report.bibliographicKey}`,
    `Ledger: ${report.ledger}`,
    `Translation: ${report.translation}`,
    "",
    "| Layer | Presence | Units | Note |",
    "| --- | --- | --- | --- |",
  ];
  for (const layer of report.layers) {
    lines.push(`| ${layer.layer} | ${layer.presence} | ${layer.unitCount} | ${layer.note} |`);
  }
  lines.push("");

  if (report.reviewStates) {
    lines.push("## Review states");
    lines.push("");
    for (const [state, count] of Object.entries(report.reviewStates)) {
      lines.push(`- ${state}: ${count}`);
    }
    lines.push("");
  }

  if (report.componentShapes) {
    lines.push("## Alignment component shapes");
    lines.push("");
    lines.push(`- 1:1: ${report.componentShapes["1:1"]}`);
    lines.push(`- 1:n: ${report.componentShapes["1:n"]}`);
    lines.push(`- n:1: ${report.componentShapes["n:1"]}`);
    lines.push(`- n:m: ${report.componentShapes["n:m"]}`);
    lines.push("");
  }

  if (report.mathOrderWarnings && report.mathOrderWarnings.length > 0) {
    lines.push("## Math order warnings");
    lines.push("");
    for (const w of report.mathOrderWarnings) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  if (report.termCount !== undefined) {
    lines.push("## Term annotations");
    lines.push("");
    lines.push(`- Total term definitions: ${report.termCount}`);
    lines.push("");
  }

  if (report.glossTokensByKind) {
    lines.push("## Gloss token coverage by unit kind");
    lines.push("");
    for (const [kind, stats] of Object.entries(report.glossTokensByKind)) {
      lines.push(
        `- ${kind}: ${stats.glossedWords} glossed words out of ${stats.totalWords} total words`,
      );
    }
    lines.push("");
  }

  if (report.digestChain) {
    lines.push("## Digest chain");
    lines.push("");
    if (report.digestChain.ledgerDigest) {
      lines.push(`- Ledger digest: ${report.digestChain.ledgerDigest}`);
    }
    if (report.digestChain.facsimileDigest) {
      lines.push(`- Facsimile digest: ${report.digestChain.facsimileDigest}`);
    }
    if (report.digestChain.lastFullVerification) {
      lines.push(`- Last full byte verification: ${report.digestChain.lastFullVerification}`);
    }
    lines.push("");
  }

  if (report.unresolvedDifferences && report.unresolvedDifferences.length > 0) {
    lines.push("## Unresolved reconciliation differences");
    lines.push("");
    for (const d of report.unresolvedDifferences) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function coverageReportJson(report: EditionCoverageReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function allPaperCoverage(root?: string): readonly EditionCoverageReport[] {
  return Object.freeze(ROUTE_SLUGS.map((slug) => coverageReport({ slug, root })));
}

const FORBIDDEN_SCORE = /percent|completeness|score/i;

/** A scoring key anywhere in the tree, not only at the top. A per-kind block is still a place to hide an aggregate. */
function hasScoringKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasScoringKey);
  }
  if (value === null || typeof value !== "object") {
    return false;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_SCORE.test(key)) return true;
    if (hasScoringKey(child)) return true;
  }
  return false;
}

/**
 * The report states what is present and what is absent; it never scores the edition.
 * The rule is a percent sign in the prose and a scoring KEY in the data, at any depth.
 * It is deliberately not a vocabulary ban: the report's own notes say "This is not
 * completeness" and "not as a score", and forbidding those words would forbid it from
 * saying so.
 */
export function coverageReportIsHonest(markdown: string, json: string): boolean {
  if (markdown.includes("%")) return false;
  return !hasScoringKey(JSON.parse(json));
}
