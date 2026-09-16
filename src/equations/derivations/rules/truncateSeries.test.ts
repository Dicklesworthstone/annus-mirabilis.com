import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { truncateSeriesRule } from "./truncateSeries.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const ARGS = { from: sym("f", "q"), to: sym("g", "q") };

test("truncate-series without a domain fails (truncation without a domain)", () => {
  const result = truncateSeriesRule.check({
    ...ARGS,
    params: { variable: "tau", order: 1, neglected: "O(tau^2) terms" },
  });
  assert.equal(result.outcome, "fail");
  assert.match(result.reason ?? "", /domain/);
});

test("truncate-series without a description of what was neglected fails", () => {
  const result = truncateSeriesRule.check({
    ...ARGS,
    params: { variable: "tau", order: 1, domain: "tau small" },
  });
  assert.equal(result.outcome, "fail");
  assert.match(result.reason ?? "", /neglected/);
});

test("truncate-series with a negative order fails", () => {
  const result = truncateSeriesRule.check({
    ...ARGS,
    params: { variable: "tau", order: -1, domain: "tau small", neglected: "higher order terms" },
  });
  assert.equal(result.outcome, "fail");
});

test("truncate-series with all side conditions present is unverifiable (spot check + review required)", () => {
  const result = truncateSeriesRule.check({
    ...ARGS,
    params: { variable: "tau", order: 1, domain: "tau small", neglected: "O(tau^2) terms" },
  });
  assert.equal(result.outcome, "unverifiable");
});
