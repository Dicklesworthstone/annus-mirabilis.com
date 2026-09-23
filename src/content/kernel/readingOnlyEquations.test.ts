/**
 * The `live: false` flag on an equation record (orchestrator ruling of 2026-09-23, dispatch 91).
 *
 * AGENTS.md scopes the kernel-binding rule to LIVE terms. A reading-only equation explains a step
 * and no laboratory value reaches it, so the audit does not ask an instrument's kernel for it. The
 * flag must not become an escape hatch, so three things are held here:
 *   1. the flag is explicit, and only `false` is admitted;
 *   2. a record without it is audited exactly as before;
 *   3. a flagged record may never bind a laboratory output, and if one did, the audit would still
 *      count it (the exemption needs the flag AND no bindings).
 * The parser half runs again in the build (prepare:content compiles every record), a different
 * lane from this one, which is where a flagged, bound record is refused before a page exists.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseEquationRecord } from "../../equations/record.ts";
import { liveTermsFromRecords } from "./check.ts";

const load = (name: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../../content/equations/brownian-motion/eq-model-bm-${name}.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
const withoutFlag = (r: Record<string, unknown>) => {
  const { live: _live, ...rest } = r;
  return rest;
};

describe("reading-only equation records (live: false)", () => {
  test("the parser admits live: false on a record that binds nothing", () => {
    const identity = { ...withoutFlag(load("square-of-sum")), live: false };
    expect(parseEquationRecord(identity, "identity").live).toBe(false);
  });

  test("planted negative: a reading-only record that binds a laboratory output is refused", () => {
    const bound: Record<string, unknown> = { ...load("rms"), live: false };
    expect((bound.bindings as unknown[]).length).toBeGreaterThan(0);
    expect(() => parseEquationRecord(bound, "bound")).toThrow(/must not bind a laboratory output/);
  });

  test("only false is admitted: true and look-alikes are refused", () => {
    for (const live of [true, "false", 0, null]) {
      const r = { ...withoutFlag(load("square-of-sum")), live };
      expect(() => parseEquationRecord(r, "look-alike")).toThrow(/Only `live: false`/);
    }
  });

  test("the audit exempts a flagged, unbound record and nothing else", () => {
    const experiment = {
      id: "bm-01",
      argumentIds: ["arg-bm-independent-steps", "arg-bm-observable"],
    };
    const records = (entries: Record<string, unknown>[]) =>
      new Map(entries.map((r) => [String(r.id), { ...r, kind: "equation" }]));

    // Unflagged: audited as before, placeholders included (guardrail 2, positive control).
    const unflagged = liveTermsFromRecords(
      experiment,
      records([withoutFlag(load("square-of-sum"))]),
    );
    expect(unflagged).toContain("genericNumberA");

    // Flagged and unbound: exempt.
    const flagged = liveTermsFromRecords(
      experiment,
      records([{ ...withoutFlag(load("square-of-sum")), live: false }]),
    );
    expect(flagged).not.toContain("genericNumberA");

    // Planted negative: flagged but bound (past the parser somehow) is STILL audited (guardrail 3).
    const boundAnyway = liveTermsFromRecords(
      experiment,
      records([{ ...load("rms"), live: false }]),
    );
    expect(boundAnyway).toContain("rmsDisplacement1d");
    expect(boundAnyway).toContain("diffusionCoefficient");
  });
});
