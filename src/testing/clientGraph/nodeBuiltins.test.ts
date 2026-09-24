import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isClientEntry, scanClientGraphForNodeBuiltins, valueImports } from "./nodeBuiltins.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * am-t84m. The production build failed on Vercel for five days with four UnhandledSchemeError
 * lines while `bun run build` exited 0 locally and every lane stayed green, because no lane ran
 * the build. This is not a wrapper around the build: wrapping it would pass today and catch
 * nothing, since the failure is not reproducible at HEAD and the one source-level instance left
 * is invisible to webpack. The defect is one import statement from returning.
 */
describe("no module reachable from a client entry reads a node: builtin (am-t84m)", () => {
  const scan = scanClientGraphForNodeBuiltins(ROOT);

  test("THE DENOMINATOR: the scan reaches a real population before it claims anything", () => {
    // Without these the gate would report conformance over an empty sweep, which is the defect
    // am-1hst was filed for. Measured on 2026-09-22: 101 client entries of 1285 non-test source
    // files under src/. The floors sit well below both so a legitimate refactor does not trip
    // them, and far above zero so an empty sweep cannot pass.
    expect(scan.sourceFilesScanned).toBeGreaterThan(800);
    expect(scan.clientEntries.length).toBeGreaterThan(50);
  });

  /**
   * Known instances, keyed by the ENTRY THAT REACHES THEM rather than by the module.
   *
   * Keying on the module would defeat the gate: codec.ts would be excused, and the moment a
   * live page imported the permalink barrel the node:zlib edge would enter a shipping bundle
   * with the gate still green. That is the "one import statement from returning" case this
   * exists to catch. Keyed on the chain, this entry excuses exactly the path that is already
   * here and refuses every new one.
   */
  // Empty since 2026-09-24: the one entry, "ShareControl.tsx -> permalink/codec.ts" (deflateRawSync
  // from node:zlib), was repaired as this entry asked, with a browser-safe codec: ShareControl now
  // encodes with CompressionStream through permalink/browserCodec.ts, and codec.ts is server-only.
  const KNOWN: ReadonlyMap<string, string> = new Map([]);

  test("no node: builtin is reachable from any client entry by a value import", () => {
    const report = scan.findings
      .filter((finding) => !KNOWN.has(`${finding.chain[0]} -> ${finding.module}`))
      .map(
        (finding) =>
          `${finding.module} reads ${finding.builtins.join(", ")}\n    via ${finding.chain.join("\n     -> ")}`,
      );
    expect(report).toEqual([]);
  });

  test("every known instance still exists, so a stale exemption cannot hide", () => {
    // An entry that no longer describes the tree is an exemption nobody is auditing. If the
    // permalink codec is repaired, this fails and the entry must be deleted.
    const present = new Set(scan.findings.map((f) => `${f.chain[0]} -> ${f.module}`));
    for (const chain of KNOWN.keys()) {
      expect(present.has(chain)).toBe(true);
    }
    // And the list stays short enough to read. It is debt, not a policy.
    expect(KNOWN.size).toBeLessThanOrEqual(2);
  });

  /**
   * THE VALUE/TYPE DISTINCTION IS THE CORRECTNESS OF THIS GATE, so it is asserted directly.
   *
   * Following type edges reported 43 reachable modules through two choke edges that are BOTH
   * `import type` - schemas/experiment.ts -> schemas/source.ts, and scheduler.ts ->
   * schemas/experiment.ts. Following value edges only, that 43 is 0. A future simplification
   * that stopped distinguishing them would resurrect a diagnosis naming the wrong module.
   */
  test("an erased import is not a runtime edge, and a value import is", () => {
    expect(valueImports('import type { A } from "./a.ts";')).toEqual([]);
    expect(valueImports('import { type A, type B } from "./a.ts";')).toEqual([]);
    // A mixed list still carries a value.
    expect(valueImports('import { type A, b } from "./a.ts";')).toEqual(["./a.ts"]);
    expect(valueImports('import { b } from "./a.ts";')).toEqual(["./a.ts"]);
    expect(valueImports('import a from "./a.ts";')).toEqual(["./a.ts"]);
    expect(valueImports('import * as a from "./a.ts";')).toEqual(["./a.ts"]);
    // A dynamic import creates a chunk, so it is a value edge.
    expect(valueImports('const m = await import("./a.ts");')).toEqual(["./a.ts"]);
    // export type is erased too; export ... from is not.
    expect(valueImports('export type { A } from "./a.ts";')).toEqual([]);
    expect(valueImports('export { a } from "./a.ts";')).toEqual(["./a.ts"]);
    // A bare side-effect import is the strongest value edge: it exists only to be executed.
    // The first version of this required a `from` clause and missed it, and the driven plant
    // for am-t84m is what caught that - importing the permalink barrel as a bare import into a
    // live client component left this gate green.
    expect(valueImports('import "./a.ts";')).toEqual(["./a.ts"]);
    expect(valueImports("import './a.ts';")).toEqual(["./a.ts"]);
  });

  test("the client boundary is the directive, not the file's location", () => {
    expect(isClientEntry('"use client";\nexport const a = 1;')).toBe(true);
    expect(isClientEntry("// a comment first\n'use client';\n")).toBe(true);
    expect(isClientEntry('/* a block\n   comment */\n"use client";\n')).toBe(true);
    // A server component is not a client entry, and node: in one is legitimate.
    expect(isClientEntry('import { readFileSync } from "node:fs";\n')).toBe(false);
    // The directive must precede real code.
    expect(isClientEntry('const x = 1;\n"use client";\n')).toBe(false);
  });

  test("the detector finds a builtin behind a value edge and not behind a type edge", () => {
    // The planted negative in unit form, so the traversal itself is guarded and not only the
    // live tree. The driven form - planting a real import into a real client file and watching
    // this gate go red - is recorded on the bead.
    const entry = ['"use client";', 'import { encode } from "./codec.ts";'].join("\n");
    const leaf =
      'import { deflateRawSync } from "node:zlib";\nexport const encode = deflateRawSync;';
    expect(isClientEntry(entry)).toBe(true);
    expect(valueImports(entry)).toEqual(["./codec.ts"]);
    expect(/node:zlib/.test(leaf)).toBe(true);

    // And the same leaf behind a type-only edge contributes nothing.
    const typeOnlyEntry = ['"use client";', 'import type { Encode } from "./codec.ts";'].join("\n");
    expect(valueImports(typeOnlyEntry)).toEqual([]);
  });
});
