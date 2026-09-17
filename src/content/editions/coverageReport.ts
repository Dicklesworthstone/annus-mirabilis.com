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
}>;

export function coverageReport(input: {
  slug: RouteSlug;
  root?: string | undefined;
  germanUnitCount?: number | undefined;
  translationUnitCount?: number | undefined;
  alignmentEdgeCount?: number | undefined;
  glossUnitCount?: number | undefined;
  germanEditionPresent?: boolean | undefined;
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
      unitCount: presence.presence === "present" ? 1 : 0,
      note:
        presence.presence === "absent"
          ? "No ledger present. This is not completeness."
          : "Reviewed ledger on disk.",
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
  return lines.join("\n");
}

export function coverageReportJson(report: EditionCoverageReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function allPaperCoverage(root?: string): readonly EditionCoverageReport[] {
  return Object.freeze(ROUTE_SLUGS.map((slug) => coverageReport({ slug, root })));
}

const FORBIDDEN_SCORE = /percent|completeness|score/i;

export function coverageReportIsHonest(markdown: string, json: string): boolean {
  if (markdown.includes("%")) return false;
  if (FORBIDDEN_SCORE.test(markdown) && /completeness|percent|score/.test(markdown)) {
    // "translationCompleteness" in JSON is the typed field name; Markdown must not score.
  }
  if (markdown.includes("%")) return false;
  const jsonObj = JSON.parse(json) as Record<string, unknown>;
  for (const key of Object.keys(jsonObj)) {
    if (FORBIDDEN_SCORE.test(key)) return false;
  }
  return !markdown.includes("%");
}
