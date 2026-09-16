import type { ReactElement } from "react";

export type LegendSymbolShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "solid-line"
  | "dashed-line"
  | "dotted-line";

export interface QuantityLegendEntry {
  readonly quantityId: string;
  readonly label: string;
  readonly roleColor?: string | undefined;
  readonly symbolShape?: LegendSymbolShape | undefined;
  readonly unit?: string | undefined;
  readonly role?: "premise" | "move" | "conclusion" | "countermodel" | string | undefined;
  readonly isHighlighted?: boolean | undefined;
}

export interface QuantityLegendProps {
  readonly entries: readonly QuantityLegendEntry[];
  readonly title?: string | undefined;
  readonly className?: string | undefined;
  readonly orientation?: "horizontal" | "vertical" | undefined;
}

export function QuantityLegend({
  entries,
  title = "Quantities",
  className = "",
  orientation = "horizontal",
}: QuantityLegendProps): ReactElement {
  return (
    <section
      className={`quantity-legend ${orientation === "vertical" ? "legend-vertical" : "legend-horizontal"} ${className}`.trim()}
      aria-label={title}
    >
      {title && (
        <span className="legend-title font-semibold text-xs text-neutral-600 dark:text-neutral-400 mr-2">
          {title}:
        </span>
      )}
      <ul className="legend-list flex flex-wrap gap-3 list-none p-0 m-0">
        {entries.map((entry) => {
          const shape = entry.symbolShape || "circle";
          return (
            <li
              key={entry.quantityId}
              className={`legend-item flex items-center gap-1.5 text-xs ${entry.isHighlighted ? "is-highlighted font-semibold" : ""}`.trim()}
              data-quantity-id={entry.quantityId}
              data-role={entry.role}
            >
              {/* Non-color symbol badge */}
              <span
                className={`legend-symbol symbol-${shape} inline-block w-3 h-3 flex-shrink-0`}
                style={{
                  backgroundColor: entry.roleColor || "currentColor",
                  border: entry.role ? "1px solid currentColor" : undefined,
                }}
                aria-hidden="true"
              />
              <span className="legend-label">
                {entry.label}
                {entry.unit && (
                  <span className="legend-unit text-neutral-500 ml-0.5">[{entry.unit}]</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
