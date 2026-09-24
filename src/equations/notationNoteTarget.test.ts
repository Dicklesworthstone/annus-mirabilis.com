/**
 * The note under a formula in today's letters never names a face that has nothing in it
 * (dispatch 138): the German face only when it renders text, else the pinned facsimile.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paperSourceFaces } from "../reader/paperSourceFaces.ts";
import { notationNoteTarget } from "./notationNoteTarget.ts";
import type { CompiledEquation } from "./viewTypes.ts";

describe("notationNoteTarget", () => {
  const base = { paperId: "special-relativity", germanFragment: "#s3" };
  test("the German face, at the formula's section, when it renders text", () => {
    expect(notationNoteTarget({ ...base, germanAvailable: true, pdfHref: "/p.pdf" })).toEqual({
      face: "german",
      href: "/papers/special-relativity/view/german/#s3",
    });
  });
  test("the facsimile when the German face has nothing, and nothing when neither exists", () => {
    expect(notationNoteTarget({ ...base, germanAvailable: false, pdfHref: "/p.pdf" })).toEqual({
      face: "facsimile",
      href: "/p.pdf",
    });
    expect(notationNoteTarget({ ...base, germanAvailable: false, pdfHref: null })).toBeUndefined();
  });
});

describe("the built relativity payload", () => {
  test("every formula in today's letters names the face the chooser says has text", async () => {
    const payload = JSON.parse(
      readFileSync(join(process.cwd(), "src/generated/special-relativity-equations.json"), "utf8"),
    ) as { equations: CompiledEquation[] };
    const held = payload.equations.flatMap((e) =>
      e.notationForm?.state === "modern" ? [e.notationForm] : [],
    );
    // Not vacuous: relativity has formulas that keep today's letters.
    expect(held.length).toBeGreaterThan(0);
    const german = (await paperSourceFaces("special-relativity")).availability.german;
    for (const form of held) {
      expect(form.seeAt?.face).toBe(german === "available" ? "german" : "facsimile");
      if (form.seeAt?.face === "facsimile")
        expect(form.seeAt.href).toBe("/papers/pdfs/ap-17-891.pdf");
    }
  });
});
