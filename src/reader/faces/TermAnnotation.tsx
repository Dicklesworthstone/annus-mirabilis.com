"use client";

import type React from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { makeDismissible } from "../../a11y/modal/dismiss.ts";
import { ModalCloseButton } from "../../a11y/modal/ModalCloseButton.tsx";
import { keepNoteInView } from "./keepNoteInView.ts";

export interface TermAnnotationProps {
  readonly termId: string;
  readonly text: string;
  readonly definition?: string | undefined;
  /** The definition's language when it differs from the term's; otherwise the term's is used. */
  readonly definitionLang?: string | undefined;
  readonly lang?: string | undefined;
  readonly dir?: "ltr" | "rtl" | undefined;
}

/**
 * Renders an archaic/period term annotation.
 * Period words carry authored, occurrence-specific definitions longer than 80 characters.
 * Annotations open on activation with keyboard and touch, never as tooltip-only content.
 */
export function TermAnnotation({
  termId,
  text,
  definition,
  definitionLang,
  lang,
  dir,
}: TermAnnotationProps) {
  const [isOpen, setIsOpen] = useState(false);
  // The trigger is a button only JavaScript can work, and the layout hides every enabled button
  // when scripts do not run (components/chrome/noScriptControls.ts). A button carrying a German
  // word would take the word with it: on 2026-09-25 "Relativitätsprinzip" and "Qualitäten" were
  // missing from mass-energy's German column without JavaScript. So the server renders the word as
  // plain text, and the button replaces it once the page has hydrated.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const popoverId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLSpanElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  /*
    The owner's rule for every overlay: an X at the top right, and a tap outside closes it. The
    trigger counts as inside, so its own toggle keeps working; Escape closes too, and focus goes
    back to the term after the X or Escape, not after a tap elsewhere.
  */
  // A note beside a word near the right edge of a phone's column opened off the screen; it is
  // placed inside the viewport before it paints (keepNoteInView.ts).
  useLayoutEffect(() => {
    if (isOpen && popover.current) keepNoteInView(popover.current);
  }, [isOpen]);
  useEffect(() => {
    const panel = popover.current;
    if (!isOpen || !panel) return;
    const dismissal = new AbortController();
    makeDismissible(panel, {
      signal: dismissal.signal,
      isOpen: () => true,
      inside: trigger.current ? [trigger.current] : [],
      closeButton: close.current,
      onDismiss: (reason) => {
        setIsOpen(false);
        if (reason !== "outside") trigger.current?.focus();
      },
    });
    return () => dismissal.abort();
  }, [isOpen]);

  const handleToggle = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle(e);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    },
    [handleToggle, isOpen],
  );

  if (!hydrated)
    return (
      <span className="term-annotation-wrapper" data-term-wrapper={termId}>
        <span className="term-annotation-text" data-term-text={termId} lang={lang} dir={dir}>
          {text}
        </span>
      </span>
    );

  return (
    <span className="term-annotation-wrapper" data-term-wrapper={termId}>
      {/*
        A real <button>, not an <abbr role="button">: the disclosure is then
        announced by the platform instead of an overridden role. handleKeyDown
        stays and keeps calling preventDefault on Enter and Space, which
        suppresses the click the browser would otherwise synthesize, so the
        toggle still fires exactly once. The <abbr> stays inside, carrying the
        expansion in its title, because the term IS a period abbreviation.
      */}
      <button
        ref={trigger}
        type="button"
        className="term-annotation"
        data-term-id={termId}
        data-term-expanded={isOpen ? "true" : "false"}
        lang={lang}
        dir={dir}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <abbr title={definition || termId}>{text}</abbr>
      </button>
      {isOpen && definition && (
        <span
          ref={popover}
          id={popoverId}
          role="dialog"
          aria-label={text}
          className="term-annotation-popover"
          data-term-popover={termId}
        >
          <ModalCloseButton
            ref={close}
            label="Close term definition"
            className="term-annotation-close"
            data-term-close={termId}
          />
          <span className="term-annotation-definition" lang={definitionLang ?? lang} dir={dir}>
            {definition}
          </span>
        </span>
      )}
    </span>
  );
}
