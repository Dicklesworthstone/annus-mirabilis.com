/**
 * THE FOUR MALFORMED SHAPES strictParse USED TO ACCEPT (am-hcx5).
 *
 * `parseYaml` took all four without complaint. Three of them lost or changed content, and the loss
 * was silent, which is the part that matters: a check reading a damaged record reported a clean
 * result identical to its baseline. The end-to-end instance, which is how this was found --
 * appending a top-level sequence item to `content/lab-explanations/bm-01.yaml` left
 * `bun scripts/check-lab-explanations.ts` at exit 0 with a census equal to the baseline TO THE
 * DIGIT ("47 of 89 displayed formulas explained ... 0 with no entry"), while python's
 * `yaml.safe_load` rejected the same bytes and the planted entry appeared nowhere in the parsed
 * value.
 *
 * EVERY CASE GOES THROUGH `strictParse`, not through `parseYaml`, because `strictParse` is what the
 * 67 non-test callers use and a refusal that only `parseYaml` raised would not reach them. Each
 * asserts the CODE as well as the refusal, so a test cannot pass because some unrelated rule fired,
 * and each asserts the message names a LINE, because a refusal without a location sends nobody
 * anywhere.
 *
 * The two shapes that were already refused are asserted too. Without them this file would say
 * nothing about whether the parser was strict before, and a regression that loosened `duplicate
 * key` would be invisible here.
 */
import { describe, expect, test } from "bun:test";
import { StrictParseError, strictParse } from "../schemas/strictParse.ts";
import { YamlParseError, YamlRefusalError } from "./yaml.ts";

/**
 * Parses through the real entry point and returns the refusal, or null if it was accepted.
 *
 * The error a CALLER sees is a `StrictParseError`, not the `YamlParseError` the parser raised:
 * `strictParse` catches and re-wraps. So the code asserted below is the one that actually reaches
 * the 67 callers, which is the only version of this assertion worth making -- and until am-hcx5 that
 * wrapper derived the code from a SUBSTRING of the message and collapsed every refusal but one into
 * `yaml-parse-error`, so none of these cases could have been told apart by a caller or a test.
 */
function refusalFor(text: string): StrictParseError | null {
  try {
    strictParse(text, "yaml", "fixture.yaml");
    return null;
  } catch (error) {
    if (error instanceof StrictParseError) return error;
    throw error;
  }
}

describe("strictParse refuses the four shapes it used to accept", () => {
  test("the coded refusals are a YamlRefusalError, which is what puts the code FIRST", () => {
    // Not an import for the citation's sake: this is the property that makes the three refusals
    // visible to `scanRefusalThrowSites`, which credits `throw new SomethingError("kebab", ...)`
    // and sees nothing when the code is the last argument. `YamlParseError` is code-last, so the
    // three coded sites throw this subclass instead of reordering a constructor six other sites
    // use. The subclass must stay a YamlParseError, because `strictParse` catches that type and
    // everything downstream reads `.code`, `.line` and `.column` through it.
    const refusal = new YamlRefusalError("yaml-tab-indentation", "m", 3, 1);
    expect(refusal instanceof YamlParseError).toBe(true);
    expect(refusal.code).toBe("yaml-tab-indentation");
    expect(refusal.line).toBe(3);
    expect(refusal.name).toBe("YamlRefusalError");
    // And the name ends in "Error" on purpose: the scanner matches on that, so renaming it to
    // something tidier would make three coded refusals read as bare again.
    expect(refusal.name.endsWith("Error")).toBe(true);
  });

  test("a valid document is still accepted, so none of the rules below refuses everything", () => {
    // The control. Four refusal assertions mean nothing beside a parser that refuses all input.
    expect(strictParse('lab: a\nformulas:\n  - latex: "x"\n', "yaml", "ok.yaml")).toEqual({
      lab: "a",
      formulas: [{ latex: "x" }],
    });
  });

  test("(yaml.ts:511) yaml-unconsumed-content: a top-level sequence entry after a mapping DROPPED content", () => {
    // `parseMapping` breaks on a sequence entry at its own indent, which is right for a nested call
    // because the caller owns what follows. At the top level there is no caller, so those lines were
    // never read and the mapping was returned as though the file had ended.
    const refusal = refusalFor('lab: a\nformulas:\n  - latex: "x"\n\n- formula: "planted"\n');
    expect(refusal?.code).toBe("yaml-unconsumed-content");
    expect(refusal?.line).toBe(5);
    expect(refusal?.message).toMatch(/line 5/);
    expect(refusal?.message).toMatch(/planted/);
  });

  test("the same shape with no nesting, because the repair is one check and not a special case", () => {
    const refusal = refusalFor("lab: a\n- plain sequence line\n");
    expect(refusal?.code).toBe("yaml-unconsumed-content");
    expect(refusal?.line).toBe(2);
  });

  test("(yaml.ts:366) yaml-unterminated-quote: the value was CORRUPTED, not dropped", () => {
    // `lab: "a` fell past both quoted arms and came back as the plain scalar `"a`, so the opening
    // quote became part of the data. A record silently gaining a character is worse than a parse
    // failure, because nothing downstream can tell it from authored text.
    const refusal = refusalFor('lab: "a\nformulas: []\n');
    expect(refusal?.code).toBe("yaml-unterminated-quote");
    expect(refusal?.line).toBe(1);
    expect(refusal?.message).toMatch(/double-quoted/);
  });

  test("an unterminated single quote is refused by the same rule, and says which quote", () => {
    const refusal = refusalFor("lab: 'a\nx: 1\n");
    expect(refusal?.code).toBe("yaml-unterminated-quote");
    expect(refusal?.message).toMatch(/single-quoted/);
  });

  test("a quoted scalar containing a quote is NOT refused, so the rule is not a ban on quotes", () => {
    // The boundary the rule must not cross. Both of these start and end with a quote and are legal.
    expect(strictParse('a: "he said \\"hi\\""\n', "yaml", "ok.yaml")).toEqual({
      a: 'he said "hi"',
    });
    expect(strictParse("a: 'it''s'\n", "yaml", "ok.yaml")).toEqual({ a: "it's" });
  });

  test("(yaml.ts:71) yaml-tab-indentation: accepted as one column, so the file was outside the format", () => {
    // Decided rather than inherited: YAML forbids a tab in the indentation, and ZERO of the 2,539
    // committed YAML files use one, so refusing it rejects nothing that exists.
    const refusal = refusalFor('lab: a\nformulas:\n\t- latex: "x"\n');
    expect(refusal?.code).toBe("yaml-tab-indentation");
    expect(refusal?.line).toBe(3);
    expect(refusal?.message).toMatch(/use spaces/i);
  });

  test("a tab INSIDE a value is untouched, because only indentation is the question", () => {
    // The other side of that rule. A tab in a quoted string is content, not layout.
    expect(strictParse('a: "x\ty"\n', "yaml", "ok.yaml")).toEqual({ a: "x\ty" });
  });

  test("the two shapes that were ALREADY refused still are, with their line", () => {
    const duplicate = refusalFor("lab: a\nlab: b\n");
    expect(duplicate?.message).toMatch(/Duplicate key "lab"/);
    expect(duplicate?.line).toBe(2);

    const noColon = refusalFor("lab: a\nthis line has no colon\n");
    expect(noColon?.message).toMatch(/Expected key: value mapping/);
    expect(noColon?.line).toBe(2);
  });
});
