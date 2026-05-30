import { promises as fs } from "fs";
import path from "path";
import { seedDb } from "../src/lib/seed-data";

async function main() {
  const dbPath = path.join(process.cwd(), "data", "app-db.json");
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(seedDb, null, 2));
  console.log(`Seeded local data at ${dbPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
