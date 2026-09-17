import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildFragmentManifest,
  fragmentHash,
  listFragmentReferences,
  lookupFragment,
  type ReadingFragment,
  readFragmentManifest,
  verifyFragmentReferences,
  writeFragmentManifest,
} from "./fragments.ts";

/** An incompressible-content fixture, the same trick scripts/measure-reading-face.test.ts uses,
 * standing in for the "over-budget fixture paper" this bead's Test Plan names. */
function bigFragment(overrides: Partial<ReadingFragment> = {}): ReadingFragment {
  return {
    paper: "brownian-motion",
    section: "s5",
    unitId: "s5-p2",
    reading: 2,
    html: `<p data-reading="2">${randomBytes(4096).toString("base64")}</p>`,
    ...overrides,
  };
}

describe("fragmentHash (am-read-detail-axis-sfc)", () => {
  test("is deterministic: the same fragment always hashes the same way", () => {
    const fragment = bigFragment();
    expect(fragmentHash(fragment)).toBe(fragmentHash({ ...fragment }));
  });

  test("differs when the html differs, even with identical identity fields", () => {
    const a = bigFragment({ html: "<p>a</p>" });
    const b = bigFragment({ html: "<p>b</p>" });
    expect(fragmentHash(a)).not.toBe(fragmentHash(b));
  });

  test("differs when only the unit id differs, even with identical html", () => {
    const html = "<p>same text</p>";
    const a = bigFragment({ unitId: "s5-p2", html });
    const b = bigFragment({ unitId: "s5-p3", html });
    expect(fragmentHash(a)).not.toBe(fragmentHash(b));
  });

  test("differs when only the reading level differs", () => {
    const html = "<p>same text</p>";
    const a = bigFragment({ reading: 2, html });
    const b = bigFragment({ reading: 3, html });
    expect(fragmentHash(a)).not.toBe(fragmentHash(b));
  });
});

describe("buildFragmentManifest (am-read-detail-axis-sfc)", () => {
  test("groups fragments by paper and section, addressed by hash", () => {
    const f1 = bigFragment({ section: "s5", unitId: "s5-p2" });
    const f2 = bigFragment({ section: "s5", unitId: "s5-p3" });
    const f3 = bigFragment({ paper: "light-quanta", section: "s3", unitId: "s3-p1" });
    const manifest = buildFragmentManifest([f1, f2, f3]);

    const h1 = fragmentHash(f1);
    const h2 = fragmentHash(f2);
    const h3 = fragmentHash(f3);
    expect(lookupFragment(manifest, "brownian-motion", "s5", h1)?.unitId).toBe("s5-p2");
    expect(lookupFragment(manifest, "brownian-motion", "s5", h2)?.unitId).toBe("s5-p3");
    expect(lookupFragment(manifest, "light-quanta", "s3", h3)?.unitId).toBe("s3-p1");
    expect(lookupFragment(manifest, "brownian-motion", "s5", "not-a-real-hash")).toBeUndefined();
  });

  test("identical content at the same identity is written once, not duplicated", () => {
    const fragment = bigFragment();
    const manifest = buildFragmentManifest([fragment, { ...fragment }]);
    const refs = listFragmentReferences(manifest);
    expect(refs.length).toBe(1);
  });

  // buildFragmentManifest's hash-collision guard (two different fragment bodies producing the
  // same hash) is not tested here: producing a real SHA-256 collision is computationally
  // infeasible, and a test that only fakes one by constructing the manifest by hand would not
  // exercise the guard at all -- it would just assert that a hand-thrown Error throws. The guard
  // stays in as a defensive check with proof class ABSENT for this specific branch.
});

describe("verifyFragmentReferences (am-read-detail-axis-sfc)", () => {
  test("reports no missing references when every referenced fragment exists", () => {
    const fragment = bigFragment();
    const manifest = buildFragmentManifest([fragment]);
    const hash = fragmentHash(fragment);
    const missing = verifyFragmentReferences(manifest, [
      { paper: fragment.paper, section: fragment.section, hash },
    ]);
    expect(missing).toEqual([]);
  });

  test("a missing referenced fragment fails the build check with the specific missing reference", () => {
    const fragment = bigFragment();
    const manifest = buildFragmentManifest([fragment]);
    const missing = verifyFragmentReferences(manifest, [
      { paper: fragment.paper, section: fragment.section, hash: "0000000000000000" },
    ]);
    expect(missing).toEqual([
      { paper: fragment.paper, section: fragment.section, hash: "0000000000000000" },
    ]);
  });
});

describe("writeFragmentManifest / readFragmentManifest round-trip (am-read-detail-axis-sfc)", () => {
  test("a manifest written to a fresh mkdtemp directory reads back byte-identical", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "am-reading-fragments-test-"));
    try {
      const f1 = bigFragment({ section: "s5", unitId: "s5-p2" });
      const f2 = bigFragment({ paper: "light-quanta", section: "s3", unitId: "s3-p1" });
      const manifest = buildFragmentManifest([f1, f2]);

      await writeFragmentManifest(manifest, dir);
      const roundTripped = await readFragmentManifest(dir);

      expect(roundTripped).toEqual(manifest);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("reading an absent manifest directory returns an empty manifest rather than throwing", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "am-reading-fragments-test-"));
    const absent = path.join(dir, "does-not-exist");
    try {
      const manifest = await readFragmentManifest(absent);
      expect(manifest).toEqual({});
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
