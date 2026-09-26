/**
 * A laboratory's formulas through the inline resolver (dispatch 274; the owner: "I still see a ton
 * of equations that aren't properly using the colored equations with latex system like in
 * classic-patents.com").
 *
 * SCOPE. A lab's formula is read in the notation of the paper and sections its manifest names
 * (content/experiments/<lab>.yaml, sourceRefs). A lab that names several sections of its paper is
 * tried in each, and the reading with fewest refusals is kept (the first named on a tie), so a
 * glyph a section defines is read in that section and never borrowed from a neighbour silently:
 * the resolver itself still refuses a glyph with two readings at one level.
 *
 * RESULT. Resolved: the formula drawn with its terms marked (compileInlineFormula), in inline or
 * display mode. Refused: the resolver's problems, each naming the lab and the glyph. The component
 * then prints the formula as before and lists the glyphs on it (data-inline-refused), so a formula
 * is coloured or named, never plain in silence. No exceptions are passed yet: NavyKite owns the
 * exceptions file (content/inline-terms/exceptions.yaml), and until it lands every sign the
 * concordance does not carry, the number pi included, is a named refusal.
 *
 * Server-only: it reads the manifest and the concordance from disk, once per lab and formula.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "katex";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import {
  type CompiledInline,
  compileInlineFormula,
  type InlineTermsProblem,
  type ResolvedInline,
  resolveInlineTerms,
} from "./inlineTerms.ts";

/** Manifest paper names that are not route slugs. */
const PAPER_SLUGS: Readonly<Record<string, string>> = { relativity: "special-relativity" };

export type LabScope = Readonly<{ paper: string; sections: readonly string[] }>;

export type LabFormula =
  | Readonly<{ kind: "resolved"; compiled: CompiledInline }>
  | Readonly<{ kind: "refused"; paper: string; problems: readonly InlineTermsProblem[] }>
  | Readonly<{ kind: "unscoped" }>;

const scopes = new Map<string, LabScope | null>();
const formulas = new Map<string, LabFormula>();

/** The paper and sections a lab's manifest names, or null for a lab with no manifest source. */
export function labScope(lab: string, root = process.cwd()): LabScope | null {
  const cached = scopes.get(lab);
  if (cached !== undefined) return cached;
  let scope: LabScope | null = null;
  try {
    const manifest = parseYaml(
      readFileSync(join(root, "content/experiments", `${lab}.yaml`), "utf8"),
    ) as { sourceRefs?: readonly { paper: string; id: string }[] } | null;
    const refs = manifest?.sourceRefs ?? [];
    const first = refs[0];
    if (first) {
      const paper = PAPER_SLUGS[first.paper] ?? first.paper;
      const sections = [
        ...new Set(
          refs.filter((r) => (PAPER_SLUGS[r.paper] ?? r.paper) === paper).map((r) => r.id),
        ),
      ];
      scope = { paper, sections };
    }
  } catch {
    scope = null;
  }
  scopes.set(lab, scope);
  return scope;
}

const display = ((tex: string, options: object) =>
  renderToString(tex, { ...options, displayMode: true })) as typeof renderToString;

/** A lab's formula, resolved in its lab's scope and compiled, or the refusals that name its gaps. */
export function labFormula(lab: string, latex: string, displayMode: boolean): LabFormula {
  const key = `${lab}\u0000${displayMode ? "d" : "i"}\u0000${latex}`;
  const cached = formulas.get(key);
  if (cached) return cached;
  const scope = labScope(lab);
  let result: LabFormula;
  if (!scope || scope.sections.length === 0) result = { kind: "unscoped" };
  else {
    const context = {
      concordance: loadConcordanceForPaper(scope.paper).entries,
      isRegistered: isRegisteredQuantityId,
      exceptions: [],
    };
    let best: ResolvedInline | null = null;
    for (const section of scope.sections) {
      const resolved = resolveInlineTerms(
        latex,
        { paper: scope.paper, where: `lab ${lab}`, anchor: section, section },
        context,
      );
      if (!best || resolved.problems.length < best.problems.length) best = resolved;
    }
    result =
      best && best.problems.length === 0
        ? {
            kind: "resolved",
            compiled: displayMode
              ? compileInlineFormula(best, display)
              : compileInlineFormula(best),
          }
        : { kind: "refused", paper: scope.paper, problems: best?.problems ?? [] };
  }
  formulas.set(key, result);
  return result;
}
