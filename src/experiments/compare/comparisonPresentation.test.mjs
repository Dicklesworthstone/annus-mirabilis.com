import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPARISON_UNCERTAINTY_NOTE,
  comparisonInputRole,
  comparisonReadoutText,
  comparisonUncertaintyText,
} from "./comparisonPresentation.ts";

const result = (uncertainty) => ({
  status: "value",
  value: 2,
  unit: "m",
  semanticKind: "distance",
  reason: "",
  evidence: {
    status: "value",
    value: 2,
    quantityId: "distance",
    ownerId: "reference.distance",
    unit: "m",
    semanticKind: "distance",
    ...(uncertainty ? { uncertainty } : {}),
  },
});

test("readouts show scientific explanations rather than raw status identifiers", () => {
  assert.equal(comparisonReadoutText(result(), 100), "200");
  assert.equal(
    comparisonReadoutText({ status: "symbolic", value: null, reason: "Supply E₀." }),
    "Supply E₀.",
  );
  assert.equal(
    comparisonReadoutText({ status: "analytic-limit", value: null, reason: "" }),
    "This limiting case has its own representation.",
  );
});

test("statistical intervals convert units and preserve coverage, sample size and method", () => {
  const text = comparisonUncertaintyText(
    result({
      kind: "statistical-interval",
      lower: 1,
      upper: 3,
      coverage: 0.95,
      sampleSize: 100,
      method: "bootstrap",
    }),
    100,
    "cm",
  );
  assert.equal(text, "95% statistical interval: [100, 300] cm; sample size 100; bootstrap.");
});

test("enclosures remain enclosures, including an orientation-reversing conversion", () => {
  const r = result({ kind: "enclosure", lower: 1, upper: 3, method: "interval arithmetic" });
  assert.equal(
    comparisonUncertaintyText(r, -100, "cm"),
    "Enclosure: [−300, −100] cm; interval arithmetic.",
  );
});

for (const guarantee of ["bound", "estimate"]) {
  test(`numerical ${guarantee} is not promoted to a different guarantee`, () => {
    const r = result({
      kind: "numerical-error-estimate",
      magnitude: 0.01,
      method: "adaptive quadrature",
      guarantee,
    });
    assert.equal(
      comparisonUncertaintyText(r, -100, "cm"),
      `Numerical error ${guarantee}: 1 cm; adaptive quadrature.`,
    );
  });
}

test("input precision is not converted into an invented error bar", () => {
  const r = result({ kind: "input-precision", significantFigures: 3, source: "historical table" });
  assert.equal(
    comparisonUncertaintyText(r, 100, "cm"),
    "Input precision: 3 significant figures; historical table.",
  );
});

test("measurement uncertainty retains the dataset and uncertainty type", () => {
  const r = result({
    kind: "measurement-uncertainty",
    magnitude: 0.2,
    datasetId: "observations-1",
    uncertaintyType: "standard uncertainty",
  });
  assert.equal(
    comparisonUncertaintyText(r, 100, "cm"),
    "Measurement uncertainty: 20 cm; standard uncertainty; dataset observations-1.",
  );
});

test("missing uncertainty is not replaced by a fabricated interval", () => {
  assert.equal(comparisonUncertaintyText(result(), 1, "m"), null);
  assert.equal(comparisonUncertaintyText({ status: "symbolic", value: null }, 1, "m"), null);
  assert.match(COMPARISON_UNCERTAINTY_NOTE, /no uncertainty propagation or statistical significance/);
});

test("every command has its own scientific role instead of calling all changes physical", () => {
  for (const [command, label] of Object.entries({
    "setup-change": "Physically changed",
    "measurement-change": "Measurement changed",
    "observer-change": "Re-described",
    "estimator-change": "Estimator changed",
    "presentation-change": "View changed only",
  })) {
    assert.equal(comparisonInputRole(false, command), label);
    assert.equal(comparisonInputRole(true, command), "Held fixed (locked)");
  }
});
