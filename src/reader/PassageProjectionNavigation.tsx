"use client";

import { useEffect } from "react";
import { mountPassageProjectionNavigation } from "./passageProjectionNavigation.ts";

/** One small navigation island for all the static passage links on a page. */
export function PassageProjectionNavigation() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-reader-root]");
    if (root) return mountPassageProjectionNavigation(root);
  }, []);
  return null;
}
