/**
 * The extraction population is derived from the header, not from three hand-drawn lists.
 * The DERIVED half of am-75t2, and the drift guard.
 *
 * Five carriers were once in none of the three gates' lists and were scanned by nothing: two
 * ambient `.d.ts` shims and three co-located test files. They fell through because the lists
 * are drawn by KIND - runtime, scripts, UI components - while the population is defined by the
 * HEADER, and a test of an extracted module is none of the three kinds. e4fa09b1 corrected the
 * lists by hand. That fixed the instance. This fixes the way it reopens: the population is
 * computed from the bytes here, and a carrier nobody lists fails.
 *
 * WHY THIS FILE IS IN THE NODE LANE, AND WHAT THAT COSTS. Deriving the set means asking git
 * which files it tracks, and `bun test` cannot spawn a subprocess from inside this repository:
 * every form of it - `execFileSync` with default stdio, with explicit stdio, and
 * `Bun.spawnSync` - fails with `EBADF ... posix_spawn '/usr/bin/git'`. Measured, and the
 * measurement is worth keeping because it looks like a code fault and is not: the identical
 * file placed outside the repository spawns git and returns 3525 paths. So this file is listed
 * in bunfig's pathIgnorePatterns and runs under `node --experimental-strip-types --test`, which
 * is why it uses `node:test` and cannot import anything from `bun:test`.
 *
 * The cost is that this half disappears if the node lane refuses to start, which it once did
 * for 49 commits. So the half that does NOT need a subprocess - holding every listed file to
 * the strongest of the three rule sets - lives in extractionCarriers.test.ts in the bun lane
 * and stays green independently. Neither covers the other: that one cannot notice a carrier
 * that is in no list, and this one does not scan a single byte for hygiene.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  contentIsExtractionCarrier,
  extractionCarriers,
  GATE_LISTS,
  readGateList,
} from "./extractionCarriers.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("the extraction population is derived, and every carrier is owned by a gate", () => {
  const carriers = extractionCarriers(ROOT);
  const listed = new Set(GATE_LISTS.flatMap((gate) => readGateList(ROOT, gate.path, gate.name)));

  test("the derivation returns a real population", () => {
    // A floor, not a census. A derivation that returned nothing would make both checks below
    // pass over an empty set, and an empty run is indistinguishable from a clean one. 40
    // carriers measured on 2026-09-22.
    assert.ok(
      carriers.length > 30,
      `derived only ${carriers.length} extraction carriers; the derivation is broken, not the tree`,
    );
    assert.ok(listed.size > 30, `parsed only ${listed.size} listed paths from three gates`);
  });

  test("the probe window can cost time but never membership", () => {
    // Positive control for the escalation path. 512 bytes is smaller than every real header
    // (the longest measured 4458), so if escalation to a full read were broken this returns
    // fewer carriers - and a shrunken population reads exactly like a clean one. A 4096-byte
    // window silently lost scripts/e2e-paper-vertical-slices.ts when this was first measured.
    assert.deepEqual(extractionCarriers(ROOT, 512), carriers);
  });

  test("every derived carrier is claimed by one of the three gates", () => {
    const unowned = carriers.filter((path) => !listed.has(path));
    assert.deepEqual(
      unowned,
      [],
      `${unowned.length} of ${carriers.length} files carry the extraction header and are in no gate's list, so no gate scans them`,
    );
  });

  test("no gate lists a path that no longer carries the header", () => {
    const carrierSet = new Set(carriers);
    const stale = [...listed].filter((path) => !carrierSet.has(path)).sort();
    assert.deepEqual(
      stale,
      [],
      `${stale.length} of ${listed.size} listed paths no longer carry the extraction header`,
    );
  });

  test("the derivation and the listed set agree file by file, not merely in size", () => {
    // Equal counts with different members is the way a hand-maintained population rots without
    // either count changing. Compared as sorted lists for that reason.
    assert.deepEqual(carriers, [...listed].sort());
  });

  test("the predicate that decides membership is the one that reads the file", () => {
    // Not a tautology: it asserts the derived list was not assembled some other way. Every
    // derived path must satisfy the exported predicate when its bytes are read back.
    const disagreements = carriers.filter(
      (path) => !contentIsExtractionCarrier(readFileSync(join(ROOT, path), "utf8")),
    );
    assert.deepEqual(disagreements, []);
  });
});
