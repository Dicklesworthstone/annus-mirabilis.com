"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import type { DiscoveryPaper } from "../../content/schemas/discovery.ts";
import type { RevisitCaseOption } from "./catalogue.ts";

type Selection = Readonly<{ paper: DiscoveryPaper | "all"; caseId: string | "all" }>;
const ALL: Selection = Object.freeze({ paper: "all", caseId: "all" });
const RevisitSelection = createContext<Selection>(ALL);

/** A saved-question fragment may target a currently hidden case; reveal it before scrolling. */
export function selectionFromHash(
  hash: string,
  cases: readonly RevisitCaseOption[],
): Selection | null {
  let fragment: string;
  try {
    fragment = decodeURIComponent(hash.replace(/^#/u, ""));
  } catch {
    return null;
  }
  const selected = cases.find(
    (item) => fragment === item.id || fragment === `explanation-${item.id}`,
  );
  if (selected) return { paper: selected.paper, caseId: selected.id };
  const paper = cases.find((item) => fragment === `revisit-paper-${item.paper}`)?.paper;
  return paper ? { paper, caseId: "all" } : null;
}

/** Filtering never unmounts an answer box or its saved history. Nothing records a study score. */
export function RevisitBrowser({
  cases,
  children,
}: Readonly<{ cases: readonly RevisitCaseOption[]; children: ReactNode }>) {
  const [selection, setSelection] = useState<Selection>(ALL);
  const [ready, setReady] = useState(false);
  const pendingFragment = useRef<string | null>(null);
  const papers = [...new Map(cases.map((item) => [item.paper, item.paperTitle])).entries()];

  useEffect(() => {
    function followFragment() {
      const selected = selectionFromHash(window.location.hash, cases);
      if (!selected) return;
      pendingFragment.current =
        selected.caseId === "all"
          ? `revisit-paper-${selected.paper}`
          : `explanation-${selected.caseId}`;
      setSelection(selected);
    }
    followFragment();
    setReady(true);
    window.addEventListener("hashchange", followFragment);
    return () => window.removeEventListener("hashchange", followFragment);
  }, [cases]);

  useEffect(() => {
    const fragment = pendingFragment.current;
    if (!fragment) return;
    const visibleTarget =
      selection.caseId === "all"
        ? `revisit-paper-${selection.paper}`
        : `explanation-${selection.caseId}`;
    if (fragment !== visibleTarget) return;
    pendingFragment.current = null;
    document.getElementById(fragment)?.scrollIntoView?.({ block: "start" });
  }, [selection]);

  function choose(next: Selection) {
    setSelection(next);
    const hash =
      next.caseId !== "all"
        ? `#explanation-${next.caseId}`
        : next.paper !== "all"
          ? `#revisit-paper-${next.paper}`
          : "";
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${hash}`,
    );
  }

  const selectedCase = cases.find((item) => item.id === selection.caseId);
  const selectedPaper = papers.find(([paper]) => paper === selection.paper)?.[1];
  return (
    <RevisitSelection.Provider value={selection}>
      <div className="revisit-browser">
        <fieldset
          className="revisit-filters"
          disabled={!ready}
          aria-describedby="revisit-choice-note"
        >
          <legend>Choose an idea to revisit</legend>
          <label>
            Paper
            <select
              name="revisit-paper"
              value={selection.paper}
              onChange={(event) => {
                const paper = papers.find(([id]) => id === event.target.value)?.[0] ?? "all";
                choose({ paper, caseId: "all" });
              }}
            >
              <option value="all">All four papers</option>
              {papers.map(([paper, title]) => (
                <option key={paper} value={paper}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Changed case
            <select
              name="revisit-case"
              value={selection.caseId}
              onChange={(event) => {
                const selected = cases.find((item) => item.id === event.target.value);
                choose(
                  selected
                    ? { paper: selected.paper, caseId: selected.id }
                    : { ...selection, caseId: "all" },
                );
              }}
            >
              <option value="all">All cases in this selection</option>
              {cases
                .filter((item) => selection.paper === "all" || item.paper === selection.paper)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </label>
        </fieldset>
        <p id="revisit-choice-note" className="fine">
          Choose any case, or return to one from your saved discovery notes. Drafts stay in their
          boxes when you change this selection; save what you want to keep before leaving the page.
        </p>
        <p className="fine" role="status" aria-live="polite" aria-atomic="true">
          {selectedCase
            ? `Showing ${selectedCase.paperTitle}: ${selectedCase.title}`
            : selectedPaper
              ? `Showing the changed cases for ${selectedPaper}.`
              : "Showing all changed cases."}
        </p>
        <noscript>
          <p>
            The chooser needs JavaScript. Every case, original example and worked explanation is
            available below.
          </p>
        </noscript>
        {children}
      </div>
    </RevisitSelection.Provider>
  );
}

export function RevisitPaper({
  paper,
  title,
  children,
}: Readonly<{ paper: DiscoveryPaper; title: string; children: ReactNode }>) {
  const selected = useContext(RevisitSelection);
  return (
    <section
      id={`revisit-paper-${paper}`}
      aria-labelledby={`revisit-paper-${paper}-title`}
      hidden={selected.paper !== "all" && selected.paper !== paper}
    >
      <h2 id={`revisit-paper-${paper}-title`}>{title}</h2>
      {children}
    </section>
  );
}

export function RevisitCaseVisibility({
  id,
  children,
}: Readonly<{ id: string; children: ReactNode }>) {
  const selected = useContext(RevisitSelection);
  return (
    <div data-revisit-case={id} hidden={selected.caseId !== "all" && selected.caseId !== id}>
      {children}
    </div>
  );
}
