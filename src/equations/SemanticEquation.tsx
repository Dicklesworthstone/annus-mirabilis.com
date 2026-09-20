"use client";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useEquationScope } from "./EquationScope.tsx";
import { readTermValue, resolveSlot, retainedState } from "./live/values.ts";
import { navigate } from "./navigation.ts";
import { createSelectionStore } from "./selectionStore.ts";
import type { CompiledEquation } from "./viewTypes.ts";
import "./equations.css";
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
  const equationId = effectiveScope ? `${equation.id}-${effectiveScope}` : equation.id;
  const navLabel = effectiveScopeLabel
    ? `Terms and operations in ${equation.title || equation.id} (${effectiveScopeLabel})`
    : `Terms and operations in ${equation.title || equation.id}`;
  return (
    <div
      ref={root}
      className="semantic-equation"
      data-equation-id={equationId}
      data-equation-digest={equation.treeDigest}
      data-selected-node-id={current ?? undefined}
      data-pattern={String(pattern)}
    >
      <header>
        <p className="eyebrow">Explore the equation · Modern model notation</p>
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
        <div
          className="equation-visual"
          aria-hidden="true"
          {...{ dangerouslySetInnerHTML: { __html: equation.html } }}
        />
        <div
          className="equation-mathml"
          {...{ dangerouslySetInnerHTML: { __html: equation.mathml } }}
        />
      </section>
      <p className="equation-sentence">
        {equation.sentence.map((f) => (
          <span
            key={`${f.nodeId ?? "frag"}-${f.text}`}
            data-selected={String(!!selectedNode(f.nodeId))}
          >
            {f.text}
          </span>
        ))}
      </p>
      <p id={`${uid}-keys`} className="fine">
        Select a term or operation. In the formula, Down enters an operation, Up returns to its
        parent, and Left/Right move between siblings. Escape clears selection. Tab leaves the
        formula.
      </p>
      <p className="equation-role-key fine">
        <span className="am-role-input">Input</span> ·{" "}
        <span className="am-role-result">Model result</span> ·{" "}
        <span className="am-role-constant">Constant</span>
      </p>
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
          Monochrome and patterns
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!ready || !selected}
          onClick={() => {
            select(null);
            formula.current?.focus();
          }}
        >
          Clear equation selection
        </button>
      </div>
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
      {note && (
        <section
          className="equation-inspector"
          aria-label="Selected equation part"
          data-inspector-node={current}
        >
          <h4>{note.title}</h4>
          <p>{note.explanation}</p>
          {term && (
            <p className="fine">
              Role: {term.quantity.role}. Canonical quantity: <code>{term.quantityId}</code>. Unit:{" "}
              {term.quantity.displayUnit}. {term.quantity.definition}
            </p>
          )}
          <p>
            <a
              href={`/foundations/${note.foundation}/`}
              data-foundation={note.foundation}
              data-return-caption={`Return to ${equation.title}.`}
            >
              Show the missing step →
            </a>
          </p>
          {term?.quantity.role === "input" && scopeContext?.editQuantity && (
            <button
              type="button"
              className="secondary"
              onClick={() => scopeContext.editQuantity?.(term.quantityId)}
            >
              Edit this input in the laboratory
            </button>
          )}
        </section>
      )}
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
          <strong>{slot?.execution.text ?? "Symbolic equation"}</strong>
        </p>
        {slot ? (
          <p className="fine" data-retained-state>
            {retainedState(slot)}
          </p>
        ) : (
          <p className="fine">
            {resolution && resolution.kind !== "resolved"
              ? resolution.message
              : "No numerical binding is declared."}
          </p>
        )}
        <dl className="equation-value-list">
          {equation.terms.map((t) => {
            const b = equation.bindings.find((b) => b.termId === t.termId),
              v = readTermValue(t, b ? slot : null);
            return (
              <div key={t.termId} data-quantity-id={t.quantityId}>
                <dt>
                  {t.quantity.name}
                  {(t.scale.num !== 1 || t.scale.den !== 1) &&
                    ` (shown × ${t.scale.num}/${t.scale.den})`}
                </dt>
                <dd data-term-value={t.termId} data-value-kind={v.kind}>
                  {v.kind === "value" ? (
                    <>
                      {v.text} <span>{v.unit}</span>
                    </>
                  ) : (
                    v.text
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
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
          {equation.notes.map((n) => (
            <div key={n.nodeId}>
              <dt>{n.title}</dt>
              <dd>
                {n.explanation}{" "}
                <a
                  href={`/foundations/${n.foundation}/`}
                  aria-label={`Read the prerequisite: ${n.title}`}
                >
                  Read the prerequisite
                </a>
              </dd>
            </div>
          ))}
        </dl>
        <p className="fine">
          Exact rational SI dimensions were checked at build time. This is a unit check, not a proof
          of the model. This teaching record is a draft, not a transcription of a printed equation.
        </p>
      </details>
    </div>
  );
}
