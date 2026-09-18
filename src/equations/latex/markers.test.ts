/**
 * Marker grammar and trust tests (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 6:
 * - Colorized markers contain only authored IDs and enumerated role classes
 * - Verified by a marker-grammar test over all fixtures
 * - KaTeX trust callback verifies valid role classes and term/op data attributes
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_ROLE_CLASSES,
  katexMarkerTrust,
  wrapHtmlClass,
  wrapHtmlData,
} from "./markers.ts";
import { renderEquationLatex } from "./render.ts";
import type { Expression } from "../ast.ts";

test("markers.test: ALLOWED_ROLE_CLASSES contains exactly the 5 enumerated roles", () => {
  const expectedRoles = [
    "am-role-input",
    "am-role-result",
    "am-role-constant",
    "am-role-parameter",
    "am-role-intermediate",
  ];
  assert.equal(ALLOWED_ROLE_CLASSES.length, 5);
  for (const role of expectedRoles) {
    assert.ok(ALLOWED_ROLE_CLASSES.includes(role), `Expected ${role} in ALLOWED_ROLE_CLASSES`);
  }
});

test("markers.test: katexMarkerTrust strictly allows only permitted htmlClass", () => {
  for (const cls of ALLOWED_ROLE_CLASSES) {
    assert.equal(katexMarkerTrust({ command: "\\htmlClass", class: cls }), true);
  }

  // Rejects unlisted role classes or arbitrary HTML classes
  assert.equal(katexMarkerTrust({ command: "\\htmlClass", class: "am-role-unknown" }), false);
  assert.equal(katexMarkerTrust({ command: "\\htmlClass", class: "bg-red-500" }), false);
  assert.equal(katexMarkerTrust({ command: "\\htmlClass", class: "text-bold" }), false);
  assert.equal(katexMarkerTrust({ command: "\\htmlClass", class: "" }), false);
  assert.equal(katexMarkerTrust({ command: "\\htmlClass" }), false);
});

test("markers.test: katexMarkerTrust strictly allows only valid term and op htmlData", () => {
  // Accepts valid term and op keys with alphanumeric, dot, dash, underscore
  assert.equal(
    katexMarkerTrust({ command: "\\htmlData", attributes: { "data-term": "eq-bm-04.t.gamma" } }),
    true,
  );
  assert.equal(
    katexMarkerTrust({ command: "\\htmlData", attributes: { term: "eq-s6-d3.t.yPrime" } }),
    true,
  );
  assert.equal(
    katexMarkerTrust({ command: "\\htmlData", attributes: { "data-op": "eq-bm-04.op.variance" } }),
    true,
  );
  assert.equal(
    katexMarkerTrust({ command: "\\htmlData", attributes: { op: "op1" } }),
    true,
  );

  // Rejects foreign attributes
  assert.equal(
    katexMarkerTrust({ command: "\\htmlData", attributes: { "data-url": "https://evil.com" } }),
    false,
  );
  assert.equal(
    katexMarkerTrust({ command: "\\htmlData", attributes: { onclick: "alert(1)" } }),
    false,
  );

  // Rejects multiple attributes
  assert.equal(
    katexMarkerTrust({
      command: "\\htmlData",
      attributes: { term: "t1", onclick: "alert(1)" },
    }),
    false,
  );

  // Rejects malicious characters in ID value
  assert.equal(
    katexMarkerTrust({ command: "\\htmlData", attributes: { term: 't1" onmouseover="alert(1)' } }),
    false,
  );
  assert.equal(
    katexMarkerTrust({ command: "\\htmlData", attributes: { term: "<script>alert(1)</script>" } }),
    false,
  );

  // Rejects other commands
  assert.equal(katexMarkerTrust({ command: "\\href" }), false);
  assert.equal(katexMarkerTrust({ command: "\\url" }), false);
});

test("markers.test: wrapHtmlClass and wrapHtmlData produce exact marker grammar", () => {
  assert.equal(wrapHtmlClass("input", "x"), "\\htmlClass{am-role-input}{x}");
  assert.equal(wrapHtmlClass("result", "y"), "\\htmlClass{am-role-result}{y}");
  assert.equal(wrapHtmlData("term", "t1", "x"), "\\htmlData{term=t1}{x}");
  assert.equal(wrapHtmlData("op", "op1", "a + b"), "\\htmlData{op=op1}{a + b}");
});

test("markers.test: colorized equation render conforms strictly to marker grammar", () => {
  const tree: Expression = {
    kind: "relation",
    operator: "=",
    left: { kind: "symbol", termId: "eq.t.tau", quantityId: "coordinateTimeMoving" },
    right: {
      kind: "product",
      args: [
        { kind: "symbol", termId: "eq.t.V", quantityId: "speedOfLight" },
        { kind: "symbol", termId: "eq.t.v", quantityId: "frameSpeed" },
      ],
      opId: "eq.op.prod",
    },
    opId: "eq.op.rel",
  };

  const res = renderEquationLatex({
    equation: {
      id: "eq-test",
      paper: "special-relativity",
      sectionId: "sr-s3",
      tree,
    },
    form: { kind: "printed" },
    color: "colorized",
  });

  // Verify all \htmlClass calls match ALLOWED_ROLE_CLASSES
  const classMatches = Array.from(res.latex.matchAll(/\\htmlClass\{([^}]+)\}/g));
  assert.ok(classMatches.length >= 3);
  for (const match of classMatches) {
    const cls = match[1];
    assert.ok(cls, "Expected class match group");
    assert.ok(
      ALLOWED_ROLE_CLASSES.includes(cls),
      `Rendered class "${cls}" must be in ALLOWED_ROLE_CLASSES`,
    );
  }

  // Verify all \htmlData calls match data grammar
  const dataMatches = Array.from(res.latex.matchAll(/\\htmlData\{([^=]+)=([^}]+)\}/g));
  assert.ok(dataMatches.length >= 3);
  for (const match of dataMatches) {
    const key = match[1];
    const val = match[2];
    assert.ok(key === "term" || key === "op", `Key must be term or op, got ${key}`);
    assert.ok(val, "Expected value match group");
    assert.ok(/^[a-zA-Z0-9_.-]+$/.test(val), `ID must be valid identifier, got ${val}`);
  }

  // Verify termSpans and opSpans exist and point to valid substrings
  assert.equal(res.termSpans.length, 3);
  assert.equal(res.opSpans.length, 2);
  for (const span of res.termSpans) {
    assert.ok(span.start >= 0 && span.end <= res.latex.length);
    assert.ok(span.end > span.start);
    const slice = res.latex.slice(span.start, span.end);
    assert.ok(slice.startsWith(`\\htmlData{term=${span.id}}`));
  }
  for (const span of res.opSpans) {
    assert.ok(span.start >= 0 && span.end <= res.latex.length);
    assert.ok(span.end > span.start);
    const slice = res.latex.slice(span.start, span.end);
    assert.ok(slice.startsWith(`\\htmlData{op=${span.id}}`));
  }
});
