"use client";

import { useId, useState } from "react";
import {
  adjacentTourPosition, decodeTourPosition, leaveTourHref, resolveTourPosition,
  tourDestination, tourMatchesPath, tourOutline, tourPosition,
} from "./navigation.ts";
import "./tours.css";

/** Navigation only: no simulation state, answer collection, storage, timer or network service. */
export default function ActiveTourGuide({ pathname, search, compact = false }: { pathname: string; search: string; compact?: boolean }) {
  const id = useId();
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const decoded = decodeTourPosition(search);
  if (dismissed || decoded.kind === "absent") return null;

  function leave() {
    // Read the current URL at the action, not the render: a laboratory may have changed its
    // own parameters or fragment since the guide mounted. Do not reload and reset its state.
    const url = new URL(window.location.href);
    window.history.replaceState(window.history.state, "", leaveTourHref(url.pathname, url.search, url.hash));
    setDismissed(true);
  }

  if (decoded.kind === "invalid") {
    if (compact) return null;
    return (
      <aside className="guided-tour-guide" aria-label="Guided reading link needs attention" data-tour-error>
        <p>{decoded.message} The paper or experiment below remains available.</p>
        <div className="guided-tour-actions">
          <a href="/tours/">Choose a current guided route</a>
          <button type="button" onClick={leave}>Remove tour from this page</button>
        </div>
      </aside>
    );
  }

  const position = decoded.position;
  const selected = resolveTourPosition(position);
  if (!selected) return null;
  const { tour, stop, index } = selected;
  const destination = tourDestination(position);

  if (!tourMatchesPath(position, pathname)) {
    if (compact) return null;
    return (
      <aside className="guided-tour-guide" aria-label="Return to your guided reading stop" data-tour-detour>
        <p>This page is not the bookmarked stop, “{stop.title}”. The guide has not advanced.</p>
        <div className="guided-tour-actions">
          <a href={destination}>Return to {stop.title}</a>
          <a href={tourOutline(position)}>Open the route outline</a>
          <button type="button" onClick={leave}>Leave the guided route</button>
        </div>
      </aside>
    );
  }

  const previous = adjacentTourPosition(position, -1);
  const next = adjacentTourPosition(position, 1);
  const first = tour.stops[0];

  if (compact) {
    return (
      <nav className="guided-tour-guide guided-tour-actions" aria-label="Continue guided reading after this page">
        <span>Stop {index + 1} of {tour.stops.length}: {stop.title}</span>
        {previous && <a href={tourDestination(previous)}>Previous stop</a>}
        {next ? <a href={tourDestination(next)}>Next stop</a> : <a href={`/tours/${tour.id}/#tour-finish`}>Finish this route</a>}
        <a href={tourOutline(position)}>Return to the route outline</a>
      </nav>
    );
  }

  async function copyPosition() {
    const url = new URL(destination, window.location.origin).href;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setNotice("Copied this reading position. It contains no notes, answers or experiment settings.");
    } catch {
      setNotice("Copying is unavailable. Use the bookmark link below, or copy its address from your browser.");
    }
  }

  return (
    <aside className="guided-tour-guide" aria-labelledby={`${id}-title`} data-guided-tour={tour.id} data-tour-stop={stop.id}>
      <p className="eyebrow">Guided reading · Stop {index + 1} of {tour.stops.length}</p>
      <h2 id={`${id}-title`}>{stop.title}</h2>
      <p>{stop.task}</p>
      <p><strong>Consider:</strong> {stop.question}</p>
      <details>
        <summary>Read the explanation at any time</summary>
        <p>{stop.explanation}</p>
      </details>
      <nav className="guided-tour-actions" aria-label="Guided reading navigation">
        {previous && <a href={tourDestination(previous)}>Previous stop</a>}
        {next ? <a href={tourDestination(next)}>Next stop</a> : <a href={`/tours/${tour.id}/#tour-finish`}>Finish this route</a>}
        <a href={tourOutline(position)}>All stops: {tour.title}</a>
        <a href="#main">Continue with the paper or experiment</a>
      </nav>
      <details>
        <summary>Pause, bookmark or leave this route</summary>
        <p>
          This is a reading position, not a score. There is no timer or automatic progress record.
          Bookmark the link to resume this stop on another visit. It opens the stop's authored
          starting location, not a saved simulation or private notebook.
        </p>
        <div className="guided-tour-actions">
          <a href={destination}>Bookmark or resume this stop</a>
          <button type="button" onClick={copyPosition}>Copy reading-position link</button>
          {first && <a href={tourDestination(tourPosition(tour, first))}>Restart from the first stop</a>}
          <button type="button" onClick={leave}>Leave tour, keep this page</button>
        </div>
        <p role="status" aria-atomic="true">{notice}</p>
      </details>
    </aside>
  );
}
