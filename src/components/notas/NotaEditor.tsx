"use client";

// Casca de carregamento preguiçoso. `ssr: false` só é válido dentro de um
// Client Component — por isso o "use client" acima, e por isso o editor de
// verdade mora em NotaEditorTiptap.tsx.
import dynamic from "next/dynamic";
import type { NotaEditorProps } from "./NotaEditorTiptap";

const Tiptap = dynamic(() => import("./NotaEditorTiptap"), {
  ssr: false,
  loading: () => <div className="nota-editor-skeleton" />,
});

export function NotaEditor(props: NotaEditorProps) {
  return <Tiptap {...props} />;
}
