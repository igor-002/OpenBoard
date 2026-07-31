import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { IconName } from "@/components/ui/Icon";

export type ItemSlash = {
  id: string;
  titulo: string;
  sub: string;
  icone: IconName;
  termos: string[]; // sinônimos p/ a busca
  run: (ctx: { editor: Editor; range: Range }) => void;
};

const ITENS: ItemSlash[] = [
  {
    id: "texto",
    titulo: "Texto",
    sub: "Parágrafo normal",
    icone: "edit",
    termos: ["paragrafo", "p", "normal"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    id: "h1",
    titulo: "Título 1",
    sub: "Cabeçalho grande",
    icone: "layers",
    termos: ["titulo", "h1", "cabecalho"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    id: "h2",
    titulo: "Título 2",
    sub: "Cabeçalho médio",
    icone: "layers",
    termos: ["titulo", "h2", "subtitulo"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    id: "h3",
    titulo: "Título 3",
    sub: "Cabeçalho pequeno",
    icone: "layers",
    termos: ["titulo", "h3"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    id: "lista",
    titulo: "Lista",
    sub: "Itens com marcador",
    icone: "more",
    termos: ["lista", "bullet", "ul", "topicos"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "numerada",
    titulo: "Lista numerada",
    sub: "1. 2. 3.",
    icone: "more",
    termos: ["numerada", "ol", "ordenada", "numeros"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "checklist",
    titulo: "Checklist",
    sub: "Itens com caixa de marcar",
    icone: "checkCircle",
    termos: ["checklist", "tarefa", "todo", "caixa", "check"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "citacao",
    titulo: "Citação",
    sub: "Bloco destacado",
    icone: "msg",
    termos: ["citacao", "quote", "destaque"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "codigo",
    titulo: "Código",
    sub: "Bloco monoespaçado",
    icone: "copy",
    termos: ["codigo", "code", "pre"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "divisor",
    titulo: "Divisor",
    sub: "Linha horizontal",
    icone: "filter",
    termos: ["divisor", "linha", "hr", "separador"],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

// "titulo" acha "Título": o menu tem que funcionar sem acento.
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function itensSlash(query: string): ItemSlash[] {
  const q = semAcento(query.trim());
  if (!q) return ITENS;
  return ITENS.filter(
    (i) => semAcento(i.titulo).includes(q) || i.termos.some((t) => semAcento(t).includes(q)),
  );
}

// A extension só liga o motor; quem desenha o popup é o render passado de fora
// (SlashMenu.tsx) — assim o React fica no arquivo .tsx e este segue puro.
export function criarSlashCommand(render: NonNullable<Parameters<typeof Suggestion>[0]["render"]>) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          allowSpaces: false,
          items: ({ query }) => itensSlash(query),
          command: ({ editor, range, props }) => {
            (props as ItemSlash).run({ editor, range });
          },
          render,
        }),
      ];
    },
  });
}
