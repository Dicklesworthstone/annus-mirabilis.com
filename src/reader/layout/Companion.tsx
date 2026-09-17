import type { ReactNode } from "react";
import { COMPANION_KINDS, type CompanionKind } from "./companionKind.ts";

const LABELS: Record<CompanionKind, string> = {
  original: "Original",
  explanation: "Explanation",
  equation: "Equation",
  laboratory: "Laboratory",
};

export function Companion({
  kind,
  children,
  preserve,
}: {
  kind: CompanionKind;
  children: ReactNode;
  preserve?: { anchor?: string; term?: string };
}) {
  const params = new URLSearchParams();
  if (preserve?.anchor) params.set("anchor", preserve.anchor);
  if (preserve?.term) params.set("term", preserve.term);
  const suffix = params.toString();
  return (
    <div data-companion="" data-companion-kind={kind}>
      <nav className="reader-companion-nav" aria-label="Companion view">
        {COMPANION_KINDS.map((item) => {
          const query = new URLSearchParams(suffix);
          query.set("companion", item);
          return (
            <a
              key={item}
              href={`?${query.toString()}`}
              aria-current={item === kind ? "page" : undefined}
              aria-label={`Companion: ${LABELS[item]}`}
            >
              {LABELS[item]}
            </a>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
