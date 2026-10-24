import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ARQUIVO_TXT_MAX_BYTES,
  ARQUIVO_TXT_VERSOES_GUARDADAS,
  contaLinhas,
  pareceTexto,
  previa,
  validaChaveArquivoTxt,
} from "@/lib/arquivo-txt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Situação da versão atual: o que foi enviado e se o PC já gravou na pasta.
export async function GET(req: NextRequest) {
  const chave = validaChaveArquivoTxt(req);
  if (!chave.ok) return NextResponse.json({ error: chave.error }, { status: chave.status });

  const atual = await db.arquivoTxt.findFirst({ orderBy: { createdAt: "desc" } });
  if (!atual) return NextResponse.json({ atual: null }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    {
      atual: {
        versao: atual.id,
        nome: atual.nome,
        tamanho: atual.tamanho,
        linhas: atual.linhas,
        enviadoEm: atual.createdAt,
        aplicadoEm: atual.aplicadoEm,
        aplicadoPor: atual.aplicadoPor,
        previa: previa(atual.data),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// Upload (multipart, campo "arquivo"). Grava os bytes exatamente como vieram.
export async function POST(req: NextRequest) {
  const chave = validaChaveArquivoTxt(req);
  if (!chave.ok) return NextResponse.json({ error: chave.error }, { status: chave.status });

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  if (!/\.txt$/i.test(arquivo.name)) return NextResponse.json({ error: "O arquivo precisa ser .txt." }, { status: 400 });
  if (arquivo.size === 0) return NextResponse.json({ error: "O arquivo está vazio." }, { status: 400 });
  if (arquivo.size > ARQUIVO_TXT_MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 10 MB." }, { status: 400 });
  }
  const buf = new Uint8Array(await arquivo.arrayBuffer());
  if (!pareceTexto(buf)) return NextResponse.json({ error: "Isso não parece um arquivo de texto." }, { status: 400 });

  const criado = await db.arquivoTxt.create({
    data: { nome: arquivo.name.slice(0, 200), tamanho: buf.length, linhas: contaLinhas(buf), data: buf },
    select: { id: true },
  });

  // Poda: mantém só as últimas N versões.
  const antigas = await db.arquivoTxt.findMany({
    orderBy: { createdAt: "desc" },
    skip: ARQUIVO_TXT_VERSOES_GUARDADAS,
    select: { id: true },
  });
  if (antigas.length) await db.arquivoTxt.deleteMany({ where: { id: { in: antigas.map((a) => a.id) } } });

  return NextResponse.json({ ok: true, versao: criado.id });
}
