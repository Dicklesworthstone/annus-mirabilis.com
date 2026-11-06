"use client";

import { useEffect } from "react";
import { attachSplitReader } from "./controller.ts";
import type { SplitLocation } from "./selection.ts";

export function SplitEnhancer(scope: SplitLocation) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-split-comparison]");
    if (root) return attachSplitReader(root, scope);
  }, [scope]);
  return null;
}
