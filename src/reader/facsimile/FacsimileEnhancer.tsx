"use client";

import { useEffect } from "react";
import { mountFacsimileReader } from "./controller.ts";
import type { FacsimileDocument } from "./document.ts";
import { mountNativeFacsimileDownload } from "./nativeDownloads.ts";

export function FacsimileEnhancer({
  rootId,
  document: source,
  initialPdfPage,
  faceHref,
  inline = false,
}: {
  rootId: string;
  document: FacsimileDocument;
  initialPdfPage: number;
  faceHref: string;
  inline?: boolean | undefined;
}) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (root) {
      const unmountDownload = mountNativeFacsimileDownload(root, source);
      const unmountReader = mountFacsimileReader(root, source, initialPdfPage, faceHref, {
        preserveReaderHistory: inline,
      });
      return () => {
        unmountReader();
        unmountDownload();
      };
    }
  }, [rootId, source, initialPdfPage, faceHref, inline]);
  return null;
}
