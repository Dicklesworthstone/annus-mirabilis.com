import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * AGENTS.md's Verification Commands section restates package.json's scripts, and two statements of
 * one rule drift apart. The restatement is worth keeping - a contributor reads the prose, not the
 * manifest, and the prose is where the "yours before committing / the orchestrator's" split lives -
 * so this asserts the two agree instead of asking anyone to remember.
 *
 * It follows the precedent in src/testing/log/agentsFieldList.test.ts, which pins AGENTS.md's
 * structured-log field list against FIELD_ORDER in the code for the same reason.
 *
 * What it does NOT pin: the measured costs beside the pre-commit commands (2.3s, 0.3s). Those are
 * illustrative, they drift with the machine, and a test asserting a wall-clock number is a flaky
 * test, which is worse than a stale comment. They are labelled as measurements in the prose.
 */
const ROOT = process.cwd();
const AGENTS = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
const SCRIPTS = (
  JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;

/**
 * Lines that name a shape rather than a command. Listed by their exact text so that adding a new
 * unresolvable line is a deliberate edit here, not a silent widening of what the test ignores.
 */
const PLACEHOLDER_LINES: readonly string[] = [
  "bunx biome check --write <your files>",
  "bun test <the one test file you changed>",
  "ubs --diff",
  "ubs --staged",
];

function verificationSection(): string {
  const start = AGENTS.indexOf("## Verification Commands");
  if (start === -1) throw new Error("AGENTS.md has no '## Verification Commands' section.");
  const end = AGENTS.indexOf("\n## ", start + 10);
  return AGENTS.slice(start, end === -1 ? undefined : end);
}

function statedCommands(): string[] {
  const out: string[] = [];
  for (const [, body] of [...verificationSection().matchAll(/```bash\n([\s\S]*?)```/g)]) {
    for (const raw of (body ?? "").split("\n")) {
      const line = raw.split("#")[0]?.trim() ?? "";
      if (line) out.push(line);
    }
  }
  return out;
}

describe("AGENTS.md's verification commands and package.json agree", () => {
  test("the section states commands at all, so an empty one cannot pass", () => {
    const commands = statedCommands();
    expect(commands.length).toBeGreaterThan(0);
    // and it is not only placeholders: at least one line must be a command that can be resolved
    expect(commands.filter((c) => !PLACEHOLDER_LINES.includes(c)).length).toBeGreaterThan(0);
  });

  test("every `bun run <name>` names a script package.json actually defines", () => {
    const missing: string[] = [];
    for (const command of statedCommands()) {
      const match = command.match(/^bun run ([\w:]+)$/);
      if (match?.[1] && !(match[1] in SCRIPTS)) missing.push(match[1]);
    }
    expect(missing).toEqual([]);
  });

  test("every `bun scripts/<path>` names a file that exists", () => {
    const missing: string[] = [];
    for (const command of statedCommands()) {
      const match = command.match(/^bun (scripts\/[\w./-]+)/);
      if (match?.[1] && !existsSync(join(ROOT, match[1]))) missing.push(match[1]);
    }
    expect(missing).toEqual([]);
  });

  test("every line is either resolvable or a declared placeholder, so nothing is skipped silently", () => {
    const unaccounted = statedCommands().filter(
      (c) =>
        !PLACEHOLDER_LINES.includes(c) && !/^bun run [\w:]+$/.test(c) && !/^bun scripts\//.test(c),
    );
    expect(unaccounted).toEqual([]);
  });

  test("the split by owner survives: both groups are present", () => {
    const section = verificationSection();
    expect(section).toContain("### Before you commit");
    expect(section).toContain("### Central verify");
    // the pre-commit group must name the affordable lane, which is the reason the split exists
    expect(section.slice(section.indexOf("### Before you commit"))).toContain(
      "bun run check:types",
    );
  });

  /**
   * The single-statement property. AGENTS.md used to carry the command list TWICE: the Verification
   * Commands section, and a "Code Quality & Verification" section that restated five of them with
   * no owner split, telling a contributor to run typecheck, lint, test and build after their own
   * changes while the other section says those four are central verify's. They had already drifted.
   * The second is now a pointer, and this keeps it one statement.
   */
  test("the commands are stated once: no bash block outside the Verification Commands section", () => {
    const section = verificationSection();
    const blocksInSection = [...section.matchAll(/```bash\n([\s\S]*?)```/g)].length;
    const blocksInFile = [...AGENTS.matchAll(/```bash\n([\s\S]*?)```/g)].filter((m) =>
      (m[1] ?? "").includes("bun run"),
    ).length;
    expect(blocksInSection).toBeGreaterThan(0);
    expect(blocksInFile).toBe(blocksInSection);
  });
});
