import assert from "node:assert/strict";
import test from "node:test";
import { nodeId, walk } from "../equations/ast.ts";
import { expressionLatex } from "../equations/latex.ts";
import { BROWNIAN_QUANTITIES } from "../equations/quantities.ts";
import { parseEquationRecord } from "../equations/record.ts";
import { teachingProfile } from "../equations/teachingProfiles.ts";
import { ME02_OUTPUTS } from "../experiments/me02/definition.ts";

function massEquation() {
  const id = "eq-model-me-test";
  const tree = {
    kind: "relation",
    opId: `${id}.op.equality`,
    operator: "=",
    left: { kind: "symbol", termId: `${id}.t.drop`, quantityId: "kineticEnergyDifference" },
    right: {
      kind: "product",
      opId: `${id}.op.product`,
      args: [
        { kind: "symbol", termId: `${id}.t.energy`, quantityId: "emittedEnergyRestFrame" },
        {
          kind: "sum",
          opId: `${id}.op.excess`,
          args: [
            { kind: "symbol", termId: `${id}.t.factor`, quantityId: "lorentzFactor" },
            { kind: "number", value: "-1" },
          ],
        },
      ],
    },
  };
  return {
    schemaVersion: 1,
    kind: "equation",
    id,
    paper: "mass-energy",
    argument: "arg-me-constant-premise",
    title: "A conditional energy difference",
    spoken: "The energy drop is L times gamma minus one.",
    explanation:
      "The offset must be unchanged; subtracting conservation equations does not prove it.",
    review: "draft",
    notation: "modern-pedagogical",
    unitSystem: "si",
    tree,
    notes: walk(tree)
      .filter((n) => nodeId(n))
      .map((n) => ({
        nodeId: nodeId(n),
        title: "Teaching term or operation",
        explanation: "A test fixture, not source transcription or a reviewed explanation.",
        foundation: "work-energy",
      })),
    bindings: [
      {
        termId: `${id}.t.drop`,
        quantityId: "kineticEnergyDifference",
        experimentId: "me-02",
        outputId: "kineticEnergyDifference",
        instanceSlot: "primary",
      },
    ],
    sentence: [{ text: "The unchanged-offset premise is required.", nodeId: `${id}.op.equality` }],
    assumptions: ["Equal opposite pulses; the same unknown C before and after emission."],
  };
}

test("mass-energy admission uses its own exact quantity and output contracts", () => {
  const e = parseEquationRecord(massEquation(), "fixture");
  const p = teachingProfile(e.paper);
  assert.equal(p.outputs["me-02"], ME02_OUTPUTS);
  assert.equal(p.quantities.kineticEnergyDifference.unit, "J");
  assert.equal(
    p.quantities.kineticEnergyDifference.semanticKind,
    ME02_OUTPUTS.kineticEnergyDifference.semanticKind,
  );
  assert.match(expressionLatex(e.tree, p.quantities), /\\Delta K = L/);
  assert.equal(e.review, "draft");
});

test("registering mass-energy does not expand the Brownian scope", () => {
  const p = teachingProfile("brownian-motion");
  assert.equal(p.quantities, BROWNIAN_QUANTITIES);
  assert.equal(p.outputs["me-02"], undefined);
  assert.equal(p.quantities.kineticEnergyDifference, undefined);
  const e = massEquation();
  e.paper = "brownian-motion";
  e.argument = "arg-bm-observable";
  assert.throws(() => parseEquationRecord(e, "cross-paper"));
});

test("scope tables and quantity definitions cannot be mutated", () => {
  const p = teachingProfile("mass-energy");
  for (const value of [p, p.quantities, p.outputs, ...Object.values(p.quantities)])
    assert.ok(Object.isFrozen(value));
  assert.throws(() => {
    p.quantities.lorentzFactor.glyph = "beta";
  });
  assert.throws(() => {
    p.outputs["bm-01"] = ME02_OUTPUTS;
  });
});

for (const [label, change] of [
  [
    "unregistered paper",
    (e) => {
      e.paper = "light-quanta";
    },
  ],
  [
    "prototype paper",
    (e) => {
      e.paper = "__proto__";
    },
  ],
  [
    "wrong argument",
    (e) => {
      e.argument = "arg-bm-observable";
    },
  ],
  [
    "unregistered quantity",
    (e) => {
      e.tree.left.quantityId = "diffusionCoefficient";
    },
  ],
  [
    "wrong laboratory",
    (e) => {
      e.bindings[0].experimentId = "bm-01";
    },
  ],
  [
    "wrong output meaning",
    (e) => {
      e.bindings[0].outputId = "quadraticKineticDifference";
    },
  ],
  [
    "pretended review",
    (e) => {
      e.review = "reviewed";
    },
  ],
  [
    "pretended source notation",
    (e) => {
      e.notation = "printed";
    },
  ],
  [
    "non-SI units",
    (e) => {
      e.unitSystem = "normalized";
    },
  ],
  [
    "wrong dimensional relation",
    (e) => {
      e.tree.right = { kind: "symbol", termId: `${e.id}.t.speed`, quantityId: "speedOfLight" };
    },
  ],
  [
    "same-unit wrong semantic relation",
    (e) => {
      e.tree.right = {
        kind: "symbol",
        termId: `${e.id}.t.quadratic`,
        quantityId: "quadraticKineticDifference",
      };
    },
  ],
])
  test(`paper-scoped admission refuses ${label}`, () => {
    const e = massEquation();
    change(e);
    assert.throws(() => parseEquationRecord(e, label));
  });

test("accessors are rejected before selecting a profile", () => {
  const e = massEquation();
  let called = false;
  Object.defineProperty(e, "paper", {
    enumerable: true,
    get() {
      called = true;
      return "mass-energy";
    },
  });
  assert.throws(() => parseEquationRecord(e, "accessor"));
  assert.equal(called, false);
  for (const input of [null, {}, "constructor", "toString"])
    assert.equal(teachingProfile(input), null);
});
