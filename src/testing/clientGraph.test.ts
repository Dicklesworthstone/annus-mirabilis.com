/**
 * NO node: BUILTIN IN THE CLIENT GRAPH, CHECKED WITHOUT A BUILD (am-t84m).
 *
 * The defect: four production deployments failed with `UnhandledSchemeError: Reading from
 * "node:crypto" is not handled by plugins` while `bun run build` exited 0 locally, and am-t84m's third
 * acceptance item says the real defect is that no lane runs the build at all -- "Whatever gate you add
 * must fail when a node: builtin re-enters the client graph, and must do so without a full deploy."
 *
 * Measured 2026-10-05: 0 offenders over 154 "use client" entry modules and 837 modules reachable from
 * them through value imports. The family is clean, which is the moment to put the guard on it.
 *
 * THE PLANT IS AGAINST THE REAL DEFECT, as the fourth acceptance item requires: a module carrying the
 * client directive and importing node:crypto, written into a temporary tree, must be found with its
 * chain. And the exclusion that makes the gate correct is planted in BOTH directions, because cutting
 * too much would report a clean graph for ever: a type-only import of the same builtin must NOT be an
 * offender, and a value import of it must be.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { summarizeClientGraph, valueImportsOf, walkClientGraph } from "./clientGraph.ts";

const ROOT = process.cwd();

/** A throwaway tree with one src/ module per entry, so a plant needs no file in the repository. */
function tree(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "client-graph-"));
  for (const [rel, text] of Object.entries(files)) {
    const path = join(root, "src", rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}

describe("the repository's own client graph", () => {
  const report = walkClientGraph(ROOT);

  it("reaches a real population, or the verdict below means nothing", () => {
    console.log(`[client graph] ${summarizeClientGraph(report)}`);
    // Floors measured 2026-10-05, not equalities: the project grows.
    expect(report.entryModules).toBeGreaterThanOrEqual(100);
    expect(report.reachableModules).toBeGreaterThanOrEqual(500);
  });

  it("imports no node: builtin anywhere the client graph reaches", () => {
    const named = report.offenders.map(
      (o) => `${o.specifier} in ${o.importer} via ${o.chain.join(" <- ")}`,
    );
    expect(named).toEqual([]);
  });
});

describe("the plants, against the defect four deployments actually hit", () => {
  it("a client module importing node:crypto is found, with its chain", () => {
    const root = tree({
      "ui/Widget.tsx":
        '"use client";\nimport { createHash } from "node:crypto";\nexport const h = createHash;\n',
    });
    const report = walkClientGraph(root);
    expect(report.entryModules).toBe(1);
    expect(report.offenders.map((o) => o.specifier)).toEqual(["node:crypto"]);
    expect(report.offenders[0]?.importer).toBe("src/ui/Widget.tsx");
    expect(report.offenders[0]?.chain).toEqual(["src/ui/Widget.tsx"]);
  });

  it("a builtin reached THROUGH a module is found, and the chain names both", () => {
    // The shape the real failure had: the client component did not import the builtin itself.
    const root = tree({
      "ui/Widget.tsx":
        '"use client";\nimport { readIt } from "../lib/loader.ts";\nexport const w = readIt;\n',
      "lib/loader.ts":
        'import { readFileSync } from "node:fs";\nexport const readIt = readFileSync;\n',
    });
    const report = walkClientGraph(root);
    expect(report.offenders.map((o) => o.specifier)).toEqual(["node:fs"]);
    expect(report.offenders[0]?.chain).toEqual(["src/lib/loader.ts", "src/ui/Widget.tsx"]);
  });

  it("a TYPE-ONLY import of the same builtin is NOT an offender", () => {
    // The direction that would make this gate useless if it were wrong the other way: `import type`
    // is erased, so a module reached only through one is not in the bundle. Counting these reported 53
    // offenders in a graph whose build succeeds.
    const root = tree({
      "ui/Widget.tsx":
        '"use client";\nimport type { Stats } from "node:fs";\nexport type S = Stats;\n',
    });
    expect(walkClientGraph(root).offenders).toEqual([]);
  });

  it("a module reached ONLY through a type import is not walked at all", () => {
    const root = tree({
      "ui/Widget.tsx":
        '"use client";\nimport type { T } from "../lib/types.ts";\nexport type U = T;\n',
      "lib/types.ts":
        'import { readFileSync } from "node:fs";\nexport type T = typeof readFileSync;\n',
    });
    // The offender is real in lib/types.ts and unreachable from the bundle, so it must not be reported.
    expect(walkClientGraph(root).offenders).toEqual([]);
  });

  it("a server module importing a builtin is not an offender, because nothing client-side reaches it", () => {
    const root = tree({
      "server/loader.ts":
        'import { readFileSync } from "node:fs";\nexport const r = readFileSync;\n',
      "ui/Widget.tsx": '"use client";\nexport const w = 1;\n',
    });
    const report = walkClientGraph(root);
    expect(report.entryModules).toBe(1);
    expect(report.offenders).toEqual([]);
  });

  it("a side-effect import is followed, since a stylesheet or a polyfill does reach the bundle", () => {
    const root = tree({
      "ui/Widget.tsx": '"use client";\nimport "../lib/polyfill.ts";\nexport const w = 1;\n',
      "lib/polyfill.ts": 'import { Buffer } from "node:buffer";\nglobalThis.Buffer = Buffer;\n',
    });
    expect(walkClientGraph(root).offenders.map((o) => o.specifier)).toEqual(["node:buffer"]);
  });

  it("a dynamic import is followed, which is how a lab's chunk arrives", () => {
    const root = tree({
      "ui/Widget.tsx": '"use client";\nexport const load = () => import("../lib/lazy.ts");\n',
      "lib/lazy.ts": 'import { join } from "node:path";\nexport const j = join;\n',
    });
    expect(walkClientGraph(root).offenders.map((o) => o.specifier)).toEqual(["node:path"]);
  });

  it("the import reader tells a value import from a type import", () => {
    // The predicate on its own, so the cut is pinned independently of any tree.
    expect(valueImportsOf('import { a } from "./a.ts";')).toEqual(["./a.ts"]);
    expect(valueImportsOf('import type { a } from "./a.ts";')).toEqual([]);
    expect(valueImportsOf('export type { a } from "./a.ts";')).toEqual([]);
    expect(valueImportsOf('export { a } from "./a.ts";')).toEqual(["./a.ts"]);
    expect(valueImportsOf('import "./a.css";')).toEqual(["./a.css"]);
    // An inline `type` specifier inside a value import still brings the module in, so it counts.
    expect(valueImportsOf('import { type A, b } from "./a.ts";')).toEqual(["./a.ts"]);
  });
});
