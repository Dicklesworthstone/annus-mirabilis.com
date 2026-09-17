import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import {
  type ArgumentNode,
  ArgumentSchemaError,
  type Bridge,
  type Foundation,
  type HistoricalPremise,
  type Misconception,
  type ObstacleResponses,
  type Quantity,
  type ReadingSet,
  type SemanticEquation,
  validateArgumentNode,
  validateFoundationOrBridge,
  validateHistoricalPremise,
  validateMisconception,
  validateObstacleResponses,
  validateQuantity,
  validateReadingSet,
  validateSemanticEquation,
} from "./argument.ts";
import { DimensionSchemaError } from "./dimensionBasis.ts";
import { strictParse } from "./strictParse.ts";

const SUITE = "content-schemas-argument";
const BEAD_ID = "am-cm-schemas-argument-llm";
const logger = new TestLogger(SUITE, newRunIdentity());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "__fixtures__/argument");

test.after(async () => {
  await logger.flush();
});

test("Integration: Valid YAML fixtures parsed via strictParse pass all argument layer schema validators", () => {
  const start = Date.now();

  // 1. Available Historical Premise
  const hpAvailYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "historical-premise-available-valid.yaml"),
    "utf8",
  );
  const rawHpAvail = strictParse(hpAvailYaml, "yaml");
  const hpAvail = validateHistoricalPremise(rawHpAvail);
  assert.equal(hpAvail.id, "rayleigh-1900-radiation-law");
  assert.equal(hpAvail.status, "available");
  assert.equal(hpAvail.date.latestYear, 1900);
  assert.equal(hpAvail.claimsEinsteinKnew, true);

  // 2. Later Historical Premise
  const hpLaterYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "historical-premise-later-valid.yaml"),
    "utf8",
  );
  const rawHpLater = strictParse(hpLaterYaml, "yaml");
  const hpLater = validateHistoricalPremise(rawHpLater);
  assert.equal(hpLater.id, "perrin-1909-brownian-measurements");
  assert.equal(hpLater.status, "later");
  assert.equal(hpLater.date.latestYear, 1909);

  // 3. Admitted Import Historical Premise
  const hpAdmitYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "historical-premise-admitted-import-valid.yaml"),
    "utf8",
  );
  const rawHpAdmit = strictParse(hpAdmitYaml, "yaml");
  const hpAdmit = validateHistoricalPremise(rawHpAdmit);
  assert.equal(hpAdmit.admittedImport, true);
  assert.equal(hpAdmit.status, "available");
  assert.equal(hpAdmit.date.latestYear, 1905);

  // 4. Verified Historical Premise
  const hpVerYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "historical-premise-verified-valid.yaml"),
    "utf8",
  );
  const rawHpVer = strictParse(hpVerYaml, "yaml");
  const hpVer = validateHistoricalPremise(rawHpVer);
  assert.equal(hpVer.verifier, "jemanuel");
  assert.equal(hpVer.evidenceLocator, "Doc 14, Collected Papers Vol 2");

  // 5. ArgumentNode with Recap and Evidence
  const argNodeYaml = fs.readFileSync(path.join(FIXTURES_DIR, "argument-node-valid.yaml"), "utf8");
  const rawArgNode = strictParse(argNodeYaml, "yaml");
  const argNode = validateArgumentNode(rawArgNode);
  assert.equal(argNode.id, "arg-bm-variance-of-sum");
  assert.equal(argNode.premises[0]?.edgeType, "historical-derivation");
  assert.equal(argNode.evidence[0]?.relation, "supports");
  assert.equal(argNode.recap?.startsWith("Established"), true);

  // 6. ArgumentNode without Recap
  const argNodeNoRecapYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "argument-node-no-recap-valid.yaml"),
    "utf8",
  );
  const rawArgNodeNoRecap = strictParse(argNodeNoRecapYaml, "yaml");
  const argNodeNoRecap = validateArgumentNode(rawArgNodeNoRecap);
  assert.equal(argNodeNoRecap.id, "arg-bm-diffusion-equilibrium");
  assert.equal(argNodeNoRecap.recap, undefined);

  // 7. Quantity with Spectral Density
  const qSpectralYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "quantity-spectral-density-valid.yaml"),
    "utf8",
  );
  const rawQSpectral = strictParse(qSpectralYaml, "yaml");
  const qSpectral = validateQuantity(rawQSpectral);
  assert.equal(qSpectral.id, "frequencyEnergyDensity");
  assert.equal(qSpectral.densityKind, "density");

  // 8. Quantity with Electric Field and Gaussian Dimension
  const qFieldYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "quantity-electric-field-valid.yaml"),
    "utf8",
  );
  const rawQField = strictParse(qFieldYaml, "yaml");
  const qField = validateQuantity(rawQField);
  assert.equal(qField.gaussianDimension?.length, 6);

  // 9. Dimensionless Quantity Angle
  const qAngleYaml = fs.readFileSync(path.join(FIXTURES_DIR, "quantity-angle-valid.yaml"), "utf8");
  const rawQAngle = strictParse(qAngleYaml, "yaml");
  const qAngle = validateQuantity(rawQAngle);
  assert.equal(qAngle.dimensionlessKind, "angle");

  // 10. Quantity with SI, Gaussian, and EMU CGS dimensions
  const qChargeYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "quantity-gram-equivalent-charge-valid.yaml"),
    "utf8",
  );
  const rawQCharge = strictParse(qChargeYaml, "yaml");
  const qCharge = validateQuantity(rawQCharge);
  assert.equal(qCharge.emuDimension?.length, 6);

  // 11. State-dependent Quantity
  const qStateDepYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "quantity-state-dependent-valid.yaml"),
    "utf8",
  );
  const rawQStateDep = strictParse(qStateDepYaml, "yaml");
  const qStateDep = validateQuantity(rawQStateDep);
  assert.equal(qStateDep.dimensionStatus, "state-dependent");

  // 12. Equation with term scale and EMU-CGS
  const eqYaml = fs.readFileSync(path.join(FIXTURES_DIR, "equation-valid.yaml"), "utf8");
  const rawEq = strictParse(eqYaml, "yaml");
  const eq = validateSemanticEquation(rawEq);
  assert.equal(eq.id, "eq-bm-s2-1");
  assert.equal(eq.terms[0]?.scale?.num, 1);
  assert.equal(eq.terms[0]?.scale?.den, 2);

  // 13. ReadingSet for footnote
  const rsYaml = fs.readFileSync(path.join(FIXTURES_DIR, "reading-set-valid.yaml"), "utf8");
  const rawRs = strictParse(rsYaml, "yaml");
  const rs = validateReadingSet(rawRs);
  assert.equal(rs.targetId, "s3-fn1");
  assert.equal(rs.targetKind, "footnote");

  // 14. Foundation with workedExample
  const foundYaml = fs.readFileSync(path.join(FIXTURES_DIR, "foundation-valid.yaml"), "utf8");
  const rawFound = strictParse(foundYaml, "yaml");
  const found = validateFoundationOrBridge(rawFound) as Foundation;
  assert.equal(found.id, "found-stokes-viscosity");
  assert.equal(found.kind, "foundation");
  assert.equal(found.workedExample.question.length > 0, true);

  // 15. Bridge entrance
  const bridgeYaml = fs.readFileSync(path.join(FIXTURES_DIR, "bridge-entrance-valid.yaml"), "utf8");
  const rawBridge = strictParse(bridgeYaml, "yaml");
  const bridge = validateFoundationOrBridge(rawBridge) as Bridge;
  assert.equal(bridge.id, "entrance-brownian-motion");
  assert.equal(bridge.kind, "bridge");
  assert.equal(bridge.continueWith?.length, 2);

  // 16. Misconception with 2 tempting claims
  const misc2ClaimsYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "misconception-two-claims-valid.yaml"),
    "utf8",
  );
  const rawMisc2Claims = strictParse(misc2ClaimsYaml, "yaml");
  const misc2Claims = validateMisconception(rawMisc2Claims);
  assert.equal(misc2Claims.temptingClaims.length, 2);

  // 17. Misconception with whereItIsTrue 'none'
  const miscNoneYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "misconception-where-true-none-valid.yaml"),
    "utf8",
  );
  const rawMiscNone = strictParse(miscNoneYaml, "yaml");
  const miscNone = validateMisconception(rawMiscNone);
  assert.equal(miscNone.whereItIsTrue.startsWith("none"), true);

  // 18. ObstacleResponses with camelCase keys
  const obsYaml = fs.readFileSync(path.join(FIXTURES_DIR, "obstacle-responses-valid.yaml"), "utf8");
  const rawObs = strictParse(obsYaml, "yaml");
  const obs = validateObstacleResponses(rawObs);
  assert.equal((obs.unfamiliarWordOrSymbol?.explanation.length ?? 0) > 0, true);

  logger.log({
    testId: "integration-all-fixtures-valid",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "18-fixtures-passed",
    actual: "18-fixtures-passed",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "yaml-fixture-suite-valid" },
  });
});

test("Integration: Planted Negative - Stale / invalid premise claims rejected from parsed YAML", () => {
  const start = Date.now();
  const hpAvailYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "historical-premise-available-valid.yaml"),
    "utf8",
  );
  const raw = strictParse(hpAvailYaml, "yaml") as any;

  // Drop einsteinKnowledgeEvidence while claimsEinsteinKnew is true
  raw.einsteinKnowledgeEvidence = undefined;

  assert.throws(
    () => validateHistoricalPremise(raw),
    (err: any) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "missing-einstein-knowledge-evidence");
      return true;
    },
  );

  logger.log({
    testId: "integration-planted-negative-einstein-evidence",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "missing-einstein-knowledge-evidence",
    actual: "missing-einstein-knowledge-evidence",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "einstein-evidence-integrity" },
  });
});

test("Integration: Planted Negative - Singular temptingClaim in Misconception rejected from YAML", () => {
  const start = Date.now();
  const miscYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "misconception-two-claims-valid.yaml"),
    "utf8",
  );
  const raw = strictParse(miscYaml, "yaml") as any;

  // Replace plural with singular
  raw.temptingClaim = raw.temptingClaims[0];
  delete raw.temptingClaims;

  assert.throws(
    () => validateMisconception(raw),
    (err: any) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "singular-tempting-claim-rejected");
      return true;
    },
  );

  logger.log({
    testId: "integration-planted-negative-singular-tempting-claim",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "singular-tempting-claim-rejected",
    actual: "singular-tempting-claim-rejected",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "tempting-claims-plural-enforced" },
  });
});

test("Integration: Planted Negative - Zero term scale in Equation rejected from YAML", () => {
  const start = Date.now();
  const eqYaml = fs.readFileSync(path.join(FIXTURES_DIR, "equation-valid.yaml"), "utf8");
  const raw = strictParse(eqYaml, "yaml") as any;

  // Set scale to 0/1
  raw.terms[0].scale = { num: 0, den: 1 };

  assert.throws(
    () => validateSemanticEquation(raw),
    (err: any) => {
      assert.ok(err instanceof DimensionSchemaError);
      assert.equal(err.code, "zero-scale-forbidden");
      return true;
    },
  );

  logger.log({
    testId: "integration-planted-negative-zero-term-scale",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "zero-scale-forbidden",
    actual: "zero-scale-forbidden",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "term-scale-nonzero" },
  });
});
