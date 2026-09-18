import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashModuleClosure } from "./sourceDigest.ts";
import { loadPins, verifySliceKernels } from "./verify.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const pinsPath = resolve(root, "src/content/kernel/pins.json");

describe("kernel module closure pins (am-boze)", () => {
  test("every entry in pins.closures matches hashModuleClosure of the current source", () => {
    const pins = loadPins(pinsPath);
    const closureEntries = Object.entries(pins.closures);
    expect(closureEntries.length).toBeGreaterThan(0);

    const mismatches: {
      modulePath: string;
      expectedHash: string;
      actualHash: string;
    }[] = [];

    for (const [modulePath, expectedHash] of closureEntries) {
      const fullPath = resolve(root, modulePath);
      if (!existsSync(fullPath)) {
        mismatches.push({
          modulePath,
          expectedHash,
          actualHash: "FILE_NOT_FOUND",
        });
        continue;
      }
      const actualHash = hashModuleClosure(root, [modulePath]);
      if (actualHash !== expectedHash) {
        mismatches.push({
          modulePath,
          expectedHash,
          actualHash,
        });
      }
    }

    if (mismatches.length > 0) {
      const details = mismatches
        .map(
          (m) =>
            `  Module "${m.modulePath}" closure digest drifted:\n    expected: ${m.expectedHash}\n    actual:   ${m.actualHash}`,
        )
        .join("\n");
      throw new Error(
        `Kernel closure drift detected across ${mismatches.length} module(s) in pins.closures:\n${details}`,
      );
    }

    expect(mismatches).toHaveLength(0);
  });

  test("verifySliceKernels reports zero kernel-closure-drift issues across catalog entries", () => {
    const result = verifySliceKernels({
      root,
      revision: "workspace",
      pinsPath,
    });
    const closureDrifts = result.issues.filter((i) => i.code === "kernel-closure-drift");
    expect(closureDrifts).toHaveLength(0);
  });
});
