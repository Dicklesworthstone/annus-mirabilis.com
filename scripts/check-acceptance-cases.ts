/**
 * Do the instruments' acceptance cases resolve to anything? (am-nxbq, dispatch 304.)
 *
 *   bun scripts/check-acceptance-cases.ts [--strict] [--list]
 *
 * Prints the census and every problem, and exits 1 on any. The census names its denominator: every
 * acceptance ref in every manifest, and how many of them resolved, so a run that resolved none
 * cannot read as a clean one. --strict refuses every dangling ref rather than the ones the baseline
 * records, and asks every instrument for a refusal case and a non-numeric one; it is how this gate
 * will read once the debt is paid. --list prints each dangling ref with the instrument that names it.
 */
import { checkAcceptanceCases } from "../src/testing/acceptanceCases.ts";

const strict = process.argv.includes("--strict");
const report = checkAcceptanceCases({ strict });
const c = report.census;
console.log(
  `acceptance cases: ${c.resolved} of ${c.refs} refs resolved ` +
    `(${c.viaScenario} to a scenario, ${c.viaFixture} to a declared fixture), ${c.dangling} dangling; ` +
    `${c.instruments} instruments, ${c.scenarios} scenarios loaded; ` +
    `${c.instrumentsWithRefusal} instruments have a resolvable refusal case, ${c.instrumentsWithNonNumeric} a non-numeric one`,
);
for (const problem of report.problems) console.log(`  ${problem.code}: ${problem.message}`);
if (process.argv.includes("--list"))
  for (const row of report.refs.filter((r) => r.resolution === "dangling"))
    console.log(`  dangling: ${row.lab} ${row.ref}`);
process.exit(report.problems.length > 0 ? 1 : 0);
