"use client";
import { useEffect, useId, useMemo, useRef } from "react";
import { mountInferenceCase, mountInferenceWorkbench } from "./browser.ts";
import type { InferenceEvidence } from "./evidence.ts";
import { type InferenceExample, renderInferenceCase, renderInferenceWorkbench } from "./render.ts";
import "./workbench.css";

/** React owns placement; the scoped controller enhances the escaped static island. */
export function FamilyWorkbench({ example }: { example: InferenceExample }) {
  const reactId = useId();
  const uid = `inference-${reactId.replace(/[^a-zA-Z0-9_-]/gu, "")}`;
  const host = useRef<HTMLDivElement>(null);
  const markup = useMemo(
    () => ({ __html: renderInferenceWorkbench(example, uid) }),
    [example, uid],
  );
  useEffect(() => {
    const root = host.current?.querySelector<HTMLElement>("[data-infer-workbench]");
    if (!root) return;
    return mountInferenceWorkbench(root, example, uid);
  }, [example, uid]);
  return <div ref={host} {...{ dangerouslySetInnerHTML: markup }} />;
}

/** One immutable accepted record; source-lab renders never reset this inference session. */
export function InferenceCaseWorkbench({
  evidence,
  sourceDigest,
}: {
  evidence: InferenceEvidence;
  sourceDigest: string;
}) {
  const reactId = useId();
  const uid = `pinned-inference-${reactId.replace(/[^a-zA-Z0-9_-]/gu, "")}`;
  const host = useRef<HTMLDivElement>(null);
  const markup = useMemo(
    () => ({ __html: renderInferenceCase(evidence, uid, sourceDigest) }),
    [evidence, uid, sourceDigest],
  );
  useEffect(() => {
    const root = host.current?.querySelector<HTMLElement>("[data-infer-workbench]");
    if (!root) return;
    return mountInferenceCase(root, evidence, uid);
  }, [evidence, uid]);
  return <div ref={host} {...{ dangerouslySetInnerHTML: markup }} />;
}
