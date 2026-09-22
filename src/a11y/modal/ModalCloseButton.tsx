import type { ComponentPropsWithRef } from "react";
import { MODAL_CLOSE_ICON_PATH } from "./dismiss.ts";

/**
 * The X in the top right corner of every overlay, for panels rendered by React. Markup matches
 * `createModalCloseButton` in dismiss.ts, and the look lives in modal.css under `.modal-close`.
 * Put it first inside the panel, so the heading beside it wraps around it instead of under it,
 * and pass the element to `makeDismissible` (or give it the owner's own data-* hook).
 *
 * `label` is the accessible name and must begin with "Close": "Close reading preferences".
 */
export function ModalCloseButton({
  label,
  className,
  ...rest
}: { readonly label: string } & Omit<
  ComponentPropsWithRef<"button">,
  "type" | "aria-label" | "children"
>) {
  return (
    <button
      {...rest}
      type="button"
      className={className ? `modal-close ${className}` : "modal-close"}
      aria-label={label}
      data-modal-close=""
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={MODAL_CLOSE_ICON_PATH} />
      </svg>
    </button>
  );
}
