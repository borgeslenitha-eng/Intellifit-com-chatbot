import { Request, Response, NextFunction } from "express";
export const errorMiddleware = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error.code === "23505") {
    res.status(409).json({ error: "E-mail já cadastrado." });
    return;
  }
  if (error.code || error.type === "entity.parse.failed") {
    const invalid = error.type === "entity.parse.failed";
    if (!invalid) console.error("Falha de infraestrutura:", error.code);
    res
      .status(invalid ? 400 : 503)
      .json({
        error: invalid
          ? "JSON inválido."
          : "Não foi possível acessar o banco. Confira a conexão e execute npm run db:init.",
      });
    return;
  }
  res
    .status(
      error.message === "Alimento não encontrado."
        ? 404
        : error.message === "E-mail já cadastrado."
          ? 409
          : 400,
    )
    .json({ error: error.message || "Não foi possível concluir a operação." });
};
