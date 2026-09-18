"use client";

import React, { useCallback, useId, useState } from "react";

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
      <abbr
        className="term-annotation"
        data-term-id={termId}
        data-term-expanded={isOpen ? "true" : "false"}
        title={definition || termId}
        lang={lang}
        dir={dir}
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        {text}
      </abbr>
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
