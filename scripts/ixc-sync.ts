// Dispara o sync IXC→DB fora do Next (one-off / cron manual).
// Rodar: npx tsx --env-file=.env --conditions=react-server scripts/ixc-sync.ts
import { runFullSync } from "@/server/comercial/sync";

runFullSync()
  .then((r) => {
    console.log("SYNC:", r);
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
