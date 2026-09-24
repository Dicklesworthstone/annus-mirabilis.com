import type { NotationNoteTarget } from "./notationNoteTarget.ts";

/**
 * The one line under a formula that keeps today's letters while the reader has chosen Einstein's
 * (am-read-perspective-toggle-abd, ruling (c)): no formula is drawn half in each notation, so a
 * formula whose letters cannot all be read from the concordance says where his are. Shown only in
 * the printed state (equations.css), which is also the state with JavaScript off.
 */
export function NotationNote({ seeAt }: { seeAt?: NotationNoteTarget | undefined }) {
  // Where his letters are, by the face chooser's rule: never a face that shows "not yet available".
  return (
    <p className="fine notation-note" data-notation-note="">
      {seeAt?.face === "german" && seeAt.part ? (
        <>
          Shown in modern letters; Einstein's are in{" "}
          <a href={seeAt.href}>{seeAt.part} of the German source face</a>.
        </>
      ) : seeAt?.face === "german" ? (
        <>
          Shown in modern letters; Einstein's are on the <a href={seeAt.href}>German source face</a>
          .
        </>
      ) : seeAt?.face === "facsimile" ? (
        <>
          Shown in modern letters; Einstein's are in the <a href={seeAt.href}>facsimile</a> of the
          printed paper.
        </>
      ) : (
        "Shown in modern letters."
      )}
    </p>
  );
}
