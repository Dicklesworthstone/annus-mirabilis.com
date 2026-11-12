"use client";
import { type ReactNode, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { EquationScope } from "../../equations/EquationScope.tsx";
import { SemanticEquation } from "../../equations/SemanticEquation.tsx";
import { BottomSheet } from "./BottomSheet.tsx";
import { usePinnedEquations } from "./PinnedEquationContext.tsx";
import type { PinnedEquation, PinnedEquationStore } from "./pinnedEquationStore.ts";
import { pinnedEquationView } from "./pinnedEquationView.ts";
import "./pinnedEquation.css";

function returnToSource(pin: PinnedEquation) {
  const source = pin.returnElement?.isConnected
    ? pin.returnElement
    : pin.sourceAnchor
      ? document.getElementById(pin.sourceAnchor)
      : null;
  if (!source) return;
  for (let ancestor = source.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
  }
  source.focus({ preventScroll: true });
  source.scrollIntoView({ block: "center", behavior: "instant" });
}

function PinnedCard({ store, slot }: { store: PinnedEquationStore; slot?: string | undefined }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!state.pinned || !state.visible || !root.current) return;
    const sheet = root.current.closest<HTMLDetailsElement>("[data-bottom-sheet]");
    const surface = sheet ?? root.current.closest("[data-reader-companion-column]") ?? root.current;
    // Both responsive slots exist in the document. Only the visible one opens or takes focus.
    if (surface.getClientRects().length === 0) return;
    if (sheet) sheet.open = true;
    close.current?.focus({ preventScroll: true });
  }, [state.activation, state.visible, state.pinned?.sourceId]);
  const pin = state.pinned;
  if (!pin || !state.visible) return null;
  return (
    <section
      ref={root}
      data-pinned-equation={pin.equation.id}
      data-pinned-form={pin.formId}
      className="pinned-equation-card"
      aria-label={`Pinned equation: ${pin.equation.title}`}
    >
      <div className="pinned-equation-actions">
        <button
          ref={close}
          type="button"
          className="secondary"
          onClick={() => {
            store.unpinEquation();
            returnToSource(pin);
          }}
        >
          Unpin equation
        </button>
        <a
          href={pin.sourceAnchor ? `#${pin.sourceAnchor}` : "#"}
          onClick={(event) => {
            if (!pin.returnElement?.isConnected && !pin.sourceAnchor) return;
            event.preventDefault();
            const sheet = root.current?.closest<HTMLDetailsElement>("[data-bottom-sheet]");
            if (sheet) sheet.open = false;
            returnToSource(pin);
          }}
        >
          Return to the equation in the passage
        </a>
      </div>
      <p className="fine">
        Pinned in {pin.formId === "printed" ? "Einstein’s letters" : "modern notation"}. The
        selected term stays linked to the passage.
      </p>
      <EquationScope
        selectionStore={pin.context.store}
        slots={pin.context.slots}
        editQuantity={pin.context.editQuantity}
        lessonTitles={pin.context.lessonTitles}
        scope={`pinned-${slot ?? "dock"}-${id}`}
        scopeLabel="pinned companion"
      >
        <SemanticEquation
          equation={pinnedEquationView(pin.equation, pin.formId)}
          fixedForm={pin.formId}
          pinAllowed={false}
          nodeIdPrefix={`pinned-${id}`}
        />
      </EquationScope>
    </section>
  );
}

function AvailableCompanion({
  store,
  children,
  slot,
}: {
  store: PinnedEquationStore;
  children: ReactNode;
  slot?: string | undefined;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  if (!state.pinned) return children;
  return (
    <>
      <nav
        className="reader-companion-nav"
        aria-label={`Companion contents (${slot ?? "passage"})`}
      >
        <button
          type="button"
          className="secondary"
          aria-pressed={!state.visible}
          onClick={() => store.showPinned(false)}
        >
          Section notes
        </button>
        <button
          type="button"
          className="secondary"
          aria-pressed={state.visible}
          onClick={() => store.showPinned(true)}
        >
          Pinned equation
        </button>
      </nav>
      {state.visible ? <PinnedCard store={store} slot={slot} /> : children}
    </>
  );
}

/** Only available companions are switched; no query reload or changes to the passage's URL. */
export function PinnedEquationCompanion({
  children,
  slot,
}: {
  children: ReactNode;
  slot?: string | undefined;
}) {
  const store = usePinnedEquations();
  return store ? (
    <AvailableCompanion store={store} slot={slot}>
      {children}
    </AvailableCompanion>
  ) : (
    children
  );
}

function AvailableDock({ store }: { store: PinnedEquationStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return state.pinned ? (
    <BottomSheet
      title={`Pinned equation: ${state.pinned.equation.title}`}
      className="reader-equation-dock"
      returnFocus={state.pinned.returnElement}
    >
      <PinnedCard store={store} />
    </BottomSheet>
  ) : null;
}

/** Readers without a side column use the same bounded, collapsible full-width sheet. */
export function PinnedEquationDock() {
  const store = usePinnedEquations();
  return store ? <AvailableDock store={store} /> : null;
}

function AvailableSheet({
  store,
  title,
  children,
}: {
  store: PinnedEquationStore;
  title: string;
  children: ReactNode;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return (
    <BottomSheet title={title} returnFocus={state.visible ? state.pinned?.returnElement : null}>
      {children}
    </BottomSheet>
  );
}

export function EquationCompanionSheet({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const store = usePinnedEquations();
  return store ? (
    <AvailableSheet store={store} title={title}>
      {children}
    </AvailableSheet>
  ) : (
    <BottomSheet title={title}>{children}</BottomSheet>
  );
}
