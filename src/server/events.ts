import "server-only";
import { EventEmitter } from "node:events";

// Evento efêmero de "algo aconteceu no workspace" — usado pra empurrar
// toasts em tempo real via SSE (/api/events). Não persiste nada.
export type AppEvent = {
  kind: "project_created" | "task_created";
  workspaceId: string;
  actorId: string;
  actorName: string;
  entity: string; // nome do projeto / título da tarefa
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
