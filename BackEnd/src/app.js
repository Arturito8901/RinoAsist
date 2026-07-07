import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import assignmentsRoutes from "./routes/assignments.routes.js";
import docentesRoutes from "./routes/docentes.routes.js";
import alumnosRoutes from "./routes/alumnos.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
  ...(process.env.CLIENT_ORIGINS?.split(",") || []),
].filter(Boolean).map((origin) => origin.trim());

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    return (
      ["http:", "https:"].includes(protocol) &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".devtunnels.ms"))
    );
  } catch {
    return false;
  }
};

app.disable("etag");

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origen no permitido"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Frontend-Origin"],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/docentes", docentesRoutes);
app.use("/api/alumnos", alumnosRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

export default app;
