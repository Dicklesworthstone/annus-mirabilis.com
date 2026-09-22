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

import type { FaceAvailability } from "./faceAvailability.ts";
import { FACE_REGISTRY, type FaceId } from "./faces/registry.ts";
import { FACE_FALLBACK_IDS, faceLinkHref } from "./paperRoutes.ts";

export function FaceChooser({
  paperId,
  section,
  current,
  availability,
}: {
  readonly paperId: string;
  readonly section?: string | undefined;
  /** The face being displayed, marked `aria-current="page"`. */
  readonly current?: FaceId | undefined;
  /**
   * Derived, never authored (routed 2026-09-22). Faces reported `empty` are still
   * LINKS - the page behind them explains what is missing and offers the explanation
   * instead, which is more use than a disabled control - but they are marked, so the
   * chooser stops offering eight equal doors when four of them are stubs. A face
   * whose availability is `unknown`, or absent from the table, is left unmarked:
   * facsimile cannot be decided without hashing a multi-megabyte PDF, and guessing
   * would claim a scan nobody verified.
   */
  readonly availability?: Readonly<Partial<Record<FaceId, FaceAvailability>>> | undefined;
}) {
  const mark = (id: FaceId) =>
    availability?.[id] === "empty" ? <span className="face-state"> · not set yet</span> : null;
  /*
    TABS FOR THE FACES THAT HAVE SOMETHING, AND ONE LINE FOR THE ONES THAT DO NOT. Eight equal
    links, three of them "not set yet", wrapped into three rows on a phone and read as a list of
    doors. A face reported empty is still a link - its page says what is missing - but it sits
    in a quiet line after the tabs rather than posing as one, unless it is the face on screen,
    which is always a tab.
  */
  const pending = FACE_FALLBACK_IDS.filter(
    (id) => availability?.[id] === "empty" && id !== current,
  );
  const tabs = FACE_FALLBACK_IDS.filter((id) => !pending.includes(id));
  return (
    <nav className="reader-controls" aria-label="Reading face">
      <div className="face-tabs">
        <a
          href={faceLinkHref(paperId, "reading", section)}
          data-view-link="reading"
          aria-current={current === "reading" ? "page" : undefined}
        >
          Explanation
        </a>
        {tabs.map((id) => (
          <a
            key={id}
            href={faceLinkHref(paperId, id, section)}
            data-view-link={id}
            aria-current={id === current ? "page" : undefined}
            data-face-state={availability?.[id] ?? undefined}
          >
            {FACE_REGISTRY[id].label}
            {mark(id)}
          </a>
        ))}
      </div>
      {pending.length > 0 ? (
        <p className="face-pending fine">
          Not yet available:{" "}
          {pending.map((id, i) => (
            <span key={id}>
              {i > 0 ? " · " : null}
              <a
                href={faceLinkHref(paperId, id, section)}
                data-view-link={id}
                data-face-state="empty"
              >
                {FACE_REGISTRY[id].label}
              </a>
            </span>
          ))}
        </p>
      ) : null}
    </nav>
  );
}
