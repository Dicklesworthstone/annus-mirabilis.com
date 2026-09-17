"use client";

/**
 * Defers mounting a live instrument until an explicit load when reading-only
 * is on (am-a11y-reading-only-6wwd). Turning reading-only off restores
 * autoload without a reload. The static worked case is a sibling, not a
 * substitute: this component never removes explanations.
 */

import { type ReactNode, useEffect, useState } from "react";
import { type LoadTrigger, shouldCreateWorker } from "./schedulerBinding.ts";
import { parseReadingOnly } from "./schema.ts";

function readReadingOnlyFlag(): boolean {
  try {
    if (typeof document === "undefined") return false;
    return parseReadingOnly(document.documentElement.dataset.readingOnly);
  } catch {
    return false;
  }
}

export function ReadingOnlyView({
  children,
  readingOnly: readingOnlyProp,
}: {
  children: ReactNode;
  readingOnly?: boolean;
}) {
  const [readingOnly, setReadingOnly] = useState(readingOnlyProp ?? false);
  const [explicitLoad, setExplicitLoad] = useState(false);

  useEffect(() => {
    if (readingOnlyProp !== undefined) {
      setReadingOnly(readingOnlyProp);
      return;
    }
    const sync = () => setReadingOnly(readReadingOnlyFlag());
    sync();
    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-reading-only"] });
    return () => observer.disconnect();
  }, [readingOnlyProp]);

  const trigger: LoadTrigger = explicitLoad ? "explicit" : "autoload";
  const showLive = shouldCreateWorker(readingOnly, trigger);

  return (
    <div data-reading-only-instrument={readingOnly ? "on" : "off"}>
      {!showLive && (
        <p>
          <button type="button" data-load-experiment onClick={() => setExplicitLoad(true)}>
            Load this experiment
          </button>
        </p>
      )}
      {showLive ? children : null}
    </div>
  );
}
