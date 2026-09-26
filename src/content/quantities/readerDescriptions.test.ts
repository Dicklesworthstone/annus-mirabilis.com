/**
 * The reader descriptions (dispatch 250): content/reader-descriptions/quantities.yaml, loaded and
 * refused by src/content/quantities/readerDescriptions.ts.
 */
import { describe, expect, test } from "bun:test";
import { resolveVoiceContext } from "../checks/voice/contexts.ts";
import { checkVoice } from "../checks/voice/index.ts";
import {
  loadReaderDescriptions,
  parseReaderDescriptions,
  ReaderDescriptionError,
  shorthandIn,
} from "./readerDescriptions.ts";
import { getQuantityRegistry, isRegisteredQuantityId } from "./registry.ts";

const ROOT = process.cwd();

/** The refusal's code, or null where the call does not refuse. */
function refusal(call: () => unknown): string | null {
  try {
    call();
    return null;
  } catch (error) {
    if (error instanceof ReaderDescriptionError) return error.code;
    throw error;
  }
}

describe("reader descriptions", () => {
  test("the repository's file loads: registered ids, readers' sentences, and the voice lint clean", () => {
    const descriptions = loadReaderDescriptions(ROOT, isRegisteredQuantityId);
    expect(descriptions.size).toBeGreaterThan(0);
    const context = resolveVoiceContext("argument", "readings.full[0].text");
    const errors = [...descriptions].flatMap(([id, text]) =>
      checkVoice(text, { context })
        .filter((f) => f.severity === "error")
        .map((f) => `${id}: ${f.rule} "${f.matchedText}"`),
    );
    expect(errors).toEqual([]);
    expect(
      checkVoice("This clearly proved it.", { context }).some((f) => f.severity === "error"),
    ).toBe(true);
  });

  test("an author's note is told from a reader's sentence", () => {
    expect(shorthandIn("The speed of light in empty space.")).toBeUndefined();
    expect(shorthandIn("Distinct from radiationPressureMirror.")).toContain("camelCase");
    expect(shorthandIn("In the modern set R = N_A k_B.")).toContain("underscore");
    expect(shorthandIn("Its twin lives in radiation.yaml.")).toContain("file name");
    expect(shorthandIn("Einstein's printed N binds this id.")).toContain("registry");
    expect(shorthandIn("Paper 2 section 3's fluid column length l.")).toContain("number");
    // The registry's own notes are author's notes, which is why the reader file exists: most are
    // caught, so the check is not one that passes everything.
    const notes = [...getQuantityRegistry().quantities.values()].map((q) => q.description);
    expect(notes.filter((n) => shorthandIn(n) !== undefined).length).toBeGreaterThan(0);
  });

  test("refusals, each by name", () => {
    const registered = (id: string) => id === "speedOfLight";
    // Accept path.
    expect(
      parseReaderDescriptions(
        { quantities: { speedOfLight: " The speed of light in empty space. " } },
        registered,
      ).get("speedOfLight"),
    ).toBe("The speed of light in empty space.");
    // reader-descriptions-invalid-file: no quantities object.
    expect(refusal(() => parseReaderDescriptions({}, registered))).toBe(
      "reader-descriptions-invalid-file",
    );
    expect(refusal(() => parseReaderDescriptions({ quantities: ["x"] }, registered))).toBe(
      "reader-descriptions-invalid-file",
    );
    // reader-description-unknown-quantity: a key that is not a registered id.
    expect(
      refusal(() => parseReaderDescriptions({ quantities: { speedOfLite: "Light." } }, registered)),
    ).toBe("reader-description-unknown-quantity");
    // reader-description-blank: whitespace, or not a string.
    expect(
      refusal(() => parseReaderDescriptions({ quantities: { speedOfLight: "  " } }, registered)),
    ).toBe("reader-description-blank");
    expect(
      refusal(() => parseReaderDescriptions({ quantities: { speedOfLight: 3 } }, registered)),
    ).toBe("reader-description-blank");
    // reader-description-shorthand: an author's note.
    expect(
      refusal(() =>
        parseReaderDescriptions(
          { quantities: { speedOfLight: "The vacuum light speed; see lightSpeedMoving." } },
          registered,
        ),
      ),
    ).toBe("reader-description-shorthand");
  });
});
