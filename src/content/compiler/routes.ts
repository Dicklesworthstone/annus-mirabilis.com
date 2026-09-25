/**
 * Path routing table for content files.
 * Assigns every file under `content/` to exactly one schema / route.
 *
 * Spec: AGENTS.md and am-cm-compiler-core-oa7
 */

export interface ContentRoute {
  readonly pattern: RegExp;
  readonly kind: ContentRouteKind;
  readonly schema: string;
  readonly format: "json" | "yaml" | "text" | "markdown";
  readonly extractParams?: (match: RegExpExecArray, path: string) => Record<string, string>;
}

export type ContentRouteKind =
  | "paper"
  | "argument"
  | "entrance"
  | "equation"
  | "derivation-chain"
  | "derivation-policy"
  | "foundation"
  | "foundation-extension"
  | "citation"
  | "quantity"
  | "misconception"
  | "experiment"
  | "historical-premise"
  | "source-asset"
  | "source-manifest"
  | "frozen-id-snapshot"
  | "source-block"
  | "translation-unit"
  | "alignment"
  | "gloss-unit"
  | "editorial-note"
  | "aliases"
  | "paragraph-bindings"
  | "display-terms"
  | "flag-reviews"
  | "readings-owner"
  | "editorial-rules"
  | "editorial-overrides"
  | "documentation";

export interface RouteMatch {
  readonly route: ContentRoute;
  readonly kind: ContentRouteKind;
  readonly params: Record<string, string>;
  readonly normalizedPath: string;
}

export const CONTENT_ROUTES: readonly ContentRoute[] = [
  // 1. Documentation & allowlisted files
  {
    pattern: /^(?:content\/)?README\.md$/,
    kind: "documentation",
    schema: "markdown-doc",
    format: "markdown",
    extractParams: () => ({ id: "readme" }),
  },
  {
    pattern: /^(?:content\/)?docs\/([a-zA-Z0-9_\-.]+)\.md$/,
    kind: "documentation",
    schema: "markdown-doc",
    format: "markdown",
    extractParams: (m) => ({ id: m[1] ?? "" }),
  },

  // 2. Paper records
  {
    pattern: /^(?:content\/)?papers\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "paper",
    schema: "Paper",
    format: "json",
    extractParams: (m) => ({ slug: m[1] ?? "", id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 3. Entrances & Arguments
  {
    pattern: /^(?:content\/)?arguments\/([a-z0-9-]+)\/(entrance-[a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "entrance",
    schema: "EntranceRecord",
    format: "json",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[2] ?? "", format: m[3] ?? "" }),
  },
  {
    pattern: /^(?:content\/)?entrances\/(?:entrance-)?([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "entrance",
    schema: "EntranceRecord",
    format: "json",
    extractParams: (m) => ({ id: `entrance-${m[1]}`, slug: m[1] ?? "", format: m[2] ?? "" }),
  },
  {
    pattern: /^(?:content\/)?arguments\/([a-z0-9-]+)\/((?!entrance-)[a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "argument",
    schema: "ArgumentNode",
    format: "json",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[2] ?? "", format: m[3] ?? "" }),
  },

  // 4. Worked derivations have their own owner; they are not Equation records.
  {
    pattern: /^(?:content\/)?equations\/derivations\/([a-z0-9-]+)\.yaml$/,
    kind: "derivation-chain",
    schema: "MissingStepLesson",
    format: "json",
    extractParams: (m) => ({ id: m[1] ?? "" }),
  },
  {
    pattern: /^(?:content\/)?equations\/missing-step-allowlist\.yaml$/,
    kind: "derivation-policy",
    schema: "MissingStepAllowlist",
    format: "json",
  },
  // Equations
  {
    pattern:
      /^(?:content\/)?equations\/((?!derivations\/)[a-z0-9-]+)\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "equation",
    schema: "Equation",
    format: "json",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[2] ?? "", format: m[3] ?? "" }),
  },

  // 5. Foundations
  {
    pattern: /^(?:content\/)?foundations\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "foundation",
    schema: "Foundation",
    format: "json",
    extractParams: (m) => ({ id: m[1] ?? "", format: m[2] ?? "" }),
  },
  {
    pattern: /^(?:content\/)?foundations\/extensions\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "foundation-extension",
    schema: "FoundationExtension",
    format: "json",
    extractParams: (m) => ({ id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 6. Bibliography / Citations
  {
    pattern: /^(?:content\/)?bibliography\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "citation",
    schema: "Citation",
    format: "json",
    extractParams: (m) => ({ id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 7. Quantities
  {
    pattern: /^(?:content\/)?quantities\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "quantity",
    schema: "QuantitySet",
    format: "yaml",
    extractParams: (m) => ({ slug: m[1] ?? "", id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 8. Misconceptions
  {
    pattern: /^(?:content\/)?misconceptions\/([a-z0-9-]+)\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "misconception",
    schema: "Misconception",
    format: "json",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[2] ?? "", format: m[3] ?? "" }),
  },
  {
    pattern: /^(?:content\/)?misconceptions\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "misconception",
    schema: "Misconception",
    format: "json",
    extractParams: (m) => ({ id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 9. Experiments
  {
    pattern: /^(?:content\/)?experiments\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "experiment",
    schema: "ExperimentManifest",
    format: "json",
    extractParams: (m) => ({ id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 10. Historical Premises
  {
    pattern: /^(?:content\/)?historical-premises\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "historical-premise",
    schema: "HistoricalPremise",
    format: "json",
    extractParams: (m) => ({ id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 11. Source Assets
  {
    pattern: /^(?:content\/)?source-assets\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "source-asset",
    schema: "SourceAsset",
    format: "json",
    extractParams: (m) => ({ id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 12. Source Manifests
  {
    pattern: /^(?:content\/)?source-blocks\/([a-z0-9-]+)\/manifest\.(json|yaml|yml)$/,
    kind: "source-manifest",
    schema: "SourceManifest",
    format: "yaml",
    extractParams: (m) => ({ paper: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 13. Frozen ID Snapshots
  {
    pattern: /^(?:content\/)?source-blocks\/([a-z0-9-]+)\/manifest\.ids\.snapshot\.txt$/,
    kind: "frozen-id-snapshot",
    schema: "FrozenIdSnapshot",
    format: "text",
    extractParams: (m) => ({ paper: m[1] ?? "" }),
  },

  // 14. Source Blocks
  {
    pattern: /^(?:content\/)?source-blocks\/([a-z0-9-]+)\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "source-block",
    schema: "SourceBlock",
    format: "json",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[2] ?? "", format: m[3] ?? "" }),
  },

  // 15. Translation Units
  {
    pattern: /^(?:content\/)?translation-units\/([a-z0-9-]+)\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "translation-unit",
    schema: "TranslationUnit",
    format: "json",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[2] ?? "", format: m[3] ?? "" }),
  },

  // 16. Alignments
  {
    pattern: /^(?:content\/)?alignments\/([a-z0-9-]+)\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "alignment",
    schema: "Alignment",
    format: "json",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[2] ?? "", format: m[3] ?? "" }),
  },
  {
    pattern: /^(?:content\/)?alignments\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "alignment",
    schema: "Alignment",
    format: "yaml",
    extractParams: (m) => ({
      paper: m[1] ?? "",
      id: m[1] ?? "",
      slug: m[1] ?? "",
      format: m[2] ?? "",
    }),
  },

  // 17. Gloss Units
  {
    pattern: /^(?:content\/)?gloss-units\/([a-z0-9-]+)\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "gloss-unit",
    schema: "GlossUnit",
    format: "json",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[2] ?? "", format: m[3] ?? "" }),
  },

  // 18. Editorial Notes
  {
    pattern: /^(?:content\/)?editorial-notes\/([a-z0-9-]+)\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "editorial-note",
    schema: "EditorialNote",
    format: "json",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[2] ?? "", format: m[3] ?? "" }),
  },

  // 19. Aliases
  {
    pattern: /^(?:content\/)?aliases\/([a-z0-9-]+)\.(json|yaml|yml)$/,
    kind: "aliases",
    schema: "AliasManifest",
    format: "yaml",
    extractParams: (m) => ({ slug: m[1] ?? "", id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 19a. Paragraph bindings: each printed paragraph and display to its explanation
  // (src/content/bindings/paragraphBindings.ts checks them; the record compiler skips them).
  {
    pattern: /^(?:content\/)?bindings\/([a-z0-9-]+)\.(yaml|yml)$/,
    kind: "paragraph-bindings",
    schema: "ParagraphBindings",
    format: "yaml",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 19b. Printed display terms: each printed display's glyphs to exact quantity ids, for the colour
  // on the reading faces (src/equations/printed/displayTerms.ts checks them when
  // scripts/build-equations.ts compiles them; the record compiler skips them).
  {
    pattern: /^(?:content\/)?display-terms\/([a-z0-9-]+)\.(yaml|yml)$/,
    kind: "display-terms",
    schema: "DisplayTerms",
    format: "yaml",
    extractParams: (m) => ({ paper: m[1] ?? "", id: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 20. Editorial: Flag Reviews
  {
    pattern: /^(?:content\/)?editorial\/flag-reviews\.(json|yaml|yml)$/,
    kind: "flag-reviews",
    schema: "FlagReviews",
    format: "yaml",
    extractParams: (m) => ({ id: "flag-reviews", format: m[1] ?? "" }),
  },

  // 21. Editorial: Readings Owners
  {
    pattern: /^(?:content\/)?editorial\/readings-owners\/([a-zA-Z0-9_-]+)\.(json|yaml|yml)$/,
    kind: "readings-owner",
    schema: "ReadingsOwner",
    format: "yaml",
    extractParams: (m) => ({ ownerId: m[1] ?? "", format: m[2] ?? "" }),
  },

  // 22. Editorial: Rules
  {
    pattern: /^(?:content\/)?editorial\/rules\.(json|yaml|yml)$/,
    kind: "editorial-rules",
    schema: "EditorialRules",
    format: "yaml",
    extractParams: (m) => ({ id: "editorial-rules", format: m[1] ?? "" }),
  },

  // 23. Editorial: Overrides
  {
    pattern: /^(?:content\/)?editorial\/overrides\.(json|yaml|yml)$/,
    kind: "editorial-overrides",
    schema: "EditorialOverrides",
    format: "yaml",
    extractParams: (m) => ({ id: "editorial-overrides", format: m[1] ?? "" }),
  },
];

/**
 * Normalizes a content path (replaces Windows backslashes with forward slashes,
 * strips leading slash).
 */
export function normalizeContentPath(rawPath: string): string {
  return rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * Matches a relative content file path to a route in the content routing table.
 * Returns match result or null if no route matches.
 * Throws an error if multiple routes match ambiguously.
 */
export function matchContentRoute(filePath: string): RouteMatch | null {
  const normalized = normalizeContentPath(filePath);
  const matches: RouteMatch[] = [];

  for (const route of CONTENT_ROUTES) {
    const execResult = route.pattern.exec(normalized);
    if (execResult) {
      const params = route.extractParams ? route.extractParams(execResult, normalized) : {};
      matches.push({
        route,
        kind: route.kind,
        params,
        normalizedPath: normalized,
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    // If multiple matched, verify if they are identical or ambiguous
    const distinctKinds = new Set(matches.map((m) => m.kind));
    if (distinctKinds.size > 1) {
      throw new Error(
        `Ambiguous content route for '${filePath}': matched ${Array.from(distinctKinds).join(", ")}`,
      );
    }
  }

  return matches[0] ?? null;
}
