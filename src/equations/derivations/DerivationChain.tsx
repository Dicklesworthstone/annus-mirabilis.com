/**
 * Derivation Chain Renderer Component (am-eq-derivation-renderer-9gd7).
 *
 * Renders verified mathematical derivation chains with the marked move,
 * perspective-aware route choosing, accessible step list, keyboard navigation,
 * and detail-axis reason switching.
 */

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { DerivationStepComponent } from "./DerivationStepComponent.tsx";
import { filterRoutesForPerspective, getRouteLabel, selectRoute } from "./routeChooser.ts";
import { announceStepExpanded, handleStepKeyDown, parseDerivationStepParam } from "./stepFocus.ts";
import { derivationStepFromHash, revealDerivationStep } from "./stepFragment.ts";
import type { DerivationChain } from "./types.ts";
import "./derivation.css";

export interface DerivationChainProps {
  readonly chains: readonly DerivationChain[];
  readonly activeRouteId?: string | undefined;
  readonly perspective?: "historical" | "modern" | undefined;
  readonly activeDetail?: "0" | "1" | "2" | undefined;
  readonly initialOpenStepId?: string | undefined;
  readonly isProduction?: boolean | undefined;
  readonly onRouteSelect?: (routeId: string) => void;
}

export function DerivationChainComponent({
  chains,
  activeRouteId,
  perspective = "historical",
  activeDetail = "1",
  initialOpenStepId,
  isProduction = true,
  onRouteSelect,
}: DerivationChainProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(activeRouteId);
  const [focusedStepIndex, setFocusedStepIndex] = useState<number>(-1);
  const [expandedSteps, setExpandedSteps] = useState<ReadonlySet<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter available routes by active perspective
  const availableChains = filterRoutesForPerspective(chains, perspective);

  // Select active chain (fails fast if invalid routeId requested)
  const currentChain = selectRoute(chains, selectedRouteId, perspective);

  // Sync prop changes
  useEffect(() => {
    if (activeRouteId) {
      setSelectedRouteId(activeRouteId);
    }
  }, [activeRouteId]);

  // Both the reader's open parameter and a native fragment can address a published step.
  useEffect(() => {
    function openStep(stepId: string, focus: boolean) {
      const targetIndex = currentChain.steps.findIndex((step) => step.id === stepId);
      if (targetIndex < 0) return;
      setFocusedStepIndex(targetIndex);
      setExpandedSteps((previous) =>
        previous.has(stepId) ? previous : new Set([...previous, stepId]),
      );
      if (focus) {
        const target = containerRef.current?.querySelector<HTMLElement>(
          `[data-step-id="${stepId}"]`,
        );
        if (target) revealDerivationStep(target);
      }
    }

    if (initialOpenStepId) {
      const parsed = parseDerivationStepParam(initialOpenStepId);
      if (!parsed || parsed.chainId === currentChain.id) {
        openStep(parsed ? parsed.stepId : initialOpenStepId, false);
      }
    }

    function followFragment() {
      const stepId = derivationStepFromHash(window.location.hash);
      if (stepId) openStep(stepId, true);
    }
    followFragment();
    window.addEventListener("hashchange", followFragment);
    window.addEventListener("popstate", followFragment);
    return () => {
      window.removeEventListener("hashchange", followFragment);
      window.removeEventListener("popstate", followFragment);
    };
  }, [initialOpenStepId, currentChain]);

  function handleRouteTabClick(routeId: string) {
    setSelectedRouteId(routeId);
    setFocusedStepIndex(-1);
    onRouteSelect?.(routeId);
  }

  function setLocalExpansion(stepId: string, index: number, isNowExpanded: boolean) {
    if (isNowExpanded === expandedSteps.has(stepId)) return;
    const step = currentChain.steps[index];

    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (isNowExpanded) {
        next.add(stepId);
      } else {
        next.delete(stepId);
      }
      return next;
    });

    if (isNowExpanded && step) {
      announceStepExpanded(index + 1, step.rule.kind, step.isMove);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (focusedStepIndex < 0) return;

    handleStepKeyDown(e, focusedStepIndex, currentChain.steps.length, {
      onFocusStep: (index) => {
        setFocusedStepIndex(index);
        const stepEl = containerRef.current?.querySelector<HTMLElement>(
          `[data-step-id="${currentChain.steps[index]?.id}"]`,
        );
        stepEl?.focus();
      },
      onToggleExpand: (index) => {
        const step = currentChain.steps[index];
        if (step) setLocalExpansion(step.id, index, !expandedSteps.has(step.id));
      },
      onExitFocusMode: () => {
        setFocusedStepIndex(-1);
        containerRef.current?.querySelector<HTMLElement>("summary")?.focus();
      },
    });
  }

  return (
    <section
      ref={containerRef}
      className="derivation-container"
      aria-label="Derivation chain"
      data-derivation-chain={currentChain.id}
      data-route-id={currentChain.proofRouteId}
      data-route-kind={currentChain.routeKind}
      onKeyDown={handleKeyDown}
    >
      <details className="derivation-disclosure" open>
        <summary>Show the derivation</summary>

        {/* Route Chooser Tabs when multiple routes exist */}
        {availableChains.length > 1 && (
          <div className="derivation-routes" role="tablist" aria-label="Derivation routes">
            {availableChains.map((c) => {
              const isSelected = c.id === currentChain.id;
              const label = getRouteLabel(c.routeKind, perspective);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  className={`route-tab-btn ${isSelected ? "is-active" : ""}`}
                  aria-selected={isSelected}
                  data-route-id={c.proofRouteId}
                  data-route-kind={c.routeKind}
                  onClick={() => handleRouteTabClick(c.id)}
                >
                  {label}: {c.proofRouteId}
                </button>
              );
            })}
          </div>
        )}

        {/* Ordered Step List */}
        <ol className="derivation-steps-list">
          {currentChain.steps.map((step, index) => (
            <DerivationStepComponent
              key={step.id}
              step={step}
              index={index}
              chainId={currentChain.id}
              activeDetail={activeDetail}
              isLocallyExpanded={expandedSteps.has(step.id)}
              isFocused={focusedStepIndex === index}
              isProduction={isProduction}
              onToggleLocalExpand={(open) => setLocalExpansion(step.id, index, open)}
              onStepFocus={() => setFocusedStepIndex(index)}
            />
          ))}
        </ol>
      </details>
    </section>
  );
}

export { DerivationChainComponent as DerivationChain };
