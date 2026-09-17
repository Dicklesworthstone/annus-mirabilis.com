"use client";
import { useEffect, useId, useMemo, useRef } from "react";
import { mountInferenceWorkbench } from "./browser.ts";
import { type InferenceExample, renderInferenceWorkbench } from "./render.ts";
import "./workbench.css";

/** React owns placement; the scoped controller enhances the escaped static island. */
export function FamilyWorkbench({ example }: { example: InferenceExample }) {
  const reactId = useId();
  const uid = `inference-${reactId.replace(/[^a-zA-Z0-9_-]/gu, "")}`;
  const host = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderInferenceWorkbench(example, uid), [example, uid]);
  useEffect(() => {
    const root = host.current?.querySelector<HTMLElement>("[data-infer-workbench]");
    if (!root) return;
    return mountInferenceWorkbench(root, example, uid);
  }, [example, uid]);
  return <div ref={host} {...{ dangerouslySetInnerHTML: { __html: html } }} />;
}
