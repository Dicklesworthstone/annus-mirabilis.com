/**
 * The connections record (dispatch 253), loaded and refused by src/content/connections/connections.ts.
 */
import { describe, expect, test } from "bun:test";
import { ConnectionsError, loadConnections, parseConnections } from "./connections.ts";

/** The refusal's code, or null where the call does not refuse. */
function refusal(raw: unknown): string | null {
  try {
    parseConnections(raw);
    return null;
  } catch (error) {
    if (error instanceof ConnectionsError) return error.code;
    throw error;
  }
}

const use = {
  from: { paper: "special-relativity", result: "sr-light-complex-energy" },
  to: { paper: "mass-energy", result: "me-light-energy-transformation" },
  text: "The mass-energy paper starts from it.",
};
const borrows = {
  id: "energy-transformation",
  kind: "borrows",
  label: "Uses a result",
  what: "The September paper takes it from relativity §8.",
  papers: ["special-relativity", "mass-energy"],
  uses: use,
};
const parallel = {
  id: "counting",
  kind: "same-maths",
  label: "Shares a mathematical pattern",
  what: "Counting independent configurations.",
  papers: ["light-quanta", "brownian-motion"],
};
const one = (entry: Record<string, unknown>) => ({ connections: [entry] });

describe("the connections record", () => {
  test("the repository's file loads, and only a borrowed result records a use", () => {
    const connections = loadConnections();
    expect(connections.length).toBeGreaterThan(0);
    const withUse = connections.filter((c) => c.uses);
    expect(withUse.length).toBeGreaterThan(0);
    expect(withUse.every((c) => c.kind === "borrows")).toBe(true);
    // The use the dispatch names: relativity § 8's light-energy card, used by the September paper.
    expect(withUse.map((c) => [c.uses?.from.result, c.uses?.to.paper])).toContainEqual([
      "sr-light-complex-energy",
      "mass-energy",
    ]);
  });

  test("accepts a borrowed result and a connection that records none", () => {
    expect(parseConnections({ connections: [borrows, parallel] }).map((c) => c.id)).toEqual([
      "energy-transformation",
      "counting",
    ]);
  });

  test("refuses each malformed record by name", () => {
    expect(refusal({})).toBe("connections-invalid-file");
    expect(refusal(one({ ...parallel, label: "" }))).toBe("connection-invalid-field");
    expect(refusal({ connections: [parallel, parallel] })).toBe("connection-duplicate-id");
    expect(refusal(one({ ...parallel, kind: "inspired" }))).toBe("connection-unknown-kind");
    expect(refusal(one({ ...parallel, papers: ["light-quanta", "optics"] }))).toBe(
      "connection-unknown-paper",
    );
    // A use exactly when the kind is borrows: a parallel route that claims one, and a borrow without.
    expect(refusal(one({ ...parallel, uses: use }))).toBe("connection-use-mismatch");
    expect(refusal(one({ ...borrows, uses: undefined }))).toBe("connection-use-mismatch");
    expect(
      refusal(one({ ...borrows, uses: { ...use, from: { paper: "optics", result: "x" } } })),
    ).toBe("connection-use-unknown-paper");
    expect(
      refusal(
        one({
          ...borrows,
          uses: { ...use, from: { paper: "special-relativity", result: "Bad Id" } },
        }),
      ),
    ).toBe("connection-use-invalid-result");
    // A use between papers the connection does not join, or with no words.
    expect(
      refusal(
        one({
          ...borrows,
          uses: { ...use, to: { paper: "light-quanta", result: "lq-ionization" } },
        }),
      ),
    ).toBe("connection-use-invalid");
    expect(refusal(one({ ...borrows, uses: { ...use, text: " " } }))).toBe(
      "connection-use-invalid",
    );
  });
});
