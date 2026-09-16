import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { parseIdSnapshot, validateFrozenIds } from "../frozenIds.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import { parseYaml } from "../provenance/yaml.ts";
import {
  BROWNIAN_BIB_KEY,
  BROWNIAN_INVENTORY_BEAD,
  brownianSourceManifestDiagnostics,
  loadBrownianInventory,
} from "./brownianInventory.ts";

const ROOT = process.cwd();
const logRoot = mkdtempSync(join(tmpdir(), "brownian-manifest-"));
const logger = new TestLogger("manifest-brownian-motion", newRunIdentity(), logRoot);

describe("brownian source manifest (am-edn-inventory-brownian-slg)", () => {
  test("in-preparation manifest validates and does not freeze ids", () => {
    const path = join(ROOT, "content/source-blocks/brownian-motion/manifest.yaml");
    const manifest = validateSourceManifest(parseYaml(readFileSync(path, "utf8")), path);
    expect(manifest.paper).toBe("brownian-motion");
    expect(manifest.document).toBe(BROWNIAN_BIB_KEY);
    expect(manifest.status).toBe("in-preparation");
    expect(manifest.figures).toBe("none");
    expect(manifest.pageCount).toBe(12);
    expect(manifest.pageRange).toEqual([549, 560]);
    expect(manifest.units).toEqual([]);
    expect(manifest.idsFrozenAt).toBeUndefined();
    expect(manifest.units.every((u) => u.status === undefined)).toBe(true);
    logger.log({
      testId: "manifest-schema",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      comparisonKind: "bitwise",
      extra: { check: "schema" },
    });
  });

  test("empty units are a source-units-absent flag, not a reviewed edition", () => {
    const diags = brownianSourceManifestDiagnostics();
    const absent = diags.find((d) => d.rule === "source-units-absent");
    expect(absent).toBeDefined();
    expect(absent?.severity).toBe("flag");
    expect(diags.some((d) => d.severity === "error")).toBe(false);
    logger.log({
      testId: "source-units-absent",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      extra: { check: "source-units-absent" },
    });
  });

  test("alias file is empty and snapshot has no frozen ids", () => {
    const snapshot = readFileSync(
      join(ROOT, "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt"),
      "utf8",
    );
    expect(parseIdSnapshot(snapshot)).toEqual([]);
    const frozen = validateFrozenIds(snapshot, [], []);
    expect(frozen.ok).toBe(true);
    expect(frozen.missingCount).toBe(0);
    loadBrownianInventory();
    logger.log({
      testId: "aliases-and-snapshot-empty",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      comparisonKind: "bitwise",
      extra: { check: "frozen-ids" },
    });
  });

  test("removing a future frozen id without an alias fails the frozen-id check", () => {
    const snapshot = ["masthead-title", "s4-p1"].join("\n");
    const result = validateFrozenIds(snapshot, ["masthead-title"], []);
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.kind === "frozen-id-missing" && f.id === "s4-p1")).toBe(
      true,
    );
    logger.log({
      testId: "planted-frozen-id-missing",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      extra: { unitId: "s4-p1", check: "frozen-id-missing" },
    });
  });
});
