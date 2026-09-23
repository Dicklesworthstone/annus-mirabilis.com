/**
 * Every refusal in the photoelectric analysis session, driven by the draft that reaches it.
 *
 * exampleDraft and acceptedExampleAnalysis throw to their caller, so those cases assert the code
 * and message on the error. acceptAnalysisDraft and refitSelectedRows catch and return
 * { kind: "refused", message, code }; the workbench shows the message, and those cases assert both
 * the code and the exact message, which only the named site produces.
 */
import { describe, expect, test } from "bun:test";
import { PhotoelectricRecordError } from "./record.ts";
import {
  acceptAnalysisDraft,
  acceptedExampleAnalysis,
  exampleDraft,
  modernPhotoelectricReference,
  refitSelectedRows,
} from "./session.ts";

const reference = modernPhotoelectricReference();

function refusalFrom(run: () => unknown): PhotoelectricRecordError {
  try {
    run();
  } catch (error) {
    if (error instanceof PhotoelectricRecordError) return error;
    throw new Error(`expected a PhotoelectricRecordError, got ${String(error)}`);
  }
  throw new Error("expected a refusal, and the call returned");
}

function refused(outcome: ReturnType<typeof acceptAnalysisDraft>): {
  code: string | undefined;
  message: string;
} {
  if (outcome.kind !== "refused") throw new Error("expected a refused outcome");
  return { code: outcome.code, message: outcome.message };
}

describe("photoelectric session refusals", () => {
  test("the constructed example is accepted against the modern reference (control)", () => {
    const state = acceptedExampleAnalysis(reference);
    expect(state.source).toBe("constructed-example");
    expect(state.record.rows.length).toBe(5);
  });

  test("example-unknown: an example id that is not constructed", () => {
    const e = refusalFrom(() => exampleDraft("no-such-example"));
    expect(e.code).toBe("example-unknown");
    expect(e.message).toBe("Unknown constructed example.");
  });

  test("example-refused: the constructed example against a reference with no light speed", () => {
    const e = refusalFrom(() => acceptedExampleAnalysis({ ...reference, speedOfLight: 0 }));
    expect(e.code).toBe("example-refused");
    expect(e.message).toBe(
      "Invalid constructed photoelectric example: A declared positive light-speed calibration is required.",
    );
  });

  test("analysis-revision-invalid: a revision below 1", () => {
    expect(refused(acceptAnalysisDraft(exampleDraft(), reference, 0))).toEqual({
      code: "analysis-revision-invalid",
      message: "Invalid analysis revision.",
    });
  });

  test("analysis-label-invalid: a label with a line break", () => {
    const draft = { ...exampleDraft(), label: "two\nlines" };
    expect(refused(acceptAnalysisDraft(draft, reference))).toEqual({
      code: "analysis-label-invalid",
      message: "Use a single-line record label of at most 160 characters.",
    });
  });

  test("analysis-offset-kind-missing: no explicit voltage-offset choice", () => {
    const draft = { ...exampleDraft(), offsetKind: "maybe" as "known" };
    expect(refused(acceptAnalysisDraft(draft, reference))).toEqual({
      code: "analysis-offset-kind-missing",
      message: "Choose the voltage-offset assumption explicitly.",
    });
  });

  test("calibration-not-decimal: a known offset left blank", () => {
    const draft = { ...exampleDraft(), offsetKind: "known" as const, offsetVolts: "" };
    expect(refused(acceptAnalysisDraft(draft, reference))).toEqual({
      code: "calibration-not-decimal",
      message: "Calibration values must be explicit finite decimal numbers; blanks are not zero.",
    });
  });

  test("calibration-not-finite: a known offset that overflows binary64", () => {
    const draft = { ...exampleDraft(), offsetKind: "known" as const, offsetVolts: "1e999" };
    expect(refused(acceptAnalysisDraft(draft, reference))).toEqual({
      code: "calibration-not-finite",
      message: "Calibration values must be finite.",
    });
  });

  test("selection-rows-invalid: excluding the same observation twice", () => {
    const state = acceptedExampleAnalysis(reference);
    expect(refused(refitSelectedRows(state, [1, 1], reference))).toEqual({
      code: "selection-rows-invalid",
      message: "Select only unique observations from the accepted record.",
    });
  });
});
