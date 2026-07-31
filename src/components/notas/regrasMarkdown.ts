import { Extension, InputRule } from "@tiptap/core";

// O TaskItem do TipTap só reconhece "[ ] " e "[x] ". "[] " (sem espaço no meio)
// é o que a maioria digita — e é o que o Obsidian aceita. Regra própria.
export const RegraCheckboxCurto = Extension.create({
  name: "regraCheckboxCurto",
  addInputRules() {
    return [
      new InputRule({
        find: /^\[\]\s$/,
        handler: ({ chain, range }) => {
          chain().deleteRange(range).toggleTaskList().run();
        },
      }),
    ];
  },
});
