import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOpenAISettingsView, getSetting, SETTING_KEYS } from "@/server/settings";
import { Card } from "@/components/ui/Card";
import { OpenAISettingsForm } from "@/components/comercial/OpenAISettingsForm";
import { CadastroNotifyForm } from "@/components/comercial/CadastroNotifyForm";

export default async function ConfigIAPage() {
  await requireAdmin();
  const [view, users, notifyRaw] = await Promise.all([
    getOpenAISettingsView(),
    db.user.findMany({ select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    getSetting(SETTING_KEYS.cadastroNotifyUserIds),
  ]);
  let selectedIds: string[] = [];
  try {
    const parsed = notifyRaw ? JSON.parse(notifyRaw) : [];
    if (Array.isArray(parsed)) selectedIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    /* JSON inválido → nenhum marcado (backend usa fallback admins) */
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Config IA</h1>
          <p className="page-sub">Chave e modelo da OpenAI usados na análise das conversas de leads (só admin).</p>
        </div>
      </div>

      <Card title="OpenAI" sub="A chave fica no banco (server-only). Preços em USD por 1M tokens — usados só para estimar o custo de cada análise.">
        <OpenAISettingsForm view={view} />
      </Card>

      <Card
        title="Solicitações de cadastro"
        sub="Quem recebe o aviso (toast em tempo real + notificação no sino) quando chega uma solicitação nova pelo formulário público."
      >
        <CadastroNotifyForm users={users} selectedIds={selectedIds} />
      </Card>
    </div>
  );
}
