import app from "./app";
import { pool } from "./config/database";
const port = Number(process.env.PORT || 3000);
(async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24)
    throw new Error(
      "Configure JWT_SECRET no .env com pelo menos 24 caracteres.",
    );
  await pool.query("SELECT 1 FROM chat_sessions LIMIT 1");
  app.listen(port, () =>
    console.log(`IntelliFit: http://localhost:${port} | Swagger: /api-docs`),
  );
})().catch((e) => {
  console.error(
    "Não foi possível iniciar:",
    e.message,
    "\nConfira o .env e execute npm run db:init.",
  );
  process.exit(1);
});
