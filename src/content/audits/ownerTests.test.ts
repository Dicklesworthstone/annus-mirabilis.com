import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadLiveInstrumentRows } from "./instruments.ts";
import { ownerTestIndex } from "./ownerTests.ts";

/**
 * The owner-test column credits a lab when a test imports one of its owner functions, wherever
 * that test lives (src/content/audits/ownerTests.ts). Every case runs on a temporary root, so no
 * later change to the real tree can make it pass or fail.
 */
function rootWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "am-owner-tests-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

const OWNER = "src/physics/owner.ts";
const PHYSICS = {
  [OWNER]:
    "export function kernelA() {\n  return 1;\n}\nexport function other() {\n  return 2;\n}\n",
  "src/physics/barrel.ts": 'export * from "./owner.ts";\n',
  "src/physics/renamed.ts": 'export { kernelA as renamedA } from "./owner.ts";\n',
};

describe("owner tests are found by what a test imports", () => {
  const root = rootWith({
    ...PHYSICS,
    "src/testing/direct.test.ts": 'import { kernelA } from "../physics/owner.ts";\nkernelA();\n',
    "src/testing/viaBarrel.test.ts":
      'import { kernelA } from "../physics/barrel.ts";\nkernelA();\n',
    "src/testing/renamed.test.ts":
      'import { renamedA } from "../physics/renamed.ts";\nrenamedA();\n',
    "src/testing/namespace.test.ts": 'import * as o from "../physics/owner.ts";\no.kernelA();\n',
    "scripts/dynamic.test.ts":
      'const { kernelA } = await import("../src/physics/owner.ts");\nkernelA();\n',
    // None of these tests kernelA.
    // The block comment holds the import on a line of its own, where it would match if comments
    // were not blanked first.
    "src/testing/comment.test.ts":
      '// import { kernelA } from "../physics/owner.ts";\n/*\nimport { kernelA } from "../physics/owner.ts";\n*/\n',
    "src/testing/typeOnly.test.ts": 'import type { kernelA } from "../physics/owner.ts";\n',
    "src/testing/other.test.ts": 'import { other } from "../physics/owner.ts";\nother();\n',
    "src/testing/namespaceOther.test.ts": 'import * as o from "../physics/owner.ts";\no.other();\n',
    "src/testing/notATest.ts": 'import { kernelA } from "../physics/owner.ts";\n',
  });
  const index = ownerTestIndex(root);
  const credited = [
    "scripts/dynamic.test.ts",
    "src/testing/direct.test.ts",
    "src/testing/namespace.test.ts",
    "src/testing/renamed.test.ts",
    "src/testing/viaBarrel.test.ts",
  ];

  test("direct, re-exported, renamed, namespace and dynamic imports are credited, and nothing else", () => {
    expect(index.testFilesScanned).toBe(9);
    expect(index.testsOf({ module: OWNER, exportName: "kernelA" })).toEqual(credited);
  });

  test("a manifest naming a barrel finds the tests of the function the barrel re-exports", () => {
    expect(index.testsOf({ module: "src/physics/barrel.ts", exportName: "kernelA" })).toEqual(
      credited,
    );
  });

  test("a function no test imports has no owner test", () => {
    expect(index.testsOf({ module: OWNER, exportName: "missing" })).toEqual([]);
  });
});

describe("the instrument audit's owner-test column reads imports, not directories", () => {
  const manifest = [
    "owner:",
    "  kind: reference-evaluator",
    "  kernelFunctions:",
    `    - module: "${OWNER}"`,
    '      exportName: "kernelA"',
    "",
  ].join("\n");

  test("a lab tested from src/testing/ has an owner test", () => {
    const root = rootWith({
      ...PHYSICS,
      "content/experiments/bm-01.yaml": manifest,
      "src/testing/bm01.kernel.test.ts": 'import { kernelA } from "../physics/owner.ts";\n',
    });
    const [row] = loadLiveInstrumentRows(root, { ids: ["bm-01"] });
    expect(row?.ownerTest).toBe(true);
  });

  test("a test beside the lab that never imports its owner is not an owner test", () => {
    const root = rootWith({
      ...PHYSICS,
      "content/experiments/bm-01.yaml": manifest,
      "src/experiments/bm01/session.test.ts": 'import { other } from "../../physics/owner.ts";\n',
    });
    const [row] = loadLiveInstrumentRows(root, { ids: ["bm-01"] });
    expect(row?.ownerTest).toBe(false);
  });
});
