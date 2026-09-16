import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../../testing/log/logger.ts";
import { checkPinnedHash } from "./bindings.ts";
import { extractTypeScriptExport } from "./extractTypeScript.ts";
import { KERNEL_BEAD_ID } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const logger = getLogger("show-the-code");

describe("pinned kernel hashes", () => {
  test("editing a fixture kernel without updating the pin fails with old and new hashes", () => {
    const extracted = extractTypeScriptExport({
      root,
      modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
      exportName: "evaluateStokesEinstein",
      revision: "fixture",
    });
    const stale = "sha256:deadbeef";
    const issues = checkPinnedHash({
      instrumentId: "bm-01",
      functionName: "evaluateStokesEinstein",
      expectedHash: stale,
      actualHash: extracted.sourceHash,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("kernel-hash-drift");
    expect(issues[0]?.oldHash).toBe(stale);
    expect(issues[0]?.newHash).toBe(extracted.sourceHash);
    expect(issues[0]?.message).toContain("bm-01");
    expect(issues[0]?.message).toContain("evaluateStokesEinstein");
    logger.log({
      testId: "pinned-hash-drift",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-01",
      outcome: "passed",
      message: "Drift check named old and new hashes",
      extra: { oldHash: stale, newHash: extracted.sourceHash, function: "evaluateStokesEinstein" },
    });
  });

  test("matching pins pass", () => {
    const extracted = extractTypeScriptExport({
      root,
      modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
      exportName: "evaluateStokesEinstein",
      revision: "fixture",
    });
    expect(
      checkPinnedHash({
        instrumentId: "bm-01",
        functionName: "evaluateStokesEinstein",
        expectedHash: extracted.sourceHash,
        actualHash: extracted.sourceHash,
      }),
    ).toEqual([]);
  });
});
