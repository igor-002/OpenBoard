import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export default async function AccountPage() {
  const user = await requireUser();
  const roleLabel = user.role === "admin" ? "Administrador" : "Membro";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Minha conta</h1>
          <p className="page-sub">Seus dados e segurança</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card title="Perfil">
          <div className="row gap16" style={{ marginBottom: 18 }}>
            <Avatar user={{ initials: user.initials, color: user.color, name: user.name }} size={56} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{user.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{user.jobTitle}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="row between">
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>E-mail</span>
              <b style={{ fontSize: 13.5 }}>{user.email}</b>
            </div>
            <div className="row between">
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Papel</span>
              <span className="badge" style={{ color: "var(--primary)", background: "var(--primary-tint)" }}>{roleLabel}</span>
            </div>
            <div className="row between">
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Workspace</span>
              <b style={{ fontSize: 13.5 }}>{user.workspace.name}</b>
            </div>
          </div>
        </Card>

        <Card title="Trocar senha" sub="Use uma senha forte e única">
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  );
}
