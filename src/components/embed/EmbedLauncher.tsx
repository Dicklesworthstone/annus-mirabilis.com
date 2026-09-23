"use client";

import { usePathname } from "next/navigation";
import { isEmbeddableId } from "../../experiments/embed/catalogue.ts";

/** Only advertise a real adapter, and never imply this link snapshots the current run. */
export function EmbedLauncher() {
  const pathname = usePathname();
  const matched = pathname?.match(/^\/lab\/([a-z0-9-]+)\/?$/);
  const id = matched?.[1];
  if (!isEmbeddableId(id)) return null;
  return (
    <p className="no-print">
      <a href={`/embed/?instrument=${id}`}>Embed this laboratory on another page</a>
      {". It starts from its worked defaults, not your current settings."}
    </p>
  );
}
