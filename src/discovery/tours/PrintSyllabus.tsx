"use client";

import { useEffect, useState } from "react";

export function PrintSyllabus() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <button type="button" disabled={!ready} onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
