"use client";

import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { NoteManifest } from "../notebook.ts";
import type { NotebookSession } from "../notebookSession.ts";
import { createStoredNotebookSession } from "../storedNotebook.ts";
import "./notes.css";

type NotebookContext = Readonly<{
  manifest: NoteManifest;
  session: NotebookSession;
  draftSequence: number;
  draftVersion: RefObject<number>;
  editDraft(): void;
}>;
const Context = createContext<NotebookContext | null>(null);

/** One existing session owns every stage on a guide, including export and import. */
export function DiscoveryNotebookProvider({
  manifest,
  children,
}: {
  manifest: NoteManifest;
  children: ReactNode;
}) {
  return (
    <NotebookProvider key={`${manifest.paper}:${manifest.revision}`} manifest={manifest}>
      {children}
    </NotebookProvider>
  );
}

function NotebookProvider({ manifest, children }: { manifest: NoteManifest; children: ReactNode }) {
  const [session] = useState(() => createStoredNotebookSession(manifest));
  const draftVersion = useRef(0);
  const [draftSequence, setDraftSequence] = useState(0);
  const editDraft = useCallback(() => {
    // A file selected before a newer draft must never discard that draft on completion.
    session.invalidateImport();
    draftVersion.current += 1;
    setDraftSequence(draftVersion.current);
  }, [session]);
  useEffect(() => session.load(), [session]);
  const value = useMemo(
    () => ({ manifest, session, draftSequence, draftVersion, editDraft }),
    [manifest, session, draftSequence, editDraft],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDiscoveryNotebook() {
  return useContext(Context);
}

export function useNotebookView(session: NotebookSession) {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
}
