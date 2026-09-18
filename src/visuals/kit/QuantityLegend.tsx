import type { ReactElement } from "react";
import "./legends.css";

export type LegendSymbolShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "solid-line"
  | "dashed-line"
  | "dotted-line";

const SYMBOL_CLASS_MAP: Record<LegendSymbolShape, string> = {
  circle: "symbol-circle",
  square: "symbol-square",
  triangle: "symbol-triangle",
  diamond: "symbol-diamond",
  "solid-line": "symbol-solid-line",
  "dashed-line": "symbol-dashed-line",
  "dotted-line": "symbol-dotted-line",
};

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
      {title && <span className="legend-title">{title}:</span>}
      <ul className="legend-list">
        {entries.map((entry) => {
          const shape = entry.symbolShape || "circle";
          const symbolClass = SYMBOL_CLASS_MAP[shape] ?? "symbol-circle";
          return (
            <li
              key={entry.quantityId}
              className={`legend-item ${entry.isHighlighted ? "is-highlighted" : ""}`.trim()}
              data-quantity-id={entry.quantityId}
              data-role={entry.role}
            >
              {/* Non-color symbol badge */}
              <span
                className={`legend-symbol ${symbolClass}`}
                style={{
                  backgroundColor: entry.roleColor || "currentColor",
                  border: entry.role ? "1px solid currentColor" : undefined,
                }}
                aria-hidden="true"
              />
              <span className="legend-label">
                {entry.label}
                {entry.unit && <span className="legend-unit">[{entry.unit}]</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
