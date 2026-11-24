"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { useBrownianSource } from "./BrownianSourceContext.tsx";
import {
  BROWNIAN_GERMAN_SOURCE_HREF,
  extractSourceCompanion,
  followSourceCompanionLink,
} from "./sourceCompanion.ts";

export function BrownianSourcePanel({
  active,
  slot,
}: {
  active: boolean;
  slot?: "column" | "sheet" | undefined;
}) {
  const source = useBrownianSource();
  const id = useId();
  const namespace = `original-${slot ?? "passage"}-${id.replace(/[^a-z0-9_-]/giu, "")}`;
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    if (!source?.source || !source.target) return null;
    return (
      extractSourceCompanion(source.source, source.target.id, document, namespace)?.outerHTML ??
      null
    );
  }, [source?.source, source?.target, namespace]);

  useEffect(() => {
    const content = body.current;
    if (!content || !html) return;
    const follow = (event: MouseEvent) => followSourceCompanionLink(event, content);
    content.addEventListener("click", follow);
    return () => content.removeEventListener("click", follow);
  }, [html]);

  useEffect(() => {
    if (!active || !source?.activation || !root.current) return;
    const sheet = root.current.closest<HTMLDetailsElement>("[data-bottom-sheet]");
    const surface = sheet ?? root.current.closest("[data-reader-companion-column]") ?? root.current;
    if (surface.getClientRects().length === 0) return;
    if (sheet) sheet.open = true;
    surface.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [active, source?.activation]);

  if (!source) return null;
  const unavailable = !!source.source && !!source.target && !html;
  return (
    <section
      ref={root}
      className="brownian-companion-source"
      data-brownian-source-panel={slot ?? "passage"}
      aria-labelledby={`${namespace}-heading`}
    >
      <h2 ref={heading} id={`${namespace}-heading`} tabIndex={-1}>
        Original German
      </h2>
      <p className="fine">
        Choose the printed passage linked to this explanation. Einstein’s wording and letters are
        retained.
      </p>
      <label htmlFor={`${namespace}-passage`}>Reading passage</label>
      <select
        id={`${namespace}-passage`}
        value={source.passage?.id ?? ""}
        onChange={(event) => source.select(event.currentTarget.value)}
      >
        <option value="" disabled>
          Choose a passage
        </option>
        {source.passages
          .filter((passage) => passage.targets.length)
          .map((passage) => (
            <option key={passage.id} value={passage.id}>
              {passage.title}
            </option>
          ))}
      </select>
      {source.passage && source.target ? (
        <>
          <label htmlFor={`${namespace}-source`}>Printed passage</label>
          <select
            id={`${namespace}-source`}
            value={source.target.id}
            onChange={(event) => {
              if (source.passage) source.select(source.passage.id, event.currentTarget.value);
            }}
          >
            {source.passage.targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
          <p className="fine" data-original-context>
            Source for “{source.passage.title}”: {source.target.label}.
          </p>
          <nav className="brownian-source-links" aria-label={`Source pages (${slot ?? "passage"})`}>
            <a href={source.target.germanHref}>Open this passage in the German source</a>
            {source.target.english.map((link) => (
              <a key={link.href} href={link.href}>
                English translation: {link.label}
              </a>
            ))}
          </nav>
        </>
      ) : (
        <p className="fine">
          Use “Show this passage’s original” in the reading, or choose a passage above.
        </p>
      )}
      {source.loading ? (
        <p role="status" className="fine">
          Loading the German source…
        </p>
      ) : null}
      {source.error || unavailable ? (
        <div role="alert" className="notice">
          <p>
            {source.error ??
              "This exact printed passage could not be found in the source page. Open its canonical source link to continue."}
          </p>
          {source.error ? (
            <button type="button" onClick={() => void source.ensureSource()}>
              Try loading the source again
            </button>
          ) : null}
        </div>
      ) : null}
      {html ? (
        <div
          ref={body}
          data-original-body
          // biome-ignore lint/security/noDangerouslySetInnerHtml: extractSourceCompanion keeps only sanitized canonical source, preserving its checked MathML and printed text.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      <p className="fine">
        <a href={BROWNIAN_GERMAN_SOURCE_HREF}>Read the complete German source</a>
      </p>
      {source.returnElement ? (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const origin = source.returnElement;
            if (!origin?.isConnected) return;
            const sheet = root.current?.closest<HTMLDetailsElement>("[data-bottom-sheet]");
            if (sheet) sheet.open = false;
            origin.focus({ preventScroll: true });
          }}
        >
          Return to the reading
        </button>
      ) : null}
    </section>
  );
}
