/**
 * A reading formula that names equation records (reading.ts `equations`) is shown AS those records,
 * coloured by quantity, in the formula's place. So every named id must be an equation record, of
 * the same argument: another argument's equation would put the wrong claim where the formula was.
 *
 * WHY A SECOND COPY OF THIS RULE. compileReadingContent (compile.ts) already refuses both, and
 * was the only place that did. But `prepare:content` runs compileContent (compiler.ts), a
 * different pipeline, and it accepted a dangling link: PearlIbis (pane %43) planted
 * "eq-model-sr-no-such-record" and build-content exited 0. A link that passes prepare and fails
 * only at render, silently falling back to the plain formula, is the defect this closes. The two
 * copies are held to one behaviour by formulaEquations.test.ts, which runs both on the same plants.
 */
import { type ContentCheck, registerCheck } from "../compiler/checks/registry.ts";

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);

export const FORMULA_EQUATIONS_CHECK: ContentCheck = {
  id: "formula-equations",
  family: "structural",
  severity: "error",
  description: "A formula's named equation records exist and belong to the formula's own argument.",
  run({ records, report }) {
    for (const [id, record] of records) {
      if (!isObj(record) || record.kind !== "argument" || !isObj(record.readings)) continue;
      for (const blocks of Object.values(record.readings)) {
        if (!Array.isArray(blocks)) continue;
        for (const block of blocks) {
          if (!isObj(block) || block.kind !== "formula" || !Array.isArray(block.equations))
            continue;
          for (const named of block.equations) {
            const target = records.get(String(named));
            if (!isObj(target) || target.kind !== "equation")
              report({
                recordId: id,
                rule: "dangling-reference",
                message: `Formula names ${String(named)}, which is not an equation record.`,
                repair: "Name an eq-model- record that exists, or remove the link.",
              });
            else if (target.argument !== id)
              report({
                recordId: id,
                rule: "formula-equation-placement",
                message: `Formula names ${String(named)}, an equation of ${String(target.argument)}.`,
                repair: "Link a formula only to records of its own argument.",
              });
          }
        }
      }
    }
  },
};

export function registerFormulaEquationsCheck(): void {
  registerCheck(FORMULA_EQUATIONS_CHECK);
}

// Auto-register upon import, as the structural checks do.
registerFormulaEquationsCheck();
