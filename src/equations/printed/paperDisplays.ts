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
import { isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import { type BilingualEdition, loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { type TermFacts, termFacts } from "../termFacts.ts";
import type { CompiledEquation } from "../viewTypes.ts";
import {
  type CheckedDisplay,
  type CompiledPrintedDisplay,
  checkDisplayTerms,
  compilePrintedDisplay,
  DisplayTermsError,
  type DisplayTermsFile,
  type DisplayTermsProblem,
  displayOccurrences,
  loadDisplayTerms,
} from "./displayTerms.ts";

/** A compiled display with what the inspector says about each of its quantities. */
export type PrintedDisplayPayload = CompiledPrintedDisplay &
  Readonly<{ facts: Readonly<Record<string, TermFacts>> }>;

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
} | null> {
  const file = overrides.file ?? loadDisplayTerms(root, paper);
  if (!file) return null;
  const edition = overrides.edition ?? (await loadBilingualEdition(paper, root));
  const occurrences = displayOccurrences(edition?.blocks ?? [], edition?.units ?? []);
  return checkDisplayTerms(file, paper, {
    occurrences,
    concordance: loadConcordanceForPaper(paper).entries,
    isRegistered: isRegisteredQuantityId,
  });
}

/**
 * Every paper's displays, compiled, with the problems of every paper. The inspector's facts come
 * from the model equations the display is bound to, for the quantities those records name.
 */
export async function printedDisplays(
  root: string,
  papers: readonly string[],
  equations: readonly CompiledEquation[],
): Promise<{
  displays: readonly PrintedDisplayPayload[];
  problems: readonly DisplayTermsProblem[];
}> {
  const displays: PrintedDisplayPayload[] = [];
  const problems: DisplayTermsProblem[] = [];
  const byId = new Map(equations.map((e) => [e.id, e]));
  for (const paper of papers) {
    const checked = await checkPaperDisplays(root, paper);
    if (!checked) continue;
    problems.push(...checked.problems);
    const bound = boundEquations(root, paper);
    for (const display of checked.displays) {
      const compiled = compilePrintedDisplay(display);
      const records = (bound.get(display.display) ?? []).flatMap((id) => {
        const record = byId.get(id);
        return record ? [record] : [];
      });
      const facts: Record<string, TermFacts> = {};
      for (const { quantityId } of compiled.legend) {
        const quantity = records.flatMap((r) => r.terms).find((t) => t.quantityId === quantityId);
        if (quantity) facts[quantityId] = termFacts(records, quantity.quantity);
      }
      displays.push({ ...compiled, facts });
    }
  }
  return { displays, problems };
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
