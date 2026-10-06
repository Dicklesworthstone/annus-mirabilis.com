/**
 * Refusal sites for contentCheck.ts. Every citation below was repointed on 2026-10-06 under
 * am-r3qt; all four had drifted, by 10, 18, 27 and 28 lines, and each number now names the site
 * its own test drives.
 *
 * REPOINTED ONLY AFTER PLANTING, one site at a time, which is what says a number moved under a
 * test rather than that a test was reattached to whatever is there now:
 *
 *   :12 -> :22   `policy.length !== 1`, planted by renaming its code; reddened exactly the two
 *                cases below that cite it, the missing allowlist and the duplicate allowlists
 *   :15 -> :33   the catch around parseMissingStepAllowlist; reddened exactly the malformed case
 *   :20 -> :47   the duplicate-chain-identity throw, planted with `if (false && seen.has(...))`;
 *                reddened the duplicate case and nothing else that cites a content site
 *   :24 -> :52   the missing-step-content diagnostic itself, planted by renaming its code;
 *                reddened BOTH content cases, which is why :47 and not :52 is the duplicate
 *                case's citation - :52 is the shared exit and :47 is what distinguishes it
 *
 * The last line is the whole reason to plant twice rather than once. Both content cases end at
 * the same push, so a citation chosen by reading would have put them both on :52 and left :47
 * credited by a case that does not distinguish it.
 *
 * THE :22 AND :33 CITATIONS WILL KEEP READING AS STALE, and that is a fact about the scanner
 * rather than about these numbers. `scanRefusalThrowSites` records exactly two sites in this
 * file, 47 and 52. The two `missing-step-policy` records are `code:` fields inside objects in a
 * RETURNED ARRAY LITERAL, and no site is recorded for either, so a citation pointing at one
 * cannot check out however correct it is. Both were nonetheless proved by plant, which is the
 * stronger evidence, and they are left pointing at the real lines rather than deleted: a reader
 * of this file is better served by an accurate number the ratchet cannot confirm than by no
 * number at all. The three are carried in staleCitationsBaseline.json as the debt they are.
 * This is the same family as am-qyys, where a validator that ACCUMULATES refusals is invisible;
 * this one RETURNS them in an array, which is a different shape with the same consequence.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { compileContent } from "../../content/compiler/compiler.ts";
import { matchContentRoute } from "../../content/compiler/routes.ts";
import { checkMissingStepContent } from "./contentCheck.ts";

const files = await Promise.all(
  ["equations/derivations/bm-variance.yaml", "equations/missing-step-allowlist.yaml"].map(
    async (path) => ({
      path,
      text: await readFile(new URL(`../../../content/${path}`, import.meta.url), "utf8"),
    }),
  ),
);
const anchors = ["arg-bm-independent-steps", "arg-bm-diffusion-equation"];
test("worked derivations have their own route, never an Equation namespace", () => {
  assert.equal(matchContentRoute(files[0].path).kind, "derivation-chain");
  assert.equal(matchContentRoute(files[1].path).kind, "derivation-policy");
  assert.equal(matchContentRoute("equations/brownian-motion/mean-square.json").kind, "equation");
});
test("policy, duplicate identities and JSON duplicate keys are not ignored", () => {
  assert.ok(checkMissingStepContent(files.slice(0, 1), anchors).length);
  assert.ok(
    checkMissingStepContent(
      [...files, { ...files[0], path: "equations/derivations/duplicate.yaml" }],
      anchors,
    ).length,
  );
  assert.ok(
    checkMissingStepContent(
      [
        {
          ...files[0],
          text: files[0].text.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'),
        },
        files[1],
      ],
      anchors,
    ).length,
  );
  assert.deepEqual(checkMissingStepContent(files, anchors), []);
});
test("reject: (contentCheck.ts:52) missing-step-content diagnostic emitted on invalid lesson content", () => {
  const invalid = [
    {
      ...files[0],
      text: files[0].text.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'),
    },
    files[1],
  ];
  const diags = checkMissingStepContent(invalid, anchors);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].code, "missing-step-content");
  assert.ok(diags[0].message.length > 0);
});
test("accept: missing-step-content produces no diagnostics for valid derivation records", () => {
  const diags = checkMissingStepContent(files, anchors);
  assert.deepEqual(diags, []);
});
test("reject: (contentCheck.ts:47) missing-step-content diagnostic emitted on duplicate missing-step chain identity", () => {
  const duplicate = [...files, { ...files[0], path: "equations/derivations/duplicate.yaml" }];
  const diags = checkMissingStepContent(duplicate, anchors);
  const diag = diags.find(
    (d) =>
      d.code === "missing-step-content" &&
      d.message.includes("Duplicate missing-step chain identity"),
  );
  assert.ok(diag, "must emit missing-step-content for duplicate chain identity");
});
test("reject: (contentCheck.ts:22) missing-step-policy diagnostic emitted when allowlist is missing", () => {
  const diags = checkMissingStepContent(files.slice(0, 1), anchors);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].code, "missing-step-policy");
  assert.equal(diags[0].path, "equations/missing-step-allowlist.yaml");
  assert.ok(diags[0].message.includes("Exactly one expansion policy"));
});
test("reject: (contentCheck.ts:22) missing-step-policy diagnostic emitted when duplicate allowlists are provided", () => {
  const duplicatePolicy = [
    ...files,
    { ...files[1], path: "content/equations/missing-step-allowlist.yaml" },
  ];
  const diags = checkMissingStepContent(duplicatePolicy, anchors);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].code, "missing-step-policy");
  assert.ok(diags[0].message.includes("Exactly one expansion policy"));
});
test("reject: (contentCheck.ts:33) missing-step-policy diagnostic emitted when allowlist content is malformed", () => {
  const malformedPolicy = [
    files[0],
    { path: files[1].path, text: 'schemaVersion: 1\nallowed: "not-an-array"' },
  ];
  const diags = checkMissingStepContent(malformedPolicy, anchors);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].code, "missing-step-policy");
  assert.ok(diags[0].message.length > 0);
});
test("accept: missing-step-policy produces no policy diagnostic for valid allowlist", () => {
  const diags = checkMissingStepContent(files, anchors);
  assert.equal(diags.filter((d) => d.code === "missing-step-policy").length, 0);
});
test("the normal content loader includes both worked-chain and policy records", async () => {
  const input = await loadReadingFiles();
  assert.ok(input.some((f) => f.path === files[0].path));
  assert.ok(input.some((f) => f.path === files[1].path));
  const compiled = await compileContent(input);
  assert.equal(
    compiled.ok,
    true,
    JSON.stringify(compiled.diagnostics.filter((d) => d.severity === "error")),
  );
});
test("the actual compiler rejects a planted cross-term error", async () => {
  const input = await loadReadingFiles();
  const copy = input.map((file) => {
    if (file.path !== files[0].path) return file;
    const record = JSON.parse(file.text);
    record.chain.steps[0].to.argument.args[1].args[0].value = "3";
    record.chain.steps[1].from.argument.args[1].args[0].value = "3";
    return { ...file, text: JSON.stringify(record) };
  });
  const compiled = await compileContent(copy);
  assert.equal(compiled.ok, false);
  assert.ok(
    compiled.diagnostics.some(
      (d) => d.code === "missing-step-content" && d.message.includes("worked-case"),
    ),
  );
});
