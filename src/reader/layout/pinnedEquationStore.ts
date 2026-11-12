import type { EquationScopeValue } from "../../equations/EquationScope.tsx";
import type { CompiledEquation } from "../../equations/viewTypes.ts";

export type PinnedEquation = Readonly<{
  equation: CompiledEquation;
  formId: "printed" | "modern";
  context: EquationScopeValue;
  sourceId: string;
  sourceAnchor: string;
  returnElement: HTMLElement | null;
}>;
export type PinnedEquationState = Readonly<{
  pinned: PinnedEquation | null;
  visible: boolean;
  activation: number;
}>;
const EMPTY: PinnedEquationState = Object.freeze({ pinned: null, visible: false, activation: 0 });

export class EquationPinError extends Error {
  readonly code = "invalid-equation-pin";
  constructor() {
    super("Pinning requires a compiled equation, its displayed form, and its selection context.");
    this.name = "EquationPinError";
  }
}

/** One mounted reader owns one pin. Nothing is shared between papers or server requests. */
export function createPinnedEquationStore() {
  let current = EMPTY;
  let request = 0;
  const listeners = new Set<() => void>();
  const publish = (next: PinnedEquationState) => {
    current = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => current,
    getServerSnapshot: () => EMPTY,
    getPinnedEquation: () => current.pinned,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** A later pin or unpin supersedes a lazy payload still loading. */
    beginPin: () => ++request,
    isCurrentPin: (attempt: number) => attempt === request,
    pinEquation(next: PinnedEquation, attempt = ++request): boolean {
      if (attempt !== request) return false;
      if (
        !next.equation.id.trim() ||
        !next.equation.paper.trim() ||
        !next.sourceId.trim() ||
        !next.context.store ||
        (next.formId !== "modern" && next.formId !== "printed") ||
        (next.formId === "printed" && next.equation.notationForm?.state !== "printed")
      )
        throw new EquationPinError();
      publish({
        pinned: Object.freeze({ ...next }),
        visible: true,
        activation: current.activation + 1,
      });
      return true;
    },
    updateContext(sourceId: string, context: EquationScopeValue) {
      const pin = current.pinned;
      if (!pin || pin.sourceId !== sourceId) return;
      const previous = pin.context;
      if (
        previous.store === context.store &&
        previous.slots === context.slots &&
        previous.editQuantity === context.editQuantity &&
        previous.lessonTitles === context.lessonTitles
      )
        return;
      publish({ ...current, pinned: Object.freeze({ ...pin, context }) });
    },
    showPinned(visible: boolean) {
      request++;
      if (current.pinned)
        publish({ ...current, visible, activation: current.activation + (visible ? 1 : 0) });
    },
    unpinEquation() {
      request++;
      if (current.pinned) publish(EMPTY);
    },
  };
}
export type PinnedEquationStore = ReturnType<typeof createPinnedEquationStore>;
