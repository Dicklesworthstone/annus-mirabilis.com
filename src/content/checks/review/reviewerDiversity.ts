/**
 * HOW MANY TRANSLATION UNITS HAVE A REVIEWER FROM A DIFFERENT MODEL FAMILY THAN THEIR TRANSLATOR
 * (am-rc1001-bridge-plan-pcjk.17).
 *
 * REPORT ONLY. This counts and prints; it refuses nothing, and it changes no unit's
 * `reviewState`. That is deliberate and is the bead's own instruction -- "Report-only mode first,
 * with a printed count" -- because whether English units must carry a cross-family round is
 * decision D-B, which belongs to the owner. Enforcing it unasked would turn 821 final units
 * non-final in one commit.
 *
 * WHAT IS BEING COUNTED, AND WHY IT IS WORTH COUNTING. D-2026-09-25-agent-reviewed-translations
 * made a unit final after "at least two independent review rounds" by "agents other than its
 * translator", and `validateAgentReview` enforces exactly that: a different reviewer ID. Measured
 * 2026-10-10 over the committed corpus, every reviewer ID differs and every reviewer MODEL does
 * not: 1,642 of 1,642 rounds are `claude-opus-5-5`, the translator's own model, recorded under
 * different pane names. The receipts are honest -- they say no person reviewed the translation --
 * but "independent" is doing lighter work than the word suggests, and nothing said so in a number
 * until this.
 *
 * IT READS THE FILES, NOT A LOADER'S OUTPUT. A layer between this and the YAML can drop a unit,
 * and a count over what survived would be a smaller corpus reported as a complete one (AGENTS.md,
 * "A Check Inherits The Silence Of Whatever It Reads"). The unit total is printed so a drop is
 * visible rather than silent.
 *
 * AN UNDECLARED MODEL IS NOT DIVERSITY. `familiesDiffer` returns `unknown-model` for an id its
 * table does not know, and that is counted in its own bucket, never as a different family: an id
 * nobody has classified could belong to the translator's family. `modelFamily.ts` records what a
 * substring test cost when `grok-4.6` and Gemini were misclassified (am-yvf3).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { familiesDiffer } from "./modelFamily.ts";

export type ReviewerDiversityCensus = Readonly<{
  /** Units carrying an `agentReview` block. */
  units: number;
  /** Review rounds across them. */
  rounds: number;
  /** Units with at least one round by a declared, different model family. */
  crossFamily: number;
  /** Units whose every round is by the translator's own family. */
  sameFamilyOnly: number;
  /** Units where some id is not in the family table, so no comparison could be made. */
  undeclaredModel: number;
  /** The distinct model ids seen, with their counts, so the population is legible. */
  modelIds: ReadonlyMap<string, number>;
}>;

/** The first `modelId:` under a named top-level block, read from the file's own bytes. */
function modelIdsUnder(text: string, block: string): string[] {
  const at = text.indexOf(`${block}:`);
  if (at === -1) return [];
  const tail = text.slice(at + block.length + 1);
  // Stop at the next top-level key, so `translator:`'s id is not read out of `agentReview:`.
  const end = tail.search(/\n[A-Za-z]/);
  const scope = end === -1 ? tail : tail.slice(0, end);
  return [...scope.matchAll(/modelId:\s*"?([^"\n]+)"?/g)].map((m) => m[1]?.trim() ?? "");
}

export function measureReviewerDiversity(root: string): ReviewerDiversityCensus {
  const base = resolve(root, "content/translation-units");
  let units = 0;
  let rounds = 0;
  let crossFamily = 0;
  let sameFamilyOnly = 0;
  let undeclaredModel = 0;
  const modelIds = new Map<string, number>();

  for (const paper of readdirSync(base).sort()) {
    const dir = join(base, paper);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".yaml")) continue;
      const text = readFileSync(join(dir, name), "utf8");
      if (!text.includes("agentReview:")) continue;
      units += 1;
      const translator = modelIdsUnder(text, "translator")[0] ?? "";
      const reviewers = modelIdsUnder(text, "agentReview");
      rounds += reviewers.length;
      for (const id of [translator, ...reviewers]) {
        if (id) modelIds.set(id, (modelIds.get(id) ?? 0) + 1);
      }
      let sawCross = false;
      let sawUndeclared = false;
      for (const reviewer of reviewers) {
        const verdict = familiesDiffer(translator, reviewer);
        if (verdict.kind === "differ") sawCross = true;
        else if (verdict.kind === "unknown-model") sawUndeclared = true;
      }
      // Order matters: a unit with one cross-family round is cross-family whatever else it has,
      // and an undeclared id is only decisive when nothing else established diversity.
      if (sawCross) crossFamily += 1;
      else if (sawUndeclared) undeclaredModel += 1;
      else sameFamilyOnly += 1;
    }
  }
  return { units, rounds, crossFamily, sameFamilyOnly, undeclaredModel, modelIds };
}

/** The census line, in the wording am-rc1001-bridge-plan-pcjk.17 asks for. */
export function formatReviewerDiversity(census: ReviewerDiversityCensus): string {
  const ids = [...census.modelIds]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${id} ${n}`)
    .join(", ");
  return (
    `[agent-review diversity] examined ${census.units} units (${census.rounds} rounds): ` +
    `${census.crossFamily} with a different-family reviewer, ` +
    `${census.sameFamilyOnly} same-family only, ` +
    `${census.undeclaredModel} with an undeclared model id. Model ids: ${ids}.` +
    (census.crossFamily === 0 && census.units > 0
      ? " 0 cross-family: every reviewer is the translator's own model, which satisfies" +
        " D-2026-09-25 (a different reviewer ID) and not the stronger reading of" +
        " independence. Report only; decision D-B is the owner's."
      : "")
  );
}
