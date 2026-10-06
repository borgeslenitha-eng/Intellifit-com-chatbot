import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { pool } from "../src/config/database";
// PostgreSQL embedded for tests only. Production continues to use pg + PostgreSQL.
export async function testDatabase() {
  const db = new PGlite();
  await db.exec(readFileSync("database.sql", "utf8"));
  await db.exec(readFileSync("migration-chat.sql", "utf8"));
  const query = async (text: string, args?: any[]) => {
    const r = await db.query(text, args);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };
  (pool as any).query = query;
  (pool as any).connect = async () => ({ query, release() {} });
  return db;
}
