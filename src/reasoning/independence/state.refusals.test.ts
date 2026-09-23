/**
 * Every refusal of what a reader types or links into the independence workbench, driven through
 * its real site (am-muyh's bare-throw ratchet; dispatch 92). Each case asserts the code AND the
 * message. Link refusals are caught inside decodeOccupancyLink and returned as
 * { kind: "invalid", message, code }, so those cases read the code off the returned value.
 */
import { describe, expect, test } from "bun:test";
import {
  decodeOccupancyLink,
  illustrativeOccupancyRecord,
  OCCUPANCY_LINK_LIMIT,
  OCCUPANCY_TEXT_LIMIT,
  OccupancyInputError,
  parseOccupancyHistogram,
} from "./state.ts";

function refusalFrom(run: () => unknown): OccupancyInputError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(OccupancyInputError);
    return error as OccupancyInputError;
  }
  throw new Error("expected an OccupancyInputError, and nothing was thrown");
}

function invalidLink(search: string): { message: string; code: string } {
  const decoded = decodeOccupancyLink(search);
  if (decoded.kind !== "invalid") throw new Error(`expected an invalid link, got ${decoded.kind}`);
  return decoded;
}

describe("independence workbench input refusals", () => {
  test("record-text-invalid: a blank record and one over the length limit are refused", () => {
    for (const text of ["   ", "1 ".repeat(OCCUPANCY_TEXT_LIMIT)]) {
      const error = refusalFrom(() => parseOccupancyHistogram(text, 4));
      expect(error.code).toBe("record-text-invalid");
      expect(error.message).toBe(
        `Enter a frequency record of at most ${OCCUPANCY_TEXT_LIMIT} characters.`,
      );
    }
  });

  test("record-frequency-count-mismatch: four points need five whole-number frequencies", () => {
    for (const text of ["1 2 3", "1, 2, x, 4, 5"]) {
      const error = refusalFrom(() => parseOccupancyHistogram(text, 4));
      expect(error.code).toBe("record-frequency-count-mismatch");
      expect(error.message).toBe(
        "Enter exactly 5 nonnegative whole-number frequencies, in order from zero inside to 4 inside. Use commas or spaces; do not omit empty bins.",
      );
    }
    expect(parseOccupancyHistogram("1, 4, 6, 4, 1", 4)).toEqual([1, 4, 6, 4, 1]);
  });

  test("illustrative-record-unknown: only the two constructed records exist", () => {
    const error = refusalFrom(() =>
      illustrativeOccupancyRecord("random" as unknown as "mixed" | "all-or-none"),
    );
    expect(error.code).toBe("illustrative-record-unknown");
    expect(error.message).toBe("Unknown illustrative record.");
  });

  test("link-too-long: a link over the limit is refused", () => {
    const link = invalidLink(`?occupancy=1&n=4&q=2&checks=${"x".repeat(OCCUPANCY_LINK_LIMIT)}`);
    expect(link.code).toBe("link-too-long");
    expect(link.message).toBe("The occupancy link is too long.");
  });

  test("link-fields-invalid: a repeated field or an unknown version is refused", () => {
    for (const search of [
      "?occupancy=1&occupancy=1&n=4&q=2&checks=",
      "?occupancy=2&n=4&q=2&checks=",
    ]) {
      const link = invalidLink(search);
      expect(link.code).toBe("link-fields-invalid");
      expect(link.message).toBe(
        "The occupancy link has missing, repeated or unsupported version fields.",
      );
    }
  });

  test("link-settings-invalid: a zero point count or five quarters is refused", () => {
    for (const search of ["?occupancy=1&n=0&q=2&checks=", "?occupancy=1&n=4&q=5&checks="]) {
      const link = invalidLink(search);
      expect(link.code).toBe("link-settings-invalid");
      expect(link.message).toBe("The occupancy link has invalid point-count or volume fields.");
    }
  });

  test("link-check-unknown: a measurement the model does not know is refused", () => {
    const link = invalidLink("?occupancy=1&n=4&q=2&checks=mean-count,bogus");
    expect(link.code).toBe("link-check-unknown");
    expect(link.message).toBe("The occupancy link names an unknown measurement.");
  });

  test("a valid link still decodes to its settings", () => {
    const decoded = decodeOccupancyLink("?occupancy=1&n=4&q=2&checks=mean-count");
    expect(decoded).toEqual({
      kind: "settings",
      settings: { n: 4, quarters: 2 },
      checks: ["mean-count"],
    });
  });
});
