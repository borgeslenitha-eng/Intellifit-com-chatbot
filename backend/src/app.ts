import chatRoutes from "./chat/routes";
import express from "express";
import foodRoutes from "./routes/food.routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import authRoutes from "./routes/auth.routes";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

const app = express();

app.use(express.json({ limit: "32kb" }));
app.use("/api/chat", chatRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.json({
    message: "API IntelliFit funcionando!",
  });
});

app.use("/api/foods", foodRoutes);
app.use("/api/auth", authRoutes);

app.use(errorMiddleware);

export default app;
