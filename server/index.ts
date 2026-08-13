import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { initDatabase } from "./db";
import { startPurgeJob } from "./jobs/purgeExpiredTrash";

import authRouter from "./routes/auth";
import lightingRouter from "./routes/lighting";
import blumRouter from "./routes/blum";
import tasksRouter from "./routes/tasks";
import issuesRouter from "./routes/issues";
import scheduleRouter from "./routes/schedule";
import usersRouter from "./routes/users";
import trashRouter from "./routes/trash";
import filesArchiveRouter from "./routes/filesArchive";
import lookupsRouter from "./routes/lookups";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

initDatabase();
startPurgeJob();

const app = express();
app.use(express.json({ limit: "30mb" }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/lighting", lightingRouter);
app.use("/api/blum", blumRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/users", usersRouter);
app.use("/api/trash", trashRouter);
app.use("/api/files-archive", filesArchiveRouter);
app.use("/api/lookups", lookupsRouter);

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "..", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Terence's Journal API listening on http://localhost:${port}`);
});
