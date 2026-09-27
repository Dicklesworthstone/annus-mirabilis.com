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

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"];

const papers = process.argv.slice(2).length > 0 ? process.argv.slice(2) : PAPERS;
let problems = 0;
for (const paper of papers) {
  const checked = await checkPaperExplanations(process.cwd(), paper);
  const { census } = checked;
  console.log(
    `${paper}: ${census.explained} of ${census.displays} displays explained, ${census.refused} refused, ${census.missing} with no record`,
  );
  for (const p of checked.problems) console.log(`  ${p.code}: ${p.message}`);
  if (checked.missing.length > 0) console.log(`  no record yet: ${checked.missing.join(", ")}`);
  problems += checked.problems.length;
}
process.exit(problems > 0 ? 1 : 0);
