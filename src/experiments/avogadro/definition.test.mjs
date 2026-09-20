import assert from "node:assert/strict";
import { test } from "node:test";
import { AVOGADRO_DEFAULTS, AVOGADRO_FIELDS, validateAvogadroParameters, parseAvogadroDraft,
  encodeAvogadroParameters, decodeAvogadroParameters } from "./definition.ts";
const draft = () => Object.fromEntries(Object.entries(AVOGADRO_DEFAULTS).map(([k, v]) => [k, String(v)]));

test("default and boundary parameters round-trip with a frozen accepted copy", () => {
  for (const key of Object.keys(AVOGADRO_FIELDS)) for (const value of [AVOGADRO_FIELDS[key].min, AVOGADRO_FIELDS[key].max]) {
    const p = { ...AVOGADRO_DEFAULTS, [key]: value };
    const decoded = decodeAvogadroParameters(encodeAvogadroParameters(p));
    assert.equal(decoded.kind, "accepted"); assert.deepEqual(decoded.parameters, p);
    assert.notEqual(decoded.parameters, p); assert.ok(Object.isFrozen(decoded.parameters));
  }
});
test("blank, hexadecimal, nonfinite, garbage and overlong drafts refuse rather than coerce", () => {
  for (const text of ["", " ", "0x10", "Infinity", "NaN", "2x", "1e999", "0b10", "1".repeat(65)]) {
    assert.equal(parseAvogadroDraft({ ...draft(), alphaScale: text }).kind, "refused");
  }
  assert.equal(parseAvogadroDraft({ ...draft(), alphaScale: " 1.0e0 " }).kind, "accepted");
});
test("unrecognized, missing, fractional and out-of-bound parameters refuse", () => {
  for (const input of [null, [], {}, { ...AVOGADRO_DEFAULTS, unknown: 1 },
    { ...AVOGADRO_DEFAULTS, coordinateCount: 1.2 }, { ...AVOGADRO_DEFAULTS, coefficient: 1.5 },
    { ...AVOGADRO_DEFAULTS, radiusKnown: 0.5 }, { ...AVOGADRO_DEFAULTS, independentModel: 0.1 },
    { ...AVOGADRO_DEFAULTS, temperature: Infinity }, { ...AVOGADRO_DEFAULTS, temperature: "293" }]) {
    assert.equal(validateAvogadroParameters(input).kind, "refused");
  }
});
test("bookmarks reject duplicate versions, duplicate keys, omissions and oversized payloads", () => {
  const good = encodeAvogadroParameters(AVOGADRO_DEFAULTS);
  for (const bad of [good + "&av=1", good + "&alphaScale=1", good.replace("av=1", "av=2"),
    good.replace(/&radiusKnown=1/, ""), good.replace("av=1&", ""), "x".repeat(4097)]) {
    assert.equal(decodeAvogadroParameters(bad).kind, "refused", bad);
  }
  assert.equal(decodeAvogadroParameters("?theme=dark").kind, "accepted");
  assert.equal(decodeAvogadroParameters(`?${good}&theme=dark`).kind, "accepted");
});
test("encoding validates before creating a misleading bookmark", () => {
  assert.throws(() => encodeAvogadroParameters({ ...AVOGADRO_DEFAULTS, coefficient: 2 }));
});
