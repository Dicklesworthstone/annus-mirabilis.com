"use client";

import { type ReactNode, useEffect, useId, useState } from "react";
import { type EmbeddableId, embedInstrument } from "../../experiments/embed/catalogue.ts";
import {
  DEFAULT_EMBED_OPTIONS,
  decodeEmbedOptions,
  type EmbedOptions,
} from "../../experiments/embed/contract.ts";
import { installEmbedPresentation } from "../../experiments/embed/presentation.ts";
import "./embed.css";

/** Children are supplied by the server adapter; this shell imports no physics owner. */
export function EmbedFrame({
  instrumentId,
  children,
}: {
  instrumentId: EmbeddableId;
  children: ReactNode;
}) {
  const id = useId();
  const instrument = embedInstrument(instrumentId);
  const [options, setOptions] = useState<EmbedOptions>(DEFAULT_EMBED_OPTIONS);
  const [invalid, setInvalid] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const decoded = decodeEmbedOptions(window.location.search);
    setReady(true);
    if (decoded.kind === "invalid") {
      setInvalid(decoded.message);
      return;
    }
    setOptions(decoded.options);
    return installEmbedPresentation(
      document.documentElement,
      decoded.options,
      window.matchMedia.bind(window),
    );
  }, []);
  // An address naming no admitted laboratory gets a refusal in words and a way on, not a crash.
  if (!instrument)
    return (
      <article className="embedded-laboratory" data-embed-lab={instrumentId} data-embed-refused="">
        <p className="notice" role="alert">
          This embed does not name a laboratory that can be embedded.{" "}
          <a href="/instruments/" target="_blank" rel="noopener noreferrer">
            See every instrument
          </a>
          .
        </p>
      </article>
    );
  return (
    <article
      className="embedded-laboratory"
      data-embed-lab={instrumentId}
      data-embed-ready={String(ready)}
    >
      <header className="embed-attribution">
        <p className="embed-brand">Annus Mirabilis · Interactive critical edition in preparation</p>
        <h1>{instrument.title}</h1>
        {invalid ? null : <p className="embed-question">{instrument.overview}</p>}
        <nav aria-label="Embedded laboratory context">
          <a href={`/lab/${instrumentId}/`} target="_blank" rel="noopener noreferrer">
            Open the full laboratory in a new tab
          </a>
          <a href={instrument.source} target="_blank" rel="noopener noreferrer">
            Read the source context in a new tab
          </a>
        </nav>
      </header>
      {invalid ? (
        <section className="notice" role="alert" data-embed-invalid>
          <h2>This embed link needs attention</h2>
          <p>{invalid}</p>
          <p>
            <a href={`/embed/lab/${instrumentId}/`}>Open a clean worked example</a>
            {" · "}
            <a
              href={`/embed/?instrument=${instrumentId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Generate a current embed
            </a>
          </p>
        </section>
      ) : (
        <>
          <noscript>
            <p className="notice">
              JavaScript is off. The built worked example and all explanations remain readable.
              Interactive controls and URL presentation options require JavaScript.
            </p>
          </noscript>
          {/* The instrument comes first: an embed sits inside someone else's lesson, usually in a
              short frame, and the question above it is the one line a reader needs to start. */}
          <div className="embed-instrument lab-route">{children}</div>
          <section className="embed-guidance" aria-labelledby={`${id}-guidance`}>
            <h2 id={`${id}-guidance`}>The explanation</h2>
            <details open={options.detail === "full" || options.detail === "steps"}>
              <summary>Full explanation</summary>
              <p>{instrument.full}</p>
            </details>
            <details open={options.detail === "steps"}>
              <summary>Show every step of the investigation</summary>
              <p>{instrument.steps}</p>
            </details>
            <p className="notice">
              An explanatory model, not an observation of nature. This embed starts from the
              laboratory’s worked defaults, not a saved run. Presentation options change the
              surrounding guide, never the numerical inputs.
            </p>
          </section>
        </>
      )}
      <footer className="embed-attribution">
        <p>
          Calculations, assumptions and limits belong to the laboratory shown above. The full
          edition supplies the surrounding argument and source material.
        </p>
        <p>
          <a href="/" target="_blank" rel="noopener noreferrer">
            Annus Mirabilis
          </a>
          {" · "}
          <a href="/your-data/" target="_blank" rel="noopener noreferrer">
            What the edition stores
          </a>
          {" · "}
          <a
            href="https://github.com/Dicklesworthstone/annus-mirabilis.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source code
          </a>
        </p>
      </footer>
    </article>
  );
}
