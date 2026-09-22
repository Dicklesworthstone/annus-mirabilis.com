"use client";

import { useEffect, useId, useState } from "react";
import { EMBED_INSTRUMENTS, embedInstrument, isEmbeddableId, type EmbeddableId } from "../../experiments/embed/catalogue.ts";
import { DEFAULT_EMBED_OPTIONS, EMBED_QUERY_LIMIT, embedMarkup, embedPath, type EmbedOptions } from "../../experiments/embed/contract.ts";
import "./embed.css";

export function EmbedBuilder() {
  const instance = useId();
  const [id, setId] = useState<EmbeddableId | "">("bm-03");
  const [options, setOptions] = useState<EmbedOptions>(DEFAULT_EMBED_OPTIONS);
  const [height, setHeight] = useState("900");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Readonly<{ src: string; title: string; height: number }> | null>(null);
  useEffect(() => {
    const search = window.location.search;
    const query = new URLSearchParams(search);
    if (search.length > EMBED_QUERY_LIMIT || query.getAll("instrument").length > 1 || (query.has("instrument") && !isEmbeddableId(query.get("instrument")))) {
      setId("");
      setNotice("That link does not select an admitted instrument. Choose one from the list; no replacement preview was loaded.");
    } else {
      const selected = query.get("instrument");
      if (isEmbeddableId(selected)) setId(selected);
    }
    setReady(true);
  }, []);
  const instrument = embedInstrument(id);
  const pixels = Number(height);
  const validHeight = height.trim() !== "" && Number.isInteger(pixels) && pixels >= 400 && pixels <= 2000;
  const src = isEmbeddableId(id) ? embedPath(id, options) : "";
  const markup = isEmbeddableId(id) && validHeight ? embedMarkup(id, options, pixels) : "";
  const previewIsCurrent = preview?.src === src && preview.height === pixels;
  async function copy() {
    if (!markup) return;
    try {
      await navigator.clipboard.writeText(markup);
      setNotice("Copied the iframe code. It contains presentation options, not a saved experiment or private notes.");
    } catch {
      setNotice("Clipboard access is unavailable. Select and copy the code in the field below.");
    }
  }
  return (
    <section className="embed-builder" aria-labelledby={`${instance}-title`} data-embed-builder data-ready={String(ready)}>
      <h2 id={`${instance}-title`}>Make an embed</h2>
      <fieldset disabled={!ready} className="embed-builder-settings">
        <legend>Presentation settings</legend>
        <label>Laboratory
          <select value={id} onChange={(event) => {
            const value = event.currentTarget.value;
            if (!isEmbeddableId(value)) return;
            setId(value); setNotice("");
          }}>
            <option value="" disabled>Choose a laboratory</option>
            {EMBED_INSTRUMENTS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label>Theme
          <select value={options.theme} onChange={(event) => {
            const theme = event.currentTarget.value;
            if (theme === "system" || theme === "light" || theme === "dark") setOptions((current) => ({ ...current, theme }));
          }}><option value="system">Follow the device</option><option value="light">Light</option><option value="dark">Dark</option></select>
        </label>
        <label>Initially expanded guide
          <select value={options.detail} onChange={(event) => {
            const detail = event.currentTarget.value;
            if (detail === "overview" || detail === "full" || detail === "steps") setOptions((current) => ({ ...current, detail }));
          }}><option value="overview">Overview</option><option value="full">Full explanation</option><option value="steps">Show every step</option></select>
        </label>
        <label>Motion preference
          <select value={options.motion} onChange={(event) => {
            const motion = event.currentTarget.value;
            if (motion === "system" || motion === "reduce") setOptions((current) => ({ ...current, motion }));
          }}><option value="system">Respect the device preference</option><option value="reduce">Reduce motion</option></select>
        </label>
        <label>Frame height in pixels
          <input type="number" min={400} max={2000} step={1} value={height} aria-invalid={!validHeight} onChange={(event) => setHeight(event.currentTarget.value)} />
        </label>
      </fieldset>
      {!validHeight && <p role="alert">Choose a whole-number height from 400 to 2000 pixels. The existing preview has not changed.</p>}
      <p>All explanation depths remain available. The frame scrolls normally; no resize script, parent-page access, or message bridge is required. Changing these settings does not restart an already loaded preview.</p>
      <div className="embed-builder-actions">
        <button type="button" disabled={!ready || !markup} onClick={copy}>Copy iframe code</button>
        <button type="button" disabled={!ready || !markup || !instrument} onClick={() => {
          if (!instrument || !src || !validHeight) return;
          setPreview({ src, title: instrument.title, height: pixels });
        }}>Load or update preview</button>
        {preview && <button type="button" onClick={() => setPreview(null)}>Close preview</button>}
        {src && <a href={src} target="_blank" rel="noopener noreferrer">Open embed in a new tab</a>}
      </div>
      <label htmlFor={`${instance}-code`}>Iframe code and fallback link</label>
      <textarea id={`${instance}-code`} readOnly rows={11} value={markup} onFocus={(event) => event.currentTarget.select()} spellCheck={false} />
      <p role="status" aria-atomic="true">{notice}</p>
      {preview && <section aria-labelledby={`${instance}-preview`}>
        <h3 id={`${instance}-preview`}>Loaded preview: {preview.title}</h3>
        {!previewIsCurrent && <p className="notice">The preview still uses its previous settings. Choose Load or update preview to replace it.</p>}
        <iframe key={preview.src} src={preview.src} title={`Preview: ${preview.title}`} height={preview.height} referrerPolicy="no-referrer" />
      </section>}
    </section>
  );
}
