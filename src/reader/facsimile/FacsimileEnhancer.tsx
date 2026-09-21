"use client";

import { useEffect } from "react";
import { mountFacsimileReader } from "./controller.ts";
import type { FacsimileDocument } from "./document.ts";

export function FacsimileEnhancer({
  rootId,
  document: source,
  initialPdfPage,
  faceHref,
}: {
  rootId: string;
  document: FacsimileDocument;
  initialPdfPage: number;
  faceHref: string;
}) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (root) return mountFacsimileReader(root, source, initialPdfPage, faceHref);
  }, [rootId, source, initialPdfPage, faceHref]);
  return null;
}
