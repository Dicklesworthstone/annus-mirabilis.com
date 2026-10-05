/**
 * An author's strict check of the equation explanations (dispatch 278):
 *
 *   bun scripts/check-equation-explanations.ts [paper ...]
 *
 * For each paper named (every paper with printed displays when none is), prints the census and every
 * problem of its records (src/equations/printed/equationExplanations.ts), and exits 1 on any
 * problem, as the build does only once the paper is enforced. A display with no record is listed;
 * it fails here only for an enforced paper.
 */
import { checkPaperExplanations } from "../src/equations/printed/equationExplanations.ts";
import { marginCountRefusal } from "../src/equations/printed/historianMargin.ts";

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"];

const papers = process.argv.slice(2).length > 0 ? process.argv.slice(2) : PAPERS;
let problems = 0;
for (const paper of papers) {
  const checked = await checkPaperExplanations(process.cwd(), paper);
  const { census } = checked;
  console.log(
    `${paper}: ${census.explained} of ${census.displays} displays explained, ${census.refused} refused, ${census.missing} with no record; ` +
      // r0, r1 and r2 are required of every record; r3 is optional, so its absence is the one gap
      // no count showed until am-8gbg. Printed beside the verdict rather than left to be found.
      `${census.withMargin} of ${census.explained} carry a historian's margin`,
  );
  for (const p of checked.problems) console.log(`  ${p.code}: ${p.message}`);
  if (checked.missing.length > 0) console.log(`  no record yet: ${checked.missing.join(", ")}`);
  problems += checked.problems.length;

  // The coarse half of the historian's-margin gate (am-8gbg). r3 is optional, so a record losing one
  // is not a refusal from readRecord the way a lost r0 is; the count above would simply move. This
  // holds each paper to the number recorded in historianMargin.baseline.json. It is a count and says
  // so: historianMargin.test.ts, in the other lane, is what names the record.
  const marginRefusal = marginCountRefusal(paper, census.withMargin);
  if (marginRefusal) {
    console.log(`  explanation-margin-lost: ${marginRefusal}`);
    problems += 1;
  }
}
process.exit(problems > 0 ? 1 : 0);
