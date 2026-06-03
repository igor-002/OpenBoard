// Tipos compartilhados do domínio OpenBoard.

export type ProjectStatus = "progress" | "done" | "review" | "planned";
export type Priority = "high" | "med" | "low";
export type TaskColumn = "todo" | "doing" | "review" | "done";
export type TimeLogStatus = "running" | "paused" | "done";
export type Role = "admin" | "gerente" | "membro";

// Identidade mínima de avatar (deriva de User no banco).
export type AvatarUser = {
  initials: string;
  color: string;
  name?: string;
};
