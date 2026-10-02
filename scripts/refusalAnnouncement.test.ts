/**
 * The deliberate-typed-refusal check's judgement of which live region announces a refusal. The
 * release of 63dc6e43 was refused with "announced by none" on a page that announced it, because the
 * probe read the laboratory root's code rather than the notice inside it.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { refusalAnnouncedBy } from "./refusalAnnouncement.ts";

function doc(body: string): Document {
  const window = new Window();
  window.document.body.innerHTML = body;
  return window.document as unknown as Document;
}

describe("refusalAnnouncedBy", () => {
  test("BM-06 as served on 2026-10-02: the root carries the code, the notice inside is polite", () => {
    const page = doc(
      '<section class="laboratory" data-refusal-code="ftcs-unstable">' +
        '<div class="notice error" aria-live="polite" data-refusal-code="ftcs-unstable"><p>Not accepted.</p></div>' +
        '<p class="execution-currency" role="status" data-refusal-code="ftcs-unstable">Refused</p>' +
        "</section>",
    );
    expect(refusalAnnouncedBy(page)).toBe("polite");
  });

  test("the defect the check exists for still reads none: a notice in no live region", () => {
    const page = doc(
      '<section data-refusal-code="ftcs-unstable">' +
        '<div class="notice error" data-refusal-code="ftcs-unstable"><p>Not accepted.</p></div>' +
        "</section>",
    );
    expect(refusalAnnouncedBy(page)).toBe("none");
  });

  test("a root that marks itself and holds no marked notice is judged as the notice", () => {
    expect(
      refusalAnnouncedBy(doc('<section data-refusal-code="x"><p>Not accepted.</p></section>')),
    ).toBe("none");
    expect(
      refusalAnnouncedBy(
        doc('<div role="alert"><section data-refusal-code="x"><p>No.</p></section></div>'),
      ),
    ).toBe("alert");
  });

  test("no marked element at all is none, never a pass", () => {
    expect(refusalAnnouncedBy(doc("<p>Nothing refused.</p>"))).toBe("none");
  });
});
