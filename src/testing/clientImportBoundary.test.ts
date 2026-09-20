import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  extractImportSpecifiers,
  isClientSurfaceFile,
  unrepresentedRoots,
  walkTypeScriptFiles,
} from "./clientSurface.ts";
import { getLogger } from "./log/logger.ts";

/**
 * AGENTS.md: "Never create a giant aggregate module (an allEinsteinContent.ts) imported into client
 * components." This gate enforces it.
 *
 * am-84kb rewrote what it can see. The population used to be three directory literals - src/app,
 * src/visuals, src/components - and 37 of the 126 client-marked files under src/ were outside all
 * three: the whole reader shell, the equation layer, the a11y reading settings, the discovery
 * workbench. Nothing was escaping at the time, measured by running the old forbidden-import rules
 * over all 126 and finding zero violations inside the roots and zero outside. The defect was that a
 * regression in 29% of the client surface could not have been caught, because those files were
 * never in the denominator.
 *
 * Two things changed, and the second was not asked for: the population is now every TypeScript file
 * under src/, and both "is this a client component" and "is this an import" are read from the
 * parser instead of from the text. See src/testing/clientSurface.ts for why each was measured.
 */
describe("Client Component Import Boundary Gate (am-cm-compiler-core-oa7, am-84kb)", () => {
  const logger = getLogger("content-compiler-tests");

  /** The module paths a client component may never reach, as path SEGMENTS rather than substrings. */
  const FORBIDDEN_SEGMENT_RUNS: readonly (readonly string[])[] = [
    ["content", "compiler"],
    ["generated", "content"],
  ];

  function forbiddenTarget(specifier: string): string | null {
    const segments = specifier.replace(/^@\//, "").split("/").filter(Boolean);
    for (const run of FORBIDDEN_SEGMENT_RUNS) {
      for (let i = 0; i + run.length <= segments.length; i++) {
        if (run.every((part, j) => segments[i + j] === part)) return run.join("/");
      }
    }
    return null;
  }

  /**
   * Renaming a root must still fail loudly. The old gate asserted this per directory because its
   * walk swallowed readdir errors; the population no longer names directories, so the floor is kept
   * as a coverage assertion instead: these three are known to hold client code, and a tree where one
   * of them contributes nothing is a tree this gate has stopped covering.
   */
  const ROOTS_THAT_MUST_STILL_BE_REPRESENTED = ["src/app/", "src/visuals/", "src/components/"];

  it("no client component anywhere under src/ imports the compiler core or the generated corpus aggregate", async () => {
    const root = process.cwd();
    const scannedFiles = await walkTypeScriptFiles(root, "src");

    expect(scannedFiles.length).toBeGreaterThan(0);
    expect(unrepresentedRoots(scannedFiles, ROOTS_THAT_MUST_STILL_BE_REPRESENTED)).toEqual([]);

    const violations: { file: string; line: number; importStatement: string; target: string }[] =
      [];
    let clientFileCount = 0;

    for (const file of scannedFiles) {
      const content = await readFile(resolve(root, file), "utf8");
      if (!isClientSurfaceFile(file, content)) continue;
      clientFileCount++;
      for (const imported of extractImportSpecifiers(file, content)) {
        const target = forbiddenTarget(imported.specifier);
        if (target !== null) {
          violations.push({
            file,
            line: imported.line,
            importStatement: imported.text,
            target,
          });
        }
      }
    }

    // A client surface of zero would make "no violations" meaningless, and is the shape the old
    // three-directory population could reach by a rename.
    expect(clientFileCount).toBeGreaterThan(0);

    if (violations.length > 0) {
      console.error("Client import boundary violations detected:", violations);
    }
    expect(violations).toEqual([]);

    logger.log({
      testId: "client-import-boundary",
      beadId: "am-84kb",
      outcome: violations.length === 0 ? "passed" : "failed",
      message: `Scanned ${scannedFiles.length} files under src/; ${clientFileCount} are client components; ${violations.length} violations.`,
    });
  });

  it("the forbidden-target test matches path segments, not substrings", () => {
    // the cases a substring rule gets wrong in both directions
    expect(forbiddenTarget("../../content/compiler/compile.ts")).toBe("content/compiler");
    expect(forbiddenTarget("@/content/compiler")).toBe("content/compiler");
    expect(forbiddenTarget("../generated/content/index.ts")).toBe("generated/content");
    expect(forbiddenTarget("../../content/compilerNotes.ts")).toBeNull();
    expect(forbiddenTarget("./mycontent/compilerish")).toBeNull();
    expect(forbiddenTarget("../content/records.ts")).toBeNull();
  });

  it("a root that contributes nothing is reported, so a rename cannot make this gate silent", () => {
    const asShipped = ["src/app/page.tsx", "src/visuals/Plot.tsx", "src/components/Chip.tsx"];
    expect(unrepresentedRoots(asShipped, ROOTS_THAT_MUST_STILL_BE_REPRESENTED)).toEqual([]);
    // src/visuals renamed away: the walk still returns files, so only this check can notice
    const afterRename = ["src/app/page.tsx", "src/components/Chip.tsx", "src/vis/Plot.tsx"];
    expect(unrepresentedRoots(afterRename, ROOTS_THAT_MUST_STILL_BE_REPRESENTED)).toEqual([
      "src/visuals/",
    ]);
    expect(unrepresentedRoots([], ROOTS_THAT_MUST_STILL_BE_REPRESENTED)).toEqual(
      ROOTS_THAT_MUST_STILL_BE_REPRESENTED,
    );
  });
});
