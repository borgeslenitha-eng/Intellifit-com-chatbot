import { modelInfo } from "../ml/classifier";
import { Router } from "express";
import { pool } from "../config/database";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware";
import { respond, Store } from "./engine";
import { dateOnly } from "./validation";
const router = Router();
router.use(authMiddleware);
router.get("/model-info", (_req, res) => res.json(modelInfo));
router.get("/history", async (req: AuthRequest, res, next) => {
  try {
    const r = await pool.query(
      "SELECT role,content,created_at FROM (SELECT id,role,content,created_at FROM chat_messages WHERE user_id=$1 ORDER BY id DESC LIMIT 100) m ORDER BY id",
      [req.userId],
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});
router.delete("/history", async (req: AuthRequest, res, next) => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "INSERT INTO chat_sessions(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [req.userId],
    );
    await c.query(
      "SELECT user_id FROM chat_sessions WHERE user_id=$1 FOR UPDATE",
      [req.userId],
    );
    await c.query("DELETE FROM chat_messages WHERE user_id=$1", [req.userId]);
    await c.query("UPDATE chat_sessions SET state='{}' WHERE user_id=$1", [
      req.userId,
    ]);
    await c.query("COMMIT");
    res.sendStatus(204);
  } catch (e) {
    await c.query("ROLLBACK");
    next(e);
  } finally {
    c.release();
  }
});
/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Conversar com o assistente de estoque (confirmação antes de alterações)
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: O que tenho na geladeira?
 *     responses:
 *       200:
 *         description: Resposta, atalhos e indicação de alteração do estoque
 *       400:
 *         description: Mensagem inválida
 *       401:
 *         description: Autenticação necessária
 */
router.post("/", async (req: AuthRequest, res, next) => {
  if (
    typeof req.body?.message !== "string" ||
    !req.body.message.trim() ||
    req.body.message.length > 2000
  ) {
    res
      .status(400)
      .json({ error: "Envie uma mensagem de 1 a 2000 caracteres." });
    return;
  }
  const c = await pool.connect();
  const uid = req.userId;
  try {
    await c.query("BEGIN");
    await c.query(
      "INSERT INTO chat_sessions(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [uid],
    );
    const session = await c.query(
      "SELECT state,updated_at FROM chat_sessions WHERE user_id=$1 FOR UPDATE",
      [uid],
    );
    const row = session.rows[0];
    const state =
      Date.now() - new Date(row.updated_at).getTime() > 30 * 60 * 1000
        ? {}
        : row.state;
    const store: Store = {
      list: async () => {
        const r = await c.query(
          `SELECT id,name,category,quantity::float,unit,storage_location AS "storageLocation",to_char(expiration_date,'YYYY-MM-DD') AS "expirationDate" FROM foods WHERE user_id=$1 ORDER BY id FOR UPDATE`,
          [uid],
        );
        return r.rows.map((f) => ({
          ...f,
          expirationDate: dateOnly(f.expirationDate),
        }));
      },
      create: async (f) => {
        const r = await c.query(
          "INSERT INTO foods(user_id,name,category,quantity,unit,storage_location,expiration_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
          [
            uid,
            f.name,
            f.category,
            f.quantity,
            f.unit,
            f.storageLocation,
            f.expirationDate,
          ],
        );
        return r.rows[0];
      },
      update: async (id, f) => {
        await c.query(
          "UPDATE foods SET name=$1,category=$2,quantity=$3,unit=$4,storage_location=$5,expiration_date=$6 WHERE id=$7 AND user_id=$8",
          [
            f.name,
            f.category,
            f.quantity,
            f.unit,
            f.storageLocation,
            f.expirationDate,
            id,
            uid,
          ],
        );
      },
      remove: async (id) => {
        await c.query("DELETE FROM foods WHERE id=$1 AND user_id=$2", [
          id,
          uid,
        ]);
      },
    };
    const result = await respond(req.body.message, state, store);
    await c.query(
      "UPDATE chat_sessions SET state=$1,updated_at=NOW() WHERE user_id=$2",
      [JSON.stringify(result.state), uid],
    );
    await c.query(
      "INSERT INTO chat_messages(user_id,role,content) VALUES($1,'user',$2),($1,'assistant',$3)",
      [uid, req.body.message, result.reply],
    );
    await c.query("COMMIT");
    res.json({
      reply: result.reply,
      changed: result.changed ?? false,
      actions: result.actions ?? [],
      pending: !!result.state.stage,
      recognition: result.recognition,
    });
  } catch (e) {
    await c.query("ROLLBACK");
    next(e);
  } finally {
    c.release();
  }
});
export default router;
