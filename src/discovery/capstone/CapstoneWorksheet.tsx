"use client";

import { useEffect, useId, useRef, useState } from "react";
import { dependencyFeedback } from "../shared/dependencyFeedback.ts";
import { ReorderList } from "../shared/ReorderList.tsx";
import type { Capstone } from "./capstoneSchema.ts";
import {
  assumptionFeedback,
  emptyWorksheet,
  exportWorksheet,
  markAssumption,
  readWorksheet,
  WORKSHEET_LIMITS,
  type WorksheetState,
  worksheetMatches,
} from "./worksheetState.ts";

export type WorksheetEquation = Readonly<{
  equationId: string;
  title: string;
  purpose: string;
  spoken: string;
  html: string;
  href: string;
}>;
export type WorksheetInstrument = Readonly<{
  id: string;
  href: string;
  tapeHref: string | null;
  purpose: string;
  lookFor: readonly string[];
}>;

/** Optional private work, separate from the edition's authored claims and source text. */
export function CapstoneWorksheet({ capstone, equations, instruments }: Readonly<{
  capstone: Capstone;
  equations: readonly WorksheetEquation[];
  instruments: readonly WorksheetInstrument[];
}>) {
  const prefix = useId();
  const section = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<WorksheetState>(() => emptyWorksheet(capstone));
  const [compare, setCompare] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pending, setPending] = useState<WorksheetState | null>(null);
  const [notice, setNotice] = useState("");
  const importGeneration = useRef(0);
  const urls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const feedbackHeading = useRef<HTMLHeadingElement>(null);
  const worksheetHeading = useRef<HTMLHeadingElement>(null);
  const claimNumbers = new Map(capstone.paperOrder.map((id, index) => [id, index + 1]));
  const claimName = (id: string) => `Claim ${claimNumbers.get(id) ?? ""}`;
  const passage = (anchor: string) => `/papers/${capstone.paper}/view/parallel/#${encodeURIComponent(anchor)}`;
  const feedback = compare ? dependencyFeedback(
    capstone.claims.map((claim) => claim.id),
    capstone.claims.flatMap((claim) => claim.buildsOn.map((from) => ({ from, to: claim.id }))),
    state.order,
  ) : null;

  useEffect(() => {
    setReady(true);
    const pendingUrls = urls.current;
    const page = section.current?.closest(".capstone-page");
    const afterPrint = () => page?.removeAttribute("data-print-worksheet");
    window.addEventListener("afterprint", afterPrint);
    return () => {
      importGeneration.current++;
      window.removeEventListener("afterprint", afterPrint);
      afterPrint();
      for (const [url, timer] of pendingUrls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      pendingUrls.clear();
    };
  }, []);

  useEffect(() => {
    if (compare) feedbackHeading.current?.focus();
  }, [compare]);

  function change(next: WorksheetState) {
    if (!readWorksheet(next)) {
      setNotice("That change exceeds the worksheet's size limit. Nothing was changed; export a copy before shortening your work.");
      return;
    }
    setState(next);
    setNotice("");
  }
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([exportWorksheet(state)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${capstone.id}-worksheet.json`;
      link.hidden = true;
      section.current?.append(link);
      link.click();
      link.remove();
      urls.current.set(url, setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }, 1000));
      setNotice("Your worksheet was exported. Keep the file somewhere private.");
    } catch {
      setNotice("This browser could not download the worksheet. Your work remains here.");
    }
  }
  async function readFile(file: File | undefined) {
    const generation = ++importGeneration.current;
    setPending(null);
    if (!file) return;
    if (file.size > WORKSHEET_LIMITS.bytes) {
      setNotice("This file is too large for a worksheet. Nothing was imported.");
      return;
    }
    try {
      const next = readWorksheet(JSON.parse(await file.text()));
      if (generation !== importGeneration.current) return;
      if (!next || !worksheetMatches(next, capstone)) {
        setNotice("This file is not a supported worksheet for this capstone. Keep the original; nothing was imported.");
        return;
      }
      setPending(next);
      setClearing(false);
      setNotice("");
    } catch {
      if (generation === importGeneration.current)
        setNotice("This file could not be read. Nothing was imported.");
    }
  }

  const usedEquationIds = new Set(equations.map((equation) => equation.equationId));
  const otherAnnotations = Object.entries(state.annotations).filter(([id]) => !usedEquationIds.has(id));
  // Rows and columns are append-only; these identities do not change while a reader types.
  const tableRows = state.table.map((cells, row) => ({ id: `${prefix}-row-${row}`, row, cells: cells.map((value, col) => ({ id: `${prefix}-cell-${row}-${col}`, col, value })) }));

  return (
    <section className="capstone-worksheet reading" id="capstone-worksheet" ref={section} aria-labelledby={`${prefix}-title`}>
      <h2 id={`${prefix}-title`} ref={worksheetHeading} tabIndex={-1}>Your reconstruction</h2>
      <p>This optional worksheet is your own explanation, not an assessment. Nothing is uploaded or added to a link.</p>
      <p>{capstone.explanationPrompt}</p>
      {!ready ? (
        <div className="capstone-blank-worksheet">
          <p>Editing needs JavaScript. The claims, sources, equations and assumptions above can still be read and printed. Use the space below for a reconstruction on paper.</p>
          <h3>Your claim order, assumptions and explanation</h3>
          <div className="capstone-drawing-box" />
        </div>
      ) : (
        <>
          <p className="capstone-controls">Work stays in this tab. Export it before leaving, then import the file to continue another time.</p>
          <div className="capstone-controls capstone-toolbar">
            <button type="button" onClick={download}>Export this worksheet</button>
            <button type="button" onClick={() => {
              section.current?.closest(".capstone-page")?.setAttribute("data-print-worksheet", "true");
              window.print();
            }}>Print this worksheet</button>
            <button type="button" onClick={() => {
              importGeneration.current++;
              setPending(null);
              setClearing(true);
            }}>Clear this worksheet</button>
            <label htmlFor={`${prefix}-import`}>Import a worksheet JSON file</label>
            <input id={`${prefix}-import`} type="file" accept=".json,application/json" onChange={(event) => {
              void readFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }} />
          </div>
          <p className="capstone-controls" role="status" aria-live="polite">{notice}</p>
          {pending && <div className="capstone-controls" role="group" aria-label="Confirm worksheet import">
            <p>Replace this tab's worksheet with the imported file? Export your current work first to keep both.</p>
            <button type="button" onClick={() => { change(pending); setPending(null); setCompare(false); worksheetHeading.current?.focus(); }}>Replace with imported worksheet</button>
            <button type="button" onClick={() => setPending(null)}>Cancel import</button>
          </div>}
          {clearing && <div className="capstone-controls" role="group" aria-label="Confirm clearing this worksheet">
            <p>Clear this capstone's work? Export it first to keep a copy. Other capstones are not changed.</p>
            <button type="button" onClick={() => { change(emptyWorksheet(capstone)); setClearing(false); setCompare(false); worksheetHeading.current?.focus(); }}>Confirm clear</button>
            <button type="button" onClick={() => setClearing(false)}>Keep my work</button>
          </div>}

          <h3>Arrange the claims</h3>
          <p>The claim names follow the paper, even when you move them. More than one arrangement may respect the dependencies.</p>
          <div className="capstone-controls capstone-toolbar">
            <button type="button" onClick={() => change({ ...state, order: [...capstone.startOrder] })}>Reset the order only</button>
            <button type="button" onClick={() => change({ ...state, order: [...capstone.paperOrder] })}>Use the paper's order</button>
          </div>
          <ReorderList order={state.order} onChange={(order) => change({ ...state, order })} items={capstone.claims.map((claim) => ({
            id: claim.id,
            label: claimName(claim.id),
            content: <><h4>{claimName(claim.id)}</h4><p>{claim.text}</p><a href={passage(claim.anchor)}>Read this claim in the paper</a></>,
          }))} />

          <h3>Try the instruments</h3>
          {instruments.map((instrument) => <div key={instrument.id}>
            <p>{instrument.purpose}</p>
            <p><a href={instrument.href}>Open the instrument</a>{instrument.tapeHref && <> · <a href={instrument.tapeHref}>Follow the teaching tape</a></>}</p>
            {instrument.lookFor.map((description) => <p key={description}>{description}</p>)}
          </div>)}

          <h3>Annotate the equations</h3>
          <p>These displays use the edition's modern teaching notation. Their source links show the printed paper.</p>
          {equations.map((equation) => <section key={equation.equationId}>
            <h4>{equation.title}</h4><p>{equation.purpose}</p>
            {/* Only build-time KaTeX from the edition, never a reader's annotation. */}
            <div className="capstone-math"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: immutable build-time KaTeX from the authored equation tree.
              dangerouslySetInnerHTML={{ __html: equation.html }} />
            <p>{equation.spoken}</p>
            <p><a href={equation.href}>See the equation in the paper</a></p>
            <label className="capstone-controls" htmlFor={`${prefix}-${equation.equationId}`}>Your annotation for {equation.title}</label>
            <textarea className="capstone-controls" id={`${prefix}-${equation.equationId}`} rows={3} maxLength={WORKSHEET_LIMITS.text} value={state.annotations[equation.equationId] ?? ""} onChange={(event) => change({ ...state, annotations: { ...state.annotations, [equation.equationId]: event.currentTarget.value } })} />
            <p className="capstone-print-text">Your annotation: {state.annotations[equation.equationId] || "________________"}</p>
          </section>)}
          {otherAnnotations.length > 0 && <section><h4>Other saved annotations</h4><p>These notes have no matching equation in this view. They are kept in your export.</p>{otherAnnotations.map(([id, text]) => <p key={id}>{text}</p>)}</section>}

          <h3>Mark the assumptions each claim uses</h3>
          {state.order.map((id) => <fieldset key={id} className="capstone-assumption-fields">
            <legend>{claimName(id)} uses</legend>
            {capstone.assumptions.map((assumption) => <label key={assumption.id}>
              <input type="checkbox" checked={(state.assumptionMarks[id] ?? []).includes(assumption.id)} onChange={(event) => change(markAssumption(state, id, assumption.id, event.currentTarget.checked))} />
              <span>{assumption.statement}</span>
              <span className="capstone-print-text">{(state.assumptionMarks[id] ?? []).includes(assumption.id) ? " [selected]" : " [not selected]"}</span>
            </label>)}
          </fieldset>)}

          <h3>Explain the chain in your own words</h3>
          <label className="capstone-controls" htmlFor={`${prefix}-explanation`}>Your explanation</label>
          <textarea className="capstone-controls" id={`${prefix}-explanation`} rows={8} maxLength={WORKSHEET_LIMITS.text} value={state.explanation} onChange={(event) => change({ ...state, explanation: event.currentTarget.value })} />
          <p className="capstone-print-text">{state.explanation || "________________________________________________________________"}</p>
          <h4>An optional table</h4>
          <div className="capstone-controls capstone-toolbar">
            <button type="button" disabled={state.table.length >= WORKSHEET_LIMITS.rows} onClick={() => change({ ...state, table: [...state.table, Array.from({ length: state.table[0]?.length ?? 2 }, () => "")] })}>Add a row</button>
            <button type="button" disabled={state.table.length === 0 || (state.table[0]?.length ?? 0) >= WORKSHEET_LIMITS.columns} onClick={() => change({ ...state, table: state.table.map((row) => [...row, ""]) })}>Add a column</button>
          </div>
          {tableRows.map((row) => <fieldset key={row.id} className="capstone-controls capstone-table-row"><legend>Row {row.row + 1}</legend>{row.cells.map((cell) => <label key={cell.id}>Column {cell.col + 1}<input type="text" maxLength={WORKSHEET_LIMITS.cell} value={cell.value} onChange={(event) => change({ ...state, table: state.table.map((values, index) => index === row.row ? values.map((value, col) => col === cell.col ? event.currentTarget.value : value) : values) })} /></label>)}</fieldset>)}
          {state.table.length > 0 && <table className="capstone-print-table"><caption>Your table</caption><tbody>{tableRows.map((row) => <tr key={row.id}>{row.cells.map((cell) => <td key={cell.id}>{cell.value || " "}</td>)}</tr>)}</tbody></table>}
          <h4>A drawing on paper</h4><p>This space is left blank for a drawing when you print the worksheet.</p><div className="capstone-drawing-box" />

          <div className="capstone-controls"><button type="button" aria-expanded={compare} aria-controls={`${prefix}-feedback`} onClick={() => setCompare(!compare)}>Compare your chain</button></div>
          {feedback && <section id={`${prefix}-feedback`}>
            <h3 ref={feedbackHeading} tabIndex={-1}>Your chain beside the worked version</h3>
            {feedback.consistent ? <p>This order respects the authored dependencies. The paper shows one possible arrangement.</p> : <><p>These dependencies need a different order:</p><ul>{feedback.violated.map((edge) => <li key={`${edge.from}-${edge.to}`}>{claimName(edge.to)} builds on {claimName(edge.from).toLowerCase()}, so {claimName(edge.from).toLowerCase()} comes first.</li>)}</ul></>}
            {capstone.claims.map((claim) => {
              const difference = assumptionFeedback(claim.assumptionIds, state.assumptionMarks[claim.id] ?? []);
              const statement = (id: string) => capstone.assumptions.find((assumption) => assumption.id === id)?.statement ?? id;
              return <section key={claim.id}><h4>{claimName(claim.id)}</h4>
                {difference.alsoUses.map((id) => <p key={id}>The worked version also uses: {statement(id)}</p>)}
                {difference.notUsedInWorkedVersion.map((id) => <p key={id}>You selected an assumption the worked version does not use here: {statement(id)}</p>)}
                {difference.alsoUses.length === 0 && difference.notUsedInWorkedVersion.length === 0 && <p>Your assumption selections match the worked version.</p>}
                <p>{capstone.selfCheckNotes[claim.id]}</p>
              </section>;
            })}
          </section>}
          <h3>Limits of this reconstruction</h3><p>{capstone.limits}</p>
        </>
      )}
    </section>
  );
}
