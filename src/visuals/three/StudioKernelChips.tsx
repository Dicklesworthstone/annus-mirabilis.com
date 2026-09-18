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

import { type CSSProperties, useEffect, useId, useRef, useState } from "react";

function ActivityIcon({ style }: { readonly style?: CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <polyline
        points="22 12 18 12 15 21 9 3 6 12 2 12"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronUpIcon({ style }: { readonly style?: CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <polyline
        points="18 15 12 9 6 15"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon({ style }: { readonly style?: CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
  const isTop = placement === "top";
  const isCompact = width === "compact";
  const maxWidth =
    shouldAutoCollapse && isExpanded
      ? "min(calc(100vw - 2rem), 22rem)"
      : effectiveSide === "right"
        ? isCompact
          ? "17rem"
          : "min(calc(100% - 25rem), 28rem)"
        : "min(calc(100% - 1.5rem), 28rem)";

  if (shouldAutoCollapse && !isExpanded) {
    return (
      <div
        ref={chipContainerRef}
        data-testid="studio-kernel-chips-collapsed"
        style={{
          position: "absolute",
          bottom: "1rem",
          right: "1rem",
          zIndex: 10,
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.375rem 0.625rem",
            borderRadius: "0.75rem",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-sans, sans-serif)",
            fontWeight: 600,
            color: "var(--accent)",
            cursor: "pointer",
            transition: "background-color 150ms, transform 150ms",
          }}
          title="Open Telemetry Chips"
          aria-label="Open Telemetry Chips"
          aria-expanded={false}
          aria-controls={titleId}
        >
          <ActivityIcon style={{ width: "0.875rem", height: "0.875rem", color: "var(--accent)" }} />
          <span>{title ?? "Readouts"}</span>
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.5625rem",
              padding: "0.125rem 0.25rem",
              background: "var(--wash)",
              borderRadius: "0.25rem",
              color: "var(--ink)",
            }}
          >
            {chips.length}
          </span>
          <ChevronUpIcon
            style={{
              width: "0.75rem",
              height: "0.75rem",
              marginLeft: "0.125rem",
              color: "var(--muted)",
            }}
          />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={chipContainerRef}
      id={titleId}
      data-side={effectiveSide}
      data-placement={placement}
      data-width={width}
      style={{
        position: "absolute",
        top: isTop ? "5rem" : undefined,
        bottom: !isTop ? "1rem" : undefined,
        left: effectiveSide === "left" ? "1rem" : undefined,
        right: effectiveSide === "right" ? "1rem" : undefined,
        maxWidth,
        zIndex: 10,
        pointerEvents: "auto",
        boxShadow:
          shouldAutoCollapse && isExpanded ? "0 20px 25px -5px rgba(0, 0, 0, 0.2)" : undefined,
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--line)",
          borderRadius: "0.75rem",
          padding: "0.5rem 0.75rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.375rem",
            marginBottom: "0.375rem",
          }}
        >
          <div
            className="eyebrow"
            style={{
              fontSize: "0.625rem",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--accent)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title ?? "SI Telemetry"}
          </div>
          {shouldAutoCollapse && isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              style={{
                padding: "0.25rem",
                borderRadius: "0.375rem",
                color: "var(--muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              title="Collapse Chips"
              aria-label="Collapse Chips"
            >
              <XIcon style={{ width: "0.875rem", height: "0.875rem" }} />
            </button>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            maxHeight: "140px",
            overflowY: "auto",
          }}
        >
          {chips.map((c) => {
            const tone = c.tone ?? "ok";
            return (
              <div
                key={c.label}
                data-tone={tone}
                style={{
                  borderRadius: "0.5rem",
                  padding: "0.25rem 0.5rem",
                  border:
                    tone === "warn" || tone === "hot"
                      ? "1px solid var(--accent)"
                      : "1px solid var(--line)",
                  background: "var(--wash)",
                  color: tone === "warn" || tone === "hot" ? "var(--accent)" : "var(--ink)",
                }}
              >
                <div
                  className="fine"
                  style={{
                    fontSize: "0.5625rem",
                    lineHeight: 1.2,
                    color: tone === "warn" || tone === "hot" ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {c.label}
                </div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: "bold",
                    lineHeight: 1.2,
                  }}
                >
                  {c.value}
                  {c.unit ? (
                    <span
                      style={{
                        fontWeight: "normal",
                        color:
                          tone === "warn" || tone === "hot" ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {" "}
                      {c.unit}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
