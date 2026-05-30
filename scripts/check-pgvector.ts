#!/usr/bin/env tsx

import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

async function main() {
  const { pgvectorStatus } = await import("../src/lib/pgvector");
  const status = await pgvectorStatus();
  console.log(JSON.stringify({ ok: true, ...status }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    details: "details" in Object(error) ? Object(error).details : undefined,
  }, null, 2));
  process.exit(1);
});
