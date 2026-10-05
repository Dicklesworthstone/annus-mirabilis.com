/**
 * WHAT EACH INSTRUMENT'S `acceptanceCases` REF ACTUALLY RESOLVES TO (am-nxbq).
 *
 * am-nxbq: 119 refs across the 33 manifests, and a dangling scenario id is indistinguishable from a
 * real one to every gate that runs. AGENTS.md requires acceptance cases "including refusals and
 * non-numeric results", and the refs that name a refusal were the ones that dangled, so no instrument
 * had resolvable evidence that a reader can reach a refusal from a control.
 *
 * THE ANSWER IS WORSE THAN A DANGLING ID, and finding it took three wrong measurements of mine.
 *
 * Measured 2026-10-05 over all 33 manifests, 119 refs:
 *
 *   13  resolve to content/scenarios/<ref>.yaml -- a real case with expected outputs
 *   57  are REGISTERED PRESET IDS (REGISTERED_PRESET_IDS in src/content/schemas/experiment.ts)
 *   11  are preset names in a component's own ordering list, registered nowhere
 *   38  are not a literal anywhere in src/
 *
 * A PRESET IS NOT AN ACCEPTANCE CASE. It is a starting parameter set; it carries no expected output, no
 * tolerance and no refusal. AGENTS.md requires acceptance cases "including refusals and non-numeric
 * results", so 106 of the 119 refs name something that cannot satisfy the field they sit in, whether or
 * not the name resolves. That is a sharper statement than am-nxbq's: the problem is not only that ids
 * dangle, it is that the field is mostly pointed at the wrong KIND of record.
 *
 * HOW I GOT IT WRONG THREE TIMES, since each error is one this file exists to prevent:
 *
 *   1. A grep for each unresolved ref across src/ found all 106 "present", which would have reported
 *      the problem solved. Checked as string literals through the AST, only 68 are there; the other 38
 *      appear in comments and prose ABOUT the missing fixture. am-nxbq's original count of 37
 *      appearing-nowhere was right and my grep was wrong.
 *   2. I then called those 68 "declared in-code fixtures" and generated a ref-to-file map by taking the
 *      first file whose text contained the literal. That is not a declaration of anything: 57 of the
 *      files were one schema module.
 *   3. Reading it, the 57 are REGISTERED_PRESET_IDS and the other 11 are PRESET_ORDER arrays in two lab
 *      components. Every one is a preset. "Appears as a literal in a named file" had resolved a ref to
 *      a different kind of name in a different population -- the same error as the grep, one level up.
 *
 * So the resolution here is by KIND, from registries rather than from file contents: a scenario file, a
 * registered preset, a component-local preset name, or nothing. The classes are exhaustive and the test
 * asserts there is no fifth, because a ref that fell out of the taxonomy is how this started.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import ts from "typescript";

export type RefResolution =
  /** content/scenarios/<ref>.yaml: a case with expected outputs. The only kind that satisfies the field. */
  | "scenario"
  /** In REGISTERED_PRESET_IDS: a registered parameter set, with no expectation and no refusal. */
  | "registered-preset"
  /**
   * A module exports or lists this id as a string constant, and nothing else resolves it: a
   * component's own PRESET_ORDER array, or a named constant like MIXED_DIFFUSION_SCENARIO in the
   * circularity check. The id is spelled somewhere on purpose; it is still not a case.
   */
  | "declared-constant"
  /** Not a string literal anywhere under src/, and no scenario file. */
  | "unresolved";

export type AcceptanceRef = Readonly<{
  /** The laboratory's manifest id, e.g. "bm-01". */
  lab: string;
  ref: string;
  resolution: RefResolution;
  /** Where it resolved: the scenario path, the fixture file, or the reason it did not. */
  detail: string;
}>;

/** Every `acceptanceCases` entry, read from the manifests with a real YAML parse. */
export function acceptanceCaseRefs(
  root: string,
): readonly Readonly<{ lab: string; ref: string }>[] {
  const dir = join(root, "content/experiments");
  if (!existsSync(dir)) return [];
  const out: { lab: string; ref: string }[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".yaml")) continue;
    const doc = parseYaml(readFileSync(join(dir, file), "utf8")) as {
      acceptanceCases?: unknown;
    } | null;
    const cases = doc?.acceptanceCases;
    if (!Array.isArray(cases)) continue;
    for (const entry of cases)
      if (typeof entry === "string" && entry.trim() !== "")
        out.push({ lab: file.replace(/\.yaml$/, ""), ref: entry.trim() });
  }
  return Object.freeze(out);
}

/** Every string literal in one source file, by AST, so a comment can never match. */
export function stringLiteralsOf(path: string): ReadonlySet<string> {
  const text = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

export type ResolveInputs = Readonly<{
  /** ref to the module declared to spell it as a string constant. Verified by AST, not by grep. */
  declaredConstants: Readonly<Record<string, string>>;
}>;

export function resolveAcceptanceCases(
  root: string,
  inputs: ResolveInputs,
  registeredPresets: ReadonlySet<string>,
): readonly AcceptanceRef[] {
  const scenarioDir = join(root, "content/scenarios");
  const scenarios = existsSync(scenarioDir)
    ? new Set(
        readdirSync(scenarioDir)
          .filter((f) => f.endsWith(".yaml"))
          .map((f) => f.replace(/\.yaml$/, "")),
      )
    : new Set<string>();
  const literalCache = new Map<string, ReadonlySet<string>>();
  const out: AcceptanceRef[] = [];
  for (const { lab, ref } of acceptanceCaseRefs(root)) {
    if (scenarios.has(ref)) {
      out.push({ lab, ref, resolution: "scenario", detail: `content/scenarios/${ref}.yaml` });
      continue;
    }
    // A REGISTRY, not a file search. The set is imported from the schema that owns it, so a preset
    // removed from the registry stops resolving here without anyone editing this module.
    if (registeredPresets.has(ref)) {
      out.push({
        lab,
        ref,
        resolution: "registered-preset",
        detail: "REGISTERED_PRESET_IDS: a parameter set, with no expected output and no refusal",
      });
      continue;
    }
    const declaredIn = inputs.declaredConstants[ref];
    if (declaredIn !== undefined) {
      const path = join(root, declaredIn);
      if (!existsSync(path)) {
        out.push({ lab, ref, resolution: "unresolved", detail: `${declaredIn} does not exist` });
        continue;
      }
      if (!literalCache.has(declaredIn)) literalCache.set(declaredIn, stringLiteralsOf(path));
      if (literalCache.get(declaredIn)?.has(ref) === true) {
        out.push({
          lab,
          ref,
          resolution: "declared-constant",
          detail: `${declaredIn}: spelled as a string constant there, and resolved by nothing else`,
        });
        continue;
      }
      out.push({
        lab,
        ref,
        resolution: "unresolved",
        detail: `${declaredIn} no longer holds "${ref}" as a string literal`,
      });
      continue;
    }
    out.push({
      lab,
      ref,
      resolution: "unresolved",
      detail: "no scenario file, not a registered preset, and no declared constant",
    });
  }
  return Object.freeze(out);
}

/** The counts beside the verdict, as a citation must carry them. */
export function summarizeAcceptanceCases(resolved: readonly AcceptanceRef[]): string {
  const count = (r: RefResolution) => resolved.filter((x) => x.resolution === r).length;
  const refusals = resolved.filter((x) => /refus/i.test(x.ref));
  return (
    `${resolved.length} acceptanceCases ref(s) examined: ${count("scenario")} are a scenario with expected ` +
    `outputs, ${count("registered-preset")} a registered preset, ${count("declared-constant")} a ` +
    `declared constant, ${count("unresolved")} resolve to nothing. ` +
    `Of ${refusals.length} refs naming a refusal, ${refusals.filter((r) => r.resolution === "scenario").length} ` +
    "is a scenario; a preset carries no refusal."
  );
}
