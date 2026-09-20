"use client";

import type React from "react";
import { useCallback, useId, useState } from "react";

export interface TermAnnotationProps {
  readonly termId: string;
  readonly text: string;
  readonly definition?: string | undefined;
  readonly lang?: string | undefined;
  readonly dir?: "ltr" | "rtl" | undefined;
}

/**
 * Renders an archaic/period term annotation.
 * Period words carry authored, occurrence-specific definitions longer than 80 characters.
 * Annotations open on activation with keyboard and touch, never as tooltip-only content.
 */
export function TermAnnotation({ termId, text, definition, lang, dir }: TermAnnotationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = useId();

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
          id={popoverId}
          role="dialog"
          aria-label={text}
          className="term-annotation-popover"
          data-term-popover={termId}
        >
          <span className="term-annotation-definition" lang={lang} dir={dir}>
            {definition}
          </span>
          <button
            type="button"
            className="term-annotation-close"
            data-term-close={termId}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            aria-label="Close term definition"
          >
            ×
          </button>
        </span>
      )}
    </span>
  );
}
