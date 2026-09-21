/**
 * The thirteen refusal sites in argument.ts that survived deletion (am-kd9h).
 *
 * METHOD. Each of the file's 192 `throw new ArgumentSchemaError(...)` statements was rewritten to
 * `void new ...` one at a time and the nine test files that import this module were run against the
 * result. A hundred and seventy-nine turned red. These thirteen did not. The survey that sent me
 * here said five.
 *
 * Every delta below starts from a committed fixture in __fixtures__/argument, so a refusal is always
 * about the one field that changed and never about a hand-built object that was wrong in some other
 * way too.
 *
 * TWO OF THE THIRTEEN CARRY A DEAD CODE, which is worth more than the tests around them. Both
 * quantity and equation ids are checked as
 *
 *     throw new ArgumentSchemaError(idResult.rule || "invalid-quantity-id", ...)
 *
 * and the literal on the right can never be used: parseQuantityId and parseEquationRecordId each
 * have exactly one failure return and it always sets `rule`, to "quantity-id-grammar" and
 * "equation-record-id-grammar" respectively. So the site fires, but never with the code a reader of
 * this file would expect, and never with the code a scanner reading the first argument would record.
 * That is am-utmv seen from the inside. The tests assert the code that really comes out and pin the
 * parsers' single-failure-return shape, so if a second failure path is ever added without a rule,
 * the dead literal comes alive and this file says so.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseEquationRecordId, parseQuantityId } from "../ids.ts";
import {
  ArgumentSchemaError,
  validateArgumentNode,
  validateFoundationOrBridge,
  validateHistoricalPremise,
  validateMisconception,
  validateQuantity,
  validateReadingSet,
  validateSemanticEquation,
} from "./argument.ts";
import { strictParse } from "./strictParse.ts";

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/argument",
);

/** Fixture records are deliberately loose: their shape is what the validator under test decides. */
function fixture(name: string): Record<string, unknown> {
  return strictParse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"), "yaml") as Record<
    string,
    unknown
  >;
}

function refuses(
  run: () => unknown,
  expected: { code: string; path: string; message?: string },
): ArgumentSchemaError {
  let caught: unknown;
  try {
    run();
  } catch (err) {
    caught = err;
  }
  if (!(caught instanceof ArgumentSchemaError)) {
    assert.fail(`Expected ArgumentSchemaError, got ${String(caught)}`);
  }
  assert.equal(caught.code, expected.code);
  assert.ok(
    String(caught.path).endsWith(expected.path),
    `path ${caught.path} should end with ${expected.path}`,
  );
  if (expected.message) {
    assert.ok(
      caught.message.includes(expected.message),
      `message ${JSON.stringify(caught.message)} should contain ${JSON.stringify(expected.message)}`,
    );
  }
  return caught;
}

test("THE CONTROL: every fixture used below validates unchanged", () => {
  assert.ok(validateArgumentNode(fixture("argument-node-valid.yaml")));
  assert.ok(validateHistoricalPremise(fixture("historical-premise-available-valid.yaml")));
  assert.ok(validateHistoricalPremise(fixture("historical-premise-verified-valid.yaml")));
  assert.ok(validateQuantity(fixture("quantity-angle-valid.yaml")));
  assert.ok(validateSemanticEquation(fixture("equation-valid.yaml")));
  assert.ok(validateFoundationOrBridge(fixture("bridge-entrance-valid.yaml")));
  assert.ok(validateMisconception(fixture("misconception-two-claims-valid.yaml")));
  assert.ok(validateReadingSet(fixture("reading-set-valid.yaml")));
});

test("(argument.ts:150) missing-meaning-field names WHICH of the four meanings is absent", () => {
  const raw = fixture("argument-node-valid.yaml");
  delete (raw.meanings as Record<string, unknown>).logicalRole;
  refuses(() => validateArgumentNode(raw), {
    code: "missing-meaning-field",
    path: ".logicalRole",
    message: "meanings.logicalRole is required.",
  });

  // Four sites share this code, one per kind of meaning, and the doctrine is that the four are
  // never compressed into one. A test asserting only the code would credit all four for one; the
  // path is what separates them, so the sibling is driven here to show the path really moves.
  const other = fixture("argument-node-valid.yaml");
  delete (other.meanings as Record<string, unknown>).modelStatus;
  refuses(() => validateArgumentNode(other), {
    code: "missing-meaning-field",
    path: ".modelStatus",
  });
});

test("(argument.ts:345) invalid-premise-status rejects 'later-confirmation' in favour of 'later'", () => {
  const raw = fixture("historical-premise-available-valid.yaml");
  raw.status = "later-confirmation";
  refuses(() => validateHistoricalPremise(raw), {
    code: "invalid-premise-status",
    path: ".status",
    message: "'later-confirmation' is rejected in favor of 'later'",
  });

  // The value it steers you to is accepted, which is what makes this a spelling rule rather than a
  // ban on the idea. A later result is still representable.
  const repaired = fixture("historical-premise-later-valid.yaml");
  assert.equal(validateHistoricalPremise(repaired).status, "later");
});

test("(argument.ts:500) claiming Einstein knew something requires the evidence for it", () => {
  const raw = fixture("historical-premise-available-valid.yaml");
  raw.claimsEinsteinKnew = true;
  delete raw.einsteinKnowledgeEvidence;
  refuses(() => validateHistoricalPremise(raw), {
    code: "missing-einstein-knowledge-evidence",
    path: ".einsteinKnowledgeEvidence",
    message: "requires non-empty einsteinKnowledgeEvidence array",
  });

  // An EMPTY array is the same refusal, not a different one: the check is length, not presence, and
  // "I declared the field" is exactly the move this site exists to stop.
  const empty = fixture("historical-premise-available-valid.yaml");
  empty.claimsEinsteinKnew = true;
  empty.einsteinKnowledgeEvidence = [];
  refuses(() => validateHistoricalPremise(empty), {
    code: "missing-einstein-knowledge-evidence",
    path: ".einsteinKnowledgeEvidence",
  });

  // And without the claim, no evidence is required. Availability and Einstein-knowledge are the
  // first two of the four historical statements and this site is the seam between them. The
  // fixture asserts Einstein knew this one, so the claim has to come off as well as the evidence -
  // dropping only the evidence still refuses, which is the site doing its job.
  const noClaim = fixture("historical-premise-available-valid.yaml");
  noClaim.claimsEinsteinKnew = false;
  delete noClaim.einsteinKnowledgeEvidence;
  assert.ok(validateHistoricalPremise(noClaim));
});

test("(argument.ts:597) a verified premise must say where the verification can be checked", () => {
  // NOT built from historical-premise-verified-valid.yaml. That fixture records its verification as
  // flat `verifier` / `dateVerified` / `evidenceLocator` keys, and this block only runs on a nested
  // `verification` object, so the fixture never enters it. Reported on am-kd9h rather than edited
  // here: the fixture is someone else's and it validates, it just does not exercise what its name
  // suggests.
  const verification = {
    verifiedBy: "jemanuel",
    verifierKind: "human",
    date: "2026-09-15",
    method: "comparison edition",
    evidenceLocator: "Doc 14, Collected Papers Vol 2",
  };

  // The control: with a complete verification block the premise still validates, so each delta
  // below is about the one field it removes.
  const complete = fixture("historical-premise-available-valid.yaml");
  complete.verification = { ...verification };
  assert.ok(validateHistoricalPremise(complete));

  const raw = fixture("historical-premise-available-valid.yaml");
  const missing: Record<string, unknown> = { ...verification };
  delete missing.evidenceLocator;
  raw.verification = missing;
  refuses(() => validateHistoricalPremise(raw), {
    code: "verified-premise-missing-locator",
    path: ".verification.evidenceLocator",
    message: "verification requires evidenceLocator.",
  });

  // Whitespace is not a locator. A checkable claim has to point somewhere.
  const blank = fixture("historical-premise-available-valid.yaml");
  blank.verification = { ...verification, evidenceLocator: "   " };
  refuses(() => validateHistoricalPremise(blank), {
    code: "verified-premise-missing-locator",
    path: ".verification.evidenceLocator",
  });

  // The three sites above it are reachable from the same block and report their own codes, which
  // is what shows this test is on the locator site and not merely inside the block.
  refuses(
    () =>
      validateHistoricalPremise({
        ...fixture("historical-premise-available-valid.yaml"),
        verification: { ...verification, method: "a photocopy someone sent me" },
      }),
    { code: "verified-premise-invalid-method", path: ".verification.method" },
  );
});

test("(argument.ts:842) invalid-premise: a premise entry must be an object", () => {
  const raw = fixture("argument-node-valid.yaml");
  raw.premises = ["fick-1855-diffusion-law"];
  refuses(() => validateArgumentNode(raw), {
    code: "invalid-premise",
    path: ".premises[0]",
    message: "Premise entry must be an object.",
  });

  // Index 1 is driven too, so the path is the entry's own rather than a hard-coded zero.
  const second = fixture("argument-node-valid.yaml");
  second.premises = [(second.premises as unknown[])[0], null];
  refuses(() => validateArgumentNode(second), {
    code: "invalid-premise",
    path: ".premises[1]",
  });
});

test("(argument.ts:1204) a malformed quantity id is refused, and NOT with the literal in the source", () => {
  const raw = fixture("quantity-angle-valid.yaml");
  raw.id = "Temperature";
  const err = refuses(() => validateQuantity(raw), {
    code: "quantity-id-grammar",
    path: ".id",
    message: "Invalid quantity ID 'Temperature'",
  });

  // The site reads `idResult.rule || "invalid-quantity-id"`. The literal is DEAD: parseQuantityId
  // has exactly one failure return and it always carries a rule. Asserting the real code here, and
  // the parser's shape below, is what keeps that fact from being rediscovered.
  assert.notEqual(err.code, "invalid-quantity-id");
  for (const bad of ["Temperature", "temp erature", "9bad", "TEMP_K"]) {
    const parsed = parseQuantityId(bad);
    assert.equal(parsed.ok, false, `${bad} should not parse`);
    assert.equal(
      parsed.ok ? undefined : parsed.rule,
      "quantity-id-grammar",
      `every failure of parseQuantityId carries a rule, so the || fallback stays unreachable`,
    );
  }

  // A canonical id is accepted: this is a grammar, not a denylist of the four strings above.
  assert.ok(validateQuantity(fixture("quantity-angle-valid.yaml")));
});

test("(argument.ts:1267) a declared quantity must declare a dimension", () => {
  const raw = fixture("quantity-angle-valid.yaml");
  delete raw.dimension;
  refuses(() => validateQuantity(raw), {
    code: "missing-dimension",
    path: ".dimension",
    message: "dimension is required for declared quantities.",
  });

  // "declared" is the discrimination: the constant branch above this site takes its dimension from
  // the constant set, so a constant without a local dimension is legal and must not land here.
  const angle = fixture("quantity-angle-valid.yaml");
  assert.ok(validateQuantity(angle));
});

test("(argument.ts:1569) a malformed equation id is refused with the grammar rule, not the literal", () => {
  const raw = fixture("equation-valid.yaml");
  raw.id = "Eq One";
  const err = refuses(() => validateSemanticEquation(raw), {
    code: "equation-record-id-grammar",
    path: ".id",
    message: "Invalid global equation record ID 'Eq One'",
  });
  assert.notEqual(err.code, "invalid-equation-id");
  for (const bad of ["Eq One", "eq_1", "EQ-1", "1"]) {
    const parsed = parseEquationRecordId(bad);
    assert.equal(parsed.ok, false, `${bad} should not parse`);
    assert.equal(parsed.ok ? undefined : parsed.rule, "equation-record-id-grammar");
  }
});

/** The fixture's continueWith entries, as a mutable array the tests can index safely. */
function routesOf(record: Record<string, unknown>): Record<string, unknown>[] {
  const routes = record.continueWith;
  assert.ok(Array.isArray(routes), "fixture should carry a continueWith array");
  assert.equal(routes.length, 2, "the entrance bridge fixture offers exactly two routes");
  return routes as Record<string, unknown>[];
}

test("(argument.ts:2208) invalid-continue-with-route names the route it rejected", () => {
  const raw = fixture("bridge-entrance-valid.yaml");
  const routes = routesOf(raw);
  raw.continueWith = [{ ...routes[0], route: "sideways" }, routes[1]];
  refuses(() => validateFoundationOrBridge(raw), {
    code: "invalid-continue-with-route",
    path: ".continueWith[0].route",
    message: 'Invalid continueWith route "sideways"',
  });

  // The second entry reaches the same site at its own index, so the path is not hard-coded.
  const second = fixture("bridge-entrance-valid.yaml");
  const secondRoutes = routesOf(second);
  second.continueWith = [secondRoutes[0], { ...secondRoutes[1], route: "less guidance" }];
  refuses(() => validateFoundationOrBridge(second), {
    code: "invalid-continue-with-route",
    path: ".continueWith[1].route",
  });
});

test("(argument.ts:2228) a bridge offers exactly two continuations, more and less guidance", () => {
  const one = fixture("bridge-entrance-valid.yaml");
  one.continueWith = routesOf(one).slice(0, 1);
  refuses(() => validateFoundationOrBridge(one), {
    code: "invalid-continue-with-routes",
    path: ".continueWith",
    message: "exactly 2 routes (got 1)",
  });

  // Three is refused as well, and the count is reported, so this is a cardinality rule in both
  // directions rather than a minimum dressed up as one.
  const three = fixture("bridge-entrance-valid.yaml");
  three.continueWith = [
    ...routesOf(three),
    { route: "more-guidance", targetId: "found-thermal-equilibrium" },
  ];
  refuses(() => validateFoundationOrBridge(three), {
    code: "invalid-continue-with-routes",
    path: ".continueWith",
    message: "exactly 2 routes (got 3)",
  });
});

test("(argument.ts:2397) invalid-tempting-claim: a claim must be a non-empty string", () => {
  const raw = fixture("misconception-two-claims-valid.yaml");
  (raw.temptingClaims as unknown[])[1] = "   ";
  refuses(() => validateMisconception(raw), {
    code: "invalid-tempting-claim",
    path: ".temptingClaims[1]",
    message: "temptingClaim must be a non-empty string.",
  });

  // A non-string reaches the same site. The refusal one line up is about the ARRAY's length, so a
  // two-entry array keeps this test on the entry check and off its neighbour.
  const nonString = fixture("misconception-two-claims-valid.yaml");
  (nonString.temptingClaims as unknown[])[0] = 42;
  refuses(() => validateMisconception(nonString), {
    code: "invalid-tempting-claim",
    path: ".temptingClaims[0]",
  });
});

test("(argument.ts:2460) a misconception's intervention must record which defaults were reviewed", () => {
  const raw = fixture("misconception-two-claims-valid.yaml");
  delete (raw.intervention as Record<string, unknown>).defaultsReviewed;
  refuses(() => validateMisconception(raw), {
    code: "missing-defaults-reviewed",
    path: ".intervention.defaultsReviewed",
    message: "intervention.defaultsReviewed object is required.",
  });

  // A scalar in its place is the same refusal: the field has to carry the review, not merely exist.
  const scalar = fixture("misconception-two-claims-valid.yaml");
  (scalar.intervention as Record<string, unknown>).defaultsReviewed = "reviewed";
  refuses(() => validateMisconception(scalar), {
    code: "missing-defaults-reviewed",
    path: ".intervention.defaultsReviewed",
  });
});

test("(argument.ts:2602) targetKind 'caption' is refused by name, pointing at 'instrument-caption'", () => {
  const raw = fixture("reading-set-valid.yaml");
  raw.targetKind = "caption";
  const err = refuses(() => validateReadingSet(raw), {
    code: "invalid-reading-target-kind",
    path: ".targetKind",
    message: 'targetKind "caption" is invalid; use "instrument-caption"',
  });

  // This site exists to catch one specific near-miss and to say what to write instead, so the
  // replacement it names must itself be accepted. Otherwise the message sends the author nowhere.
  assert.ok(err.message.includes("instrument-caption"));
  const repaired = fixture("reading-set-valid.yaml");
  repaired.targetKind = "instrument-caption";
  repaired.targetId = "bm-01";
  assert.equal(validateReadingSet(repaired).targetKind, "instrument-caption");
});
