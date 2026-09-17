"use client";

import type React from "react";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { NavigationNode } from "../navigation.ts";
import { navigate } from "../navigation.ts";
import { createSelectionStore, type EquationSelection } from "../selectionStore.ts";
import type { TermSpokenDetails } from "../spoken/types.ts";

export interface TermExplorerProps {
  readonly equationId: string;
  readonly title: string;
  readonly navigation: readonly NavigationNode[];
  readonly terms: readonly TermSpokenDetails[];
  readonly selectionStore?: ReturnType<typeof createSelectionStore>;
  readonly onExit?: () => void;
  readonly className?: string;
}

/**
 * Accessible Term-and-Operation Explorer.
 *
 * Implements a roving tabindex navigation model so the formula remains a single
 * tab stop in the document outline, while allowing in-depth keyboard exploration
 * of all equation terms and operations.
 */
export function TermExplorer({
  equationId,
  title,
  navigation,
  terms,
  selectionStore,
  onExit,
  className = "",
}: TermExplorerProps) {
  const [localStore] = useState(() => selectionStore ?? createSelectionStore());
  const store = selectionStore ?? localStore;

  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const [activeNodeId, setActiveNodeId] = useState<string | null>(navigation[0]?.id ?? null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const rootRef = useRef<HTMLElement>(null);

  const activeTerm = terms.find((t) => t.nodeId === activeNodeId);

  // Sync active term details into polite live announcement
  const updateAnnouncement = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) {
        setLiveAnnouncement("Selection cleared.");
        return;
      }
      const t = terms.find((item) => item.nodeId === nodeId);
      const n = navigation.find((item) => item.id === nodeId);
      if (!t && !n) return;

      const name = t?.name ?? n?.id ?? "Term";
      const role = t?.role ?? (n?.kind === "term" ? "Term" : "Operation");
      const unit = t?.unit ? `Unit: ${t.unit}.` : "";
      const value = t?.value ? `Value: ${t.value}.` : "";
      const status = t?.status && t.status !== "numeric" ? `Status: ${t.status}.` : "";
      const state = t?.fixedOrChanging ? `State: ${t.fixedOrChanging}.` : "";
      const details = t?.speechText ? ` ${t.speechText}` : "";

      const announcement =
        `${name}. Role: ${role}. ${unit} ${value} ${status} ${state}${details}`.trim();
      setLiveAnnouncement(announcement);
    },
    [terms, navigation],
  );

  const selectNode = useCallback(
    (id: string | null, focusElement = true) => {
      setActiveNodeId(id);
      if (id) {
        const node = navigation.find((n) => n.id === id);
        const sel: EquationSelection = {
          nodeId: `${equationId}.${id}`,
          quantityId: node?.quantityId ?? null,
          kind: node?.kind ?? "term",
        };
        store.select(sel);
        updateAnnouncement(id);
        if (focusElement) {
          chipRefs.current.get(id)?.focus();
        }
      } else {
        store.select(null);
        updateAnnouncement(null);
      }
    },
    [equationId, navigation, store, updateAnnouncement],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown":
      case "Home":
      case "End": {
        e.preventDefault();
        e.stopPropagation();
        const nextId = navigate(navigation, activeNodeId, e.key);
        if (nextId) {
          selectNode(nextId, true);
        }
        break;
      }

      case "Escape": {
        e.preventDefault();
        e.stopPropagation();
        selectNode(null, false);
        if (onExit) {
          onExit();
        }
        break;
      }

      case "Enter":
      case " ": {
        e.preventDefault();
        e.stopPropagation();
        if (activeNodeId) {
          selectNode(activeNodeId, true);
        }
        break;
      }

      default:
        break;
    }
  };

  return (
    <section
      ref={rootRef}
      className={`am-term-explorer ${className}`.trim()}
      data-term-explorer={equationId}
      aria-label={`Terms and operations in ${title}`}
      onKeyDown={handleKeyDown}
    >
      <div className="am-explorer-header">
        <span className="am-explorer-title">Terms & Operations</span>
        <span className="am-explorer-hint fine">
          Use arrow keys to navigate terms. Escape clears selection and exits.
        </span>
      </div>

      {/* Roving tabindex chip list */}
      <fieldset className="am-term-chips" aria-label="Equation components">
        {navigation.map((n) => {
          const t = terms.find((item) => item.nodeId === n.id);
          const isSelected = activeNodeId === n.id;
          const label = t?.name ?? n.id;
          const roleLabel = t?.role ?? (n.kind === "term" ? "term" : "operation");

          return (
            <button
              key={n.id}
              ref={(el) => {
                if (el) {
                  chipRefs.current.set(n.id, el);
                } else {
                  chipRefs.current.delete(n.id);
                }
              }}
              type="button"
              className={`am-chip am-chip-${n.kind} ${isSelected ? "selected" : ""}`}
              tabIndex={isSelected || (!activeNodeId && n.id === navigation[0]?.id) ? 0 : -1}
              data-node-id={n.id}
              data-quantity-id={n.quantityId ?? undefined}
              data-selected={String(isSelected)}
              aria-label={`${label} (${roleLabel})`}
              aria-pressed={isSelected}
              onClick={() => selectNode(n.id, true)}
            >
              <span className="chip-name">{label}</span>
              <span className="chip-kind">{roleLabel}</span>
            </button>
          );
        })}
      </fieldset>

      {/* Polite live region for screen-reader announcement on navigation */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-a11y-live-status="true"
      >
        {liveAnnouncement}
      </div>

      {/* Inspector for visual and cognitive clarity */}
      {activeTerm && (
        <section
          className="am-term-inspector"
          aria-label="Selected term details"
          data-active-term={activeTerm.nodeId}
        >
          <div className="inspector-head">
            <strong>{activeTerm.name}</strong>
            <span className={`badge badge-${activeTerm.role}`}>{activeTerm.role}</span>
          </div>
          <p className="inspector-speech">{activeTerm.speechText}</p>
          <div className="inspector-meta fine">
            {activeTerm.unit && (
              <span className="meta-item">
                <strong>Unit:</strong> {activeTerm.unit}
              </span>
            )}
            {activeTerm.value && (
              <span className="meta-item">
                <strong>Value:</strong> {activeTerm.value}
              </span>
            )}
            {activeTerm.status && activeTerm.status !== "numeric" && (
              <span className="meta-item badge-status">
                <strong>Status:</strong> {activeTerm.status}
              </span>
            )}
            {activeTerm.fixedOrChanging && (
              <span className="meta-item">
                <strong>Type:</strong> {activeTerm.fixedOrChanging}
              </span>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
