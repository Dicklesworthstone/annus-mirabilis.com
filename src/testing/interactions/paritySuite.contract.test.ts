import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { familyParityCases } from "../../experiments/interactions/parity.suite.ts";

describe("ParitySuite: Contract & Fixture Guard (am-inst-interaction-families-m2ps)", () => {
  it("rejects calls missing ownerSource or ownerLabel", async () => {
    await assert.rejects(
      () =>
        familyParityCases("clock-event", {
          owner: {},
          ownerSource: "" as unknown as "reference-evaluator",
          ownerLabel: "events.ts",
        }),
      TypeError,
    );

    await assert.rejects(
      () =>
        familyParityCases("clock-event", {
          owner: {},
          ownerSource: "reference-evaluator",
          ownerLabel: "",
        }),
      TypeError,
    );
  });

  it("emits parityCaseId, family, ownerSource, and ownerLabel on every result", async () => {
    const results = await familyParityCases("fields-boosts", {
      owner: {},
      ownerSource: "reference-evaluator",
      ownerLabel: "fields.ts",
    });

    assert.ok(results.length > 0);
    for (const res of results) {
      assert.ok(res.parityCaseId);
      assert.equal(res.family, "fields-boosts");
      assert.equal(res.ownerSource, "reference-evaluator");
      assert.equal(res.ownerLabel, "fields.ts");
      assert.equal(typeof res.passed, "boolean");
    }
  });

  it("Fixture Guard: consumer mode rejects ownerSource: 'runtime-fixture'", async () => {
    await assert.rejects(
      () =>
        familyParityCases("clock-event", {
          owner: {},
          ownerSource: "runtime-fixture",
          ownerLabel: "runtime-fixture-events",
          mode: "consumer",
        }),
      /\[FixtureGuard\] Consumer mode rejects ownerSource: "runtime-fixture"/,
    );
  });

  it("Internal mode accepts ownerSource: 'runtime-fixture'", async () => {
    const results = await familyParityCases("clock-event", {
      owner: {},
      ownerSource: "runtime-fixture",
      ownerLabel: "runtime-fixture-events",
      mode: "internal",
    });

    assert.ok(results.length > 0);
    assert.equal(results[0]?.ownerSource, "runtime-fixture");
    assert.equal(results[0]?.passed, true);
  });
});
