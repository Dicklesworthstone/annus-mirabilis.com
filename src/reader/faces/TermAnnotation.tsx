import React from "react";

export interface TermAnnotationProps {
  readonly termId: string;
  readonly text: string;
  readonly definition?: string | undefined;
  readonly lang?: string | undefined;
  readonly dir?: "ltr" | "rtl" | undefined;
}

/**
 * Renders an archaic/period term annotation.
 * Displays period vocabulary with accessible title / definition tooltip.
 */
export function TermAnnotation({
  termId,
  text,
  definition,
  lang,
  dir,
}: TermAnnotationProps) {
  return (
    <abbr
      className="term-annotation"
      data-term-id={termId}
      title={definition || termId}
      lang={lang}
      dir={dir}
    >
      {text}
    </abbr>
  );
}
