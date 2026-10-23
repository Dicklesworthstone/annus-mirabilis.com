"use client";

import { useEffect, useRef, useState } from "react";
import { type AlignmentIndex, getAlignedSources, getAlignedTargets } from "./alignment.ts";
import { computeHighlights, nextSentenceId, prevSentenceId } from "./alignmentHighlight.ts";

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
  const lastAlignControlRef = useRef<HTMLElement | null>(null);

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

    /** A German sentence's element, or its block's when the id names a whole block. */
    function sourceElement(id: string): Element | null {
      return (
        root.querySelector(`[data-sentence-id="${id}"]`) ||
        root.querySelector(`[data-block-id="${id}"]`)
      );
    }

    function targetElement(id: string): Element | null {
      return root.querySelector(`[data-translation-unit-id="${id}"]`);
    }

    /**
     * WHICH IDS LIGHT UP IS DECIDED BY `computeHighlights`, NOT HERE. This function walked the
     * index itself and reached the same answer by a second route; `alignmentHighlight.ts` is a
     * pure module with a 6.5 KB test file and, until this change, no caller, so every assertion in
     * that test described a module the reader never ran while the live traversal below it had no
     * test of its own. Delegating makes the test a statement about what a reader gets.
     *
     * The DOM half stays here, because it is the half that is about this page: which attribute
     * marks the active sentence and which marks its partners.
     */
    function applyHighlights(id: string, kind: "source" | "target") {
      clearHighlights();
      const highlights = computeHighlights(index, id, kind);
      const activeKind = highlights.activeKind;
      if (highlights.activeId === null || activeKind === null) return;
      const active =
        activeKind === "source"
          ? sourceElement(highlights.activeId)
          : targetElement(highlights.activeId);
      active?.setAttribute("data-aligned-active", "true");
      const partners =
        activeKind === "source" ? highlights.highlightedTargetIds : highlights.highlightedSourceIds;
      for (const partnerId of partners) {
        const el = activeKind === "source" ? targetElement(partnerId) : sourceElement(partnerId);
        el?.setAttribute("data-aligned-partner", "true");
      }
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. "Align sentences" control on paragraph
      const alignControl = target.closest<HTMLElement>("[data-align-sentences-control]");
      if (alignControl) {
        lastAlignControlRef.current = alignControl;
        const blockId = alignControl.getAttribute("data-block-id");
        const paragraph =
          alignControl.parentElement?.closest<HTMLElement>("p") ||
          alignControl.parentElement ||
          root.querySelector(`[data-block-id="${blockId}"]`);
        const firstSentence = paragraph?.querySelector<HTMLElement>("[data-source-sentence]");
        if (firstSentence) {
          firstSentence.focus();
          const sid = firstSentence.getAttribute("data-sentence-id") || firstSentence.id;
          if (sid) applyHighlights(sid, "source");
        }
        return;
      }

      // 2. "Show the German source of this sentence"
      const showSourceBtn = target.closest<HTMLElement>('[data-action="show-aligned-source"]');
      if (showSourceBtn) {
        const uid = showSourceBtn.getAttribute("data-unit-id");
        if (uid) {
          const sources = getAlignedSources(index, uid);
          const texts = sources.map((sid) => {
            const el = root.querySelector(`[data-sentence-id="${sid}"]`);
            return el?.textContent?.replace(/Show English translation/g, "").trim() || sid;
          });
          applyHighlights(uid, "target");
          setAnnouncement(`German source: ${texts.join(" ")}`);
        }
        return;
      }

      // 3. "Show English translation"
      const showTargetBtn = target.closest<HTMLElement>('[data-action="show-aligned-target"]');
      if (showTargetBtn) {
        const sid = showTargetBtn.getAttribute("data-source-id");
        if (sid) {
          const targets = getAlignedTargets(index, sid);
          const texts = targets.map((tid) => {
            const el = root.querySelector(`[data-translation-unit-id="${tid}"]`);
            return el?.textContent?.replace(/Show the German source/g, "").trim() || tid;
          });
          applyHighlights(sid, "source");
          setAnnouncement(`English translation: ${texts.join(" ")}`);
        }
        return;
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
      // Sentence navigation keys: 'j' or ArrowDown (down/next), 'k' or ArrowUp (up/prev)
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const currentActive = root.querySelector("[data-aligned-active]");
        const currentId = currentActive?.getAttribute("data-sentence-id") || currentActive?.id;
        // Document order comes from `nextSentenceId`, which this block used to recompute with its
        // own min/max arithmetic. The two agreed -- no current sentence and an unknown sentence
        // both land on the first -- and agreeing by coincidence is how they would stop agreeing.
        const nextId = nextSentenceId(index, currentId);
        if (nextId) {
          const el = root.querySelector<HTMLElement>(`[data-sentence-id="${nextId}"]`);
          if (el) {
            el.focus();
            applyHighlights(nextId, "source");
          }
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentActive = root.querySelector("[data-aligned-active]");
        const currentId = currentActive?.getAttribute("data-sentence-id") || currentActive?.id;
        const prevId = prevSentenceId(index, currentId);
        if (prevId) {
          const el = root.querySelector<HTMLElement>(`[data-sentence-id="${prevId}"]`);
          if (el) {
            el.focus();
            applyHighlights(prevId, "source");
          }
        }
      } else if (e.key === "Enter") {
        const currentActive = root.querySelector("[data-aligned-active]");
        const currentSid = currentActive?.getAttribute("data-sentence-id");
        const currentUid = currentActive?.getAttribute("data-translation-unit-id");
        if (currentSid) {
          const targets = getAlignedTargets(index, currentSid);
          const texts = targets.map((tid) => {
            const el = root.querySelector(`[data-translation-unit-id="${tid}"]`);
            return el?.textContent?.replace(/Show the German source/g, "").trim() || tid;
          });
          if (texts.length > 0) {
            setAnnouncement(`English translation: ${texts.join(" ")}`);
          }
        } else if (currentUid) {
          const sources = getAlignedSources(index, currentUid);
          const texts = sources.map((sid) => {
            const el = root.querySelector(`[data-sentence-id="${sid}"]`);
            return el?.textContent?.replace(/Show English translation/g, "").trim() || sid;
          });
          if (texts.length > 0) {
            setAnnouncement(`German source: ${texts.join(" ")}`);
          }
        }
      } else if (e.key === "Escape") {
        pinnedIdRef.current = null;
        clearHighlights();
        if (lastAlignControlRef.current) {
          lastAlignControlRef.current.focus();
          lastAlignControlRef.current = null;
        }
        setAnnouncement("Exited sentence mode.");
      }
    }

    root.addEventListener("click", handleClick as EventListener);
    root.addEventListener("mouseover", handleMouseOver as EventListener);
    root.addEventListener("mouseout", handleMouseOut as EventListener);
    root.addEventListener("focusin", handleFocusIn as EventListener);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      root.removeEventListener("click", handleClick as EventListener);
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
