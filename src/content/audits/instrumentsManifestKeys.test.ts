import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditInstruments, loadLiveInstrumentRows } from "./instruments.ts";

/**
 * The audit reads the keys the manifests actually use. Until 2026-09-24 it read `actionContracts`
 * and `tapeModelId`, keys no manifest in content/experiments declares (they declare `actions` and
 * `tapeModel: { modelId, modelVersion }`), and it defaulted the action-contract count to 1 and the
 * embed flag to true. So every lab passed both columns without the audit reading a line of real data,
 * and a lab with no manifest at all passed them too (am-instrument-audit-defaults-pass-50bl).
 *
 * Both cases run against a temporary root, so authoring a real manifest later cannot change them.
 */
function rootWith(manifests: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "am-audit-keys-"));
  mkdirSync(join(root, "content/experiments"), { recursive: true });
  for (const [id, body] of Object.entries(manifests)) {
    writeFileSync(join(root, "content/experiments", `${id}.yaml`), body);
  }
  return root;
}

describe("instrument audit reads the manifest keys that exist (am-instrument-audit-defaults-pass-50bl)", () => {
  test("actions, tapeModel and embeddable are read from the manifest", () => {
    const root = rootWith({
      "bm-01": [
        "actions:",
        "  - actionId: a",
        "  - actionId: b",
        "  - actionId: c",
        "tapeModel:",
        "  modelId: brownian-motion-reference",
        "  modelVersion: 2",
        "embeddable: false",
        "",
      ].join("\n"),
    });
    const [row] = loadLiveInstrumentRows(root, { ids: ["bm-01"] });
    expect(row?.actionContracts).toBe(3);
    expect(row?.tapeModelId).toBe("brownian-motion-reference@2");
    expect(row?.embeddable).toBe(false);
  });

  test("a lab with no manifest has no action contract and no embed flag, and the audit says so", () => {
    const root = rootWith({});
    const rows = loadLiveInstrumentRows(root, { ids: ["bm-01"] });
    const row = rows[0];
    expect(row?.actionContracts).toBe(0);
    expect(row?.embeddable).toBeUndefined();
    const report = auditInstruments(rows);
    const text = JSON.stringify(report);
    expect(text).toContain("has no action contract");
    expect(text).toContain("does not declare the embed flag");
  });

  test("a predict exemption is read as the schema writes it: exempt: true with a reason", () => {
    // Until 2026-09-24 the audit read `predictMode.exemptionReason`, which no manifest declares,
    // so all five exempt labs failed the column. Each case below is a separate lab on one root.
    const root = rootWith({
      "lq-03": [
        "predictMode:",
        "  exempt: true",
        '  reason: "No predict affordance yet."',
        "",
      ].join("\n"),
      "lq-04": ["predictMode:", "  exempt: true", ""].join("\n"),
      "sr-04": [
        "predictMode:",
        '  exemptionReason: "The old key, which no schema reads."',
        "",
      ].join("\n"),
    });
    const rows = loadLiveInstrumentRows(root, { ids: ["lq-03", "lq-04", "sr-04"] });
    const failing = auditInstruments(rows)
      .findings.filter((f) => f.requirement === "predict-mode")
      .map((f) => f.recordId)
      .sort();
    expect(rows.find((r) => r.id === "lq-03")?.predictExemptionReason).toBe(
      "No predict affordance yet.",
    );
    expect(failing).toEqual(["lq-04", "sr-04"]);
  });
});
