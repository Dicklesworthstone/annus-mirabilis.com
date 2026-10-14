import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditInstruments, loadLiveInstrumentRows } from "./instruments.ts";

/**
 * A manifest that does not parse is reported as unreadable, never as empty. Until 2026-09-24 the
 * loader wrapped yaml.load in `catch { // Fall back to defaults }`: content/experiments/sr-10.yaml
 * carried two unquoted colons in preset labels from 2dcb1adf (2026-09-16) and its audit row read as
 * four missing columns for eight days (fixed in 55ed1dbf).
 */
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

describe("instrument audit: manifest parse errors", () => {
  test("every real manifest the audit reads parses", () => {
    const rows = loadLiveInstrumentRows(ROOT);
    const unreadable = rows
      .filter((r) => r.manifestError)
      .map((r) => `${r.id}: ${r.manifestError}`);
    expect(rows.length).toBeGreaterThan(30);
    expect(unreadable).toEqual([]);
  });

  /**
   * THE CARRIER MOVED FROM `probes` TO `notModeled` (2026-10-14), and the property is the same.
   *
   * This asserted the parse error surfaces through the PROBES column, which was the right place
   * while that column read the manifest. It no longer does: the probes column reads the probes a
   * reader can operate, from `content/results/`, so a manifest that does not parse cannot make
   * it say anything. `notModeled` still reads the manifest and still carries the `unread`
   * message, so the guard sr-10 earned -- an unparseable manifest is UNKNOWN, not empty -- is
   * asserted there, and the probes column is asserted NOT to blame the manifest any more.
   */
  test("the sr-10 defect is reported as a parse error, not as an empty notModeled list", () => {
    const root = mkdtempSync(join(tmpdir(), "am-instrument-audit-"));
    mkdirSync(join(root, "content", "experiments"), { recursive: true });
    // The real manifest with one label restored to its unquoted 2dcb1adf form.
    const broken = readFileSync(join(ROOT, "content/experiments/sr-10.yaml"), "utf8").replace(
      '    label: "Transverse in moving frame k (degenerate: cos phi = beta)"',
      "    label: Transverse in moving frame k (degenerate: cos phi = beta)",
    );
    expect(broken).toContain("label: Transverse in moving frame k (degenerate:");
    writeFileSync(join(root, "content/experiments/sr-10.yaml"), broken);

    const [row] = loadLiveInstrumentRows(root, { ids: ["sr-10"] });
    expect(row?.manifestError).toContain("bad indentation");
    const findings = auditInstruments(row ? [row] : []).findings;
    const notModeled = findings.find((f) => f.check === "instrument-notModeled");
    expect(notModeled?.message).toContain("does not parse");
    expect(notModeled?.message).not.toContain("has an empty notModeled list");

    // And the other half, which is new: the probes column must not blame the manifest, because
    // it no longer reads one. A row with an unparseable manifest can still be probed by a result
    // card, and this fixture root has no results directory at all, so the column fails for the
    // reason it should.
    const probes = findings.find((f) => f.check === "instrument-probes");
    expect(probes?.message).toContain("probed by no result card");
    expect(probes?.message).not.toContain("does not parse");
  });
});
