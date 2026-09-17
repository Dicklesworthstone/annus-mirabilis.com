/**
 * Derivation Chain Renderer Component (am-eq-derivation-renderer-9gd7).
 *
 * Renders verified mathematical derivation chains with the marked move,
 * perspective-aware route choosing, accessible step list, keyboard navigation,
 * and detail-axis reason switching.
 */

import React, { useEffect, useRef, useState } from "react";
import { DerivationStepComponent } from "./DerivationStepComponent.tsx";
import {
  filterRoutesForPerspective,
  getRouteLabel,
  selectRoute,
} from "./routeChooser.ts";
import {
  announceStepExpanded,
  handleStepKeyDown,
  parseDerivationStepParam,
} from "./stepFocus.ts";
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

  // Handle direct link to a step
  useEffect(() => {
    if (initialOpenStepId) {
      const parsed = parseDerivationStepParam(initialOpenStepId);
      const stepId = parsed ? parsed.stepId : initialOpenStepId;
      const targetIndex = currentChain.steps.findIndex((s) => s.id === stepId);
      if (targetIndex >= 0) {
        setFocusedStepIndex(targetIndex);
        setExpandedSteps((prev) => new Set([...prev, stepId]));
      }
    }
  }, [initialOpenStepId, currentChain]);

  function handleRouteTabClick(routeId: string) {
    setSelectedRouteId(routeId);
    setFocusedStepIndex(-1);
    onRouteSelect?.(routeId);
  }

  function toggleLocalExpand(stepId: string, index: number) {
    const step = currentChain.steps[index];
    const isNowExpanded = !expandedSteps.has(stepId);

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
        if (step) toggleLocalExpand(step.id, index);
      },
      onExitFocusMode: () => {
        setFocusedStepIndex(-1);
        containerRef.current?.querySelector<HTMLElement>("summary")?.focus();
      },
    });
  }

  return (
    <div
      ref={containerRef}
      className="derivation-container"
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
        <ol className="derivation-steps-list" role="list">
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
              onToggleLocalExpand={() => toggleLocalExpand(step.id, index)}
              onStepFocus={() => setFocusedStepIndex(index)}
            />
          ))}
        </ol>
      </details>
    </div>
  );
}

export { DerivationChainComponent as DerivationChain };
