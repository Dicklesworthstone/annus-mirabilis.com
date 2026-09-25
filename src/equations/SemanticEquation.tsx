"use client";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { exponentialParts } from "../units/scientific.ts";
import { useEquationScope } from "./EquationScope.tsx";
import { readTermValue, resolveSlot, retainedState } from "./live/values.ts";
import { NotationNote } from "./NotationNote.tsx";
import { navigate } from "./navigation.ts";
import { createSelectionStore } from "./selectionStore.ts";
import { TermChips } from "./TermChips.tsx";
import { lightQuantity, quantityAt } from "./TermHighlight.tsx";
import { SymbolicValue, TermInspector } from "./TermInspector.tsx";
import { termFacts, termGlyphHtml } from "./termFacts.ts";
import { withQuantityIds } from "./termQuantities.ts";
import type { CompiledEquation } from "./viewTypes.ts";
import "../generated/quantity-colours-by-paper.css";
import "./equations.css";

/**
 * A prerequisite link's name says which lesson it opens. Named by the note alone it could not:
 * notes share titles, within one equation and across them, and "Read the prerequisite: What it
 * asserts" led to five different lessons. Without the lesson's title it falls back to the note's.
 */

/**
 * A term's accepted value as a reader sees it. formatScaledDecimal keeps e-notation outside 10⁻⁵ to
 * 10¹⁵, which suits a typed field but reached readers: bm-01's equation read "Boltzmann constant
 * 1.3806e-23 J/K". Such a value is drawn as a power of ten with the exponent raised.
 */
function termText(text: string): ReactNode {
  if (!/e[+-]?\d+$/.test(text)) return text;
  const parts = exponentialParts(Number(text));
  if (parts.kind === "plain") return parts.text;
  return (
    <>
      {parts.mantissa} × 10<sup>{parts.exponent}</sup>
    </>
  );
}

export function prerequisiteName(noteTitle: string, lessonTitle: string | undefined): string {
  return lessonTitle
    ? `Read the prerequisite: ${lessonTitle}, for ${noteTitle}`
    : `Read the prerequisite: ${noteTitle}`;
}

export function SemanticEquation({
  equation,
  scope: propScope,
  scopeLabel: propScopeLabel,
}: {
  equation: CompiledEquation;
  scope?: string | undefined;
  scopeLabel?: string | undefined;
}) {
  const uid = useId(),
    scopeContext = useEquationScope(),
    effectiveScope = propScope ?? scopeContext?.scope,
    effectiveScopeLabel = propScopeLabel ?? scopeContext?.scopeLabel,
    [local] = useState(createSelectionStore),
    store = scopeContext?.store ?? local;
  const selected = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const [ready, setReady] = useState(false),
    [pattern, setPattern] = useState(false),
    root = useRef<HTMLDivElement>(null),
    formula = useRef<HTMLElement>(null);
  const qualified = useCallback((id: string) => `${equation.paper}/${id}`, [equation.paper]);
  const current = selected?.nodeId.startsWith(`${equation.paper}/${equation.id}.`)
    ? selected.nodeId.slice(equation.paper.length + 1)
    : null;
  const note = equation.notes.find((n) => n.nodeId === current),
    term = equation.terms.find((t) => t.termId === current);
  const binding = equation.bindings[0],
    resolution = binding
      ? resolveSlot(scopeContext?.slots ?? [], binding.experimentId, binding.instanceSlot)
      : null;
  const slot = resolution?.kind === "resolved" ? resolution.value : null,
    snapshot = slot?.view.accepted;
  useEffect(() => {
    setReady(true);
  }, []);
  // TERMS AS TARGETS (dispatch 144): pointing at or focusing anything that names a quantity lights
  // every instance of that exact quantity in this card; a click still selects, as before.
  const [pointed, setPointed] = useState<string | null>(null);
  useEffect(() => {
    if (root.current) lightQuantity(root.current, pointed);
  }, [pointed]);
  const pointAt = (target: EventTarget | null) =>
    setPointed(root.current ? quantityAt(root.current, target) : null);
  useEffect(() => {
    for (const element of root.current?.querySelectorAll<HTMLElement>("[data-term],[data-op]") ??
      []) {
      const id = element.dataset.term ?? element.dataset.op;
      const t = equation.terms.find((t) => t.termId === id);
      element.dataset.selected = String(
        selected?.nodeId === qualified(id ?? "") ||
          (!!t && !!selected?.quantityId && t.quantityId === selected.quantityId),
      );
    }
  }, [selected, equation, qualified]);
  function select(id: string | null) {
    const node = equation.navigation.find((n) => n.id === id);
    store.select(
      node ? { nodeId: qualified(node.id), quantityId: node.quantityId, kind: node.kind } : null,
    );
  }
  /** A chip or a sentence phrase pins its quantity, through the term that first carries it. */
  function selectQuantity(quantityId: string) {
    if (selected?.quantityId === quantityId) {
      select(null);
      return;
    }
    const node = equation.navigation.find((n) => n.kind === "term" && n.quantityId === quantityId);
    select(node?.id ?? null);
  }
  function keys(e: KeyboardEvent<HTMLDivElement>) {
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "Escape",
        "Enter",
        " ",
      ].includes(e.key)
    ) {
      e.preventDefault();
      e.stopPropagation();
      select(navigate(equation.navigation, current, e.key));
    }
  }
  const selectedNode = (id: string | undefined) =>
    !!id &&
    (current === id ||
      (selected?.quantityId &&
        equation.terms.find((t) => t.termId === id)?.quantityId === selected.quantityId));
  /**
   * The inspector's value line for a term: the laboratory's accepted value where this page's slot
   * computes the quantity, with the execution label that earned it; otherwise one line saying why
   * there is none. The binding is found by quantity, so every place the quantity is printed reads
   * the one accepted output, each scaled as its term is.
   */
  function termValueLine(t: CompiledEquation["terms"][number]): ReactNode {
    if (!slot)
      return resolution?.kind === "ambiguous" ? (
        resolution.message
      ) : (
        <SymbolicValue
          lab={equation.bindings.find((b) => b.quantityId === t.quantityId)?.experimentId}
        />
      );
    const bound = equation.bindings.some((b) => b.quantityId === t.quantityId);
    const v = readTermValue(t, bound ? slot : null);
    if (v.kind !== "value") return v.text;
    return (
      <>
        {termText(v.text)} {v.unit} ({slot.execution.text})
      </>
    );
  }
  const equationId = effectiveScope ? `${equation.id}-${effectiveScope}` : equation.id;
  /*
    ONE COLOUR PER QUANTITY, from CSS alone. The root names its paper (data-paper), each coloured
    element carries its quantity id (the formula's KaTeX term spans too, since withQuantityIds),
    and src/generated/quantity-colours-by-paper.css, imported above, maps the pair to a slot. It
    is imported here because a lab page has no reading formula to bring it (am-ywtb: the explorer
    on /lab/bm-01/ showed blank chip dots). This component imports no colour map: importing one
    put every paper's quantities, with rendered glyphs, into the first-route JavaScript
    (initial-route-js went 842 bytes over on the Brownian page).
  */
  const quantityOfTerm = (id: string | undefined) =>
    id ? equation.terms.find((t) => t.termId === id)?.quantityId : undefined;
  const legend = [...new Map(equation.terms.map((t) => [t.quantityId, t.quantity.name]))];
  const printedNotation =
    equation.notationForm?.state === "printed" ? equation.notationForm : undefined;
  const navLabel = effectiveScopeLabel
    ? `Terms and operations in ${equation.title || equation.id} (${effectiveScopeLabel})`
    : `Terms and operations in ${equation.title || equation.id}`;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegated listeners only; they light the term under the pointer or focus, and the keyboard route is the focusable formula section below.
    <div
      ref={root}
      className="semantic-equation"
      data-equation-id={equationId}
      data-paper={equation.paper}
      data-equation-digest={equation.treeDigest}
      data-selected-node-id={current ?? undefined}
      data-pattern={String(pattern)}
      onPointerOver={(e) => pointAt(e.target)}
      onPointerLeave={() => setPointed(null)}
      onFocus={(e) => pointAt(e.target)}
      onBlur={() => setPointed(null)}
    >
      <header>
        <p className="eyebrow">
          Explore the equation ·{" "}
          {printedNotation ? (
            <>
              <span data-notation-form="modern">Modern model notation</span>
              <span data-notation-form="printed">Einstein's letters</span>
            </>
          ) : (
            "Modern model notation"
          )}
        </p>
        <h3>{equation.title}</h3>
      </header>
      <section
        ref={formula}
        className="equation-formula"
        tabIndex={ready ? 0 : undefined}
        aria-label={`Explore ${equation.title}`}
        aria-describedby={`${uid}-keys`}
        onKeyDown={keys}
        onClick={(e) => {
          const target = e.target as Element;
          const node = target.closest<HTMLElement>("[data-term],[data-op]");
          if (node) {
            select(node.dataset.term ?? node.dataset.op ?? null);
            formula.current?.focus({ preventScroll: true });
          }
        }}
      >
        {/* Both notations are in the page; html[data-notation] shows one (equations.css). The
            hidden one is display: none, so it is out of the accessibility tree as well. */}
        <div
          className="equation-visual"
          aria-hidden="true"
          data-notation-form={printedNotation ? "modern" : undefined}
          {...{
            dangerouslySetInnerHTML: { __html: withQuantityIds(equation.html, equation.terms) },
          }}
        />
        <div
          className="equation-mathml"
          data-notation-form={printedNotation ? "modern" : undefined}
          {...{ dangerouslySetInnerHTML: { __html: equation.mathml } }}
        />
        {printedNotation ? (
          <>
            <div
              className="equation-visual"
              aria-hidden="true"
              data-notation-form="printed"
              {...{
                dangerouslySetInnerHTML: {
                  __html: withQuantityIds(printedNotation.html, equation.terms),
                },
              }}
            />
            <div
              className="equation-mathml"
              data-notation-form="printed"
              {...{ dangerouslySetInnerHTML: { __html: printedNotation.mathml } }}
            />
          </>
        ) : null}
      </section>
      {equation.notationForm?.state === "modern" ? (
        <NotationNote seeAt={equation.notationForm.seeAt} />
      ) : null}
      {(printedNotation
        ? ([
            ["modern", equation.sentence],
            ["printed", printedNotation.sentence],
          ] as const)
        : ([[undefined, equation.sentence]] as const)
      ).map(([form, sentence]) => (
        <p key={form ?? "one"} className="equation-sentence" data-notation-form={form}>
          {/* The decoder: each phrase bound to a quantity is a button that lights and pins it,
              disabled until hydration so that without JavaScript it reads as the sentence. */}
          {sentence.map((f) => {
            const quantityId = quantityOfTerm(f.nodeId);
            return quantityId ? (
              <button
                type="button"
                key={`${f.nodeId ?? "frag"}-${f.text}`}
                className="equation-quantity term-phrase"
                data-quantity-id={quantityId}
                data-selected={String(!!selectedNode(f.nodeId))}
                aria-pressed={selected?.quantityId === quantityId}
                disabled={!ready}
                onClick={() => selectQuantity(quantityId)}
              >
                {f.text}
              </button>
            ) : (
              <span key={`${f.nodeId ?? "frag"}-${f.text}`}>{f.text}</span>
            );
          })}
        </p>
      ))}
      {/* The keyboard help is shown while the formula has focus (equations.css), and it is the
          formula's accessible description either way: aria-describedby reads a hidden node. */}
      <p id={`${uid}-keys`} className="fine equation-keys">
        Select a term or operation. In the formula, Down enters an operation, Up returns to its
        parent, and Left/Right move between siblings. Escape clears selection. Tab leaves the
        formula.
      </p>
      <TermChips
        label={`Quantities in ${equation.title}`}
        items={legend.map(([quantityId, name]) => ({ quantityId, name, glyphHtml: "" }))}
        pressed={selected?.quantityId ?? null}
        disabled={!ready}
        onPress={selectQuantity}
        onClear={() => select(null)}
      />
      <p className="equation-mathml" role="status" aria-live="polite" aria-atomic="true">
        {note ? `${note.title}. ${note.explanation}` : ""}
      </p>
      <div className="equation-tools">
        <button
          type="button"
          className="secondary"
          disabled={!ready}
          onClick={() => setPattern(!pattern)}
          aria-pressed={pattern}
        >
          Patterns instead of colour
        </button>
        {/* Only while something is selected: a disabled button under every card said nothing and
            took a full-width row on a phone. */}
        {selected ? (
          <button
            type="button"
            className="secondary"
            disabled={!ready}
            onClick={() => {
              select(null);
              formula.current?.focus();
            }}
          >
            Clear selection
          </button>
        ) : null}
      </div>
      {/* Every term and operation as a button: the way to explore without a pointer or arrow
          keys. It was seven or more full-width buttons stacked under every formula, so it opens
          on request; closed, the buttons stay in the page and in the accessibility tree order. */}
      <details className="equation-parts">
        <summary>Each term and operation, in words</summary>
        <nav className="equation-chips" aria-label={navLabel}>
          {equation.navigation.map((n) => {
            const noteEntry = equation.notes.find((note) => note.nodeId === n.id);
            const noteTitle = noteEntry?.title ?? n.id;
            return (
              <button
                type="button"
                className={
                  n.kind === "term" ? "secondary eq-chip eq-term" : "secondary eq-chip eq-operation"
                }
                key={n.id}
                // The target of a worked trace row's link (ShowTheCode links each operation to #<id>).
                id={n.id}
                data-node-id={n.id}
                data-quantity-id={n.quantityId ?? undefined}
                data-selected={String(!!selectedNode(n.id))}
                disabled={!ready}
                aria-label={`${noteTitle} ${n.kind}`}
                aria-pressed={!!selectedNode(n.id)}
                onClick={() => select(n.id)}
              >
                {noteTitle}
                <span className="eq-kind">{n.kind === "term" ? "term" : "operation"}</span>
              </button>
            );
          })}
        </nav>
      </details>
      {/* A selected term opens the term inspector (dispatch 144 unit c); a selected operation keeps
          its note. Either changes only on a selection, never on a pointer move. */}
      {term ? (
        <TermInspector
          className="equation-inspector"
          nodeId={current ?? undefined}
          name={term.quantity.name}
          glyphHtml={termGlyphHtml(equation.html, term.termId)}
          printedGlyphHtml={
            printedNotation ? termGlyphHtml(printedNotation.html, term.termId) : undefined
          }
          glyphQuantityId={term.quantityId}
          facts={termFacts([equation], term.quantity)}
          value={termValueLine(term)}
        >
          <p className="fine">{term.quantity.definition}</p>
          {note ? (
            <p>
              <a
                href={`/foundations/${note.foundation}/`}
                data-foundation={note.foundation}
                data-return-caption={`Return to ${equation.title}.`}
              >
                Show the missing step →
              </a>
            </p>
          ) : null}
          {term.quantity.role === "input" && scopeContext?.editQuantity && (
            <button
              type="button"
              className="secondary"
              onClick={() => scopeContext.editQuantity?.(term.quantityId)}
            >
              Edit this input in the laboratory
            </button>
          )}
        </TermInspector>
      ) : note ? (
        <section
          className="equation-inspector"
          aria-label="Selected equation part"
          data-inspector-node={current}
        >
          <h4>{note.title}</h4>
          <p>{note.explanation}</p>
          <p>
            <a
              href={`/foundations/${note.foundation}/`}
              data-foundation={note.foundation}
              data-return-caption={`Return to ${equation.title}.`}
            >
              Show the missing step →
            </a>
          </p>
        </section>
      ) : null}
      <div
        className="equation-values"
        data-equation-values
        data-instance-id={snapshot?.instanceId}
        data-instance-slot={slot?.slot}
        data-run-id={snapshot?.runId}
        data-snapshot-version={snapshot?.snapshotVersion}
        data-input-revision={slot?.view.requested?.revisions.input}
        data-accepted-input-revision={snapshot?.revisions.input}
        data-pending={String(slot?.view.pending ?? false)}
        data-execution-label={slot?.execution.label ?? "unavailable"}
      >
        <p className="fine">
          <strong>{slot?.execution.text ?? "No live values"}</strong>
        </p>
        {slot ? (
          <p className="fine" data-retained-state>
            {retainedState(slot)}
          </p>
        ) : (
          <p className="fine">
            {resolution && resolution.kind !== "resolved"
              ? resolution.message
              : "This equation states a relation. No instrument on this page computes its terms."}
          </p>
        )}
        {/* Values exist only with a laboratory slot. Without one, every term read "No accepted
            value is available here.", three and four times in a row, under a line that already
            said the equation is symbolic. */}
        {slot ? (
          <dl className="equation-value-list">
            {equation.terms.map((t) => {
              const b = equation.bindings.find((b) => b.termId === t.termId),
                v = readTermValue(t, b ? slot : null);
              return (
                <div key={t.termId} data-quantity-id={t.quantityId} className="equation-quantity">
                  <dt>
                    {t.quantity.name}
                    {(t.scale.num !== 1 || t.scale.den !== 1) &&
                      ` (shown × ${t.scale.num}/${t.scale.den})`}
                  </dt>
                  <dd data-term-value={t.termId} data-value-kind={v.kind}>
                    {v.kind === "value" ? (
                      <>
                        {termText(v.text)} <span>{v.unit}</span>
                      </>
                    ) : (
                      v.text
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>
      <details>
        <summary>Read the equation aloud in words</summary>
        <p>{equation.spoken}</p>
        <p>{equation.explanation}</p>
      </details>
      <details>
        <summary>Model assumptions and every term’s meaning</summary>
        <ul>
          {equation.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <dl>
          {/* One line per meaning. A symbol printed twice has two notes, often identical ("Cutoff
              frequency: the highest frequency the sum includes." twice); the chips above keep one
              per occurrence, because each selects a different place in the formula. */}
          {equation.notes
            .filter(
              (n, i, all) =>
                all.findIndex(
                  (m) =>
                    m.title === n.title &&
                    m.explanation === n.explanation &&
                    m.foundation === n.foundation,
                ) === i,
            )
            .map((n) => (
              <div key={n.nodeId}>
                <dt>{n.title}</dt>
                <dd>
                  {n.explanation}{" "}
                  {/* A link record like every other lesson link in the papers: on a paper page
                      ReaderController opens the lesson beside the passage and returns to it;
                      anywhere else it is a plain link to the lesson's page. */}
                  <a
                    href={`/foundations/${n.foundation}/`}
                    data-foundation={n.foundation}
                    data-return-caption={
                      equation.title
                        ? `Back to the equation: ${equation.title}`
                        : "Back to the equation."
                    }
                    aria-label={prerequisiteName(
                      n.title,
                      scopeContext?.lessonTitles?.[n.foundation],
                    )}
                  >
                    Read the prerequisite
                  </a>
                </dd>
              </div>
            ))}
        </dl>
        <p className="fine">
          Every term&rsquo;s units were checked when this page was built. That checks the units, not
          the model. This equation is written for this edition in modern notation, not transcribed
          from the paper.
        </p>
      </details>
    </div>
  );
}
