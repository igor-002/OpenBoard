import { requireAdmin } from "@/lib/auth";
import { getOpenAISettingsView } from "@/server/settings";
import { Card } from "@/components/ui/Card";
import { OpenAISettingsForm } from "@/components/comercial/OpenAISettingsForm";

export default async function ConfigIAPage() {
  await requireAdmin();
  const view = await getOpenAISettingsView();

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
    </div>
  );
}
