"use client";
import { useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { usePinnedEquations } from "../reader/layout/PinnedEquationContext.tsx";
import type { PinnedEquationStore } from "../reader/layout/pinnedEquationStore.ts";
import { loadArgumentEquations } from "./loadArgumentEquations.ts";
import { sourceAnchorFor } from "./PinEquationButton.tsx";
import { createSelectionStore } from "./selectionStore.ts";
import { TermHighlightContext } from "./TermHighlight.tsx";
import type { CompiledEquation } from "./viewTypes.ts";

type FormulaReference = Readonly<{
  paper: string;
  equationId: string;
  argumentId: string;
  title: string;
  printedAvailable: boolean;
}>;
const NO_SLOTS = Object.freeze([]);

function AvailableFormula({
  reference,
  store,
}: {
  reference: FormulaReference;
  store: PinnedEquationStore;
}) {
  const sourceId = useId();
  const highlight = useContext(TermHighlightContext);
  const highlightRef = useRef(highlight);
  highlightRef.current = highlight;
  const [selection] = useState(createSelectionStore);
  const [equation, setEquation] = useState<CompiledEquation | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const syncingSource = useRef(false);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const own = state.pinned?.sourceId === sourceId;
  useEffect(() => {
    setReady(true);
  }, []);
  // A companion selection uses the primary formula's existing quantity-highlighting owner.
  useEffect(() => {
    if (!own) return;
    return selection.subscribe(() => {
      if (!syncingSource.current)
        highlightRef.current?.pin(selection.getSnapshot()?.quantityId ?? null);
    });
  }, [selection, own]);
  useEffect(() => {
    if (
      !own ||
      !equation ||
      (selection.getSnapshot()?.quantityId ?? null) === (highlight?.pinned ?? null)
    )
      return;
    const node = equation.navigation.find(
      (node) => node.kind === "term" && node.quantityId === highlight?.pinned,
    );
    syncingSource.current = true;
    try {
      selection.select(
        node
          ? { nodeId: `${equation.paper}/${node.id}`, quantityId: node.quantityId, kind: node.kind }
          : null,
      );
    } finally {
      syncingSource.current = false;
    }
  }, [equation, highlight?.pinned, selection, own]);
  if (!ready) return null;
  return (
    <span className="formula-pin-control">
      <button
        type="button"
        className="secondary"
        data-pin-formula={reference.equationId}
        aria-label={`${own ? "Show pinned equation" : "Pin this equation"}: ${reference.title}`}
        aria-pressed={own}
        disabled={busy}
        onClick={async (event) => {
          if (own) {
            store.showPinned(true);
            return;
          }
          const source = event.currentTarget;
          const formId =
            reference.printedAvailable &&
            source.closest("[data-reader-root]") &&
            source.ownerDocument.documentElement.dataset.notation !== "modern"
              ? "printed"
              : "modern";
          const attempt = store.beginPin();
          setBusy(true);
          setFailed(false);
          try {
            const payload = await loadArgumentEquations(reference.argumentId);
            if (!store.isCurrentPin(attempt) || !source.isConnected) return;
            const compiled = payload.equations.find(
              (item) =>
                item.id === reference.equationId &&
                item.paper === reference.paper &&
                item.argument === reference.argumentId,
            );
            if (!compiled || (formId === "printed" && compiled.notationForm?.state !== "printed")) {
              setFailed(true);
              return;
            }
            const node = compiled.navigation.find(
              (item) => item.kind === "term" && item.quantityId === highlightRef.current?.pinned,
            );
            selection.select(
              node
                ? {
                    nodeId: `${compiled.paper}/${node.id}`,
                    quantityId: node.quantityId,
                    kind: node.kind,
                  }
                : null,
            );
            setEquation(compiled);
            store.pinEquation(
              {
                equation: compiled,
                formId,
                sourceId,
                sourceAnchor: sourceAnchorFor(source) || reference.argumentId,
                returnElement: source,
                context: {
                  store: selection,
                  slots: NO_SLOTS,
                  editQuantity: null,
                  lessonTitles: payload.foundationTitles,
                },
              },
              attempt,
            );
          } catch {
            if (store.isCurrentPin(attempt)) setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening equation…" : own ? "Show pinned equation" : "Pin this equation"}
      </button>
      {failed ? (
        <span className="fine" role="alert">
          {" "}
          The companion could not open.{" "}
          <a href={`/papers/${reference.paper}/#${reference.argumentId}`}>
            Open this equation’s step in the paper
          </a>
          .
        </span>
      ) : null}
    </span>
  );
}

/** Carries only identity until clicked, so primary formulas do not duplicate large client payloads. */
export function PinFormulaButton({ reference }: { reference: FormulaReference }) {
  const store = usePinnedEquations();
  return store ? <AvailableFormula reference={reference} store={store} /> : null;
}
