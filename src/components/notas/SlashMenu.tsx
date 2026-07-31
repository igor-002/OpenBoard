"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ItemSlash } from "./slash";

export type SlashMenuRef = { onKeyDown: (e: KeyboardEvent) => boolean };

type Props = {
  items: ItemSlash[];
  command: (item: ItemSlash) => void;
};

// Popup do "/". Visual e navegação idênticos à CommandPalette (Ctrl+K) de
// propósito: é o mesmo gesto, tem que parecer o mesmo produto.
export const SlashMenu = forwardRef<SlashMenuRef, Props>(function SlashMenu({ items, command }, ref) {
  const [sel, setSel] = useState(0);

  // A cada nova filtragem a seleção volta pro topo.
  useEffect(() => setSel(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (e: KeyboardEvent) => {
      if (!items.length) return false;
      if (e.key === "ArrowDown") {
        setSel((s) => (s + 1) % items.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        setSel((s) => (s - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        command(items[sel]);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) {
    return (
      <div className="nota-slash">
        <div className="muted" style={{ padding: "10px 12px", fontSize: 12.5 }}>Nenhum bloco com esse nome.</div>
      </div>
    );
  }

  return (
    <div className="nota-slash">
      {items.map((item, i) => (
        <div
          key={item.id}
          className={`nota-slash-item${i === sel ? " on" : ""}`}
          onMouseEnter={() => setSel(i)}
          onMouseDown={(e) => {
            // mousedown, não click: click tiraria o foco do editor antes do comando.
            e.preventDefault();
            command(item);
          }}
        >
          <span className={i === sel ? "" : "muted"} style={{ display: "grid", placeItems: "center", flex: "none" }}>
            <Icon name={item.icone} size={15} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block" }}>{item.titulo}</span>
            <span className="muted" style={{ fontSize: 11.5, fontWeight: 500 }}>{item.sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
});
