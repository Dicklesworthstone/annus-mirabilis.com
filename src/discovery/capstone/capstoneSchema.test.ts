/**
 * The capstone record's rules (am-disc-capstones-infra-3352), driven from the fixture the bead
 * specifies: six claims whose dependencies are A->C, B->C, C->D, D->E, D->F.
 *
 * Every refusal below is reached by breaking the VALID fixture one field at a time, so each case
 * differs from a passing record in exactly the thing it is named for. The control is asserted first:
 * a fixture that did not validate would make every "this now fails" line meaningless.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import {
  type Capstone,
  type CapstoneResolvers,
  CapstoneSchemaError,
  checkCapstoneReferences,
  validateCapstone,
} from "./capstoneSchema.ts";

const FIXTURE = join(
  process.cwd(),
  "src",
  "discovery",
  "capstone",
  "__fixtures__",
  "capstone-fixture.yaml",
);

/** A fresh mutable copy each time, so one case cannot leak into the next. */
function raw(): Record<string, unknown> {
  return strictParse(readFileSync(FIXTURE, "utf8"), "yaml") as Record<string, unknown>;
}

/** An element that must be there. A test that silently read `undefined` would assert nothing. */
function at<T>(values: unknown, index: number, what: string): T {
  const list = values as T[];
  const value = list[index];
  if (value === undefined) throw new Error(`the fixture has no ${what} at index ${index}`);
  return value;
}

function refusal(mutate: (record: Record<string, unknown>) => void): CapstoneSchemaError {
  const record = raw();
  mutate(record);
  try {
    validateCapstone(record);
  } catch (error) {
    if (error instanceof CapstoneSchemaError) return error;
    throw error;
  }
  throw new Error("the record validated when it should have been refused");
}

describe("the capstone record", () => {
  test("the fixture validates, and carries the chain the tests depend on", () => {
    const capstone = validateCapstone(raw());
    expect(capstone.id).toBe("capstone-fixture");
    expect(capstone.claims.length).toBe(6);
    expect(capstone.paperOrder).not.toEqual(capstone.startOrder);
    // The graph the bead names, read back from the record rather than trusted.
    const edges = capstone.claims
      .flatMap((claim) => claim.buildsOn.map((from) => `${from}->${claim.id}`))
      .sort();
    expect(edges).toEqual(
      [
        "claim-a->claim-c",
        "claim-b->claim-c",
        "claim-c->claim-d",
        "claim-d->claim-e",
        "claim-d->claim-f",
      ].sort(),
    );
  });

  test("too few claims, a duplicate claim, and an unknown role are each refused by name", () => {
    expect(
      refusal((r) => {
        // Five is the minimum, so one short of it is four: the fixture's six lose two.
        (r.claims as unknown[]).pop();
        (r.claims as unknown[]).pop();
      }).code,
    ).toBe("capstone-too-few-claims");
    expect(
      refusal((r) => {
        const claims = r.claims as Record<string, unknown>[];
        claims[1] = { ...claims[1], id: claims[0]?.id };
      }).code,
    ).toBe("capstone-duplicate-claim");
    expect(
      refusal((r) => {
        at<Record<string, unknown>>(r.claims, 0, "claim").logicalRole = "inspiration";
      }).code,
    ).toBe("capstone-invalid-role");
  });

  test("a cycle in the chain is refused, and so is a paper order that breaks it", () => {
    const cycle = refusal((r) => {
      // claim-a builds on claim-f, which already depends on a, c and d: a cycle.
      at<Record<string, unknown>>(r.claims, 0, "claim").buildsOn = ["claim-f"];
    });
    expect(cycle.code).toBe("capstone-chain-cycle");
    expect(cycle.message).toContain("cycle");

    const order = refusal((r) => {
      r.paperOrder = ["claim-d", "claim-a", "claim-b", "claim-c", "claim-e", "claim-f"];
    });
    expect(order.code).toBe("capstone-paper-order-inconsistent");
    expect(order.message).toContain("claim-c before claim-d");
  });

  test("a start order equal to the paper's is refused, because that is copying", () => {
    const e = refusal((r) => {
      r.startOrder = [...(r.paperOrder as string[])];
    });
    expect(e.code).toBe("capstone-start-order-is-paper-order");
  });

  test("an order that is not a permutation of the claims is refused", () => {
    expect(
      refusal((r) => {
        r.startOrder = ["claim-a", "claim-b", "claim-c"];
      }).code,
    ).toBe("capstone-order-invalid");
  });

  test("assumptions must be used, named, and present on a heuristic step", () => {
    expect(
      refusal((r) => {
        (r.assumptions as Record<string, unknown>[]).push({
          id: "assume-unused",
          statement: "Something nothing in the chain leans on.",
          kind: "premise",
        });
      }).code,
    ).toBe("capstone-unused-assumption");
    expect(
      refusal((r) => {
        at<Record<string, unknown>>(r.claims, 0, "claim").assumptionIds = ["assume-nowhere"];
      }).code,
    ).toBe("capstone-unknown-assumption");
    expect(
      refusal((r) => {
        // claim-c is the fixture's heuristic inference.
        at<Record<string, unknown>>(r.claims, 2, "claim").assumptionIds = [];
      }).code,
    ).toBe("capstone-heuristic-without-assumption");
  });

  test("two to four equations, and one to four instrument settings", () => {
    expect(
      refusal((r) => {
        (r.equations as unknown[]).pop();
      }).code,
    ).toBe("capstone-equation-count");
    expect(
      refusal((r) => {
        const equations = r.equations as Record<string, unknown>[];
        r.equations = [...equations, ...equations, ...equations];
      }).code,
    ).toBe("capstone-equation-count");
    expect(
      refusal((r) => {
        r.presets = [];
      }).code,
    ).toBe("capstone-preset-count");
    expect(
      refusal((r) => {
        delete at<Record<string, unknown>>(r.presets, 0, "preset").tapeId;
      }).code,
    ).toBe("capstone-preset-address");
  });

  test("a quantity typed into a claim is refused, and a year is not", () => {
    const e = refusal((r) => {
      at<Record<string, unknown>>(r.claims, 3, "claim").text =
        "The mean square grows in proportion to the time, reaching 0.79 μm after one second.";
    });
    expect(e.code).toBe("capstone-literal-number");
    expect(e.message).toContain("0.79 μm");

    // The other direction, which is what keeps the rule usable: a bare number and a year pass, so a
    // claim may say "the two pulses" or cite a date without being refused.
    const withYear = raw();
    at<Record<string, unknown>>(withYear.claims, 3, "claim").text =
      "The two pulses, as the paper of 1905 sets them out, leave the average unchanged.";
    expect(validateCapstone(withYear).claims[3]?.text).toContain("1905");
  });

  test("scoring language in worksheet copy is refused by the site's own voice lint", () => {
    const e = refusal((r) => {
      r.explanationPrompt = "Your score: 3 of 5. Explain the chain to someone else.";
    });
    expect(e.code).toBe("capstone-voice");
    // The finding comes from checkVoice, and this file defines no vocabulary of its own.
    expect(e.message.length).toBeGreaterThan(0);
  });

  test("the shape refusals every field leans on: not an object, not a list, an unknown assumption kind", () => {
    // Each of these is a site the refusal ratchet counts, and each is reached rather than named.
    for (const raw of [null, "a capstone", 42]) {
      try {
        validateCapstone(raw);
        throw new Error("a non-object validated");
      } catch (error) {
        expect((error as CapstoneSchemaError).code).toBe("capstone-invalid-record");
      }
    }
    expect(
      refusal((r) => {
        r.claims = "claim-a, claim-b";
      }).code,
    ).toBe("capstone-not-a-list");
    expect(
      refusal((r) => {
        at<Record<string, unknown>>(r.claims, 0, "claim").buildsOn = "claim-b";
      }).code,
    ).toBe("capstone-ids-not-a-list");
    expect(
      refusal((r) => {
        at<Record<string, unknown>>(r.assumptions, 0, "assumption").kind = "hunch";
      }).code,
    ).toBe("capstone-invalid-assumption-kind");
    expect(
      refusal((r) => {
        delete at<Record<string, unknown>>(r.claims, 0, "claim").text;
      }).code,
    ).toBe("capstone-missing-text");
    // Its sibling site: an id is a different refusal from a missing sentence, and an author who
    // forgot one wants to be told which.
    expect(
      refusal((r) => {
        delete at<Record<string, unknown>>(r.claims, 0, "claim").id;
      }).code,
    ).toBe("capstone-missing-id");
  });

  test("references resolve through injected resolvers, and each failure names what is missing", () => {
    const capstone: Capstone = validateCapstone(raw());
    const all: CapstoneResolvers = {
      anchorExists: () => true,
      instrumentExists: () => true,
      equationExists: () => true,
      equationHasSpokenForm: () => true,
      tapeExists: () => true,
      presetExists: () => true,
      scenarioExists: () => true,
    };
    expect(() => checkCapstoneReferences(capstone, all)).not.toThrow();

    const cases: [Partial<CapstoneResolvers>, string][] = [
      [{ anchorExists: () => false }, "capstone-unresolved-anchor"],
      [{ instrumentExists: () => false }, "capstone-unresolved-instrument"],
      [{ tapeExists: () => false }, "capstone-unresolved-tape"],
      [{ scenarioExists: () => false }, "capstone-unresolved-scenario"],
      [{ equationExists: () => false }, "capstone-unresolved-equation"],
      [{ equationHasSpokenForm: () => false }, "capstone-equation-without-spoken-form"],
    ];
    for (const [override, code] of cases) {
      try {
        checkCapstoneReferences(capstone, { ...all, ...override });
        throw new Error(`${code}: resolved when it should not have`);
      } catch (error) {
        expect([code, (error as CapstoneSchemaError).code]).toEqual([code, code]);
      }
    }

    // A setting may name a preset instead of a tape, and that address is resolved too. The fixture
    // names a tape, so this branch needs a record that names a preset or it is never reached.
    const byPreset = raw();
    const preset = at<Record<string, unknown>>(byPreset.presets, 0, "preset");
    delete preset.tapeId;
    preset.presetId = "bm-01-einstein";
    const withPreset = validateCapstone(byPreset);
    expect(() => checkCapstoneReferences(withPreset, all)).not.toThrow();
    try {
      checkCapstoneReferences(withPreset, { ...all, presetExists: () => false });
      throw new Error("an unknown preset resolved");
    } catch (error) {
      expect((error as CapstoneSchemaError).code).toBe("capstone-unresolved-preset");
    }
  });
});
