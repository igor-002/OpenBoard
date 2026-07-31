"use client";

// O editor de verdade. Fica num arquivo separado porque é carregado sob demanda
// (ver NotaEditor.tsx): assim /dashboard, /kanban e a aba de notas do projeto
// não baixam um byte de TipTap/ProseMirror.
import { useEffect, useRef } from "react";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { Icon } from "@/components/ui/Icon";
import { criarSlashCommand, type ItemSlash } from "./slash";
import { RegraCheckboxCurto } from "./regrasMarkdown";
import { SlashMenu, type SlashMenuRef } from "./SlashMenu";

export type NotaEditorProps = {
  // Muda quando a nota trocada é OUTRA — dispara recarga do conteúdo.
  noteId: string;
  valorInicial: string;
  editavel: boolean;
  onChange: (markdown: string) => void;
  // Ctrl+S força gravar agora.
  onSalvarAgora?: () => void;
};

const SlashCommand = criarSlashCommand(() => {
  let component: ReactRenderer<SlashMenuRef> | null = null;
  let desmontar: (() => void) | null = null;

  return {
    onStart: (props) => {
      component = new ReactRenderer(SlashMenu, {
        props: { items: props.items as ItemSlash[], command: (item: ItemSlash) => props.command(item) },
        editor: props.editor,
      });
      // O próprio Suggestion monta e mantém o popup ancorado no cursor.
      desmontar = props.mount(component.element as HTMLElement);
    },
    onUpdate: (props) => {
      component?.updateProps({ items: props.items as ItemSlash[], command: (item: ItemSlash) => props.command(item) });
    },
    onKeyDown: (props) => {
      if (props.event.key === "Escape") {
        desmontar?.();
        desmontar = null;
        return true;
      }
      return component?.ref?.onKeyDown(props.event) ?? false;
    },
    onExit: () => {
      desmontar?.();
      desmontar = null;
      component?.destroy();
      component = null;
    },
  };
});

export default function NotaEditorTiptap({
  noteId,
  valorInicial,
  editavel,
  onChange,
  onSalvarAgora,
}: NotaEditorProps) {
  // Guarda a nota já carregada: evita reescrever o conteúdo a cada re-render
  // (o que jogaria o cursor pro começo enquanto a pessoa digita).
  const carregada = useRef(noteId);

  const editor = useEditor({
    // Obrigatório no App Router: sem isso o ProseMirror renderiza no servidor
    // e dá hydration mismatch.
    immediatelyRender: false,
    editable: editavel,
    content: valorInicial,
    contentType: "markdown",
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      RegraCheckboxCurto,
      Placeholder.configure({ placeholder: 'Escreva aqui… digite "/" para blocos' }),
      Markdown,
      SlashCommand,
    ],
    editorProps: {
      attributes: { class: "nota-prose" },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && (event.key === "s" || event.key === "S")) {
          event.preventDefault();
          onSalvarAgora?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getMarkdown()),
  });

  // Trocou de nota → substitui o conteúdo. `emitUpdate: false` para a troca não
  // ser confundida com edição da pessoa (o que marcaria a nota como suja).
  useEffect(() => {
    if (!editor || carregada.current === noteId) return;
    carregada.current = noteId;
    editor.commands.setContent(valorInicial, { contentType: "markdown", emitUpdate: false });
  }, [editor, noteId, valorInicial]);

  useEffect(() => {
    editor?.setEditable(editavel);
  }, [editor, editavel]);

  if (!editor) return <div className="nota-editor-skeleton" />;

  return (
    <div className="nota-editor">
      {editavel && <BarraFerramentas editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

// Barra enxuta: só o que não tem atalho markdown óbvio ou que a pessoa procura
// com o mouse. O resto se faz digitando ou pelo "/".
function BarraFerramentas({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const botoes = [
    { id: "bold", icone: "edit", titulo: "Negrito (Ctrl+B)", ativo: () => editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run(), texto: "B" },
    { id: "italic", icone: "edit", titulo: "Itálico (Ctrl+I)", ativo: () => editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run(), texto: "I" },
    { id: "h1", icone: "edit", titulo: "Título 1", ativo: () => editor.isActive("heading", { level: 1 }), run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), texto: "H1" },
    { id: "h2", icone: "edit", titulo: "Título 2", ativo: () => editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), texto: "H2" },
  ] as const;

  return (
    <div className="nota-toolbar">
      {botoes.map((b) => (
        <button
          key={b.id}
          type="button"
          title={b.titulo}
          className={`nota-tool${b.ativo() ? " on" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={b.run}
        >
          <span style={{ fontWeight: 800, fontSize: 12.5, fontStyle: b.id === "italic" ? "italic" : undefined }}>{b.texto}</span>
        </button>
      ))}
      <span className="nota-tool-sep" />
      <button type="button" title="Lista" className={`nota-tool${editor.isActive("bulletList") ? " on" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <Icon name="more" size={15} />
      </button>
      <button type="button" title="Checklist" className={`nota-tool${editor.isActive("taskList") ? " on" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <Icon name="checkCircle" size={15} />
      </button>
      <button type="button" title="Citação" className={`nota-tool${editor.isActive("blockquote") ? " on" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Icon name="msg" size={15} />
      </button>
      <button type="button" title="Código" className={`nota-tool${editor.isActive("codeBlock") ? " on" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Icon name="copy" size={15} />
      </button>
      <span className="nota-tool-hint muted">digite “/” para blocos</span>
    </div>
  );
}
