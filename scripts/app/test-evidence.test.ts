/**
 * A failing UI test's evidence, gathered and checked offline: an attachments export and an app
 * evidence folder built here in the shapes xcresulttool and TestEvidence.swift write.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkEvidence,
  evidenceFolderName,
  failureRecord,
  gatherEvidence,
  ORIENTATION_ATTACHMENT,
  pngSize,
  SCREENSHOT_ATTACHMENT,
} from "./test-evidence.ts";

const TEST = "HarnessUITests/testSeededFailureRetainsEvidence()";

/** A PNG header of the given size: enough for pngSize, which reads nothing past it. */
function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function write(path: string, content: string | Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

const line = (fields: Record<string, string>) => `${JSON.stringify(fields)}\n`;

/** An xcresult attachments export and an app evidence folder with two launches of the test. */
function fixture(
  options: { width?: number; height?: number; facing?: string; bridgeValue?: boolean } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "test-evidence-"));
  const attachments = join(root, "attachments");
  write(join(attachments, "shot.png"), png(options.width ?? 1206, options.height ?? 2622));
  write(
    join(attachments, "facing.txt"),
    options.facing ?? "portrait (app window 402x874 pt; device unknown)",
  );
  write(
    join(attachments, "manifest.json"),
    JSON.stringify([
      {
        testIdentifier: TEST,
        attachments: [
          {
            exportedFileName: "shot.png",
            suggestedHumanReadableName: `${SCREENSHOT_ATTACHMENT}_0_ABC.png`,
          },
          {
            exportedFileName: "facing.txt",
            suggestedHumanReadableName: `${ORIENTATION_ATTACHMENT}_0_DEF.txt`,
          },
        ],
      },
    ]),
  );
  const app = join(root, "AMTestEvidence");
  const folder = join(app, "HarnessUITests_testSeededFailureRetainsEvidence");
  write(
    join(folder, "20260924T120000.000Z", "events.jsonl"),
    line({ kind: "launch", at: "2026-09-24T12:00:00.000Z", test: "HarnessUITests/x" }),
  );
  write(join(folder, "20260924T120000.000Z", "dom.html"), "<!-- am-test-evidence old -->\n<html>");
  write(
    join(folder, "20260924T120100.000Z", "events.jsonl"),
    line({
      kind: "console",
      at: "2026-09-24T12:01:01.000Z",
      level: "log",
      message: "test console installed",
    }) +
      line({
        kind: "bridge",
        at: "2026-09-24T12:01:02.000Z",
        type: "storage.write",
        status: "ok",
        namespace: "localStorage",
        ...(options.bridgeValue ? { value: "a private note" } : {}),
      }),
  );
  write(
    join(folder, "20260924T120100.000Z", "dom.html"),
    '<!-- am-test-evidence route=/ bytes=40 kept=40 -->\n<html data-theme="kramgasse-night">',
  );
  const windows: { start: Date; end: Date }[] = [];
  const dest = join(root, "artifacts", "test-logs", "app-evidence", "run", "test");
  gatherEvidence({
    attachmentsDir: attachments,
    appEvidenceDir: app,
    testIdentifier: TEST,
    dest,
    appLog: (start, end) => {
      windows.push({ start, end });
      return '{"eventMessage":"console"}\n';
    },
    fallbackWindow: { start: new Date(0), end: new Date(1) },
  });
  const xcresult = join(root, "run.xcresult");
  mkdirSync(xcresult);
  return { root, dest, xcresult, windows };
}

describe("the evidence folder name", () => {
  it("is the one the app makes, for every shared case", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const { cases } = JSON.parse(
      readFileSync(join(here, "fixtures", "evidence-folders.json"), "utf8"),
    ) as { cases: { xcresult: string; launch: string; folder: string }[] };
    assert.ok(cases.length > 0);
    for (const entry of cases) {
      assert.equal(evidenceFolderName(entry.xcresult), entry.folder, entry.xcresult);
      assert.equal(evidenceFolderName(entry.launch), entry.folder, entry.launch);
    }
  });
});

describe("a PNG's size", () => {
  it("is read from its header, and anything else is not a PNG", () => {
    assert.deepEqual(pngSize(png(1206, 2622)), { width: 1206, height: 2622 });
    assert.equal(pngSize(Buffer.from("GIF89a, not a png at all, and long enough")), null);
    assert.equal(pngSize(png(1, 1).subarray(0, 20)), null);
  });
});

describe("gathering and checking a failing test's evidence", () => {
  it("keeps every item: screenshot, the newest DOM, every launch's events, and the app's log", () => {
    const { dest, xcresult, windows } = fixture();
    const items = checkEvidence(dest, xcresult);
    assert.deepEqual(
      items.filter((item) => !item.present),
      [],
      JSON.stringify(items),
    );
    assert.deepEqual(
      items.map((item) => item.item),
      ["xcresult", "screenshot", "dom", "console", "runtime events", "no reader data", "app log"],
    );
    assert.match(readFileSync(join(dest, "dom.html"), "utf8"), /kramgasse-night/, "the newest DOM");
    assert.equal(readFileSync(join(dest, "events.jsonl"), "utf8").trim().split("\n").length, 3);
    // The log window runs from a second before the first event to five after the last.
    assert.deepEqual(
      windows.map((w) => [w.start.toISOString(), w.end.toISOString()]),
      [["2026-09-24T11:59:59.000Z", "2026-09-24T12:01:07.000Z"]],
    );
  });

  it("refuses a screenshot whose shape contradicts the device's orientation", () => {
    const rotated = fixture({ width: 2622, height: 1206, facing: "portrait" });
    const screenshot = checkEvidence(rotated.dest, rotated.xcresult).find(
      (item) => item.item === "screenshot",
    );
    assert.equal(screenshot?.present, false);
    assert.match(screenshot?.detail ?? "", /does not match/);
    const unknown = fixture({ facing: "unknown (the app is not in front; device unknown)" });
    assert.equal(
      checkEvidence(unknown.dest, unknown.xcresult).find((item) => item.item === "screenshot")
        ?.present,
      false,
      "an orientation the device could not state verifies nothing",
    );
  });

  it("refuses a bridge event that carries more than a type and an outcome", () => {
    const { dest, xcresult } = fixture({ bridgeValue: true });
    const privacy = checkEvidence(dest, xcresult).find((item) => item.item === "no reader data");
    assert.equal(privacy?.present, false);
    assert.match(privacy?.detail ?? "", /value/);
  });

  it("names what is missing when the app kept nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "test-evidence-empty-"));
    const dest = join(root, "dest");
    gatherEvidence({
      attachmentsDir: join(root, "no-export"),
      appEvidenceDir: null,
      testIdentifier: TEST,
      dest,
      appLog: () => "",
      fallbackWindow: { start: new Date(0), end: new Date(1) },
    });
    assert.deepEqual(
      checkEvidence(dest, join(root, "absent.xcresult"))
        .filter((item) => !item.present)
        .map((item) => item.item),
      ["xcresult", "screenshot", "dom", "console", "runtime events", "app log"],
    );
  });

  it("writes the failing test's record in the shared schema, naming its files", () => {
    const { root, dest, xcresult } = fixture();
    const record = failureRecord({
      repo: root,
      logRunId: "20260924T120000Z-0a1b2c3d",
      testIdentifier: TEST,
      failureText: "seeded failure: the harness must keep this test's evidence",
      dir: dest,
      xcresultPath: xcresult,
      items: checkEvidence(dest, xcresult),
      now: new Date("2026-09-24T12:02:00.000Z"),
    });
    assert.equal(
      record.evidence?.screenshot,
      "artifacts/test-logs/app-evidence/run/test/screen.png",
    );
    assert.equal(record.evidence?.dom, "artifacts/test-logs/app-evidence/run/test/dom.html");
    assert.deepEqual(record.extra, { missing: [] });
    assert.equal(record.browser, "wkwebview");
  });
});
