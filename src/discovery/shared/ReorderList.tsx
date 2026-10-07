"use client";

import { type ReactNode, useId, useLayoutEffect, useRef, useState } from "react";
import { moveClaim } from "../capstone/worksheetState.ts";

export type ReorderItem = Readonly<{ id: string; label: string; content: ReactNode }>;

/** The same buttons work with a pointer, keyboard, or assistive technology; dragging is not required. */
export function ReorderList({ items, order, onChange }: Readonly<{
  items: readonly ReorderItem[];
  order: readonly string[];
  onChange: (order: readonly string[]) => void;
}>) {
  const helpId = useId();
  const list = useRef<HTMLOListElement>(null);
  const pendingFocus = useRef<HTMLElement | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const byId = new Map(items.map((item) => [item.id, item]));

  useLayoutEffect(() => {
    const element = pendingFocus.current;
    pendingFocus.current = null;
    if (element?.isConnected) element.focus();
  }, [order]);

  function move(id: string, direction: -1 | 1, trigger: HTMLElement) {
    const next = moveClaim(order, id, direction);
    if (next === order) return;
    pendingFocus.current = trigger;
    onChange(next);
    setAnnouncement(`${byId.get(id)?.label ?? "Claim"} moved to position ${next.indexOf(id) + 1} of ${next.length}.`);
  }

  // THE HOOK BELOW IS A DATA ATTRIBUTE, NOT A CLASS. It exists only so a test can
  // find the status region, and no stylesheet declares it, so as a class it was
  // undeclared debt under am-vw1o. This repository already uses data attributes for
  // exactly that. If a styled class was intended, the rule is the author's to add.
  return (
    <div data-capstone-reorder="">
      <p id={helpId} className="capstone-controls">
        Move a claim with its buttons, or press Alt and the up or down arrow while focused on a move button.
        A claim at the start cannot move up; a claim at the end cannot move down.
      </p>
      <ol className="capstone-claims" ref={list} aria-describedby={helpId}>
        {order.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          return (
            <li className="capstone-claim" key={id} data-worksheet-claim={id}>
              {item.content}
              <div className="capstone-controls">
                {([-1, 1] as const).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    aria-label={`Move ${item.label.toLowerCase()} ${direction < 0 ? "up" : "down"}`}
                    aria-disabled={direction < 0 ? index === 0 : index === order.length - 1}
                    aria-describedby={helpId}
                    onClick={(event) => move(id, direction, event.currentTarget)}
                    onKeyDown={(event) => {
                      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
                        (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                      event.preventDefault();
                      move(id, event.key === "ArrowUp" ? -1 : 1, event.currentTarget);
                    }}
                  >
                    Move {direction < 0 ? "up" : "down"}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="capstone-controls" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    </div>
  );
}
