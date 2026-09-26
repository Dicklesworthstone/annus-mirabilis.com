"use client";

import type React from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { makeDismissible } from "../../a11y/modal/dismiss.ts";
import { ModalCloseButton } from "../../a11y/modal/ModalCloseButton.tsx";
import { keepNoteInView } from "./keepNoteInView.ts";

export interface MisprintAnnotationProps {
  readonly recordId: string;
  /** The word as the 1905 page prints it. */
  readonly printed: string;
  /** The word meant, from the receipt record. */
  readonly reading: string;
  /** The record's reasoning, in one sentence. */
  readonly reason: string;
  /** The record's entry in the correction log. */
  readonly href: string;
  readonly lang?: string | undefined;
  readonly dir?: "ltr" | "rtl" | undefined;
}

/**
 * A word the 1905 compositor set wrongly, kept as printed and marked (dispatch 262): "So printed.
 * Read: Elektrodynamischer." The note opens on activation, by keyboard, mouse or touch, never as a
 * tooltip alone (the TermAnnotation pattern).
 *
 * Before the page hydrates, and for a reader without JavaScript, the printed word is a link to its
 * record in the correction log on /sources/, which states the printed and the proposed reading.
 * It is not a button, because the layout hides every enabled button when scripts do not run, and
 * the German word would go with it (see TermAnnotation).
 */
export function MisprintAnnotation({
  recordId,
  printed,
  reading,
  reason,
  href,
  lang,
  dir,
}: MisprintAnnotationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const noteId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  // A note beside a word near the right edge of a phone's column opened off the screen; it is
  // placed inside the viewport before it paints (keepNoteInView.ts).
  useLayoutEffect(() => {
    if (isOpen && note.current) keepNoteInView(note.current);
  }, [isOpen]);
  useEffect(() => {
    const panel = note.current;
    if (!isOpen || !panel) return;
    const dismissal = new AbortController();
    makeDismissible(panel, {
      signal: dismissal.signal,
      isOpen: () => true,
      inside: trigger.current ? [trigger.current] : [],
      closeButton: close.current,
      onDismiss: (why) => {
        setIsOpen(false);
        if (why !== "outside") trigger.current?.focus();
      },
    });
    return () => dismissal.abort();
  }, [isOpen]);

  const toggle = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(e);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    },
    [toggle, isOpen],
  );

  if (!hydrated)
    return (
      <a href={href} data-misprint={recordId} lang={lang} dir={dir}>
        {printed}
      </a>
    );

  return (
    <span className="term-annotation-wrapper" data-misprint={recordId}>
      <button
        ref={trigger}
        type="button"
        className="term-annotation"
        data-misprint-trigger={recordId}
        lang={lang}
        dir={dir}
        aria-expanded={isOpen}
        aria-controls={isOpen ? noteId : undefined}
        aria-label={`${printed}: so printed; read ${reading}`}
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        {printed}
      </button>
      {isOpen && (
        <span
          ref={note}
          id={noteId}
          role="dialog"
          aria-label={`Misprint: ${printed}`}
          className="term-annotation-popover"
          data-misprint-note={recordId}
        >
          <ModalCloseButton
            ref={close}
            label="Close misprint note"
            className="term-annotation-close"
          />
          <span className="term-annotation-definition" lang="en">
            So printed. Read:{" "}
            <i lang={lang} dir={dir}>
              {reading}
            </i>
            . {reason}
          </span>
          <a href={href} lang="en">
            The record in the correction log
          </a>
        </span>
      )}
    </span>
  );
}
