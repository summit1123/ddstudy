import { promises as fs } from "fs";
import path from "path";
import { demoDb } from "../src/lib/demo-seed";

async function main() {
  const dbPath = path.join(process.cwd(), "data", "app-db.json");
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(demoDb, null, 2));
  console.log(`Seeded demo data at ${dbPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
