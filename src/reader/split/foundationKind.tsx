"use client";

import { useEffect, useRef } from "react";
import { lessonPageHref, loadLessonBody, type MountedConstruction } from "../lessonBody.ts";
import { getClarificationKind, registerClarificationKind } from "../stack/kinds.ts";
import {
  SPLIT_CLARIFICATIONS_DISPOSE,
  type SplitFoundation,
  splitFoundation,
} from "./clarificationTargets.ts";

type SplitLesson = SplitFoundation & Readonly<{ reader: HTMLElement }>;

function lessonSlot(reader: HTMLElement, id: string): HTMLElement {
  let cache = reader.querySelector<HTMLElement>("[data-split-lesson-cache]");
  if (!cache) {
    cache = reader.ownerDocument.createElement("div");
    cache.dataset.splitLessonCache = "";
    cache.hidden = true;
    reader.append(cache);
  }
  const retained = [...cache.querySelectorAll<HTMLElement>("[data-lesson-body]")].find(
    (slot) => slot.dataset.lessonBody === id,
  );
  if (retained && retained.dataset.lessonState !== "failed") return retained;
  retained?.remove();
  const slot = reader.ownerDocument.createElement("div");
  slot.dataset.lessonBody = id;
  const pending = reader.ownerDocument.createElement("p");
  pending.className = "fine";
  pending.textContent = "Loading the lesson.";
  slot.append(pending);
  cache.append(slot);
  const loading = new AbortController();
  const constructions = new Set<MountedConstruction>();
  reader.addEventListener(
    SPLIT_CLARIFICATIONS_DISPOSE,
    () => {
      loading.abort();
      for (const construction of constructions) construction.unmount();
      slot.remove();
    },
    { once: true },
  );
  void loadLessonBody(slot, {
    signal: loading.signal,
    onMount: (construction) => constructions.add(construction),
  });
  return slot;
}

function FoundationClarification({ foundation }: { foundation: SplitLesson }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const slot = lessonSlot(foundation.reader, foundation.id);
    container.replaceChildren(slot);
    return () => {
      // Keep the actual controls, their answers and trigger ids while another lesson is open.
      foundation.reader.querySelector("[data-split-lesson-cache]")?.append(slot);
    };
  }, [foundation.id, foundation.reader]);

  return (
    <section data-split-foundation={foundation.id}>
      <h2 data-clarification-heading tabIndex={-1}>
        {foundation.title}
      </h2>
      <div ref={host} />
      <p className="fine">
        <a href={lessonPageHref(foundation.id)}>Open this lesson on its own</a>
      </p>
    </section>
  );
}

/** Lazy, additive registration. The ordinary reader keeps its established foundation owner. */
export function registerSplitFoundationKind(): void {
  if (getClarificationKind("foundation")) return;
  registerClarificationKind<SplitLesson>("foundation", {
    parseId: (id) => {
      if (typeof document === "undefined") return null;
      const root = document.querySelector<HTMLElement>("[data-reader-root][data-view=split]");
      const foundation = root ? splitFoundation(root, id) : null;
      return root && foundation ? { ...foundation, reader: root } : null;
    },
    render: ({ parsed }) => <FoundationClarification foundation={parsed} />,
    staticHref: ({ id }) => lessonPageHref(id),
    title: ({ title }) => title,
    descends: true,
  });
}
