"use client";

import { withBasePath } from "@/lib/basePath";

// Uma única conexão SSE por aba, compartilhada por todos os componentes que
// escutam /api/events (ToastHost, modal de demanda, …). O navegador limita
// conexões por domínio, e um EventSource por componente estoura esse limite
// rápido — daí o hub.
export type ServerEvent = {
  kind?: string;
  actorName?: string;
  entity?: string;
  link?: string;
};

type Listener = (event: ServerEvent) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;

function open() {
  if (source) return;
  source = new EventSource(withBasePath("/api/events"));
  source.onmessage = (message) => {
    let data: ServerEvent;
    try {
      data = JSON.parse(message.data);
    } catch {
      return;
    }
    for (const listener of listeners) listener(data);
  };
}

function close() {
  source?.close();
  source = null;
}

// Inscreve um listener e devolve a função de cancelamento. A conexão abre no
// primeiro inscrito e fecha quando o último sai.
export function onServerEvent(listener: Listener): () => void {
  listeners.add(listener);
  open();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) close();
  };
}
