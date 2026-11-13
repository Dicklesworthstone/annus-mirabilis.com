"use client";
import { type MouseEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { announce } from "../../a11y/announce.ts";
import type { PrintedOperationReading } from "../../equations/printed/sourceSemantics.ts";
import { PrintedOperationNote } from "./PrintedOperationReference.tsx";
import "./printedOperations.css";

/**
 * One optional explorer for a whole formula, not a tab stop on every glyph. The permanent link
 * works before hydration or when script fails. All content is compiled data: no physics or
 * equation evaluation occurs here, and the source formula never changes when a part is selected.
 */
export function PrintedOperationExplorer({
  children,
  reading,
  spoken,
  href,
  label,
  inline,
}: {
  children: ReactNode;
  reading: PrintedOperationReading;
  spoken: string;
  href: string;
  label: string;
  inline: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLAnchorElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const focusSelection = useRef(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const operation = reading.operations.find((item) => item.id === selected);
  const primary = reading.operations.filter((item) => item.primary);
  const nested = reading.operations.filter((item) => !item.primary);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    const terms = new Set(open ? operation?.termIds : []);
    for (const element of root.current?.querySelectorAll("[data-op],[data-term]") ?? []) {
      const chosen =
        open &&
        (element.getAttribute("data-op") === operation?.id ||
          terms.has(element.getAttribute("data-term") ?? ""));
      if (chosen) element.setAttribute("data-operation-selected", "true");
      else element.removeAttribute("data-operation-selected");
    }
    if (open && focusSelection.current) {
      focusSelection.current = false;
      select.current?.focus();
    }
  }, [open, operation]);

  useEffect(() => {
    if (open && operation) announce(operation.title + ". " + operation.does);
  }, [open, operation]);

  function choose(next: string, focus = false) {
    if (!reading.operations.some((item) => item.id === next)) return;
    focusSelection.current = focus;
    setSelected(next);
    setOpen(true);
    // Selecting an already open operation produces no state change to trigger the effect.
    if (focus && selected === next && open) select.current?.focus();
  }

  function toggle(event: MouseEvent<HTMLAnchorElement>) {
    if (!ready || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (open) setOpen(false);
    else choose(selected ?? primary[0]?.id ?? reading.operations[0]!.id);
  }

  // Delegated pointer input on the existing aria-hidden visual. Terms keep their own quantity
  // inspector; fraction bars, signs, roots and other operation surfaces select the operation.
  const Root = (inline ? "span" : "div") as "div";
  return (
    <Root
      ref={root}
      className="printed-operation-explorer"
      onClick={(event) => {
        if (!(event.target instanceof Element) || !root.current) return;
        const term = event.target.closest("[data-quantity-id]");
        if (term && root.current.contains(term)) return;
        const target = event.target.closest("[data-op]");
        const operationId = target?.getAttribute("data-op");
        if (target && root.current.contains(target) && operationId) {
          event.preventDefault();
          choose(operationId, true);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        setOpen(false);
        control.current?.focus();
      }}
    >
      {children}
      <span className="printed-operation-panel" data-open={open ? "true" : undefined}>
        <a
          ref={control}
          className="printed-operation-toggle"
          href={href}
          aria-label={label}
          aria-expanded={ready ? open : undefined}
          aria-controls={ready ? id : undefined}
          onClick={toggle}
        >
          Explore operations
        </a>
        <span id={id} className="printed-operation-body" hidden={!open}>
          {open ? (
            <>
              <span className="printed-operation-context">{reading.context}</span>
              <span className="printed-operation-context">{reading.premise}</span>
              <label className="printed-operation-choice">
                Select a part of this expression
                <select
                  ref={select}
                  value={selected ?? ""}
                  onChange={(event) => choose(event.currentTarget.value)}
                >
                  <optgroup label="Steps in the argument">
                    {primary.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Nested arithmetic, in source order">
                    {nested.map((item, index) => (
                      <option key={item.id} value={item.id}>
                        {index + 1}. {item.title}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              {operation ? <PrintedOperationNote operation={operation} /> : null}
              <span className="printed-operation-context">
                <strong>Read the complete expression aloud. </strong>
                {spoken}
              </span>
              <span className="printed-operation-context">
                Dimensional check: {reading.dimension}. In a relation, this is the dimension on both
                sides. Unit consistency alone does not establish the physical argument.
              </span>
              <a href={reading.next.href}>{reading.next.label} →</a>
              <span className="printed-operation-context">
                <a href={href}>Open every operation and its explanation on one page</a>
              </span>
            </>
          ) : null}
        </span>
      </span>
    </Root>
  );
}
