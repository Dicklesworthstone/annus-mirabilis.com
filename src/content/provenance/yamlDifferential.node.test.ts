/**
 * EVERY COMMITTED YAML RECORD, THROUGH BOTH PARSERS (am-hcx5, fourth item).
 *
 * This repository reads content records with its own `parseYaml`, and a hand-written parser's
 * leniency is invisible from inside: a shape it mis-handles produces a value, not an error, so
 * every count computed over that record is conditional on the parser having placed every part of
 * it. The only cheap instrument for that is a SECOND parser, and the disagreement is the finding.
 *
 * It is how am-hcx5 was found. A record that python's `yaml.safe_load` rejected was accepted here
 * with its trailing content discarded, and the check reading it reported a census identical to its
 * baseline to the digit.
 *
 * THE DANGEROUS DIRECTION IS "OURS ACCEPTS, THEIRS REJECTS", because that is a file we are reading
 * as though it were well-formed. The other direction is a capability gap rather than a silence, and
 * the two files in it are declared below with the reason. Both directions fail, so a declaration
 * cannot quietly cover a new file.
 *
 * WHY THE NODE LANE. The population is "every COMMITTED record", which is `git ls-files`, and bun
 * cannot spawn git in this repository. The population matters: walking the filesystem instead would
 * pull in peers' untracked work-in-progress records and fail this test for someone else's half-
 * written file.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { parseYaml } from "./yaml.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Committed `.yaml` files this parser cannot read, each with why, and each still required to be
 * readable by the other parser.
 *
 * Both are JSON stored under a `.yaml` extension. YAML is a superset of JSON so js-yaml takes
 * them; `parseYaml` does not support a top-level flow mapping and refuses with "Expected key: value
 * mapping". That is a capability gap and not a silence -- it refuses loudly, nothing reads these
 * two through it, and the alternative would be teaching a hand-written parser flow style for two
 * files. Declared rather than fixed, and declared by PATH so a third file cannot join them quietly.
 */
const JSON_IN_YAML: Readonly<Record<string, string>> = {
  "content/equations/derivations/bm-variance.yaml":
    "JSON body under a .yaml extension; parseYaml has no top-level flow mapping, and nothing reads this file through it.",
  "content/equations/missing-step-allowlist.yaml":
    "JSON body under a .yaml extension; same reason as bm-variance.yaml.",
};

test("no committed record is accepted by our parser and rejected by another", () => {
  const files = execFileSync("git", ["ls-files", "*.yaml", "*.yml"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);

  let both = 0;
  const oursOnly: string[] = [];
  const theirsOnly: string[] = [];
  const neither: string[] = [];

  for (const file of files) {
    const text = readFileSync(resolve(ROOT, file), "utf8");
    let ours = true;
    let oursError = "";
    let theirs = true;
    try {
      parseYaml(text);
    } catch (error) {
      ours = false;
      oursError = String((error as Error).message).slice(0, 90);
    }
    try {
      yaml.load(text);
    } catch {
      theirs = false;
    }
    if (ours && theirs) both += 1;
    else if (ours) oursOnly.push(file);
    else if (theirs) theirsOnly.push(`${file} -- ${oursError}`);
    else neither.push(file);
  }

  console.log(
    `[yaml differential] ${files.length} committed YAML files: ${both} accepted by both, ` +
      `${oursOnly.length} by ours only, ${theirsOnly.length} by js-yaml only, ${neither.length} by neither`,
  );

  // A `git ls-files` that returned nothing would make every assertion below pass over an empty set,
  // and this file would read exactly as it does now.
  assert.ok(files.length > 1000, `only ${files.length} committed YAML files found`);
  assert.ok(both > 1000, `only ${both} files were accepted by both parsers`);

  assert.deepEqual(
    oursOnly,
    [],
    `These committed records are accepted by parseYaml and REJECTED by js-yaml, so we are reading a malformed file as though it were well-formed and whatever part of it the parser could not place is silently missing (am-hcx5):\n${oursOnly.map((f) => `  ${f}`).join("\n")}`,
  );

  // A row is declared when its path is a key of JSON_IN_YAML.
  const undeclaredPaths = theirsOnly
    .map((row) => row.split(" -- ")[0] ?? "")
    .filter((path) => !(path in JSON_IN_YAML));
  assert.deepEqual(
    undeclaredPaths,
    [],
    `These committed records are rejected by parseYaml. Each needs either a repair or an entry in JSON_IN_YAML saying why it is unreadable here:\n${theirsOnly.map((r) => `  ${r}`).join("\n")}`,
  );
  assert.deepEqual(
    neither,
    [],
    `rejected by BOTH parsers, so simply malformed:\n${neither.join("\n")}`,
  );
});

test("the declarations are not stale: each declared file exists and is still unreadable here", () => {
  // A declaration that outlived its reason is an excuse, so both halves are checked. A declared file
  // that parseYaml can now read must lose its entry; a declared file that has gone must too.
  const committed = new Set(
    execFileSync("git", ["ls-files", "*.yaml", "*.yml"], { cwd: ROOT, encoding: "utf8" })
      .trim()
      .split("\n"),
  );
  assert.ok(Object.keys(JSON_IN_YAML).length > 0, "nothing is declared, so this test is vacuous");
  for (const [file, why] of Object.entries(JSON_IN_YAML)) {
    assert.ok(committed.has(file), `${file} is declared unreadable but is not a committed file`);
    assert.ok(why.length > 40, `${file} declares no reason worth reading`);
    let readable = true;
    try {
      parseYaml(readFileSync(resolve(ROOT, file), "utf8"));
    } catch {
      readable = false;
    }
    assert.equal(
      readable,
      false,
      `${file} is declared unreadable by parseYaml but now parses. Remove its entry from JSON_IN_YAML rather than leaving an excuse beside a file that works.`,
    );
    // And the other parser must still accept it, or the declaration is hiding a malformed file.
    yaml.load(readFileSync(resolve(ROOT, file), "utf8"));
  }
});
