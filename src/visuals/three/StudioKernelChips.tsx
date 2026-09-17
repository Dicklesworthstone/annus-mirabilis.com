/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/components/patents/visuals/three/StudioKernelChips.tsx
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Decoupled patent-specific branding to generic Annus Mirabilis telemetry readouts.
 * - Replaced lucide-react icons with inline SVG icons.
 * - Preserved responsive HUD overlay management and display area budget bounds.
 */

"use client";

import { useEffect, useId, useRef, useState } from "react";

function ActivityIcon({ className = "w-3.5 h-3.5" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polyline
        points="22 12 18 12 15 21 9 3 6 12 2 12"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronUpIcon({ className = "w-3 h-3" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polyline
        points="18 15 12 9 6 15"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon({ className = "w-3.5 h-3.5" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export type KernelChip = {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly tone?: "ok" | "warn" | "hot";
};

export type StudioHudLayoutState = {
  readonly isTabletOrMobile: boolean;
  readonly isCompact: boolean;
  readonly containerWidth: number;
};

export function useResponsiveStudioHud(
  initialDesktop: boolean = true,
  options?: { readonly minDesktopWidth?: number },
) {
  const [showUiOverlay, setShowUiOverlay] = useState<boolean>(initialDesktop);
  const minWidth = options?.minDesktopWidth ?? 880;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isTouchTablet =
      (window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(hover: none)").matches) &&
      window.innerWidth <= 1024;

    const isConstrained = window.innerWidth < minWidth || isTouchTablet;
    setShowUiOverlay(!isConstrained);
  }, [minWidth]);

  return {
    showUiOverlay,
    setShowUiOverlay,
    toggleUiOverlay: () => setShowUiOverlay((prev) => !prev),
  };
}

export type StudioKernelChipsProps = {
  readonly visible?: boolean;
  readonly title?: string;
  readonly chips: readonly KernelChip[];
  readonly side?: "left" | "right";
  readonly placement?: "bottom" | "top";
  readonly width?: "standard" | "compact";
  readonly hasPrimaryHud?: boolean;
  readonly priority?: "essential" | "primary" | "secondary";
  readonly collapsible?: boolean;
};

export function StudioKernelChips({
  visible = true,
  title,
  chips,
  side = "right",
  placement = "bottom",
  width = "standard",
  hasPrimaryHud = true,
  priority = "secondary",
  collapsible = true,
}: StudioKernelChipsProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  const chipContainerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const parent = chipContainerRef.current?.closest(
      "div.relative.flex-1, div.cursor-grab, div.relative",
    );

    const updateDimensions = () => {
      if (parent) {
        const rect = parent.getBoundingClientRect();
        if (rect.width > 0) {
          setContainerWidth(rect.width);
          return;
        }
      }
      setContainerWidth(window.innerWidth);
    };

    updateDimensions();

    let ro: ResizeObserver | null = null;
    if (parent && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setContainerWidth(entry.contentRect.width);
          }
        }
      });
      ro.observe(parent);
    }

    window.addEventListener("resize", updateDimensions);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  if (!visible || chips.length === 0) return null;

  const isConstrained = containerWidth < 920;
  const shouldAutoCollapse =
    isConstrained && hasPrimaryHud && priority === "secondary" && collapsible;

  const effectiveSide = hasPrimaryHud && side === "left" ? "right" : side;
  const verticalPlacement = placement === "top" ? "top-20 sm:top-20" : "bottom-3 sm:bottom-4";
  const rightWidth = width === "compact" ? "max-w-[17rem]" : "max-w-[min(calc(100%-25rem),28rem)]";

  if (shouldAutoCollapse && !isExpanded) {
    return (
      <div
        ref={chipContainerRef}
        className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 pointer-events-auto"
      >
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/95 dark:bg-ink-900/95 backdrop-blur-md border border-amber-700/30 dark:border-amber-500/30 shadow-md text-[10px] sm:text-xs font-sans font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-ink-800 transition-[background-color,transform] hover:scale-105 active:scale-95 cursor-pointer"
          title="Open Telemetry Chips"
          aria-label="Open Telemetry Chips"
          aria-expanded={false}
          aria-controls={titleId}
        >
          <ActivityIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden xs:inline">{title ?? "Readouts"}</span>
          <span className="xs:hidden">SI</span>
          <span className="font-mono text-[9px] px-1 py-0.5 bg-amber-200/60 dark:bg-amber-900/60 rounded text-amber-950 dark:text-amber-100">
            {chips.length}
          </span>
          <ChevronUpIcon className="w-3 h-3 ml-0.5 text-ink-400" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={chipContainerRef}
      id={titleId}
      className={`absolute ${verticalPlacement} z-10 pointer-events-auto ${
        effectiveSide === "right"
          ? `right-3 sm:right-4 ${rightWidth}`
          : "left-3 sm:left-4 max-w-[min(100%-1.5rem,28rem)]"
      } ${shouldAutoCollapse && isExpanded ? "max-w-[min(calc(100vw-2rem),22rem)] shadow-xl" : ""}`}
    >
      <div className="bg-white/95 dark:bg-ink-900/95 backdrop-blur-md border border-parchment-300 dark:border-ink-700 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-md">
        <div className="flex items-center justify-between gap-1.5 mb-1 sm:mb-1.5">
          <div className="text-[9px] sm:text-[10px] font-sans font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate">
            {title ?? "SI Telemetry"}
          </div>
          {shouldAutoCollapse && isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-md text-ink-500 hover:text-ink-900 dark:hover:text-parchment-100 hover:bg-parchment-200 dark:hover:bg-ink-800 transition-colors cursor-pointer"
              title="Collapse Chips"
              aria-label="Collapse Chips"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2 max-h-[140px] sm:max-h-none overflow-y-auto scrollbar-none">
          {chips.map((c) => (
            <div
              key={c.label}
              className={`rounded-lg px-1.5 py-0.5 sm:px-2 sm:py-1 border ${
                c.tone === "warn"
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-200"
                  : c.tone === "hot"
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200"
                    : "bg-parchment-100/80 dark:bg-ink-800/80 border-parchment-200 dark:border-ink-700 text-ink-800 dark:text-parchment-100"
              }`}
            >
              <div className="text-[8px] sm:text-[9px] font-sans text-ink-500 dark:text-parchment-400 leading-tight">
                {c.label}
              </div>
              <div className="text-[10px] sm:text-[11px] font-mono font-bold leading-tight">
                {c.value}
                {c.unit ? (
                  <span className="text-ink-500 dark:text-parchment-400 font-normal">
                    {" "}
                    {c.unit}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
