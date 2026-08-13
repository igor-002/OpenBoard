// CommonJS de propósito: entra via `node --require`, que roda antes do loader
// de ESM. Neutraliza o pacote `server-only` para os módulos de servidor poderem
// ser importados direto no teste.
/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("node:module");
const originalLoad = Module._load;

Module._load = function load(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
