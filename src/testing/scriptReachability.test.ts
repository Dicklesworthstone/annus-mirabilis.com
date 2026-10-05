import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * am-unwired-audits-uwot. Six check-shaped scripts had a real failure path and were invoked by
 * nothing. A census found them; this catches the next one on arrival instead.
 *
 * The census that found them first reported ONE, because it counted a script as covered when a
 * test file merely CONTAINED its name, and five of those hits were string literals inside stubbed
 * return values. Reachability here is therefore decided by an import statement or an executed
 * command, never by a substring: `mentions` below is computed only so the failure message can say
 * when a script is named but not imported, which is exactly how that false green looked.
 */

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const SCRIPTS = join(ROOT, "scripts");
const CHECK_SHAPED = /^(audit|verify|check|lint|validate)-/;

/**
 * Scripts that are deliberately not reachable, each with what it waits on. An entry here is a
 * recorded decision, not a suppression: the test fails if a listed script becomes reachable, so
 * wiring one in forces its reason to be deleted rather than left behind as stale prose.
 */
const EXPECTED_UNREACHABLE: ReadonlyMap<string, string> = new Map([
  [
    "audit-instruments.ts",
    "Thin CLI over src/content/audits/instruments.ts. auditInstruments() is already called by scripts/verify-content.ts, a registry step, so the audit is reachable and only this debugging entry point is not. Running the CLI over the whole catalogue exits 1 today because most of the 33 instruments are unbuilt.",
  ],
  [
    "audit-misconceptions.ts",
    "Thin CLI over src/content/audits/misconceptions.ts, whose auditMisconceptions() is called by verify-content.ts over the 26 live ledger records in content/misconceptions (am-8gbg, 2026-09-27). Only this --fixture entry point is unreachable; the audit itself judges the real corpus. The reason recorded here until 2026-09-27 denied that directory any records at all, which stopped being true when the ledgers landed and was still on the page.",
  ],
  [
    "audit-readings.ts",
    "Thin CLI over src/content/audits/readings.ts, whose auditReadings() is called by verify-content.ts.",
  ],
  [
    "audit-shelf.ts",
    'Thin CLI over src/content/audits/shelf.ts, whose auditShelf() is called by verify-content.ts over the cards the four journeys render: measured 2026-10-05, 46 cards on 4 shelves. The second sentence here read "content/historical-premises/ does not exist, so verify-content passes it an empty card list" until then. The directory is still absent, but that stopped being the shelf audit\'s input on 2026-10-02 (am-rc1001-bridge-plan-pcjk.12), when the empty list was replaced by the live shelves -- so the reason described a vacuous run that no longer happens, which is the stale prose this map exists to prevent.',
  ],
  [
    "validate-ledger.ts",
    "Takes a ledger path and validates a REVIEWED transcription. public/papers/transcripts/ holds 4 machine drafts and no *-reviewed.txt, so there is nothing for it to validate; wiring it in would be red on arrival, which trains people to ignore red gates. The reason recorded here until 2026-09-27 denied that directory any files at all, which stopped being true when the drafts landed.",
  ],
]);

function readIfPresent(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match.test(entry.name)) out.push(full);
  }
  return out;
}

/** An ES import of this module, not a mention of its name. */
function importsModule(source: string, stem: string): boolean {
  return new RegExp(`from\\s*["'][^"']*\\b${stem}\\.ts["']`).test(source);
}

describe("check-shaped scripts are reachable from some runner (am-unwired-audits-uwot)", () => {
  const scriptNames = readdirSync(SCRIPTS).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && CHECK_SHAPED.test(f),
  );

  const registryText = readIfPresent(join(SCRIPTS, "quality-gates", "registry.ts"));
  /**
   * Only the COMMAND arrays count as an invocation.
   *
   * This used to test `registryText.includes("scripts/<name>")`, and a gate entry names its script
   * twice: once in `command`, which runs it, and once in `availability.scriptPath`, which only says
   * the file exists. Planting a gate whose command pointed elsewhere while scriptPath still named
   * the script left this test GREEN - a mention standing in for an invocation, which is the defect
   * this file exists to catch, inside the file itself.
   */
  const registry = [...registryText.matchAll(/command:\s*\[([^\]]*)\]/g)]
    .map((m) => m[1] ?? "")
    .join("\n");
  const packageScripts = JSON.stringify(
    JSON.parse(readIfPresent(join(ROOT, "package.json")) || "{}").scripts ?? {},
  );
  const workflows = walk(join(ROOT, ".github"), /\.(yml|yaml)$/)
    .map(readIfPresent)
    .join("\n");
  const testSources = [
    ...walk(join(ROOT, "src"), /\.test\.(ts|tsx|mjs|js)$/),
    ...walk(SCRIPTS, /\.test\.(ts|tsx|mjs|js)$/),
  ].map(readIfPresent);
  const scriptSources = new Map(
    readdirSync(SCRIPTS)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => [f, readIfPresent(join(SCRIPTS, f))] as const),
  );

  test("the census still finds the scripts it is meant to inspect", () => {
    expect(scriptNames.length).toBeGreaterThan(10);
    expect(registryText).toContain("QUALITY_GATE_STEPS");
    // the command census must be non-empty, or every script would look unreachable
    expect(registry.length).toBeGreaterThan(0);
    expect(testSources.length).toBeGreaterThan(50);
  });

  test("every check-shaped script is a gate step, an npm script, a workflow step, or imported", () => {
    const reachable = new Set<string>();
    for (const name of scriptNames) {
      const ref = `scripts/${name}`;
      if (registry.includes(ref) || packageScripts.includes(ref) || workflows.includes(ref)) {
        reachable.add(name);
      } else if (testSources.some((s) => importsModule(s, name.slice(0, -3)))) {
        reachable.add(name);
      }
    }
    // A script imported by a reachable script is itself reachable: verify-content.ts is a gate
    // step and pulls in audit-dimensions.ts and check-revisions.ts.
    let grew = true;
    while (grew) {
      grew = false;
      for (const name of scriptNames) {
        if (reachable.has(name)) continue;
        for (const [host, source] of scriptSources) {
          const hostReachable = reachable.has(host) || registry.includes(`scripts/${host}`);
          if (hostReachable && importsModule(source, name.slice(0, -3))) {
            reachable.add(name);
            grew = true;
            break;
          }
        }
      }
    }

    const unreachable = scriptNames.filter((n) => !reachable.has(n)).sort();
    const expected = [...EXPECTED_UNREACHABLE.keys()].sort();

    const appeared = unreachable.filter((n) => !EXPECTED_UNREACHABLE.has(n));
    expect(
      appeared.map((n) => {
        const named = testSources.filter((s) => s.includes(n.slice(0, -3))).length;
        return `${n} can fail but nothing invokes it${named > 0 ? ` (named as a string in ${named} test file(s), which is not an import)` : ""}`;
      }),
    ).toEqual([]);

    const nowReachable = expected.filter((n) => !unreachable.includes(n));
    expect(
      nowReachable.map(
        (n) => `${n} is now reachable; delete its EXPECTED_UNREACHABLE entry and its stale reason`,
      ),
    ).toEqual([]);

    expect(unreachable).toEqual(expected);
  });

  test("every recorded exception still exists on disk", () => {
    for (const name of EXPECTED_UNREACHABLE.keys()) {
      expect(scriptNames).toContain(name);
    }
  });

  test("a recorded reason that claims a path is empty is checked against the path (am-8gbg)", () => {
    /**
     * AN ENTRY HERE IS A RECORDED DECISION, and a decision outlives the condition it was made
     * under. Two of these reasons had already expired when this test was written:
     * audit-misconceptions said "content/misconceptions/ does not exist" while 26 ledger records
     * sat in it, and validate-ledger said "public/papers/transcripts/ holds no files" while it
     * held four machine drafts. Both entries stayed correct in their VERDICT, the script really is
     * unreachable, so nothing failed and the false reasons were quoted into two later documents.
     *
     * So the claim is now checked rather than believed. A reason may still say a directory is
     * empty; it may not say so while the directory has records in it.
     *
     * A CONSTRAINT ON HOW A REASON IS WRITTEN, learned by this test firing on its own fix: the
     * matcher reads text and cannot tell a live claim from one being recounted, so a rewritten
     * reason must NOT quote the expired wording. Say what is true now, and describe the old claim
     * without repeating its words. This is the same trap as a gate that reads prose about a
     * forbidden construct and takes it for the construct.
     */
    const claims = [...EXPECTED_UNREACHABLE.entries()].flatMap(([script, reason]) =>
      [
        ...reason.matchAll(
          /\b((?:content|public)\/[\w./-]+?)\/?\s+(?:does not exist|holds no files)/g,
        ),
      ].map((m) => ({ script, path: m[1] as string })),
    );
    const broken = claims.filter(({ path }) => {
      const full = join(ROOT, path);
      try {
        return readdirSync(full).length > 0;
      } catch {
        return false; // absent, so the claim stands
      }
    });
    expect(
      broken.map(
        ({ script, path }) =>
          `${script}: its reason says ${path} is empty, but it holds records. Rewrite the reason or wire the script in.`,
      ),
    ).toEqual([]);
    // The control: the matcher finds claims at all, or the assertion above passes on an empty list
    // and proves nothing. audit-shelf's reason names content/historical-premises, which is empty.
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.map((c) => c.script)).toContain("audit-shelf.ts");
  });
});
