"use client";

/**
 * Defers mounting a live instrument until an explicit load when reading-only
 * is on (am-a11y-reading-only-6wwd). The server and first hydration render
 * wait for the pre-paint preference before touching a lazy view. Turning
 * reading-only off restores autoload; turning it on again requires a new
 * explicit load. The static worked case stays outside this live region.
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
  const [gate, setGate] = useState<{
    readingOnly: boolean | null;
    explicitLoad: boolean;
  }>({ readingOnly: readingOnlyProp ?? null, explicitLoad: false });

  useEffect(() => {
    const sync = () => {
      const next = readingOnlyProp ?? readReadingOnlyFlag();
      setGate((previous) =>
        previous.readingOnly === next
          ? previous
          : { readingOnly: next, explicitLoad: false },
      );
    };
    sync();
    if (readingOnlyProp !== undefined) {
      return;
    }
    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-reading-only"] });
    return () => observer.disconnect();
  }, [readingOnlyProp]);

  // A changed controlled preference takes effect during this render, before child effects can
  // start resources. Its old explicit-load grant belongs to the previous preference only.
  const readingOnly = readingOnlyProp ?? gate.readingOnly;
  const explicitLoad = gate.readingOnly === readingOnly && gate.explicitLoad;
  const trigger: LoadTrigger = explicitLoad ? "explicit" : "autoload";
  const showLive = readingOnly !== null && shouldCreateWorker(readingOnly, trigger);

  return (
    <div
      data-reading-only-instrument={
        readingOnly === null ? "pending" : readingOnly ? "on" : "off"
      }
    >
      {!showLive && readingOnly !== null && (
        <p>
          <button
            type="button"
            data-load-experiment
            onClick={() => setGate({ readingOnly, explicitLoad: true })}
          >
            Load this experiment
          </button>
        </p>
      )}
      {showLive ? children : null}
    </div>
  );
}
