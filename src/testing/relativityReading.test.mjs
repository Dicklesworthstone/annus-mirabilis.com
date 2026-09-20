import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileContent, compileReadingContent } from "../content/compiler/compile.ts";
import { validateReadingRecord } from "../content/schemas/reading.ts";
import { REGISTERED_IDS } from "../experiments/catalogue.ts";
import {
  kineticEnergy,
  longitudinalMass,
  transverseMassComoving,
  transverseMassLaboratory,
} from "../physics/reference/electron.ts";
import { checkClockSynchronization, equatorPoleComparison } from "../physics/reference/events.ts";
import {
  fieldInvariants,
  transformChargeCurrent,
  transformSI,
} from "../physics/reference/fields.ts";
import {
  alignedBoost,
  composeCollinear,
  contractedLength,
  dilatedInterval,
  dilationLossPerSecond,
  inverseBoost,
  transformEvent,
  transformVelocity,
} from "../physics/reference/kinematics.ts";
import {
  aberration,
  dopplerFactor,
  lightComplexFactors,
  movingMirror,
} from "../physics/reference/waves.ts";

const files = await loadReadingFiles();
const path = "arguments/special-relativity/arg-sr-field-components.json";
const record = JSON.parse(files.find((f) => f.path === path).text);
const approx = (actual, expected) =>
  assert.ok(
    Number.isFinite(actual) &&
      Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)),
    `${actual} != ${expected}`,
  );
function value(result) {
  assert.equal(result.status, "value");
  return result.value;
}
const mutate = (change) =>
  files.map((f) =>
    f.path === path ? { ...f, text: JSON.stringify(change(structuredClone(record))) } : f,
  );

for (const [name, compile] of [
  ["synchronous", compileReadingContent],
  ["production", compileContent],
]) {
  test(`${name}: both halves compile across all ten sections with all thirteen laboratories`, async () => {
    const result = await compile(files);
    assert.equal(
      result.ok,
      true,
      JSON.stringify(result.diagnostics.filter((d) => d.severity === "error")),
    );
    const payload = result.papers.find((p) => p.paper.id === "special-relativity");
    assert.ok(payload);
    assert.equal(payload.paper.status, "explanation-preview");
    assert.equal(payload.paper.sourceStatus, "in-preparation");
    assert.deepEqual(
      payload.paper.sections.map((s) => s.id),
      Array.from({ length: 11 }, (_, i) => `s${i}`),
    );
    assert.equal(payload.arguments.length, 16);
    assert.deepEqual(
      payload.paper.sections.flatMap((s) => s.arguments),
      payload.arguments.map((a) => a.id),
    );
    assert.ok(payload.citations.some((c) => c.id === "ap-17-891"));
    assert.deepEqual(
      [...new Set(payload.arguments.flatMap((a) => a.experiments))].sort(),
      Array.from({ length: 13 }, (_, i) => `sr-${String(i + 1).padStart(2, "0")}`),
    );
    for (const argument of payload.arguments) {
      assert.equal(argument.review, "draft");
      for (const reading of ["overview", "full", "steps", "margin"])
        assert.ok(argument.readings[reading].length);
      assert.ok(argument.premises.length && argument.limitations.length);
      assert.ok(argument.experiments.every((id) => REGISTERED_IDS.includes(id)));
      for (const dependency of argument.prerequisites)
        assert.ok(payload.arguments.some((a) => a.id === dependency.id));
    }
    for (let section = 6; section <= 10; section++) {
      assert.ok(
        payload.arguments.some(
          (a) => a.section === `s${section}` && a.readings.full.some((b) => b.kind === "formula"),
        ),
      );
    }
  });
  for (const [label, change] of [
    ["invented instrument", (a) => ({ ...a, experiments: ["sr-99"] })],
    [
      "missing premise",
      (a) => ({ ...a, prerequisites: [{ id: "arg-sr-missing", edge: "premise" }] }),
    ],
    [
      "self-justifying field law",
      (a) => ({ ...a, prerequisites: [{ id: a.id, edge: "premise" }] }),
    ],
    ["missing scaffold", (a) => ({ ...a, help: { ...a.help, why: "not-a-foundation" } })],
  ])
    test(`${name}: ${label} prevents publication`, async () => {
      const result = await compile(mutate(change));
      assert.equal(result.ok, false);
      assert.equal(result.papers.length, 0);
    });
}

test("all new mathematical blocks pass the bounded reader schema independently of compiler routing", () => {
  const argumentsOnly = files.filter((f) => f.path.startsWith("arguments/special-relativity/arg-"));
  assert.equal(argumentsOnly.length, 16);
  for (const f of argumentsOnly)
    assert.doesNotThrow(() => validateReadingRecord(JSON.parse(f.text), f.path));
});

test("clock synchronization assigns the midpoint rather than reception time", () => {
  const correct = value(checkClockSynchronization(0, 5, 10));
  assert.equal(correct.expectedTB, 5);
  assert.equal(correct.synchronized, true);
  assert.equal(value(checkClockSynchronization(0, 10, 10)).synchronized, false);
});

test("the normalized worked event and inverse agree with the actual Lorentz owner", () => {
  const boost = value(alignedBoost(0.6, 1));
  const initial = { t: 2, x: 1, y: 0, z: 0 };
  const transformed = value(transformEvent(initial, boost));
  approx(transformed.t, 1.75);
  approx(transformed.x, -0.25);
  const recovered = value(transformEvent(transformed, value(inverseBoost(boost))));
  for (const key of ["t", "x", "y", "z"]) approx(recovered[key], initial[key]);
});

test("a spatial separation with simultaneous lab endpoints gains a time difference", () => {
  const boost = value(alignedBoost(0.6, 1));
  const event = value(transformEvent({ t: 0, x: 1, y: 0, z: 0 }, boost));
  approx(event.t, -0.75);
  approx(event.x, 1.25);
  approx(value(contractedLength(1, 0.6)), 0.8);
  assert.notEqual(event.x, value(contractedLength(1, 0.6)));
});

test("the clock example keeps exact loss separate from the second-order form and Earth refusal", () => {
  approx(value(dilatedInterval(8, 0.6)), 10);
  const loss = value(dilationLossPerSecond(0.6));
  approx(loss.exact, 0.2);
  approx(loss.printedSecondOrder, 0.18);
  assert.equal(equatorPoleComparison().status, "outside-domain");
});

test("two forward speeds compose to 15/17 while axial and transverse light retain unit speed", () => {
  approx(value(composeCollinear(0.6, 0.6)), 15 / 17);
  const axial = value(transformVelocity({ ux: 1, uy: 0, uz: 0 }, 0.6, 1));
  approx(axial.ux, 1);
  const transverse = value(transformVelocity({ ux: 0, uy: 1, uz: 0 }, 0.6, 1));
  approx(transverse.ux, -0.6);
  approx(transverse.uy, 0.8);
  approx(Math.hypot(transverse.ux, transverse.uy), 1);
  assert.equal(alignedBoost(1, 1).status, "outside-domain");
});

test("field signs, inverse, and invariant checks agree without equating raw components", () => {
  const input = { E: { x: 0, y: 0, z: 0 }, B: { x: 0, y: 0, z: 1 }, boost: 0.6, c: 1 };
  const transformed = transformSI(input);
  approx(transformed.E.y, -0.75);
  approx(transformed.B.z, 1.25);
  const recovered = transformSI({ ...transformed, boost: -0.6, c: 1 });
  approx(recovered.E.y, 0);
  approx(recovered.B.z, 1);
  const a = fieldInvariants(input.E, input.B, 1);
  const b = fieldInvariants(transformed.E, transformed.B, 1);
  approx(a.e2MinusC2B2, b.e2MinusC2B2);
  approx(a.eDotB, b.eDotB);
});

test("Doppler and packet examples distinguish transverse frames and material contraction", () => {
  approx(dopplerFactor(0.6, 0), 0.5);
  approx(dopplerFactor(0.6, Math.PI / 2), 1.25);
  const angle = aberration(0.6, Math.PI / 2);
  approx(angle.cosThetaPrime, -0.6);
  const factors = lightComplexFactors(0.6, 0);
  approx(factors.energyDensityFactor, 0.25);
  approx(factors.volumeFactor, 2);
  approx(factors.energyFactor, 0.5);
  approx(factors.energyDensityFactor * value(contractedLength(1, 0.6)), 0.2);
  assert.notEqual(factors.energyFactor, 0.2);
});

test("mirror examples separate frequency, intercepted power, pressure and no interception", () => {
  const mirror = movingMirror(0.6, 0, { u: 1, c: 1, Am: 1 });
  assert.equal(mirror.status, "value");
  approx(mirror.frequencyRatio, 0.25);
  approx(mirror.incidentPower, 0.4);
  approx(mirror.radiationPressure, 0.5);
  approx(mirror.energyBalanceResidual, 0);
  assert.equal(movingMirror(0.6, Math.PI / 2).status, "not-applicable");
});

test("neutral current transforms without dividing by zero density", () => {
  const transformed = transformChargeCurrent({ rho: 0, J: { x: 1, y: 0, z: 0 }, boost: 0.6, c: 1 });
  approx(transformed.rho, -0.75);
  approx(transformed.J.x, 1.25);
  const restored = transformChargeCurrent({
    rho: transformed.rho,
    J: transformed.J,
    boost: -0.6,
    c: 1,
  });
  approx(restored.rho, 0);
  approx(restored.J.x, 1);
});

test("the historical and modern electron ratios stay distinct at 0.6c", () => {
  approx(value(longitudinalMass(1, 0.6)), 1.953125);
  approx(value(transverseMassComoving(1, 0.6)), 1.5625);
  approx(value(transverseMassLaboratory(1, 0.6)), 1.25);
  const energies = kineticEnergy(1, 0.6);
  approx(value(energies.exact) / value(energies.newtonian), 0.25 / 0.18);
  assert.equal(kineticEnergy(1, 1).exact.status, "outside-domain");
});

test("every existing relativity lab's section link lands in the new reader", async () => {
  const result = compileReadingContent(files);
  assert.equal(result.ok, true);
  const sections = new Set(
    result.papers.find((p) => p.paper.id === "special-relativity").paper.sections.map((s) => s.id),
  );
  for (let i = 1; i <= 13; i++) {
    const source = await readFile(
      new URL(`../app/lab/sr-${String(i).padStart(2, "0")}/page.tsx`, import.meta.url),
      "utf8",
    );
    for (const match of source.matchAll(/\/papers\/special-relativity\/(?:#(s\d+)|(s\d+)\/)/g))
      assert.ok(sections.has(match[1] ?? match[2]), match[0]);
  }
});
