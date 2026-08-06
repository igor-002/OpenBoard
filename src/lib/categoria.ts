// Categoria do projeto (campo `tag`): é texto livre no banco, mas se comporta
// como lista — as opções saem do que já existe e grafias que só diferem em
// maiúscula/minúscula (ou em espaço sobrando) são a MESMA categoria.

/** Limpa espaço sobrando antes de gravar/exibir. */
export const limparCategoria = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * Chave de comparação: caixa e espaço. Acento NÃO é normalizado de propósito
 * (Atendaí ≠ Atendai). Tem que colapsar espaço igual ao `limparCategoria`,
 * senão "Atendai  Provedor" gravado no banco nunca casa com a opção da lista.
 */
export const chaveCategoria = (s: string) => limparCategoria(s).toLowerCase();
