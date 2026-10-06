#!/usr/bin/env bun
/**
 * REPOINT A DRIFTED REFUSAL CITATION, WITH THE PLANT THE RATCHET DEMANDS (am-kf8w).
 *
 *   bun scripts/repoint-refusal-citation.ts <source file> [--apply]
 *
 * WHY THIS EXISTS. staleCitationsBaseline.json allows 217 citations that do not check out, across 41
 * files. 136 of them are UNAMBIGUOUS: the citing block names exactly one code with a site in that file,
 * so the line the citation should name is determined by IDENTITY rather than chosen by proximity. They
 * are drift - a band of them per insertion above a group of sites - and each was absorbed into the
 * baseline instead of repaired, which is how a ratchet's number stops meaning what it says.
 *
 * The stale-citation ratchet forbids the cheap repair in its own refusal text: "Repoint a citation only
 * after PLANTING: rename that one site's code and confirm exactly the citing test goes red. Never
 * repoint by adding the drift - a drifted citation is a claim nobody has re-checked." That rule is
 * right, and it is also why 136 repairs never happened: by hand each one is a plant, a test run, a
 * restore and an edit. This does exactly those four steps per citation and REFUSES on anything it
 * cannot prove, so the rule is mechanised rather than bypassed.
 *
 * ITS CREATION GATE, stated as AGENTS.md requires:
 *   consumer       the stale-citation ratchet in src/testing/refusals/refusalRatchet.test.ts, whose
 *                  baseline this lowers; running code branches on the result
 *   gate enforced  repoint-only-after-planting, per citation, mechanically
 *   defect class   136 identity-determined drifted citations absorbed into a baseline
 *   deletion cond  when the baseline reaches zero, or when citations stop being the credit mechanism
 *
 * WHAT IT WILL NOT DO. It never touches an AMBIGUOUS finding (several code-matching sites, where
 * position would choose and a neighbour can be credited for work done elsewhere - the misattribution
 * am-ksl3 exists to prevent), and never one with no code-matching site at all (the site-model class).
 * It never raises a baseline. Without --apply it changes nothing and only reports what it proved.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeUntestedRefusals } from "../src/testing/refusals/refusalScanner.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface Repoint {
  readonly testFile: string;
  readonly source: string;
  readonly from: number;
  readonly to: number;
  readonly siteCode: string;
}

/** The findings on one source file whose repair target is determined by identity, never by proximity. */
export function unambiguousRepoints(source: string, root = ROOT): Repoint[] {
  const report = analyzeUntestedRefusals(root);
  const out: Repoint[] = [];
  for (const f of report.citationFindings) {
    if (f.source !== source || f.hint.length !== 1) continue;
    const to = f.hint[0] as number;
    const lines = readFileSync(resolve(root, f.source), "utf8").split("\n");
    // The code at the target line, read from the file rather than from the finding, because a
    // `stale` finding carries no siteCode and the plant needs the literal to rename.
    const window = lines.slice(to - 1, to + 4).join("\n");
    const code = /"([a-z][a-z0-9]*(?:-[a-z0-9]+)+)"/.exec(window)?.[1];
    if (!code) continue;
    // Deduplicated on (testFile, from, to): the audit reports per BLOCK, so one citation named in two
    // blocks arrives twice and would otherwise be planted twice for one repair.
    const key = `${f.testFile}|${f.citedLine}|${to}`;
    if (out.some((r) => `${r.testFile}|${r.from}|${r.to}` === key)) continue;
    out.push({ testFile: f.testFile, source: f.source, from: f.citedLine, to, siteCode: code });
  }
  return out;
}

/** Run one test file and return the titles that failed. Bun for .ts, node for a node-lane file. */
function failingTitles(testFile: string): string[] {
  const nodeLane = /\.node\.test\.|\.test\.mjs$/.test(testFile);
  const run = nodeLane
    ? spawnSync("node", ["--experimental-strip-types", testFile], { cwd: ROOT, encoding: "utf8" })
    : spawnSync("bun", ["test", "--isolate", "--timeout", "60000", testFile], {
        cwd: ROOT,
        encoding: "utf8",
      });
  const text = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const titles: string[] = [];
  for (const m of text.matchAll(/^\(fail\) (.+?)(?: \[[\d.]+ms\])?$/gm))
    titles.push(m[1] as string);
  for (const m of text.matchAll(/^✖ (.+?)(?: \([\d.]+ms\))?$/gm)) titles.push(m[1] as string);
  return titles;
}

/**
 * Prove one repoint: rename the site's code, confirm the CITING test reddens, restore.
 *
 * WHAT "EXACTLY THE CITING TEST" HAS TO MEAN, having been read too literally first. The ratchet says
 * "confirm exactly the citing test goes red", and requiring exactly ONE failure refused four honest
 * repairs: ledgerMathSettings.ts:41 is driven by its own citing test AND by "the macro ban still holds
 * INSIDE an alignment environment", so renaming that code reddens two. Two tests driving one site is
 * ordinary, and it does not weaken what the plant establishes.
 *
 * So the assertion is: the citing test IS among the failures, and the count of others is reported for a
 * reader. Zero failures still refuses - that means the citation names a site nothing drives, and
 * repointing it would manufacture coverage. Only the citing test's own file is run, so an "other"
 * failure can only be a sibling in that file, never an unrelated perturbation elsewhere.
 */
function provedByPlant(r: Repoint): { proved: boolean; reason: string } {
  const path = resolve(ROOT, r.source);
  const before = readFileSync(path, "utf8");
  const lines = before.split("\n");
  const idx = lines.findIndex((l, i) => i >= r.to - 1 && l.includes(`"${r.siteCode}"`));
  if (idx === -1)
    return { proved: false, reason: `could not find "${r.siteCode}" at or below :${r.to}` };
  lines[idx] = (lines[idx] as string).replace(`"${r.siteCode}"`, '"zz-planted-renamed-code"');
  writeFileSync(path, lines.join("\n"));
  try {
    const failures = failingTitles(r.testFile);
    const citing = failures.filter((t) => t.includes(`(${r.source.split("/").pop()}:${r.from})`));
    if (failures.length === 0) return { proved: false, reason: "the plant reddened NOTHING" };
    if (citing.length === 0)
      return {
        proved: false,
        reason: `the citing test did NOT redden; ${failures.length} other(s) did: ${failures.slice(0, 2).join(" | ")}`,
      };
    const others = failures.length - citing.length;
    return {
      proved: true,
      reason: `${citing[0]}${others > 0 ? `  (+${others} sibling test(s) drive the same site)` : ""}`,
    };
  } finally {
    writeFileSync(path, before);
    const after = readFileSync(path, "utf8");
    // ONE BARE THROW, DECLARED IN bareThrowsBaseline.json rather than given a kebab code. It is not a
    // model refusal a reader will ever see: it is this script's own invariant that a planted file was
    // put back, and if it fires the right outcome is a stack trace at the exact line, not a typed
    // refusal record. A code here would add a site to the untested-refusal census that no test can
    // reach without deliberately breaking the restore.
    if (after !== before) throw new Error(`failed to restore ${r.source} byte-identically`);
  }
}

async function main(): Promise<number> {
  const source = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!source) {
    console.error("usage: bun scripts/repoint-refusal-citation.ts <source file> [--apply]");
    return 2;
  }
  const repoints = unambiguousRepoints(source);
  console.log(`[repoint] ${source}: ${repoints.length} unambiguous citation(s) to prove`);
  if (repoints.length === 0) {
    console.log(
      "[repoint] nothing to do. Ambiguous and site-model findings are never touched here.",
    );
    return 0;
  }
  const proved: Repoint[] = [];
  for (const r of repoints) {
    const { proved: ok, reason } = provedByPlant(r);
    console.log(
      `  ${ok ? "PROVED" : "REFUSED"}  ${r.testFile} cites :${r.from} -> :${r.to}  [${r.siteCode}]`,
    );
    console.log(`      ${reason}`);
    if (ok) proved.push(r);
  }
  console.log(`[repoint] proved ${proved.length} of ${repoints.length}`);
  if (!apply) {
    console.log("[repoint] --apply not given; no file changed.");
    return proved.length === repoints.length ? 0 : 1;
  }
  const byTest = new Map<string, Repoint[]>();
  for (const r of proved) byTest.set(r.testFile, [...(byTest.get(r.testFile) ?? []), r]);
  for (const [testFile, rs] of byTest) {
    const path = resolve(ROOT, testFile);
    let text = readFileSync(path, "utf8");
    const base = testFile.includes("/") ? (source.split("/").pop() as string) : source;
    for (const r of rs) {
      const needle = `(${base}:${r.from})`;
      if (text.split(needle).length - 1 !== 1) {
        console.error(`[repoint] REFUSED: ${needle} is not unique in ${testFile}; nothing written`);
        return 3;
      }
      text = text.replace(needle, `(${base}:${r.to})`);
    }
    writeFileSync(path, text);
    console.log(`[repoint] rewrote ${rs.length} citation(s) in ${testFile}`);
  }
  if (proved.length > 0)
    console.log(
      "[repoint] now lower that file's entry in src/testing/refusals/staleCitationsBaseline.json to the " +
        "number the ratchet prints, in this same commit.",
    );
  else console.log("[repoint] nothing proved, so nothing written and no baseline may move.");
  return proved.length === repoints.length ? 0 : 1;
}

if (process.argv[1]?.endsWith("repoint-refusal-citation.ts")) process.exit(await main());
