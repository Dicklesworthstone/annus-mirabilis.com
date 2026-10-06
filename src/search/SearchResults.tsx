"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SEARCH_LIMITS, SEARCH_TYPES, type SearchHit, searchResultHref } from "./core.ts";
import type { LoadedSearch } from "./loadIndex.ts";
import { EMPTY_SEARCH, type SearchLocation, readSearchLocation, searchResultsHref } from "./searchLocation.ts";
import { TYPE_LABELS } from "./typeLabels.ts";
import "./search.css";
import "./searchResults.css";

// The verified index is loaded only for an actual search, not while statically rendering the page.
const loadSearch = () => import("./loadIndex.ts").then((module) => module.searchIndexLoader.load());

export function SearchResults({ load = loadSearch }: { load?: () => Promise<LoadedSearch> }) {
  const [criteria, setCriteria] = useState<SearchLocation>(EMPTY_SEARCH);
  const [papers, setPapers] = useState<readonly string[]>([]);
  const [hits, setHits] = useState<readonly SearchHit[]>([]);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<SearchLocation | null>(null);
  const alive = useRef(false);
  const generation = useRef(0);

  const search = useCallback(async (value: SearchLocation) => {
    const ticket = ++generation.current;
    setHits([]);
    setSubmitted(null);
    setError("");
    if (!value.query.trim()) {
      setPhase("idle");
      return;
    }
    if (!searchResultsHref(value)) {
      setError("This query or filter is not supported. Shorten the query or clear the filters.");
      setPhase("error");
      return;
    }
    setPhase("loading");
    try {
      const loaded = await load();
      // Typing, another search, a restored link or unmount invalidates the old request.
      if (!alive.current || ticket !== generation.current) return;
      setPapers(loaded.papers);
      setHits(loaded.engine.search(value.query, {
        ...(value.paper ? { paper: value.paper } : {}),
        ...(value.type ? { type: value.type } : {}),
        limit: SEARCH_LIMITS.results,
      }));
      setSubmitted(value);
      setPhase("ready");
    } catch {
      if (!alive.current || ticket !== generation.current) return;
      setError("The search index could not load. Try Search again, or browse the complete index below.");
      setPhase("error");
    }
  }, [load]);

  useEffect(() => {
    alive.current = true;
    const restore = () => {
      ++generation.current;
      setHits([]);
      setSubmitted(null);
      const restored = readSearchLocation(window.location.hash);
      if (!restored) {
        setCriteria(EMPTY_SEARCH);
        setError("This search link is invalid. Enter a new query; no filters have been silently discarded.");
        setPhase("error");
        return;
      }
      setCriteria(restored);
      void search(restored);
    };
    restore();
    window.addEventListener("hashchange", restore);
    return () => {
      alive.current = false;
      ++generation.current;
      window.removeEventListener("hashchange", restore);
    };
  }, [search]);

  function edit(next: SearchLocation) {
    ++generation.current;
    setCriteria(next);
    setHits([]);
    setSubmitted(null);
    setError("");
    setPhase("idle");
  }

  const shareHref = submitted ? searchResultsHref(submitted) : null;
  const status = phase === "loading"
    ? "Loading the search index…"
    : phase === "error"
      ? error
      : phase === "ready"
        ? hits.length
          ? `${hits.length} result${hits.length === 1 ? "" : "s"} shown${hits.length === SEARCH_LIMITS.results ? "; narrow the query or filters for more specific matches" : ""}.`
          : "Nothing matches. Try fewer words, remove quotation marks, or clear the filters."
        : "Enter words, names, symbols or a quoted passage, then choose Search.";

  return (
    <div className="search-page-field-wrap full-search">
      {/* No named form controls: a pre-hydration/native submit must not send the query to a server. */}
      <form role="search" action="/search/results/" onSubmit={(event) => {
        event.preventDefault();
        void search(criteria);
      }} aria-label="Search the edition">
        <label htmlFor="edition-search-query">Words, names, symbols or a passage</label>
        <input id="edition-search-query" type="search" value={criteria.query}
          maxLength={SEARCH_LIMITS.queryCharacters} autoComplete="off" spellCheck={false}
          aria-describedby="edition-search-help" required
          onChange={(event) => edit({ ...criteria, query: event.target.value })} />
        <p id="edition-search-help" className="fine">
          Use double quotes for adjacent words, such as “mean square”. Spelling and symbol variants
          still match; quoted words are not expanded or typo-corrected.
        </p>
        <div className="full-search-filters">
          <label htmlFor="edition-search-paper">Paper or collection
            <select id="edition-search-paper" value={criteria.paper}
              onChange={(event) => edit({ ...criteria, paper: event.target.value })}>
              <option value="">All papers and collections</option>
              {criteria.paper && !papers.includes(criteria.paper) &&
                <option value={criteria.paper}>{criteria.paper.replaceAll("-", " ")}</option>}
              {papers.map((paper) => <option key={paper} value={paper}>
                {paper.replaceAll("-", " ")}
              </option>)}
            </select>
          </label>
          <label htmlFor="edition-search-type">Result type
            <select id="edition-search-type" value={criteria.type}
              onChange={(event) => edit({ ...criteria, type: event.target.value as SearchLocation["type"] })}>
              <option value="">All result types</option>
              {SEARCH_TYPES.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
            </select>
          </label>
        </div>
        <div className="full-search-actions">
          <button type="submit">Search</button>
          {(criteria.paper || criteria.type) && <button type="button" className="secondary"
            onClick={() => {
              const next = { ...criteria, paper: "", type: "" } as const;
              setCriteria(next);
              void search(next);
            }}>Clear filters and search</button>}
        </div>
      </form>
      <p className="fine">
        Matching happens on this device. Queries are not sent to the server or saved as a search
        history. A link you deliberately share includes the query and filters.
      </p>
      <p role="status" aria-live="polite" aria-atomic="true">{status}</p>
      {shareHref && <p><a href={shareHref}>Link to this search (includes query and filters)</a></p>}
      <section aria-label="Search results" aria-busy={phase === "loading"}>
        <ol className="full-search-results">
          {hits.map((hit) => <li key={hit.document.id}>
            <h2><a href={searchResultHref(hit.document)}>{hit.document.title}</a></h2>
            <p className="fine">
              {TYPE_LABELS[hit.document.type]} · {hit.document.scopeLabel}
              {hit.document.lang === "de" ? " · German" : ""}
              {hit.aliasLabel ? ` · ${hit.aliasLabel}` : ""}
            </p>
            <p lang={hit.document.lang}>{hit.snippet}</p>
          </li>)}
        </ol>
      </section>
    </div>
  );
}
