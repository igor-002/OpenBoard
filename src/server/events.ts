import "server-only";
import { EventEmitter } from "node:events";

// Evento efêmero de "algo aconteceu" — usado pra empurrar toasts em tempo real
// via SSE (/api/events). Não persiste nada. Dois modos de entrega:
// - workspace (padrão): workspaceId + actorId — todos do workspace menos o autor;
// - direcionado: recipientIds — só esses users (ex.: solicitação de cadastro
//   vinda do form público, que não tem workspace nem autor logado).
export type AppEvent = {
  kind: "project_created" | "task_created" | "solicitacao_cadastro";
  workspaceId?: string;
  actorId?: string;
  recipientIds?: string[]; // se presente, entrega SÓ a estes users
  actorName: string;
  entity: string; // nome do projeto / título da tarefa / cliente solicitado
  link: string;
};

// EventEmitter único por processo. Sobrevive ao HMR do dev via globalThis.
const g = globalThis as unknown as { __openboardBus?: EventEmitter };
const bus = g.__openboardBus ?? (g.__openboardBus = new EventEmitter());
bus.setMaxListeners(0); // muitas conexões SSE simultâneas

const CHANNEL = "app-event";

export function emitAppEvent(e: AppEvent): void {
  bus.emit(CHANNEL, e);
}

// Inscreve um listener. Retorna função pra cancelar.
export function onAppEvent(fn: (e: AppEvent) => void): () => void {
  bus.on(CHANNEL, fn);
  return () => bus.off(CHANNEL, fn);
}
