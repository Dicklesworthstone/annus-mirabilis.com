/**
 * Machine-specific filesystem dependencies in tests (am-yhus, rescoped).
 *
 * The first version of this gate matched two path roots as substrings of a
 * line. That was too loose in one direction and too tight in the other, and
 * both showed up the same night:
 *
 * - Too loose. A path used as test DATA reads exactly like one used as a
 *   destination. `loadHistoricalDatasetFromYaml(yaml, { sourcePath: "/Users/…/pipeline/x.yaml" })`
 *   must name an absolute pipeline path, because rejecting one is the thing
 *   under test. A line matcher cannot tell it from `mkdirSync("/Users/…")`.
 * - Too tight. The repair applied under am-yhus was partly a blanket rewrite
 *   of one username to another. `/home/agent/…` is not `/Users/…`, so the gate
 *   went quiet, while the rewritten path existed on no machine at all - not
 *   the runner's and not the author's. One test went from passing locally and
 *   failing on CI to failing everywhere, and the gate said nothing.
 *
 * So the question is not whether an absolute path appears. It is whether an
 * absolute path rooted in somebody's machine reaches a filesystem call. A
 * destination is a dependency; a string is data.
 *
 * Anything derived from `os.tmpdir()`, `mkdtemp`, `process.cwd()` or the
 * module's own location is permitted, because every machine has those.
 */

import * as ts from "typescript";

/** Path roots that belong to one machine rather than to every machine. */
export const MACHINE_PATH_ROOTS = ["/Users/", "/home/", "/Volumes/", "/mnt/", "/media/"] as const;

/**
 * Filesystem entry points a destination flows into.
 *
 * Both the sync and callback/promise spellings, because the defect is the
 * path, not the calling convention.
 */
export const FS_SINKS = new Set([
  "mkdir",
  "mkdirSync",
  "mkdtemp",
  "mkdtempSync",
  "writeFile",
  "writeFileSync",
  "appendFile",
  "appendFileSync",
  "readFile",
  "readFileSync",
  "readdir",
  "readdirSync",
  "existsSync",
  "stat",
  "statSync",
  "lstatSync",
  "rm",
  "rmSync",
  "rmdir",
  "rmdirSync",
  "unlink",
  "unlinkSync",
  "copyFile",
  "copyFileSync",
  "cpSync",
  "open",
  "openSync",
  "createReadStream",
  "createWriteStream",
]);

/** Expressions whose value every machine can produce. */
const PORTABLE_SOURCES = new Set(["tmpdir", "mkdtemp", "mkdtempSync", "cwd", "fileURLToPath"]);

export interface MachinePathViolation {
  readonly file: string;
  readonly line: number;
  readonly sink: string;
  readonly path: string;
  readonly via: "literal" | "local constant";
}

function machineRootIn(text: string): string | null {
  for (const root of MACHINE_PATH_ROOTS) {
    if (text.startsWith(root)) return root;
  }
  return null;
}

/**
 * Finds machine-rooted absolute paths that reach a filesystem call.
 *
 * One hop of local constant resolution, which is what the observed defect
 * needed: `const scratchDir = "/home/agent/…"; mkdirSync(scratchDir)`. Deeper
 * flow is not attempted, and that limit is deliberate - a checker that claims
 * more reach than it has is the failure this gate exists to prevent.
 */
export function findMachinePathSinks(source: string, relPath: string): MachinePathViolation[] {
  const file = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true);
  const violations: MachinePathViolation[] = [];

  // Pass 1: local constants bound to a machine-rooted literal.
  const constants = new Map<string, string>();
  const portable = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteralLike(init) && machineRootIn(init.text) !== null) {
        constants.set(node.name.text, init.text);
      } else if (mentionsPortableSource(init)) {
        portable.add(node.name.text);
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(file);

  // Pass 2: filesystem calls whose first argument reaches one of those.
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const sink = sinkNameOf(node.expression);
      const first = node.arguments[0];
      if (sink !== null && first !== undefined && !mentionsPortableSource(first)) {
        const found = resolveMachinePath(first, constants, portable);
        if (found !== null) {
          violations.push({
            file: relPath,
            line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
            sink,
            path: found.path,
            via: found.via,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return violations;
}

function sinkNameOf(expression: ts.Expression): string | null {
  const name = ts.isPropertyAccessExpression(expression)
    ? expression.name.text
    : ts.isIdentifier(expression)
      ? expression.text
      : null;
  return name !== null && FS_SINKS.has(name) ? name : null;
}

function mentionsPortableSource(node: ts.Node): boolean {
  let portable = false;
  const walk = (n: ts.Node): void => {
    if (portable) return;
    if (ts.isIdentifier(n) && PORTABLE_SOURCES.has(n.text)) portable = true;
    ts.forEachChild(n, walk);
  };
  walk(node);
  return portable;
}

function resolveMachinePath(
  node: ts.Node,
  constants: ReadonlyMap<string, string>,
  portable: ReadonlySet<string>,
): { path: string; via: MachinePathViolation["via"] } | null {
  let hit: { path: string; via: MachinePathViolation["via"] } | null = null;
  const walk = (n: ts.Node): void => {
    if (hit !== null) return;
    if (ts.isStringLiteralLike(n) && machineRootIn(n.text) !== null) {
      hit = { path: n.text, via: "literal" };
      return;
    }
    if (ts.isIdentifier(n) && !portable.has(n.text)) {
      const bound = constants.get(n.text);
      if (bound !== undefined) {
        hit = { path: bound, via: "local constant" };
        return;
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return hit;
}
