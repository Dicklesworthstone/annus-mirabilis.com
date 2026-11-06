"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { SEARCH_NAVIGATION_EVENT } from "../../search/searchNavigation.ts";
import {
  DEFAULT_DESK_FILTER,
  type DeskFilter,
  type DeskFilterEntry,
  matchesDeskFilter,
} from "./model.ts";

export function revealDeskCard(root: HTMLElement, hash: string): boolean {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return false;
  }
  const target = root.ownerDocument.getElementById(id);
  if (!target || !root.contains(target)) return false;
  const row = target.closest<HTMLElement>("[data-desk-entry]");
  if (!row) return false;
  const wasHidden = row.hidden;
  row.hidden = false;
  if (target.tagName === "DETAILS") (target as HTMLDetailsElement).open = true;
  return wasHidden;
}

export function applyDeskFilter(
  root: HTMLElement,
  entries: readonly DeskFilterEntry[],
  filter: DeskFilter,
): number {
  let count = 0;
  for (const entry of entries) {
    const row = root.ownerDocument.getElementById(`desk-entry-${entry.id}`);
    if (!row || !root.contains(row)) continue;
    const show = matchesDeskFilter(entry, filter);
    row.hidden = !show;
    if (show) count++;
  }
  return count;
}

/** The full catalogue is server HTML. Filtering never fetches, persists, or replaces its cards. */
export function DeskCatalogueFilters({
  entries,
  objects,
}: {
  entries: readonly DeskFilterEntry[];
  objects: readonly Readonly<{ id: string; title: string }>[];
}) {
  const id = useId();
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_DESK_FILTER);
  const [applied, setApplied] = useState(DEFAULT_DESK_FILTER);
  const [count, setCount] = useState(entries.length);
  const [error, setError] = useState("");
  useEffect(() => {
    setReady(true);
    const root = document.getElementById("desk-catalogue-list");
    if (!root) return;
    const reveal = (href: string) => {
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (
        url.origin !== window.location.origin ||
        url.pathname !== window.location.pathname ||
        url.search !== window.location.search
      )
        return;
      if (revealDeskCard(root, url.hash)) {
        setDraft(DEFAULT_DESK_FILTER);
        setApplied(DEFAULT_DESK_FILTER);
        setError("");
      }
    };
    const hash = () => reveal(window.location.href);
    const search = (event: Event) => {
      const href = (event as CustomEvent<{ href?: unknown }>).detail?.href;
      if (typeof href === "string") reveal(href);
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (anchor?.hasAttribute("download") || (anchor?.target && anchor.target !== "_self")) return;
      if (anchor) reveal(anchor.href);
    };
    hash();
    window.addEventListener("hashchange", hash);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, search);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener(SEARCH_NAVIGATION_EVENT, search);
      document.removeEventListener("click", click);
      applyDeskFilter(root, entries, DEFAULT_DESK_FILTER);
    };
  }, [entries]);
  useEffect(() => {
    const root = document.getElementById("desk-catalogue-list");
    if (root) setCount(applyDeskFilter(root, entries, applied));
  }, [entries, applied]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      [draft.from, draft.to].some(
        (year) => year !== "" && (!/^\d{1,4}$/.test(year) || Number(year) < 1),
      )
    ) {
      setError(
        "Use a whole year from 1 to 9999, or leave the limit blank. The previous filter remains applied.",
      );
      return;
    }
    if (draft.from && draft.to && Number(draft.from) > Number(draft.to)) {
      setError(
        "The first year must be no later than the last. The previous filter remains applied.",
      );
      return;
    }
    setError("");
    setApplied(draft);
  }
  return (
    <form
      className="desk-catalogue-filters"
      hidden={!ready}
      onSubmit={submit}
      aria-label="Filter the 1904 knowledge catalogue"
    >
      <fieldset>
        <legend>Find a premise</legend>
        <div className="desk-filter-fields">
          <div className="desk-filter-field">
            <label htmlFor={`${id}-object`}>Object</label>
            <select
              id={`${id}-object`}
              name="object"
              value={draft.object}
              onChange={(e) => setDraft({ ...draft, object: e.target.value })}
            >
              <option value="all">Every object</option>
              {objects.map((object) => (
                <option value={object.id} key={object.id}>
                  {object.title}
                </option>
              ))}
            </select>
          </div>
          <div className="desk-filter-field">
            <label htmlFor={`${id}-status`}>Availability</label>
            <select
              id={`${id}-status`}
              name="status"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              <option value="all">Available and flagged parallel work</option>
              <option value="available">Available by the end of 1904</option>
              <option value="parallel-work">Parallel work only</option>
            </select>
          </div>
          <div className="desk-filter-field">
            <label htmlFor={`${id}-from`}>From year</label>
            <input
              id={`${id}-from`}
              name="from"
              type="text"
              inputMode="numeric"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              placeholder="Any"
            />
          </div>
          <div className="desk-filter-field">
            <label htmlFor={`${id}-to`}>Through year</label>
            <input
              id={`${id}-to`}
              name="to"
              type="text"
              inputMode="numeric"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              placeholder="Any"
            />
          </div>
        </div>
        <p className="fine">
          Date limits include overlapping date ranges. Applying a filter does not change the
          historical status of a card.
        </p>
        <div className="desk-filter-actions">
          <button type="submit">Apply filters</button>
          <button
            type="button"
            onClick={() => {
              setDraft(DEFAULT_DESK_FILTER);
              setApplied(DEFAULT_DESK_FILTER);
              setError("");
            }}
          >
            Show all cards
          </button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <p role="status">
          Showing {count} of {entries.length} cards.
          {count === 0
            ? " No cards match these filters. Widen the dates or choose another object."
            : ""}
        </p>
      </fieldset>
    </form>
  );
}
