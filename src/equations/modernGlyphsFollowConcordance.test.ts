/**
 * EVERY MODERN LETTER A RECORD PRINTS IS THE CONCORDANCE'S (dispatch 256).
 *
 * The explanation faces draw each model record from its expression tree through the paper's
 * teaching registry, plus any per-record override (`printedGlyphs`). The notation concordance
 * (content/notation/<paper>.yaml) says, per section, the modern letter each printed letter is
 * renamed to. Light quanta's registry printed ρ_ν, N, ν_in, ν_out and E_abs where the
 * concordance renames to u_ν, N_A, ν₁, ν₂ and L (fixed in 2158d1b1). This test holds all four papers
 * to it.
 *
 * A symbol is compared the way the notation toggle resolves it (notationForms.ts): the entries
 * bound to its quantity whose scope covers the record's section (its argument's), a component
 * index choosing the component's own entry, and an entry that records a printed number left out.
 * Unlike the toggle, it does not refuse electromagnetic quantities: a letter is a letter in any
 * unit system.
 *
 * It FAILS on two things, both about the single in-scope entry being a rename:
 * - the rename is to a LETTER, and the record prints a different letter;
 * - the rename is to an EXPRESSION (dispatch 259). Drawn in a symbol's place, an expression changes
 *   the formula around it. Wien's α and β as 8πh/c³ and h/k_B would turn § 2's N = (β/α)·8πR/L³
 *   into N = R/k_B, and the mass decrease as L/c² would print L/c² = L/c². An identification like
 *   that is a modernization, which the schema has a kind for, and which this test passes.
 * It REPORTS the rest by name and count, because none of them is a letter to compare:
 * - an entry that is not a rename (a modernization or a unit conversion);
 * - a quantity the concordance maps elsewhere in the paper but not in this section. Settling that
 *   needs the plate for each case, and meanwhile the symbol prints its printed glyph;
 * - more than one candidate entry, or no entry for the quantity at all.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import { scopeMatches } from "../content/notation/resolve.ts";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";
import { type Expression, walk } from "./ast.ts";
import { printsValue } from "./notationForms.ts";
import { recordQuantities } from "./printedGlyphs.ts";
import type { QuantityRegistry } from "./quantities.ts";
import { teachingProfile } from "./teachingProfiles.ts";

const ROOT = process.cwd();
const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"];

/**
 * One letter: a Latin letter or a command, primes, and at most one subscript, which may be an
 * upright label (\mathrm{s}). The toggle's LETTER, with the upright subscript the registries use.
 */
const LETTER =
  /^(?:\\math[a-z]+\{[A-Za-z]\}|\\[A-Za-z]+|[A-Za-z])'*(?:_(?:\{[A-Za-z0-9]+\}|\{\\mathrm\{[A-Za-z]+\}\}|\\[A-Za-z]+|[A-Za-z0-9]))?'*$/;

/** E'_{y} and E'_y are one letter: braces around a one-token subscript carry nothing. */
const sameLetter = (a: string, b: string): boolean =>
  a.replace(/_\{([^{}]+)\}/g, "_$1") === b.replace(/_\{([^{}]+)\}/g, "_$1");

type Outcome =
  | "agrees"
  | "letter-differs"
  | "expression-target"
  | "out-of-scope"
  | "ambiguous"
  | "not-mapped"
  | "not-a-rename";

type Finding = Readonly<{ key: string; outcome: Outcome; prints?: string; concordance?: string }>;

function modernGlyph(entry: ConcordanceEntry): string | undefined {
  if (entry.operation.kind !== "rename") return undefined;
  const glyph = (entry.operation.target as { modernGlyph?: unknown }).modernGlyph;
  if (typeof glyph === "string") return glyph;
  const g = glyph as { latex?: unknown } | undefined;
  return typeof g?.latex === "string" ? g.latex : undefined;
}

/** Each distinct symbol of a record's tree, measured against the concordance in its section. */
export function compareRecord(
  tree: Expression,
  table: QuantityRegistry,
  entries: readonly ConcordanceEntry[],
  section: string,
): Finding[] {
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const node of walk(tree)) {
    if (node.kind !== "symbol") continue;
    const { quantityId, index } = node;
    const key = index === undefined ? quantityId : `${quantityId}#${index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bound = entries.filter(
      (e) => "quantityId" in e.binding && e.binding.quantityId === quantityId && !printsValue(e),
    );
    const indexOf = (e: ConcordanceEntry) =>
      "quantityId" in e.binding ? e.binding.index : undefined;
    const here = bound.filter((e) => scopeMatches(e.scope, section, section));
    const component = index === undefined ? [] : here.filter((e) => indexOf(e) === index);
    const candidates = component.length > 0 ? component : here.filter((e) => !indexOf(e));
    if (bound.length === 0) out.push({ key, outcome: "not-mapped" });
    else if (candidates.length === 0) out.push({ key, outcome: "out-of-scope" });
    else if (candidates.length > 1) out.push({ key, outcome: "ambiguous" });
    else {
      const target = modernGlyph(candidates[0] as ConcordanceEntry);
      const letter = table[quantityId]?.glyph ?? "";
      const prints = component.length > 0 ? `${letter}_{${index}}` : letter;
      if (target === undefined) out.push({ key, outcome: "not-a-rename" });
      else if (sameLetter(target, prints)) out.push({ key, outcome: "agrees" });
      else
        out.push({
          key,
          outcome: LETTER.test(target) ? "letter-differs" : "expression-target",
          prints,
          concordance: target,
        });
    }
  }
  return out;
}

type RecordFile = Readonly<{
  id: string;
  argument?: string;
  tree: Expression;
  printedGlyphs?: Readonly<Record<string, string>>;
}>;

function paperFindings(paper: string) {
  const { entries } = loadConcordanceForPaper(paper);
  const sectionOf = new Map<string, string>();
  const argDir = join(ROOT, "content", "arguments", paper);
  for (const f of readdirSync(argDir).filter((f) => f.endsWith(".json"))) {
    const a = JSON.parse(readFileSync(join(argDir, f), "utf8")) as {
      id?: string;
      section?: string;
    };
    if (a.id && a.section) sectionOf.set(a.id, a.section);
  }
  const profile = teachingProfile(paper);
  if (!profile) throw new Error(`${paper} has no teaching profile`);
  const dir = join(ROOT, "content", "equations", paper);
  const records = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as RecordFile);
  const findings = records.flatMap((r) =>
    compareRecord(
      r.tree,
      recordQuantities(profile.quantities, r.printedGlyphs),
      entries,
      (r.argument ? sectionOf.get(r.argument) : undefined) ?? "",
    ).map((f) => ({ record: r.id, ...f })),
  );
  return { records: records.length, findings };
}

describe("modern letters follow the notation concordance", () => {
  for (const paper of PAPERS) {
    test(`${paper}: no record prints a letter the concordance renames to another, and no rename is to an expression`, () => {
      const { records, findings } = paperFindings(paper);
      const count = (o: Outcome) => findings.filter((f) => f.outcome === o).length;
      const compared = count("agrees") + count("letter-differs");
      // The denominator, printed: a sweep that compared nothing would pass the assertion below.
      console.log(
        `[modern letters] ${paper}: ${records} records / ${compared} letters compared, ${count("agrees")} agree, ${count("expression-target")} renamed to an expression; reported: ${count("out-of-scope")} out of scope, ${count("ambiguous")} ambiguous, ${count("not-mapped")} unmapped, ${count("not-a-rename")} not renames`,
      );
      expect(compared).toBeGreaterThan(0);
      const differs = findings
        .filter((f) => f.outcome === "letter-differs")
        .map((f) => `${f.record} ${f.key}: prints ${f.prints}, the concordance ${f.concordance}`);
      expect(differs).toEqual([]);
      // A rename to an expression fails too: file an identification as a modernization.
      const expressions = findings
        .filter((f) => f.outcome === "expression-target")
        .map(
          (f) =>
            `${f.record} ${f.key}: prints ${f.prints}, renamed to the expression ${f.concordance}`,
        );
      expect(expressions).toEqual([]);
    });
  }

  test("the comparison can fail: a record printing ρ_ν in § 1 is named", () => {
    // Positive control, independent of the corpus: the letter light quanta printed before 2158d1b1.
    const { entries } = loadConcordanceForPaper("light-quanta");
    const table = recordQuantities(teachingProfile("light-quanta")?.quantities ?? {}, {
      frequencyEnergyDensity: "\\rho_\\nu",
    });
    const tree = {
      kind: "symbol",
      termId: "plant.t.density",
      quantityId: "frequencyEnergyDensity",
    } as unknown as Expression;
    expect(compareRecord(tree, table, entries, "s1")).toEqual([
      {
        key: "frequencyEnergyDensity",
        outcome: "letter-differs",
        prints: "\\rho_\\nu",
        concordance: "u_\\nu",
      },
    ]);
  });
});
