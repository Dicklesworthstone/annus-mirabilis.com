import assert from "node:assert/strict";
import test from "node:test";
import {
  FSI,
  getDefaultDirection,
  getDirectionForLanguage,
  isIsolateBalanced,
  isolateLtrMathHtml,
  isolateLtrMathUnicode,
  isolateMathInRtlText,
  isRtlLanguage,
  LRI,
  PDI,
  RLI,
} from "./bidi.ts";

test("bidi: detects RTL and LTR languages correctly", () => {
  assert.equal(isRtlLanguage("ar"), true);
  assert.equal(isRtlLanguage("he"), true);
  assert.equal(isRtlLanguage("fa"), true);
  assert.equal(isRtlLanguage("ur"), true);
  assert.equal(isRtlLanguage("yi"), true);
  assert.equal(isRtlLanguage("ar-EG"), true);

  assert.equal(isRtlLanguage("de"), false);
  assert.equal(isRtlLanguage("en"), false);
  assert.equal(isRtlLanguage("fr"), false);
  assert.equal(isRtlLanguage("de-CH"), false);

  assert.equal(getDefaultDirection("ar"), "rtl");
  assert.equal(getDefaultDirection("he"), "rtl");
  assert.equal(getDefaultDirection("de"), "ltr");
  assert.equal(getDefaultDirection("en"), "ltr");
  assert.equal(getDirectionForLanguage("he"), "rtl");
});

test("bidi: isolates mathematics in Arabic prose with balanced Unicode isolates", () => {
  const arabicSentence =
    "معادلة أينشتاين للحركة البراونية هي $\\lambda_x = \\sqrt{2Dt}$ في الاتجاه السيني.";
  const isolated = isolateMathInRtlText(arabicSentence, "unicode");

  assert.equal(isolated.includes(`${LRI}$\\lambda_x = \\sqrt{2Dt}$${PDI}`), true);
  assert.equal(isIsolateBalanced(isolated), true);
});

test("bidi: isolates mathematics in Hebrew prose with HTML bdi elements", () => {
  const hebrewSentence = "משוואת איינשטיין לתנועה בראונית היא $\\lambda_x = \\sqrt{2Dt}$ בכיוון x.";
  const isolatedHtml = isolateMathInRtlText(hebrewSentence, "html");

  assert.equal(isolatedHtml.includes('<bdi dir="ltr">$\\lambda_x = \\sqrt{2Dt}$</bdi>'), true);
  assert.equal(isolateLtrMathHtml("x = 1"), '<bdi dir="ltr">x = 1</bdi>');
  assert.equal(isolateLtrMathUnicode("x = 1"), `${LRI}x = 1${PDI}`);
});

test("bidi: isolate balance checker handles nested, matching, and unbalanced characters", () => {
  assert.equal(isIsolateBalanced("Plain text without isolates"), true);
  assert.equal(isIsolateBalanced(`${LRI}LTR text${PDI}`), true);
  assert.equal(isIsolateBalanced(`${RLI}RTL ${LRI}nested LTR${PDI} text${PDI}`), true);

  // Unbalanced cases
  assert.equal(isIsolateBalanced(`${LRI}Unclosed isolate`), false);
  assert.equal(isIsolateBalanced(`Extra closing isolate${PDI}`), false);
  assert.equal(isIsolateBalanced(`${FSI}${LRI}Only one closed${PDI}`), false);
});
