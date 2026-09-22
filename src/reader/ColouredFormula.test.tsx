import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { type Block, validateReadingRecord } from "../content/schemas/reading.ts";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import { ReadingBlocks } from "./Blocks.tsx";
import { paperEquations } from "./paperEquations.ts";

const ARGUMENT = "arguments/mass-energy/arg-me-constant-premise.json";
const files = await loadReadingFiles();
const source = files.find((f) => f.path.endsWith(ARGUMENT));
if (!source) throw new Error(`${ARGUMENT} is not in the corpus.`);
const record = JSON.parse(source.text);
const full = record.readings.full as Block[];
const offsets = full.find((b) => b.kind === "formula" && b.equations?.length === 2);

/** The corpus with this argument's first linked formula naming `ids` instead. */
function corpusNaming(ids: string[]) {
  const changed = structuredClone(record);
  const block = changed.readings.full.find(
    (b: Block) => b.kind === "formula" && b.equations?.length === 2,
  );
  block.equations = ids;
  return files.map((f) => (f === source ? { ...f, text: JSON.stringify(changed) } : f));
}

describe("a reading formula can name the equation records that express it", () => {
  test("the authored record carries a linked formula, and the strict validator accepts it", () => {
    expect(offsets?.kind === "formula" && offsets.equations).toEqual([
      "eq-model-me-offset-before",
      "eq-model-me-offset-after",
    ]);
    expect(() => validateReadingRecord(record, ARGUMENT)).not.toThrow();
  });

  test("a name that is not an eq-model- id is refused at validation", () => {
    const changed = structuredClone(record);
    changed.readings.full.find((b: Block) => b.kind === "formula").equations = [
      "arg-me-two-ledgers",
    ];
    expect(() => validateReadingRecord(changed, ARGUMENT)).toThrow();
  });

  test("the corpus compiles cleanly with the links in place", () => {
    const result = compileReadingContent(files);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  test("naming another argument's equation is refused, because the reading would show its claim", () => {
    // eq-model-me-rest-ledger belongs to arg-me-two-ledgers.
    const result = compileReadingContent(corpusNaming(["eq-model-me-rest-ledger"]));
    expect(result.diagnostics.map((d) => d.code)).toContain("formula-equation-placement");
  });

  test("naming a record that does not exist is refused as a dangling reference", () => {
    const result = compileReadingContent(corpusNaming(["eq-model-me-no-such-record"]));
    expect(
      result.diagnostics.some(
        (d) => d.code === "dangling-reference" && d.message.includes("eq-model-me-no-such-record"),
      ),
    ).toBe(true);
  });
});

describe("the reading shows the named records, coloured, in the formula's place", () => {
  // The passage embeds a foundation lesson, so it renders with its paper's compiled foundations.
  const foundations =
    compileReadingContent(files).papers.find((p) => p.paper.id === "mass-energy")?.foundations ??
    [];
  const render = (equations: ReadonlyMap<string, CompiledEquation>) =>
    renderToStaticMarkup(
      <ReadingBlocks blocks={full} foundations={foundations} equations={equations} />,
    );

  test("with the records at hand: coloured relations, one rule per term, a legend, no plain copy", () => {
    const html = render(paperEquations("mass-energy"));
    expect(html).toContain('data-equations="eq-model-me-offset-before eq-model-me-offset-after"');
    expect(html).toContain('data-equations="eq-model-me-kinetic-drop-difference"');
    expect(html).toMatch(
      /\[data-term="eq-model-me-offset-before\.t\.[A-Za-z0-9]+"\]\{--qc:var\(--q-\d\)/,
    );
    expect(html).toContain('class="equation-legend"');
    // The legend names each quantity; C is the additive constant of the two frame ledgers.
    expect(html).toContain(">Unchanged additive energy offset</span>");
    // The formula's own LaTeX is not rendered a second time beside its coloured records.
    expect(html).not.toContain('data-latex="H_0-E_0=K_0+C');
  });

  test("with a named record missing: the formula's own text, never half of it coloured", () => {
    const partial = new Map(paperEquations("mass-energy"));
    partial.delete("eq-model-me-offset-after");
    const html = render(partial);
    expect(html).toContain('data-latex="H_0-E_0=K_0+C,\\qquad H_1-E_1=K_1+C"');
    expect(html).not.toContain('data-equations="eq-model-me-offset-before');
    // The other linked formula still resolves and is still coloured.
    expect(html).toContain('data-equations="eq-model-me-kinetic-drop-difference"');
  });
});
