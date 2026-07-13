// Prefixo do basePath para URLs montadas à mão (fetch, EventSource, <a href> cru).
// next/link prefixa sozinho; URL em string NÃO — sem isso, em produção
// (basePath=/openboard) a request escapa do app e cai na raiz do IP.
// NEXT_PUBLIC_BASE_PATH é inlined no build (mapeado de BASE_PATH no next.config.ts).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const withBasePath = (p: string) => `${BASE_PATH}${p}`;
