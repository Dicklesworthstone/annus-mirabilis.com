import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { walk } from "../equations/ast.ts";
import { checkLinearCertificate } from "../equations/derivations/linearCertificate.ts";
import {
  assessLinearCertificate,
  decodeProofSetup,
  proofSetupHref,
} from "../equations/derivations/linearProofState.ts";
import {
  buildMassEnergyElimination,
  MASS_ENERGY_ELIMINATION,
} from "../equations/derivations/massEnergyElimination.ts";

const dir = new URL("../../content/equations/mass-energy/", import.meta.url);
const equations = await Promise.all(
  (await readdir(dir))
    .filter((f) => f.endsWith(".json"))
    .map(async (f) => JSON.parse(await readFile(new URL(f, dir), "utf8"))),
);
const proof = buildMassEnergyElimination(equations);
const all = proof.certificate.premises.map((p) => p.id);

test("the five-step bridge checks the real canonical equations, not hand-copied formulas", () => {
  // The catalogue is every record in the directory (15, then 23 on 2026-09-22), so its size is not
  // the property. "Real, not hand-copied" is: every step below names a record that exists.
  assert.ok(equations.length > 0);
  assert.deepEqual(
    proof.certificate.steps.map((s) => s.id),
    ["subtract", "regroup", "substitute-offset", "cancel-offset", "name-difference"],
  );
  assert.equal(proof.steps.filter((s) => s.move).length, 1);
  assert.equal(proof.steps.find((s) => s.move).id, "substitute-offset");
  for (const step of proof.certificate.steps)
    assert.ok(equations.some((e) => e.id === step.equation));
  const offset = equations.find((e) => e.id === "eq-model-me-offset-substitution");
  const copies = walk(offset.tree).filter(
    (n) => n.kind === "symbol" && n.quantityId === "additiveEnergyConstant",
  );
  assert.equal(copies.length, 2);
  assert.notEqual(copies[0].termId, copies[1].termId);
});
for (let mask = 0; mask < 16; mask++) {
  test(`premise subset ${mask}: share/restore and support are the same dependency projection`, () => {
    const selected = all.filter((_, i) => mask & (1 << i));
    const state = assessLinearCertificate(proof.certificate, selected);
    const twoAccounts = selected.includes("rest") && selected.includes("moving");
    assert.deepEqual(
      state.map((s) => s.status),
      [
        twoAccounts,
        twoAccounts,
        twoAccounts && selected.includes("offset"),
        twoAccounts && selected.includes("offset"),
        twoAccounts && selected.includes("offset") && selected.includes("notation"),
      ].map((b) => (b ? "supported" : "blocked")),
    );
    const href = proofSetupHref(proof.certificate, selected);
    const url = new URL(href, "https://annus-mirabilis.com");
    assert.equal(url.pathname, "/papers/mass-energy/");
    assert.equal(url.hash, "#me-ledger-derivation");
    assert.deepEqual(decodeProofSetup(proof.certificate, url.search), { kind: "setup", selected });
    assert.equal(href, proofSetupHref(proof.certificate, [...selected].reverse()));
  });
}
for (const query of [
  "?mep=2",
  "?mep=1&mep=1",
  "?mep-off=offset",
  "?mep=1&mep-off=offset,offset",
  "?mep=1&mep-off=constructor",
  "?mep=1&mep-off=",
  "?mep=1&mep-off=offset&mep-off=moving",
  "?mep=1&mep-off=<script>",
  "?mep=" + "1".repeat(9000),
]) {
  test(`malformed shared setup does not invent proof or silently change premises: ${query.slice(0, 80)}`, () => {
    assert.equal(decodeProofSetup(proof.certificate, query).kind, "invalid");
  });
}
test("unrelated reader settings do not become derivation data", () => {
  assert.deepEqual(decodeProofSetup(proof.certificate, "?detail=2&note=private"), {
    kind: "absent",
  });
  const restored = decodeProofSetup(
    proof.certificate,
    "?detail=2&note=private&mep=1&mep-off=offset",
  );
  assert.equal(restored.kind, "setup");
  assert.ok(!proofSetupHref(proof.certificate, restored.selected).includes("private"));
});
test("changing an after-offset quantity leaves a remainder and invalidates the certificate", () => {
  const changed = structuredClone(equations);
  const after = changed.find((e) => e.id === "eq-model-me-offset-after");
  for (const node of walk(after.tree))
    if (node.kind === "symbol" && node.quantityId === "additiveEnergyConstant")
      node.quantityId = "bodyEnergyRestBefore";
  assert.throws(() => buildMassEnergyElimination(changed), /does not establish/);
});
test("the authored changed-offset arithmetic is a counterexample to automatic cancellation", () => {
  const before = { frameDifference: 6, offset: 2 },
    after = { frameDifference: 5.5, offset: 3 };
  const accountDrop = before.frameDifference - after.frameDifference;
  const kineticDrop =
    before.frameDifference - before.offset - (after.frameDifference - after.offset);
  assert.equal(accountDrop, 0.5);
  assert.equal(kineticDrop, 1.5);
  assert.equal(kineticDrop + before.offset - after.offset, accountDrop);
  assert.notEqual(kineticDrop, accountDrop);
});
test("a changed equation cannot borrow an old proof step's successful status", () => {
  const plan = structuredClone(MASS_ENERGY_ELIMINATION);
  plan.steps[2].combination[1].coefficient.num = 1;
  assert.throws(() => checkLinearCertificate(plan, equations), /does not establish/);
});
test("browser state module has no runtime imports of the parser, kernel or renderer", async () => {
  const source = await readFile(
    new URL("../equations/derivations/linearProofState.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    source
      .split("\n")
      .filter((line) => line.startsWith("import ") && !line.startsWith("import type ")).length,
    0,
  );
});
