import { describe, expect, test } from "bun:test";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { compileContent, compileReadingContent } from "../compiler/compile.ts";

/*
  prepare:content runs compileContent; the render path relies on compileReadingContent. Both must
  refuse a formula that names a record which does not exist, or which belongs to another argument.
  PearlIbis found the first one accepting a dangling link (build-content exited 0).
*/
const files = await loadReadingFiles();
const PATH = "arguments/mass-energy/arg-me-constant-premise.json";
const source = files.find((f) => f.path.endsWith(PATH));
if (!source) throw new Error(`${PATH} is not in the corpus.`);

function corpusNaming(ids: readonly string[]) {
  const record = JSON.parse(source?.text ?? "{}");
  const block = record.readings.full.find(
    (b: { kind: string; equations?: string[] }) => b.kind === "formula" && b.equations?.length,
  );
  block.equations = [...ids];
  return files.map((f) => (f === source ? { ...f, text: JSON.stringify(record) } : f));
}
const codes = (diagnostics: readonly { code: string; severity: string }[]) =>
  diagnostics.filter((d) => d.severity === "error").map((d) => d.code);

describe("both compilers hold a formula's equation links to the same rule", () => {
  test("the corpus as authored: neither reports a formula link", async () => {
    const prepared = await compileContent(files);
    expect(codes(prepared.diagnostics)).not.toContain("formula-equation-placement");
    expect(
      prepared.diagnostics.filter(
        (d) => d.code === "dangling-reference" && String(d.message).includes("Formula names"),
      ),
    ).toEqual([]);
  });

  test("a record that does not exist is refused by prepare's compiler and the render compiler", async () => {
    const planted = corpusNaming(["eq-model-me-no-such-record"]);
    expect(codes((await compileContent(planted)).diagnostics)).toContain("dangling-reference");
    expect(codes(compileReadingContent(planted).diagnostics)).toContain("dangling-reference");
  });

  test("another argument's record is refused by both", async () => {
    // eq-model-me-rest-ledger belongs to arg-me-two-ledgers.
    const planted = corpusNaming(["eq-model-me-rest-ledger"]);
    expect(codes((await compileContent(planted)).diagnostics)).toContain(
      "formula-equation-placement",
    );
    expect(codes(compileReadingContent(planted).diagnostics)).toContain(
      "formula-equation-placement",
    );
  });
});
