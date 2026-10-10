import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { type CheckReportItem, listRegisteredChecks } from "../compiler/checks/registry.ts";
import { registerSourceManifestCheck, SOURCE_MANIFEST_CHECK_ID } from "./check.ts";

describe("source manifest check refusal throw sites (am-muyh)", () => {
  describe("manifest-schema-invalid (check.ts:86)", () => {
    test("reject: (check.ts:86) reports manifest-schema-invalid when source manifest record fails schema validation", () => {
      registerSourceManifestCheck();
      const check = listRegisteredChecks().find((c) => c.id === SOURCE_MANIFEST_CHECK_ID);
      assert.ok(check, "SOURCE_MANIFEST_CHECK_ID must be registered");

      const reported: CheckReportItem[] = [];
      const records = new Map<string, unknown>();

      // Malformed source-manifest: missing paper, document, units
      records.set("invalid-manifest", {
        kind: "source-manifest",
        paper: "not-a-valid-paper",
      });

      check.run({
        records,
        files: [],
        indexes: {},
        report: (item) => reported.push(item),
      });

      const failure = reported.find((r) => r.rule === "manifest-schema-invalid");
      assert.ok(failure, "Must report manifest-schema-invalid");
      assert.equal(failure?.recordId, "invalid-manifest");
    });

    test("accept: valid source manifest does not report manifest-schema-invalid", () => {
      registerSourceManifestCheck();
      const check = listRegisteredChecks().find((c) => c.id === SOURCE_MANIFEST_CHECK_ID);
      assert.ok(check, "SOURCE_MANIFEST_CHECK_ID must be registered");

      const reported: CheckReportItem[] = [];
      const records = new Map<string, unknown>();

      records.set("valid-manifest", {
        kind: "source-manifest",
        paper: "light-quanta",
        document: "ap-17-132",
        status: "in-preparation",
        pageCount: 2,
        pageRange: [132, 133],
        idsFrozenAt: "2026-09-16T00:00:00Z",
        frozenBy: "editor-albert",
        units: [
          {
            id: "s1-p1",
            kind: "paragraph",
            locators: [{ page: 132 }],
          },
        ],
      });

      check.run({
        records,
        files: [],
        indexes: {},
        report: (item) => reported.push(item),
      });

      const failure = reported.find((r) => r.rule === "manifest-schema-invalid");
      assert.equal(failure, undefined);
    });
  });
});

/**
 * THE ALIAS RECORDS REACH THE MANIFEST VALIDATOR (am-m0na).
 *
 * `validateManifest(manifest, { manifests })` passed only the manifests, so `context.aliases ?? []`
 * in validator.ts:494 was ALWAYS empty and every `explainGap(missingId, aliases)` was asked to
 * explain a gap with nothing to explain it from.
 *
 * Measured over the real corpus on 2026-10-10, which is what makes this worth a test rather than a
 * tidy-up: feeding the four manifests raised 31 `sequence-gap` errors, and ALSO feeding the four
 * `content/aliases/<paper>.yaml` files changed that count by ZERO. All 31 gaps are explained by
 * registered alias records -- with the repair, the same corpus gives 4 manifests, 37 alias records
 * and 0 errors. The corpus was right the whole time and the check was asking with an empty hand,
 * which is indistinguishable from 31 real gaps.
 *
 * Both directions are asserted, because a repair that simply stopped reporting gaps would look
 * identical from the passing side: an UNEXPLAINED gap must still be reported, or this becomes a
 * way of making findings disappear.
 */
describe("the manifest check passes the alias records it was given (am-m0na)", () => {
  /** A manifest with a hole at s1-p2, and the alias file that explains it. */
  const manifestWithGap = {
    kind: "source-manifest",
    paper: "light-quanta",
    document: "ap-17-132",
    status: "in-preparation",
    pageCount: 2,
    pageRange: [132, 133],
    idsFrozenAt: "2026-09-16T00:00:00Z",
    frozenBy: "am-edn-inventory-light-quanta-skp",
    units: [
      { id: "s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 132 }] },
      { id: "s1-p3", kind: "paragraph", section: "s1", locators: [{ page: 132 }] },
    ],
  };
  const aliasFile = {
    kind: "aliases",
    paper: "light-quanta",
    aliases: [
      {
        retiredId: "s1-p2",
        kind: "merged",
        replacementIds: ["s1-p1"],
        reason: "Not a printed paragraph; it resumes s1-p1 after the display.",
        date: "2026-09-19",
        editor: "am-edn-inventory-light-quanta-skp",
      },
    ],
  };

  function gapsFor(records: Record<string, unknown>): CheckReportItem[] {
    registerSourceManifestCheck();
    const check = listRegisteredChecks().find((c) => c.id === SOURCE_MANIFEST_CHECK_ID);
    assert.ok(check, "SOURCE_MANIFEST_CHECK_ID must be registered");
    const reported: CheckReportItem[] = [];
    check.run({
      records: new Map<string, unknown>(Object.entries(records)),
      files: [],
      indexes: {},
      report: (item) => reported.push(item),
    });
    return reported.filter((r) => r.rule === "sequence-gap");
  }

  test("a gap WITH its alias record is explained", () => {
    const gaps = gapsFor({
      "source-manifest:light-quanta:": manifestWithGap,
      "aliases::light-quanta": aliasFile,
    });
    assert.equal(gaps.length, 0, "A registered alias must explain the gap it was written for");
  });

  test("the SAME gap without the alias record is still reported, so nothing was silenced", () => {
    const gaps = gapsFor({ "source-manifest:light-quanta:": manifestWithGap });
    assert.equal(gaps.length, 1, "An unexplained gap must still be reported");
    assert.match(String(gaps[0]?.message), /s1-p2/);
  });

  test("an alias for a DIFFERENT id does not explain this gap", () => {
    // The boundary. Without it, "aliases are passed" could be satisfied by a check that stops
    // reporting as soon as any alias exists.
    const wrongAlias = {
      ...aliasFile,
      aliases: [{ ...aliasFile.aliases[0], retiredId: "s9-p9" }],
    };
    const gaps = gapsFor({
      "source-manifest:light-quanta:": manifestWithGap,
      "aliases::light-quanta": wrongAlias,
    });
    assert.equal(gaps.length, 1, "An alias for another id must not explain this one");
  });

  test("an alias entry that does not parse is REFUSED, not quietly used to explain a gap", () => {
    // A malformed alias must not become a way of making gaps disappear, which is the failure mode
    // this repair could otherwise introduce.
    registerSourceManifestCheck();
    const check = listRegisteredChecks().find((c) => c.id === SOURCE_MANIFEST_CHECK_ID);
    assert.ok(check);
    const reported: CheckReportItem[] = [];
    check.run({
      records: new Map<string, unknown>([
        ["source-manifest:light-quanta:", manifestWithGap],
        [
          "aliases::light-quanta",
          { kind: "aliases", paper: "light-quanta", aliases: [{ retiredId: "s1-p2" }] },
        ],
      ]),
      files: [],
      indexes: {},
      report: (item) => reported.push(item),
    });
    assert.ok(
      reported.some((r) => r.rule === "alias-schema"),
      "A malformed alias entry must be reported",
    );
    assert.equal(
      reported.filter((r) => r.rule === "sequence-gap").length,
      1,
      "and the gap it failed to explain must still be reported",
    );
  });
});
