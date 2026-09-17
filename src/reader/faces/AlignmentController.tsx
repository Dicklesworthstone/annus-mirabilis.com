"use client";

import { useEffect, useRef, useState } from "react";
import {
  type AlignmentIndex,
  getAlignedSources,
  getAlignedTargets,
  getSentenceIndex,
} from "./alignment.ts";

export interface AlignmentControllerProps {
  readonly index: AlignmentIndex;
  readonly containerSelector?: string | undefined;
}

/**
 * Client island that manages sentence-level bidirectional alignment highlighting
 * between German source sentences and English translation units.
 * Also enables keyboard sentence navigation (j/k or ArrowDown/ArrowUp).
 */
export function AlignmentController({
  index,
  containerSelector = "[data-reader-root]",
}: AlignmentControllerProps) {
  const [announcement, setAnnouncement] = useState("");
  const pinnedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const root = document.querySelector(containerSelector) || document.body;

    function clearHighlights() {
      const activeEls = root.querySelectorAll("[data-aligned-active]");
      for (const el of activeEls) {
        el.removeAttribute("data-aligned-active");
      }
      const partnerEls = root.querySelectorAll("[data-aligned-partner]");
      for (const el of partnerEls) {
        el.removeAttribute("data-aligned-partner");
      }
    }

    function applyHighlights(id: string, kind: "source" | "target") {
      clearHighlights();

      if (kind === "source") {
        const sourceEl = root.querySelector(`[data-sentence-id="${id}"]`) || root.querySelector(`[data-block-id="${id}"]`);
        if (sourceEl) {
          sourceEl.setAttribute("data-aligned-active", "true");
        }

        const targets = getAlignedTargets(index, id);
        for (const tid of targets) {
          const targetEl = root.querySelector(`[data-translation-unit-id="${tid}"]`);
          if (targetEl) {
            targetEl.setAttribute("data-aligned-partner", "true");
          }
        }

        if (targets.length > 0) {
          setAnnouncement(`Source sentence ${id} aligned to translation ${targets.join(", ")}.`);
        }
      } else {
        const targetEl = root.querySelector(`[data-translation-unit-id="${id}"]`);
        if (targetEl) {
          targetEl.setAttribute("data-aligned-active", "true");
        }

        const sources = getAlignedSources(index, id);
        for (const sid of sources) {
          const sourceEl = root.querySelector(`[data-sentence-id="${sid}"]`) || root.querySelector(`[data-block-id="${sid}"]`);
          if (sourceEl) {
            sourceEl.setAttribute("data-aligned-partner", "true");
          }
        }

        if (sources.length > 0) {
          setAnnouncement(`Translation unit ${id} aligned to source ${sources.join(", ")}.`);
        }
      }
    }

    function handleMouseOver(e: MouseEvent) {
      if (pinnedIdRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const sentenceEl = target.closest<HTMLElement>("[data-source-sentence]");
      if (sentenceEl) {
        const sid = sentenceEl.getAttribute("data-sentence-id") || sentenceEl.id;
        if (sid) applyHighlights(sid, "source");
        return;
      }

      const unitEl = target.closest<HTMLElement>("[data-translation-unit-id]");
      if (unitEl) {
        const uid = unitEl.getAttribute("data-translation-unit-id") || unitEl.id;
        if (uid) applyHighlights(uid, "target");
      }
    }

    function handleMouseOut(e: MouseEvent) {
      if (pinnedIdRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const sentenceEl = target.closest<HTMLElement>("[data-source-sentence]");
      const unitEl = target.closest<HTMLElement>("[data-translation-unit-id]");
      if (sentenceEl || unitEl) {
        clearHighlights();
      }
    }

    function handleFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const sentenceEl = target.closest<HTMLElement>("[data-source-sentence]");
      if (sentenceEl) {
        const sid = sentenceEl.getAttribute("data-sentence-id") || sentenceEl.id;
        if (sid) applyHighlights(sid, "source");
        return;
      }

      const unitEl = target.closest<HTMLElement>("[data-translation-unit-id]");
      if (unitEl) {
        const uid = unitEl.getAttribute("data-translation-unit-id") || unitEl.id;
        if (uid) applyHighlights(uid, "target");
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      // Sentence navigation keys: 'j' (down/next), 'k' (up/prev)
      if (e.key === "j" || (e.key === "ArrowDown" && e.altKey)) {
        e.preventDefault();
        const currentActive = root.querySelector("[data-aligned-active]");
        const currentId = currentActive?.getAttribute("data-sentence-id") || currentActive?.id;
        const currentIdx = currentId ? getSentenceIndex(index, currentId) : -1;
        const nextIdx = Math.min(currentIdx + 1, index.orderedSentenceIds.length - 1);
        const nextId = index.orderedSentenceIds[nextIdx];
        if (nextId) {
          const el = root.querySelector<HTMLElement>(`[data-sentence-id="${nextId}"]`);
          if (el) {
            el.focus();
            applyHighlights(nextId, "source");
          }
        }
      } else if (e.key === "k" || (e.key === "ArrowUp" && e.altKey)) {
        e.preventDefault();
        const currentActive = root.querySelector("[data-aligned-active]");
        const currentId = currentActive?.getAttribute("data-sentence-id") || currentActive?.id;
        const currentIdx = currentId ? getSentenceIndex(index, currentId) : 0;
        const prevIdx = Math.max(currentIdx - 1, 0);
        const prevId = index.orderedSentenceIds[prevIdx];
        if (prevId) {
          const el = root.querySelector<HTMLElement>(`[data-sentence-id="${prevId}"]`);
          if (el) {
            el.focus();
            applyHighlights(prevId, "source");
          }
        }
      } else if (e.key === "Escape") {
        pinnedIdRef.current = null;
        clearHighlights();
      }
    }

    root.addEventListener("mouseover", handleMouseOver as EventListener);
    root.addEventListener("mouseout", handleMouseOut as EventListener);
    root.addEventListener("focusin", handleFocusIn as EventListener);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      root.removeEventListener("mouseover", handleMouseOver as EventListener);
      root.removeEventListener("mouseout", handleMouseOut as EventListener);
      root.removeEventListener("focusin", handleFocusIn as EventListener);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [index, containerSelector]);

  return (
    <div
      className="alignment-live-region visually-hidden"
      role="status"
      aria-live="polite"
      data-alignment-live-region="true"
    >
      {announcement}
    </div>
  );
}
