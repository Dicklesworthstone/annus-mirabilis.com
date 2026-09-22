import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import { dayAndMonth, FirstPagesError, loadFirstPages } from "./firstPages.ts";

/**
 * The home page's row of first pages is drawn from the provenance receipts at build time, and each
 * of its three refusals stops the build rather than letting the row draw a guess. Each is driven
 * here by its code, beside a case that passes, against copies of the real receipts.
 */

const RECEIPTS = resolve("docs/provenance");
const FOUR = ["ap-17-132", "ap-17-549", "ap-17-891", "ap-18-639"] as const;

/** A scratch provenance directory holding copies of the named real receipts. */
function receiptsDir(keys: readonly string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "am-first-pages-"));
  for (const key of keys) copyFileSync(join(RECEIPTS, `${key}.md`), join(dir, `${key}.md`));
  return dir;
}

function refusal(run: () => unknown): FirstPagesError {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof FirstPagesError, `expected a FirstPagesError, got ${String(error)}`);
    return error;
  }
  assert.fail("expected a FirstPagesError, and nothing was thrown");
}

describe("firstPages", () => {
  test("a day-precision date reads as day and month; anything else refuses with not-a-day", () => {
    assert.equal(dayAndMonth("1905-03-18"), "18 March");
    assert.equal(dayAndMonth("1905-09-27"), "27 September");
    for (const notADay of ["1905-09", "1905", "1905-09-27T00:00", "27 September 1905"]) {
      assert.equal(refusal(() => dayAndMonth(notADay)).code, "not-a-day", notADay);
    }
  });

  test("the real receipts give the four papers in the order the journal received them", () => {
    const papers = loadFirstPages({ provenanceDir: receiptsDir(FOUR) });
    assert.deepEqual(
      papers.map((p) => [p.key, p.received, p.pages]),
      [
        ["ap-17-132", "1905-03-18", 17],
        ["ap-17-549", "1905-05-11", 12],
        ["ap-17-891", "1905-06-30", 31],
        ["ap-18-639", "1905-09-27", 3],
      ],
    );
  });

  test("a paper whose receipt is missing refuses with missing-receipt", () => {
    const withoutRelativity = receiptsDir(FOUR.filter((key) => key !== "ap-17-891"));
    const error = refusal(() => loadFirstPages({ provenanceDir: withoutRelativity }));
    assert.equal(error.code, "missing-receipt");
    assert.match(error.message, /ap-17-891/);
  });

  test("a receipt whose received date is not day-precision refuses with missing-day-date", () => {
    const dir = receiptsDir(FOUR);
    const file = join(dir, "ap-18-639.md");
    const dayPrecision = 'iso: "1905-09-27"\n      precision: day';
    const original = readFileSync(file, "utf8");
    // The plant is checked, not assumed: an anchor that did not match would leave a valid receipt
    // and the refusal below would never be reached.
    assert.equal(original.split(dayPrecision).length - 1, 1, "the received date was found once");
    writeFileSync(file, original.replace(dayPrecision, 'iso: "1905-09"\n      precision: month'));
    const error = refusal(() => loadFirstPages({ provenanceDir: dir }));
    assert.equal(error.code, "missing-day-date");
    assert.match(error.message, /ap-18-639/);
  });
});
