import type { ReactNode } from "react";
import { COMPANION_KINDS, type CompanionKind } from "./companionKind.ts";

const LABELS: Record<CompanionKind, string> = {
  original: "Original",
  explanation: "Explanation",
  equation: "Equation",
  laboratory: "Laboratory",
};

/*
  THE SWITCH IS OFF UNLESS A CALLER CAN SERVE IT. Its four links go to ?companion=<kind>, but the
  export is static: no page can read that query, so every link reloaded the same page, dropped the
  reader's passage from the address, and showed the same companion. Measured on live at 1440 on
  the Brownian reading: Original, Equation and Laboratory each landed on
  /papers/brownian-motion/?companion=<kind> with aria-current still on Explanation and the column
  unchanged. A caller that can render the chosen kind passes `switchable`; nothing does yet, and
  the explanation companion already links the German page and the laboratory.
*/
export function Companion({
  kind,
  children,
  preserve,
  slot,
  switchable = false,
}: {
  kind: CompanionKind;
  children: ReactNode;
  preserve?: { anchor?: string; term?: string };
  slot?: "column" | "sheet" | undefined;
  switchable?: boolean | undefined;
}) {
  const params = new URLSearchParams();
  if (preserve?.anchor) params.set("anchor", preserve.anchor);
  if (preserve?.term) params.set("term", preserve.term);
  const suffix = params.toString();
  const navLabel =
    slot === "sheet"
      ? "Companion view (bottom sheet)"
      : slot === "column"
        ? "Companion view (side column)"
        : "Companion view";
  return (
    <div data-companion="" data-companion-kind={kind}>
      {switchable ? (
        <nav className="reader-companion-nav" aria-label={navLabel}>
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
      ) : null}
      {children}
    </div>
  );
}
