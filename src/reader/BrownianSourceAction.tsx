"use client";

import { useEffect, useState } from "react";
import { useBrownianLab } from "./BrownianLabContext.tsx";
import { useBrownianSource } from "./BrownianSourceContext.tsx";
import { usePinnedEquations } from "./layout/PinnedEquationContext.tsx";

/** A canonical link without scripts; after hydration it opens that exact binding beside the text. */
export function BrownianSourceAction({ passageId }: { passageId: string }) {
  const source = useBrownianSource();
  const lab = useBrownianLab();
  const pins = usePinnedEquations();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const passage = source?.passages.find((item) => item.id === passageId);
  const target = passage?.targets[0];
  if (!source || !target) return null;
  return (
    <p className="brownian-source-action">
      <a
        href={target.germanHref}
        data-brownian-source-action={passageId}
        onClick={(event) => {
          if (
            !ready ||
            !lab ||
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          if (!source.select(passageId)) return;
          event.preventDefault();
          pins?.showPinned(false);
          lab.showMode("original");
          source.reveal(event.currentTarget);
        }}
      >
        Show this passage’s original
      </a>
    </p>
  );
}
