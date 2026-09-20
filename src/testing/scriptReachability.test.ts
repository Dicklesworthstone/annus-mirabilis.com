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
    "Thin CLI over src/content/audits/misconceptions.ts, whose auditMisconceptions() is called by verify-content.ts. content/misconceptions/ does not exist, so verify-content passes it an empty input and there is nothing for a CLI run to audit.",
  ],
  [
    "audit-readings.ts",
    "Thin CLI over src/content/audits/readings.ts, whose auditReadings() is called by verify-content.ts.",
  ],
  [
    "audit-shelf.ts",
    "Thin CLI over src/content/audits/shelf.ts, whose auditShelf() is called by verify-content.ts. content/historical-premises/ does not exist, so verify-content passes it an empty card list.",
  ],
  [
    "validate-ledger.ts",
    "Takes a ledger path. No reviewed ledger exists: public/papers/transcripts/ holds no files. Wiring it in would be red on arrival, which trains people to ignore red gates.",
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

  const registry = readIfPresent(join(SCRIPTS, "quality-gates", "registry.ts"));
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
    expect(registry).toContain("QUALITY_GATE_STEPS");
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
});
