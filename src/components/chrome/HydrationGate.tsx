"use client";

import { type ReactNode, useSyncExternalStore } from "react";

/*
 * A CONTROL THAT NEEDS JAVASCRIPT IS DISABLED UNTIL JAVASCRIPT HAS RUN (am-nojs-dead-controls-3agt).
 *
 * With JavaScript off, 267 buttons on 41 of the 197 pages in the live sitemap looked enabled and
 * did nothing (measured 2026-09-24, Playwright, every enabled and laid-out button): lab presets,
 * view toggles, the lessons' constructions. Every one is wired by React. No form on the site has
 * an action, so none of them could ever work without it.
 *
 * About 35 components rendered them, each with its own hydration flag, and the ones that forgot
 * to use it were the dead ones. So the cause is fixed once, here, rather than in each of them:
 * the page's content sits in one disabled fieldset in the served HTML, which disables every
 * button, input, select and textarea inside it, and hydration lifts it. A reader without
 * JavaScript sees the controls greyed (globals.css, button:disabled), next to the note each page
 * already carries that JavaScript is off; links and <details> drawers are not form controls and
 * keep working.
 *
 * The fieldset makes no box (display: contents) and no group (role="none"), so layout and the
 * accessibility tree are the page's own. A control a component disables for its own reasons stays
 * disabled after hydration: the fieldset only ever adds a reason, never removes one.
 *
 * The server snapshot is false and the client snapshot true, so hydration renders the served
 * markup first and then lifts the gate, with no mismatch and no effect to wait for.
 */
const subscribe = () => () => {};

export function HydrationGate({ children }: { readonly children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    // The fieldset exists only to carry `disabled`; it must not announce a group around the page.
    <fieldset className="hydration-gate" role="none" disabled={!hydrated}>
      {children}
    </fieldset>
  );
}
