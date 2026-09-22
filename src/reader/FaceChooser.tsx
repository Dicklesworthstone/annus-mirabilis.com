/**
 * The reading-face chooser, extracted from FaceFallback so a face that HAS content can
 * carry it too (am-r3qt follow-on, pane28).
 *
 * WHY THIS EXISTS AS A COMPONENT. Measured on the built site: a face page with real
 * content was a dead end. `/papers/brownian-motion/view/german/` holds 23,626
 * characters of German - the largest body of primary source on this site - and had
 * exactly two nav landmarks, the site header and the footer. No face chooser, no link
 * back to the paper. Meanwhile `/view/english/`, a 1,267-character stub, carried the
 * full eight-item chooser, because stubs are rendered by FaceFallback and real faces
 * are not.
 *
 * The cause is structural rather than an oversight: PaperPage early-returns a face
 * component as the WHOLE page, and each face renders its own
 * `<div data-reader-root>` and its own `page-intro` header. A chooser cannot be
 * wrapped around that from outside without landing outside `reader-root`, which owns
 * the harness's data-ready contract and the `.reader-root` CSS scope. So the chooser
 * has to be emitted INSIDE each face, after its header, and this is the one component
 * all of them can call.
 *
 * LABELS COME FROM FACE_REGISTRY, never from a literal here. The site already carries
 * two vocabularies for the same faces - the paper page's ReaderController says
 * "Source status" and "Original scan" where the registry says "German source" and
 * "Facsimile" - and a third spelling would be worse than either. Reconciling those two
 * is a copy decision and is deliberately not made here.
 */

import { FACE_REGISTRY, type FaceId } from "./faces/registry.ts";
import { FACE_FALLBACK_IDS, faceLinkHref } from "./paperRoutes.ts";

export function FaceChooser({
  paperId,
  section,
  current,
}: {
  readonly paperId: string;
  readonly section?: string | undefined;
  /** The face being displayed, marked `aria-current="page"`. */
  readonly current?: FaceId | undefined;
}) {
  return (
    <nav className="reader-controls" aria-label="Reading face">
      <a
        href={faceLinkHref(paperId, "reading", section)}
        data-view-link="reading"
        aria-current={current === "reading" ? "page" : undefined}
      >
        Explanation
      </a>
      {FACE_FALLBACK_IDS.map((id) => (
        <a
          key={id}
          href={faceLinkHref(paperId, id, section)}
          data-view-link={id}
          aria-current={id === current ? "page" : undefined}
        >
          {FACE_REGISTRY[id].label}
        </a>
      ))}
    </nav>
  );
}
