import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
import { WebSocket, WebSocketServer } from "ws";

dotenv.config({ path: resolve(fileURLToPath(new URL("../../../.env", import.meta.url))) });

const { prisma } = await import("@wish-studio/database");

const occasions = ["BIRTHDAY", "ANNIVERSARY", "RETIREMENT", "GRADUATION"] as const;
const wishInput = z.object({
  occasion: z.enum(occasions),
  recipients: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
  message: z.string().trim().min(1).max(2000),
});

const allowedOrigins = (process.env.WEB_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());
const app = express();
const server = createServer(app);
const websocketServer = new WebSocketServer({ server, path: "/ws" });

app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  }),
);
app.use(express.json({ limit: "16kb" }));

app.get("/api/health", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ok", database: "connected" });
  } catch {
    response.status(503).json({ status: "unavailable", database: "disconnected" });
  }
});

app.post("/api/wishes", async (request, response) => {
  const parsed = wishInput.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid wish." });
    return;
  }

  try {
    const wish = await prisma.wish.create({ data: parsed.data });
    const event = JSON.stringify({ type: "wish.created", wish });

    for (const client of websocketServer.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(event);
    }

    response.status(201).json({ wish });
  } catch (error) {
    console.error("Unable to save wish:", error);
    response.status(503).json({ error: "Could not save the wish. Check the database connection." });
  }
});

websocketServer.on("connection", (socket, request) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    socket.close(1008, "Origin not allowed");
  }
});

const port = Number(process.env.API_PORT ?? 4000);
server.listen(port, "0.0.0.0", () => {
  console.log(`Wish Studio API listening on http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    websocketServer.close();
    server.close(() => void prisma.$disconnect());
  });
}