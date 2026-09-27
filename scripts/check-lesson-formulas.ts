/**
 * An author's strict check of the lessons' formula edges (dispatch 300):
 *
 *   bun scripts/check-lesson-formulas.ts
 *
 * Prints the census of content/lesson-formulas/ (src/content/lessonFormulas.ts) and every problem,
 * and exits 1 on any. A lesson with no file yet is not a failure, so the lessons can be filled in
 * one at a time while the tree stays green; a lesson WITH a file must judge every formula block it
 * has, and the census names that denominator, so an empty file reads as "6 with no entry" rather
 * than as a clean run.
 */
import { checkLessonFormulas } from "../src/content/lessonFormulas.ts";

const { census, problems } = checkLessonFormulas(process.cwd());
console.log(
  `lesson formulas: ${census.lessons} lessons covered, ${census.blocks} formula blocks in them; ` +
    `${census.used} name a printed display (${census.edges} edges), ` +
    `${census.notUsed} record that no paper prints the shape, ` +
    `${census.plain} declare letters plain (${census.plainGlyphs} letters).`,
);
for (const problem of problems) console.log(`  ${problem.code}: ${problem.message}`);
process.exit(problems.length > 0 ? 1 : 0);
