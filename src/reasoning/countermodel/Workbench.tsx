"use client";
import { useEffect, useId, useMemo, useRef } from "react";
import { mountCountermodelWorkbench } from "./browser.ts";
import { renderCountermodelWorkbench } from "./render.ts";
import type { PreparedCountermodelCase } from "./session.ts";
import "./workbench.css";

/** React owns the placement; the controller owns only its escaped, server-rendered island. */
export function CountermodelWorkbench({ example }: { example: PreparedCountermodelCase }) {
  const reactId = useId();
  const uid = `countermodel-${reactId.replace(/[^a-zA-Z0-9_-]/gu, "")}`;
  const host = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderCountermodelWorkbench(example, uid), [example, uid]);
  useEffect(() => {
    const root = host.current?.querySelector<HTMLElement>("[data-countermodel-case]");
    if (!root) return;
    return mountCountermodelWorkbench(root, example, uid);
  }, [example, uid]);
  // All variable text and attributes are escaped by renderCountermodelWorkbench; no raw authored HTML.
  return <div ref={host} {...{ dangerouslySetInnerHTML: { __html: html } }} />;
}
