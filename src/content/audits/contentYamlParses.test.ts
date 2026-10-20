/**
 * EVERY content YAML file parses with the parser the site actually uses.
 *
 * WHY THIS EXISTS. On 2026-10-19 four journey records went to origin/main carrying a `>-` folded
 * scalar. Python's `yaml.safe_load` reads that; `src/content/provenance/yaml.ts` does not, and it
 * is the parser the site and every gate go through. All four records fell out of the compiled
 * corpus, `[epistemic-world-checks]` dropped from 4 world checks to 0, and
 * `bun scripts/verify-content.ts` still exited `ok: true` -- its journey floor counted files READ.
 * The only witness was a census that logs by design.
 *
 * The repository had learned this twice before, in September and again on 2026-10-08, and each
 * time the lesson was written somewhere a person has to remember to read. Nothing refused. This
 * refuses.
 *
 * WHAT THE PARSER WILL NOT TAKE, measured directly against it rather than inferred: folded `>-`,
 * literal `|-`, a double-quoted scalar wrapped over two lines, a single-quoted one wrapped, a
 * plain one wrapped, and a flow sequence placed on the line after its key. **Only a single-line
 * scalar parses.** Long prose in a content record is one quoted line, and that convention is
 * written down nowhere else in the tree; this file is now where it is written down.
 *
 * DO NOT REPLACE THIS WITH A GREP. `rg ': *[>|]-\?$'` reports 54 files and is wrong:
 * `content/quantities/diffusion.yaml` matches and parses fine. The parser is the only authority
 * on what the parser accepts.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { reportPopulation } from "../../../scripts/gate-census/population.ts";
import { parseYaml } from "../provenance/yaml.ts";

const CONTENT = join(process.cwd(), "content");

/**
 * The files under a `.yaml` name that are deliberately JSON documents.
 *
 * `src/equations/missingStep/contentCheck.ts` selects exactly this set by its own regex and reads
 * it with `parseContentJson`, never with the YAML parser. The pattern here is the same shape, and
 * the exemption is EARNED rather than asserted: an exempt file must parse as JSON, so the list
 * cannot be used to park a YAML file that broke.
 */
const JSON_UNDER_YAML = /^equations\/(?:derivations\/[^/]+\.yaml|missing-step-allowlist\.yaml)$/;

function yamlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...yamlFiles(full));
    else if (name.endsWith(".yaml") || name.endsWith(".yml")) out.push(full);
  }
  return out;
}

describe("every content record parses with src/content/provenance/yaml.ts", () => {
  const files = yamlFiles(CONTENT).map((full) => ({
    full,
    rel: relative(CONTENT, full).split("\\").join("/"),
  }));

  /** The sweep itself, so a test can drive it with a planted record and see it report. */
  function sweep(records: readonly { rel: string; text: string }[]): {
    refused: string[];
    parsed: number;
  } {
    const refused: string[] = [];
    let parsed = 0;
    for (const { rel, text } of records) {
      if (JSON_UNDER_YAML.test(rel)) continue;
      try {
        parseYaml(text);
        parsed += 1;
      } catch (error) {
        refused.push(`${rel}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { refused, parsed };
  }

  test("no file is refused by the parser the site reads it with", () => {
    const { refused, parsed } = sweep(
      files.map(({ full, rel }) => ({ rel, text: readFileSync(full, "utf8") })),
    );
    expect(refused).toEqual([]);
    const vacuous = reportPopulation({
      gate: "content-yaml-parses",
      examined: parsed,
      noun: "content records parsed with the site's own YAML parser",
      minimum: 2000,
    });
    expect(vacuous).toBe(false);
  });

  test("the JSON-under-yaml exemption is earned: each exempt file IS json", () => {
    const exempt = files.filter(({ rel }) => JSON_UNDER_YAML.test(rel));
    // Named denominator: the exemption covers a real, small set, not everything that broke.
    expect(exempt.length).toBeGreaterThan(0);
    expect(exempt.length).toBeLessThan(10);
    for (const { full, rel } of exempt) {
      const text = readFileSync(full, "utf8");
      let document: unknown;
      let failure: string | null = null;
      try {
        document = JSON.parse(text);
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }
      expect(failure, `${rel} is exempt from the YAML sweep but is not JSON either`).toBeNull();
      // And it is a document, not a bare scalar that happens to be valid JSON: `null`, `0` and
      // `"x"` all parse, and none of them is a content record.
      expect(typeof document, `${rel} parsed as JSON but is not an object`).toBe("object");
      expect(document).not.toBeNull();
    }
  });

  test("CONTROL: the sweep reports a planted record, so the green above is reached", () => {
    /*
     * The sweep returning an empty list and the sweep never reaching its predicate are both
     * green. This drives the same function with the real corpus plus one planted record in the
     * exact shape that shipped, and requires it to be named.
     *
     * Nothing is written to content/: the sweep takes (path, text) pairs.
     */
    const real = files.map(({ full, rel }) => ({ rel, text: readFileSync(full, "utf8") }));
    const planted = {
      rel: "journeys/planted.yaml",
      text: ['id: "planted"', "description: >-", "  one line", "  and another", ""].join("\n"),
    };
    const { refused, parsed } = sweep([...real, planted]);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain("journeys/planted.yaml");
    // And the real corpus still counted, so the plant did not replace the population.
    expect(parsed).toBeGreaterThan(2000);
  });

  test("CONTROL: an exempt PATH cannot hide a broken record, because the exemption is checked", () => {
    // A planted file under the exempt pattern is skipped by the sweep, which is why the second
    // test above requires every exempt file to be real JSON. Both halves are needed: this one
    // shows the skip is real, that one shows it is earned.
    const planted = {
      rel: "equations/missing-step-allowlist.yaml",
      text: "description: >-\n  this would otherwise be refused\n",
    };
    expect(sweep([planted]).refused).toEqual([]);
  });

  test("CONTROL: the parser really does refuse a folded scalar", () => {
    /*
     * Without this the sweep above would pass on a parser that accepted everything, which is
     * indistinguishable from a corpus with nothing wrong. The fixture is the exact construct
     * that shipped: a key whose value is a `>-` block.
     */
    const folded = ['id: "x"', "description: >-", "  one line", "  and another", ""].join("\n");
    expect(() => parseYaml(folded)).toThrow();

    // ...and takes the single-line form the corpus uses, so the refusal above is about the
    // CONSTRUCT and not about the fixture being malformed some other way.
    const single = ['id: "x"', 'description: "one line and another"', ""].join("\n");
    const ok = parseYaml(single) as { description?: string };
    expect(ok.description).toBe("one line and another");
  });

  test("CONTROL: the other multi-line forms are refused too, so the rule is the flat one", () => {
    // Stated as cases rather than as prose, because "only a single-line scalar parses" is the
    // rule and an author meeting one refusal tends to try the next form.
    const cases: Record<string, string> = {
      "literal |-": 'id: "x"\ndescription: |-\n  one line\n  and another\n',
      "double-quoted wrapped": 'id: "x"\ndescription: "one line\n  and another"\n',
      "single-quoted wrapped": "id: \"x\"\ndescription: 'one line\n  and another'\n",
      "plain wrapped": 'id: "x"\ndescription: one line\n  and another\n',
    };
    for (const [name, text] of Object.entries(cases)) {
      expect(() => parseYaml(text), `${name} should be refused`).toThrow();
    }
  });
});
