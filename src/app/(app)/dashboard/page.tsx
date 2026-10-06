import Link from "next/link";
import { requireTool } from "@/lib/permissions";
import { getHojeData, type HojeTask } from "@/server/hoje";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AutoRefresh } from "@/components/common/AutoRefresh";
import { Captura } from "@/components/hoje/Captura";
import { LinhaTarefa } from "@/components/hoje/LinhaTarefa";
import { deadlineInfo, hourLabel } from "@/lib/format";

const fmtHoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

// "há 40min" | "há 3h" | "há 2 dias" — idade de uma tarefa em relação a agora.
function ha(desde: Date, agora: number): string {
  const min = Math.max(0, Math.round((agora - +desde) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

function junta(partes: (string | null | false | undefined)[]): string {
  return partes.filter(Boolean).join(" · ");
}

function Stat({ icon, cor, rotulo, valor }: { icon: IconName; cor: string; rotulo: string; valor: number }) {
  return (
    <div className="hj-stat">
      <div className={`hj-stat-ico ${cor}`}>
        <Icon name={icon} size={20} />
      </div>
      <div>
        <div className="hj-stat-rotulo">{rotulo}</div>
        <div className="hj-stat-valor">{valor}</div>
      </div>
    </div>
  );
}

function Pilula({ cor, children, n }: { cor: string; children: React.ReactNode; n: number }) {
  return (
    <span className={`hj-pilula ${cor}`}>
      <i />
      {children} <b>{n}</b>
    </span>
  );
}

export default async function HojePage() {
  const user = await requireTool("gestao.dashboard");
  const d = await getHojeData(user.workspaceId);
  const agora = d.agora;
  const esperando = d.semDono.length + d.semConfirmacao.length;
  const pendencias = esperando + d.atrasadas.length;
  const primeiroNome = user.name.trim().split(/\s+/)[0];
  const dia = fmtHoje.format(agora);

  const prazo = (t: HojeTask) => (t.atrasada && t.dueDate ? <span className="risco">{deadlineInfo(t.dueDate).label}</span> : null);
  const linha = (t: HojeTask, acao: "despachar" | "andar" | "nenhuma", meta: React.ReactNode, vivo = false) => (
    <LinhaTarefa
      key={t.id}
      id={t.id}
      numero={t.numero}
      title={t.title}
      column={t.column}
      priority={t.priority}
      origem={t.origem}
      assigneeId={t.assigneeId}
      membros={d.membros}
      acao={acao}
      meta={meta}
      vivo={vivo}
    />
  );

  return (
    <div className="page">
      <AutoRefresh seconds={60} />

      <div className="hj-ola">
        <Avatar user={user} size={46} ring={false} />
        <div>
          <h1 style={{ textTransform: "capitalize" }}>Olá, {primeiroNome}</h1>
          <p>
            {dia.charAt(0).toUpperCase() + dia.slice(1)}
            {pendencias === 0 ? (
              " · nada esperando você"
            ) : (
              <>
                {esperando > 0 && (
                  <>
                    {" · "}
                    <b>
                      {esperando} {esperando === 1 ? "demanda esperando" : "demandas esperando"} você
                    </b>
                  </>
                )}
                {d.atrasadas.length > 0 && (
                  <>
                    {" · "}
                    <b className="risco">
                      {d.atrasadas.length} {d.atrasadas.length === 1 ? "atrasada" : "atrasadas"}
                    </b>
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="hj-stats">
        <Stat icon="inbox" cor="cor-roxo" rotulo="Na fila" valor={d.totais.fila} />
        <Stat icon="zap" cor="cor-azul" rotulo="Em atendimento" valor={d.totais.fazendo} />
        <Stat icon="pause" cor="cor-ambar" rotulo="Aguardando" valor={d.totais.aguardando} />
        <Stat icon="checkCircle" cor="cor-verde" rotulo="Resolvidas hoje" valor={d.totais.feitasHoje} />
      </div>

      <Captura membros={d.membros} meId={user.id} />

      <div className="hj-grid">
        <div className="hj-col">
          <section>
            <h2 className="hj-secao-titulo">Precisa de você</h2>
            {pendencias === 0 && (
              <div className="hj-vazio">
                <Icon name="checkCircle" size={20} />
                Tudo que chegou tem dono e está no prazo.
              </div>
            )}

            {d.semDono.length > 0 && (
              <div className="hj-grupo">
                <div className="hj-grupo-topo">
                  <Pilula cor="cor-laranja" n={d.semDono.length}>
                    Sem dono
                  </Pilula>
                </div>
                {d.semDono.map((t) => linha(t, "despachar", junta([`chegou ${ha(t.createdAt, agora)}`, t.contexto])))}
              </div>
            )}

            {d.semConfirmacao.length > 0 && (
              <div className="hj-grupo">
                <div className="hj-grupo-topo">
                  <Pilula cor="cor-ambar" n={d.semConfirmacao.length}>
                    Ainda não viram
                  </Pilula>
                </div>
                {d.semConfirmacao.map((t) => linha(t, "despachar", junta([t.assigneeName, `enviada ${ha(t.createdAt, agora)}`])))}
              </div>
            )}

            {d.atrasadas.length > 0 && (
              <div className="hj-grupo">
                <div className="hj-grupo-topo">
                  <Pilula cor="cor-vermelho" n={d.atrasadas.length}>
                    Atrasadas
                  </Pilula>
                </div>
                {d.atrasadas.map((t) => linha(t, "despachar", prazo(t)))}
              </div>
            )}
          </section>

          <section>
            <h2 className="hj-secao-titulo">Resolvido hoje</h2>
            {d.feitasHoje.length === 0 ? (
              <div className="hj-vazio" style={{ borderStyle: "solid" }}>
                Nenhuma demanda resolvida hoje ainda.
              </div>
            ) : (
              <div className="hj-grupo">
                <div className="hj-grupo-topo">
                  <Pilula cor="cor-verde" n={d.feitasHoje.length}>
                    Resolvidas
                  </Pilula>
                </div>
                {d.feitasHoje.map((t) => linha(t, "nenhuma", junta([t.doneAt && hourLabel(t.doneAt), t.assigneeName, t.contexto])))}
              </div>
            )}
          </section>
        </div>

        <section>
          <h2 className="hj-secao-titulo">Equipe</h2>
          {d.pessoas.length === 0 && <div className="hj-vazio">Nenhuma pessoa ativa no workspace.</div>}
          {d.pessoas.map((p) => {
            const doDia = p.feitasHoje + p.fazendo.length + p.filaTotal;
            return (
              <div key={p.id} className="hj-pessoa">
                <div className="hj-pessoa-topo">
                  <Avatar user={p} size={38} ring={false} />
                  <div style={{ minWidth: 0 }}>
                    <div className="hj-pessoa-nome" title={p.name}>
                      {p.name}
                    </div>
                    <div className="hj-pessoa-cargo">
                      {p.jobTitle}
                      {p.atrasadas > 0 && (
                        <>
                          {" · "}
                          <span style={{ color: "var(--vermelho)", fontWeight: 600 }}>
                            {p.atrasadas} {p.atrasadas === 1 ? "atrasada" : "atrasadas"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {doDia > 0 && (
                    <div className="hj-dia">
                      <div className="hj-dia-rotulo">
                        <span>Resolvidas hoje</span>
                        <b>
                          {p.feitasHoje}/{doDia}
                        </b>
                      </div>
                      {/* Um traço por tarefa, até 12 — acima disso a barra vira ruído. */}
                      {doDia <= 12 && (
                        <div className="hj-dia-barra" aria-hidden>
                          {Array.from({ length: doDia }, (_, i) => (
                            <i key={i} className={i < p.feitasHoje ? "feita" : i < p.feitasHoje + p.fazendo.length ? "fazendo" : undefined} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="hj-pessoa-cols">
                  <div className="hj-grupo">
                    <div className="hj-grupo-topo">
                      <Pilula cor="cor-azul" n={p.fazendo.length}>
                        Em atendimento
                      </Pilula>
                    </div>
                    {p.fazendo.length === 0 ? (
                      <div className="hj-col-vazio">Nada em atendimento</div>
                    ) : (
                      p.fazendo.map((t) =>
                        linha(
                          t,
                          "andar",
                          <>
                            {t.column === "waiting" ? junta(["aguardando", t.contexto]) : junta([`começou ${ha(t.startedAt ?? t.createdAt, agora)}`, t.contexto])}
                            {prazo(t)}
                          </>,
                          t.column === "doing",
                        ),
                      )
                    )}
                  </div>

                  <div className="hj-grupo">
                    <div className="hj-grupo-topo">
                      <Pilula cor="cor-roxo" n={p.filaTotal}>
                        Na fila
                      </Pilula>
                    </div>
                    {p.filaTotal === 0 ? (
                      <div className="hj-col-vazio">Fila vazia</div>
                    ) : (
                      <>
                        {p.fila.map((t) =>
                          linha(
                            t,
                            "andar",
                            <>
                              {junta([`${ha(t.createdAt, agora)}`, t.contexto])}
                              {prazo(t)}
                            </>,
                          ),
                        )}
                        {p.filaTotal > p.fila.length && (
                          <Link className="hj-mais" href={`/atividades?assignee=${p.id}&status=todo`}>
                            Ver as outras {p.filaTotal - p.fila.length}
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <div className="hj-rodape">
        <Link href="/atividades">Todas as demandas</Link>
        {d.projetosAtivos > 0 && (
          <Link href="/projects">
            {d.projetosAtivos} {d.projetosAtivos === 1 ? "projeto em andamento" : "projetos em andamento"}
          </Link>
        )}
      </div>
    </div>
  );
}
