import assert from "node:assert/strict";
import test from "node:test";
import { AVOGADRO_DEFAULTS, AVOGADRO_FIELDS, validateAvogadroParameters, parseAvogadroDraft, encodeAvogadroParameters, decodeAvogadroParameters } from "./definition.ts";
import { AVOGADRO_BASES, avogadroBasis } from "./basis.ts";

for (const constantBasis of [0, 1]) {
  test(`basis ${constantBasis} round-trips every parameter and has a registered identity`, () => {
    const p = { ...AVOGADRO_DEFAULTS, constantBasis };
    const encoded = encodeAvogadroParameters(p);
    assert.equal(new URLSearchParams(encoded).get("av"), "2");
    const got = decodeAvogadroParameters(encoded);
    assert.equal(got.kind, "accepted");
    assert.deepEqual(got.parameters, p);
    assert.ok(Object.isFrozen(got.parameters));
    assert.equal(avogadroBasis(got.parameters).setId, AVOGADRO_BASES[constantBasis].setId);
  });
}
test("version 1 links retain modern SI semantics, never migrate into historical inference", () => {
  const query = new URLSearchParams(encodeAvogadroParameters({ ...AVOGADRO_DEFAULTS, temperature: 290 }));
  query.set("av", "1"); query.delete("constantBasis");
  const got = decodeAvogadroParameters(query.toString());
  assert.equal(got.kind, "accepted");
  assert.equal(got.parameters.constantBasis, 0);
  assert.equal(got.parameters.temperature, 290);
  assert.equal(avogadroBasis(got.parameters).setId, "modern-si-2019");
});
test("ambiguous versions, duplicates and basis-smuggling into legacy links are refused", () => {
  const valid = encodeAvogadroParameters(AVOGADRO_DEFAULTS);
  for (const query of [
    valid + "&constantBasis=1", valid + "&av=2",
    valid.replace("av=2", "av=1"), valid.replace("av=2", "av=3"),
    valid.replace("constantBasis=0&", ""), valid.replace("av=2&", ""),
    "?constantBasis=1", "x".repeat(4097),
  ]) assert.equal(decodeAvogadroParameters(query).kind, "refused", query);
});
test("legacy links still require every original field exactly once", () => {
  const query = new URLSearchParams(encodeAvogadroParameters(AVOGADRO_DEFAULTS));
  query.set("av", "1"); query.delete("constantBasis"); query.delete("radiusKnown");
  assert.equal(decodeAvogadroParameters(query.toString()).kind, "refused");
});
test("unversioned non-experiment controls do not create a different experiment", () => {
  assert.deepEqual(decodeAvogadroParameters("?theme=dark").parameters, AVOGADRO_DEFAULTS);
});
test("basis validation refuses fractional, unknown and coerced values", () => {
  for (const constantBasis of [-1, 0.5, 2, NaN, Infinity, "1", true, null]) {
    assert.equal(validateAvogadroParameters({ ...AVOGADRO_DEFAULTS, constantBasis }).kind, "refused");
  }
});
test("parameters-rejected: the identity selector cannot silently fall back to modern SI", () => {
  assert.throws(() => avogadroBasis({ constantBasis: 3 }), error => error.code === "parameters-rejected" && error.experimentId === "avogadro");
  assert.equal(avogadroBasis({ constantBasis: 1 }).setId, "einstein-1905-brownian-printed");
});
test("parameter accessors, hidden fields, symbols and foreign prototypes are refused without execution", () => {
  let calls = 0;
  const accessor = { ...AVOGADRO_DEFAULTS };
  Object.defineProperty(accessor, "constantBasis", { enumerable: true, get() { calls++; return 1; } });
  const hidden = { ...AVOGADRO_DEFAULTS };
  Object.defineProperty(hidden, "secret", { value: 7 });
  for (const input of [accessor, hidden, { ...AVOGADRO_DEFAULTS, [Symbol("extra")]: 1 }, Object.assign(Object.create({ extra: true }), AVOGADRO_DEFAULTS)]) {
    assert.equal(validateAvogadroParameters(input).kind, "refused");
  }
  assert.equal(calls, 0);
  assert.equal(validateAvogadroParameters(Object.assign(Object.create(null), AVOGADRO_DEFAULTS)).kind, "accepted");
});
test("every boundary still round-trips and decimal draft parsing remains strict", () => {
  for (const [key, field] of Object.entries(AVOGADRO_FIELDS)) for (const value of [field.min, field.max]) {
    const p = { ...AVOGADRO_DEFAULTS, [key]: value };
    assert.deepEqual(decodeAvogadroParameters(encodeAvogadroParameters(p)).parameters, p);
  }
  const draft = Object.fromEntries(Object.entries(AVOGADRO_DEFAULTS).map(([key, value]) => [key, String(value)]));
  assert.equal(parseAvogadroDraft({ ...draft, constantBasis: "1" }).kind, "accepted");
  for (const bad of ["", " ", "0x1", "true", "1e999", "1".repeat(65)]) assert.equal(parseAvogadroDraft({ ...draft, constantBasis: bad }).kind, "refused");
});
