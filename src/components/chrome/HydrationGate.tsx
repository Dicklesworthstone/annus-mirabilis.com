"use client";

import { type ReactNode, useSyncExternalStore } from "react";

/*
 * SUPERSEDED AND UNUSED, KEPT ONLY UNTIL ITS DELETION IS APPROVED (AGENTS.md RULE 1).
 *
 * This was the first fix for am-nojs-dead-controls-3agt: the page's content in one fieldset,
 * disabled in the served HTML and lifted by hydration. It was committed by the shared-tree sweeper
 * (a13b5f45) before it had been checked in a browser, and a browser showed it wrong:
 * - with display: contents, Chromium collapsed the paper pages' reading grid to height 0 (a
 *   container query inside the fieldset), and the fieldset's interface font was inherited by every
 *   page's text;
 * - as a block, a fieldset is its own formatting context, and headings moved by up to 70px.
 * The root layout no longer uses it. The fix is src/components/chrome/noScriptControls.ts.
 */
const subscribe = () => () => {};

export function HydrationGate({ children }: { readonly children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <fieldset role="none" disabled={!hydrated}>
      {children}
    </fieldset>
  );
}
