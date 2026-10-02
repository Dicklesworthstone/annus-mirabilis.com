/**
 * An author's strict check of the laboratories' formula explanations (dispatch 291):
 *
 *   bun scripts/check-lab-explanations.ts [--missing]
 *
 * Prints the census and every problem of content/lab-explanations/ (src/equations/printed/
 * labExplanations.ts), and exits 1 on any problem. A displayed formula with no entry is counted as
 * missing and listed with --missing; it is not yet a failure, so that the labs can be filled in one
 * at a time while the tree stays green.
 *
 * The census names its denominator: every displayed formula of every lab page is a formula that
 * needs a judgement, so an empty run reads as "0 of 89 explained, 89 missing" and never as clean.
 */
import { checkLabExplanations } from "../src/equations/printed/labExplanations.ts";
import { printedExplanation } from "../src/equations/printed/printedExplanations.ts";

const checked = checkLabExplanations(process.cwd(), { displayRecord: printedExplanation });
const { census } = checked;
console.log(
  `lab formulas: ${census.explained} of ${census.displayed} displayed formulas explained ` +
    `(${census.reused} reusing a paper's record, ${census.own} in the lab's own words), ` +
    `${census.incidental} judged incidental, ${census.missing} with no entry` +
    (census.inlineExplained > 0
      ? `; ${census.inlineExplained} inline formulas also explained`
      : ""),
);
for (const problem of checked.problems) console.log(`  ${problem.code}: ${problem.message}`);
if (process.argv.includes("--missing"))
  for (const missing of checked.missing) console.log(`  no entry: ${missing}`);
process.exit(checked.problems.length > 0 ? 1 : 0);
