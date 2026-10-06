/**
 * An author's strict check of the equation explanations (dispatch 278):
 *
 *   bun scripts/check-equation-explanations.ts [paper ...]
 *
 * For each paper named (every paper with printed displays when none is), prints the census and every
 * problem of its records (src/equations/printed/equationExplanations.ts), and exits 1 on any
 * problem, as the build does only once the paper is enforced. A display with no record is listed;
 * it fails here only for an enforced paper.
 *
 * AND IT PERSISTS WHAT IT FOUND (am-uxh9). This is one of five registered gates that still wrote no
 * artifact when the bead's sweep was re-derived on 2026-10-06; the sweep itself had covered 27
 * registry steps and the registry now has 48, so these five landed after it and were never asked.
 * A row per paper carrying its census, a row per problem, and a summary - so a run can be compared
 * with yesterday's rather than re-argued from a terminal nobody kept.
 */

import { checkPaperExplanations } from "../src/equations/printed/equationExplanations.ts";
import { marginCountRefusal } from "../src/equations/printed/historianMargin.ts";
import { TestLogger } from "../src/testing/log/logger.ts";
import { reportPopulation } from "./gate-census/population.ts";

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"];

const papers = process.argv.slice(2).length > 0 ? process.argv.slice(2) : PAPERS;
const logger = new TestLogger("equation-explanations");
let problems = 0;
let displaysExamined = 0;
for (const paper of papers) {
  const checked = await checkPaperExplanations(process.cwd(), paper);
  const { census } = checked;
  console.log(
    `${paper}: ${census.explained} of ${census.displays} displays explained, ${census.refused} refused, ${census.missing} with no record; ` +
      // r0, r1 and r2 are required of every record; r3 is optional, so its absence is the one gap
      // no count showed until am-8gbg. Printed beside the verdict rather than left to be found.
      `${census.withMargin} of ${census.explained} carry a historian's margin`,
  );
  displaysExamined += census.displays;
  // The paper's own row carries the census whatever the verdict, so a paper that stops being examined
  // at all is visible as a missing row rather than as a total that quietly got smaller.
  logger.log({
    paper,
    testId: `${paper}-census`,
    outcome: checked.problems.length === 0 ? "passed" : "failed",
    message:
      `${census.explained} of ${census.displays} displays explained, ${census.refused} refused, ` +
      `${census.missing} with no record, ${census.withMargin} with a historian's margin`,
  });
  for (const p of checked.problems) {
    console.log(`  ${p.code}: ${p.message}`);
    logger.log({ paper, testId: `${paper}:${p.code}`, outcome: "failed", message: p.message });
  }
  if (checked.missing.length > 0) console.log(`  no record yet: ${checked.missing.join(", ")}`);
  problems += checked.problems.length;

  // The coarse half of the historian's-margin gate (am-8gbg). r3 is optional, so a record losing one
  // is not a refusal from readRecord the way a lost r0 is; the count above would simply move. This
  // holds each paper to the number recorded in historianMargin.baseline.json. It is a count and says
  // so: historianMargin.test.ts, in the other lane, is what names the record.
  const marginRefusal = marginCountRefusal(paper, census.withMargin);
  if (marginRefusal) {
    console.log(`  explanation-margin-lost: ${marginRefusal}`);
    logger.log({
      paper,
      testId: `${paper}:explanation-margin-lost`,
      outcome: "failed",
      message: marginRefusal,
    });
    problems += 1;
  }
}
// One census line over every paper examined (am-rc1001-bridge-plan-pcjk.9). The per-paper lines above
// stay: they are what an author reads. This is what a reader across gates can compare.
//
// THE FLOOR IS PER PAPER, not a fraction of a total, and the first version of this got it wrong in a
// way worth keeping written down. Scaling one total by the NUMBER of papers asked for made
// `bun scripts/check-equation-explanations.ts mass-energy` report "7 displays (minimum 38) VACUOUS" on
// a completely correct run, because mass-energy prints 7 displays and relativity prints 98. A floor
// that depends on which papers were asked for has to be summed over those papers.
//
// Measured 2026-10-06: mass-energy 7, light-quanta 52, brownian-motion 43, special-relativity 98, 200
// in all. The floors are about 70% of each, so a full run clears 139 and a partial load does not.
const DISPLAY_FLOOR: Record<string, number> = {
  "mass-energy": 5,
  "light-quanta": 36,
  "brownian-motion": 30,
  "special-relativity": 68,
};
const vacuous = reportPopulation({
  gate: "equation-explanations",
  examined: displaysExamined,
  noun: `printed displays across ${papers.length} paper(s)`,
  // An unknown paper name contributes 1, so a typo cannot lower the floor to zero and pass.
  minimum: papers.reduce((sum, paper) => sum + (DISPLAY_FLOOR[paper] ?? 1), 0),
});
logger.log({
  testId: "equation-explanations-summary",
  outcome: problems > 0 || vacuous ? "failed" : "passed",
  message:
    `${displaysExamined} printed display(s) across ${papers.length} paper(s): ${papers.join(", ")}; ` +
    `${problems} problem(s)${vacuous ? "; REFUSED as vacuous against its declared floor" : ""}`,
});
await logger.flush();
console.log(`Structured log: ${logger.filePath}`);
process.exit(problems > 0 || vacuous ? 1 : 0);
