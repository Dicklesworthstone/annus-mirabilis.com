"use client";
import {
  createContext,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * TERMS AS TARGETS (dispatch 144: the owner asked for equations like the donor site's, "with
 * hover-over and stuff"). Pointing at, focusing or clicking any element that carries a
 * quantity id lights every element in this block that carries the SAME id: the glyphs in the
 * formula, the phrase in the sentence, the chip and the legend line.
 *
 * EXACT IDS ONLY. The match is string equality on data-quantity-id, never a selector built from
 * the id and never a prefix: a quantity whose id begins another's (speed and speedOfLight) must
 * not light up with it. The donor matched by substring; AGENTS.md bans that.
 *
 * PROGRESSIVE. Without JavaScript the block is the server-rendered formula, sentence and legend,
 * and CSS alone still marks the one term under the pointer. This island adds the linking, a pin
 * on click, and Escape to clear. It holds no data: everything it needs is in the DOM it wraps.
 */

/** Every element under root whose data-quantity-id is exactly id. */
export function elementsOfQuantity(root: ParentNode, id: string): Element[] {
  return [...root.querySelectorAll("[data-quantity-id]")].filter(
    (element) => element.getAttribute("data-quantity-id") === id,
  );
}

/** Marks the elements of quantity id with data-lit, and clears every other mark under root. */
export function lightQuantity(root: ParentNode, id: string | null): void {
  for (const element of root.querySelectorAll("[data-lit]")) element.removeAttribute("data-lit");
  if (id === null) return;
  for (const element of elementsOfQuantity(root, id)) element.setAttribute("data-lit", "true");
}

/** The quantity id of the nearest element at or above target, within root. */
export function quantityAt(root: Element, target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest("[data-quantity-id]");
  return element && root.contains(element) ? element.getAttribute("data-quantity-id") : null;
}

/**
 * What the chips inside a block need from it: the pinned quantity, a way to pin or clear, and
 * whether the page has hydrated (a chip is a disabled button until then, so without JavaScript it
 * reads as a legend and is not hidden as a dead control; noScriptControls.ts).
 */
export type TermHighlightState = Readonly<{
  pinned: string | null;
  pin: (id: string | null) => void;
  ready: boolean;
}>;

export const TermHighlightContext = createContext<TermHighlightState | null>(null);

export type TermHighlightProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  /**
   * "span" where the block sits inside a paragraph: a printed display on a reading face is set
   * inside its <p>, which may hold no div (dispatch 224). The behaviour is the same.
   */
  as?: "div" | "span" | undefined;
};

export function TermHighlight({ children, as, ...attributes }: TermHighlightProps) {
  const root = useRef<HTMLDivElement>(null);
  // Typed as a div either way: the handlers and the lighting use only what both elements have.
  const Root = (as ?? "div") as "div";
  const [pointed, setPointed] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const state = useMemo<TermHighlightState>(
    () => ({ pinned, pin: setPinned, ready }),
    [pinned, ready],
  );
  const active = pointed ?? pinned;
  useEffect(() => {
    if (root.current) lightQuantity(root.current, active);
  }, [active]);
  const at = (target: EventTarget | null) =>
    root.current ? quantityAt(root.current, target) : null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegated listeners only; the lit formula is aria-hidden, and its legend names every quantity in text for every reader.
    <Root
      {...attributes}
      ref={root}
      data-term-highlight=""
      data-active-quantity-id={active ?? undefined}
      data-pinned-quantity-id={pinned ?? undefined}
      onPointerOver={(e: PointerEvent<HTMLDivElement>) => setPointed(at(e.target))}
      onPointerLeave={() => setPointed(null)}
      onFocus={(e: FocusEvent<HTMLDivElement>) => setPointed(at(e.target))}
      onBlur={() => setPointed(null)}
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        const id = at(e.target);
        if (id !== null) setPinned((current) => (current === id ? null : id));
      }}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape" && (pinned !== null || pointed !== null)) {
          setPinned(null);
          setPointed(null);
        }
      }}
    >
      <TermHighlightContext.Provider value={state}>{children}</TermHighlightContext.Provider>
    </Root>
  );
}
