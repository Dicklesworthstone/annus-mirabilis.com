/**
 * Every paper's printed displays, checked and compiled for the reading faces (dispatch 224).
 * scripts/build-equations.ts calls this, fails on any problem, colours the displays with the
 * explanation's map and writes the result to src/generated/printed-displays.json; the tests call it
 * on the real records and on planted ones.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadReaderDescriptions } from "../../content/quantities/readerDescriptions.ts";
import { getQuantityRegistry, isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import { type BilingualEdition, loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { type TermFacts, termFacts } from "../termFacts.ts";
import type { CompiledEquation } from "../viewTypes.ts";
import {
  type CheckedDisplay,
  type CompiledPrintedDisplay,
  checkDisplayTerms,
  compilePrintedDisplay,
  type DisplayOccurrence,
  DisplayTermsError,
  type DisplayTermsFile,
  type DisplayTermsProblem,
  displayOccurrences,
  loadDisplayTerms,
} from "./displayTerms.ts";
import { fallbackTermFacts, notationFor, notationLink } from "./fallbackFacts.ts";

/**
 * A compiled display with what the inspector says about each of its quantities, and where each
 * legend line's chip links before JavaScript runs (notationHref, dispatch 254).
 */
export type PrintedDisplayPayload = Omit<CompiledPrintedDisplay, "legend"> &
  Readonly<{
    legend: readonly (CompiledPrintedDisplay["legend"][number] &
      Readonly<{
        href: string;
        hrefMeaning?: string;
        /**
         * Where the chip links to the quantity's own row on /notation/ (no concordance entry): what
         * that row prints, its name and reader description, resolved here at build time, since the
         * page may not read the registry (webpack cannot bundle its directory URL).
         */
        row?: Readonly<{ name: string; description?: string }>;
      }>)[];
    facts: Readonly<Record<string, TermFacts>>;
  }>;

/** The model equation records content/bindings/<paper>.yaml binds each display to. */
export function boundEquations(
  root: string,
  paper: string,
): ReadonlyMap<string, readonly string[]> {
  const path = join(root, "content", "bindings", `${paper}.yaml`);
  if (!existsSync(path)) return new Map();
  const raw = parseYaml(readFileSync(path, "utf8")) as { displays?: unknown } | null;
  const displays = Array.isArray(raw?.displays) ? raw.displays : [];
  return new Map(
    displays.flatMap((d) => {
      const { unit, equations } = (d ?? {}) as { unit?: unknown; equations?: unknown };
      return typeof unit === "string" && Array.isArray(equations)
        ? [[unit, equations.filter((e): e is string => typeof e === "string")] as const]
        : [];
    }),
  );
}

/** One paper's displays checked against its edition, or null when it has no display-terms file. */
export async function checkPaperDisplays(
  root: string,
  paper: string,
  overrides: Readonly<{ file?: DisplayTermsFile; edition?: BilingualEdition }> = {},
): Promise<{
  displays: readonly CheckedDisplay[];
  problems: readonly DisplayTermsProblem[];
  /** Where each display is printed, the first place being its scope (checkDisplayTerms). */
  occurrences: ReadonlyMap<string, readonly DisplayOccurrence[]>;
} | null> {
  const file = overrides.file ?? loadDisplayTerms(root, paper);
  if (!file) return null;
  const edition = overrides.edition ?? (await loadBilingualEdition(paper, root));
  const occurrences = displayOccurrences(edition?.blocks ?? [], edition?.units ?? []);
  return {
    ...checkDisplayTerms(file, paper, {
      occurrences,
      concordance: loadConcordanceForPaper(paper).entries,
      isRegistered: isRegisteredQuantityId,
    }),
    occurrences,
  };
}

/**
 * Every paper's displays, compiled, with the problems of every paper. The inspector's facts come
 * from the model equations the display is bound to, for the quantities those records name. Every
 * other quantity gets the registry fallback (fallbackFacts.ts, dispatch 250), so each printed term
 * opens an inspector.
 */
export async function printedDisplays(
  root: string,
  papers: readonly string[],
  equations: readonly CompiledEquation[],
  options: Readonly<{
    /** Where a concordance first use opens (firstUseTargets.ts); without it, no link is given. */
    firstUse?: (paper: string, anchor: string) => string | null;
    /** The reader descriptions; by default content/reader-descriptions/quantities.yaml. */
    readerDescriptions?: ReadonlyMap<string, string>;
  }> = {},
): Promise<{
  displays: readonly PrintedDisplayPayload[];
  problems: readonly DisplayTermsProblem[];
}> {
  const displays: PrintedDisplayPayload[] = [];
  const problems: DisplayTermsProblem[] = [];
  const byId = new Map(equations.map((e) => [e.id, e]));
  const registry = getQuantityRegistry().quantities;
  const descriptions =
    options.readerDescriptions ?? loadReaderDescriptions(root, isRegisteredQuantityId);
  for (const paper of papers) {
    const checked = await checkPaperDisplays(root, paper);
    if (!checked) continue;
    problems.push(...checked.problems);
    const bound = boundEquations(root, paper);
    const concordance = loadConcordanceForPaper(paper).entries;
    for (const display of checked.displays) {
      const compiled = compilePrintedDisplay(display);
      const records = (bound.get(display.display) ?? []).flatMap((id) => {
        const record = byId.get(id);
        return record ? [record] : [];
      });
      const scope = checked.occurrences.get(display.display)?.[0];
      const facts: Record<string, TermFacts> = {};
      for (const { quantityId } of compiled.legend) {
        if (facts[quantityId]) continue;
        const quantity = records.flatMap((r) => r.terms).find((t) => t.quantityId === quantityId);
        if (quantity) {
          facts[quantityId] = termFacts(records, quantity.quantity);
          continue;
        }
        // checkDisplayTerms refuses an unregistered id, so this lookup finds every bound one.
        const registered = registry.get(quantityId);
        if (!registered) continue;
        const glyphs = compiled.legend
          .filter((l) => l.quantityId === quantityId)
          .map((l) => l.glyph);
        facts[quantityId] = fallbackTermFacts({
          paper,
          quantity: registered,
          about: descriptions.get(quantityId),
          notation: notationFor(concordance, glyphs, quantityId, scope, options.firstUse),
        });
      }
      const legend = compiled.legend.map((l) => {
        const link = notationLink(concordance, l.glyph, l.quantityId, scope, paper);
        const description = descriptions.get(l.quantityId);
        const row = link.meaning
          ? undefined
          : {
              name: registry.get(l.quantityId)?.name ?? l.quantityId,
              ...(description ? { description } : {}),
            };
        return {
          ...l,
          href: link.href,
          ...(link.meaning ? { hrefMeaning: link.meaning } : {}),
          ...(row ? { row } : {}),
        };
      });
      displays.push({ ...compiled, legend, facts });
    }
  }
  return { displays, problems };
}

/**
 * What a printed term's inspector would lack (dispatch 250): its name, a line saying what the term
 * is or does (a linked record's note, else its reader description), and a unit or dimension line.
 * Each gap names the paper, the display, the printed glyph and the quantity, so a quantity missing
 * from content/reader-descriptions/quantities.yaml is found term by term.
 */
export function inspectorGaps(
  displays: readonly Pick<PrintedDisplayPayload, "paper" | "display" | "legend" | "facts">[],
  nameOf: (paper: string, quantityId: string) => string | undefined,
): readonly string[] {
  const gaps: string[] = [];
  for (const d of displays)
    for (const { quantityId, glyph } of d.legend) {
      const term = `${d.paper} ${d.display} "${glyph}" (${quantityId})`;
      const facts = d.facts[quantityId];
      if (!facts) {
        gaps.push(`${term}: no inspector facts`);
        continue;
      }
      if (!nameOf(d.paper, quantityId)?.trim()) gaps.push(`${term}: no name`);
      if (facts.roles.length === 0 && !facts.about?.trim())
        gaps.push(
          `${term}: no line says what it is; content/reader-descriptions/quantities.yaml has no ${quantityId}`,
        );
      if (!facts.unit?.trim() && !facts.dimension.trim())
        gaps.push(`${term}: no unit or dimension`);
    }
  return gaps;
}

/**
 * What scripts/build-equations.ts refuses to publish: any problem, by name, as a bad equation
 * record stops the build; and one display id printed alike in two papers, since the faces find a
 * display by its id and its exact LaTeX and would colour one paper's formula with the other's
 * bindings (display ids repeat across papers).
 */
export function assertPublishable(
  printed: Readonly<{
    displays: readonly Pick<PrintedDisplayPayload, "paper" | "display" | "latex">[];
    problems: readonly DisplayTermsProblem[];
  }>,
): void {
  if (printed.problems.length > 0)
    throw new DisplayTermsError(
      "display-terms-invalid",
      `Printed display terms are invalid (content/display-terms/):\n${printed.problems.map((p) => `  ${p.code}: ${p.message}`).join("\n")}`,
    );
  const owner = new Map<string, string>();
  for (const d of printed.displays) {
    const key = `${d.display}\u0000${d.latex}`;
    const paper = owner.get(key);
    if (paper !== undefined && paper !== d.paper)
      throw new DisplayTermsError(
        "display-terms-key-collision",
        `Printed display ${d.display} is printed alike in ${paper} and ${d.paper}.`,
      );
    owner.set(key, d.paper);
  }
}
