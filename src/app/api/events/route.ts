import { getCurrentUser } from "@/lib/auth";
import { onAppEvent } from "@/server/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Stream SSE de eventos do workspace. O cliente (ToastHost) escuta e mostra
// um toast. Filtra por workspace e ignora o próprio autor (ele já sabe).
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ kind: "ready" });

      const unsub = onAppEvent((e) => {
        if (e.recipientIds) {
          // evento direcionado (ex.: solicitação de cadastro do form público)
          if (!e.recipientIds.includes(user.id)) return;
        } else {
          if (e.workspaceId !== user.workspaceId) return;
          if (e.actorId === user.id) return;
        }
        send(e);
      });

      // ping periódico mantém a conexão viva atrás de proxies.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* fechado */
        }
      }, 25000);

      cleanup = () => {
        unsub();
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      };
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
