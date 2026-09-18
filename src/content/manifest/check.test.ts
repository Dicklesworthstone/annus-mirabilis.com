import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { type CheckReportItem, listRegisteredChecks } from "../compiler/checks/registry.ts";
import { registerSourceManifestCheck, SOURCE_MANIFEST_CHECK_ID } from "./check.ts";

describe("source manifest check refusal throw sites (am-muyh)", () => {
  describe("manifest-schema-invalid (check.ts:47)", () => {
    test("reject: (check.ts:47) reports manifest-schema-invalid when source manifest record fails schema validation", () => {
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
