/**
 * Equation records for the foundation lessons (paper "foundations").
 *
 * A lesson is not a paper: its record names the lesson where a paper's names an argument, it is
 * reading-only by declaration, and a lesson's formula may be shown only as that lesson's own
 * records. Each rule has a case that must pass and a planted one that must fail for its reason.
 */
import { describe, expect, test } from "bun:test";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { FOUNDATION_QUANTITIES, pickQuantity } from "../../equations/foundationQuantities.ts";
import { BROWNIAN_QUANTITIES } from "../../equations/quantities.ts";
import { parseEquationRecord } from "../../equations/record.ts";
import { compileReadingContent } from "./compile.ts";
import { buildContentIndexes } from "./indexes.ts";

const ID = "eq-model-fd-test-log-product";
const ln = (argument: unknown, name: string) => ({
  kind: "function",
  name: "ln",
  opId: `${ID}.op.${name}`,
  argument,
});
const sym = (name: string, quantityId: string) => ({
  kind: "symbol",
  termId: `${ID}.t.${name}`,
  quantityId,
});
function lessonRecord(change: (r: Record<string, unknown>) => void = () => {}) {
  const tree = {
    kind: "relation",
    operator: "=",
    opId: `${ID}.op.relation`,
    left: ln(
      {
        kind: "product",
        opId: `${ID}.op.product`,
        args: [sym("a", "genericNumberA"), sym("b", "genericNumberB")],
      },
      "lnProduct",
    ),
    right: {
      kind: "sum",
      opId: `${ID}.op.sum`,
      args: [ln(sym("a2", "genericNumberA"), "lnA"), ln(sym("b2", "genericNumberB"), "lnB")],
    },
  };
  const ids = [
    "op.relation",
    "op.lnProduct",
    "op.product",
    "t.a",
    "t.b",
    "op.sum",
    "op.lnA",
    "t.a2",
    "op.lnB",
    "t.b2",
  ].map((x) => `${ID}.${x}`);
  const r: Record<string, unknown> = {
    schemaVersion: 1,
    kind: "equation",
    id: ID,
    paper: "foundations",
    argument: "logarithms",
    title: "A test identity",
    spoken: "The log of A B is log A plus log B.",
    explanation: "A test fixture, not an authored lesson.",
    review: "draft",
    notation: "modern-pedagogical",
    unitSystem: "si",
    live: false,
    assumptions: ["A test fixture."],
    tree,
    notes: ids.map((nodeId) => ({
      nodeId,
      title: "Fixture node",
      explanation: "A test fixture, not an authored explanation.",
      foundation: "logarithms",
    })),
    bindings: [],
    sentence: [{ text: "A fixture." }],
  };
  change(r);
  return r;
}

/** The real corpus, plus the fixture record, with the logarithms lesson's first formula naming `names`. */
async function compileWith(record: Record<string, unknown>, names: readonly string[]) {
  const files = (await loadReadingFiles()).map((f) => {
    const r = JSON.parse(f.text);
    if (r.kind !== "foundation" || r.id !== "logarithms") return f;
    const formula = r.explanation.find((b: { kind: string }) => b.kind === "formula");
    formula.equations = [...names];
    return { ...f, text: JSON.stringify(r) };
  });
  files.push({ path: `equations/foundations/${ID}.json`, text: JSON.stringify(record) });
  return compileReadingContent(files);
}
const codes = (result: { diagnostics: readonly { code: string; severity: string }[] }) =>
  result.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);

describe("foundation lesson equation records", () => {
  test("a lesson record parses when it declares live: false", () => {
    expect(parseEquationRecord(lessonRecord(), "fixture").paper).toBe("foundations");
  });

  test("planted: a lesson record without live: false is refused", () => {
    const r = lessonRecord((x) => {
      delete x.live;
    });
    expect(() => parseEquationRecord(r, "fixture")).toThrow(/reading-only: declare live: false/);
  });

  test("the compiler joins a lesson record to its lesson and keeps it out of every paper", async () => {
    const result = await compileWith(lessonRecord(), [ID]);
    expect(codes(result)).toEqual([]);
    expect(result.foundationEquations.map((e) => e.id)).toContain(ID);
    for (const paper of result.papers) expect(paper.equations.map((e) => e.id)).not.toContain(ID);
  });

  test("planted: a lesson record whose lesson does not exist is refused", async () => {
    const result = await compileWith(
      lessonRecord((x) => {
        x.argument = "no-such-lesson";
      }),
      [],
    );
    expect(codes(result)).toContain("dangling-reference");
    expect(
      result.diagnostics.some(
        (d) => d.path === ID && d.message.includes("foundation: no-such-lesson"),
      ),
    ).toBe(true);
  });

  test("planted: a lesson formula naming a paper's equation is refused", async () => {
    const result = await compileWith(lessonRecord(), ["eq-model-bm-rms"]);
    expect(codes(result)).toContain("formula-equation-placement");
  });

  test("planted: a lesson formula naming another lesson's record is refused", async () => {
    const result = await compileWith(
      lessonRecord((x) => {
        x.argument = "derivatives";
      }),
      [ID],
    );
    expect(codes(result)).toContain("formula-equation-placement");
  });

  test("refusal foundation-quantity-unregistered: a lesson reuses a paper's quantity only by a registered id", () => {
    expect(pickQuantity(BROWNIAN_QUANTITIES, "molarGasConstant").glyph).toBe("R");
    let caught: unknown;
    try {
      pickQuantity(BROWNIAN_QUANTITIES, "noSuchQuantity");
    } catch (error) {
      caught = error;
    }
    expect((caught as { code?: string }).code).toBe("foundation-quantity-unregistered");
    // The table itself: every entry carries its own id, and a changed glyph keeps the quantity's meaning.
    for (const [id, q] of Object.entries(FOUNDATION_QUANTITIES)) expect(q.id).toBe(id);
    expect(FOUNDATION_QUANTITIES.volume?.glyph).toBe("v");
    expect(FOUNDATION_QUANTITIES.volume?.dimension).toEqual(["3", "0", "0", "0", "0", "0"]);
  });
});

describe("the structural index accepts a lesson record only under an existing lesson", () => {
  const records = (argument: string) =>
    new Map<string, unknown>([
      [
        ID,
        lessonRecord((x) => {
          x.argument = argument;
        }),
      ],
      [
        "logarithms",
        { kind: "foundation", id: "logarithms", prerequisites: [], explanation: [], example: [] },
      ],
    ]);
  const errors = (r: ReturnType<typeof buildContentIndexes>) =>
    r.errors.map((d) => `${d.code}: ${d.message}`);

  test("a lesson record under its lesson raises no reference error", () => {
    expect(errors(buildContentIndexes(records("logarithms")))).toEqual([]);
  });

  test("planted: a lesson record under a missing lesson is a dangling reference", () => {
    expect(errors(buildContentIndexes(records("no-such-lesson")))).toContain(
      "dangling-reference: Equation references unknown foundation: no-such-lesson",
    );
  });
});
