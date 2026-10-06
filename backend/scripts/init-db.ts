import { readFileSync } from "node:fs";
import { pool } from "../src/config/database";
(async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    for (const file of ["database.sql", "migration-chat.sql"])
      await c.query(readFileSync(file, "utf8"));
    await c.query("COMMIT");
    console.log("Tabelas prontas. Dados existentes preservados.");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
